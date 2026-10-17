/**
 * Request-size limit and the set of routes it (and query normalization) covers. Port of
 * apps/web/src/lib/web-security/{request-size-limits,edge-security}.ts and
 * `isSecurityNormalizedPath` in apps/web/src/proxy.ts. Query canonicalization lives in query-normalization.cjs.
 */
const REQUEST_SIZE_LIMITS = {
  jsonBody: 64 * 1024,
  textBody: 64 * 1024,
  contentLengthHeader: 64 * 1024,
};
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SECURITY_NORMALIZED_EXACT = new Set([
  '/',
  '/search',
  '/explore',
  '/records',
  '/atlas/catalog',
  '/sitemap.xml',
  '/law',
  '/legal',
  '/errata',
  '/about',
  '/methodology',
  '/stories',
  '/corrections',
  '/submit',
]);
const SECURITY_NORMALIZED_PREFIXES = [
  '/place/',
  '/entity/',
  '/law/',
  '/legal/',
  '/errata/',
  '/stories/',
];

function isSecurityNormalizedPath(pathname) {
  if (SECURITY_NORMALIZED_EXACT.has(pathname)) return true;
  return SECURITY_NORMALIZED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Whether the original proxy would run its public-route handling for this request. It tests the path
 * as sent, so `/place/` (prefix match) is eligible but `/methodology/` (exact set) is not; the site also
 * counts a trailing-slash exact route, because Next redirected that itself and Expo does not.
 */
function isSecurityNormalizedRequest({ pathname, trailingSlash }) {
  if (isSecurityNormalizedPath(pathname)) return true;
  return Boolean(trailingSlash) && isSecurityNormalizedPath(`${pathname}/`);
}

function requestSizeKindForContentType(contentType) {
  if (!contentType) return 'jsonBody';
  const normalized = contentType.toLowerCase();
  if (normalized.includes('application/json')) return 'jsonBody';
  if (normalized.includes('text/plain')) return 'textBody';
  return 'jsonBody';
}

/** True when the declared body size is invalid or over the limit for its content type. */
function isRequestTooLarge(contentLength, kind) {
  if (contentLength === null || contentLength === undefined) return false;
  if (!Number.isFinite(contentLength) || contentLength < 0) return true;
  return contentLength > REQUEST_SIZE_LIMITS[kind];
}

/** @returns {{status:number, headers:Record<string,string>, body:string}|null} */
function handleRequestSize({ method, pathname, trailingSlash, headers }) {
  if (!isSecurityNormalizedRequest({ pathname, trailingSlash })) return null;
  if (!STATE_CHANGING_METHODS.has(method)) return null;
  const header = headers['content-length'];
  if (!header) return null;
  const kind = requestSizeKindForContentType(headers['content-type'] ?? null);
  if (!isRequestTooLarge(Number.parseInt(header, 10), kind)) return null;
  return {
    status: 413,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: 'Payload Too Large',
  };
}

module.exports = {
  REQUEST_SIZE_LIMITS,
  isSecurityNormalizedPath,
  isSecurityNormalizedRequest,
  requestSizeKindForContentType,
  isRequestTooLarge,
  handleRequestSize,
};
