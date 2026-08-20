/**
 * Law reference detail page at `/law/{slug}` with plain-language explainer sections.
 *
 * Room kit edition: the same shell every reading room uses, no route-owned chrome.
 */
import { notFound } from 'next/navigation';
import { buildLawDetailViewModel, listLawStaticParams } from '../law-view-model';
import { loadLegalCatalog } from '../../../lib/legal/public-source';
import { LawDetailIntro, LawDetailSections } from '../LawDetailSections';
import { Room } from '../../../components/room';
import '../../reading-room.css';

type LawDetailPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  return [...listLawStaticParams(await loadLegalCatalog())];
}

export async function generateMetadata({ params }: LawDetailPageProps) {
  const { slug } = await params;
  const view = buildLawDetailViewModel(slug, await loadLegalCatalog());
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
  const view = buildLawDetailViewModel(slug, await loadLegalCatalog());
  if (view.kind !== 'ok') {
    notFound();
  }

  const { snapshot, explainer } = view;

  return (
    <Room>
      <LawDetailIntro snapshot={snapshot} />
      <LawDetailSections snapshot={snapshot} {...(explainer ? { explainer } : {})} />
    </Room>
  );
}
