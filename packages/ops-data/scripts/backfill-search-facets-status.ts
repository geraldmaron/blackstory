/**
 * Realign `bb_public.search_index.facets->>'status'` (and the `status` COLUMN beside it) with the
 * release projection.
 *
 * A thin wrapper over `lib/search-facet-realign.ts`, configured for the `status` key: this runs
 * through that shared engine's `status-column` mode, which writes `status` to two places and
 * always resolves a mismatch, never only an empty one (see that module's header for why). Kept as
 * its own script, rather than dropped in favor of calling the shared engine directly, because
 * `apps/web/src/app/records/load-records-index.ts` names it by file.
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
 * Unlike the array/scalar facet targets, ANY mismatch is resolved here — not only an empty one —
 * because a stale "living" status is not a value someone else asserted and might have a reason for;
 * it is a violation, and `mapPostgresSearchIndexRow` prefers the `status` COLUMN over the facet, so
 * both are written together.
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
import { applySearchFacetRealign, planSearchFacetRealign } from './lib/search-facet-realign.ts';

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

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log(
      '=== Backfill search_index.facets.status (and the status column) from release projection ===',
    );

    // `status` always resolves any mismatch (see lib/search-facet-realign.ts), so `filled` and
    // `resolved` together are the whole story — there is no OVERWRITE_CONFLICTS gate to report.
    const plan = await planSearchFacetRealign(client, { keys: ['status'] });
    const report = plan.targets[0];
    if (!report) throw new Error('planSearchFacetRealign returned no report for status');

    const total = report.filled + report.resolved;
    console.log(`Mismatched rows: ${total}`);
    console.log(`  filled (no served status yet): ${report.filled}`);
    console.log(`  resolved (served status disagreed with projection): ${report.resolved}`);

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 BACKFILL_SEARCH_FACETS_STATUS_APPLY=1 to apply.');
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
