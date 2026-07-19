/**
 * Minimal Save Page Now (archive.org) client for the repair ladder's step 3: "if no capture
 * exists, attempt a retroactive Save Page Now".
 *
 * Adapters under `packages/domain/src/adapters/` may eventually own a fuller Internet Archive
 * SPN client; this module is a deliberately minimal, independent SPN caller following the same
 * dependency-injected/port pattern as `../citations/link-health.ts`. If an equivalent adapter
 * client lands later, merging the two (retiring whichever is thinner) is a clean follow-up.
 *
 * Like `link-health.ts`, this module performs no network I/O itself and cannot import
 * `@repo/security` (circular dependency). `SpnFetchResult` is the same structural port
 * shape as `LinkCheckFetchResult`; the real POST to `https://web.archive.org/save/<url>` through
 * safe-fetch policy is wired in `packages/config/src/scheduled-jobs/jobs/citation-link-health-sweep.ts`.
 */

const WAYBACK_HOST_PATTERN = /(^|\.)web\.archive\.org$/i;

export type SpnFetchResult =
  | { readonly ok: true; readonly finalUrl: string; readonly httpStatus?: number }
  | { readonly ok: false; readonly reason: string; readonly httpStatus?: number };

export type SpnCaptureOutcome =
  | { readonly ok: true; readonly waybackCaptureUrl: string; readonly capturedAt: string }
  | { readonly ok: false; readonly reason: string };

/** Builds the Save Page Now request URL for a target page (archive.orgthe "save" endpoint). */
export function buildSpnSaveUrl(targetUrl: string): string {
  if (!targetUrl.trim()) {
    throw new Error('buildSpnSaveUrl requires a non-empty targetUrl');
  }
  try {
    new URL(targetUrl);
  } catch {
    throw new Error(`buildSpnSaveUrl requires a valid absolute URL, got: ${targetUrl}`);
  }
  return `https://web.archive.org/save/${targetUrl}`;
}

function isWaybackCaptureResponseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && WAYBACK_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Interprets the result of a Save Page Now request (already fetched through by the
 * caller) into a capture outcome. SPN redirects the final URL to the newly minted
 * `web.archive.org/web/<timestamp>/<url>` capture location on success.
 */
export function interpretSpnFetchResult(
  result: SpnFetchResult,
  capturedAt: string,
): SpnCaptureOutcome {
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  if (!isWaybackCaptureResponseUrl(result.finalUrl)) {
    return { ok: false, reason: 'spn_response_not_a_wayback_capture' };
  }
  return { ok: true, waybackCaptureUrl: result.finalUrl, capturedAt };
}
