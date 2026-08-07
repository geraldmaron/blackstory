/**
 * repo-n7p6.28 — realign `bb_public.search_index.facets->>'status'` with the release projection.
 *
 * `search_index` stores the whole search document in the `facets` jsonb column, and
 * apps/api-public/src/http/postgres-search-index.ts's `mapPostgresSearchIndexRow` returns
 * `parseSearchProjection(facets)` verbatim whenever that blob is a full document — the `status`
 * COLUMN beside it is never read on that path. Every corrective pass to date
 * (flip-release-living-to-unknown.ts, sync-canonical-living-to-release.ts) wrote only the column,
 * so none of them changed what a reader actually receives.
 *
 * Measured before this script ran, over the active release: the public search API served
 * `status: "living"` for 338 of 469 persons — 212 already recorded deceased in their own release
 * projection (Denmark Vesey, d. 1822; W. E. B. Du Bois; Duke Ellington; John Coltrane), and 126
 * recorded `unknown`, which is a straight violation of the rule that nobody is published as living
 * without evidence.
 *
 * The release projection is the authority here; this script only copies it onto the search doc.
 * It invents nothing: a row whose projection has no status is left alone rather than defaulted.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-status.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_SEARCH_FACETS_STATUS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-status.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_STATUS_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** Rows where the served search doc disagrees with the record's own release projection. */
const MISMATCH_PREDICATE = `
  si.release_id = r.release_id
  AND jsonb_typeof(si.facets) = 'object'
  AND re.projection->>'status' IS NOT NULL
  AND si.facets->>'status' IS DISTINCT FROM re.projection->>'status'
`;

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const { rows: preview } = await client.query<{
      kind: string;
      served: string | null;
      projection_status: string;
      n: number;
    }>(
      `SELECT si.kind,
              si.facets->>'status' AS served,
              re.projection->>'status' AS projection_status,
              count(*)::int AS n
         FROM bb_public.search_index si
         JOIN bb_public.v_active_release_id r ON r.release_id = si.release_id
         JOIN bb_public.release_entities re
           ON re.release_id = si.release_id AND re.entity_id = si.entity_id
        WHERE ${MISMATCH_PREDICATE}
        GROUP BY 1, 2, 3
        ORDER BY n DESC`,
    );

    console.log('=== Backfill search_index.facets.status from release projection ===');
    const total = preview.reduce((sum, row) => sum + row.n, 0);
    console.log(`Mismatched rows: ${total}`);
    for (const row of preview) {
      console.log(
        `  ${row.n}\t${row.kind}: served="${row.served ?? 'null'}" → projection="${row.projection_status}"`,
      );
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 BACKFILL_SEARCH_FACETS_STATUS_APPLY=1 to apply.');
      return;
    }

    const updated = await client.query(
      `UPDATE bb_public.search_index si
          SET facets = jsonb_set(si.facets, '{status}', to_jsonb(re.projection->>'status'), true),
              status = re.projection->>'status'
         FROM bb_public.v_active_release_id r,
              bb_public.release_entities re
        WHERE re.release_id = si.release_id
          AND re.entity_id = si.entity_id
          AND ${MISMATCH_PREDICATE}`,
    );
    console.log(`\nApplied: search_index rows updated = ${updated.rowCount ?? 0}`);

    const { rows: after } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM bb_public.search_index si
         JOIN bb_public.v_active_release_id r ON r.release_id = si.release_id
         JOIN bb_public.release_entities re
           ON re.release_id = si.release_id AND re.entity_id = si.entity_id
        WHERE ${MISMATCH_PREDICATE}`,
    );
    console.log(`Remaining mismatches: ${after[0]?.n ?? 0}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
