/**
 * Realigns search facets.evidenceInputs from release claims using recordEvidenceInputs. Stores
 * strongest levels and lineage keys, not a finished grade. Readers apply the shared grading
 * rule; absent inputs remain detectable.
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
