/**
 * Legal landscape detail page at `/legal/{slug}` with plain-language explainer sections.
 */
import { notFound } from 'next/navigation';
import { Card } from '@blap/ui';
import {
  LegalDisclaimer,
  LegalExplainerSections,
  LegalStatusBadge,
  humanizeLegalKind,
} from '../../../components/legal';
import { buildLegalDetailViewModel, listLegalStaticParams } from '../legal-view-model';
import '../legal.css';

type LegalDetailPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  return [...listLegalStaticParams()];
}

export async function generateMetadata({ params }: LegalDetailPageProps) {
  const { slug } = await params;
  const view = buildLegalDetailViewModel(slug);
  if (view.kind !== 'ok') {
    return { title: 'Legal entry not found' };
  }
  return {
    title: view.snapshot.title,
    description: view.snapshot.citation.canonicalCitation,
  };
}

export default async function LegalDetailPage({ params }: LegalDetailPageProps) {
  const { slug } = await params;
  const view = buildLegalDetailViewModel(slug);
  if (view.kind !== 'ok') {
    notFound();
  }

  const { snapshot, explainer, factHref } = view;
  const statusBadge = <LegalStatusBadge status={snapshot.lawStatus} />;

  return (
    <main className="bp-container bp-page" id="main">
      <header className="bp-entity-mast">
        <p className="bp-page__eyebrow">
          {humanizeLegalKind(snapshot.kind)} · <span className="bp-mono">{snapshot.jurisdictionId}</span>
        </p>
        <h1 className="bp-page__title">{snapshot.title}</h1>
        <p className="bp-page__lede">
          <span className="bp-mono">{snapshot.citation.canonicalCitation}</span> · {statusBadge}
        </p>
      </header>

      <div className="bp-stack" style={{ marginTop: 'var(--bp-space-6)' }}>
        <LegalDisclaimer />

        {factHref ? (
          <Card>
            <p style={{ margin: 0 }}>
              This entry links to a canonical{' '}
              <a href={factHref}>fact record</a> with structured citations and revision history.
            </p>
          </Card>
        ) : null}

        {explainer ? (
          <LegalExplainerSections
            explainer={explainer}
            citation={snapshot.citation.canonicalCitation}
            statusBadge={statusBadge}
          />
        ) : (
          <Card>
            <p style={{ margin: 0 }}>
              Plain-language explainer pending editorial review. Primary source:{' '}
              <a href={snapshot.citation.archive.sourceUrl} rel="noopener noreferrer" target="_blank">
                {snapshot.citation.archive.sourceUrl}
              </a>
            </p>
          </Card>
        )}

        <section aria-labelledby="archive-heading">
          <p className="bp-section__kicker">Provenance</p>
          <h2 className="bp-section__title" id="archive-heading">
            Archived capture
          </h2>
          <Card>
            <dl className="bp-dl">
              <div>
                <dt>Retrieved</dt>
                <dd>{snapshot.citation.archive.retrievedAt.split('T')[0]}</dd>
              </div>
              <div>
                <dt>License</dt>
                <dd>{snapshot.citation.licenseTag}</dd>
              </div>
              <div>
                <dt>Archived copy</dt>
                <dd>
                  <a href={snapshot.citation.archive.archivedCaptureUrl} rel="noopener noreferrer" target="_blank">
                    View archived capture
                  </a>
                </dd>
              </div>
            </dl>
          </Card>
        </section>
      </div>
    </main>
  );
}
