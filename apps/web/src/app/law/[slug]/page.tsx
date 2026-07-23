/**
 * Law reference detail page at `/law/{slug}` with plain-language explainer sections.
 *
 * v6 edition Surface stack with shared gutter mosaic atmosphere and anatomy fact strip.
 */
import { notFound } from 'next/navigation';
import { EditionAtmosphereMosaic } from '../../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import { buildLawDetailViewModel, listLawStaticParams } from '../law-view-model';
import { LawDetailIntro, LawDetailSections } from '../LawDetailSections';
import {
  LAW_EDITION_MOSAIC_SEED,
  lawEditionRootClassName,
  lawEditionStackClassName,
} from '../law-panel-chrome';
import '../law-edition.css';

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
    <div className={lawEditionRootClassName()} data-law-edition="v6">
      <EditionAtmosphereMosaic seedKey={`${LAW_EDITION_MOSAIC_SEED}:${slug}`} count={12} />
      <main className="ds-container ds-page" id="main">
        <div className={lawEditionStackClassName()}>
          <LawDetailIntro snapshot={snapshot} />
          <LawDetailSections snapshot={snapshot} {...(explainer ? { explainer } : {})} />
        </div>
      </main>
    </div>
  );
}
