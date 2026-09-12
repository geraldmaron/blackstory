/**
 * repo-teb1z — applies the notability rubric ruling to the published catalog.
 *
 * The ruling is docs/methodology/notability-rubric.md, measured against
 * rel_20260723_authority_net_001 on 2026-09-09: `documented_site` answered for 63% of every basis
 * record in the catalog, and every criterion whose ratified text named several kinds was in use on
 * exactly one kind, usually not one its text described. Twenty-one PLACES were filed as judicial
 * precedents and four actual court cases were.
 *
 * This script does not decide anything. The rule it applies — recompute with the same
 * `buildReleaseNotabilityBasis` the publisher uses, then MERGE rather than replace so a criterion
 * a person authored can never be taken away — now lives in `lib/notability-basis-resync.ts`,
 * shared with the standing resync `resync-notability-basis.ts` (repo-rm2y). It was lifted there
 * verbatim rather than copied, so a one-off ruling pass and a standing resync cannot drift into
 * two different answers to "what is this record's basis".
 *
 * Read that module's header for the merge rule, the two staleness tests it also carries, and the
 * list of stores a write has to land on.
 *
 * Measured effect on the active release, 2026-09-09:
 *   basis records            10,427 -> 6,155      (M1: metadata predicates stop being reasons)
 *   documented_site           6,589 -> 1,767      the residual repo-o6k0c retires it against
 *   court_precedent              46 -> 139        enacted_law 0 -> 135
 *   movement_significance        30 -> 106        black_press_or_archive 0 -> 52
 *   community_anchor              4 -> 49         elected_or_appointed_office 0 -> 36
 *   documented_contribution      19 -> 35         documented_racial_killing 0 -> 11
 *   first_to_do_x / major_honor / landmark / racial_terror: unchanged or up, never down
 *   records left with no basis at all: 1, sundown_crescent_springs_kentucky, already known
 * Re-measured 2026-09-12 (repo-rm2y): the corpus is fully converged on this ruling — a re-run of
 * the merge alone changes 0 records. What is left is staleness the two tests in the shared module
 * catch, which is why the standing resync exists and this pass is history.
 *
 * NOT IN SCOPE. Retiring `documented_site` as a fallback is repo-o6k0c and goes last, against the
 * residual this pass leaves rather than an estimated one.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-notability-rubric-ruling.ts
 *
 * Apply:
 *   DRY_RUN=0 APPLY_NOTABILITY_RULING=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-notability-rubric-ruling.ts
 */
import pg from 'pg';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  applyNotabilityBasisResync,
  formatNotabilityBasisResyncPlan,
  loadNotabilityBasisResyncRows,
  planNotabilityBasisResync,
} from './lib/notability-basis-resync.ts';
import { resolveActiveReleaseId } from './lib/projection-divergence.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.APPLY_NOTABILITY_RULING === '1';

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
    const releaseId = await resolveActiveReleaseId(client as never);
    const rows = await loadNotabilityBasisResyncRows(client, releaseId);
    const plan = planNotabilityBasisResync(rows);

    console.log('=== Apply the notability rubric ruling ===');
    console.log(`Release: ${releaseId}`);
    for (const line of formatNotabilityBasisResyncPlan(plan)) console.log(line);

    if (plan.refusesToWrite) {
      process.exitCode = 1;
      return;
    }
    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 APPLY_NOTABILITY_RULING=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      const result = await applyNotabilityBasisResync(client, plan, releaseId);
      await client.query('COMMIT');
      console.log(
        `\nApplied: ${result.projectionRows} release_entities row(s), ${result.searchIndexRows} search_index row(s).`,
      );
      remindToRepublishCatalogArtifacts(result.projectionRows);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
