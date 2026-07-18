/**
 * every discovered URL gets a Wayback SPN capture pointer
 * BEFORE it is review-eligible. This module is the ordering gate it never lets a candidate
 * become "review eligible" without first awaiting a real capture and validating the resulting
 * pointer against the evidence-pointer doctrine (../../../rights/evidence-pointer.ts).
 */
import { assertEvidencePointerValid, buildEvidencePointer, type EvidencePointer } from '../../../rights/evidence-pointer.js';
import { mapWithConcurrency, type SafeHttpClient } from '../shared/http-port.js';
import { buildWaybackCaptureUrl, pollSpnStatus, submitSpnCapture } from './client.js';
import type { SpnCredentials } from './types.js';

export type CaptureAwareCandidate<TCandidate> = {
  readonly candidate: TCandidate;
  readonly capturePointer: EvidencePointer;
  /** Only ever true a candidate without a valid capture pointer never reaches this shape. */
  readonly reviewEligible: true;
};

/**
 * Submits `targetUrl` to Wayback SPN2, polls until the capture resolves, and returns a
 * validated EvidencePointer. Throws (fails closed) on any SPN error or timeout callers
 * must not fabricate a pointer or mark a candidate review-eligible when this rejects.
 */
export async function captureUrlToEvidencePointer(input: {
  readonly client: SafeHttpClient;
  readonly credentials: SpnCredentials;
  readonly targetUrl: string;
  readonly snippet: string;
  readonly adapterId: string;
  readonly parserVersion?: string;
  readonly now: string;
  readonly idPrefix?: string;
}): Promise<EvidencePointer> {
  const submitted = await submitSpnCapture(input.client, input.credentials, input.targetUrl);
  const status = await pollSpnStatus(input.client, submitted.jobId);

  if (status.status !== 'success' || !status.timestamp) {
    throw new Error(
      `Wayback SPN capture did not succeed for ${input.targetUrl} (status=${status.status}${
        status.message ? `, message=${status.message}` : ''
      })`,
    );
  }

  const waybackCaptureUrl = buildWaybackCaptureUrl(status.timestamp, status.originalUrl ?? input.targetUrl);
  const capturedAtIso = parseWaybackTimestamp(status.timestamp) ?? input.now;

  return buildEvidencePointer({
    id: `${input.idPrefix ?? 'evp'}_${submitted.jobId}`,
    sourceUrl: input.targetUrl,
    snippet: input.snippet,
    waybackCaptureUrl,
    waybackCapturedAt: capturedAtIso,
    retrieval: {
      retrievedAt: input.now,
      adapterId: input.adapterId,
      ...(input.parserVersion !== undefined ? { parserVersion: input.parserVersion } : {}),
    },
    createdAt: input.now,
  });
}

function parseWaybackTimestamp(timestamp: string): string | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(timestamp);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? undefined : iso;
}

/**
 * Attaches a capture pointer to a candidate and returns a shape that can ONLY be constructed
 * after a successful, validated capture there is no code path that produces
 * `CaptureAwareCandidate` without awaiting `capture` first. This is the ordering invariant
 * requires, enforced structurally rather than by convention.
 */
export async function requireCaptureBeforeReview<TCandidate>(
  candidate: TCandidate,
  targetUrl: string,
  capture: (url: string) => Promise<EvidencePointer>,
): Promise<CaptureAwareCandidate<TCandidate>> {
  if (!targetUrl.trim()) {
    throw new Error('Candidate has no canonical URL to capture — cannot become review-eligible');
  }
  const capturePointer = await capture(targetUrl);
  assertEvidencePointerValid(capturePointer);
  return { candidate, capturePointer, reviewEligible: true };
}

/** Fail-closed re-check: throws unless `input` already carries a validated capture pointer. */
export function assertReviewEligible(input: {
  readonly capturePointer?: EvidencePointer;
}): asserts input is { readonly capturePointer: EvidencePointer } {
  if (!input.capturePointer) {
    throw new Error(
      'Candidate is not review-eligible: missing the mandatory Wayback capture pointer ( acceptance criterion 2)',
    );
  }
  assertEvidencePointerValid(input.capturePointer);
}

/**
 * Batch entry point every community adapter (RSS, Internet Archive, DPLA v2) is meant to
 * call on its normalized output: submits every candidate's `canonicalUrl` to Wayback SPN with
 * modest bounded concurrency (never unbounded fan-out) and returns only candidates that cleared
 * `requireCaptureBeforeReview`. Fails closed on the whole batch if any candidate's capture
 * rejects or lacks a capturable URL a discovered URL either gets a real pointer or the run
 * surfaces the error, never a silently-missing pointer.
 */
export async function requireCaptureForAllCandidates<TCandidate extends { readonly canonicalUrl?: string }>(
  candidates: readonly TCandidate[],
  input: {
    readonly client: SafeHttpClient;
    readonly credentials: SpnCredentials;
    readonly snippetFor: (candidate: TCandidate) => string;
    readonly adapterId: string;
    readonly now: string;
    readonly concurrency?: number;
  },
): Promise<readonly CaptureAwareCandidate<TCandidate>[]> {
  return mapWithConcurrency(candidates, input.concurrency ?? 3, (candidate) =>
    requireCaptureBeforeReview(candidate, candidate.canonicalUrl ?? '', (url) =>
      captureUrlToEvidencePointer({
        client: input.client,
        credentials: input.credentials,
        targetUrl: url,
        snippet: input.snippetFor(candidate),
        adapterId: input.adapterId,
        now: input.now,
      }),
    ),
  );
}
