/**
 * Surface registry and public-document cache policy. Port of apps/web/src/lib/nav/surface-classes.ts
 * (the registry) and the cache decision in apps/web/src/proxy.ts. The registry names routes that do
 * not exist in apps/site yet; it is the source of truth for which URLs are cacheable documents, so
 * it moves whole and shrinks only when the matching Next route is retired.
 */

const SURFACE_CLASS_BY_PATH = new Map([
  ['/', 'door'],
  ['/explore', 'door'],
  ['/rooms', 'reading'],
  ['/records', 'reading'],
  ['/stories', 'reading'],
  ['/books', 'reading'],
  ['/law', 'reading'],
  ['/data', 'reading'],
  ['/lives', 'reading'],
  ['/memorial', 'reading'],
  ['/about', 'reading'],
  ['/faq', 'reading'],
  ['/methodology', 'reading'],
  ['/sources', 'reading'],
  ['/errata', 'reading'],
  ['/stories/mosaic-credits', 'utility'],
  ['/corrections', 'utility'],
  ['/submit', 'utility'],
  ['/support', 'utility'],
  ['/privacy', 'utility'],
  ['/terms', 'utility'],
  ['/design-system', 'utility'],
]);

const SURFACE_CLASS_PREFIXES = [
  ['/corrections/status', 'utility'],
  ['/stories/', 'reading'],
  ['/lives/', 'reading'],
  ['/place/', 'record'],
  ['/invention/', 'record'],
  ['/entity/', 'record'],
  ['/books/', 'record'],
  ['/law/', 'record'],
];

const ENDPOINT_ROUTES = new Set([
  '/facts',
  '/search',
  '/map',
  '/history',
  '/explore/api',
  '/atlas/catalog',
  '/search/api',
  '/locate/api',
  '/submit/api',
  '/corrections/api',
  '/corrections/abuse/api',
  '/corrections/appeal/api',
  '/corrections/status/api',
  '/api/request-integrity',
  '/errata/feed.json',
  '/errata/feed.xml',
  '/ai.txt',
  '/.well-known/security.txt',
  '/robots.txt',
  '/sitemap.xml',
  '/how-it-works',
  '/apparatus',
  '/law/browse',
  '/books/browse',
]);

function normalizePath(pathname) {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) return withoutQuery.slice(0, -1);
  return withoutQuery || '/';
}

/** @returns {'door'|'instrument'|'reading'|'record'|'utility'|null} null for endpoints and /admin. */
function surfaceClassFor(pathname) {
  const path = normalizePath(pathname);
  if (path === '/admin' || path.startsWith('/admin/')) return null;
  // Operator endpoints (purge, cache report) are not documents and never cacheable. Site-only.
  if (path === '/internal' || path.startsWith('/internal/')) return null;
  if (ENDPOINT_ROUTES.has(path)) return null;
  const exact = SURFACE_CLASS_BY_PATH.get(path);
  if (exact) return exact;
  for (const [prefix, surface] of SURFACE_CLASS_PREFIXES) {
    if (path.startsWith(prefix)) return surface;
  }
  return 'utility';
}

/**
 * Five minutes fresh, an hour stale-while-revalidate: an in-place correction reaches readers within
 * about five minutes without a purge. Consumed by Vercel's CDN only; other hosts ignore it, which is
 * the host decision's to settle (repo-34xfk).
 */
const PUBLIC_DOCUMENT_CDN_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600';

/**
 * A response the CDN may keep: a GET or HEAD for a rendered public surface, never a correction
 * receipt (its URL is its only protection) and never the design system.
 */
function isPublicDocumentCacheable({ method, pathname }) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (pathname.startsWith('/corrections/status')) return false;
  if (pathname === '/design-system' || pathname.startsWith('/design-system/')) return false;
  return surfaceClassFor(pathname) !== null;
}

module.exports = {
  surfaceClassFor,
  isPublicDocumentCacheable,
  PUBLIC_DOCUMENT_CDN_CACHE_CONTROL,
  ENDPOINT_ROUTES,
};
