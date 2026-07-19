/**
 * Map tile-load state model and the failure classifier (MOB-011 / ADR-024).
 *
 * MapLibre Native surfaces tile problems as native events (onDidFailLoadingMap)
 * and HTTP outcomes that a JS test runner cannot fire. So the failure handling is
 * split into a PURE classifier (`classifyMapError`, unit-tested) that maps a raw
 * signal to one of three product failure modes, and a presentational screen that
 * renders the matching degraded state via the shared `ErrorState` primitive
 * (MOB-007) instead of crashing. The three modes are the adversarial cases the
 * bead calls out: provider/CDN outage, corrupt/unsupported range-request
 * response, and offline cold start with no cached tiles yet.
 */

export type MapFailureMode = 'provider-outage' | 'corrupt-tiles' | 'offline-cold-start';

export type MapLoadState =
  | { readonly kind: 'ready' }
  | { readonly kind: 'error'; readonly mode: MapFailureMode };

export type MapFailureCopy = {
  readonly title: string;
  readonly description: string;
  /** Whether a retry action is offered (all current modes are retryable). */
  readonly retryable: boolean;
};

/**
 * User-facing copy per failure mode. Deliberately non-alarming and dignity-safe:
 * a map outage is framed as "the rest of the app still works", never as an error
 * that strands the reader (ADR-020 fail-safe-toward-reads posture).
 */
export const MAP_FAILURE_COPY: Record<MapFailureMode, MapFailureCopy> = {
  'provider-outage': {
    title: 'The map is temporarily unavailable',
    description:
      'The map service could not be reached. The rest of BlackStory still works while it recovers.',
    retryable: true,
  },
  'corrupt-tiles': {
    title: 'The map could not be loaded',
    description:
      'The map received an unexpected or incomplete response. Try again in a moment.',
    retryable: true,
  },
  'offline-cold-start': {
    title: "You're offline",
    description:
      'The map needs a connection the first time it loads. Reconnect to see it — your other saved content is still available.',
    retryable: true,
  },
};

/** Raw signal a tile-loading layer can hand the classifier. */
export type RawMapErrorSignal = {
  /** Device reports no network connectivity. */
  readonly offline?: boolean;
  /** HTTP status of a failed range/tile request, if any. */
  readonly httpStatus?: number;
  /** MapLibre onDidFailLoadingMap message / any lower-level reason text. */
  readonly reason?: string;
};

/**
 * Maps a raw tile-load failure to a product failure mode. Ordering matters:
 * offline is checked first (a cold start with no connection is the distinct
 * "you're offline" case, not a provider outage). HTTP 5xx / timeout / rate-limit
 * are provider/CDN outages. A 416 (range not satisfiable) or a parse/decode/
 * unsupported-archive reason is a corrupt/unsupported range-request response.
 * Anything unrecognized fails toward "temporarily unavailable" — never a crash.
 */
export function classifyMapError(signal: RawMapErrorSignal): MapFailureMode {
  if (signal.offline) return 'offline-cold-start';

  const status = signal.httpStatus;
  if (status !== undefined) {
    if (status === 416) return 'corrupt-tiles'; // Range Not Satisfiable -> unusable archive response
    if (status >= 500 || status === 408 || status === 429) return 'provider-outage';
  }

  const reason = (signal.reason ?? '').toLowerCase();
  if (/parse|corrupt|unsupported|malformed|invalid|decode|range|truncat/.test(reason)) {
    return 'corrupt-tiles';
  }
  if (/timeout|timed out|unreachable|network|connection|offline|dns/.test(reason)) {
    return 'provider-outage';
  }

  return 'provider-outage';
}
