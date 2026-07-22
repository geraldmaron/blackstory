/**
 * External link safety for Learn/More content (MOB-015 requirement #5).
 *
 * A deliberate, narrow duplicate of the http/https-only allowlist approach MOB-014's entity
 * feature uses for citations — copied rather than cross-imported (small enough to own
 * independently; coupling two feature modules for one regex would be the wrong trade). This
 * mirrors `packages/public-contracts/src/internal/primitives.ts`'s `httpUrl()` check (regex-based
 * "structural shape only", not a `new URL()` parse — that package's own comment explains why: a
 * environment-neutral validator should not assume a DOM/Node `URL` ambient).
 *
 * Two independent defenses:
 *   1. Scheme allowlist — only `http:`/`https:` may ever be opened. `javascript:`, `data:`,
 *      `file:`, custom schemes, and bare/relative paths (which could otherwise be misinterpreted
 *      as an internal deep link) are all rejected outright.
 *   2. Tracking-parameter stripping — known tracking query params (utm_*, gclid, fbclid, etc.)
 *      are removed from an otherwise-allowed URL before it is ever opened, so a citation/reference
 *      link never carries a third-party tracking identifier off-device.
 */

const HTTP_URL_PATTERN = /^https?:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i;

/** Known tracking query-parameter names/prefixes stripped from otherwise-safe external links. */
const TRACKING_PARAM_PATTERNS: readonly RegExp[] = [
  /^utm_/i,
  /^gclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
  /^mc_eid$/i,
  /^mc_cid$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^igshid$/i,
  /^_hsenc$/i,
  /^_hsmi$/i,
];

function isTrackingParamName(name: string): boolean {
  return TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Splits `url` into `base` (everything before `?`/`#`) and a raw query string, without relying on
 * a `URL`/`URLSearchParams` global (kept dependency-free and consistent with this module's
 * regex-only approach; RN/Hermes' `URL` support varies by SDK/polyfill and this check is simple
 * enough not to need it).
 */
function splitQuery(url: string): { readonly base: string; readonly query: string; readonly hash: string } {
  const hashIndex = url.indexOf('#');
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex === -1) return { base: withoutHash, query: '', hash };
  return { base: withoutHash.slice(0, queryIndex), query: withoutHash.slice(queryIndex + 1), hash };
}

function stripTrackingParams(query: string): string {
  if (query === '') return '';
  const kept = query
    .split('&')
    .filter((pair) => pair.length > 0)
    .filter((pair) => {
      const name = pair.split('=')[0] ?? '';
      return !isTrackingParamName(decodeSafely(name));
    });
  return kept.join('&');
}

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Validates and cleans an external link href. Returns `null` for anything that is not an
 * absolute `http(s)://` URL (scheme allowlist) — never a "best effort" pass-through of a
 * disallowed scheme. For an allowed URL, returns the same URL with known tracking query
 * parameters stripped.
 */
export function sanitizeExternalHref(rawHref: unknown): string | null {
  if (typeof rawHref !== 'string') return null;
  const trimmed = rawHref.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return null;
  if (!HTTP_URL_PATTERN.test(trimmed)) return null;

  const { base, query, hash } = splitQuery(trimmed);
  const cleanedQuery = stripTrackingParams(query);
  return cleanedQuery ? `${base}?${cleanedQuery}${hash}` : `${base}${hash}`;
}

/** True when `rawHref` is a safe, openable external link per `sanitizeExternalHref`. */
export function isSafeExternalHref(rawHref: unknown): boolean {
  return sanitizeExternalHref(rawHref) !== null;
}
