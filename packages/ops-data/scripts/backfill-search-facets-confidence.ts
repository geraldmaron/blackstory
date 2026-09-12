/**
 * Realign `bb_public.search_index.facets.confidenceTier` from release projection claims.
 *
 * A thin wrapper over `lib/search-facet-realign.ts`, configured for the `confidenceTier` key: this
 * runs through that shared engine's `confidence-tier` mode, which computes the tier by calling
 * `highestClaimConfidenceTier` from `@repo/domain` rather than restating the derivation in SQL —
 * the same function `release-builder.ts` grades records with at publish time, so this backfill and
 * the builder cannot drift apart. That function carries the claimRole-only lineage rule from the
 * 2026-09-09 migration (a claim's own predicate is never consulted, only `claimRole`).
 *
 * Records evidence floors need the highest accepted-claim confidence on the search index so
 * `/records` can slim off full `release_entities` hydrate. Older rows only carry `claim_count`,
 * which must never be treated as a grade.
 *
 * Derivation matches `highestClaimConfidenceTier` in `@repo/domain` publication release-builder,
 * which in turn restates `recordConfidenceTier` in `@repo/public-contracts/evidence`: the
 * strongest claim on the record, capped unless two lineages that are allowed to corroborate
 * support it. Wikipedia and the record's own index row are not among them.
 *
 * Unlike the array/scalar facet targets, ANY mismatch is resolved here — not only an empty one —
 * because the tier is derived, not asserted: there is no "someone else's value" to preserve, only
 * a computation that is either current or stale.
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
import { applySearchFacetRealign, planSearchFacetRealign } from './lib/search-facet-realign.ts';

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

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();
  try {
    const plan = await planSearchFacetRealign(client, { keys: ['confidenceTier'] });
    const report = plan.targets[0];
    if (!report) throw new Error('planSearchFacetRealign returned no report for confidenceTier');

    const stale = report.filled + report.resolved;
    console.log(`stale confidenceTier facets: ${stale}`);
    if (stale === 0) {
      console.log('nothing to do');
      return;
    }
    if (DRY_RUN || !APPLY) {
      console.log(
        'dry run only (set DRY_RUN=0 BACKFILL_SEARCH_FACETS_CONFIDENCE_APPLY=1 to write)',
      );
      return;
    }
    const updated = await applySearchFacetRealign(client, plan);
    console.log(`updated rows: ${updated}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
