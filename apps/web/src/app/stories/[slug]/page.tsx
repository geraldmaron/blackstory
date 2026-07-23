/**
 * Longform story article page at `/stories/{slug}`.
 *
 * v6 edition Surface stack with shared gutter mosaic atmosphere. Editorial serif
 * body, required Sources footnote, related entity off-ramps, and a copper map CTA
 * when a related entity has a geo anchor. Story bodies load from the public release
 * projection. Emits schema.org Article JSON-LD only, never ClaimReview.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertNeverClaimReview } from '@repo/domain';
import { EditionAtmosphereMosaic } from '../../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import {
  EDITION_MOSAIC_COUNT_DETAIL,
} from '../../../components/patterns/edition-atmosphere/edition-atmosphere-config';
import { renderStoryTitle } from '../../../components/atmosphere/story-title';
import { SourceFootnote } from '../../../components/data/SourceFootnote';
import type { PublicEntityView } from '../../../data/public-seed';
import {
  listPublicEntityViewsByIds,
  listPublicStoryListItems,
  resolvePublicStoryView,
  type PublicStoryView,
} from '../../../lib/public-data/source';
import { geoAnchorFor } from '../../../lib/map-experience/entity-geo';
import {
  buildExploreHref,
  defaultExploreOverlayState,
} from '../../../lib/map-experience/url-state';
import {
  STORIES_EDITION_MOSAIC_SEED,
  storiesEditionPanelClassName,
  storiesEditionRootClassName,
  storiesEditionStackClassName,
} from '../stories-panel-chrome';
import '../stories-edition.css';

type StoryPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  const { data: stories } = await listPublicStoryListItems();
  return stories.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: StoryPageProps) {
  const { slug } = await params;
  const result = await resolvePublicStoryView(slug);
  const story = result.data;
  if (!story) return { title: 'Story not found' };
  return {
    title: story.title,
    description: story.dek,
    alternates: { canonical: `/stories/${story.slug}` },
  };
}

function buildStoryArticleJsonLd(story: PublicStoryView) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: story.title,
    description: story.dek,
    datePublished: story.publishedAt,
    '@id': `/stories/${story.slug}`,
    author: { '@type': 'Organization', name: 'BlackStory' },
  };
  assertNeverClaimReview(jsonLd);
  return jsonLd;
}

function resolveMapAnchor(entity: PublicEntityView) {
  return entity.geoAnchor ?? geoAnchorFor(entity.id);
}

function mapCtaForRelatedEntities(entities: readonly PublicEntityView[]): {
  readonly href: string;
  readonly label: string;
} | null {
  for (const entity of entities) {
    const geoAnchor = resolveMapAnchor(entity);
    if (!geoAnchor) continue;
    const href = buildExploreHref({
      filters: { era: 'all', kind: 'all', tone: 'all', theme: 'all', status: 'all', confidence: 'all' },
      ...defaultExploreOverlayState(),
      selected: entity.id,
      viewport: { lat: geoAnchor.lat, lng: geoAnchor.lng, zoom: 11 },
    });
    return { href, label: 'View on map' };
  }
  return null;
}

export default async function StoryDetailPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const storyResult = await resolvePublicStoryView(slug);
  const story = storyResult.data;
  if (!story) notFound();

  const { data: relatedEntities } = await listPublicEntityViewsByIds(story.relatedEntityIds);
  const mapCta = mapCtaForRelatedEntities(relatedEntities);
  const jsonLd = buildStoryArticleJsonLd(story);

  return (
    <div className={storiesEditionRootClassName()} data-stories-edition="v6">
      <EditionAtmosphereMosaic seedKey={`${STORIES_EDITION_MOSAIC_SEED}:${story.slug}`} count={EDITION_MOSAIC_COUNT_DETAIL} />
      <main className="ds-container ds-page" id="main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className={storiesEditionStackClassName()}>
          <article className={storiesEditionPanelClassName('intro')}>
            <header className="ds-stories-edition__header">
              <span className="ds-stories-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-stories-edition__kicker">Story</p>
                <p className="ds-stories-edition__meta-row">
                  <span className="ds-mono">{story.eraLabel}</span> · {story.placeLabel}
                </p>
                <h1 className="ds-stories-edition__title">
                  {renderStoryTitle(story.slug, story.title)}
                </h1>
                <p className="ds-stories-edition__lede">{story.dek}</p>
                <p className="ds-stories-edition__meta">Published {story.publishedAt}</p>
                {mapCta ? (
                  <p className="ds-stories-edition__actions">
                    <Link className="ds-cta ds-cta--copper" href={mapCta.href}>
                      {mapCta.label}
                    </Link>
                  </p>
                ) : null}
                <p className="ds-stories-edition__credit">
                  Archive mosaic · symbolic atmosphere, not a photograph of this story.{' '}
                  <Link href="/stories/mosaic-credits">Mosaic credits</Link>
                </p>
              </div>
            </header>
          </article>

          <article className={storiesEditionPanelClassName('body')}>
            <p className="ds-stories-edition__panel-title">Article</p>
            <div className="ds-stories-edition__body ds-prose">
              {story.body.map((section, index) => (
                <section
                  key={section.heading ?? `section-${index}`}
                  className="ds-stories-edition__section"
                >
                  {section.heading ? (
                    <h2 className="ds-stories-edition__section-title">{section.heading}</h2>
                  ) : null}
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)} className="ds-stories-edition__p">
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </article>

          {relatedEntities.length > 0 ? (
            <article
              className={storiesEditionPanelClassName('records')}
              aria-labelledby="story-entities-heading"
            >
              <p className="ds-stories-edition__panel-title">Records</p>
              <h2 className="ds-stories-edition__panel-heading" id="story-entities-heading">
                Related entities
              </h2>
              <ul className="ds-story-rail">
                {relatedEntities.map((entity) => (
                  <li key={entity.id}>
                    <Link className="ds-story-link" href={`/entity/${entity.id}`} prefetch>
                      <span className="ds-story-link__meta">{entity.kind}</span>
                      <h3 className="ds-story-link__title">{entity.displayName}</h3>
                      <p className="ds-story-link__summary">{entity.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          <article
            className={storiesEditionPanelClassName('sources')}
            aria-labelledby="story-sources-heading"
          >
            <p className="ds-stories-edition__panel-title">Evidence</p>
            <h2 className="ds-stories-edition__panel-heading" id="story-sources-heading">
              Sources
            </h2>
            <div className="ds-stories-edition__sources">
              <SourceFootnote sources={story.sources} density="group" />
            </div>
          </article>

          <p className="ds-stories-edition__footer">
            <Link href="/stories">All stories</Link>
            {' · '}
            <Link href="/stories/mosaic-credits">Archive mosaic credits</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
