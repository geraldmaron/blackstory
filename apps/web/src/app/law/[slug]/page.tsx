/**
 * A law entry at `/law/{slug}`, on the shared record anatomy (`LawRecordView`).
 */
import { notFound } from 'next/navigation';
import { buildLawDetailViewModel, listLawStaticParams } from '../law-view-model';
import { loadLegalCatalog } from '../../../lib/legal/public-source';
import { LawRecordView } from './LawRecordView';

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
    description: view.explainer?.whatItSays ?? view.snapshot.citation.canonicalCitation,
  };
}

export default async function LawDetailPage({ params }: LawDetailPageProps) {
  const { slug } = await params;
  const view = buildLawDetailViewModel(slug, await loadLegalCatalog());
  if (view.kind !== 'ok') {
    notFound();
  }
  return <LawRecordView {...view} />;
}
