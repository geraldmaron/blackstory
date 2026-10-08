/** On-demand hosted entry point. Only the persisted request id is supplied by the dispatcher. */
import { executeManagedResearch } from '@repo/operator-cli';
import { managementCatalog } from '@repo/ops-data/management/catalog';
import { ManagementWorkStore } from '@repo/ops-data/management';
import { getPostgresPool } from '../src/admin/lib/canonical-postgres-client.ts';
import { publishManagementWork } from '../src/admin/work/publish-work.ts';

const workId = process.env.BLACKSTORY_WORK_ID;
if (!workId || !/^[-a-f0-9]{36}$/u.test(workId)) throw new Error('A persisted work id is required');
const pool = getPostgresPool();
const store = new ManagementWorkStore(pool);
try {
  const phase = process.env.BLACKSTORY_WORK_PHASE;
  if (phase !== 'research' && phase !== 'publish')
    throw new Error('A configured worker phase is required');
  const capability = await pool.query(`SELECT current_user AS role,
    has_table_privilege(current_user,'canonical.entities','UPDATE') AS can_write_catalog,
    has_table_privilege(current_user,'research.management_work_decisions','INSERT') AS can_approve`);
  if (
    phase === 'research' &&
    (capability.rows[0]?.role !== 'research_worker' ||
      capability.rows[0]?.can_write_catalog ||
      capability.rows[0]?.can_approve)
  )
    throw new Error('Research credentials must have research-only capabilities');
  const claim = await store.claim(workId, phase);
  if (claim) {
    const renew = () => store.renew(workId, claim.lease);
    try {
      if (claim.work.state === 'researching') {
        const catalog = await managementCatalog(pool, claim.work.request.request);
        const proposal = await executeManagedResearch(pool, claim.work, catalog, renew);
        await store.saveProposal(workId, claim.lease, proposal);
      } else await publishManagementWork(store, claim.work, claim.lease);
      console.log(JSON.stringify({ workId, status: 'attempt_complete' }));
    } catch {
      // Provider exceptions may include sensitive URLs or content. The evidence ledger retains validation details.
      await store.fail(
        workId,
        claim.lease,
        'The background attempt failed. Review the saved work and retry.',
      );
      console.error(JSON.stringify({ workId, status: 'attempt_failed' }));
      process.exitCode = 1;
    }
  } else console.log(JSON.stringify({ workId, status: 'already_running_or_terminal' }));
} finally {
  await pool.end();
}
