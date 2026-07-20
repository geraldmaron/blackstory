/**
 * Discovery campaign runs posture for operators.
 */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import {
  formatSurvivorCount,
  shouldShowSurvivorsColumn,
  type DiscoveryRunRow,
} from './discovery-runs-view';

type DiscoveryRun = DiscoveryRunRow & {
  readonly id: string;
  readonly status?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly jobId?: string;
};

export default function DiscoveryRunsPage() {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly DiscoveryRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const showSurvivorsColumn = shouldShowSurvivorsColumn(rows);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setRows([]);
        return;
      }
      const response = await fetch('/api/discovery/runs?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as { items?: DiscoveryRun[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? `Load failed (${response.status})`);
      setRows(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Discovery</p>
      <h1 className="ds-page__title">Campaign runs</h1>
      <p className="ds-page__lede">
        Private discovery campaign run history and survivor counts for operator review. Survivors
        feed Inbox triage — this desk does not publish or edit canonical entities.
      </p>
      <p className="story-review__notice">
        Next: <Link href="/inbox">Open inbox</Link>
        {' · '}
        <Link href="/graylist">Review graylist</Link>
      </p>
      <button type="button" className="ds-button ds-button--secondary" onClick={() => void load()}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
      {error ? (
        <p className="acq__alert" role="alert">
          {error}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="ds-sans">
          {loading ? (
            'Loading…'
          ) : (
            <>
              No discovery campaign runs found. When survivors arrive, triage them in{' '}
              <Link href="/inbox">Inbox</Link> or review parked candidates in{' '}
              <Link href="/graylist">Graylist</Link>.
            </>
          )}
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
