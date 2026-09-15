/**
 * `/books` — crawlable deep link into the apparatus Banned books section.
 *
 * Query-bearing arrivals (legacy browse bookmarks) forward to `/books/browse` with the same
 * params so filters are not lost.
 */
import type { Metadata } from 'next';
import { permanentRedirect, redirect } from 'next/navigation';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { BOOKS_PAGE_DESCRIPTION } from './books-copy';
import type { RawBooksBrowseParams } from './books-view-model';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/books',
  title: 'Banned books',
  description: BOOKS_PAGE_DESCRIPTION,
});

type BooksPageProps = {
  readonly searchParams: Promise<RawBooksBrowseParams>;
};

function hasBrowseParams(params: RawBooksBrowseParams): boolean {
  return Boolean(
    (params.q && params.q.trim()) ||
    (params.state && params.state !== 'all') ||
    (params.author && params.author !== 'all') ||
    (params.sort && params.sort !== 'title') ||
    (params.dir && params.dir !== 'asc') ||
    (params.page && params.page !== '1'),
  );
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
  const params = await searchParams;
  if (hasBrowseParams(params)) {
    const search = new URLSearchParams();
    if (params.q?.trim()) search.set('q', params.q.trim());
    if (params.state && params.state !== 'all') search.set('state', params.state);
    if (params.author && params.author !== 'all') search.set('author', params.author);
    if (params.sort && params.sort !== 'title') search.set('sort', params.sort);
    if (params.dir && params.dir !== 'asc') search.set('dir', params.dir);
    if (params.page && params.page !== '1') search.set('page', params.page);
    const query = search.toString();
    redirect(query.length > 0 ? `/books/browse?${query}` : '/books/browse');
  }
  permanentRedirect('/apparatus?s=books');
}
