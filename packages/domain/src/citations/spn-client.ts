/**
 * Minimal Save Page Now (archive.org) client for the repair ladder's step 3: "if no capture
 * exists, attempt a retroactive Save Page Now" (BB-083 acceptance criterion 3).
 *
 * BB-073 (adapters, this session's parallel territory, read-only to this bead) may build its
 * own Internet Archive / Save Page Now client under packages/domain/src/adapters/ — at the time
 * this module was written, no such client existed there (checked: no save-page-now / SPN
 * references anywhere in packages/domain/src/adapters, packages/security, or packages/config).
 * Rather than block on in-flight parallel work this bead cannot safely depend on mid-session,
 * this is a deliberately minimal, independent SPN caller following the same
 * dependency-injected/port pattern as ../citations/link-health.ts. If BB-073 lands an
 * equivalent client, merging the two into one (retiring whichever is thinner) is a clean,
 * low-risk follow-up — noting the near-duplicate here rather than silently leaving it.
 *
 * Like link-health.ts, this module performs no network I/O itself and cannot import
 * `@black-book/security` (circular dependency). `SpnFetchResult` is the same structural port
 * shape as `LinkCheckFetchResult`; the real POST to `https://web.archive.org/save/<url>` through
 * BB-030's safe-fetch policy is wired in packages/config/src/scheduled-jobs/jobs/
 * citation-link-health-sweep.ts.
 */

const WAYBACK_HOST_PATTERN = /(^|\.)web\.archive\.org$/i;

export type SpnFetchResult =
  | { readonly ok: true; readonly finalUrl: string; readonly httpStatus?: number }
  | { readonly ok: false; readonly reason: string; readonly httpStatus?: number };

export type SpnCaptureOutcome =
  | { readonly ok: true; readonly waybackCaptureUrl: string; readonly capturedAt: string }
  | { readonly ok: false; readonly reason: string };

/** Builds the Save Page Now request URL for a target page (archive.org's "save" endpoint). */
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
 * Interprets the result of a Save Page Now request (already fetched through BB-030 by the
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
