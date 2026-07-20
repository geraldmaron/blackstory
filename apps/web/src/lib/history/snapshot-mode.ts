/**
 * Degraded snapshot-mode signalling for `/history`. The page is
 * SSR-first from the bundled graph release artifact (`../../data/history-graph-seed.ts`); the
 * dynamic `/history/api` refine endpoint is progressive enhancement only.
 */
export type HistoryDegradedReason =
  | 'refine_network_error'
  | 'refine_rate_limited'
  | 'refine_app_check_denied'
  | 'refine_invalid_query';

export type HistoryDegradedState =
  | { readonly degraded: false }
  | { readonly degraded: true; readonly reason: HistoryDegradedReason };

export const HISTORY_NOT_DEGRADED: HistoryDegradedState = { degraded: false };

export function historyDegradedFor(reason: HistoryDegradedReason): HistoryDegradedState {
  return { degraded: true, reason };
}

export const HISTORY_DEGRADED_MODE_COPY: Readonly<Record<HistoryDegradedReason, string>> = {
  refine_network_error:
    'Live refinement is unavailable right now — showing the last-loaded snapshot.',
  refine_rate_limited: 'Refinement is temporarily rate-limited — showing the last-loaded snapshot.',
  refine_app_check_denied:
    'This browser could not be verified for live refinement — showing the last-loaded snapshot.',
  refine_invalid_query:
    'That filter combination could not be refined live — showing the last-loaded snapshot.',
};
