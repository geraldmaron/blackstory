/**
 * REAL roster entry: Reddit deletion-sync. Wraps `@repo/domain`'s
 * Reddit deletion-sync module (packages/domain/src/adapters/reddit/deletion-sync.ts), which in
 * turn wraps shared purge framework (`planDeletionSyncPurge`/`applyDeletionSyncPurge`,
 * packages/domain/src/rights/deletion-sync.ts) — this file does not reimplement purge, audit, or
 * liveness-classification mechanics; it only sequences the scheduled sweep and hands its output
 * to `startJobRun`/`completeJobRun` so it can be dispatched through this registry, exactly like
 * ./source-drift-run-health.ts and ./citation-link-health-sweep.ts do for their own domains.
 *
 * `checkLiveness` (the Reddit liveness-checking I/O port,
 * packages/domain/src/adapters/reddit/liveness.ts `RedditLivenessChecker`) is a REQUIRED input
 * with no default network implementation here unlike ./citation-link-health-sweep.ts, which
 * defaults to a Node-backed fetcher because arbitrary citation URLs need no special
 * authentication. Reddit's liveness lookup requires an OAuth bearer token that does not exist
 * until the Responsible Builder application (a HUMAN STEP see
 * packages/domain/src/adapters/reddit/contract.ts) is approved and credentials are provisioned;
 * encoding an unauthenticated default here would just reproduce the exact 403 those
 * research documents describe. Once approval lands, production wiring supplies a real checker built on
 * `checkRedditPostLivenessViaListingLookup` (same domain module) plus a concrete
 * `SafeHttpClient`. Tests inject a fixture-driven fake zero live network calls happen here or
 * in this file's test.
 *
 * `pointers` and `purgeStore` are likewise caller-supplied: this job is store-agnostic (mirrors
 * `PurgeableStore` in packages/domain/src/rights/deletion-sync.ts) so a Firestore-backed adapter
 * (outside this package's scope) can plug in its own pointer source and delete implementation
 * without this job body changing.
 */
import {
  applyRedditPointerPurge,
  sweepRedditPointerLiveness,
  type RedditDeletionSyncSweepOutcome,
  type RedditLivenessChecker,
  type RedditPointerCascadePaths,
  type RedditPurgeableStore,
  type RedditStoredPointer,
} from '@repo/domain';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const REDDIT_DELETION_SYNC_JOB_ID = 'reddit-deletion-sync';

export type RedditDeletionSyncJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly pointers: readonly RedditStoredPointer[];
  readonly checkLiveness: RedditLivenessChecker;
  readonly cascadePathsFor: (pointer: RedditStoredPointer) => RedditPointerCascadePaths;
  readonly correlationIdFor: (pointer: RedditStoredPointer) => string;
  readonly actor: { readonly id: string; readonly type: 'user' | 'service' | 'system' };
  readonly purgeStore: RedditPurgeableStore;
};

export type RedditDeletionSyncJobResult = {
  readonly run: JobRunRecord;
  readonly outcomes: readonly RedditDeletionSyncSweepOutcome[];
  readonly summary: {
    readonly checked: number;
    readonly stillLive: number;
    readonly purged: number;
  };
};

/**
 * Runs one scheduled Reddit deletion-sync sweep: re-checks liveness for every supplied pointer
 * via the real domain-layer sweep, then applies every resulting purge plan's mutations against
 * `purgeStore` via the real `applyDeletionSyncPurge` (re-exported as
 * `applyRedditPointerPurge`) never a re-derived delete.
 */
export async function runRedditDeletionSyncJob(
  input: RedditDeletionSyncJobInput,
): Promise<RedditDeletionSyncJobResult> {
  const started = startJobRun({
    jobId: REDDIT_DELETION_SYNC_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });

  const outcomes = await sweepRedditPointerLiveness({
    pointers: input.pointers,
    checkLiveness: input.checkLiveness,
    cascadePathsFor: input.cascadePathsFor,
    correlationIdFor: input.correlationIdFor,
    requestedAt: input.completedAt,
    actor: input.actor,
  });

  for (const outcome of outcomes) {
    if (outcome.purgePlan) {
      applyRedditPointerPurge(input.purgeStore, outcome.purgePlan);
    }
  }

  const purged = outcomes.filter((outcome) => outcome.purgePlan).length;
  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.pointers.length,
    itemsProcessed: outcomes.length,
    issues: outcomes
      .filter((outcome) => outcome.purgePlan)
      .map((outcome) => `${outcome.pointerId}:purged`),
  });

  return {
    run,
    outcomes,
    summary: {
      checked: outcomes.length,
      stillLive: outcomes.length - purged,
      purged,
    },
  };
}
