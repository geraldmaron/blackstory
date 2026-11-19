/**
 * The story page, rendered for `/stories/[slug]` and for a collection's own route
 * (`/presidents/[slug]`), chapters and entries alike, on one frame:
 *
 *   masthead on the ink table: display title, the opening year as a numeral, the dek, then a
 *     copper band of facts (years, place or office, sources, byline); chapters then show their
 *     hero image whole on the wide track
 *   section spine (sticky, left of the sheet on wide screens; a Contents bar and sheet below)
 *   the paper sheet: prose on the 680px measure, every artifact open on the wide track, section
 *     years as copper numerals, then the numbered sources, then the copper end block (where to
 *     read next, the records the story links to) across the sheet's foot
 *
 * Entries use the same frame with a short masthead: the portrait large beside the title.
 * Emits schema.org Article JSON-LD only.
 */
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { assertNeverClaimReview } from '@repo/domain';
import { DisplayNumeral, Notice, PageTitle, Sheet } from '@repo/ui';
import { Room } from '../room';
import { StoryBody } from './StoryBody';
import { StoryEnd } from './StoryEnd';
import { StoryFigure } from './StoryFigure';
import { StoryImage } from './StoryImage';
import { StoryReferences } from './StoryReferences';
import { StoryRecords } from './story-records';
import { StorySpine } from './StorySpine';
import { storyImageSrc } from './story-image';
import { firstYear, splitLede } from './story-text';
import type { HydratedStory } from '../../lib/stories/hydrate';
import { extractChapterHeadings } from '../../lib/stories/heading-anchors';
import { resolveStory, listPublicStoryListItems } from '../../lib/stories/source';
import { nextInCollection, prevInCollection, sortItems } from '../../app/stories/stories-index';
import { storyCitedEntities } from '../../lib/release/build-cites-edge';
import { listPublicEntityViewsByIds } from '../../lib/public-data/source';
import { IMPLICIT_AUTHOR_NAME, storyBylineLines } from '../../lib/stories/byline';
import { absolutePublicUrl } from '../../lib/seo/metadata-builders';
import { COLLECTION_ROUTES, storyBasePath, storyHref } from '../../lib/stories/story-routes';
import { BandRule } from '../atmosphere/BandArt';
import './story.css';

/** The route a page was requested on: `/stories`, or a collection's own path. */
export type StoryRouteBase = string;

/**
 * Metadata for a story at its canonical address. The canonical is always the story's own home,
 * so a crawler that reaches it through the other route still indexes one URL.
 */
export async function storyMetadata(slug: string) {
  const result = await resolveStory(slug);
  if (!result.story) return { title: 'Story not found' };
  const { doc } = result.story;
  return {
    title: doc.title,
    description: doc.summary,
    alternates: { canonical: storyHref(doc) },
  };
}

/** Slugs whose canonical home is `base`, for a route's `generateStaticParams`. */
export async function storySlugsUnder(base: StoryRouteBase): Promise<readonly string[]> {
  const { items } = await listPublicStoryListItems();
  return items.filter((item) => storyBasePath(item) === base).map((item) => item.slug);
}

function buildStoryJsonLd(story: HydratedStory) {
  const { doc } = story;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: doc.title,
    description: doc.summary,
    datePublished: doc.publishedAt,
    ...(doc.updatedAt ? { dateModified: doc.updatedAt } : {}),
    '@id': absolutePublicUrl(storyHref(doc)),
    url: absolutePublicUrl(storyHref(doc)),
    mainEntityOfPage: absolutePublicUrl(storyHref(doc)),
    ...(doc.collection
      ? { isPartOf: { '@type': 'CreativeWorkSeries', name: doc.collection.label } }
      : {}),
    author: doc.contributors.some((c) => c.roles.includes('author'))
      ? doc.contributors
          .filter((c) => c.roles.includes('author'))
          .map((c) => ({ '@type': c.kind === 'person' ? 'Person' : 'Organization', name: c.name }))
      : [{ '@type': 'Organization', name: IMPLICIT_AUTHOR_NAME }],
    ...(doc.heroImage ? { image: doc.heroImage.url } : {}),
  };
  assertNeverClaimReview(jsonLd);
  return jsonLd;
}

/** "2026-08-07" as "August 7, 2026". Anything unparseable is shown as stored. */
function formatDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
}

/**
 * One story page. `base` is the route it was requested on; a story whose home is elsewhere is
 * sent there: a president requested at `/stories/…` 308s to `/presidents/…`, and a chapter
 * requested under a collection route is not found there.
 */
export async function StoryDetail({
  slug,
  base,
}: {
  readonly slug: string;
  readonly base: StoryRouteBase;
}) {
  const result = await resolveStory(slug);

  if (result.source === 'unavailable') {
    return (
      <Room width="read" className="ds-story">
        <Sheet className="ds-story-unavailable">
          <Notice tone="warning" title="This story is unavailable">
            The live record could not be reached, so this story cannot be shown right now. Reload to
            try again, or <Link href={base}>go back to the list</Link>.
          </Notice>
        </Sheet>
      </Room>
    );
  }

  if (!result.story) notFound();
  const story = result.story;
  const { doc } = story;
  const home = storyBasePath(doc);
  if (home !== base) {
    if (base === '/stories') permanentRedirect(storyHref(doc));
    notFound();
  }
  const jsonLd = buildStoryJsonLd(story);
  // No nonce on JSON-LD: CSP script-src governs script execution, and a non-JavaScript <script>
  // is never executed. Passing one also broke hydration (React does not send the nonce to the
  // client, so the server's nonce="..." mismatched the client's nonce="").

  // A long-form piece is a "chapter", a short one an "entry"; never "record", which is the
  // unrelated `/records` archive index.
  const noun = doc.format === 'entry' ? 'entry' : 'chapter';
  const isEntry = noun === 'entry';
  const headings = extractChapterHeadings(story.blocks);

  // One cached read of the release's list items serves next, previous and the other chapters.
  const items = (await listPublicStoryListItems()).items;
  const collection = doc.collection;
  const next = collection ? nextInCollection(items, collection.id, collection.position) : undefined;
  const previous = collection
    ? prevInCollection(items, collection.id, collection.position)
    : undefined;
  const members = collection
    ? sortItems(
        items.filter((item) => item.collection?.id === collection.id),
        'collection',
      )
    : [];
  const nextIndex = next ? members.findIndex((item) => item.slug === next.slug) : -1;
  const chapters = sortItems(
    items.filter((item) => (item.format ?? 'chapter') === 'chapter' && item.slug !== doc.slug),
    'newest',
  ).slice(0, 2);

  /*
   * "Records in this <noun>": the story side of the story-cites-record edge (SP-20). The
   * ids come from `storyCitedEntities`, the same derivation the record side reads in reverse, so
   * a record that lists this story and a story that lists this record never disagree. Names are
   * resolved through `listPublicEntityViewsByIds`, which fetches exactly these ids.
   */
  const linkedRecords = storyCitedEntities(doc);
  const citedRead =
    linkedRecords.size > 0
      ? await listPublicEntityViewsByIds([...linkedRecords.keys()]).catch(() => ({
          data: [],
          source: 'failed' as const,
        }))
      : { data: [], source: 'none' as const };

  const lede = splitLede(doc.summary);
  const hero = doc.heroImage;
  const hasSources = story.references.length > 0;

  const year = firstYear(doc.eraLabel);
  const facts = [
    collection ? (
      <Link
        key="collection"
        className="ds-story-mast__series"
        href={
          COLLECTION_ROUTES[collection.id] ??
          `/stories?collection=${encodeURIComponent(collection.id)}`
        }
      >
        {collection.label}
      </Link>
    ) : null,
    collection?.positionLabel ? <span key="position">{collection.positionLabel}</span> : null,
  ].filter(Boolean);

  return (
    <Room width="wide" className={`ds-story ds-story--${noun}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <article className="ds-story__frame">
        <header className="ds-story-mast" data-media={hero ? 'photo' : 'none'}>
          <div className="ds-story-mast__text">
            {facts.length > 0 ? <p className="ds-story-mast__facts">{facts}</p> : null}
            {/* An entry's year is its term in the copper band below; a numeral is never set beside
                a record's name (patterns-living-archive, Type roles). */}
            <PageTitle className="ds-story-mast__title">{doc.title}</PageTitle>
            <p className="ds-story-mast__dek">{lede.dek}</p>
            {lede.rest ? <p className="ds-story-mast__rest">{lede.rest}</p> : null}
            <BandRule motif="architecture" className="ds-story-mast__art" />
          </div>
          {year && !isEntry ? (
            <DisplayNumeral className="ds-story-mast__numeral" tone="soft" decorative>
              {year}
            </DisplayNumeral>
          ) : null}
          {hero && isEntry ? (
            <figure className="ds-plate ds-plate--upper ds-story-mast__portrait">
              <span className="ds-plate__tone">
                <StoryImage
                  className="ds-plate__img"
                  src={storyImageSrc(hero.url, 320, hero.width)}
                  fallbackSrc={hero.url}
                  alt={hero.alt}
                  {...(hero.width ? { width: hero.width } : {})}
                  {...(hero.height ? { height: hero.height } : {})}
                  eager
                />
              </span>
              <figcaption className="ds-plate__credit">{hero.credit}</figcaption>
            </figure>
          ) : null}
          <dl className="ds-story-mast__band" aria-label={`This ${noun}`}>
            <div>
              <dt>{isEntry ? 'Term' : 'Years'}</dt>
              <dd className="ds-story-mast__years">{doc.eraLabel}</dd>
            </div>
            {isEntry ? null : (
              <div>
                <dt>Place</dt>
                <dd>{doc.placeLabel}</dd>
              </div>
            )}
            {hasSources ? (
              <div>
                <dt>Sources</dt>
                <dd>
                  <a href="#sources">
                    {story.references.length} {story.references.length === 1 ? 'source' : 'sources'}
                  </a>
                </dd>
              </div>
            ) : null}
            <div className="ds-story-mast__byline">
              <dt>Written</dt>
              <dd>
                {storyBylineLines(doc.contributors).map((line) => (
                  <span key={line}>{line}</span>
                ))}
                <span>
                  <time dateTime={doc.publishedAt}>{formatDate(doc.publishedAt)}</time>
                </span>
                {doc.updatedAt ? (
                  <span>
                    Updated <time dateTime={doc.updatedAt}>{formatDate(doc.updatedAt)}</time>
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="ds-story-mast__report">
              <dt className="ds-visually-hidden">Corrections</dt>
              <dd>
                <Link href="/corrections">Report an error</Link>
              </dd>
            </div>
          </dl>
          {hero && !isEntry ? (
            <StoryFigure className="ds-story-mast__hero" image={hero} eager />
          ) : null}
        </header>

        <StorySpine headings={headings} {...(hasSources ? { sourcesHref: '#sources' } : {})} />

        <Sheet as="div" className="ds-story__main">
          <StoryBody story={story} numerals />

          <div className="ds-story-body">
            {hasSources ? (
              <section className="ds-story-sources-block" id="sources">
                <h2 className="ds-section-heading ds-story-end__heading" id="sources-heading">
                  Sources
                </h2>
                <StoryReferences references={story.references} headingId="sources-heading" />
              </section>
            ) : null}

            <StoryEnd
              next={next}
              previous={previous}
              collectionLabel={collection?.label}
              nextPosition={nextIndex >= 0 ? `${nextIndex + 1} of ${members.length}` : undefined}
              chapters={chapters}
              records={
                <StoryRecords
                  noun={noun}
                  slug={doc.slug}
                  linked={linkedRecords}
                  records={citedRead.data}
                  source={citedRead.source}
                />
              }
            />
          </div>
        </Sheet>
      </article>
    </Room>
  );
}
