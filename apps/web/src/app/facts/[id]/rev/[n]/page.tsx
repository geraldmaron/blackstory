/**
 * Per-revision permalink page at `/facts/{id}/rev/{n}`.
 *
 * The Wikipedia-oldid pattern: pins a specific revision so an out-of-context screenshot can be
 * answered by linking the cited revision and its edit summary. The record stays resolvable even
 * when superseded or deprecated.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notice } from '@repo/ui';
import { SeedDataNotice } from '../../../../../components/SeedDataNotice';
import {
  FactCitationList,
  FactConfidencePanel,
  FactJsonLdScript,
  FactRevisionPanel,
  FactStatusBanner,
  formatIsoDate,
  humanizeToken,
} from '../../../../../components/facts';
import { buildFactPath } from '@repo/domain';
import { listPublicFactRevisionParams, resolveFactRevision } from '../../../resolve-public-fact';

type FactRevisionPageProps = {
  readonly params: Promise<{ readonly id: string; readonly n: string }>;
};

export async function generateStaticParams() {
  return [...listPublicFactRevisionParams()];
}

export async function generateMetadata({ params }: FactRevisionPageProps) {
  const { id, n } = await params;
  const revisionNumber = Number.parseInt(n, 10);
  const resolved = resolveFactRevision(id, revisionNumber);
  if (resolved.kind !== 'ok') {
    return { title: 'Revision not found' };
  }
  return {
    title: `${resolved.fact.shortStatement} (rev ${revisionNumber})`,
    description: resolved.revision.summary,
  };
}

export default async function FactRevisionPage({ params }: FactRevisionPageProps) {
  const { id, n } = await params;
  const revisionNumber = Number.parseInt(n, 10);
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
    notFound();
  }

  const resolved = resolveFactRevision(id, revisionNumber);
  if (resolved.kind !== 'ok') {
    notFound();
  }

  const { fact, revision } = resolved;

  return (
    <main className="ds-container ds-page" id="main">
      <FactJsonLdScript fact={fact} />

      <header className="ds-entity-mast">
        <p className="ds-page__eyebrow">
          Fact revision · <span className="ds-mono">{fact.id}</span> · rev {revision.revisionNumber}
        </p>
        <h1 className="ds-page__title">{fact.shortStatement}</h1>
        <p className="ds-page__lede">{fact.statement}</p>
      </header>

      <div className="ds-stack" style={{ marginTop: 'var(--ds-space-6)' }}>
        <SeedDataNotice compact />
        <FactStatusBanner fact={fact} />

        <Notice tone="warning" title="Pinned revision view">
          <p style={{ margin: 0 }}>
            You are viewing revision {revision.revisionNumber} from {formatIsoDate(revision.timestamp)}. Edit summary:{' '}
            {revision.summary}
          </p>
          <p style={{ margin: 'var(--ds-space-2) 0 0 0' }}>
            <Link href={buildFactPath(fact.id, fact.slug)}>
              Open the current fact record
            </Link>
          </p>
        </Notice>

        <section aria-labelledby="revision-detail-heading">
          <p className="ds-section__kicker">Audit</p>
          <h2 className="ds-section__title" id="revision-detail-heading">
            This revision
          </h2>
          <dl className="ds-sans" style={{ marginTop: 'var(--ds-space-4)' }}>
            <dt className="ds-dt">Change type</dt>
            <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>{humanizeToken(revision.changeType)}</dd>
            <dt className="ds-dt">Editor</dt>
            <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>
              {revision.agent.displayName ?? revision.agent.id}
            </dd>
            <dt className="ds-dt">Timestamp</dt>
            <dd style={{ margin: 0 }}>{formatIsoDate(revision.timestamp)}</dd>
          </dl>
        </section>

        <FactConfidencePanel fact={fact} />

        <section aria-labelledby="rev-citations-heading">
          <p className="ds-section__kicker">Sources</p>
          <h2 className="ds-section__title" id="rev-citations-heading">
            Citations at this revision
          </h2>
          <div style={{ marginTop: 'var(--ds-space-4)' }}>
            <FactCitationList citations={fact.citations} labelledBy="rev-citations-heading" />
          </div>
        </section>

        <section aria-labelledby="all-revisions-heading">
          <p className="ds-section__kicker">History</p>
          <h2 className="ds-section__title" id="all-revisions-heading">
            All revisions
          </h2>
          <div style={{ marginTop: 'var(--ds-space-4)' }}>
            <FactRevisionPanel
              fact={fact}
              currentRevisionNumber={revision.revisionNumber}
              labelledBy="all-revisions-heading"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
