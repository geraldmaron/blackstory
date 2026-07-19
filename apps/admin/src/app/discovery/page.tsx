/**
 * Discovery campaign runs posture for operators.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';

type DiscoveryRun = {
  readonly id: string;
  readonly status?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly jobId?: string;
  readonly survivors?: number;
};

export default function DiscoveryRunsPage() {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly DiscoveryRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        Private discovery campaign run records. Survivors become research cases for Inbox triage —
        never published from here.
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
        <p>{loading ? 'Loading…' : 'No discovery campaign runs found.'}</p>
      ) : (
        <table className="story-review__table">
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Status</th>
              <th scope="col">Job</th>
              <th scope="col">Started</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="ds-mono">{row.id}</td>
                <td>{row.status ?? '—'}</td>
                <td className="ds-mono">{row.jobId ?? '—'}</td>
                <td className="ds-mono">{row.startedAt ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
