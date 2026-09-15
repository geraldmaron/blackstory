/**
 * `/law` — crawlable deep link into the apparatus Law section.
 *
 * Query-bearing arrivals (legacy browse bookmarks) forward to `/law/browse` with the same
 * params so filters are not lost.
 */
import type { Metadata } from 'next';
import { permanentRedirect, redirect } from 'next/navigation';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import type { RawLawBrowseParams } from './law-view-model';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/law',
  title: 'Law',
  description:
    'Plain-language access to landmark civil-rights statutes, regulations, and court decisions.',
});

type LawPageProps = {
  readonly searchParams: Promise<RawLawBrowseParams>;
};

function hasBrowseParams(params: RawLawBrowseParams): boolean {
  return Boolean(
    (params.q && params.q.trim()) ||
    (params.kind && params.kind !== 'all') ||
    (params.topic && params.topic !== 'all') ||
    (params.status && params.status !== 'all') ||
    (params.sort && params.sort !== 'chronological'),
  );
}

export default async function LawPage({ searchParams }: LawPageProps) {
  const params = await searchParams;
  if (hasBrowseParams(params)) {
    const search = new URLSearchParams();
    if (params.q?.trim()) search.set('q', params.q.trim());
    if (params.kind && params.kind !== 'all') search.set('kind', params.kind);
    if (params.topic && params.topic !== 'all') search.set('topic', params.topic);
    if (params.status && params.status !== 'all') search.set('status', params.status);
    if (params.sort && params.sort !== 'chronological') search.set('sort', params.sort);
    const query = search.toString();
    redirect(query.length > 0 ? `/law/browse?${query}` : '/law/browse');
  }
  permanentRedirect('/apparatus?s=law');
}
