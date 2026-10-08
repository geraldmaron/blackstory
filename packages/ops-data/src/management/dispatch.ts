/** On-demand hosted dispatch. A saved request remains retryable when GitHub is unavailable. */
import { randomUUID } from 'node:crypto';
import type { ManagementWorkStore } from './work-store.js';
import { workExecutionMode } from './contracts.js';

export type WorkDispatcher = (workId: string, phase: 'research' | 'publish') => Promise<void>;
export function githubWorkDispatcher(
  environment: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
): WorkDispatcher {
  return async (workId, phase) => {
    const token = environment.BLACKSTORY_WORK_DISPATCH_TOKEN;
    const repository = environment.BLACKSTORY_WORK_REPOSITORY;
    const ref = environment.BLACKSTORY_WORK_REF;
    if (!token || !repository || !ref) throw new Error('Hosted work dispatch is not configured');
    if (!/^[\w.-]+\/[\w.-]+$/u.test(repository)) throw new Error('Invalid work repository');
    const response = await fetcher(
      `https://api.github.com/repos/${repository}/actions/workflows/management-work.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref, inputs: { work_id: workId, phase } }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.status !== 204)
      throw new Error(`Hosted dispatch returned HTTP ${response.status}`);
  };
}
export async function dispatchManagementWork(
  store: ManagementWorkStore,
  id: string,
  dispatch: WorkDispatcher,
): Promise<boolean> {
  const request = await store.pool.query(
    'SELECT request FROM research.management_work WHERE id=$1',
    [id],
  );
  if (!request.rows[0] || workExecutionMode(request.rows[0].request) !== 'hosted') return false;
  const token = randomUUID();
  const claim = await store.pool.query(
    `UPDATE research.management_work SET dispatch_attempts=dispatch_attempts+1,
    dispatch_status='dispatching',dispatch_token=$2,dispatched_at=now()
    WHERE id=$1 AND request->>'executionMode'='hosted' AND state IN ('queued','researching','approved','publishing','verification_failed')
      AND (lease_until IS NULL OR lease_until<now())
      AND (dispatch_status IN ('pending','failed') OR (dispatch_status='dispatching' AND dispatched_at<now()-interval '2 minutes'))
    RETURNING state`,
    [id, token],
  );
  if (!claim.rows.length) return false;
  try {
    await dispatch(
      id,
      ['approved', 'publishing', 'verification_failed'].includes(claim.rows[0].state)
        ? 'publish'
        : 'research',
    );
    await store.pool.query(
      `UPDATE research.management_work SET dispatch_status='accepted',error=NULL WHERE id=$1 AND dispatch_token=$2`,
      [id, token],
    );
    return true;
  } catch {
    await store.pool.query(
      `UPDATE research.management_work SET dispatch_status='failed',error=$3 WHERE id=$1 AND dispatch_token=$2`,
      [
        id,
        token,
        'Your request is saved, but the background job could not be started. Retry from this page.',
      ],
    );
    return false;
  }
}
