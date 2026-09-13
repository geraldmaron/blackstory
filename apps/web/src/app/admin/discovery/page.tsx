/**
 * Discovery campaign runs posture for operators.
 *
 * Server component (repo-gyq6.9): run history is read in the request instead of after a hydrate
 * and a token refresh. `/admin/api/discovery/runs` stays for callers outside this page, and the
 * Refresh button went with the client state — a server-rendered page IS the refresh.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { listDiscoveryCampaignRuns } from '../../../admin/ops/discovery-ops-store';
import { formatSurvivorCount, shouldShowSurvivorsColumn } from './discovery-runs-view';

export const metadata: Metadata = {
  title: 'Discovery runs',
  description: 'Recent discovery campaign runs.',
};

/** Operational state is read at request time, never served from a cache. */
export const dynamic = 'force-dynamic';

export default async function DiscoveryRunsPage() {
  const outcome = await readPostgresOrDegrade(
    () => listDiscoveryCampaignRuns(50),
    'discovery runs',
  );
  const rows = outcome.status === 'ok' ? outcome.value : [];
  const degradedReason = outcome.status === 'degraded' ? outcome.reason : undefined;
  const showSurvivorsColumn = shouldShowSurvivorsColumn(rows);

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Discovery</p>
      <h1 className="ds-page__title">Campaign runs</h1>
      <p className="ds-page__lede">
        Private discovery campaign run history and survivor counts for operator review. Survivors
        feed Inbox triage — this desk does not publish or edit canonical entities.
      </p>
      <p className="story-review__notice">
        Next: <Link href="/admin/inbox">Open inbox</Link>
        {' · '}
        <Link href="/admin/graylist">Review graylist</Link>
      </p>
      {degradedReason ? (
        <p className="acq__alert" role="alert">
          Discovery runs are unavailable — the operational database did not answer, so this page
          shows nothing rather than a partial run history. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="ds-sans">
          No discovery campaign runs found. When survivors arrive, triage them in{' '}
          <Link href="/admin/inbox">Inbox</Link> or review parked candidates in{' '}
          <Link href="/admin/graylist">Graylist</Link>.
        </p>
      ) : (
        <div className="story-review__table-wrap">
          <table className="story-review__table">
            <caption className="ds-visually-hidden">
              Discovery campaign runs with status, job id, start time
              {showSurvivorsColumn ? ', and survivor counts' : ''}
            </caption>
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Status</th>
                <th scope="col">Job</th>
                <th scope="col">Started</th>
                {showSurvivorsColumn ? <th scope="col">Survivors</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="ds-mono">{row.id}</td>
                  <td>{row.status ?? '—'}</td>
                  <td className="ds-mono">{row.jobId ?? '—'}</td>
                  <td className="ds-mono">{row.startedAt ?? '—'}</td>
                  {showSurvivorsColumn ? (
                    <td className="ds-mono">{formatSurvivorCount(row.survivors)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="story-review__queue-foot ds-mono">{rows.length} runs</p>
        </div>
      )}
    </main>
  );
}
