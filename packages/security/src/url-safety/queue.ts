/**
 * Defines the asynchronous URL-evaluation job and quarantine lifecycle.
 * Submission handlers may enqueue this immutable contract but must never fetch;
 * fetched content remains non-publishable even after validation.
 */
import { createHash, randomUUID } from 'node:crypto';
import { URL_SAFETY_POLICY_VERSION } from './policy.js';

export type UrlEvaluationState =
  | 'queued'
  | 'fetching'
  | 'validating'
  | 'validated'
  | 'rejected';

export type UrlEvaluationJob = {
  readonly id: string;
  readonly submissionId: string;
  readonly submittedUrl: string;
  readonly submittedUrlHash: string;
  readonly state: 'queued';
  readonly queue: 'url-evaluation';
  readonly createdAt: string;
  readonly policyVersion: typeof URL_SAFETY_POLICY_VERSION;
  readonly quarantineRequired: true;
  readonly canonicalWriteAllowed: false;
  readonly fetchDuringSubmissionRequest: false;
};

export type UrlEvaluationRecord = {
  readonly jobId: string;
  readonly state: UrlEvaluationState;
  readonly quarantineRequired: true;
  readonly canonicalWriteAllowed: false;
  readonly publicationAllowed: false;
  readonly contentHash?: string;
  readonly malwareIndicators?: readonly string[];
};

/** Creates queue data only; this function has no resolver or network dependency by design. */
export function createUrlEvaluationJob(
  submissionId: string,
  submittedUrl: string,
  nowMs: number = Date.now(),
): UrlEvaluationJob {
  return Object.freeze({
    id: randomUUID(),
    submissionId,
    submittedUrl,
    submittedUrlHash: createHash('sha256').update(submittedUrl).digest('hex'),
    state: 'queued',
    queue: 'url-evaluation',
    createdAt: new Date(nowMs).toISOString(),
    policyVersion: URL_SAFETY_POLICY_VERSION,
    quarantineRequired: true,
    canonicalWriteAllowed: false,
    fetchDuringSubmissionRequest: false,
  });
}

/** Applies a fail-closed lifecycle transition while retaining quarantine. */
export function transitionUrlEvaluation(
  record: UrlEvaluationRecord,
  nextState: UrlEvaluationState,
  evidence: {
    readonly contentHash?: string;
    readonly malwareIndicators?: readonly string[];
  } = {},
): UrlEvaluationRecord {
  const allowed: Readonly<Record<UrlEvaluationState, readonly UrlEvaluationState[]>> = {
    queued: ['fetching', 'rejected'],
    fetching: ['validating', 'rejected'],
    validating: ['validated', 'rejected'],
    validated: [],
    rejected: [],
  };
  if (!allowed[record.state].includes(nextState)) {
    throw new Error(`Invalid URL evaluation transition: ${record.state} -> ${nextState}`);
  }
  if (nextState === 'validated' && !evidence.contentHash) {
    throw new Error('Validated URL content requires a content hash');
  }
  return Object.freeze({
    jobId: record.jobId,
    state: nextState,
    quarantineRequired: true,
    canonicalWriteAllowed: false,
    publicationAllowed: false,
    ...(evidence.contentHash !== undefined ? { contentHash: evidence.contentHash } : {}),
    ...(evidence.malwareIndicators !== undefined
      ? { malwareIndicators: [...evidence.malwareIndicators] }
      : {}),
  });
}
