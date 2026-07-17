/**
 * Wayback SPN2 client: submit-and-poll, through the BB-030 safe HTTP port (BB-073).
 * Authenticated (`Authorization: LOW <access>:<secret>`), modest concurrency via
 * ../shared/http-port.ts's `mapWithConcurrency`, retry-on-429 via `withRetry`. Never calls
 * `fetch` directly. The API key pair is always injected by the caller — never read from a
 * hardcoded constant in this module (see .env.example DPLA_API_KEY entry for the analogous
 * "production values live in Secret Manager" convention; SPN credentials follow the same rule).
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  withRetry,
  type SafeHttpClient,
} from '../shared/http-port.js';
import { waybackSpnStatusUrl, WAYBACK_SPN_SUBMIT_URL } from './types.js';
import type { SpnCredentials, SpnStatus, SpnStatusResult, SpnSubmitResult } from './types.js';

const SPN_ALLOWED_CONTENT_TYPES = ['application/json'];

function buildAuthorizationHeader(credentials: SpnCredentials): string {
  if (!credentials.accessKey.trim() || !credentials.secretKey.trim()) {
    throw new Error('Wayback SPN credentials (accessKey/secretKey) are required');
  }
  return `LOW ${credentials.accessKey}:${credentials.secretKey}`;
}

function parseJsonBody(bodyText: string, context: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error(`${context}: response body was not valid JSON`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${context}: response body must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

/** Submits a URL to Wayback SPN2 for capture. Returns the job id to poll. Retries on 429/5xx. */
export async function submitSpnCapture(
  client: SafeHttpClient,
  credentials: SpnCredentials,
  targetUrl: string,
  options: { readonly retries?: number } = {},
): Promise<SpnSubmitResult> {
  // Computed once, outside withRetry: a credential-validation error is not a transient network
  // failure and must fail fast rather than being retried with exponential backoff.
  const authorization = buildAuthorizationHeader(credentials);
  const response = await withRetry(
    () =>
      client({
        url: WAYBACK_SPN_SUBMIT_URL,
        method: 'POST',
        headers: {
          authorization,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: `url=${encodeURIComponent(targetUrl)}&capture_all=1`,
        allowedContentTypes: SPN_ALLOWED_CONTENT_TYPES,
      }),
    { retries: options.retries ?? 4, baseDelayMs: 500, isRetryable: defaultIsRetryable },
  );
  assertAllowedContentType(response, SPN_ALLOWED_CONTENT_TYPES);
  if (response.status >= 400) {
    throw new Error(`Wayback SPN submit failed with status ${response.status}: ${response.bodyText.slice(0, 200)}`);
  }
  const body = parseJsonBody(response.bodyText, 'Wayback SPN submit');
  const jobId = body.job_id;
  if (typeof jobId !== 'string' || !jobId.trim()) {
    throw new Error('Wayback SPN submit response missing job_id');
  }
  return { jobId };
}

function normalizeStatus(raw: unknown): SpnStatus {
  if (raw === 'success' || raw === 'pending' || raw === 'error') {
    return raw;
  }
  return 'error';
}

/** Parses a single `/save/status/<jobId>` response defensively. */
export function parseSpnStatusResponse(raw: unknown): SpnStatusResult {
  if (!raw || typeof raw !== 'object') {
    return { status: 'error', message: 'malformed_status_response' };
  }
  const body = raw as Record<string, unknown>;
  const status = normalizeStatus(body.status);
  return {
    status,
    ...(typeof body.timestamp === 'string' ? { timestamp: body.timestamp } : {}),
    ...(typeof body.original_url === 'string' ? { originalUrl: body.original_url } : {}),
    ...(typeof body.message === 'string' ? { message: body.message } : {}),
  };
}

export type PollSpnStatusOptions = {
  readonly maxAttempts?: number;
  readonly delayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
};

/** Polls job status until it resolves to success/error, or `maxAttempts` is exhausted. */
export async function pollSpnStatus(
  client: SafeHttpClient,
  jobId: string,
  options: PollSpnStatusOptions = {},
): Promise<SpnStatusResult> {
  const maxAttempts = options.maxAttempts ?? 10;
  const delayMs = options.delayMs ?? 1000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await withRetry(
      () =>
        client({
          url: waybackSpnStatusUrl(jobId),
          method: 'GET',
          allowedContentTypes: SPN_ALLOWED_CONTENT_TYPES,
        }),
      { retries: 2, baseDelayMs: 250, isRetryable: defaultIsRetryable },
    );
    assertAllowedContentType(response, SPN_ALLOWED_CONTENT_TYPES);
    const result = parseSpnStatusResponse(parseJsonBody(response.bodyText, 'Wayback SPN status'));
    if (result.status !== 'pending') {
      return result;
    }
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }
  return { status: 'error', message: 'timed_out_waiting_for_capture' };
}

/** Builds the deterministic Wayback capture pointer URL from a completed job's timestamp. */
export function buildWaybackCaptureUrl(timestamp: string, originalUrl: string): string {
  return `https://web.archive.org/web/${timestamp}/${originalUrl}`;
}
