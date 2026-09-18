/** Internet Archive submission, polling, and exact snapshot pointer contracts. */

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

/** Validate a real snapshot path and its archived source, not merely an archive.org hostname. */
export function parseWaybackCaptureUrl(
  raw: string,
  targetUrl?: string,
): { url: string; timestamp: string; sourceUrl: string; capturedAt: string } | null {
  try {
    const url = new URL(raw);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.hostname !== 'web.archive.org' ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const match = /^\/web\/(\d{14})(?:id_|if_|im_)?\/(https?:\/\/.+)$/.exec(
      url.pathname + url.search,
    );
    if (!match) return null;
    const timestamp = match[1]!;
    const iso = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}.000Z`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()) || date.toISOString() !== iso) return null;
    const source = new URL(match[2]!);
    if (source.username || source.password) return null;
    source.hash = '';
    if (targetUrl !== undefined) {
      const expected = new URL(targetUrl);
      expected.hash = '';
      if (source.toString() !== expected.toString()) return null;
    }
    url.protocol = 'https:';
    return { url: url.toString(), timestamp, sourceUrl: source.toString(), capturedAt: iso };
  } catch {
    return null;
  }
}
