/**
 * Story page at `/stories/[slug]`, chapters and entries alike, on one frame:
 *
 *   masthead (on the reading measure) → hero image (chapters, wide track)
 *   section spine (sticky, left of the column on wide screens; a Contents bar and sheet below)
 *   body: prose on the 680px measure, every artifact open on the 964px track
 *   end block: where to read next, then the records the story links to
 *   sources: a plain numbered list
 *
 * Entries use the same frame with a short masthead: the portrait beside the title, no hero band.
 * Emits schema.org Article JSON-LD only.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertNeverClaimReview } from '@repo/domain';
import { Notice } from '@repo/ui';
import { Room } from '../../../components/room';
import { StoryBody } from '../../../components/story/StoryBody';
import { StoryEnd } from '../../../components/story/StoryEnd';
import { StoryFigure } from '../../../components/story/StoryFigure';
import { StoryImage } from '../../../components/story/StoryImage';
import { StoryReferences } from '../../../components/story/StoryReferences';
import { StoryRecords } from '../../../components/story/story-records';
import { StorySpine } from '../../../components/story/StorySpine';
import { storyImageSrc } from '../../../components/story/story-image';
import { splitLede } from '../../../components/story/story-text';
import type { HydratedStory } from '../../../lib/stories/hydrate';
import { extractChapterHeadings } from '../../../lib/stories/heading-anchors';
import {
  resolveStory,
  listPublishedStorySlugs,
  listPublicStoryListItems,
} from '../../../lib/stories/source';
import { nextInCollection, prevInCollection, sortItems } from '../stories-index';
import { storyCitedEntities } from '../../../lib/release/build-cites-edge';
import { listPublicEntityViewsByIds } from '../../../lib/public-data/source';
import { IMPLICIT_AUTHOR_NAME, storyBylineLines } from '../../../lib/stories/byline';
import '../../../components/story/story.css';

type StoryPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await listPublishedStorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: StoryPageProps) {
  const { slug } = await params;
  const result = await resolveStory(slug);
  if (!result.story) return { title: 'Story not found' };
  const { doc } = result.story;
  return {
    title: doc.title,
    description: doc.summary,
    alternates: { canonical: `/stories/${doc.slug}` },
  };
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
    '@id': `/stories/${doc.slug}`,
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

export default async function StoryDetailPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const result = await resolveStory(slug);

  if (result.source === 'unavailable') {
    return (
      <Room width="read" className="ds-story">
        <Notice tone="warning" title="This story is unavailable">
          The live record could not be reached, so this story cannot be shown right now. Reload to
          try again, or <Link href="/stories">go back to all stories</Link>.
        </Notice>
      </Room>
    );
  }

  if (!result.story) notFound();
  const story = result.story;
  const { doc } = story;
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

  const facts = [
    collection ? (
      <Link
        key="collection"
        className="ds-story-mast__series"
        href={`/stories?collection=${encodeURIComponent(collection.id)}`}
      >
        {collection.label}
      </Link>
    ) : null,
    collection?.positionLabel ? <span key="position">{collection.positionLabel}</span> : null,
    <span key="era" className="ds-story-mast__years">
      {doc.eraLabel}
    </span>,
    isEntry ? null : <span key="place">{doc.placeLabel}</span>,
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
            <p className="ds-story-mast__facts">{facts}</p>
            <h1 className="ds-story-mast__title">{doc.title}</h1>
            <p className="ds-story-mast__dek">{lede.dek}</p>
            {lede.rest ? <p className="ds-story-mast__rest">{lede.rest}</p> : null}
            <p className="ds-story-mast__byline">
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
              {hasSources ? (
                <span>
                  <a href="#sources">
                    {story.references.length} {story.references.length === 1 ? 'source' : 'sources'}
                  </a>
                </span>
              ) : null}
              <span>
                <Link href="/corrections">Report an error</Link>
              </span>
            </p>
          </div>
          {hero && isEntry ? (
            <figure className="ds-story-mast__portrait">
              <StoryImage
                src={storyImageSrc(hero.url, 200, hero.width)}
                fallbackSrc={hero.url}
                alt={hero.alt}
                {...(hero.width ? { width: hero.width } : {})}
                {...(hero.height ? { height: hero.height } : {})}
                eager
              />
              <figcaption className="ds-story-caption">
                <span className="ds-story-caption__credit">{hero.credit}</span>
              </figcaption>
            </figure>
          ) : null}
          {hero && !isEntry ? (
            <StoryFigure className="ds-story-mast__hero" image={hero} eager />
          ) : null}
        </header>

        <StorySpine headings={headings} {...(hasSources ? { sourcesHref: '#sources' } : {})} />

        <div className="ds-story__main">
          <StoryBody story={story} />

          <div className="ds-story-body">
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

            {hasSources ? (
              <section className="ds-story-sources-block" id="sources">
                <h2 className="ds-section-heading ds-story-end__heading" id="sources-heading">
                  Sources
                </h2>
                <StoryReferences references={story.references} headingId="sources-heading" />
              </section>
            ) : null}
          </div>
        </div>
      </article>
    </Room>
  );
}
