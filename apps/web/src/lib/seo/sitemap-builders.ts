/**
 * sitemap helpers derive URL entries from active release projections.
 * Consumed by `app/sitemap.xml/route.ts`; keeps release-scoped routing logic testable.
 */
import type { MetadataRoute } from 'next';
import { crawlableDestinations } from '../nav/destination-registry';
import { canStandHere } from '../place/public-place-path';
import { placeHrefForEntity, placeSlugCollisionCounts } from '../place/place-slug';

export type SitemapEntityEntry = {
  readonly id: string;
  readonly displayName?: string;
  readonly kind?: string;
  readonly summary?: string;
  readonly locationPrecision?: string;
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

function recordPath(entity: SitemapEntityEntry, collisions: ReadonlyMap<string, number>): string {
  const displayName = entity.displayName?.trim() ?? '';
  if (
    displayName.length > 0 &&
    canStandHere({
      displayName,
      kind: entity.kind ?? 'place',
      summary: entity.summary ?? displayName,
      ...(entity.locationPrecision !== undefined
        ? { locationPrecision: entity.locationPrecision }
        : {}),
    })
  ) {
    return placeHrefForEntity({ id: entity.id, displayName }, collisions);
  }
  return `/entity/${entity.id}`;
}

/**
 * Builds sitemap entries for static routes plus record pages from the active release catalog.
 * Standable records emit `/place/{slug}`; the rest keep `/entity/{id}`.
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

  const entities = options.entities ?? [];
  const collisions = placeSlugCollisionCounts(
    entities.flatMap((entity) =>
      entity.displayName?.trim() ? [{ displayName: entity.displayName }] : [],
    ),
  );

  const entityEntries: MetadataRoute.Sitemap = entities.map((entity) => ({
    url: toAbsolute(siteUrl, recordPath(entity, collisions)),
    lastModified: entity.updatedAt ?? releaseStamp,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...entityEntries];
}

/**
 * What the CDN is told for `/sitemap.xml`. Same shape as `/atlas/catalog`: a force-dynamic
 * route handler keeps this header (dynamic *pages* get `no-store`). Crawlers hit this URL
 * constantly; one origin build per hour is enough for a release-scoped URL list.
 */
export const SITEMAP_CACHE_CONTROL =
  'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function lastmodIso(value: MetadataRoute.Sitemap[number]['lastModified']): string | undefined {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** Serialize the App Router sitemap array to protocol XML. */
export function serializeSitemapXml(entries: MetadataRoute.Sitemap): string {
  const urls = entries
    .map((entry) => {
      const lastmod = lastmodIso(entry.lastModified);
      const changefreq = entry.changeFrequency;
      const priority = entry.priority;
      return [
        '<url>',
        `<loc>${escapeXml(entry.url)}</loc>`,
        lastmod ? `<lastmod>${lastmod}</lastmod>` : '',
        changefreq ? `<changefreq>${changefreq}</changefreq>` : '',
        priority !== undefined ? `<priority>${priority}</priority>` : '',
        '</url>',
      ]
        .filter((part) => part.length > 0)
        .join('');
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
