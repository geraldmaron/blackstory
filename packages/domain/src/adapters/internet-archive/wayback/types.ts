/** Internet Archive submission, polling, and exact snapshot pointer contracts. */
export { parseWaybackCaptureUrl } from '@repo/schemas';

export const WAYBACK_SPN_SUBMIT_URL = 'https://web.archive.org/save' as const;

export function waybackSpnStatusUrl(jobId: string): string {
  return `https://web.archive.org/save/status/${encodeURIComponent(jobId)}`;
}

export type SpnCredentials = {
  readonly accessKey: string;
  readonly secretKey: string;
};

export const SPN_STATUSES = ['pending', 'success', 'error'] as const;
export type SpnStatus = (typeof SPN_STATUSES)[number];

export type SpnSubmitResult = {
  readonly jobId: string;
};

export type SpnStatusResult = {
  readonly status: SpnStatus;
  /** IA timestamp format (YYYYMMDDHHMMSS) as returned by the API, when status is success. */
  readonly timestamp?: string;
  readonly originalUrl?: string;
  readonly message?: string;
};

// ---- availability lookup: read the captures IA already holds ----

/**
 * The Wayback availability API, SPN2's mirror image: it mints nothing and reports only what
 * Internet Archive already has. Two consequences shape everything below. It takes no
 * credentials, so a lookup is always wireable even when SPN keys are absent. And it lives on
 * `archive.org`, not `web.archive.org`, so a client whose host allowlist was written for SPN
 * alone will reject it.
 */
export const WAYBACK_AVAILABILITY_URL = 'https://archive.org/wayback/available' as const;

/** Builds the availability query. `timestamp` (YYYYMMDDHHMMSS) asks for the capture nearest a date. */
export function waybackAvailabilityUrl(targetUrl: string, timestamp?: string): string {
  const query = new URLSearchParams({ url: targetUrl });
  if (timestamp !== undefined && timestamp.trim()) {
    query.set('timestamp', timestamp.trim());
  }
  return `${WAYBACK_AVAILABILITY_URL}?${query.toString()}`;
}

/**
 * A capture Internet Archive says it already holds. `url` is the pointer the API returned,
 * carried through verbatim apart from an http -> https upgrade on the archive's own host.
 * It is deliberately never rebuilt from `timestamp` the way `buildWaybackCaptureUrl` does for a
 * job we just submitted: there we know the capture exists because we watched it succeed, whereas
 * a lookup may only report a snapshot the archive itself named.
 */
export type WaybackSnapshot = {
  readonly url: string;
  /** IA timestamp format (YYYYMMDDHHMMSS). */
  readonly timestamp: string;
  /** HTTP status the crawler recorded for the capture, as the API returns it ("200", "301"). */
  readonly httpStatus?: string;
};

export const WAYBACK_LOOKUP_MISS_REASONS = [
  /** The archive answered, and holds nothing for this URL. */
  'no_snapshot',
  /** The archive answered in a shape we will not trust. */
  'malformed_response',
  /** The archive answered with a 4xx/5xx. */
  'http_error',
  /** The request never completed: DNS, TLS, timeout, or a safe-fetch rejection. */
  'transport_error',
] as const;
export type WaybackLookupMissReason = (typeof WAYBACK_LOOKUP_MISS_REASONS)[number];

/**
 * A lookup result is total: no throwing path, no "unknown" state. A miss is an ordinary
 * outcome the caller logs and moves past, which is what lets capture-backfill treat the lookup
 * as a fallback rather than as a second thing that can fail the lane.
 */
export type WaybackLookupResult =
  | { readonly status: 'found'; readonly snapshot: WaybackSnapshot }
  | {
      readonly status: 'miss';
      readonly reason: WaybackLookupMissReason;
      /** Free text for the log line: a status code, a parse failure, an error message. */
      readonly detail?: string;
    };
