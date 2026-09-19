/**
 * Publication release browser — manifests plus the active public release pointer.
 *
 * This server component reads the manifest list and active pointer in the request, so the initial
 * response identifies the live release before client hydration.
 *
 * Unlike the other surfaces in this pass, this one has a genuine mutation, so it splits rather
 * than converts: the read is here, and {@link ReleasesDesk} keeps the client boundary for row
 * selection, the decision reason, and the stage POST. `/admin/api/releases/stage` is the client
 * mutation API; this page does not call `/admin/api/releases` for its initial data.
 */
import type { Metadata } from 'next';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { listPublicationReleases } from '../../../admin/releases/releases-store';
import { ReleasesDesk } from './ReleasesDesk';

export const metadata: Metadata = {
  title: 'Releases',
  description: 'Signed release manifests and the live public release pointer.',
};

/** Which release is live is never a cached answer. */
export const dynamic = 'force-dynamic';

const RELEASE_STAGE_STEPS = [
  'Select a release — click a row in the table or paste a release id.',
  'Write a decision reason — every stage action is audited.',
  'Stage activate or rollback. This records intent for review only; the live public pointer does not change until privileged apply with signed-manifest verification.',
] as const;

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
  const outcome = await readPostgresOrDegrade(() => listPublicationReleases(50), 'releases');
  const rows = outcome.status === 'ok' ? outcome.value.items : [];
  const activeRelease = outcome.status === 'ok' ? (outcome.value.activeRelease ?? null) : null;
  const degradedReason = outcome.status === 'degraded' ? outcome.reason : undefined;

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Publication</p>
          <h1 className="ds-page__title">Releases</h1>
          <p className="ds-page__lede">
            Signed release manifests and the live public pointer (
            <span className="ds-mono">publicMeta/activeRelease</span>) for operator review. Staging
            here never edits the active pointer in place — privileged apply does that later.
          </p>
          <ol id="release-stage-steps" aria-label="How to stage a release change">
            {RELEASE_STAGE_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </header>

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

      {degradedReason ? null : <ReleasesDesk rows={rows} activeRelease={activeRelease} />}
    </main>
  );
}
