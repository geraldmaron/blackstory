/**
 * Link-health checker state machine: pure, dependency-injected
 * classification of a re-verification fetch into alive redirected drifted dead, plus a
 * retry-before-declaring-dead state machine across scheduled sweeps.
 *
 * `@repo/domain` cannot import `@repo/security` (security depends on domain; the
 * reverse edge would be a circular workspace dependency) see
 * packages/domain/src/rights/takedown.ts and packages/domain/src/map/map-source.ts for the same
 * port pattern used here. `LinkCheckFetchResult` below is structurally compatible with (a
 * superset of) `SafeFetchResult` from `@repo/security`'s url-safety fetch policy
 * (`executeSafeFetch`). The real wiring calling `executeSafeFetch` and adapting its result
 * into this port lives in
 * packages/config/src/scheduled-jobs/jobs/citation-link-health-sweep.ts, the one layer allowed
 * to depend on both packages. This module never performs network I/O itself.
 *
 * Disclosed gap: `executeSafeFetch`'s success branch does not surface the numeric HTTP status
 * of the final response (any non-redirect status it accepts is treated as fetchable content),
 * and its redirect-following loop does not preserve which hop's status code was 301/308
 * (permanent) versus 302/303/307 (temporary) it only returns a final `redirectCount`. Precise
 * "404/410/paywalled" classification and "permanent vs temporary redirect" therefore require the
 * caller's transport wrapper to additionally report `httpStatus` `permanentRedirect` on this
 * port (obtainable from the same `PinnedTransportResponse.status` transport already
 * sees, before `executeSafeFetch` discards it) see the job wrapper for how that's done. Absent
 * that extra reporting, this module still safely classifies alive redirected (via
 * `redirectCount`) a DNS-failure flavor of dead, and treats other failures as retryable rather
 * than guessing at a reason it cannot verify.
 */
import type { ContentHash } from '../provenance/hashes.js';
import { contentHashesEqual } from '../provenance/hashes.js';
import type { ContentDriftResult } from './drift-detection.js';
import { compareCapturedContent } from './drift-detection.js';
import type { LinkHealthStatus } from './citation.js';

export const DEAD_LINK_REASONS = ['not_found', 'gone', 'dns_not_found', 'paywalled', 'other'] as const;
export type DeadLinkReason = (typeof DEAD_LINK_REASONS)[number];

/** Structural port for a -driven re-verification fetch see module doc above. */
export type LinkCheckFetchResult =
  | {
      readonly ok: true;
      readonly finalUrl: string;
      readonly redirectCount: number;
      readonly contentHash: string;
      readonly httpStatus?: number;
      readonly permanentRedirect?: boolean;
    }
  | {
      readonly ok: false;
      /** Structurally matches `SafeFetchFailureReason`, kept as `string` here so this
       * port does not need to import the security package's type. */
      readonly reason: string;
      readonly httpStatus?: number;
    };

export type LinkCheckClassification = {
  readonly status: LinkHealthStatus | 'pending_retry';
  readonly deadReason?: DeadLinkReason;
  readonly redirectTarget?: string;
  readonly permanentRedirect?: boolean;
  readonly drift?: ContentDriftResult;
};

const HTTP_STATUS_DEAD_REASONS: Readonly<Record<number, DeadLinkReason>> = {
  404: 'not_found',
  410: 'gone',
  402: 'paywalled',
  403: 'paywalled',
};

function deadReasonForHttpStatus(httpStatus: number | undefined): DeadLinkReason | undefined {
  if (httpStatus === undefined) return undefined;
  return HTTP_STATUS_DEAD_REASONS[httpStatus];
}

/**
 * Classifies a single fetch attempt. Retry state (whether this attempt's failure should
 * actually flip the citation to 'dead' yet) is decided separately by `advanceLinkHealthState`
 * below this function only interprets one attempt in isolation.
 */
export function classifyLinkCheckAttempt(input: {
  readonly fetch: LinkCheckFetchResult;
  readonly capturedContentHash?: ContentHash;
  readonly capturedText?: string;
  readonly liveText?: string;
}): LinkCheckClassification {
  const { fetch } = input;

  if (fetch.ok) {
    const statusDeadReason = deadReasonForHttpStatus(fetch.httpStatus);
    if (statusDeadReason) {
      return { status: 'dead', deadReason: statusDeadReason };
    }

    let drift: ContentDriftResult | undefined;
    if (input.capturedContentHash) {
      drift = compareCapturedContent({
        capturedHash: input.capturedContentHash,
        liveContentHash: { algorithm: 'sha256', digest: fetch.contentHash },
        ...(input.capturedText !== undefined ? { capturedText: input.capturedText } : {}),
        ...(input.liveText !== undefined ? { liveText: input.liveText } : {}),
      });
    }

    if (drift?.diverged) {
      return {
        status: 'drifted',
        drift,
        ...(fetch.redirectCount > 0 ? { redirectTarget: fetch.finalUrl } : {}),
      };
    }
    if (fetch.redirectCount > 0) {
      return {
        status: 'redirected',
        redirectTarget: fetch.finalUrl,
        ...(fetch.permanentRedirect !== undefined ? { permanentRedirect: fetch.permanentRedirect } : {}),
      };
    }
    return { status: 'alive', ...(drift ? { drift } : {}) };
  }

  const statusDeadReason = deadReasonForHttpStatus(fetch.httpStatus);
  if (statusDeadReason) {
    return { status: 'dead', deadReason: statusDeadReason };
  }
  if (fetch.reason === 'dns_resolution_failed' || fetch.reason === 'dns_answer_not_public') {
    return { status: 'dead', deadReason: 'dns_not_found' };
  }
  // Any other failure (transport error, size/content-type limits, duration exceeded,
  // redirect limit exceeded, etc.) is treated as retryable rather than immediately dead a
  // transient failure must not be conflated with a confirmed-gone resource.
  return { status: 'pending_retry' };
}

export type LinkHealthState = {
  readonly citationId: string;
  readonly status: LinkHealthStatus;
  readonly consecutiveFailures: number;
  readonly lastCheckedAt: string;
  readonly lastAliveAt?: string;
};

export const DEFAULT_MAX_RETRIES_BEFORE_DEAD = 3;

/**
 * Advances a citation's link-health state by one scheduled check. A single failed/ambiguous
 * attempt does not declare death only after `maxRetriesBeforeDead` *consecutive* failed
 * attempts does the status flip to 'dead' ("retry before
 * declaring death"). An explicit dead classification (404/410/NXDOMAIN/paywalled) short-circuits
 * the retry budget immediately since it is not ambiguous.
 */
export function advanceLinkHealthState(
  previous: LinkHealthState,
  attempt: LinkCheckClassification,
  input: { readonly checkedAt: string; readonly maxRetriesBeforeDead?: number },
): LinkHealthState {
  const maxRetries = input.maxRetriesBeforeDead ?? DEFAULT_MAX_RETRIES_BEFORE_DEAD;

  if (attempt.status === 'alive' || attempt.status === 'redirected' || attempt.status === 'drifted') {
    return {
      citationId: previous.citationId,
      status: attempt.status,
      consecutiveFailures: 0,
      lastCheckedAt: input.checkedAt,
      lastAliveAt: input.checkedAt,
    };
  }

  if (attempt.status === 'dead') {
    // An explicit, unambiguous dead signal is not subject to the retry budget.
    return {
      citationId: previous.citationId,
      status: 'dead',
      consecutiveFailures: previous.consecutiveFailures + 1,
      lastCheckedAt: input.checkedAt,
      ...(previous.lastAliveAt !== undefined ? { lastAliveAt: previous.lastAliveAt } : {}),
    };
  }

  // 'pending_retry': an ambiguous/transient failure. Bump the counter; only cross into 'dead'
  // once the retry budget is exhausted.
  const consecutiveFailures = previous.consecutiveFailures + 1;
  const exhausted = consecutiveFailures >= maxRetries;
  return {
    citationId: previous.citationId,
    status: exhausted ? 'dead' : previous.status,
    consecutiveFailures,
    lastCheckedAt: input.checkedAt,
    ...(previous.lastAliveAt !== undefined ? { lastAliveAt: previous.lastAliveAt } : {}),
  };
}

export function initialLinkHealthState(citationId: string, checkedAt: string): LinkHealthState {
  return {
    citationId,
    status: 'alive',
    consecutiveFailures: 0,
    lastCheckedAt: checkedAt,
    lastAliveAt: checkedAt,
  };
}

export function contentHashFromHex(digest: string): ContentHash {
  return { algorithm: 'sha256', digest };
}

export { contentHashesEqual };
