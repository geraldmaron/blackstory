/**
 * repo-bx4d — realign `bb_public.search_index.facets->'eraBuckets'` with the release projection.
 *
 * 1,134 entities in the active release carry a non-empty `eraBuckets` in
 * `bb_public.release_entities.projection` but an empty one in the matching `search_index` row.
 * They render an era on their entity page and are simultaneously invisible to era filtering,
 * era facet counts, and era sort in search.
 *
 * These rows predate repo-1sq5, which made release-builder derive `eraBuckets` once and write the
 * same value to both artifacts. Republishing the affected lanes would fix them, but the incremental
 * path cannot reach this population: 918 of them are absent from `bb_research.landscape_candidates`
 * and ~192 more fail the publish gate. Copying the already-correct projection onto the search doc
 * needs no builder run and touches nothing else.
 *
 * The release projection is the authority; this script only copies it onto the search doc. It
 * invents nothing and removes nothing: a row whose projection has no era is left alone rather than
 * used to blank an existing facet. Measured before this script ran, that asymmetry is safe to rely
 * on — across the active release there were 0 rows where the facet carried an era the projection
 * lacked, and 0 where both were set but disagreed. The drift is entirely one-directional, so this
 * pass is purely additive. Both conditions are re-checked and reported on every run.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-era.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_SEARCH_FACETS_ERA_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-era.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_ERA_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** `jsonb_array_length` errors on a non-array, so every read of either side is type-guarded. */
const PROJ_ERA_LEN = `coalesce(jsonb_array_length(
  case when jsonb_typeof(re.projection->'eraBuckets') = 'array' then re.projection->'eraBuckets' end
), 0)`;
const FACET_ERA_LEN = `coalesce(jsonb_array_length(
  case when jsonb_typeof(si.facets->'eraBuckets') = 'array' then si.facets->'eraBuckets' end
), 0)`;

/**
 * Rows where the record's own projection states an era and the served search doc does not.
 * Deliberately one-directional: an empty projection era never blanks a populated facet.
 */
const STALE_PREDICATE = `
  si.release_id = r.release_id
  AND jsonb_typeof(si.facets) = 'object'
  AND ${PROJ_ERA_LEN} > 0
  AND ${FACET_ERA_LEN} = 0
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
    console.log('=== Backfill search_index.facets.eraBuckets from release projection ===');

    const total = await countStale(client);
    console.log(`Stale rows (projection has era, search facet empty): ${total}`);

    const { rows: byKind } = await client.query<{ kind: string; n: number }>(
      `SELECT si.kind, count(*)::int AS n ${JOIN} WHERE ${STALE_PREDICATE}
        GROUP BY 1 ORDER BY n DESC`,
    );
    for (const row of byKind) console.log(`  ${row.n}\t${row.kind}`);

    const { rows: sample } = await client.query<{
      entity_id: string;
      name: string;
      proj_era: string[];
    }>(
      `SELECT si.entity_id, si.name, re.projection->'eraBuckets' AS proj_era
       ${JOIN} WHERE ${STALE_PREDICATE} ORDER BY si.name LIMIT 5`,
    );
    console.log('Sample:');
    for (const row of sample) {
      console.log(`  ${row.name} (${row.entity_id}) → ${JSON.stringify(row.proj_era)}`);
    }

    // Guardrails. Neither is written by this script; a non-zero count means the drift is no longer
    // one-directional and the projection-as-authority assumption needs re-examination first.
    const { rows: guard } = await client.query<{ facet_only: number; both_differ: number }>(
      `SELECT
         count(*) FILTER (WHERE ${PROJ_ERA_LEN} = 0 AND ${FACET_ERA_LEN} > 0)::int AS facet_only,
         count(*) FILTER (WHERE ${PROJ_ERA_LEN} > 0 AND ${FACET_ERA_LEN} > 0
                            AND re.projection->'eraBuckets'
                                IS DISTINCT FROM si.facets->'eraBuckets')::int AS both_differ
       ${JOIN} WHERE si.release_id = r.release_id`,
    );
    const facetOnly = guard[0]?.facet_only ?? 0;
    const bothDiffer = guard[0]?.both_differ ?? 0;
    console.log(
      `\nLeft untouched — facet has era but projection does not: ${facetOnly}` +
        `\nLeft untouched — both set and disagreeing: ${bothDiffer}`,
    );
    if (facetOnly > 0 || bothDiffer > 0) {
      console.log('  ^ neither case is repaired here; investigate before assuming a clean sync.');
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 BACKFILL_SEARCH_FACETS_ERA_APPLY=1 to apply.');
      return;
    }

    const updated = await client.query(
      `UPDATE bb_public.search_index si
          SET facets = jsonb_set(si.facets, '{eraBuckets}', re.projection->'eraBuckets', true)
         FROM bb_public.v_active_release_id r,
              bb_public.release_entities re
        WHERE re.release_id = si.release_id
          AND re.entity_id = si.entity_id
          AND ${STALE_PREDICATE}`,
    );
    console.log(`\nApplied: search_index rows updated = ${updated.rowCount ?? 0}`);
    console.log(`Remaining stale: ${await countStale(client)}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
