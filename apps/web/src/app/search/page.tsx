/**
 * Search page redirect: `/search` merged into `/history` (find in time).
 * Preserves keyword + facet query params via shared redirect mapper.
 */
import { redirect } from 'next/navigation';
import { mapSearchQueryToHistoryHref } from '../../lib/history/search-redirect';

export const metadata = {
  title: 'Search',
  description: 'Search BlackStory records by keyword, kind, status, and era.',
};

type SearchPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  redirect(mapSearchQueryToHistoryHref(params));
}
