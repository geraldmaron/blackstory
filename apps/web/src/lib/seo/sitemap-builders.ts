/**
 * sitemap helpers derive URL entries from active release projections.
 * Consumed by apps/web/src/app/sitemap.ts; keeps release-scoped routing logic testable.
 */
import type { MetadataRoute } from 'next';
import { crawlableDestinations } from '../nav/destination-registry';

export type SitemapEntityEntry = {
  readonly id: string;
  readonly updatedAt?: string;
};

export type BuildSitemapOptions = {
  readonly siteUrl?: string;
  readonly releaseGeneratedAt?: string;
  readonly entities?: readonly SitemapEntityEntry[];
};

/**
 * The static routes, derived from the destination registry rather than restated here (SP-19).
 *
 * The list this replaced was hand-kept, and it drifted exactly the way a hand-kept list does: it
 * carried `/history` TWICE — a duplicate `<url>` in the emitted XML — and went on carrying it
 * after `/history` became a redirect, so the sitemap taught crawlers a URL that immediately
 * disowns itself. Now a route is in the sitemap if and only if its registry entry has `crawl`.
 */
function staticRoutes(): readonly {
  readonly path: string;
  readonly changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  readonly priority: number;
}[] {
  return crawlableDestinations().map((destination) => ({
    path: destination.path,
    changeFrequency: destination.crawl?.changeFrequency,
    priority: destination.crawl?.priority ?? 0.5,
  }));
}

function resolveSiteUrl(siteUrl: string | undefined): string {
  return siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';
}

function toAbsolute(siteUrl: string, path: string): string {
  return new URL(path, siteUrl).toString();
}

/**
 * Builds sitemap entries for static routes plus entity pages from the active release catalog.
 */
export function buildPublicSitemapEntries(
  options: BuildSitemapOptions = {},
): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl(options.siteUrl);
  const releaseStamp = options.releaseGeneratedAt ?? new Date().toISOString();
  const staticEntries: MetadataRoute.Sitemap = staticRoutes().map((route) => ({
    url: toAbsolute(siteUrl, route.path),
    lastModified: releaseStamp,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const entityEntries: MetadataRoute.Sitemap = (options.entities ?? []).map((entity) => ({
    url: toAbsolute(siteUrl, `/entity/${entity.id}`),
    lastModified: entity.updatedAt ?? releaseStamp,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...entityEntries];
}
