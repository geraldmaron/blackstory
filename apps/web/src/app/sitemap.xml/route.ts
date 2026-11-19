/**
 * `GET /sitemap.xml` — registry routes, published story URLs and active-release record URLs, CDN-cached.
 *
 * Must not statically generate at build: App Hosting mounts DATABASE_URL at runtime only, and a
 * baked sitemap would ship the 4-entity seed plus localhost. Being dynamic does not stop the
 * CDN from caching it: a route handler keeps `Cache-Control`, which is the same reason the
 * Explore catalog moved off `/`. Uses the thin search index, not the hydrated entity catalog.
 */
import { getPublicActiveReleaseMeta, getPublicSearchIndex } from '../../lib/public-data/source';
import { shouldUseLivePublicProjections } from '../../lib/public-data/live-policy';
import { listPublicStoryListItems } from '../../lib/stories/source';
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
  const [{ data: index }, release, { items: stories }] = await Promise.all([
    getPublicSearchIndex(),
    getPublicActiveReleaseMeta(),
    listPublicStoryListItems(),
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
        ...(story.publishedAt !== undefined ? { publishedAt: story.publishedAt } : {}),
        ...(story.updatedAt !== undefined ? { updatedAt: story.updatedAt } : {}),
      })),
      ...(release ? { releaseGeneratedAt: release.activatedAt } : {}),
    }),
  );

  return new Response(xml, {
    status: 200,
    headers: sitemapHeaders(),
  });
}
