/**
 * Realign `bb_public.search_index.facets->'eraBuckets'` with the release projection.
 *
 * A thin wrapper over `lib/search-facet-realign.ts`, configured for the `eraBuckets` key: this is
 * a plain array facet, so it runs through that shared engine's `array-facet` mode directly. Kept
 * as its own script, rather than dropped in favor of calling the shared engine directly, because
 * `apply-era-from-captured-evidence.ts` names it by file and tells the operator to run it next.
 *
 * 1,134 entities in the active release carry a non-empty `eraBuckets` in
 * `bb_public.release_entities.projection` but an empty one in the matching `search_index` row.
 * They render an era on their entity page and are simultaneously invisible to era filtering,
 * era facet counts, and era sort in search.
 *
 * These rows predate the release-builder change that made it derive `eraBuckets` once and write
 * the same value to both artifacts. Republishing the affected lanes would fix them, but the incremental
 * path cannot reach this population: 918 of them are absent from `bb_research.landscape_candidates`
 * and ~192 more fail the publish gate. Copying the already-correct projection onto the search doc
 * needs no builder run and touches nothing else.
 *
 * The release projection is the authority; this script only copies it onto the search doc. It
 * invents nothing and removes nothing: a row whose projection has no era is left alone rather than
 * used to blank an existing facet. Measured before this script ran, that asymmetry is safe to rely
 * on — across the active release there were 0 rows where the facet carried an era the projection
 * lacked, and 0 where both were set but disagreed. The drift is entirely one-directional, so this
 * pass is purely additive. Both conditions are re-checked and reported on every run
 * (`OVERWRITE_CONFLICTS=1` resolves a disagreement toward the projection, same as every other
 * array/scalar target in the shared engine).
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
import { applySearchFacetRealign, planSearchFacetRealign } from './lib/search-facet-realign.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_ERA_APPLY === '1';
const OVERWRITE_CONFLICTS = process.env.OVERWRITE_CONFLICTS === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log('=== Backfill search_index.facets.eraBuckets from release projection ===');

    const plan = await planSearchFacetRealign(client, {
      keys: ['eraBuckets'],
      resolveConflicts: OVERWRITE_CONFLICTS,
    });
    const report = plan.targets[0];
    if (!report) throw new Error('planSearchFacetRealign returned no report for eraBuckets');

    console.log(`Stale rows (projection has era, search facet empty): ${report.filled}`);
    console.log(
      `\nLeft untouched — facet has era but projection does not: ${report.facetOnly}` +
        `\n${report.resolved > 0 ? 'Resolved' : 'Left untouched'} — both set and disagreeing: ${
          report.resolved > 0 ? report.resolved : report.leftConflicts
        }`,
    );
    if (report.leftConflicts > 0) {
      console.log('  ^ neither case is repaired here; investigate before assuming a clean sync.');
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 BACKFILL_SEARCH_FACETS_ERA_APPLY=1 to apply.');
      return;
    }

    const updated = await applySearchFacetRealign(client, plan);
    console.log(`\nApplied: search_index rows updated = ${updated}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
