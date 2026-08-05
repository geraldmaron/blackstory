/**
 * The `/chapters` index's pure logic: query parsing, href building, windowing, header facts, the
 * rail groups and the three notice states.
 *
 * WHY THIS IS NOT IN `page.tsx`. Next 16 type-checks a route file's export surface against a
 * fixed allowlist (`default`, `metadata`, `revalidate`, and so on) and fails the build on
 * anything else, so a page cannot also be the module its tests import from. Exporting these from
 * the page passed lint, typecheck and tests locally and then failed `next build` on generated
 * route types.
 */
import type { PublicArticleListItemDoc } from '@repo/schemas';
import { RECORDS_PAGE_SIZE } from '../../lib/records/build-records-index';
import type { RailEntry } from '../../components/room';

export type ChaptersQuery = {
  readonly era: string;
  readonly place: string;
  readonly page: number;
};

const EMPTY_CHAPTERS_QUERY: ChaptersQuery = { era: '', place: '', page: 1 };

/**
 * Normalizes raw search params the same way `parseRecordsQuery` does: anything unrecognised
 * collapses rather than throws, because this route is reachable from bookmarks.
 */
export function parseChaptersQuery(
  raw: Record<string, string | readonly string[] | undefined>,
): ChaptersQuery {
  const one = (key: string): string => {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === 'string' ? first.trim() : '';
  };
  const rawPage = Number.parseInt(one('page'), 10);
  return {
    era: one('era'),
    place: one('place'),
    page: Number.isFinite(rawPage) && rawPage > 1 ? rawPage : 1,
  };
}

/** Builds a `/chapters` href. `page=1` is never emitted, matching the records convention. */
export function chaptersHref(query: Partial<ChaptersQuery>): string {
  const merged = { ...EMPTY_CHAPTERS_QUERY, ...query };
  const params = new URLSearchParams();
  if (merged.era.length > 0) params.set('era', merged.era);
  if (merged.place.length > 0) params.set('place', merged.place);
  if (merged.page > 1) params.set('page', String(merged.page));
  const search = params.toString();
  return search.length > 0 ? `/chapters?${search}` : '/chapters';
}

export function filterItems(
  items: readonly PublicArticleListItemDoc[],
  query: ChaptersQuery,
): readonly PublicArticleListItemDoc[] {
  return items.filter((item) => {
    if (query.era.length > 0 && item.eraLabel !== query.era) return false;
    if (query.place.length > 0 && item.placeLabel !== query.place) return false;
    return true;
  });
}

type ChaptersPage = {
  readonly rows: readonly PublicArticleListItemDoc[];
  readonly page: number;
  readonly pageCount: number;
  readonly previousHref: string | undefined;
  readonly nextHref: string | undefined;
};

/** Same page-size slice as `/records`: `RECORDS_PAGE_SIZE` rows per page, real prev/next anchors. */
export function paginateChapters(
  matched: readonly PublicArticleListItemDoc[],
  query: ChaptersQuery,
): ChaptersPage {
  const pageCount = Math.max(1, Math.ceil(matched.length / RECORDS_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * RECORDS_PAGE_SIZE;
  const rows = matched.slice(start, start + RECORDS_PAGE_SIZE);
  return {
    rows,
    page,
    pageCount,
    previousHref: page > 1 ? chaptersHref({ ...query, page: page - 1 }) : undefined,
    nextHref: page < pageCount ? chaptersHref({ ...query, page: page + 1 }) : undefined,
  };
}

/** Published count, era span and place count for the header meta row, derived from the release. */
export function computeChaptersFacts(items: readonly PublicArticleListItemDoc[]): {
  readonly publishedCount: number;
  readonly eraSpanLabel: string | undefined;
  readonly placeCount: number;
} {
  const publishedCount = items.length;
  const years = items
    .map((item) => Number.parseInt(item.publishedAt.slice(0, 4), 10))
    .filter((year) => Number.isFinite(year));
  const eraSpanLabel =
    years.length === 0 ? undefined : `${Math.min(...years)} to ${Math.max(...years)}`;
  const placeCount = new Set(items.map((item) => item.placeLabel)).size;
  return { publishedCount, eraSpanLabel, placeCount };
}

function buildGroups(
  items: readonly PublicArticleListItemDoc[],
  label: (item: PublicArticleListItemDoc) => string,
  hrefFor: (label: string) => string,
): readonly RailEntry[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = label(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([entryLabel, count]) => ({ label: entryLabel, href: hrefFor(entryLabel), count }));
}

export function buildEraGroups(items: readonly PublicArticleListItemDoc[]): readonly RailEntry[] {
  return buildGroups(
    items,
    (item) => item.eraLabel,
    (era) => chaptersHref({ era }),
  );
}

export function buildPlaceGroups(items: readonly PublicArticleListItemDoc[]): readonly RailEntry[] {
  return buildGroups(
    items,
    (item) => item.placeLabel,
    (place) => chaptersHref({ place }),
  );
}

type ChaptersNotice = { readonly title: string; readonly body: string };

/**
 * The unavailable (load failure) state and the none-published state read differently on purpose:
 * one is a fault on our side and asks the reader to check back, the other is an honest statement
 * that the release has nothing here yet. Collapsing them into one message would tell a reader
 * whose connection to the live record failed that the archive is simply empty.
 */
export function chaptersNotice(
  source: 'live' | 'unavailable',
  totalCount: number,
  filteredCount: number,
): ChaptersNotice {
  if (source === 'unavailable') {
    return {
      title: 'Chapters are temporarily unavailable',
      body: 'Articles are temporarily unavailable while we reconnect to the live record. Nothing here is lost; please check back shortly.',
    };
  }
  if (totalCount === 0) {
    return {
      title: 'No chapters are published yet',
      body: 'No chapters are published yet.',
    };
  }
  if (filteredCount === 0) {
    return {
      title: 'No chapters match this narrowing',
      body: `Nothing in the release matches this narrowing. Clear it to see all ${totalCount.toLocaleString('en-US')} chapters.`,
    };
  }
  return { title: '', body: '' };
}
