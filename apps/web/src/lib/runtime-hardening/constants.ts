/**
 * Shared runtime hardening limits for public web (Vercel).
 * Soft planning defaults for cost and abuse resistance; live scaling is Vercel Fluid Compute.
 */

import {
  EXPLORE_URL_PARAM_KEYS,
  EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS,
  type ExploreUrlParamKey,
  type ExploreViewportPolicyDroppedKey,
} from '../map-experience/url-state';

/**
 * Allowed search/filter keys on /search all other query keys are stripped at the edge.
 * Extended to cover every param the `/search/api` route actually reads (q + the 6
 * allowlisted filters + sort/pageSize/cursor/date range), so the CDN cache-key/vary normalization
 * does not silently drop params the route respects. `topic` is retained for the legacy seed-browse
 * page (`filterPublicEntities`), which still accepts it.
 */
export const SEARCH_PAGE_PARAM_ALLOWLIST = [
  'q',
  'kind',
  'state',
  'precision',
  'releaseId',
  'status',
  'era',
  'sort',
  'pageSize',
  'cursor',
  'dateFrom',
  'dateTo',
  'topic',
  /** Page-local pagination for legacy /search redirects and /history ledger. */
  'offset',
] as const;

export type SearchPageParam = (typeof SEARCH_PAGE_PARAM_ALLOWLIST)[number];

const VIEWPORT_POLICY_DROPPED = new Set<string>(EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS);

/**
 * Allowed filter/selection keys on the map surface (`/` and `/explore`).
 *
 * Generated from `EXPLORE_URL_PARAM_KEYS`, the URL parser's own key set, rather than retyped, so
 * the allowlist and the parser cannot drift: a key added to `parseExploreSearchParams` is
 * allowlisted the moment it is added, and a key removed from the parser stops being allowlisted.
 * Drift tests in `query-normalization.test.ts` fail in both directions.
 *
 * Viewport policy (ADR-017): `lat`, `lng` and `zoom` are excluded here on purpose. A shareable
 * URL restores what the reader was looking at, never where the camera was. That exclusion is the
 * named `EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS` list in map-experience/url-state.ts, not a gap in
 * this file, and the reasoning lives with it.
 */
export const EXPLORE_PAGE_PARAM_ALLOWLIST: readonly ExploreUrlParamKey[] =
  EXPLORE_URL_PARAM_KEYS.filter((key) => !VIEWPORT_POLICY_DROPPED.has(key));

export type ExplorePageParam = Exclude<ExploreUrlParamKey, ExploreViewportPolicyDroppedKey>;

/**
 * Allowed browse keys on /law.
 *
 * The GET browse contract the page actually renders: `LawBrowseSections` posts exactly these
 * fields, and `buildLawBrowseViewModel` reads them. Until this list existed, `/law` was
 * matched by middleware with an empty allowlist, so every law filter link 308'd to the bare
 * index and the reader's filters were gone before the page ran. (`status` is read by the view
 * model but has no rendered control, so it is not part of the browse contract.)
 *
 * `sort` joined the contract with the catalog card redesign — it backs the Sort select, and
 * omitting it here silently dropped the reader's ordering at the edge.
 */
export const LAW_PAGE_PARAM_ALLOWLIST = ['q', 'kind', 'topic', 'sort'] as const;

export type LawPageParam = (typeof LAW_PAGE_PARAM_ALLOWLIST)[number];

/**
 * Allowed browse params on /stories.
 *
 * `/stories` (and `/chapters` before it) sat in the proxy matcher with no allowlist, so the
 * edge stripped every filter before the page ran: the era and place rail links the index
 * rendered were dead on arrival, and the reader saw the unfiltered list with no indication
 * anything had been dropped. Same failure the law and corrections allowlists were added to
 * fix. Any control the stories index renders has to be named here, or it silently does
 * nothing — `parseStoriesQuery` and this list are one contract.
 */
export const STORIES_PAGE_PARAM_ALLOWLIST = [
  'q',
  'kind',
  'collection',
  'tag',
  'era',
  'place',
  'sort',
  'page',
] as const;

export type StoriesPageParam = (typeof STORIES_PAGE_PARAM_ALLOWLIST)[number];

/**
 * Allowed prefill keys on /corrections.
 *
 * `CorrectionForm` reads both from `useSearchParams` to pre-select the record under correction.
 * Matched with an empty allowlist, the edge stripped them before the form mounted, which made
 * the prefill contract unreachable from any "Suggest a correction" link.
 */
export const CORRECTIONS_PAGE_PARAM_ALLOWLIST = ['target', 'targetType'] as const;

export type CorrectionsPageParam = (typeof CORRECTIONS_PAGE_PARAM_ALLOWLIST)[number];

// HISTORY_PAGE_PARAM_ALLOWLIST stood here for the /history decade stepper and its selection
// params. Both the stepper and the browse UI are gone (repo-92n2.27), and /history left the
// middleware matcher in SP-06, so nothing read this at the edge or anywhere else.
//
// /history must stay OUT of the matcher. The route's whole remaining job is to map an incoming
// `decade` onto `era` and 308 to /records, and normalization would strip the very params the
// redirect exists to carry — a bookmark would land on an unfiltered index instead of failing
// loudly. An allowlist here would make adding it to the matcher look safe when it is not.

/** Tracking analytics prefixes stripped even when allowlisted routes accept other params.  */
export const TRACKING_QUERY_PREFIXES = ['utm_', 'mc_', 'pk_', 'vero_'] as const;

/** Exact tracking query keys stripped on every public route.  */
export const TRACKING_QUERY_KEYS = new Set([
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'ref',
  '_ga',
  '_gl',
  'igshid',
]);

/**
 * Platform handshake query keys that must survive edge normalization redirects.
 * Vercel Deployment Protection / Authentication returns `_vercel_share` after SSO;
 * stripping it 308s back to a bare URL and re-triggers SSO → ERR_TOO_MANY_REDIRECTS.
 * Kept out of cache keys (see `normalizeQueryString`) — only redirect builders preserve them.
 */
export function isPlatformPassthroughQueryKey(key: string): boolean {
  return key.toLowerCase().startsWith('_vercel_');
}

/** Upper bounds for serialized public responses (UTF-8 bytes).  */
export const RESPONSE_SIZE_LIMITS = {
  html: 512 * 1024,
  json: 256 * 1024,
  rscPayload: 1024 * 1024,
} as const;

export type ResponseSizeKind = keyof typeof RESPONSE_SIZE_LIMITS;

/**
 * Soft public-web planning targets (historical App Hosting caps; Vercel does not
 * enforce these as instance YAML).
 */
export const APP_HOSTING_RUN_LIMITS = {
  production: {
    minInstances: 0,
    maxInstances: 6,
    concurrency: 40,
    cpu: 1,
    memoryMiB: 384,
  },
  staging: {
    minInstances: 0,
    maxInstances: 2,
    concurrency: 20,
    cpu: 1,
    memoryMiB: 256,
  },
  base: {
    minInstances: 0,
    maxInstances: 6,
    concurrency: 40,
    cpu: 1,
    memoryMiB: 384,
  },
} as const;

/**
 * Module specifiers that must never appear on the public render path (seed/snapshot only).
 * Each pattern requires actual import/require syntax around the specifier a bare substring
 * match (e.g. plain `/anthropic/`) would also flag unrelated prose or string literals, such as
 * an AI-crawler name in robots.ts's disallow list, that never import anything.
 */
const IMPORT_OR_REQUIRE = String.raw`(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"][^'"]*`;

export const FORBIDDEN_PUBLIC_RENDER_IMPORTS = [
  new RegExp(`${IMPORT_OR_REQUIRE}@repo/data-access`),
  new RegExp(`${IMPORT_OR_REQUIRE}@repo/ops-data/admin`),
  new RegExp(`${IMPORT_OR_REQUIRE}firebase-admin`),
  new RegExp(`${IMPORT_OR_REQUIRE}[^'"]*/postgres`),
  new RegExp(`${IMPORT_OR_REQUIRE}pg['"]`),
  new RegExp(`${IMPORT_OR_REQUIRE}[^'"]*openai`),
  new RegExp(`${IMPORT_OR_REQUIRE}[^'"]*anthropic`),
  /from\s+['"]@google-cloud\/firestore['"]/,
  /from\s+['"]firebase\/firestore['"]/,
] as const;
