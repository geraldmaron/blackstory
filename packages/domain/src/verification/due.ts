/**
 * Pure due-record selection and status derivation. Callers supply subject states and time; this
 * module installs no scheduled jobs.
 */
import type { VerificationState } from './state.js';
import type { VerificationStatus } from './state.js';

/**
 * True when `now` is at or past `nextReviewAt`. A subject with no `nextReviewAt` at all (never
 * scheduled — e.g. `verificationStatus: 'unverified'`) is treated as due: there is no basis to
 * say it's "current," so it should surface for a first verification pass.
 */
export function isRecordDue(nextReviewAt: string | undefined, now: string): boolean {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) {
    throw new Error('isRecordDue requires a valid ISO date for now');
  }
  if (nextReviewAt === undefined) return true;
  const nextMs = Date.parse(nextReviewAt);
  if (!Number.isFinite(nextMs)) {
    throw new Error('isRecordDue requires a valid ISO date for nextReviewAt');
  }
  return nowMs >= nextMs;
}

/** Fixed grace window after `nextReviewAt` before a merely-`due` record counts as `overdue`.
 * Deliberately a FIXED window, not derived from the governing policy's own interval — a
 * monthly-cadence subject should not get a full extra month of grace before counting as
 * overdue. */
const DEFAULT_OVERDUE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Derives the `VerificationStatus` for a subject relative to `now`:
 *  - `unverified`: never scheduled (no `nextReviewAt`) and never verified (no `lastVerifiedAt`).
 *  - `current`: `now` is before `nextReviewAt`.
 *  - `due`: `now` is at/after `nextReviewAt` but within `overdueGraceMs` of it.
 *  - `overdue`: `now` is more than `overdueGraceMs` past `nextReviewAt`.
 */
export function deriveVerificationStatus(input: {
  readonly lastVerifiedAt?: string;
  readonly nextReviewAt?: string;
  readonly now: string;
  readonly overdueGraceMs?: number;
}): VerificationStatus {
  if (input.lastVerifiedAt === undefined && input.nextReviewAt === undefined) {
    return 'unverified';
  }
  if (input.nextReviewAt === undefined) {
    return 'unverified';
  }
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) {
    throw new Error('deriveVerificationStatus requires a valid ISO date for now');
  }
  const nextMs = Date.parse(input.nextReviewAt);
  if (!Number.isFinite(nextMs)) {
    throw new Error('deriveVerificationStatus requires a valid ISO date for nextReviewAt');
  }
  if (nowMs < nextMs) return 'current';
  const graceMs = input.overdueGraceMs ?? DEFAULT_OVERDUE_GRACE_MS;
  if (nowMs < nextMs + graceMs) return 'due';
  return 'overdue';
}

/** Supplies the bounded set of verification states to examine. */
export type VerificationStateProvider = () => readonly VerificationState[];

/** Select subjects whose next review is due; this function never installs a schedule. */
export function selectDueVerificationStates(
  provider: VerificationStateProvider,
  now: string,
): readonly VerificationState[] {
  return provider().filter((state) => isRecordDue(state.nextReviewAt, now));
}
