/** Shared publisher and optional hosted researcher. Session publication requires owner authentication. */
import { executeManagedResearch } from '@repo/operator-cli';
import { managementCatalog } from '@repo/ops-data/management/catalog';
import { ManagementWorkStore } from '@repo/ops-data/management';
import { getPostgresPool } from '../src/admin/lib/canonical-postgres-client.ts';
import { publishManagementWork } from '../src/admin/work/publish-work.ts';
import { authorizeAdminRequest } from '../src/admin/auth/request-auth.ts';
import { workActor } from '../src/admin/work/service.ts';
import { workExecutionMode } from '@repo/ops-data/management/contracts';

const args = process.argv.slice(2);
const session = args[0] === '--session-work' && args.length === 2;
if (args.length && !session)
  throw new Error('Use --session-work <work-id> for approved session publication');
const workId = session ? args[1] : process.env.BLACKSTORY_WORK_ID;
if (!workId || !/^[-a-f0-9]{36}$/u.test(workId)) throw new Error('A persisted work id is required');
const pool = getPostgresPool();
const store = new ManagementWorkStore(pool);
try {
  const phase = session ? 'publish' : process.env.BLACKSTORY_WORK_PHASE;
  if (phase !== 'research' && phase !== 'publish')
    throw new Error('A configured worker phase is required');
  if (session) {
    const token = process.env.BLACKSTORY_ACCESS_TOKEN;
    if (!token) throw new Error('A current owner account token is required');
    const actor = workActor(
      await authorizeAdminRequest(new Headers({ Authorization: `Bearer ${token}` })),
    );
    if (!actor.canPublish) throw new Error('Publication permission required');
    const work = await store.get(actor, workId);
    if (!work || workExecutionMode(work.request) !== 'session')
      throw new Error('Session work is unavailable for this account');
  } else {
    const request = await pool.query('SELECT request FROM research.management_work WHERE id=$1', [
      workId,
    ]);
    if (!request.rows[0] || workExecutionMode(request.rows[0].request) !== 'hosted')
      throw new Error('Hosted execution was not requested for this work');
  }
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
        'The work attempt failed. Review the saved work and retry.',
      );
      console.error(JSON.stringify({ workId, status: 'attempt_failed' }));
      process.exitCode = 1;
    }
  } else console.log(JSON.stringify({ workId, status: 'already_running_or_terminal' }));
} finally {
  await pool.end();
}
