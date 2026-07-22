#!/usr/bin/env node
/**
 * Dry-run loader for state jurisdiction polygons into `bb_reference.jurisdictions`.
 * Validates fixture rows, prints the load plan, and can emit operator-reviewed SQL.
 * Never connects to Supabase or writes production data from this script.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FIXTURE = path.join(
  ROOT,
  'packages/domain/src/geo-integrity/fixtures/state-jurisdictions.fixture.json',
);
const EXPECTED_STATE_JURISDICTION_COUNT = 51;
const APPLY_ENV_VAR = 'LOAD_JURISDICTIONS_APPLY';

function printUsage() {
  console.log(`Usage: node scripts/load-state-jurisdictions.mjs [options]

Options:
  --dry-run            Validate fixture and print load plan (default)
  --emit-sql           Validate and write upsert SQL to stdout
  --output <path>      With --emit-sql, write SQL to a file instead of stdout
  --fixture <path>     JSON fixture path (default: packages/domain/.../state-jurisdictions.fixture.json)
  --apply              Operator gate: requires ${APPLY_ENV_VAR}=1; emits SQL only (no live DB connection)
  -h, --help           Show this help

Safety:
  This script never opens a Supabase/Postgres connection.
  Apply emitted SQL manually after review, e.g.:
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f jurisdictions-state-load.sql
`);
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    emitSql: false,
    fixture: DEFAULT_FIXTURE,
    output: null,
    apply: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
      options.emitSql = false;
    } else if (arg === '--emit-sql') {
      options.emitSql = true;
      options.dryRun = false;
    } else if (arg === '--apply') {
      options.apply = true;
      options.emitSql = true;
      options.dryRun = false;
    } else if (arg === '--output') {
      const next = argv[i + 1];
      if (!next) throw new Error('--output requires a path');
      options.output = path.resolve(next);
      i += 1;
    } else if (arg === '--fixture') {
      const next = argv[i + 1];
      if (!next) throw new Error('--fixture requires a path');
      options.fixture = path.resolve(next);
      i += 1;
    } else if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validatePolygonGeometry(geometry, context) {
  if (!geometry || typeof geometry !== 'object') {
    throw new Error(`${context}: metadata.geometry must be an object`);
  }
  if (geometry.type !== 'Polygon') {
    throw new Error(`${context}: metadata.geometry.type must be Polygon`);
  }
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    throw new Error(`${context}: metadata.geometry.coordinates must be a non-empty array`);
  }
  const ring = geometry.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new Error(`${context}: exterior ring must have at least 4 positions`);
  }
  for (const pos of ring) {
    if (!Array.isArray(pos) || pos.length < 2) {
      throw new Error(`${context}: each coordinate must be [lng, lat]`);
    }
    const [lng, lat] = pos;
    if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw new Error(`${context}: coordinates must be finite numbers`);
    }
  }
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) {
    throw new Error(`${context}: exterior ring must be closed (first vertex equals last)`);
  }
}

function validateJurisdictionRow(row, index) {
  const context = `jurisdictions[${index}]`;
  if (!row || typeof row !== 'object') {
    throw new Error(`${context}: must be an object`);
  }
  if (!isNonEmptyString(row.id)) throw new Error(`${context}: id is required`);
  if (row.kind !== 'state') throw new Error(`${context}: kind must be "state" for this loader`);
  if (!isNonEmptyString(row.name)) throw new Error(`${context}: name is required`);
  if (!isNonEmptyString(row.state_fips)) throw new Error(`${context}: state_fips is required`);
  if (!/^\d{2}$/.test(row.state_fips)) {
    throw new Error(`${context}: state_fips must be a 2-digit string`);
  }
  if (row.parent_id !== 'us') {
    throw new Error(`${context}: parent_id must be "us" for state rows`);
  }
  if (!row.metadata || typeof row.metadata !== 'object') {
    throw new Error(`${context}: metadata object is required`);
  }
  if (!isNonEmptyString(row.metadata.postalCode)) {
    throw new Error(`${context}: metadata.postalCode is required`);
  }
  validatePolygonGeometry(row.metadata.geometry, context);
  const expectedId = `us-${row.state_fips}`;
  if (row.id !== expectedId) {
    throw new Error(`${context}: id must be "${expectedId}" (ADR-016)`);
  }
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    state_fips: row.state_fips,
    postalCode: row.metadata.postalCode,
    ringVertices: row.metadata.geometry.coordinates[0].length,
    metadata: row.metadata,
  };
}

async function loadFixture(fixturePath) {
  const raw = await readFile(fixturePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.jurisdictions)) {
    throw new Error('Fixture must be an object with a jurisdictions array');
  }
  return parsed;
}

function validateFixtureCoverage(validated) {
  if (validated.length !== EXPECTED_STATE_JURISDICTION_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_STATE_JURISDICTION_COUNT} state jurisdictions (50 states + D.C.); got ${validated.length}`,
    );
  }

  const ids = new Set();
  const fips = new Set();
  const postalCodes = new Set();
  for (const row of validated) {
    if (ids.has(row.id)) throw new Error(`Duplicate jurisdiction id: ${row.id}`);
    if (fips.has(row.state_fips)) throw new Error(`Duplicate state_fips: ${row.state_fips}`);
    if (postalCodes.has(row.postalCode)) {
      throw new Error(`Duplicate metadata.postalCode: ${row.postalCode}`);
    }
    ids.add(row.id);
    fips.add(row.state_fips);
    postalCodes.add(row.postalCode);
  }
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildUpsertSql(validated, fixture) {
  const header = [
    '-- Generated by scripts/load-state-jurisdictions.mjs',
    `-- Fixture rows: ${validated.length}`,
    `-- Source: ${fixture.source ?? 'unknown'} (${fixture.sourceVersion ?? 'n/a'})`,
    '-- Operator review required before apply.',
    '-- Requires migration 20260721180100_jurisdictions_geography.sql (location column).',
    '',
    'BEGIN;',
    '',
  ];

  const statements = validated
    .sort((a, b) => a.state_fips.localeCompare(b.state_fips))
    .map((row) => {
      const metadataJson = JSON.stringify(row.metadata);
      const geometryJson = JSON.stringify(row.metadata.geometry);
      return [
        'INSERT INTO bb_reference.jurisdictions (',
        '  id, kind, name, state_fips, county_fips, parent_id, geohash, metadata, location',
        ') VALUES (',
        `  ${sqlLiteral(row.id)},`,
        `  ${sqlLiteral(row.kind)},`,
        `  ${sqlLiteral(row.name)},`,
        `  ${sqlLiteral(row.state_fips)},`,
        '  NULL,',
        "  'us',",
        '  NULL,',
        `  ${sqlLiteral(metadataJson)}::jsonb,`,
        `  extensions.ST_GeogFromGeoJSON(${sqlLiteral(geometryJson)})::geography`,
        ')',
        'ON CONFLICT (id) DO UPDATE SET',
        '  kind = EXCLUDED.kind,',
        '  name = EXCLUDED.name,',
        '  state_fips = EXCLUDED.state_fips,',
        '  metadata = EXCLUDED.metadata,',
        '  location = EXCLUDED.location,',
        '  updated_at = now();',
        '',
      ].join('\n');
    });

  return `${header.join('\n')}${statements.join('\n')}COMMIT;\n`;
}

async function runDryRun(fixturePath, fixture, validated) {
  console.log('Geo-integrity jurisdiction load — DRY RUN');
  console.log(`Fixture: ${fixturePath}`);
  console.log(`Source: ${fixture.source ?? 'unknown'} (${fixture.sourceVersion ?? 'n/a'})`);
  console.log(`Rows validated: ${validated.length}`);
  console.log('');
  for (const row of validated.sort((a, b) => a.postalCode.localeCompare(b.postalCode))) {
    console.log(
      `- ${row.id} | ${row.postalCode} | ${row.name} | fips=${row.state_fips} | ring=${row.ringVertices} vertices`,
    );
  }
  console.log('');
  console.log('Next steps (operator-only):');
  console.log('  node scripts/load-state-jurisdictions.mjs --emit-sql > jurisdictions-state-load.sql');
  console.log('  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f jurisdictions-state-load.sql');
  console.log('');
  console.log('No database writes performed.');
}

async function emitSql(options, fixture, validated) {
  const sql = buildUpsertSql(validated, fixture);
  if (options.output) {
    await writeFile(options.output, sql, 'utf8');
    console.error(`Wrote SQL for ${validated.length} jurisdiction row(s) to ${options.output}`);
    return;
  }
  process.stdout.write(sql);
}

function assertApplyAllowed() {
  if (process.env[APPLY_ENV_VAR] !== '1') {
    console.error(
      `Refusing --apply: set ${APPLY_ENV_VAR}=1 after operator review. This script still does not connect to Supabase.`,
    );
    process.exit(2);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (options.apply) {
    assertApplyAllowed();
    console.error(
      `Apply mode enabled (${APPLY_ENV_VAR}=1). Emitting SQL only — run psql manually against the reviewed target.`,
    );
  }

  const fixture = await loadFixture(options.fixture);
  const validated = fixture.jurisdictions.map(validateJurisdictionRow);
  validateFixtureCoverage(validated);

  if (options.emitSql) {
    await emitSql(options, fixture, validated);
    if (!options.output) {
      console.error(`Emitted SQL for ${validated.length} jurisdiction row(s).`);
    }
    return;
  }

  await runDryRun(options.fixture, fixture, validated);
  console.log(`Dry-run complete (${validated.length} jurisdiction row(s)).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
