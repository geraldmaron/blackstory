/** Rights-aware, resumable Save Page Now jobs. Polling resumes without resubmitting a URL. */
import {
  buildWaybackCaptureUrl,
  parseWaybackCaptureUrl,
  pollSpnStatus,
  submitSpnCapture,
  type SafeHttpClient,
  type SpnCredentials,
} from '@repo/domain';
import { assertContract, type PreservationDecision } from '@repo/research-kernel';
import type { QueryablePool } from './model-invocation-log.js';

export type WaybackAnchorAttempt =
  | {
      readonly status: 'anchored';
      readonly waybackCaptureUrl: string;
      readonly waybackCapturedAt: string;
    }
  | { readonly status: 'pending'; readonly jobId: string }
  | { readonly status: 'failed'; readonly reason: string };
export type WaybackAnchor = {
  captureUrl(targetUrl: string, contentHashDigest: string): Promise<WaybackAnchorAttempt>;
};
export type WaybackJob = {
  created: boolean;
  state: 'reserved' | 'pending' | 'anchored' | 'failed';
  jobId: string | null;
  result: WaybackAnchorAttempt | null;
};
export type WaybackJobStore = {
  reserve(
    url: string,
    contentHashDigest: string,
    decision: PreservationDecision,
  ): Promise<WaybackJob>;
  submitted(url: string, contentHashDigest: string, jobId: string): Promise<void>;
  finish(url: string, contentHashDigest: string, result: WaybackAnchorAttempt): Promise<void>;
};

const SHA256_DIGEST = /^[a-f0-9]{64}$/;

export function createPostgresWaybackJobStore(db: QueryablePool): WaybackJobStore {
  return {
    async reserve(url, contentHashDigest, decision) {
      const created = await db.query(
        `INSERT INTO research.preservation_jobs (source_url,content_hash_digest,state,decision)
        VALUES ($1,$2,'reserved',$3::jsonb)
        ON CONFLICT (source_url,content_hash_digest) DO NOTHING
        RETURNING source_url,content_hash_digest`,
        [url, contentHashDigest, JSON.stringify(decision)],
      );
      const row = (
        await db.query(
          `SELECT state,job_id,result FROM research.preservation_jobs
           WHERE source_url=$1 AND content_hash_digest=$2`,
          [url, contentHashDigest],
        )
      ).rows[0];
      if (!row) throw new Error('Preservation reservation is missing');
      return {
        created: created.rows.length > 0,
        state: row.state as WaybackJob['state'],
        jobId: row.job_id as string | null,
        result: row.result as WaybackAnchorAttempt | null,
      };
    },
    async submitted(url, contentHashDigest, jobId) {
      await db.query(
        `UPDATE research.preservation_jobs
         SET state='pending',job_id=$3,updated_at=clock_timestamp()
         WHERE source_url=$1 AND content_hash_digest=$2 AND state='reserved'`,
        [url, contentHashDigest, jobId],
      );
    },
    async finish(url, contentHashDigest, result) {
      await db.query(
        `UPDATE research.preservation_jobs
         SET state=$3,result=$4::jsonb,updated_at=clock_timestamp()
         WHERE source_url=$1 AND content_hash_digest=$2`,
        [
          url,
          contentHashDigest,
          result.status === 'anchored'
            ? 'anchored'
            : result.status === 'pending'
              ? 'pending'
              : 'failed',
          JSON.stringify(result),
        ],
      );
    },
  };
}

export function validatePreservationDecision(
  value: unknown,
  url: string,
  now: string,
): PreservationDecision {
  const decision = assertContract('PreservationDecision', value);
  if (decision.sourceUrl !== url)
    throw new Error('Preservation decision belongs to a different source URL');
  if (
    Date.parse(decision.reviewedAt) > Date.parse(now) ||
    Date.parse(decision.expiresAt) <= Date.parse(now)
  ) {
    throw new Error('Preservation decision is not current');
  }
  if (decision.allowArchive && decision.sensitivity !== 'public')
    throw new Error('Public archiving requires a public sensitivity decision');
  return decision;
}

export type CreateWaybackAnchorInput = {
  readonly client: SafeHttpClient;
  readonly credentials: SpnCredentials;
  readonly now: () => string;
  readonly decisionForUrl: (url: string) => PreservationDecision | undefined;
  readonly jobs: WaybackJobStore;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly maxAttempts?: number;
  readonly delayMs?: number;
};

export function createWaybackAnchor(input: CreateWaybackAnchorInput): WaybackAnchor {
  return {
    async captureUrl(targetUrl, contentHashDigest) {
      let job: WaybackJob | undefined;
      try {
        if (!SHA256_DIGEST.test(contentHashDigest))
          return { status: 'failed', reason: 'invalid_content_revision' };
        const decision = validatePreservationDecision(
          input.decisionForUrl(targetUrl),
          targetUrl,
          input.now(),
        );
        if (!decision.allowArchive)
          return { status: 'failed', reason: 'source_policy_disallows_archiving' };
        job = await input.jobs.reserve(targetUrl, contentHashDigest, decision);
        if (job.result && job.state !== 'pending') return job.result;
        let jobId = job.jobId;
        if (job.created) {
          // An uncertain POST cannot safely be retried. Save the reservation before dispatch.
          const submitted = await submitSpnCapture(input.client, input.credentials, targetUrl, {
            retries: 0,
          });
          jobId = submitted.jobId;
          await input.jobs.submitted(targetUrl, contentHashDigest, jobId);
        }
        if (!jobId)
          return { status: 'failed', reason: 'submission_outcome_unknown_requires_reconciliation' };
        const status = await pollSpnStatus(input.client, jobId, {
          ...(input.sleep ? { sleep: input.sleep } : {}),
          ...(input.maxAttempts !== undefined ? { maxAttempts: input.maxAttempts } : {}),
          ...(input.delayMs !== undefined ? { delayMs: input.delayMs } : {}),
        });
        let result: WaybackAnchorAttempt;
        if (status.status === 'pending') result = { status: 'pending', jobId };
        else if (status.status === 'success' && status.timestamp) {
          const url = buildWaybackCaptureUrl(status.timestamp, status.originalUrl ?? targetUrl);
          const pointer = parseWaybackCaptureUrl(url, targetUrl);
          if (!pointer) throw new Error('Archive response does not match the requested source');
          result = {
            status: 'anchored',
            waybackCaptureUrl: pointer.url,
            waybackCapturedAt: pointer.capturedAt,
          };
        } else result = { status: 'failed', reason: status.message ?? 'archive_capture_failed' };
        await input.jobs.finish(targetUrl, contentHashDigest, result);
        return result;
      } catch (error) {
        // Retain the job id or uncertain reservation so a later run cannot duplicate submission.
        return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

export function attachWaybackMetadata(
  storageObject: Record<string, unknown>,
  attempt: WaybackAnchorAttempt,
): Record<string, unknown> {
  if (attempt.status === 'anchored')
    return {
      ...storageObject,
      waybackStatus: 'anchored',
      waybackCaptureUrl: attempt.waybackCaptureUrl,
      waybackCapturedAt: attempt.waybackCapturedAt,
    };
  if (attempt.status === 'pending')
    return { ...storageObject, waybackStatus: 'pending', waybackJobId: attempt.jobId };
  return { ...storageObject, waybackStatus: 'failed', waybackReason: attempt.reason };
}
