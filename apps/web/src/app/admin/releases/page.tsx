/**
 * Publication release browser — manifests plus the active public release pointer.
 *
 * This server component reads the manifest list and active pointer in the request, so the initial
 * response identifies the live release before client hydration.
 *
 * The page is a read-only record: it offers no release action. The read is here, and
 * {@link ReleasesDesk} renders the table. This page does not call `/admin/api/releases` for its
 * initial data.
 */
import type { Metadata } from 'next';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { listPublicationReleases } from '../../../admin/releases/releases-store';
import { listRecentlyPublishedEntitiesPostgres } from '../../../admin/lib/postgres-publication';
import Link from 'next/link';
import { DeskTitleBar } from '../../../admin/design-system/ui';
import { ReleasesDesk } from './ReleasesDesk';

export const metadata: Metadata = {
  title: 'Releases',
  description: 'Signed release manifests and the live public release pointer.',
};

/** Which release is live is never a cached answer. */
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

export default async function ReleasesPage() {
  const [outcome, recentOutcome] = await Promise.all([
    readPostgresOrDegrade(() => listPublicationReleases(50), 'releases'),
    readPostgresOrDegrade(() => listRecentlyPublishedEntitiesPostgres(50), 'recent publishes'),
  ]);
  const recent = recentOutcome.status === 'ok' ? recentOutcome.value : null;
  const rows = outcome.status === 'ok' ? outcome.value.items : [];
  const activeRelease = outcome.status === 'ok' ? (outcome.value.activeRelease ?? null) : null;
  const degradedReason = outcome.status === 'degraded' ? outcome.reason : undefined;

  return (
    <main className="story-review ds-container ds-page" id="main">
      <DeskTitleBar
        eyebrow="Publish"
        title="Releases"
        description="A read-only record of release manifests and which one is live. Published records are updated in place by the incremental publisher, so the active release can change content without a new release appearing here."
      />

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          Releases are unavailable — the operational database did not answer. Nothing is shown
          rather than a partial manifest list, because a release decision made against a partial
          list is the decision this desk exists to prevent. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : activeRelease ? (
        <section className="story-review__notice" aria-label="Active release">
          <p className="ds-sans">
            Active release <span className="ds-mono">{activeRelease.releaseId}</span> · activated{' '}
            {formatWhen(activeRelease.activatedAt)} · index{' '}
            <span className="ds-mono">{activeRelease.searchIndexVersion}</span>
          </p>
        </section>
      ) : (
        <p className="story-review__notice" role="status">
          No active release pointer found in{' '}
          <span className="ds-mono">publicMeta/activeRelease</span>.
        </p>
      )}

      {degradedReason || !activeRelease ? null : (
        <section aria-labelledby="recent-publishes-heading">
          <h2 id="recent-publishes-heading">Recently added to the live release</h2>
          <p className="ds-sans">
            The newest records first, by the date each one first went live. Corrections made in
            place do not appear here; the{' '}
            <Link href="/admin/audit?category=publication">publication audit log</Link> records each
            publish run and why.
          </p>
          {recent === null ? (
            <p className="story-review__alert" role="alert">
              Recent publishes are unavailable because the database did not answer. Reload to retry.
            </p>
          ) : recent.length === 0 ? (
            <p className="ds-sans">Nothing has been added to the live release yet.</p>
          ) : (
            <div className="story-review__table-wrap">
              <table className="story-review__table">
                <caption className="ds-visually-hidden">
                  Records most recently added to the live release
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Record</th>
                    <th scope="col">Kind</th>
                    <th scope="col">First live</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.entityId}>
                      <td>
                        <Link
                          className="story-review__row-title"
                          href={`/admin/catalog/${encodeURIComponent(row.entityId)}`}
                        >
                          {row.displayName}
                        </Link>
                        <div className="ds-mono">{row.entityId}</div>
                      </td>
                      <td className="ds-mono">{row.kind}</td>
                      <td className="ds-mono">{formatWhen(row.firstPublishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="story-review__queue-foot ds-mono">Latest {recent.length}</p>
            </div>
          )}
        </section>
      )}

      {degradedReason ? null : <ReleasesDesk rows={rows} activeRelease={activeRelease} />}
    </main>
  );
}
