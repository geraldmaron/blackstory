/**
 * Per-revision permalink page at `/facts/{id}/rev/{n}`.
 *
 * The Wikipedia-oldid pattern: pins a specific revision so an out-of-context screenshot can be
 * answered by linking the cited revision and its edit summary. The record stays resolvable even
 * when superseded or deprecated.
 */
import { notFound } from 'next/navigation';
import { Notice } from '@blap/ui';
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
import { buildFactPath, slugifyFactStatement } from '@blap/domain';
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
    <main className="bp-container bp-page" id="main">
      <FactJsonLdScript fact={fact} />

      <header className="bp-entity-mast">
        <p className="bp-page__eyebrow">
          Fact revision · <span className="bp-mono">{fact.id}</span> · rev {revision.revisionNumber}
        </p>
        <h1 className="bp-page__title">{fact.shortStatement}</h1>
        <p className="bp-page__lede">{fact.statement}</p>
      </header>

      <div className="bp-stack" style={{ marginTop: 'var(--bp-space-6)' }}>
        <SeedDataNotice compact />
        <FactStatusBanner fact={fact} />

        <Notice tone="warning" title="Pinned revision view">
          <p style={{ margin: 0 }}>
            You are viewing revision {revision.revisionNumber} from {formatIsoDate(revision.timestamp)}. Edit summary:{' '}
            {revision.summary}
          </p>
          <p style={{ margin: 'var(--bp-space-2) 0 0 0' }}>
            <a href={buildFactPath(fact.id, slugifyFactStatement(fact.shortStatement))}>Open the current fact record</a>
          </p>
        </Notice>

        <section aria-labelledby="revision-detail-heading">
          <p className="bp-section__kicker">Audit</p>
          <h2 className="bp-section__title" id="revision-detail-heading">
            This revision
          </h2>
          <dl className="bp-sans" style={{ marginTop: 'var(--bp-space-4)' }}>
            <dt className="bp-dt">Change type</dt>
            <dd style={{ margin: '0 0 var(--bp-space-2) 0' }}>{humanizeToken(revision.changeType)}</dd>
            <dt className="bp-dt">Editor</dt>
            <dd style={{ margin: '0 0 var(--bp-space-2) 0' }}>
              {revision.agent.displayName ?? revision.agent.id}
            </dd>
            <dt className="bp-dt">Timestamp</dt>
            <dd style={{ margin: 0 }}>{formatIsoDate(revision.timestamp)}</dd>
          </dl>
        </section>

        <FactConfidencePanel fact={fact} />

        <section aria-labelledby="rev-citations-heading">
          <p className="bp-section__kicker">Sources</p>
          <h2 className="bp-section__title" id="rev-citations-heading">
            Citations at this revision
          </h2>
          <div style={{ marginTop: 'var(--bp-space-4)' }}>
            <FactCitationList citations={fact.citations} labelledBy="rev-citations-heading" />
          </div>
        </section>

        <section aria-labelledby="all-revisions-heading">
          <p className="bp-section__kicker">History</p>
          <h2 className="bp-section__title" id="all-revisions-heading">
            All revisions
          </h2>
          <div style={{ marginTop: 'var(--bp-space-4)' }}>
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
