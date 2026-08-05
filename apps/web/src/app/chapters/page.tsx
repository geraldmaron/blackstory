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
import {
  buildEraGroups,
  filterItems,
  buildPlaceGroups,
  chaptersNotice,
  computeChaptersFacts,
  paginateChapters,
  parseChaptersQuery,
} from './chapters-index';
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
