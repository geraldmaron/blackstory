/**
 * Realign `bb_public.search_index.facets.evidenceInputs` from release projection claims.
 *
 * A thin wrapper over `lib/search-facet-realign.ts`, configured for the `evidenceInputs` key: this
 * runs through that shared engine's `evidence-inputs` mode, which projects the inputs by calling
 * `recordEvidenceInputs` from `@repo/domain` rather than restating the derivation in SQL — the
 * same function `release-builder.ts` writes at publish time, so this backfill and the builder
 * cannot drift apart. That function carries the claimRole-only lineage rule from the 2026-09-09
 * migration (a claim's own predicate is never consulted, only `claimRole`).
 *
 * WHAT IT WRITES, AND WHAT IT DELIBERATELY DOES NOT. The row gets the strongest claim level and
 * the distinct lineage keys — the ingredients — never a graded tier. Its predecessor
 * (`backfill-search-facets-confidence.ts`) wrote the finished `confidenceTier`, and that is the
 * defect this replaces: `/records` read the cached conclusion while every other surface derived
 * one, so the 2026-09-07 rule change left this room a day behind until a backfill ran
 * (repo-ngojq, repo-6qjv0). Readers now call `confidenceTierFromEvidenceInputs` over these
 * inputs, so a future rule change needs a deploy and not a backfill.
 *
 * Records evidence floors still need something on the search index so `/records` can slim off the
 * full `release_entities` hydrate. Until this backfill runs, rows carry no `evidenceInputs`,
 * `searchIndexReadyForRecords` reports the index uncovered, and `/records` serves from full
 * entities — slower, and correct.
 *
 * Unlike the array/scalar facet targets, ANY mismatch is resolved here — not only an empty one —
 * because the projection is derived, not asserted: there is no "someone else's value" to
 * preserve, only a computation that is either current or stale.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-evidence-inputs.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_SEARCH_FACETS_EVIDENCE_INPUTS_APPLY=1 node --conditions development \
 *     --import tsx packages/ops-data/scripts/backfill-search-facets-evidence-inputs.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { applySearchFacetRealign, planSearchFacetRealign } from './lib/search-facet-realign.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_EVIDENCE_INPUTS_APPLY === '1';

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
    const plan = await planSearchFacetRealign(client, { keys: ['evidenceInputs'] });
    const report = plan.targets[0];
    if (!report) throw new Error('planSearchFacetRealign returned no report for evidenceInputs');

    const stale = report.filled + report.resolved;
    console.log(`stale evidenceInputs facets: ${stale}`);
    if (stale === 0) {
      console.log('nothing to do');
      return;
    }
    if (DRY_RUN || !APPLY) {
      console.log(
        'dry run only (set DRY_RUN=0 BACKFILL_SEARCH_FACETS_EVIDENCE_INPUTS_APPLY=1 to write)',
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
