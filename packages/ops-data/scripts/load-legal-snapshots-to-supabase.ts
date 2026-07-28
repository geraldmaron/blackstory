/**
 * Load the curated legal snapshot corpus into Supabase and project it into the
 * active release.
 *
 * Until this ran, the /law surface's documents lived only in
 * apps/web/src/data/legal-seed.ts. Supabase carried the 55 entity records
 * (release_entities kind='law' / kind='case') but nothing held the canonical
 * citation, the archive capture, or the plain-language explainer.
 *
 * Entity linkage: the seed used its own `ent_seed_law_*` id namespace, which
 * exists nowhere in Supabase. Each mapping below was verified against
 * bb_public.release_entities in the active release. Three seed rows have no
 * canonical entity yet and load unlinked rather than inventing ids.
 *
 * Usage (repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/load-legal-snapshots-to-supabase.ts
 *
 *   DRY_RUN=0 LOAD_LEGAL_SNAPSHOTS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/load-legal-snapshots-to-supabase.ts
 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import {
  LEGAL_SEED_RELEASE_ID,
  listLegalSnapshots,
  getLegalCatalogEntry,
} from '../../../apps/web/src/data/legal-seed.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const dryRun = process.env.DRY_RUN !== '0';
const applyFlag = process.env.LOAD_LEGAL_SNAPSHOTS_APPLY === '1';

/**
 * seed slug -> canonical entity id, each verified present in the active release.
 * `null` means no canonical entity exists yet (publishing those is a separate call).
 */
const CANONICAL_ENTITY_BY_SLUG: Record<string, string | null> = {
  'civil-rights-act-1964': 'ent_law_civil_rights_act_1964',
  'voting-rights-act-1965': 'ent_law_voting_rights_act_1965',
  'fair-housing-act-1968': 'ent_law_fair_housing_act_1968',
  'brown-v-board-of-education': 'ent_case_brown_v_board_of_education_1954',
  'shelby-county-v-holder': 'ent_case_shelby_county_v_holder_2013',
  'students-for-fair-admissions-v-harvard': 'ent_case_sffa_v_harvard_2023',
  'thirteenth-amendment': 'ent_law_13th_amendment_1865',
  'fourteenth-amendment': 'ent_law_14th_amendment_1868',
  'fifteenth-amendment': 'ent_law_15th_amendment_1870',
  '42-usc-1983': null,
  'title-vii-cfr-part-1604': null,
  'georgia-sb202-2021': null,
};

function contentHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

const snapshots = listLegalSnapshots();
const rows = snapshots.map((snapshot) => {
  const catalog = getLegalCatalogEntry(snapshot.id);
  if (!(snapshot.slug in CANONICAL_ENTITY_BY_SLUG)) {
    throw new Error(
      `slug ${snapshot.slug} has no entry in CANONICAL_ENTITY_BY_SLUG — add a verified mapping (or null) before loading`,
    );
  }
  const payload = {
    id: snapshot.id,
    slug: snapshot.slug,
    title: snapshot.title,
    kind: snapshot.kind,
    lawStatus: snapshot.lawStatus,
    jurisdictionId: snapshot.jurisdictionId,
    topics: [...snapshot.topics],
    citation: snapshot.citation,
    ...(catalog?.explainer ? { explainer: catalog.explainer } : {}),
    ...(snapshot.factId ? { factId: snapshot.factId } : {}),
    ...(CANONICAL_ENTITY_BY_SLUG[snapshot.slug]
      ? { canonicalEntityId: CANONICAL_ENTITY_BY_SLUG[snapshot.slug] }
      : {}),
  };
  return { snapshot, catalog, payload, canonicalEntityId: CANONICAL_ENTITY_BY_SLUG[snapshot.slug] };
});

const linked = rows.filter((row) => row.canonicalEntityId).length;
const withExplainer = rows.filter((row) => row.catalog?.explainer).length;
console.log(
  `Corpus: release ${LEGAL_SEED_RELEASE_ID}, ${rows.length} snapshots, ${linked} entity-linked, ${withExplainer} with explainers`,
);
for (const row of rows.filter((r) => !r.canonicalEntityId)) {
  console.log(`  unlinked (no canonical entity yet): ${row.snapshot.slug}`);
}

if (dryRun || !applyFlag) {
  console.log('Dry run — no writes. Re-run with DRY_RUN=0 LOAD_LEGAL_SNAPSHOTS_APPLY=1 to apply.');
  process.exit(0);
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

try {
  await client.query('BEGIN');

  const { rows: activeRows } = await client.query(
    `SELECT release_id FROM bb_public.active_release WHERE id = 'active'`,
  );
  const releaseId = activeRows[0]?.release_id;
  if (!releaseId) throw new Error('no active release — cannot project legal snapshots');

  // Every declared entity link must actually exist in the active release.
  for (const row of rows) {
    if (!row.canonicalEntityId) continue;
    const { rows: hit } = await client.query(
      `SELECT 1 FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = $2`,
      [releaseId, row.canonicalEntityId],
    );
    if (hit.length === 0) {
      throw new Error(
        `${row.snapshot.slug} maps to ${row.canonicalEntityId}, which is not in release ${releaseId}`,
      );
    }
  }

  for (const row of rows) {
    const { snapshot, catalog, payload, canonicalEntityId } = row;
    await client.query(
      `INSERT INTO bb_reference.legal_snapshots
         (id, slug, title, kind, law_status, jurisdiction_id, topics, citation,
          explainer, fact_id, canonical_entity_id, status, row_updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published', now())
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug, title = EXCLUDED.title, kind = EXCLUDED.kind,
         law_status = EXCLUDED.law_status, jurisdiction_id = EXCLUDED.jurisdiction_id,
         topics = EXCLUDED.topics, citation = EXCLUDED.citation,
         explainer = EXCLUDED.explainer, fact_id = EXCLUDED.fact_id,
         canonical_entity_id = EXCLUDED.canonical_entity_id,
         status = EXCLUDED.status, row_updated_at = now()`,
      [
        snapshot.id,
        snapshot.slug,
        snapshot.title,
        snapshot.kind,
        snapshot.lawStatus,
        snapshot.jurisdictionId,
        [...snapshot.topics],
        JSON.stringify(snapshot.citation),
        catalog?.explainer ? JSON.stringify(catalog.explainer) : null,
        snapshot.factId ?? null,
        canonicalEntityId,
      ],
    );

    await client.query(
      `INSERT INTO bb_public.release_legal_snapshots
         (release_id, snapshot_id, slug, canonical_entity_id, payload, content_hash)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (release_id, snapshot_id) DO UPDATE SET
         slug = EXCLUDED.slug,
         canonical_entity_id = EXCLUDED.canonical_entity_id,
         payload = EXCLUDED.payload,
         content_hash = EXCLUDED.content_hash`,
      [
        releaseId,
        snapshot.id,
        snapshot.slug,
        canonicalEntityId,
        JSON.stringify(payload),
        contentHash(payload),
      ],
    );
  }

  await client.query('COMMIT');
  console.log(`Wrote ${rows.length} legal snapshots and projected them into ${releaseId}.`);
} catch (error) {
  await client.query('ROLLBACK');
  await client.end();
  throw error;
}

await client.end();
