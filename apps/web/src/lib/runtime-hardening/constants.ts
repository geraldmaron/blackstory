/**
 * Shared runtime hardening limits for public App Hosting (BB-022).
 * Values are conservative defaults for cost and abuse resistance; staging/production
 * overrides live in apphosting*.yaml runConfig blocks.
 */

/** Allowed search/filter keys on /search — all other query keys are stripped at the edge. */
export const SEARCH_PAGE_PARAM_ALLOWLIST = ['q', 'kind', 'era', 'topic'] as const;

export type SearchPageParam = (typeof SEARCH_PAGE_PARAM_ALLOWLIST)[number];

/** Tracking / analytics prefixes stripped even when allowlisted routes accept other params. */
export const TRACKING_QUERY_PREFIXES = ['utm_', 'mc_', 'pk_', 'vero_'] as const;

/** Exact tracking query keys stripped on every public route. */
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

/** Upper bounds for serialized public responses (UTF-8 bytes). */
export const RESPONSE_SIZE_LIMITS = {
  html: 512 * 1024,
  json: 256 * 1024,
  rscPayload: 1024 * 1024,
} as const;

export type ResponseSizeKind = keyof typeof RESPONSE_SIZE_LIMITS;

/**
 * Post-deploy validation targets (documented in apphosting*.yaml).
 * Confirm with Cloud Run after backend creation:
 *   gcloud run services describe BACKEND --region=REGION --format='yaml(spec.template.spec.containerConcurrency,spec.template.metadata.annotations)'
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

/** Module specifiers that must never appear on the public render path (seed/snapshot only). */
export const FORBIDDEN_PUBLIC_RENDER_IMPORTS = [
  /@black-book\/data-access/,
  /@black-book\/firebase\/admin/,
  /firebase-admin/,
  /\/postgres/,
  /pg\b/,
  /openai/,
  /anthropic/,
  /from\s+['"]@google-cloud\/firestore['"]/,
  /from\s+['"]firebase\/firestore['"]/,
] as const;
