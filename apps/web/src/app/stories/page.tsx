/**
 * Stories index at `/stories`: the single long-form publication surface. A story is one
 * published piece, and `kind` says under which editorial contract — `chapter` for the
 * era-immersion long-forms, `article` for record entries (a paragraph of context plus
 * individually cited call-outs, published in ordered collections).
 *
 * Both kinds share this index on purpose. A reader looking for what the archive says
 * about a subject should not have to know which contract the answer was written under.
 *
 * Every control here is a link or a form GET, so narrowing is bookmarkable, shareable and
 * crawlable, and the page works with JavaScript off. Windowing reuses the Results rail law
 * from `/records` (`apps/web/src/lib/records/build-records-index.ts`): a fixed page size,
 * real `?page=` anchors, and prev/next link relations.
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
  buildKindChips,
  buildPlaceGroups,
  buildSeriesGroups,
  buildTagGroups,
  computeStoriesFacts,
  filterItems,
  hasActiveNarrowing,
  paginateStories,
  parseStoriesQuery,
  sortItems,
  storiesNotice,
  STORY_SORT_KEYS,
  STORY_SORT_LABELS,
} from './stories-index';
import '../reading-room.css';
import './stories.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/stories',
  title: 'Stories',
  description:
    'Evidence-led long-form chapters and cited record entries from the BlackStory archive: history pinned to place and record, with every figure and claim cited inline.',
});

type StoriesPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const KIND_LABELS: Record<string, string> = { chapter: 'Chapter', article: 'Record' };

export default async function StoriesIndexPage({ searchParams }: StoriesPageProps) {
  const query = parseStoriesQuery(await searchParams);
  const { items, source } = await listPublicArticleListItems();
  const { publishedCount, eraSpanLabel, placeCount } = computeStoriesFacts(items);
  const filtered = sortItems(filterItems(items, query), query.sort);
  const { rows, page, pageCount, previousHref, nextHref } = paginateStories(filtered, query);
  const notice = storiesNotice(source, items.length, filtered.length);
  const kindChips = buildKindChips(items, query);
  const seriesGroups = buildSeriesGroups(items);
  const tagGroups = buildTagGroups(items);

  const meta = [
    `${publishedCount.toLocaleString('en-US')} published`,
    ...(eraSpanLabel === undefined ? [] : [eraSpanLabel]),
    `${placeCount.toLocaleString('en-US')} places`,
  ];

  const rail =
    source === 'live' && items.length > 0 ? (
      <>
        {seriesGroups.length > 0 ? (
          <RailGroup title="Collections" entries={seriesGroups} limit={12} />
        ) : null}
        {tagGroups.length > 0 ? <RailGroup title="By era" entries={tagGroups} limit={12} /> : null}
        <RailGroup title="By period" entries={buildEraGroups(items)} limit={12} />
        <RailGroup title="By place" entries={buildPlaceGroups(items)} limit={12} />
      </>
    ) : undefined;

  return (
    <Room rail={rail}>
      <RoomHeader
        pathname="/stories"
        kicker="Stories"
        title="History pinned to place and record."
        lede="Long-form chapters that walk from a named year and place through the rules in force, and short record entries that set out what a given administration actually did. Every figure and quotation cites the record it rests on."
        meta={meta}
      />

      {source === 'live' && items.length > 0 ? (
        <div className="ds-stories-controls">
          <nav className="ds-stories-chips" aria-label="Filter by kind">
            {kindChips.map((chip) => (
              <a
                key={chip.label}
                className="ds-room-chip"
                href={chip.href}
                {...(chip.active ? { 'aria-current': 'true' as const } : {})}
              >
                {chip.label}{' '}
                <span className="ds-room-num">{chip.count.toLocaleString('en-US')}</span>
              </a>
            ))}
          </nav>

          <form className="ds-stories-form" method="get" action="/stories" role="search">
            {/* Narrowing already in the URL rides along as hidden fields, so submitting the
                search box refines the current view instead of silently resetting it. */}
            {/* 'chapter' is the default and needs no param; '' is the explicit "All" view
                and must round-trip as kind=all, not an empty/absent field. */}
            {query.kind !== 'chapter' ? (
              <input type="hidden" name="kind" value={query.kind === '' ? 'all' : query.kind} />
            ) : null}
            {query.series.length > 0 ? (
              <input type="hidden" name="series" value={query.series} />
            ) : null}
            {query.tag.length > 0 ? <input type="hidden" name="tag" value={query.tag} /> : null}
            {query.era.length > 0 ? <input type="hidden" name="era" value={query.era} /> : null}
            {query.place.length > 0 ? (
              <input type="hidden" name="place" value={query.place} />
            ) : null}

            <label className="ds-stories-field">
              <span className="ds-stories-field__label">Search stories</span>
              <input
                className="ds-stories-input"
                type="search"
                name="q"
                defaultValue={query.q}
                placeholder="Search by title, subject or collection"
                autoComplete="off"
              />
            </label>

            <label className="ds-stories-field">
              <span className="ds-stories-field__label">Sort</span>
              <select className="ds-stories-select" name="sort" defaultValue={query.sort}>
                {STORY_SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {STORY_SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>

            <button className="ds-stories-submit" type="submit">
              Apply
            </button>
            {hasActiveNarrowing(query) ? (
              <a className="ds-stories-clear" href="/stories">
                Clear
              </a>
            ) : null}
          </form>

          <p className="ds-stories-count" role="status">
            {`${filtered.length.toLocaleString('en-US')} of ${items.length.toLocaleString('en-US')} stories`}
          </p>
        </div>
      ) : null}

      {notice.body.length > 0 ? (
        <Note kind={source === 'unavailable' ? 'Unavailable' : 'Empty'}>{notice.body}</Note>
      ) : (
        <CardGrid>
          {rows.map((item) => (
            <RoomCard
              key={item.slug}
              href={`/stories/${item.slug}`}
              kind={KIND_LABELS[item.kind ?? 'chapter'] ?? 'Story'}
              title={item.title}
              description={item.summary}
              meta={
                item.series?.positionLabel
                  ? `${item.series.positionLabel} · ${item.eraLabel}`
                  : `${item.eraLabel} · ${item.placeLabel}`
              }
              {...(item.heroImage
                ? {
                    media: {
                      url: item.heroImage.url,
                      alt: item.heroImage.alt,
                      // Series entries are portrait galleries; show the sitter whole.
                      ...(item.series ? { fit: 'contain' as const } : {}),
                    },
                  }
                : {})}
            />
          ))}
        </CardGrid>
      )}

      {pageCount > 1 ? (
        <nav className="ds-chapters-pager" aria-label="Stories pages">
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
        Every figure and quotation in these stories cites its record.
      </OffRamp>
    </Room>
  );
}
