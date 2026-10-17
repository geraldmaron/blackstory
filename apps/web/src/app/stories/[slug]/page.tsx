/**
 * Story detail page at `/stories/[slug]` (chapters and short entries alike). The publication
 * layout: title → hero image → summary → body (prose with inline citations, figures, stat
 * callouts, primary documents, timelines, map insets, disputes) → numbered
 * references. Emits schema.org Story JSON-LD only.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertNeverClaimReview } from '@repo/domain';
import { StoryBody } from '../../../components/story/StoryBody';
import { StoryHeroPhoto } from '../../../components/story/StoryHeroPhoto';
import { StoryReferences } from '../../../components/story/StoryReferences';
import type { HydratedStory } from '../../../lib/stories/hydrate';
import { extractChapterHeadings } from '../../../lib/stories/heading-anchors';
import {
  resolveStory,
  listPublishedStorySlugs,
  listPublicStoryListItems,
} from '../../../lib/stories/source';
import { nextInCollection, prevInCollection } from '../stories-index';
import { Note, RecordNav, Room } from '../../../components/room';
import type { RecordNavTarget } from '../../../components/room';
import { storyCitedEntities } from '../../../lib/release/build-cites-edge';
import { listPublicEntityViewsByIds } from '../../../lib/public-data/source';
import '../../reading-room.css';
import '../../../components/story/story.css';
import '../../../components/theme-spine/theme-spine.css';
import '../../../components/theme-impact/theme-impact.css';

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
    author: doc.contributors
      .filter((c) => c.roles.includes('author'))
      .map((c) => ({ '@type': c.kind === 'person' ? 'Person' : 'Organization', name: c.name })),
    ...(doc.heroImage ? { image: doc.heroImage.url } : {}),
  };
  assertNeverClaimReview(jsonLd);
  return jsonLd;
}

export default async function StoryDetailPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const result = await resolveStory(slug);

  if (result.source === 'unavailable') {
    return (
      <Room>
        <Note kind="Unavailable">
          This story is temporarily unavailable while we reconnect to the live record.{' '}
          <Link href="/stories">Back to all stories</Link>.
        </Note>
      </Room>
    );
  }

  if (!result.story) notFound();
  const story = result.story;
  const { doc } = story;
  const jsonLd = buildStoryJsonLd(story);
  // No nonce on JSON-LD: CSP script-src governs script EXECUTION, and a <script> with a
  // non-JavaScript type is never executed, so it is not a script block the policy applies to.
  // These tags must carry the request nonce to render under the nonce-gated CSP.
  // no nonce, full content, and zero CSP violations. Passing one here also broke hydration —
  // React does not send the nonce to the client, so the server rendered nonce="..." against a
  // client nonce="" and reported a mismatch it "won't patch up" on every trust surface.

  // The word this page uses for itself in its own copy: a long-form piece is a "chapter", a
  // short one is an "entry" — never "record" (that collides with the unrelated `/records`
  // archive index) and never "chapter" for both (that collides with `/stories`' own kind
  // filter, which uses "Chapter" to mean this kind specifically). See stories-index.ts.
  const noun = doc.format === 'entry' ? 'entry' : 'chapter';

  const chapterHeadings = extractChapterHeadings(story.blocks);

  // "Next in this collection" only needs the rest of the release's list items — the same
  // read `/stories` already does, cached per request, not a new query.
  // One read of the release's list items serves both directions; `/stories` already does it and
  // it is cached per request.
  const collectionItems = doc.collection ? (await listPublicStoryListItems()).items : [];
  const next = doc.collection
    ? nextInCollection(collectionItems, doc.collection.id, doc.collection.position)
    : undefined;
  const previous = doc.collection
    ? prevInCollection(collectionItems, doc.collection.id, doc.collection.position)
    : undefined;

  /*
   * "The records behind this <noun>" — the story side of the story-cites-record edge (SP-20).
   *
   * The ids come from `storyCitedEntities`, the same derivation the record side reads in
   * reverse, so a record that lists this story and a story that lists this record can never
   * disagree. Names are resolved through `listPublicEntityViewsByIds`, which fetches exactly
   * these ids rather than loading the catalog to read a handful of display names.
   *
   * Rendered as real links to each record rather than as one deep link into the Atlas. The
   * design law calls this "handing a named collection to the Atlas", but `EXPLORE_URL_PARAM_KEYS`
   * has no multi-id or collection param — `selected` carries one id — so a named collection is
   * not representable in an Explore URL today. A list of real record links is the same handoff
   * the reader needs and states nothing the URL vocabulary cannot back.
   */
  const citedIds = [...storyCitedEntities(doc).keys()];
  const citedRecords = citedIds.length > 0 ? (await listPublicEntityViewsByIds(citedIds)).data : [];

  // Ink spec §4 (/stories/[slug]): the sticky right rail carries "In this chapter/entry", the
  // reference list and "Next in this collection". The references list itself, its numbering and
  // its `#ref-N` anchor ids are unchanged (StoryProse's citation superscripts link to those ids
  // regardless of where in the document the list renders) — only its position moves.
  const hasRailContent = chapterHeadings.length > 0 || next;
  const rail = hasRailContent ? (
    <div className="ds-reading-rail">
      {chapterHeadings.length > 0 ? (
        <nav className="ds-room-rail-group" aria-labelledby="story-toc">
          <p className="ds-room-rail-group__title" id="story-toc">
            In this {noun}
          </p>
          <ul className="ds-room-rail-group__list">
            {chapterHeadings.map((heading) => (
              <li key={heading.id}>
                <a className="ds-room-rail-group__link" href={`#${heading.id}`}>
                  <span className="ds-room-rail-group__label">{heading.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {next ? (
        <div className="ds-reading-rail__next">
          <p className="ds-room-rail-group__title">Next in this collection</p>
          <a className="ds-reading-rail__next-link" href={`/stories/${next.slug}`}>
            {next.collection?.positionLabel ? (
              <span className="ds-mono ds-reading-rail__next-position">
                {next.collection.positionLabel}
              </span>
            ) : null}
            <span className="ds-reading-rail__next-title">{next.title}</span>
          </a>
        </div>
      ) : null}
    </div>
  ) : undefined;

  /*
   * The piece opens on its image, in its own centred band with the title below it, on the same
   * masthead the record page uses. A piece with no hero keeps the same block on the canvas: the
   * type is the masthead in that case.
   */
  const masthead = (
    <figure className="ds-reading-mast" data-media={doc.heroImage ? 'photo' : 'none'}>
      {doc.heroImage ? <StoryHeroPhoto url={doc.heroImage.url} alt={doc.heroImage.alt} /> : null}
      <figcaption className="ds-reading-mast__over">
        <p className="ds-reading-mast__facts">
          {doc.collection?.label ? (
            <Link
              className="ds-reading-mast__series"
              href={`/stories?collection=${encodeURIComponent(doc.collection.id)}`}
            >
              {doc.collection.label}
            </Link>
          ) : null}
          {doc.collection?.positionLabel ? (
            <span className="ds-mono">{doc.collection.positionLabel}</span>
          ) : null}
          <span className="ds-mono">{doc.eraLabel}</span>
          <span>{doc.placeLabel}</span>
        </p>
        <h1 className="ds-reading-mast__title">{doc.title}</h1>
        <p className="ds-reading-mast__lede">{doc.summary}</p>
        <p className="ds-reading-mast__byline">
          <span>
            {doc.contributors.length
              ? doc.contributors.map((credit, index) => (
                  <span key={credit.id}>
                    {index > 0 ? '; ' : ''}
                    {credit.name} ({credit.roles.join(', ')}
                    {credit.kind === 'editorial' ? ', house editorial identity' : ''})
                  </span>
                ))
              : 'Contributor credits not recorded'}
          </span>
          <span>
            Published <span className="ds-mono">{doc.publishedAt}</span>
          </span>
          {doc.updatedAt ? (
            <span>
              Updated <span className="ds-mono">{doc.updatedAt}</span>
            </span>
          ) : null}
          {story.references.length > 0 ? (
            <span>
              Cites <a href="#about-this-chapter">{story.references.length} records</a>
            </span>
          ) : null}
        </p>
        {/* Inside the overlay, not beside it. The overlay is the element carrying the scrim, so
            a credit rendered as its sibling sat on bare photograph: subtle-ink text on a bright
            parchment scan, and a strip of un-dimmed image below the byline. It is hero text like
            the rest and belongs on the same ground. */}
        {doc.heroImage?.credit ? (
          <span className="ds-reading-mast__credit ds-mono">{doc.heroImage.credit}</span>
        ) : null}
      </figcaption>
    </figure>
  );

  /*
   * The apparatus band. Every numbered mark in the text resolves here, under the piece rather
   * than beside its third paragraph: a reader checking a citation has finished the sentence, and
   * a reader who is not checking one should not be reading past a column of them.
   */
  const navPrevious: RecordNavTarget | undefined = previous
    ? { href: `/stories/${previous.slug}`, label: previous.title }
    : undefined;
  const navNext: RecordNavTarget | undefined = next
    ? { href: `/stories/${next.slug}`, label: next.title }
    : undefined;

  const recordsBehind =
    citedRecords.length > 0 ? (
      <section className="ds-reading-appx__records" aria-labelledby="records-behind">
        <h3 id="records-behind">The records behind this {noun}</h3>
        <p>
          Every record this {noun} draws on, as the archive holds it. Open one to read its evidence,
          or find it on the Atlas from there.
        </p>
        <ul className="ds-reading-appx__record-list">
          {citedRecords.map((record) => (
            <li key={record.id}>
              <Link href={`/entity/${record.id}`}>{record.displayName}</Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  const apparatus =
    story.references.length > 0 || recordsBehind || navPrevious || navNext ? (
      <div className="ds-reading-appx" id="about-this-chapter">
        <div className="ds-reading-appx__head">
          <h2>About this {noun}</h2>
          <span>Every numbered mark in the text resolves here.</span>
        </div>
        <div className="ds-reading-appx__cols">
          <div>
            {story.references.length > 0 ? (
              <StoryReferences references={story.references} headingId="about-this-chapter" />
            ) : null}
            {recordsBehind}
          </div>
          <div className="ds-reading-appx__notes">
            <section>
              <h3>How this {noun} was made</h3>
              <p>
                Written from released records only. Where two sources disagree the contradiction is
                shown rather than resolved.
              </p>
            </section>
            <section>
              <h3>Found a problem?</h3>
              <p>
                <Link href="/corrections">Submit a correction</Link> against any record cited above.
              </p>
            </section>
          </div>
        </div>
        {/* Prev and next close the foot, after the apparatus: a reader who has finished the
            piece is choosing where to go, and that choice belongs under the sources rather
            than beside the third paragraph. The rail's "Next in this collection" is the
            reading cue mid-scroll; this is the pair. */}
        <RecordNav
          {...(navPrevious ? { previous: navPrevious } : {})}
          {...(navNext ? { next: navNext } : {})}
        />
      </div>
    ) : undefined;

  return (
    <Room rail={rail} masthead={masthead} {...(apparatus ? { foot: apparatus } : {})}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <article className="ds-reading">
        <StoryBody story={story} />

        <p className="ds-reading__footer">
          <Link href="/stories">All stories</Link>
        </p>
      </article>
    </Room>
  );
}
