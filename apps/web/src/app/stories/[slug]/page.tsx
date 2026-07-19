/**
 * Longform story article page at `/stories/{slug}`.
 *
 * Atmosphere mast (rights-cleared mosaic or geometric fallback), editorial serif
 * body, related entity/fact off-ramps, and a single copper map CTA when a related
 * entity has a geo anchor. Emits schema.org Article JSON-LD only — never ClaimReview.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertNeverClaimReview } from '@repo/domain';
import { AtmospherePlane, selectAtmospherePlane } from '../../../components/atmosphere';
import { renderStoryTitle } from '../../../components/atmosphere/story-title';
import { getPublicEntity } from '../../../data/public-seed';
import { getSeedFact } from '../../../data/facts-seed';
import { getSeedStory, listSeedStories, type StoryRecord } from '../../../data/stories-seed';
import { geoAnchorFor } from '../../../lib/map-experience/entity-geo';
import {
  buildExploreHref,
  defaultExploreOverlayState,
} from '../../../lib/map-experience/url-state';
import { factPageHref } from '../../facts/facts-view-model';
import './../stories.css';

type StoryPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  return listSeedStories().map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = getSeedStory(slug);
  if (!story) return { title: 'Story not found' };
  return {
    title: story.title,
    description: story.dek,
    alternates: { canonical: `/stories/${story.slug}` },
  };
}

function buildStoryArticleJsonLd(story: StoryRecord) {
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

function mapCtaForStory(relatedEntityIds: readonly string[]): {
  readonly href: string;
  readonly label: string;
} | null {
  for (const entityId of relatedEntityIds) {
    const geoAnchor = geoAnchorFor(entityId);
    if (!geoAnchor) continue;
    const href = buildExploreHref({
      filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
      ...defaultExploreOverlayState(),
      selected: entityId,
      viewport: { lat: geoAnchor.lat, lng: geoAnchor.lng, zoom: 11 },
    });
    return { href, label: 'View on map' };
  }
  return null;
}

export default async function StoryDetailPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = getSeedStory(slug);
  if (!story) notFound();

  const relatedEntities = story.relatedEntityIds
    .map((id) => getPublicEntity(id))
    .filter((entity): entity is NonNullable<typeof entity> => entity !== undefined);
  const relatedFacts = story.relatedFactIds
    .map((id) => getSeedFact(id))
    .filter((fact): fact is NonNullable<typeof fact> => fact !== undefined);

  const atmosphere = selectAtmospherePlane({
    seedKey: story.slug,
    relatedEntityIds: story.relatedEntityIds,
  });
  const mapCta = mapCtaForStory(story.relatedEntityIds);
  const jsonLd = buildStoryArticleJsonLd(story);

  return (
    <main className="ds-page" id="main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="ds-story-mast">
        <AtmospherePlane selection={atmosphere} className="ds-story-mast__plane" />
        <div className="ds-container ds-story-mast__inner">
          <p className="ds-page__eyebrow">
            Story · <span className="ds-mono">{story.eraLabel}</span> · {story.placeLabel}
          </p>
          <h1 className="ds-page__title">{renderStoryTitle(story.slug, story.title)}</h1>
          <p className="ds-page__lede">{story.dek}</p>
          <p className="ds-mono ds-story-mast__meta">Published {story.publishedAt}</p>
          {mapCta ? (
            <p className="ds-story-mast__actions">
              <Link className="ds-cta ds-cta--copper" href={mapCta.href}>
                {mapCta.label}
              </Link>
            </p>
          ) : null}
          <p className="ds-story-mast__credit">
            Archive mosaic · symbolic atmosphere — not a photograph of this story.{' '}
            <Link href={atmosphere.attributionHref}>Mosaic credits</Link>
          </p>
        </div>
      </header>

      <article className="ds-container ds-story-article">
        <div className="ds-story-article__body ds-prose">
          {story.body.map((section, index) => (
            <section key={section.heading ?? `section-${index}`}>
              {section.heading ? (
                <h2 className="ds-section__title">{section.heading}</h2>
              ) : null}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ds-story-article__p">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        {relatedEntities.length > 0 ? (
          <section className="ds-section" aria-labelledby="story-entities-heading">
            <p className="ds-section__kicker">Records</p>
            <h2 className="ds-section__title" id="story-entities-heading">
              Related entities
            </h2>
            <ul className="ds-story-rail">
              {relatedEntities.map((entity) => (
                <li key={entity.id}>
                  <Link className="ds-story-link" href={`/entity/${entity.id}`}>
                    <span className="ds-story-link__meta">{entity.kind}</span>
                    <h3 className="ds-story-link__title">{entity.displayName}</h3>
                    <p className="ds-story-link__summary">{entity.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {relatedFacts.length > 0 ? (
          <section className="ds-section" aria-labelledby="story-facts-heading">
            <p className="ds-section__kicker">Evidence</p>
            <h2 className="ds-section__title" id="story-facts-heading">
              Related quick facts
            </h2>
            <ul className="ds-story-rail">
              {relatedFacts.map((fact) => (
                <li key={fact.id}>
                  <Link className="ds-story-link" href={factPageHref(fact.id, fact.slug)}>
                    <span className="ds-story-link__meta ds-mono">{fact.id}</span>
                    <h3 className="ds-story-link__title">{fact.shortStatement}</h3>
                    <p className="ds-story-link__summary">{fact.statement}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="ds-sans ds-story-article__footer">
          <Link href="/stories">All stories</Link>
          {' · '}
          <Link href="/stories/mosaic-credits">Archive mosaic credits</Link>
        </p>
      </article>
    </main>
  );
}
