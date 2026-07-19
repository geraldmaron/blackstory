/**
 * Legal landscape detail page at `/legal/{slug}` with plain-language explainer sections.
 */
import { notFound } from 'next/navigation';
import { Card } from '@repo/ui';
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

  const { snapshot, explainer } = view;
  const statusBadge = <LegalStatusBadge status={snapshot.lawStatus} />;

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-entity-mast">
        <p className="ds-page__eyebrow">
          {humanizeLegalKind(snapshot.kind)} ·{' '}
          <span className="ds-mono">{snapshot.jurisdictionId}</span>
        </p>
        <h1 className="ds-page__title">{snapshot.title}</h1>
        <p className="ds-page__lede">
          <span className="ds-mono">{snapshot.citation.canonicalCitation}</span> · {statusBadge}
        </p>
      </header>

      <div className="ds-stack" style={{ marginTop: 'var(--ds-space-6)' }}>
        <LegalDisclaimer />

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
              <a
                href={snapshot.citation.archive.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {snapshot.citation.archive.sourceUrl}
              </a>
            </p>
          </Card>
        )}

        <section aria-labelledby="archive-heading">
          <p className="ds-section__kicker">Provenance</p>
          <h2 className="ds-section__title" id="archive-heading">
            Archived capture
          </h2>
          <Card>
            <dl className="ds-dl">
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
                  <a
                    href={snapshot.citation.archive.archivedCaptureUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
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
