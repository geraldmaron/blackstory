/**
 * Stories index at `/stories`: the single long-form publication surface. A story is one
 * published piece, and `kind` says under which editorial contract — `chapter` for the
 * era-immersion long-forms, `article` for short entries (a paragraph of context plus
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
import { WalkOffRamp } from '../walk-off-ramp';
import { listPublicArticleListItems } from '../../lib/articles/source';
import { RECORDS_PAGE_SIZE } from '../../lib/records/build-records-index';
import {
  CardGrid,
  GroupHeading,
  Note,
  RailGroup,
  Room,
  RoomCard,
  RoomHeader,
} from '../../components/room';
import {
  buildCollectionGroups,
  buildCollectionShelves,
  buildEraGroups,
  buildKindChips,
  buildPlaceGroups,
  buildTagGroups,
  computeStoriesFacts,
  filterItems,
  hasActiveNarrowing,
  paginateStories,
  parseStoriesQuery,
  pickLeadStory,
  showsShelves,
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
    'Evidence-led long-form chapters and cited short entries from the BlackStory archive: history pinned to place and record, with every figure and claim cited inline.',
});

type StoriesPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Not "Record": `/records` is the unrelated whole-archive entity index. See stories-index.ts. */
const KIND_LABELS: Record<string, string> = { chapter: 'Chapter', article: 'Entry' };

/**
 * What the lead is leading on. The lead story is whatever sits at the top of the current view, so
 * the flag has to name the sort that put it there rather than assert an editorial judgement the
 * page has not made: under "newest" it is the newest chapter, under a collection order it is
 * where the collection starts.
 */
function leadFlag(sort: string): string {
  switch (sort) {
    case 'newest':
      return 'Newest';
    case 'oldest':
      return 'Earliest';
    case 'title':
      return 'First alphabetically';
    default:
      return 'Start here';
  }
}

export default async function StoriesIndexPage({ searchParams }: StoriesPageProps) {
  const query = parseStoriesQuery(await searchParams);
  const { items, source } = await listPublicArticleListItems();
  const { publishedCount, eraSpanLabel, placeCount } = computeStoriesFacts(items);
  const filtered = sortItems(filterItems(items, query), query.sort);
  const notice = storiesNotice(source, items.length, filtered.length);
  const kindChips = buildKindChips(items, query);
  const collectionGroups = buildCollectionGroups(items);
  const tagGroups = buildTagGroups(items);

  // The shelves layout only ever renders in the page's default, unnarrowed browse state (see
  // `showsShelves`); everything else — a search, a filter, a non-default sort — falls back to
  // the flat, paginated index above. No new reads: shelves are built from `filtered`, the same
  // sorted-and-filtered set the flat index already computed.
  const shelfMode = source === 'live' && items.length > 0 && showsShelves(query);
  const lead = shelfMode ? pickLeadStory(filtered) : undefined;
  const shelves = shelfMode ? buildCollectionShelves(filtered) : [];
  const uncollected = shelfMode ? uncollectedItems(filtered) : [];
  // Pagination is scoped to the "Everything else" list only — the lead and the shelves above
  // it stay put across its pages, which is what "applies to the Everything else list only"
  // means in practice. Outside shelf mode there is no lead or shelf to hold in place, so the
  // whole filtered set paginates directly.
  const pager = paginateStories(shelfMode ? uncollected : filtered, query);

  const meta = [
    `${publishedCount.toLocaleString('en-US')} published`,
    ...(eraSpanLabel === undefined ? [] : [eraSpanLabel]),
    `${placeCount.toLocaleString('en-US')} places`,
  ];

  const rail =
    source === 'live' && items.length > 0 ? (
      <>
        {collectionGroups.length > 0 ? (
          <RailGroup title="Collections" entries={collectionGroups} limit={12} />
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
        kicker="Writing built out of the record"
        title="Stories"
        lede="Long-form chapters that walk from a named year and place through the rules in force, and shorter entries that set out what a given administration actually did. Every story names the records it stands on, and every record links back to the stories about it."
        meta={meta}
        showPath={false}
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
            {query.collection.length > 0 ? (
              <input type="hidden" name="collection" value={query.collection} />
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
      ) : shelfMode ? (
        <>
          {lead ? (
            <article className="ds-stories-lead">
              <div className="ds-stories-lead__copy">
                {/* The lead is the current view's top item, so what makes it the lead is the
                    sort in force, not an editor's flag. The pill says which. */}
                <p className="ds-stories-lead__flag">{leadFlag(query.sort)}</p>
                <p className="ds-stories-lead__meta">
                  {/* The collection leads, because it is the thing a reader can follow from
                      here; the kind and the era are what the row already is. */}
                  {[
                    lead.series?.label,
                    lead.series?.positionLabel,
                    KIND_LABELS[lead.kind ?? 'chapter'] ?? 'Story',
                    lead.eraLabel,
                  ]
                    .filter((fact): fact is string => Boolean(fact))
                    .join(' · ')}
                </p>
                <h2 className="ds-stories-lead__title">
                  <a href={`/stories/${lead.slug}`}>{lead.title}</a>
                </h2>
                <p className="ds-stories-lead__summary">{lead.summary}</p>
                <a className="ds-cta ds-cta--copper" href={`/stories/${lead.slug}`}>
                  {lead.kind === 'article' ? 'Read the entry' : 'Read the chapter'}
                </a>
              </div>
              {lead.heroImage ? (
                <a
                  className="ds-stories-lead__plate"
                  href={`/stories/${lead.slug}`}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lead.heroImage.url} alt="" loading="lazy" />
                </a>
              ) : null}
            </article>
          ) : null}

          {shelves.map((shelf) => (
            <section key={shelf.id} className="ds-stories-shelf">
              <div className="ds-stories-shelf__head">
                <h2 className="ds-stories-shelf__title">
                  {shelf.label} <span className="ds-room-num">{shelf.count}</span>
                </h2>
                {/* Say how many. "See all" beside a shelf of four is an offer with no size on
                    it, and the count is the reason to follow it. */}
                <a className="ds-stories-shelf__all" href={shelf.href}>
                  See all {shelf.count}
                </a>
              </div>
              <div className="ds-stories-shelf__grid">
                {shelf.members.slice(0, 4).map((item, index) => (
                  <a
                    key={item.slug}
                    className="ds-stories-shelf__entry"
                    href={`/stories/${item.slug}`}
                  >
                    <span className="ds-stories-shelf__plate">
                      {item.heroImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.heroImage.url} alt={item.heroImage.alt} loading="lazy" />
                      ) : null}
                    </span>
                    {/* The entry's own number, not its position in this row: a shelf shows
                        four of nine, and a row index is a fraction of the row rather than of the
                        collection the reader is being offered. */}
                    <span className="ds-stories-shelf__index">
                      {item.series?.positionLabel ??
                        `${KIND_LABELS[item.kind ?? 'chapter'] ?? 'Entry'} ${index + 1}`}
                    </span>
                    <span className="ds-stories-shelf__entry-title">{item.title}</span>
                    <span className="ds-stories-shelf__entry-summary">{item.summary}</span>
                  </a>
                ))}
              </div>
            </section>
          ))}

          {uncollected.length > 0 ? (
            <>
              <GroupHeading>Everything else</GroupHeading>
              <CardGrid>
                {pager.rows.map((item) => (
                  <RoomCard
                    key={item.slug}
                    href={`/stories/${item.slug}`}
                    kind={KIND_LABELS[item.kind ?? 'chapter'] ?? 'Story'}
                    title={item.title}
                    description={item.summary}
                    meta={`${item.eraLabel} · ${item.placeLabel}`}
                  />
                ))}
              </CardGrid>
            </>
          ) : null}
        </>
      ) : (
        // Outside shelf mode (a search, a kind chip, a non-default sort applied) there is no
        // lead and no collection grouping to hold in place — just the current query's matches,
        // as one flat, directly comparable list. Same CardGrid/RoomCard the "Everything else"
        // list above uses, so narrowed results and the shelf remainder read as one visual system.
        <CardGrid>
          {pager.rows.map((item) => (
            <RoomCard
              key={item.slug}
              href={`/stories/${item.slug}`}
              kind={KIND_LABELS[item.kind ?? 'chapter'] ?? 'Story'}
              title={item.title}
              description={item.summary}
              meta={`${item.eraLabel} · ${item.placeLabel}`}
            />
          ))}
        </CardGrid>
      )}

      {pager.pageCount > 1 ? (
        <nav className="ds-chapters-pager" aria-label="Stories pages">
          {pager.previousHref === undefined ? (
            <span className="ds-chapters-pager__spacer" />
          ) : (
            <a className="ds-chapters-pager__link" href={pager.previousHref} rel="prev">
              ← Previous {RECORDS_PAGE_SIZE}
            </a>
          )}
          <span className="ds-chapters-pager__at">{`Page ${pager.page} of ${pager.pageCount}`}</span>
          {pager.nextHref === undefined ? (
            <span className="ds-chapters-pager__spacer" />
          ) : (
            <a className="ds-chapters-pager__link" href={pager.nextHref} rel="next">
              Next {RECORDS_PAGE_SIZE} →
            </a>
          )}
        </nav>
      ) : null}

      <WalkOffRamp>
        This is the national archive of chapters. A record names Stories only when it already
        cites one.
      </WalkOffRamp>
    </Room>
  );
}
