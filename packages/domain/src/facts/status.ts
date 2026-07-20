/**
 * `FactRecord.status` workflow-rank axis.
 *
 * Deliberately independent from `./confidence.ts`'s evidence-grade axis never conflate the
 * two. A `contested` (low-confidence) fact can still be `published` (workflow-ready, with the
 * contest disclosed via `confidenceNote` and `counterClaims`); a high-confidence fact can sit
 * in `draft` simply because it has not cleared editorial review yet. `assertStatusConfidenceAxesIndependent`
 * below is a structural guard against a caller trying to derive one axis from the other.
 *
 * `deprecated`/`superseded` records must stay resolvable at their permalink with a banner and
 * reason never 404 (the Wikipedia-style "this page has been superseded" pattern, not a
 * dead link). `draft`/`under_review` are pre-publication: they are never part of the public
 * projection at all, so there is no public permalink to keep alive for them in the first place.
 */

export const FACT_STATUSES = [
  'draft',
  'under_review',
  'published',
  'corrected',
  'superseded',
  'deprecated',
] as const;

export type FactStatus = (typeof FACT_STATUSES)[number];

export function isFactStatus(value: string): value is FactStatus {
  return (FACT_STATUSES as readonly string[]).includes(value);
}

/** Statuses that are part of the public projection at all (pre-publication statuses never are). */
export const PUBLISHABLE_FACT_STATUSES = [
  'published',
  'corrected',
  'superseded',
  'deprecated',
] as const;
export type PublishableFactStatus = (typeof PUBLISHABLE_FACT_STATUSES)[number];

export function isPublishableFactStatus(value: FactStatus): value is PublishableFactStatus {
  return (PUBLISHABLE_FACT_STATUSES as readonly string[]).includes(value);
}

/**
 * Statuses whose permalink must keep resolving to real content (never 404), because the record
 * has at some point been public. `superseded`/`deprecated` render with a banner + reason
 * instead of disappearing.
 */
export const PUBLICLY_RESOLVABLE_FACT_STATUSES = PUBLISHABLE_FACT_STATUSES;

export function isPubliclyResolvableFactStatus(status: FactStatus): boolean {
  return (PUBLICLY_RESOLVABLE_FACT_STATUSES as readonly string[]).includes(status);
}

/**
 * Statuses eligible for the searchable library ("searchable fact library over
 * PUBLISHED facts"). `corrected` counts as published-with-a-correction-note, not a retirement;
 * `superseded`/`deprecated` remain individually resolvable via direct permalink but drop out of
 * the browsable/searchable library surface.
 */
export const SEARCH_INDEXABLE_FACT_STATUSES = ['published', 'corrected'] as const;

export function isSearchIndexableFactStatus(status: FactStatus): boolean {
  return (SEARCH_INDEXABLE_FACT_STATUSES as readonly string[]).includes(status);
}

/** Fail-closed: throws when a status that must stay resolvable is treated as absent (404). */
export function assertFactStatusNeverResolvesTo404(status: FactStatus): void {
  if (!isPubliclyResolvableFactStatus(status)) {
    throw new Error(
      `FactRecord status "${status}" is pre-publication and has no public permalink to keep alive.`,
    );
  }
}

/**
 * A human-facing banner reason for `superseded`/`deprecated` records never silently omitted.
 * `supersededByFactId` is required for `superseded` (a superseded fact always points at its
 * replacement); `deprecated` may or may not have one (a fact can be deprecated outright, with no
 * successor, e.g. found to rest on a fabricated source).
 */
export type FactResolutionBanner = {
  readonly status: 'superseded' | 'deprecated';
  readonly reason: string;
  readonly supersededByFactId?: string;
};

export function assertFactResolutionBannerValid(banner: FactResolutionBanner): void {
  if (!banner.reason.trim()) {
    throw new Error(`A "${banner.status}" fact requires a non-empty banner reason.`);
  }
  if (banner.status === 'superseded' && !banner.supersededByFactId) {
    throw new Error(
      'A "superseded" fact requires a supersededByFactId pointing at its replacement.',
    );
  }
}
