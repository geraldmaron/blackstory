/**
 * Audit event browser — recent append-only operator and system actions.
 */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import type { AuditEventListItem } from '../../ops/audit-store';

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

export default function AuditPage() {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly AuditEventListItem[]>([]);
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
      const response = await fetch('/api/audit?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        items?: AuditEventListItem[];
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

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Operations</p>
          <h1 className="ds-page__title">Audit log</h1>
          <p className="ds-page__lede">
            Append-only audit trail of operator and system actions across intake, triage, and
            publication. Read-only history — this desk does not replay, undo, or mutate underlying
            records.
          </p>
          <p className="story-review__notice">
            Use the <span className="ds-mono">Reason</span> column to see why an action happened —
            durable operator notes for transitions, releases, and kill-switch changes.
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

      {error ? (
        <p className="story-review__alert" role="alert">
          {error}
        </p>
      ) : null}

      <section className="story-review__queue" aria-label="Audit events">
        {loading && rows.length === 0 ? (
          <p className="ds-mono">Loading audit events…</p>
        ) : rows.length === 0 ? (
          <p className="ds-sans">
            No audit events found yet. Actions from Inbox, Releases, and kill-switch changes will
            appear here — return to <Link href="/">Operations</Link> to work the live queues.
          </p>
        ) : (
          <div className="story-review__table-wrap">
            <table className="story-review__table">
              <caption className="ds-visually-hidden">
                Recent audit events with action, actor, subject, and operator reason
              </caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="ds-mono">{formatWhen(row.occurredAt)}</td>
                    <td>
                      <span className="story-review__row-title">{row.action}</span>
                      <p className="story-review__row-meta ds-mono">{row.category}</p>
                    </td>
                    <td className="ds-mono">
                      {row.actorDisplayName ?? row.actorId}
                      <br />
                      {row.actorType}
                    </td>
                    <td className="ds-mono">
                      {row.subjectType}/{row.subjectId}
                      {row.entityId ? (
                        <>
                          <br />
                          entity:{row.entityId}
                        </>
                      ) : null}
                    </td>
                    <td className="ds-sans">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="story-review__queue-foot ds-mono">{rows.length} events</p>
          </div>
        )}
      </section>
    </main>
  );
}
