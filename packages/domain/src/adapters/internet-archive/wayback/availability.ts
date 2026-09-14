/**
 * Wayback availability lookup: ask Internet Archive what it already holds for a URL.
 *
 * The other half of this directory submits captures (SPN2, `client.ts`). This half reads them,
 * and the two are wired lookup-first for a reason. Many cited URLs already have snapshots, so
 * minting a new one duplicates work the archive has already done; and a lookup recovers pages
 * our own safe-fetch refuses (a PDF, a robots block, a dead host) whenever IA got there first.
 * The lookup needs no credentials, so it stays available on lanes where SPN keys are absent.
 *
 * Two invariants hold everything else together:
 *
 * 1. The result is total. Every failure a lookup can hit, a 500, a truncated body, a DNS
 *    error, a safe-fetch rejection, comes back as a typed `miss` rather than a throw. A
 *    fallback that can itself fail the caller is not a fallback, and criterion 4 of the bead
 *    this implements says a miss is a logged skip.
 * 2. A pointer is never invented. We return the `url` the API named, and only after checking
 *    it is on an Internet Archive host, so a surprising response cannot smuggle an arbitrary
 *    URL into an evidence row. The one edit we make is upgrading the archive's own `http://`
 *    pointer to `https://` (the API still answers in http), which keeps stored pointers and
 *    every later link check on TLS without changing which capture is named.
 *
 * Goes through the injected `SafeHttpClient` like every other adapter here; never calls `fetch`.
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  withRetry,
  type SafeHttpClient,
  type SafeHttpResponse,
} from '../shared/http-port.js';
import { waybackAvailabilityUrl } from './types.js';
import type { WaybackLookupResult, WaybackSnapshot } from './types.js';

const AVAILABILITY_ALLOWED_CONTENT_TYPES = ['application/json'];

/** Hosts a returned pointer may live on. Suffix-matched, so `web.archive.org` is covered. */
const ARCHIVE_POINTER_HOST_SUFFIX = 'archive.org';

function miss(
  reason: Extract<WaybackLookupResult, { status: 'miss' }>['reason'],
  detail?: string,
): WaybackLookupResult {
  return detail === undefined ? { status: 'miss', reason } : { status: 'miss', reason, detail };
}

/**
 * Accepts a pointer only when it is an http(s) URL on an Internet Archive host, and upgrades
 * the archive's http answers to https. Returns null for anything else, which the caller reads
 * as a malformed response rather than as a snapshot.
 */
function normalizePointerUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const hostname = parsed.hostname.toLowerCase();
  const onArchive =
    hostname === ARCHIVE_POINTER_HOST_SUFFIX ||
    hostname.endsWith(`.${ARCHIVE_POINTER_HOST_SUFFIX}`);
  if (!onArchive) return null;
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
  }
  return parsed.toString();
}

/**
 * Parses one `/wayback/available` body. Defensive in the same spirit as
 * `parseSpnStatusResponse`: any shape we do not fully recognize becomes a miss, never a
 * half-populated snapshot.
 */
export function parseWaybackAvailabilityResponse(raw: unknown): WaybackLookupResult {
  if (!raw || typeof raw !== 'object') {
    return miss('malformed_response', 'body_not_an_object');
  }
  const snapshots = (raw as Record<string, unknown>).archived_snapshots;
  if (snapshots === undefined || snapshots === null) {
    return miss('malformed_response', 'missing_archived_snapshots');
  }
  if (typeof snapshots !== 'object') {
    return miss('malformed_response', 'archived_snapshots_not_an_object');
  }
  const closest = (snapshots as Record<string, unknown>).closest;
  // `archived_snapshots: {}` is the archive's own way of saying "nothing here". That is a
  // clean no_snapshot, not a malformed body.
  if (closest === undefined || closest === null) {
    return miss('no_snapshot');
  }
  if (typeof closest !== 'object') {
    return miss('malformed_response', 'closest_not_an_object');
  }
  const record = closest as Record<string, unknown>;
  if (record.available !== true) {
    return miss('no_snapshot', 'closest_not_available');
  }
  const rawUrl = typeof record.url === 'string' ? record.url.trim() : '';
  const timestamp = typeof record.timestamp === 'string' ? record.timestamp.trim() : '';
  if (!rawUrl || !timestamp) {
    return miss('malformed_response', 'closest_missing_url_or_timestamp');
  }
  const url = normalizePointerUrl(rawUrl);
  if (url === null) {
    return miss('malformed_response', 'closest_url_not_an_archive_pointer');
  }
  const httpStatus = typeof record.status === 'string' ? record.status.trim() : '';
  const snapshot: WaybackSnapshot = {
    url,
    timestamp,
    ...(httpStatus ? { httpStatus } : {}),
  };
  return { status: 'found', snapshot };
}

export type LookupWaybackSnapshotOptions = {
  readonly retries?: number;
  /** IA timestamp (YYYYMMDDHHMMSS); asks for the capture nearest that moment. */
  readonly timestamp?: string;
  readonly sleep?: (ms: number) => Promise<void>;
};

/**
 * Asks the availability API for an existing capture of `targetUrl`. Retries 429/5xx and
 * transport errors a couple of times, then reports whatever it ended with as a typed result.
 * Never throws, see invariant 1 in the module header.
 */
export async function lookupWaybackSnapshot(
  client: SafeHttpClient,
  targetUrl: string,
  options: LookupWaybackSnapshotOptions = {},
): Promise<WaybackLookupResult> {
  let response: SafeHttpResponse;
  try {
    response = await withRetry(
      () =>
        client({
          url: waybackAvailabilityUrl(targetUrl, options.timestamp),
          method: 'GET',
          allowedContentTypes: AVAILABILITY_ALLOWED_CONTENT_TYPES,
        }),
      {
        retries: options.retries ?? 2,
        baseDelayMs: 250,
        isRetryable: defaultIsRetryable,
        ...(options.sleep !== undefined ? { sleep: options.sleep } : {}),
      },
    );
  } catch (error) {
    return miss('transport_error', error instanceof Error ? error.message : String(error));
  }

  if (response.status >= 400) {
    return miss('http_error', `status_${response.status}`);
  }
  try {
    assertAllowedContentType(response, AVAILABILITY_ALLOWED_CONTENT_TYPES);
  } catch {
    return miss('malformed_response', 'content_type_not_allowed');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.bodyText);
  } catch {
    return miss('malformed_response', 'invalid_json');
  }
  return parseWaybackAvailabilityResponse(parsed);
}
