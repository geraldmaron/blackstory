/**
 * Realign `bb_public.search_index.facets->>'jurisdictionState'` with the release projection.
 *
 * A thin wrapper over `lib/search-facet-realign.ts`, configured for the `jurisdictionState` key:
 * this runs through that shared engine's `scalar-facet` mode, which allows the source and
 * destination keys to differ (`projection.jurisdictionLabel` -> `facets.jurisdictionState`). Kept
 * as its own script, rather than dropped in favor of calling the shared engine directly, because
 * `lib/incremental-publish.ts` names it by file in a comment explaining the drift it mops up.
 *
 * 4,100 of the 4,107 entities in the active release carry a `jurisdictionLabel` in
 * `bb_public.release_entities.projection` and nothing in the matching `search_index` facet. The
 * cost of that gap is visible on two surfaces at once. `/records` reads the search doc, so the
 * place column falls through to the literal "Place not recorded" for a record whose own entity
 * page prints a place, and the State facet offers six states with one or two records each out of
 * four thousand. Both surfaces are describing the index, not the archive.
 *
 * Despite the facet's name it holds the full jurisdiction label, not a state code. That is what
 * release-builder writes (`searchDocFor`), it is what the seven already-correct rows contain
 * ("Kendleton, Texas"), and `/records` derives the state from it with
 * `findUsStateFromJurisdictionLabel`. This script keeps that shape rather than inventing a
 * second one.
 *
 * The release projection is the authority; this only copies it onto the search doc. It invents
 * nothing and removes nothing: a row whose projection has no jurisdiction is left alone rather
 * than used to blank an existing facet. Measured before the first run, the drift is entirely
 * one-directional: 0 rows where the facet carried a jurisdiction the projection lacked, and 0
 * where both were set and disagreed. Both conditions are re-checked and reported on every run,
 * because that assumption is the only thing making a blind copy safe.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-jurisdiction.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_SEARCH_FACETS_JURISDICTION_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-jurisdiction.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { applySearchFacetRealign, planSearchFacetRealign } from './lib/search-facet-realign.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_JURISDICTION_APPLY === '1';
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
    console.log('=== Backfill search_index.facets.jurisdictionState from release projection ===');

    const plan = await planSearchFacetRealign(client, {
      keys: ['jurisdictionState'],
      resolveConflicts: OVERWRITE_CONFLICTS,
    });
    const report = plan.targets[0];
    if (!report) throw new Error('planSearchFacetRealign returned no report for jurisdictionState');

    console.log(`Stale rows (projection has a jurisdiction, search facet empty): ${report.filled}`);
    console.log(
      `\nLeft untouched — facet has a jurisdiction but projection does not: ${report.facetOnly}` +
        `\n${report.resolved > 0 ? 'Resolved' : 'Left untouched'} — both set and disagreeing: ${
          report.resolved > 0 ? report.resolved : report.leftConflicts
        }`,
    );
    if (report.leftConflicts > 0) {
      console.log('  ^ neither case is repaired here; investigate before assuming a clean sync.');
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only. Set DRY_RUN=0 BACKFILL_SEARCH_FACETS_JURISDICTION_APPLY=1 to apply.',
      );
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
