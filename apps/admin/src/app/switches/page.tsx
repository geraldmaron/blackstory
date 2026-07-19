/**
 * Kill switch browser — operational circuit breakers for adapters and public surfaces.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import type { KillSwitchListItem } from '../../ops/switches-store';

function formatWhen(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SwitchesPage() {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly KillSwitchListItem[]>([]);
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
      const response = await fetch('/api/switches?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        items?: KillSwitchListItem[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? `Load failed (${response.status})`);
      }
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

  const engagedCount = rows.filter((row) => row.enabled).length;

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Operations</p>
          <h1 className="ds-page__title">Kill switches</h1>
          <p className="ds-page__lede">
            Circuit breakers for discovery campaigns, source adapters, and public surfaces.
          </p>
        </div>
        <button
          type="button"
          className="ds-button ds-button--secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <p className="story-review__notice" role="status">
        {engagedCount} engaged · {rows.length - engagedCount} disengaged
      </p>

      {error ? (
        <p className="story-review__alert" role="alert">
          {error}
        </p>
      ) : null}

      <section className="story-review__queue" aria-label="Kill switches">
        {loading && rows.length === 0 ? (
          <p className="ds-mono">Loading kill switches…</p>
        ) : rows.length === 0 ? (
          <p className="ds-sans">No kill switches found.</p>
        ) : (
          <div className="story-review__table-wrap">
            <table className="story-review__table">
              <thead>
                <tr>
                  <th scope="col">Switch</th>
                  <th scope="col">State</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.enabled ? 'is-selected' : undefined}>
                    <td className="ds-mono">{row.id}</td>
                    <td>
                      <span
                        className={`story-review__badge story-review__badge--${
                          row.enabled ? 'rejected' : 'approved'
                        }`}
                      >
                        {row.enabled ? 'engaged' : 'disengaged'}
                      </span>
                    </td>
                    <td className="ds-sans">{row.reason ?? '—'}</td>
                    <td className="ds-mono">{formatWhen(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="story-review__queue-foot ds-mono">{rows.length} switches</p>
          </div>
        )}
      </section>
    </main>
  );
}
