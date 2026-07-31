/**
 * `/search` is a redirect endpoint, not a surface: it resolves to `/records` in exactly one hop
 * with the reader's keyword and facets intact. The route file exists rather than a config rule
 * because the mapping is a query transform, which `next.config.mjs` cannot express.
 */
import { permanentRedirect } from 'next/navigation';
import { mapSearchQueryToRecordsHref } from '../../lib/search/search-href';

export const metadata = {
  title: 'Search',
  description: 'Search BlackStory records by keyword, kind, status, and era.',
};

type SearchPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  // Permanent, so this resolves as a 308 like every config rule in the table. A 307 would tell
  // crawlers to keep indexing `/search` as the canonical home of a surface that no longer exists.
  permanentRedirect(mapSearchQueryToRecordsHref(params));
}
