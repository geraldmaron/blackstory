/**
 * Degraded snapshot-mode signalling for Explore. `/explore` is server-rendered directly from
 * the bundled snapshot catalog (`../../data/public-seed.ts`); the dynamic `/explore/api` refine
 * endpoint (viewport/filter re-query) is a progressive enhancement layered on top of that render,
 * never a requirement for the page to function. This module is the single source of truth for what
 * counts as "degraded" so the client orchestrator and its tests agree on one definition, and so
 * the copy shown to users is consistent and never alarmist.
 */
export type ExploreDegradedReason =
  | 'refine_network_error'
  | 'refine_rate_limited'
  | 'refine_request_integrity_denied'
  /** @deprecated alias — use `refine_request_integrity_denied`. */
  | 'refine_app_check_denied'
  | 'refine_invalid_query'
  | 'map_canvas_unavailable';

export type ExploreDegradedState =
  | { readonly degraded: false }
  | { readonly degraded: true; readonly reason: ExploreDegradedReason };

export const NOT_DEGRADED: ExploreDegradedState = { degraded: false };

export function degradedFor(reason: ExploreDegradedReason): ExploreDegradedState {
  return { degraded: true, reason };
}

/** Human-readable, non-alarming copy for each degraded reason always paired with "showing the
 * last-loaded snapshot," never a bare error message. */
export const DEGRADED_MODE_COPY: Readonly<Record<ExploreDegradedReason, string>> = {
  refine_network_error:
    'Live refinement is unavailable right now — showing the last-loaded snapshot.',
  refine_rate_limited: 'Refinement is temporarily rate-limited — showing the last-loaded snapshot.',
  refine_request_integrity_denied:
    'This browser could not be verified for live refinement — showing the last-loaded snapshot.',
  refine_app_check_denied:
    'This browser could not be verified for live refinement — showing the last-loaded snapshot.',
  refine_invalid_query:
    'That filter combination could not be refined live — showing the last-loaded snapshot.',
  map_canvas_unavailable: 'The interactive map could not load — showing the accessible list view.',
};
