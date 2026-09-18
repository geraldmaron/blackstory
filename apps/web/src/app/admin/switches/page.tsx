/**
 * Server-rendered operational kill-switch browser. Reloading the page refreshes the database
 * read; the matching API also serves external staff callers.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { listKillSwitches } from '../../../admin/ops/switches-store';

export const metadata: Metadata = {
  title: 'Kill switches',
  description: 'Operational circuit breakers for adapters and public surfaces.',
};

/** Always read at request time: an operational circuit breaker must never be served from a cache. */
export const dynamic = 'force-dynamic';

function formatWhen(iso: string): string {
  if (!iso) return 'Unknown';
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

export default async function SwitchesPage() {
  const outcome = await readPostgresOrDegrade(() => listKillSwitches(100), 'kill switches');
  const rows = outcome.status === 'ok' ? outcome.value : [];
  const degradedReason = outcome.status === 'degraded' ? outcome.reason : undefined;
  const engagedCount = rows.filter((row) => row.enabled).length;

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Operations</p>
          <h1 className="ds-page__title">Kill switches</h1>
          <p className="ds-page__lede">
            Operational circuit breakers for discovery campaigns, source adapters, and public
            surfaces. Engaged switches halt the work controlled by each switch.
          </p>
          <p className="story-review__notice">
            This page displays switch state. Platform administrators change{' '}
            <span className="ds-mono">ops.kill_switches</span> through the privileged operations
            database. Record a reason and an audit event for each change. Review{' '}
            <Link href="/admin/audit">Audit</Link> and{' '}
            <span className="ds-mono">docs/runbooks/incident-response.md</span> for the response
            procedure.
          </p>
        </div>
      </header>

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          Switch state is unavailable. The operational database did not answer, so this page is
          showing nothing rather than a stale or partial matrix. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : (
        <p className="story-review__notice" role="status">
          {engagedCount} engaged · {rows.length - engagedCount} disengaged
        </p>
      )}

      <section className="story-review__queue" aria-label="Kill switches">
        {rows.length === 0 && !degradedReason ? (
          <p className="ds-sans">
            No kill switches found in this project. When configured, their state appears here.
            Return to <Link href="/admin">Operations</Link> or review changes in{' '}
            <Link href="/admin/audit">Audit</Link>.
          </p>
        ) : rows.length > 0 ? (
          <div className="story-review__table-wrap">
            <table className="story-review__table">
              <caption className="ds-visually-hidden">
                Kill switch state, operator reason, and last update time
              </caption>
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
                    <td className="ds-sans">{row.reason ?? 'Not recorded'}</td>
                    <td className="ds-mono">{formatWhen(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="story-review__queue-foot ds-mono">{rows.length} switches</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
