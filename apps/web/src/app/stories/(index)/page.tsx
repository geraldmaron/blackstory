/**
 * Stories index at `/stories`: authored pieces with an argument, from era-spanning chapters to
 * single-subject features. Collections of uniform entries (the presidents) are not listed here;
 * they live at their own path.
 *
 * Bare `/stories` is a front on paper: the chapters, newest first and set large, each with its
 * cover as an exhibit when that cover is safe on a front page (`lib/stories/cover-safety.ts`) and
 * as text when it is not, then everything else as one ruled list under one toolbar. Any choice
 * in the toolbar (format, sort) or a narrowing that arrives by link (collection, era, tag, place,
 * an old `q`) turns the page into the flat list of what matches. Every control is a link, so a
 * view is bookmarkable and works with JavaScript off.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { listPublicStoryListItems } from '../../../lib/stories/source';
import { listedOnStories } from '../../../lib/stories/story-routes';
import { Chip, Notice, PageTitle, buttonClassName } from '@repo/ui';
import {
  buildStoriesFront,
  filterItems,
  hasActiveNarrowing,
  paginateStories,
  parseStoriesQuery,
  showsFront,
  sortItems,
  storiesHref,
  storiesNotice,
  STORY_SORT_KEYS,
  STORY_SORT_LABELS,
} from '../stories-index';
import { Room } from '../../../components/room';
import { ChapterCover, StoriesToolbar, StoryRow } from '../StoriesIndexParts';
import '../stories.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/stories',
  title: 'Stories',
  description:
    'Evidence-led long-form stories from the BlackStory archive: history pinned to place and record, with every figure and claim cited inline.',
});

type StoriesPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StoriesIndexPage({ searchParams }: StoriesPageProps) {
  const query = parseStoriesQuery(await searchParams);
  const all = await listPublicStoryListItems();
  const { source } = all;
  const items = all.items.filter(listedOnStories);
  const filtered = sortItems(filterItems(items, query), query.sort);
  const notice = storiesNotice(source, items.length, filtered.length);

  const front = source === 'live' && showsFront(query) ? buildStoriesFront(filtered) : undefined;
  const pager = paginateStories(front ? front.rest : filtered, query);

  // A collection arrives from a story's masthead by its id; echo it by the label readers saw.
  const collectionLabel =
    items.find((item) => item.collection?.id === query.collection)?.collection?.label ??
    query.collection.replace(/[-_]+/g, ' ');
  const echoes = (
    [
      ['q', query.q, `“${query.q}”`],
      ['collection', query.collection, collectionLabel],
      ['tag', query.tag, query.tag],
      ['era', query.era, query.era],
      ['place', query.place, query.place],
    ] as const
  )
    .filter(([, value]) => value.length > 0)
    .map(([key, , label]) => ({ key, label, href: storiesHref({ ...query, [key]: '', page: 1 }) }));

  const sort = STORY_SORT_KEYS.map((key) => ({
    key,
    label: STORY_SORT_LABELS[key],
    href: storiesHref({ ...query, sort: key, page: 1 }),
    current: query.sort === key,
  }));

  const toolbar = source === 'live' && items.length > 0 ? <StoriesToolbar sort={sort} /> : null;

  // The list's own head: what the list below holds, with its count as a sentence.
  const listed = front ? front.rest.length : filtered.length;
  const listTitle = front ? 'More stories' : 'Stories';
  const countLine = `${listed.toLocaleString('en-US')} ${listed === 1 ? 'story' : 'stories'}`;

  return (
    <Room width="wide" className="ds-stories">
      <PageTitle className="ds-stories-title">Stories</PageTitle>

      {front?.lead ? (
        <section className="ds-stories-covers" aria-label="Chapters">
          <ChapterCover item={front.lead} lead />
          {front.covers.map((item) => (
            <ChapterCover key={item.slug} item={item} />
          ))}
        </section>
      ) : null}

      {front && pager.rows.length === 0 ? null : (
        <section
          className="ds-stories-browse"
          data-first={front ? undefined : 'true'}
          aria-labelledby="stories-list-title"
        >
          <header className="ds-stories-head">
            <h2 className="ds-stories-head__title" id="stories-list-title">
              {listTitle}
            </h2>
            {source === 'unavailable' ? null : <p className="ds-stories-head__dek">{countLine}</p>}
          </header>
          {toolbar}
          {echoes.length > 0 ? (
            <div className="ds-stories-echoes">
              {echoes.map((echo) => (
                <Chip key={echo.key} href={echo.href} removable label={echo.label}>
                  {echo.label}
                </Chip>
              ))}
              {hasActiveNarrowing(query) ? (
                <a className="ds-stories-echoes__clear" href="/stories">
                  Clear all
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="ds-stories-paper">
            {notice.body.length > 0 ? (
              <div className="ds-stories-notice">
                <Notice tone={source === 'unavailable' ? 'warning' : 'note'} title={notice.title}>
                  {notice.body}
                </Notice>
                {source === 'live' && items.length > 0 ? (
                  <a className={buttonClassName('primary')} href="/stories">
                    Show all stories
                  </a>
                ) : null}
              </div>
            ) : (
              <ul className="ds-stories-list">
                {pager.rows.map((item) => (
                  <StoryRow key={item.slug} item={item} />
                ))}
              </ul>
            )}
          </div>

          {pager.pageCount > 1 ? (
            <nav className="ds-stories-pager" aria-label="Stories pages">
              {pager.previousHref === undefined ? (
                <span />
              ) : (
                <a className={buttonClassName('secondary')} href={pager.previousHref} rel="prev">
                  Previous
                </a>
              )}
              <span className="ds-stories-pager__at">{`Page ${pager.page} of ${pager.pageCount}`}</span>
              {pager.nextHref === undefined ? (
                <span />
              ) : (
                <a className={buttonClassName('secondary')} href={pager.nextHref} rel="next">
                  Next
                </a>
              )}
            </nav>
          ) : null}
        </section>
      )}
    </Room>
  );
}
