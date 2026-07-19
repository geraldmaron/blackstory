/**
 * sitemap helpers derive URL entries from active release projections.
 * Consumed by apps/web/src/app/sitemap.ts; keeps release-scoped routing logic testable.
 */
import type { MetadataRoute } from 'next';

export type SitemapEntityEntry = {
  readonly id: string;
  readonly updatedAt?: string;
};

export type BuildSitemapOptions = {
  readonly siteUrl?: string;
  readonly releaseGeneratedAt?: string;
  readonly entities?: readonly SitemapEntityEntry[];
};

const STATIC_PUBLIC_ROUTES: readonly {
  readonly path: string;
  readonly changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  readonly priority: number;
}[] = Object.freeze([
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/search', changeFrequency: 'daily', priority: 0.9 },
  { path: '/explore', changeFrequency: 'daily', priority: 0.9 },
  { path: '/locate', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/corrections', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/methodology', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/errata', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/legal', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/history', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/stories', changeFrequency: 'weekly', priority: 0.6 },
]);

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
  const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_ROUTES.map((route) => ({
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
