/**
 * Law reference detail page at `/law/{slug}` with plain-language explainer sections.
 */
import { notFound } from 'next/navigation';
import { buildLawDetailViewModel, listLawStaticParams } from '../law-view-model';
import { LawDetailSections } from '../LawDetailSections';

type LawDetailPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  return [...listLawStaticParams()];
}

export async function generateMetadata({ params }: LawDetailPageProps) {
  const { slug } = await params;
  const view = buildLawDetailViewModel(slug);
  if (view.kind !== 'ok') {
    return { title: 'Law entry not found' };
  }
  return {
    title: view.snapshot.title,
    description: view.snapshot.citation.canonicalCitation,
  };
}

export default async function LawDetailPage({ params }: LawDetailPageProps) {
  const { slug } = await params;
  const view = buildLawDetailViewModel(slug);
  if (view.kind !== 'ok') {
    notFound();
  }

  const { snapshot, explainer } = view;

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Reference</p>
      <h1 className="ds-page__title">{snapshot.title}</h1>
      <p className="ds-page__lede">
        <span className="ds-mono">{snapshot.citation.canonicalCitation}</span>
      </p>
      <LawDetailSections snapshot={snapshot} {...(explainer ? { explainer } : {})} />
    </main>
  );
}
