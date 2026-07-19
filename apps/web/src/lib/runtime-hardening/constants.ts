/**
 * Shared runtime hardening limits for public App Hosting.
 * Values are conservative defaults for cost and abuse resistance; staging/production
 * overrides live in apphosting*.yaml runConfig blocks.
 */

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
] as const;

export type SearchPageParam = (typeof SEARCH_PAGE_PARAM_ALLOWLIST)[number];

/**
 * Allowed filter/viewport keys on /explore shareable map state.
 * Must stay aligned with `buildExploreSearchParams` in map-experience/url-state.ts —
 * missing keys are stripped by edge middleware and break revisit/share links.
 */
export const EXPLORE_PAGE_PARAM_ALLOWLIST = [
  'era',
  'kind',
  'theme',
  'confidence',
  'lat',
  'lng',
  'zoom',
  'selected',
  'state',
  'layerMode',
  'popDecade',
  'popFrom',
  'popTo',
  'density',
  'group',
  'lines',
  'decade',
  'edge',
] as const;

export type ExplorePageParam = (typeof EXPLORE_PAGE_PARAM_ALLOWLIST)[number];

/**
 * Allowed browse keys on /history decade stepper + selection.
 */
export const HISTORY_PAGE_PARAM_ALLOWLIST = [
  'decade',
  'kind',
  'q',
  'sort',
  'selected',
  'edge',
] as const;

export type HistoryPageParam = (typeof HISTORY_PAGE_PARAM_ALLOWLIST)[number];

/**
 * Allowed filter/pagination keys on /facts library browse.
 * Must stay aligned with `buildFactLibraryHref` in facts/facts-view-model.ts.
 */
export const FACTS_PAGE_PARAM_ALLOWLIST = [
  'q',
  'claimType',
  'confidence',
  'offset',
] as const;

export type FactsPageParam = (typeof FACTS_PAGE_PARAM_ALLOWLIST)[number];

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

/** Upper bounds for serialized public responses (UTF-8 bytes).  */
export const RESPONSE_SIZE_LIMITS = {
  html: 512 * 1024,
  json: 256 * 1024,
  rscPayload: 1024 * 1024,
} as const;

export type ResponseSizeKind = keyof typeof RESPONSE_SIZE_LIMITS;

/**
 * Post-deploy validation targets (documented in apphosting*.yaml).
 * Confirm with Cloud Run after backend creation:
 * gcloud run services describe BACKEND --region=REGION --format='yaml(spec.template.spec.containerConcurrency,spec.template.metadata.annotations)'
 */
export const APP_HOSTING_RUN_LIMITS = {
  production: {
    minInstances: 2,
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
    minInstances: 1,
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
  new RegExp(`${IMPORT_OR_REQUIRE}@repo/firebase/admin`),
  new RegExp(`${IMPORT_OR_REQUIRE}firebase-admin`),
  new RegExp(`${IMPORT_OR_REQUIRE}[^'"]*/postgres`),
  new RegExp(`${IMPORT_OR_REQUIRE}pg['"]`),
  new RegExp(`${IMPORT_OR_REQUIRE}[^'"]*openai`),
  new RegExp(`${IMPORT_OR_REQUIRE}[^'"]*anthropic`),
  /from\s+['"]@google-cloud\/firestore['"]/,
  /from\s+['"]firebase\/firestore['"]/,
] as const;
