/**
 * Wayback Machine Save Page Now (SPN2) capture types (BB-073).
 * This is the first real archival-API integration in this repo — every other adapter to date
 * (Wikimedia, federal) only parses fixture/pre-fetched shapes. SPN is authenticated, submits a
 * URL for capture, and returns a job id the caller polls until the capture resolves to a
 * `https://web.archive.org/web/<timestamp>/<url>` pointer.
 */

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
