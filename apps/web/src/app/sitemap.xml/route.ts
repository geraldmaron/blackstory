/**
 * `GET /sitemap.xml` — registry routes, figure pages, published story URLs and active-release
 * record URLs, CDN-cached.
 *
 * Must not statically generate at build: App Hosting mounts DATABASE_URL at runtime only, and a
 * baked sitemap would ship the 4-entity seed plus localhost. Being dynamic does not stop the
 * CDN from caching it: a route handler keeps `Cache-Control`, which is the same reason the
 * Explore catalog moved off `/`. Uses the thin search index, not the hydrated entity catalog.
 */
import { getPublicActiveReleaseMeta, getPublicSearchIndex } from '../../lib/public-data/source';
import { shouldUseLivePublicProjections } from '../../lib/public-data/live-policy';
import { listPublicStoryListItems } from '../../lib/stories/source';
import { storyHref } from '../../lib/stories/story-routes';
import { FIGURES, FIGURE_IDS, figurePagePath } from '../../components/data/figures/registry';
import {
  SITEMAP_CACHE_CONTROL,
  buildPublicSitemapEntries,
  serializeSitemapXml,
} from '../../lib/seo/sitemap-builders';

export const dynamic = 'force-dynamic';

function sitemapHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': SITEMAP_CACHE_CONTROL,
  };
}

export async function GET(): Promise<Response> {
  if (!shouldUseLivePublicProjections()) {
    return new Response(serializeSitemapXml([]), {
      status: 200,
      headers: sitemapHeaders(),
    });
  }

  // A failed story read degrades to no story URLs (the reader returns an empty list), never to a
  // failed sitemap: record URLs are the larger set and must not depend on the story table.
  // A figure with nothing to draw answers 404 on its own page, so it is not listed.
  const [{ data: index }, release, { items: stories }, figures] = await Promise.all([
    getPublicSearchIndex(),
    getPublicActiveReleaseMeta(),
    listPublicStoryListItems(),
    Promise.all(FIGURE_IDS.map((id) => FIGURES[id].load().catch(() => undefined))),
  ]);

  const xml = serializeSitemapXml(
    buildPublicSitemapEntries({
      entities: index.map((doc) => ({
        id: doc.id,
        displayName: doc.displayName,
        kind: doc.kind,
        ...(doc.summary !== undefined ? { summary: doc.summary } : {}),
      })),
      stories: stories.map((story) => ({
        slug: story.slug,
        path: storyHref(story),
        ...(story.publishedAt !== undefined ? { publishedAt: story.publishedAt } : {}),
        ...(story.updatedAt !== undefined ? { updatedAt: story.updatedAt } : {}),
      })),
      figures: FIGURE_IDS.filter((_, at) => figures[at] !== undefined).map(figurePagePath),
      ...(release ? { releaseGeneratedAt: release.activatedAt } : {}),
    }),
  );

  return new Response(xml, {
    status: 200,
    headers: sitemapHeaders(),
  });
}
