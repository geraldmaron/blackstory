/**
 * Stories index at `/stories`: the single long-form publication surface. A story is one
 * published piece, and `kind` says under which editorial contract — `chapter` for the
 * era-immersion long-forms, `article` for short entries (a paragraph of context plus
 * individually cited call-outs, published in ordered collections).
 *
 * Both kinds share this index on purpose. A reader looking for what the archive says
 * about a subject should not have to know which contract the answer was written under.
 * Bare `/stories` shows every published Story.
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
  DocumentColophon,
  FindBar,
  GroupHeading,
  Note,
  OrientationInstrument,
  ReadingEntry,
  Room,
  RoomCard,
} from '../../components/room';
import {
  buildCollectionGroups,
  buildCollectionShelves,
  buildEraGroups,
  buildKindChips,
  computeStoriesFacts,
  filterItems,
  paginateStories,
  parseStoriesQuery,
  pickLeadStory,
  showsShelves,
  sortItems,
  storiesHref,
  storiesNotice,
  uncollectedItems,
  STORY_SORT_KEYS,
  STORY_SORT_LABELS,
} from './stories-index';
import '../reading-room.css';
import './stories.css';
import { formatResultSummary } from '../../lib/discovery/result-summary';

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
 * The lead only renders in the default browse state — `showsShelves` requires the collection
 * sort — so the flag is always "Start here" and never "newest" or "title", since those sorts
 * do not show the lead.
 */
const LEAD_FLAG = 'Start here';

export default async function StoriesIndexPage({ searchParams }: StoriesPageProps) {
  const query = parseStoriesQuery(await searchParams);
  const { items, source } = await listPublicArticleListItems();
  const { publishedCount, eraSpanLabel, placeLabel } = computeStoriesFacts(items);
  const filtered = sortItems(filterItems(items, query), query.sort);
  const notice = storiesNotice(source, items.length, filtered.length);
  const kindChips = buildKindChips(items, query);
  // Kind shows as the current chip. Everything else that narrows the list gets a removable chip,
  // because a collection or era arrives from the rail or a shared link and was invisible here.
  const readable = (value: string) => value.replace(/[-_]+/g, ' ');
  const activeConstraints = (
    [
      ['q', query.q, `Search: ${query.q}`],
      ['collection', query.collection, `Collection: ${readable(query.collection)}`],
      ['tag', query.tag, `Tag: ${readable(query.tag)}`],
      ['era', query.era, `Period: ${query.era}`],
      ['place', query.place, `Place: ${readable(query.place)}`],
    ] as const
  )
    .filter(([, value]) => value.length > 0)
    .map(([key, , label]) => ({ key, label, href: storiesHref({ ...query, [key]: '', page: 1 }) }));
  const collectionGroups = buildCollectionGroups(items);

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
    placeLabel,
  ];

  const leadCollection = collectionGroups[0];
  const leadEra = buildEraGroups(items)[0];
  const rail =
    source === 'live' && items.length > 0 ? (
      <OrientationInstrument
        where="Writing built from the record"
        {...(query.era.length > 0
          ? { eraBand: query.era }
          : leadEra
            ? { eraBand: leadEra.label }
            : {})}
        moves={[
          ...(leadCollection
            ? [
                {
                  label: leadCollection.label,
                  href: leadCollection.href,
                  ...(leadCollection.count !== undefined
                    ? { note: `${leadCollection.count.toLocaleString('en-US')} stories` }
                    : {}),
                },
              ]
            : []),
          ...(leadEra
            ? [
                {
                  label: `Period: ${leadEra.label}`,
                  href: leadEra.href,
                  ...(leadEra.count !== undefined
                    ? { note: `${leadEra.count.toLocaleString('en-US')} stories` }
                    : {}),
                },
              ]
            : []),
          {
            label: 'Open the memorial',
            href: '/memorial',
            note: 'Names at full scale',
          },
        ].slice(0, 3)}
      />
    ) : undefined;

  return (
    <Room ledger rail={rail}>
      <ReadingEntry
        pathname="/stories"
        title={
          <>
            Start with a year and a <em>place</em>.
          </>
        }
        lede="Long-form chapters that walk from a named year and place through the rules in force, and shorter entries that set out what a given administration actually did. Every story names the records it stands on."
        showCrumb={false}
      />
      <DocumentColophon facts={meta} />

      {source === 'live' && items.length > 0 ? (
        <FindBar
          id="stories"
          action="/stories"
          queryLabel="Search stories"
          placeholder="Search by title, subject or collection"
          query={query.q}
          /* Narrowing already in the URL rides along, so submitting the search box refines the
             current view instead of silently resetting it. Defaults stay out of the URL. */
          preserved={{
            kind: query.kind,
            collection: query.collection,
            tag: query.tag,
            era: query.era,
            place: query.place,
            sort: query.sort !== 'collection' ? query.sort : undefined,
          }}
          active={activeConstraints}
          clearHref="/stories"
          rows={[
            {
              label: 'Filter by kind',
              chips: kindChips.map((chip) => ({
                label: chip.label,
                href: chip.href,
                active: chip.active,
                count: chip.count,
              })),
            },
          ]}
          sort={STORY_SORT_KEYS.map((key) => ({
            label: STORY_SORT_LABELS[key],
            href: storiesHref({ ...query, sort: key, page: 1 }),
            active: query.sort === key,
          }))}
          summary={formatResultSummary({
            matched: filtered.length,
            total: items.length,
            singular: 'story',
            plural: 'stories',
          })}
        />
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
                <p className="ds-stories-lead__flag">{LEAD_FLAG}</p>
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
                    {item.heroImage ? (
                      <span className="ds-stories-shelf__plate">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.heroImage.url} alt={item.heroImage.alt} loading="lazy" />
                      </span>
                    ) : null}
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
                    icon="stories"
                    {...(item.heroImage
                      ? { media: { ...item.heroImage, fit: 'contain' as const } }
                      : {})}
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
              icon="stories"
              {...(item.heroImage ? { media: { ...item.heroImage, fit: 'contain' as const } } : {})}
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
        This is the national archive of chapters. A record names Stories only when it already cites
        one.
      </WalkOffRamp>
    </Room>
  );
}
