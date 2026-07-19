/**
 * Discovery graylist browser — candidates parked below the relevance threshold.
 */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import type { GraylistListItem } from '../../ops/graylist-store';
import { formatGraylistDisposition, formatGraylistStatus } from './graylist-labels';

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

export default function GraylistPage() {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly GraylistListItem[]>([]);
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
      const response = await fetch('/api/graylist?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        items?: GraylistListItem[];
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

  const parkedCount = rows.filter((row) => row.status === 'parked').length;

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Discovery</p>
          <h1 className="ds-page__title">Graylist</h1>
          <p className="ds-page__lede">
            Below-threshold discovery candidates parked for corroboration — not silently dropped.
            Review scores and reasons here; promoting to Inbox or publishing stays in triage and
            release desks.
          </p>
          <p className="story-review__notice">
            Next:{' '}
            <Link href="/inbox">Open inbox</Link>
            {' · '}
            <Link href="/discovery">Campaign runs</Link>
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
        {parkedCount} parked · {rows.length} total entries
      </p>

      {error ? (
        <p className="story-review__alert" role="alert">
          {error}
        </p>
      ) : null}

      <section className="story-review__queue" aria-label="Graylist entries">
        {loading && rows.length === 0 ? (
          <p className="ds-mono">Loading graylist…</p>
        ) : rows.length === 0 ? (
          <p className="ds-sans">
            No graylist entries found. When discovery runs produce below-threshold candidates, they
            appear here — check <Link href="/discovery">campaign runs</Link> or triage survivors in{' '}
            <Link href="/inbox">Inbox</Link>.
          </p>
        ) : (
          <div className="story-review__table-wrap">
            <table className="story-review__table">
              <caption className="ds-visually-hidden">
                Graylist candidates with disposition, status, score, and parked time
              </caption>
              <thead>
                <tr>
                  <th scope="col">Candidate</th>
                  <th scope="col">Disposition</th>
                  <th scope="col">Status</th>
                  <th scope="col">Score</th>
                  <th scope="col">Parked</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="story-review__row-title">{row.candidateId}</span>
                      <p className="story-review__row-meta ds-mono">
                        {row.id}
                        {row.adapterId ? ` · ${row.adapterId}` : ''}
                      </p>
                      <p className="ds-sans">{row.reason}</p>
                    </td>
                    <td>{formatGraylistDisposition(row.disposition)}</td>
                    <td>
                      <span className={`story-review__badge story-review__badge--${row.status}`}>
                        {formatGraylistStatus(row.status)}
                      </span>
                    </td>
                    <td className="ds-mono">{row.compositeScore.toFixed(2)}</td>
                    <td className="ds-mono">{formatWhen(row.parkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="story-review__queue-foot ds-mono">{rows.length} entries</p>
          </div>
        )}
      </section>
    </main>
  );
}
