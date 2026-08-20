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
import { Note, OffRamp, RailGroup, Room, RoomHeader } from '../../components/room';
import {
  buildEraGroups,
  buildKindChips,
  buildPlaceGroups,
  buildSeriesGroups,
  buildSeriesShelves,
  buildTagGroups,
  computeStoriesFacts,
  filterItems,
  hasActiveNarrowing,
  paginateStories,
  parseStoriesQuery,
  sortItems,
  storiesNotice,
  uncollectedItems,
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
  const notice = storiesNotice(source, items.length, filtered.length);
  const kindChips = buildKindChips(items, query);
  const seriesGroups = buildSeriesGroups(items);
  const tagGroups = buildTagGroups(items);

  // The lead story is the current view's own top item — whatever sort/filter is active — so
  // narrowing the view (a kind chip, a search) changes what leads without a second code path.
  const [leadItem, ...rest] = filtered;
  const shelves = buildSeriesShelves(rest);
  const uncollected = uncollectedItems(rest);
  const { rows, page, pageCount, previousHref, nextHref } = paginateStories(uncollected, query);

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
        <>
          {leadItem ? (
            <article className="ds-stories-lead">
              <div className="ds-stories-lead__copy">
                <p className="ds-stories-lead__meta">
                  {KIND_LABELS[leadItem.kind ?? 'chapter'] ?? 'Story'}
                  {leadItem.series?.positionLabel ? ` · ${leadItem.series.positionLabel}` : ''}
                </p>
                <h2 className="ds-stories-lead__title">
                  <a href={`/stories/${leadItem.slug}`}>{leadItem.title}</a>
                </h2>
                <p className="ds-stories-lead__summary">{leadItem.summary}</p>
                <a className="ds-cta-link" href={`/stories/${leadItem.slug}`}>
                  Read the chapter →
                </a>
              </div>
              {leadItem.heroImage ? (
                <a
                  className="ds-stories-lead__media"
                  href={`/stories/${leadItem.slug}`}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={leadItem.heroImage.url} alt="" loading="lazy" />
                </a>
              ) : null}
            </article>
          ) : null}

          {shelves.map((shelf) => (
            <section key={shelf.id} className="ds-stories-shelf">
              <div className="ds-stories-shelf__head">
                <h3 className="ds-stories-shelf__title">
                  {shelf.label} <span className="ds-room-num">{shelf.count}</span>
                </h3>
                {shelf.count > shelf.members.length ? (
                  <a className="ds-stories-shelf__seeall" href={shelf.href}>
                    See all →
                  </a>
                ) : null}
              </div>
              <div className="ds-stories-shelf__grid">
                {shelf.members.map((item, index) => (
                  <a
                    key={item.slug}
                    className="ds-stories-shelf__item"
                    href={`/stories/${item.slug}`}
                  >
                    {item.heroImage ? (
                      <span className="ds-stories-shelf__plate">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.heroImage.url} alt={item.heroImage.alt} loading="lazy" />
                      </span>
                    ) : null}
                    <span className="ds-stories-shelf__index">
                      {String(index + 1).padStart(2, '0')} / {String(shelf.count).padStart(2, '0')}
                    </span>
                    <span className="ds-stories-shelf__item-title">{item.title}</span>
                    <span className="ds-stories-shelf__item-desc">{item.summary}</span>
                  </a>
                ))}
              </div>
            </section>
          ))}

          {uncollected.length > 0 ? (
            <section className="ds-stories-rest">
              <h3 className="ds-stories-shelf__title">Everything else</h3>
              <div className="ds-stories-rest__list">
                {rows.map((item) => (
                  <a
                    key={item.slug}
                    className="ds-stories-rest__row"
                    href={`/stories/${item.slug}`}
                  >
                    <span className="ds-stories-rest__title">{item.title}</span>
                    <span className="ds-stories-rest__summary">{item.summary}</span>
                    <span className="ds-stories-rest__meta">
                      {item.eraLabel} · {item.placeLabel}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </>
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
