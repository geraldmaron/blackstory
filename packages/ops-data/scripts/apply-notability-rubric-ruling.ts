/**
 * Applies the documented notability rubric to the published catalog.
 *
 * Uses the policy in `docs/methodology/notability-rubric.md` and the shared planner in
 * `lib/notability-basis-resync.ts`. The planner recomputes publisher-derived criteria and merges
 * them with authored criteria so a policy resync does not discard a reviewed basis.
 *
 * The same planner serves `resync-notability-basis.ts`; keep the merge rules, staleness checks
 * and required projection writes there. Dry-run output reports the effect on the active release.
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
