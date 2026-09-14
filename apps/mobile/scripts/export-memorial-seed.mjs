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
const requireFromOpsData = createRequire(resolve(here, '../../../packages/ops-data/package.json'));
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

/**
 * Memorial names whose entity record is filed under a fuller or differently punctuated name.
 * Each pair was checked by hand against the entity's summary in the active release before
 * being listed here.
 *
 * Matching must stay exact; every variant belongs in this table. First-token + last-token
 * fuzzy matching attached three unrelated people to victims on the wall, along with that
 * stranger's coordinates on the victim's memorial pin:
 *   - "Charles Brown"   -> Charles I. Brown, a 1914 founder of Phi Beta Sigma at Howard
 *   - "George Bush III" -> George Washington Bush, an 1840s Black pioneer settler
 *   - "Robert Johnson"  -> Robert L. Johnson, who founded BET in 1980 and is living
 * Common Black surnames make near-miss collisions routine rather than exceptional, and no
 * entity field separates a memorial victim from anyone else: Charles I. Brown carries
 * status `deceased` exactly as the real victims do.
 *
 * Where those three stand now (repo-5jxh):
 *   - Charles Brown and Robert Johnson are real victims and stay UNLINKED. Neither has an
 *     entity record; the active release holds only the namesakes above. The research that a
 *     record would be built from, with its sources, is in
 *     docs/research/memorial-names-wall.sources.json under `namesAwaitingEntityRecords`. Add
 *     the alias here only after a record exists and its summary describes the victim.
 *   - George Bush III is no longer a memorial name at all. He had been carried as a 2016
 *     St. Louis police killing; the contemporaneous record is that he shot a police sergeant
 *     twice in the head and was killed the next morning firing on the officers who found him.
 *     He is off the roll, so there is nothing here left to link. See
 *     `intentionally_excluded_examples` in
 *     docs/research/police-violence-memorial-names.sources.json.
 */
const VERIFIED_ENTITY_ALIASES = new Map([
  // Emanuel AME Church, Charleston, June 17 2015.
  ['clementa pinckney', 'ent_clementa_c_pinckney_001'],
  ['cynthia hurd', 'ent_cynthia_graham_hurd_001'],
  ['daniel simmons', 'ent_daniel_l_simmons_sr_001'],
  ['depayne middleton doctor', 'ent_depayne_middleton_doctor_001'],
  ['ethel lance', 'ent_ethel_lee_lance_001'],
  ['sharonda coleman singleton', 'ent_sharonda_coleman_singleton_001'],
  // Orangeburg Massacre, February 8 1968.
  ['delano herman middleton', 'gap_delano_middleton'],
  // NAACP chapter president, killed by Klan arson in Hattiesburg, January 1966.
  ['vernon ferdinand dahmer', 'ent_vernon_dahmer_001'],
  // repo-5jxh. Both of these are why exact matching replaced fuzzy matching here: "Charles Brown"
  // had been matched to a 1914 Phi Beta Sigma founder and "Robert Johnson" to the living founder
  // of BET, both different men entirely. They are aliased explicitly, to records created for them
  // (packages/ops-data/scripts/data/memorial-victim-cohort.ts), rather than matched by name —
  // because a common name is exactly what went wrong before, and an alias states which man is
  // meant.
  ['charles brown', 'ent_charles_brown_1957_001'],
  ['robert johnson', 'ent_robert_johnson_1934_001'],
]);

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

const unusedAliases = new Set(VERIFIED_ENTITY_ALIASES.keys());

const entries = alphabetical.map((name) => {
  const normalized = normalizeName(name);
  const aliasId = VERIFIED_ENTITY_ALIASES.get(normalized);
  if (aliasId) unusedAliases.delete(normalized);
  const hit = aliasId
    ? candidates.find((row) => row.entity_id === aliasId)
    : candidates.find(
        (row) =>
          typeof row.display_name === 'string' && normalizeName(row.display_name) === normalized,
      );
  if (!hit) {
    // An unlinked name still belongs on the wall; a wrong link does not.
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

// A stale alias would quietly revert its name to unlinked, so fail instead of shipping that.
if (unusedAliases.size > 0) {
  throw new Error(
    `VERIFIED_ENTITY_ALIASES has ${unusedAliases.size} entr(ies) matching no memorial name: ` +
      `${[...unusedAliases].join(', ')}. Remove them or fix the spelling.`,
  );
}
const unresolvedAliases = [...VERIFIED_ENTITY_ALIASES.entries()].filter(
  ([, id]) => !candidates.some((row) => row.entity_id === id),
);
if (unresolvedAliases.length > 0) {
  throw new Error(
    `VERIFIED_ENTITY_ALIASES points at entity ids absent from the active release: ` +
      `${unresolvedAliases.map(([name, id]) => `${name} -> ${id}`).join(', ')}`,
  );
}

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
