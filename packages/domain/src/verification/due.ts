/**
 * Pure due-record logic (the related workstream): decides whether a subject is due for
 * re-verification, and derives its `VerificationStatus`. No I/O — a real scheduled job supplies
 * the subject list via a `VerificationStateProvider` and reads `now` from its own clock.
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

/** Supplies the full set of `VerificationState` records a due-record sweep should consider. A
 * real scheduled job's implementation would page a Firestore/`verificationStates`-shaped query;
 * tests and small callers can supply a plain array literal (`() => states`). */
export type VerificationStateProvider = () => readonly VerificationState[];

/** Pure selector: given a provider and `now`, returns every subject whose `nextReviewAt` is due
 * (or which was never scheduled). Building the actual scheduled cron job / Firestore query
 * index that implements `VerificationStateProvider` for production is explicitly out of scope
 * for this pass — this is the domain logic a future job calls. */
export function selectDueVerificationStates(
  provider: VerificationStateProvider,
  now: string,
): readonly VerificationState[] {
  return provider().filter((state) => isRecordDue(state.nextReviewAt, now));
}
