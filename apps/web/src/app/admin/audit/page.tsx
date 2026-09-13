/**
 * Audit event browser — recent append-only operator and system actions.
 *
 * Server component (repo-gyq6.9). Was a client page that waited for `AdminAuthProvider` to mint a
 * token before it could fetch `/admin/api/audit`, so an operator chasing "what just happened" paid
 * a hydrate and a token refresh before the first row. An append-only log is the clearest case for
 * reading in the request: nothing on this page responds to the reader, so there was no client
 * state worth the wait.
 *
 * `/admin/api/audit` stays for callers outside this page.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { listRecentAuditEvents } from '../../../admin/ops/audit-store';

export const metadata: Metadata = {
  title: 'Audit log',
  description: 'Append-only audit trail of operator and system actions.',
};

/** An audit trail read from a cache is a different question than the one the operator asked. */
export const dynamic = 'force-dynamic';

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

export default async function AuditPage() {
  const outcome = await readPostgresOrDegrade(() => listRecentAuditEvents(100), 'audit events');
  const rows = outcome.status === 'ok' ? outcome.value : [];
  const degradedReason = outcome.status === 'degraded' ? outcome.reason : undefined;

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
      </header>

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          The audit log is unavailable — the operational database did not answer, so this page shows
          nothing rather than a partial history. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}

      <section className="story-review__queue" aria-label="Audit events">
        {rows.length === 0 && !degradedReason ? (
          <p className="ds-sans">
            No audit events found yet. Actions from Inbox, Releases, and kill-switch changes will
            appear here — return to <Link href="/admin">Operations</Link> to work the live queues.
          </p>
        ) : rows.length > 0 ? (
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
        ) : null}
      </section>
    </main>
  );
}
