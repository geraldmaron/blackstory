/**
 * Backfill `bb_public.search_index.facets.confidenceTier` from release projection claims.
 *
 * Records evidence floors need the highest accepted-claim confidence on the search index so
 * `/records` can slim off full `release_entities` hydrate. Older rows only carry `claim_count`,
 * which must never be treated as a grade.
 *
 * Derivation matches `highestClaimConfidenceTier` in `@repo/domain` publication release-builder:
 * high > medium > low > unrated.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-confidence.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_SEARCH_FACETS_CONFIDENCE_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-confidence.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_CONFIDENCE_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** Same precedence as release-builder `highestClaimConfidenceTier`. */
const COMPUTED_TIER = `
  case
    when exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(re.projection->'claims') = 'array'
          then re.projection->'claims' else '[]'::jsonb end
      ) claim
      where claim->>'confidenceLevel' = 'high'
    ) then 'high'
    when exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(re.projection->'claims') = 'array'
          then re.projection->'claims' else '[]'::jsonb end
      ) claim
      where claim->>'confidenceLevel' = 'medium'
    ) then 'medium'
    when exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(re.projection->'claims') = 'array'
          then re.projection->'claims' else '[]'::jsonb end
      ) claim
      where claim->>'confidenceLevel' = 'low'
    ) then 'low'
    else 'unrated'
  end
`;

const CURRENT_TIER = `coalesce(si.facets->>'confidenceTier', '')`;

const STALE_PREDICATE = `
  si.release_id = r.release_id
  AND jsonb_typeof(si.facets) = 'object'
  AND ${CURRENT_TIER} IS DISTINCT FROM (${COMPUTED_TIER})
`;

const JOIN = `
     FROM bb_public.search_index si
     JOIN bb_public.v_active_release_id r ON r.release_id = si.release_id
     JOIN bb_public.release_entities re
       ON re.release_id = si.release_id AND re.entity_id = si.entity_id`;

async function countStale(client: pg.Client): Promise<number> {
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n ${JOIN} WHERE ${STALE_PREDICATE}`,
  );
  return rows[0]?.n ?? 0;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();
  try {
    const before = await countStale(client);
    console.log(`stale confidenceTier facets: ${before}`);
    if (before === 0) {
      console.log('nothing to do');
      return;
    }
    if (DRY_RUN || !APPLY) {
      console.log(
        'dry run only (set DRY_RUN=0 BACKFILL_SEARCH_FACETS_CONFIDENCE_APPLY=1 to write)',
      );
      return;
    }
    const result = await client.query(
      `UPDATE bb_public.search_index si
         SET facets = jsonb_set(
           si.facets,
           '{confidenceTier}',
           to_jsonb((${COMPUTED_TIER})::text),
           true
         )
         FROM bb_public.v_active_release_id r
         JOIN bb_public.release_entities re
           ON re.release_id = r.release_id
         WHERE si.release_id = r.release_id
           AND re.entity_id = si.entity_id
           AND jsonb_typeof(si.facets) = 'object'
           AND ${CURRENT_TIER} IS DISTINCT FROM (${COMPUTED_TIER})`,
    );
    const after = await countStale(client);
    console.log(`updated rows: ${result.rowCount ?? 0}; remaining stale: ${after}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
