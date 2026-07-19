/**
 * Reddit deletion-sync wiring: a thin, Reddit-specific adapter
 * over shared purge framework (../../rights/deletion-sync.ts `planDeletionSyncPurge`
 * `applyDeletionSyncPurge`). This module does NOT reimplement purge mechanics it only builds
 * the Reddit-specific cascade targets (quarantine/graylist/research-case-attachment paths for a
 * given stored pointer) and sequences the liveness check that decides whether a purge is needed
 * at all. Reddit's obligation is contractual and binding at 48 hours regardless of privacy-law
 * analysis (../../rights/obligations.ts `defaultSourceObligationsSeed`'s `reddit` entry,
 * `deletionSync.maxHours: 48`) `REDDIT_DELETION_SYNC_MAX_HOURS` below is asserted equal to
 * that registered value in reddit.test.ts so the two never silently drift apart.
 *
 * This is the SCHEDULED, batch sweep half of liveness re-checking. The other, mandatory half
 * a synchronous re-check immediately before human review case attachment lives in
 * ./liveness.ts `assertPointerLiveBeforeReview` and is NOT a special case of this sweep; both
 * must exist and both are tested (see reddit.test.ts and
 * packages/config/src/scheduled-jobs/jobs/reddit-deletion-sync.ts, which calls this module's
 * `sweepRedditPointerLiveness` on a 6-hour cadence).
 */
import type { AuditActor } from '../../audit/index.js';
import {
  applyDeletionSyncPurge,
  planDeletionSyncPurge,
  type DeletionSyncCascadeTarget,
  type DeletionSyncPlan,
  type PurgeableStore,
} from '../../rights/deletion-sync.js';
import type { RedditLivenessChecker, RedditLivenessCheckResult } from './liveness.js';
import { REDDIT_ADAPTER_ID } from './types.js';
import type { RedditStoredPointer } from './types.js';

/** Reddit's contractual deletion-sync window (obligations entry,../../rights/
 * obligations.ts). Purges including snippets must complete within this many hours of an
 * upstream deletion being observed. */
export const REDDIT_DELETION_SYNC_MAX_HOURS = 48;

export type RedditPointerCascadePaths = {
  readonly quarantinePath: string;
  readonly graylistPath?: string;
  readonly researchCaseAttachmentPath?: string;
};

/** Builds the store-agnostic cascade targets for one dead pointer. Always includes the
 * quarantine path (where a freshly-ingested candidate lives before promotion); graylist and
 * research-case-attachment paths are included only when the caller knows the pointer reached
 * those stages "even if disassociated, de-identified or anonymized" retention violates
 * Reddit's terms (text), so every stage a pointer or its snippet could be sitting in must
 * be purged, not just the earliest one. */
export function buildRedditPointerCascadeTargets(
  pointer: RedditStoredPointer,
  paths: RedditPointerCascadePaths,
): readonly DeletionSyncCascadeTarget[] {
  const targets: DeletionSyncCascadeTarget[] = [
    { kind: 'quarantine', path: paths.quarantinePath, id: pointer.id },
  ];
  if (paths.graylistPath) {
    targets.push({ kind: 'graylist', path: paths.graylistPath, id: pointer.id });
  }
  if (paths.researchCaseAttachmentPath) {
    targets.push({ kind: 'research_case_attachment', path: paths.researchCaseAttachmentPath, id: pointer.id });
  }
  return targets;
}

export type PlanRedditPointerPurgeInput = {
  readonly pointer: RedditStoredPointer;
  readonly cascadePaths: RedditPointerCascadePaths;
  readonly reason: string;
  readonly correlationId: string;
  readonly requestedAt: string;
  readonly actor: AuditActor;
};

/** Builds a purge plan for one dead Reddit pointer via the REAL `planDeletionSyncPurge`
 * never a Reddit-specific reimplementation of purge/audit/outbox mechanics. */
export function planRedditPointerPurge(input: PlanRedditPointerPurgeInput): DeletionSyncPlan {
  return planDeletionSyncPurge({
    sourceId: input.pointer.id,
    adapterId: REDDIT_ADAPTER_ID,
    reason: input.reason,
    correlationId: input.correlationId,
    requestedAt: input.requestedAt,
    actor: input.actor,
    cascadeTargets: buildRedditPointerCascadeTargets(input.pointer, input.cascadePaths),
  });
}

export type RedditDeletionSyncSweepOutcome = {
  readonly pointerId: string;
  readonly live: boolean;
  readonly livenessResult: RedditLivenessCheckResult;
  /** Present only for pointers the fresh liveness check found dead the caller (a scheduled
   * job) applies this plan via the REAL `applyDeletionSyncPurge`, see below. */
  readonly purgePlan?: DeletionSyncPlan;
};

export type SweepRedditPointerLivenessInput = {
  readonly pointers: readonly RedditStoredPointer[];
  readonly checkLiveness: RedditLivenessChecker;
  readonly cascadePathsFor: (pointer: RedditStoredPointer) => RedditPointerCascadePaths;
  readonly correlationIdFor: (pointer: RedditStoredPointer) => string;
  readonly requestedAt: string;
  readonly actor: AuditActor;
  readonly reason?: string;
};

/**
 * Scheduled sweep: re-checks liveness for every supplied stored pointer and builds a real purge
 * plan for any pointer no longer live. Pure aside from the injected `checkLiveness` I/O port
 * callers execute the returned `purgePlan.mutations` against their own store via
 * `applyRedditPointerPurge` below (re-exported straight from, not reimplemented).
 */
export async function sweepRedditPointerLiveness(
  input: SweepRedditPointerLivenessInput,
): Promise<readonly RedditDeletionSyncSweepOutcome[]> {
  const reason = input.reason ?? `Reddit deletion-sync liveness sweep (<= ${REDDIT_DELETION_SYNC_MAX_HOURS}h contractual window)`;
  const outcomes: RedditDeletionSyncSweepOutcome[] = [];
  for (const pointer of input.pointers) {
    const livenessResult = await input.checkLiveness(pointer);
    if (livenessResult.live) {
      outcomes.push({ pointerId: pointer.id, live: true, livenessResult });
      continue;
    }
    const purgePlan = planRedditPointerPurge({
      pointer,
      cascadePaths: input.cascadePathsFor(pointer),
      reason,
      correlationId: input.correlationIdFor(pointer),
      requestedAt: input.requestedAt,
      actor: input.actor,
    });
    outcomes.push({ pointerId: pointer.id, live: false, livenessResult, purgePlan });
  }
  return outcomes;
}

/** Re-exported, not reimplemented applies a purge plan's mutations against any store exposing
 * `delete` (../../rights/deletion-sync.ts). */
export { applyDeletionSyncPurge as applyRedditPointerPurge };
export type { PurgeableStore as RedditPurgeableStore };
