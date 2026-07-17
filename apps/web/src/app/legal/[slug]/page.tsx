/**
 * Legal landscape detail page at `/legal/{slug}` with plain-language explainer sections (BB-087 AC6).
 */
import { notFound } from 'next/navigation';
import { Card } from '@black-book/ui';
import { SeedDataNotice } from '../../../components/SeedDataNotice';
import {
  LegalDisclaimer,
  LegalExplainerSections,
  LegalStatusBadge,
  humanizeLegalKind,
} from '../../../components/legal';
import { buildLegalDetailViewModel, listLegalStaticParams } from '../legal-view-model';

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
    <main className="bb-container bb-page" id="main">
      <header className="bb-entity-mast">
        <p className="bb-page__eyebrow">
          {humanizeLegalKind(snapshot.kind)} · <span className="bb-mono">{snapshot.jurisdictionId}</span>
        </p>
        <h1 className="bb-page__title">{snapshot.title}</h1>
        <p className="bb-page__lede">
          <span className="bb-mono">{snapshot.citation.canonicalCitation}</span> · {statusBadge}
        </p>
      </header>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <LegalDisclaimer />
        <SeedDataNotice compact />

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
          <p className="bb-section__kicker">Provenance</p>
          <h2 className="bb-section__title" id="archive-heading">
            Archived capture
          </h2>
          <Card>
            <dl className="bb-dl">
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
