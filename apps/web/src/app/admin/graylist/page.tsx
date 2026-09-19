/**
 * Discovery graylist browser — candidates parked below the relevance threshold.
 *
 * The hold list is read in the server request so the first response contains the queue.
 *
 * Reloading the page repeats the server read. The matching `/admin/api` route remains available
 * to other callers.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { listDiscoveryGraylist } from '../../../admin/ops/graylist-store';
import { formatGraylistDisposition, formatGraylistStatus } from './graylist-labels';

export const metadata: Metadata = {
  title: 'Graylist',
  description: 'Discovery sources held back from automated promotion.',
};

/** Operational state is read at request time, never served from a cache. */
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

export default async function GraylistPage() {
  const outcome = await readPostgresOrDegrade(() => listDiscoveryGraylist(100), 'graylist entries');
  const rows = outcome.status === 'ok' ? outcome.value : [];
  const degradedReason = outcome.status === 'degraded' ? outcome.reason : undefined;
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
            Next: <Link href="/admin/inbox">Open inbox</Link>
            {' · '}
            <Link href="/admin/discovery">Campaign runs</Link>
          </p>
        </div>
      </header>

      <p className="story-review__notice" role="status">
        {parkedCount} parked · {rows.length} total entries
      </p>

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          The graylist is unavailable — the operational database did not answer, so this page shows
          nothing rather than a partial hold list. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}

      <section className="story-review__queue" aria-label="Graylist entries">
        {rows.length === 0 && !degradedReason ? (
          <p className="ds-sans">
            No graylist entries found. When discovery runs produce below-threshold candidates, they
            appear here — check <Link href="/admin/discovery">campaign runs</Link> or triage
            survivors in <Link href="/admin/inbox">Inbox</Link>.
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
