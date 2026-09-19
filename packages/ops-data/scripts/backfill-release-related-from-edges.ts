/**
 * Previews or repairs active-release related lists from canonical edges using the same shared
 * mapper as incremental publication. Lists are replaced so stale links can be removed. Rebuild
 * the release graph after an applied repair. Writes require DRY_RUN=0 and
 * BACKFILL_RELATED_FROM_EDGES_APPLY=1.
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { applyReleaseRelatedSync, planReleaseRelatedSync } from './lib/release-related-sync.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_RELATED_FROM_EDGES_APPLY === '1';

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
    const active = await client.query<{ release_id: string }>(
      `SELECT release_id FROM published.v_active_release_id`,
    );
    const releaseId = active.rows[0]?.release_id;
    if (!releaseId) throw new Error('No active release');

    const plan = await planReleaseRelatedSync(client, releaseId);

    console.log('=== Sync release related[] from canonical edges ===');
    console.log(`Release: ${releaseId}`);
    console.log(`Scanned: ${plan.scanned}   unchanged: ${plan.unchanged}`);
    console.log(`Changed: ${plan.changed.length} (${plan.repaired} had no connections at all)`);
    for (const row of plan.changed.slice(0, 15)) {
      console.log(
        `  ${row.entityId}: ${row.before.length} -> ${row.after.length} — ` +
          row.after
            .map((entry) => `${entry.direction === 'outgoing' ? '→' : '←'}${entry.id}`)
            .join(', '),
      );
    }
    if (plan.changed.length > 15) console.log(`  ...and ${plan.changed.length - 15} more`);

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 BACKFILL_RELATED_FROM_EDGES_APPLY=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      await applyReleaseRelatedSync(client, releaseId, plan);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`\nApplied: ${plan.changed.length} release_entities row(s) updated.`);
    console.log('Now rebuild the release graph: rebuild-release-graph.ts');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
