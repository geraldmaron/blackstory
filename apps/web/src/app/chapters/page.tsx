/**
 * Chapters index at `/chapters`: the single long-form publication surface that
 * replaces the old /themes + /stories + /topics + /articles split. Thin list
 * items load from the active-release article projection; full bodies load on
 * detail pages.
 *
 * Windowing reuses the Results rail law from `/records`
 * (`apps/web/src/lib/records/build-records-index.ts`): a fixed page size,
 * real `?page=` anchors, and prev/next link relations, rather than a second
 * client-side windowing mechanism invented for this route.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { listPublicArticleListItems } from '../../lib/articles/source';
import type { PublicArticleListItemDoc } from '@repo/schemas';
import { RECORDS_PAGE_SIZE } from '../../lib/records/build-records-index';
import {
  CardGrid,
  Note,
  OffRamp,
  RailGroup,
  Room,
  RoomCard,
  RoomHeader,
} from '../../components/room';
import type { RailEntry } from '../../components/room';
import '../reading-room.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/chapters',
  title: 'Chapters',
  description:
    'Evidence-led long-form chapters from the BlackStory archive: history pinned to place and records, with every figure and claim cited inline.',
});

type ChaptersPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

function filterItems(
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

export default async function ChaptersIndexPage({ searchParams }: ChaptersPageProps) {
  const query = parseChaptersQuery(await searchParams);
  const { items, source } = await listPublicArticleListItems();
  const { publishedCount, eraSpanLabel, placeCount } = computeChaptersFacts(items);
  const filtered = filterItems(items, query);
  const { rows, page, pageCount, previousHref, nextHref } = paginateChapters(filtered, query);
  const notice = chaptersNotice(source, items.length, filtered.length);

  const meta = [
    `${publishedCount.toLocaleString('en-US')} published`,
    ...(eraSpanLabel === undefined ? [] : [eraSpanLabel]),
    `${placeCount.toLocaleString('en-US')} places`,
  ];

  const rail =
    source === 'live' && items.length > 0 ? (
      <>
        <RailGroup title="By era" entries={buildEraGroups(items)} limit={12} />
        <RailGroup title="By place" entries={buildPlaceGroups(items)} limit={12} />
      </>
    ) : undefined;

  return (
    <Room rail={rail}>
      <RoomHeader
        pathname="/chapters"
        kicker="Chapters"
        title="History pinned to place and record."
        lede="Long-form pieces that walk from a named year and place through the rules in force and the measured odds under them. Every figure and quotation cites the record it rests on."
        meta={meta}
      />

      {notice.body.length > 0 ? (
        <Note kind={source === 'unavailable' ? 'Unavailable' : 'Empty'}>{notice.body}</Note>
      ) : (
        <CardGrid>
          {rows.map((item) => (
            <RoomCard
              key={item.slug}
              href={`/chapters/${item.slug}`}
              kind="Chapter"
              title={item.title}
              description={item.summary}
              meta={`${item.eraLabel} · ${item.placeLabel}`}
              {...(item.heroImage ? { media: item.heroImage } : {})}
            />
          ))}
        </CardGrid>
      )}

      {pageCount > 1 ? (
        <nav className="ds-chapters-pager" aria-label="Chapters pages">
          {previousHref === undefined ? (
            <span className="ds-chapters-pager__spacer" />
          ) : (
            <a className="ds-chapters-pager__link" href={previousHref} rel="prev">
              ← Previous {RECORDS_PAGE_SIZE}
            </a>
          )}
          <span className="ds-chapters-pager__at">{`Page ${page} of ${pageCount}`}</span>
          {nextHref === undefined ? (
            <span className="ds-chapters-pager__spacer" />
          ) : (
            <a className="ds-chapters-pager__link" href={nextHref} rel="next">
              Next {RECORDS_PAGE_SIZE} →
            </a>
          )}
        </nav>
      ) : null}

      <OffRamp
        title="Go straight to the archive"
        actions={[
          { label: 'Open the Atlas', href: '/', emphasis: 'copper' },
          { label: 'Search the archive', href: '/records' },
        ]}
      >
        Every figure and quotation in these chapters cites its record.
      </OffRamp>
    </Room>
  );
}
