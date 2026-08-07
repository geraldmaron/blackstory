/**
 * Sync bb_canonical.entities.living_status onto active-release projections + search_index.
 *
 * Used when landscape-driven incremental publish cannot rebuild (no matching landscape id).
 * Only patches status / livingStatus fields — does not regenerate full projections.
 *
 * Usage:
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/sync-canonical-living-to-release.ts
 *
 * Optional: --ids=id1,id2 (default: all persons where canonical living_status is deceased
 * or presumed_deceased and release projection status differs).
 *
 * Apply:
 *   DRY_RUN=0 SYNC_CANONICAL_LIVING_TO_RELEASE_APPLY=1 ...
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.SYNC_CANONICAL_LIVING_TO_RELEASE_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function readIds(): readonly string[] | null {
  const arg = process.argv.find((a) => a.startsWith('--ids='));
  if (!arg) return null;
  return arg
    .slice('--ids='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const ids = readIds();
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const { rows } = await client.query<{
      release_id: string;
      entity_id: string;
      canonical_status: string;
      release_status: string | null;
      release_living: string | null;
    }>(
      `SELECT ar.release_id,
              e.id AS entity_id,
              e.living_status AS canonical_status,
              re.projection->>'status' AS release_status,
              re.projection->>'livingStatus' AS release_living
       FROM bb_canonical.entities e
       JOIN bb_public.active_release ar ON true
       JOIN bb_public.release_entities re
         ON re.release_id = ar.release_id AND re.entity_id = e.id
       WHERE e.kind = 'person'
         AND e.living_status IN ('deceased', 'presumed_deceased')
         AND (
           re.projection->>'status' IS DISTINCT FROM e.living_status
           OR re.projection->>'livingStatus' IS DISTINCT FROM e.living_status
         )
         AND ($1::text[] IS NULL OR e.id = ANY($1::text[]))
       ORDER BY e.id`,
      [ids],
    );

    console.log('=== Sync canonical living_status → release ===');
    console.log(`Mismatched person rows: ${rows.length}`);
    for (const row of rows.slice(0, 20)) {
      console.log(
        `  ${row.entity_id}: release status=${row.release_status ?? 'null'} livingStatus=${row.release_living ?? 'null'} → ${row.canonical_status}`,
      );
    }
    if (rows.length > 20) console.log(`  ...and ${rows.length - 20} more`);

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only. Set DRY_RUN=0 SYNC_CANONICAL_LIVING_TO_RELEASE_APPLY=1 to apply.',
      );
      return;
    }

    let entitiesUpdated = 0;
    let searchUpdated = 0;
    await client.query('BEGIN');
    try {
      for (const row of rows) {
        const ent = await client.query(
          `UPDATE bb_public.release_entities
           SET projection = jsonb_set(
                 jsonb_set(projection, '{status}', to_jsonb($3::text), true),
                 '{livingStatus}', to_jsonb($3::text), true
               )
           WHERE release_id = $1 AND entity_id = $2`,
          [row.release_id, row.entity_id, row.canonical_status],
        );
        entitiesUpdated += ent.rowCount ?? 0;

        /*
         * BOTH the `status` column and the `facets` blob, because the blob is what gets served.
         *
         * `search_index.facets` holds the whole search document, and
         * apps/api-public/src/http/postgres-search-index.ts's mapPostgresSearchIndexRow returns
         * `parseSearchProjection(facets)` verbatim whenever that blob is a full doc — the `status`
         * column is never consulted on that path. Updating only the column (what this script and
         * flip-release-living-to-unknown.ts both used to do) therefore changed nothing a reader
         * could see: the public search API went on serving `status: "living"` for 338 of 469
         * persons, 212 of them already recorded as deceased, Denmark Vesey and W. E. B. Du Bois
         * among them. See repo-n7p6.28.
         */
        const search = await client.query(
          `UPDATE bb_public.search_index
           SET status = $3,
               facets = CASE
                 WHEN jsonb_typeof(facets) = 'object'
                   THEN jsonb_set(facets, '{status}', to_jsonb($3::text), true)
                 ELSE facets
               END
           WHERE release_id = $1 AND entity_id = $2
             AND (status IS DISTINCT FROM $3 OR facets->>'status' IS DISTINCT FROM $3)`,
          [row.release_id, row.entity_id, row.canonical_status],
        );
        searchUpdated += search.rowCount ?? 0;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log(`\nApplied: release_entities=${entitiesUpdated} search_index=${searchUpdated}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
