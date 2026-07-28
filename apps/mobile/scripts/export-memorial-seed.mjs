/**
 * Export memorial names + optional entity/map anchors from the active Supabase release.
 * Run from repo root:
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx apps/mobile/scripts/export-memorial-seed.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMORIAL_NAMES } from '../../web/src/components/patterns/memorial-wall/memorial-names.ts';
import { normalizePgConnectionString } from '../../../packages/ops-data/scripts/lib/pg-connection.ts';

const here = dirname(fileURLToPath(import.meta.url));
// `pg` is a dependency of ops-data, not the mobile app — resolve it from there.
const requireFromOpsData = createRequire(
  resolve(here, '../../../packages/ops-data/package.json'),
);
const pg = requireFromOpsData('pg');
const outPath = resolve(here, '../src/features/memorial/catalog-seed.json');

function normalizeName(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop middle initials / titles so "Clementa C. Pinckney" matches "Clementa Pinckney". */
function coreTokens(value) {
  return normalizeName(value)
    .split(' ')
    .filter((token) => token.length > 1 && !/^(sr|jr|ii|iii|iv)$/.test(token));
}

function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  const ta = coreTokens(a);
  const tb = coreTokens(b);
  if (ta.length < 2 || tb.length < 2) return false;
  // First + last token match (ignores middle names/initials).
  return ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1];
}

const names = [...MEMORIAL_NAMES];
if (names.length === 0) {
  throw new Error('MEMORIAL_NAMES import returned no names');
}

const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL (or APP_DATABASE_URL) is required — source apps/web/.env.local');
}
const conn = normalizePgConnectionString(databaseUrl);
const client = new pg.Client({
  connectionString: conn.connectionString,
  ...(conn.ssl ? { ssl: conn.ssl } : {}),
});
await client.connect();
const { rows: candidates } = await client.query(`
  SELECT entity_id, display_name, lat, lng,
         location->>'precision' AS location_precision,
         projection->>'locationLabel' AS location_label,
         projection->>'jurisdictionLabel' AS jurisdiction_label
  FROM bb_public.release_entities
  WHERE release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
    AND kind = 'person'
`);
await client.end();

const alphabetical = [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

const entries = alphabetical.map((name) => {
  const hit = candidates.find(
    (row) => typeof row.display_name === 'string' && namesMatch(name, row.display_name),
  );
  if (!hit) {
    return { name };
  }
  const entry = {
    name,
    entityId: hit.entity_id,
  };
  if (typeof hit.location_label === 'string' && hit.location_label.trim()) {
    entry.locationLabel = hit.location_label;
  }
  if (typeof hit.jurisdiction_label === 'string' && hit.jurisdiction_label.trim()) {
    entry.placeLabel = hit.jurisdiction_label;
  }
  if (typeof hit.lat === 'number' && typeof hit.lng === 'number') {
    entry.lat = hit.lat;
    entry.lng = hit.lng;
  }
  if (typeof hit.location_precision === 'string') {
    entry.locationPrecision = hit.location_precision;
  }
  return entry;
});

const linked = entries.filter((e) => e.entityId).length;
const withCoords = entries.filter((e) => typeof e.lat === 'number').length;

const snapshot = {
  version: 'memorial-seed-2026-07-24',
  generatedAt: new Date().toISOString(),
  incompleteByDesign: true,
  names: entries,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${outPath} (${entries.length} names, ${linked} entity links, ${withCoords} map anchors)`,
);
