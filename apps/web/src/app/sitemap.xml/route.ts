/**
 * `GET /sitemap.xml` — registry routes plus active-release record URLs, CDN-cached.
 *
 * Must not statically generate at build: App Hosting mounts DATABASE_URL at runtime only, and a
 * baked sitemap would ship the 4-entity seed plus localhost. Being dynamic does not stop the
 * CDN from caching it: a route handler keeps `Cache-Control`, which is the same reason the
 * Atlas catalog moved off `/`. Uses the thin search index, not the hydrated entity catalog.
 */
import { getPublicActiveReleaseMeta, getPublicSearchIndex } from '../../lib/public-data/source';
import { shouldUseLivePublicProjections } from '../../lib/public-data/live-policy';
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

  const [{ data: index }, release] = await Promise.all([
    getPublicSearchIndex(),
    getPublicActiveReleaseMeta(),
  ]);

  const xml = serializeSitemapXml(
    buildPublicSitemapEntries({
      entities: index.map((doc) => ({
        id: doc.id,
        displayName: doc.displayName,
        kind: doc.kind,
        ...(doc.summary !== undefined ? { summary: doc.summary } : {}),
      })),
      ...(release ? { releaseGeneratedAt: release.activatedAt } : {}),
    }),
  );

  return new Response(xml, {
    status: 200,
    headers: sitemapHeaders(),
  });
}
