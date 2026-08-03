/**
 * sitemap route prefers the thin public search index (same id set as entity GSP)
 * and falls back to the bundled seed snapshot when live projections are unavailable.
 * Avoids full entity-catalog hydration just to emit `/entity/{id}` URLs.
 *
 * Must stay dynamic: App Hosting mounts DATABASE_URL at RUNTIME only, so a build-time
 * static sitemap would bake the 4-entity seed + localhost site URL into production.
 */
import type { MetadataRoute } from 'next';
import { getPublicActiveReleaseMeta, getPublicSearchIndex } from '../lib/public-data/source';
import { shouldUseLivePublicProjections } from '../lib/public-data/live-policy';
import { buildPublicSitemapEntries } from '../lib/seo/sitemap-builders';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Build time has no live Postgres connection — emit an empty sitemap rather than throw.
  // force-dynamic means this route re-runs per request in production, where DATABASE_URL
  // is mounted; only the build-time probe needs this guard.
  if (!shouldUseLivePublicProjections()) {
    return [];
  }
  const [{ data: index }, release] = await Promise.all([
    getPublicSearchIndex(),
    getPublicActiveReleaseMeta(),
  ]);
  // Prefer active-release activatedAt over Date.now() so lastModified stays stable
  // across crawls within a release. Per-entity revision stamps are not on the search index.
  return buildPublicSitemapEntries({
    entities: index.map((doc) => ({ id: doc.id })),
    ...(release ? { releaseGeneratedAt: release.activatedAt } : {}),
  });
}
