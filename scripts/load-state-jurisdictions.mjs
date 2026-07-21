#!/usr/bin/env node
/**
 * Dry-run loader for state jurisdiction polygons into `bb_reference.jurisdictions`.
 * Validates fixture rows and prints the upsert plan; never writes to Supabase unless
 * explicitly passed `--apply` (blocked here — human operator applies after review).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FIXTURE = path.join(
  ROOT,
  'packages/domain/src/geo-integrity/fixtures/state-jurisdictions.fixture.json',
);

function printUsage() {
  console.log(`Usage: node scripts/load-state-jurisdictions.mjs [options]

Options:
  --dry-run            Validate fixture and print load plan (default)
  --fixture <path>     JSON fixture path (default: packages/domain/.../state-jurisdictions.fixture.json)
  --apply              Blocked in this script — use operator-run Supabase migration/apply after review
  -h, --help           Show this help
`);
}

function parseArgs(argv) {
  const options = { dryRun: true, fixture: DEFAULT_FIXTURE, apply: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--apply') {
      options.apply = true;
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
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    state_fips: row.state_fips,
    postalCode: row.metadata.postalCode,
    ringVertices: row.metadata.geometry.coordinates[0].length,
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

async function runDryRun(fixturePath) {
  const fixture = await loadFixture(fixturePath);
  const validated = fixture.jurisdictions.map(validateJurisdictionRow);
  const ids = new Set();
  for (const row of validated) {
    if (ids.has(row.id)) {
      throw new Error(`Duplicate jurisdiction id: ${row.id}`);
    }
    ids.add(row.id);
  }

  console.log('Geo-integrity jurisdiction load — DRY RUN');
  console.log(`Fixture: ${fixturePath}`);
  console.log(`Source: ${fixture.source ?? 'unknown'} (${fixture.sourceVersion ?? 'n/a'})`);
  console.log(`Rows validated: ${validated.length}`);
  console.log('');
  for (const row of validated) {
    console.log(
      `- ${row.id} | ${row.postalCode} | ${row.name} | fips=${row.state_fips} | ring=${row.ringVertices} vertices`,
    );
  }
  console.log('');
  console.log('PostGIS apply (operator-only, not executed here):');
  console.log('  INSERT INTO bb_reference.jurisdictions (id, kind, name, state_fips, parent_id, metadata)');
  console.log('  VALUES (...); -- then ST_GeogFromGeoJSON(metadata->geometry) into location when column added');
  console.log('');
  console.log('No database writes performed.');
  return validated.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }
  if (options.apply) {
    console.error(
      'Refusing --apply: live Supabase writes are operator-only. Re-run with --dry-run to validate fixtures.',
    );
    process.exit(2);
  }

  const count = await runDryRun(options.fixture);
  console.log(`Dry-run complete (${count} jurisdiction row(s)).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
