/** Reads existing snapshots and verifies their timestamp, status, and exact source URL. */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  withRetry,
  type SafeHttpClient,
  type SafeHttpResponse,
} from '../shared/http-port.js';
import { waybackAvailabilityUrl, parseWaybackCaptureUrl } from './types.js';
import type { WaybackLookupResult, WaybackSnapshot } from './types.js';

const AVAILABILITY_ALLOWED_CONTENT_TYPES = ['application/json'];

function miss(
  reason: Extract<WaybackLookupResult, { status: 'miss' }>['reason'],
  detail?: string,
): WaybackLookupResult {
  return detail === undefined ? { status: 'miss', reason } : { status: 'miss', reason, detail };
}

/**
 * Parses one `/wayback/available` body. Defensive in the same spirit as
 * `parseSpnStatusResponse`: any shape we do not fully recognize becomes a miss, never a
 * half-populated snapshot.
 */
export function parseWaybackAvailabilityResponse(
  raw: unknown,
  targetUrl?: string,
): WaybackLookupResult {
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
  const pointer = parseWaybackCaptureUrl(rawUrl, targetUrl);
  if (pointer === null || pointer.timestamp !== timestamp) {
    return miss('malformed_response', 'closest_url_not_an_archive_pointer');
  }
  const httpStatus =
    typeof record.status === 'string' ? record.status.trim() : String(record.status ?? '');
  if (!/^2\d\d$/.test(httpStatus)) return miss('http_error', 'snapshot_status_not_success');
  const snapshot: WaybackSnapshot = {
    url: pointer.url,
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
  return parseWaybackAvailabilityResponse(parsed, targetUrl);
}
