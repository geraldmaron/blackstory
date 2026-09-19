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
 * exists nowhere in Supabase. The mapping now lives in
 * lib/legal-snapshot-entity-links.ts, next to the ruling for each row that has
 * no entity — this file connects to Postgres on import, so nothing could assert
 * anything about the map while it lived here. Two rows still load unlinked, by
 * decision rather than by omission; the check below is what keeps a wrong id
 * from landing quietly.
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
import { resolveCanonicalEntityId } from './lib/legal-snapshot-entity-links.ts';

const dryRun = process.env.DRY_RUN !== '0';
const applyFlag = process.env.LOAD_LEGAL_SNAPSHOTS_APPLY === '1';

function contentHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

const snapshots = listLegalSnapshots();
const rows = snapshots.map((snapshot) => {
  const catalog = getLegalCatalogEntry(snapshot.id);
  // Throws on a slug nobody has ruled on, rather than defaulting it to "no entity" — an
  // unconsidered snapshot would otherwise be indistinguishable from a deliberate blank.
  const canonicalEntityId = resolveCanonicalEntityId(snapshot.slug);
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
    ...(snapshot.effectiveYear ? { effectiveYear: snapshot.effectiveYear } : {}),
    ...(canonicalEntityId ? { canonicalEntityId } : {}),
  };
  return { snapshot, catalog, payload, canonicalEntityId };
});

const linked = rows.filter((row) => row.canonicalEntityId).length;
const withExplainer = rows.filter((row) => row.catalog?.explainer).length;
console.log(
  `Corpus: release ${LEGAL_SEED_RELEASE_ID}, ${rows.length} snapshots, ${linked} entity-linked, ${withExplainer} with explainers`,
);
for (const row of rows.filter((r) => !r.canonicalEntityId)) {
  console.log(
    `  unlinked (see the ruling in lib/legal-snapshot-entity-links.ts): ${row.snapshot.slug}`,
  );
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
    `SELECT release_id FROM published.active_release WHERE id = 'active'`,
  );
  const releaseId = activeRows[0]?.release_id;
  if (!releaseId) throw new Error('no active release — cannot project legal snapshots');

  // Every declared entity link must actually exist in the active release.
  for (const row of rows) {
    if (!row.canonicalEntityId) continue;
    const { rows: hit } = await client.query(
      `SELECT 1 FROM published.release_entities WHERE release_id = $1 AND entity_id = $2`,
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
      `INSERT INTO reference.legal_snapshots
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
      `INSERT INTO published.release_legal_snapshots
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
