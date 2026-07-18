/**
 * `CandidateUpdate` (the related workstream): the critical invariant from the bead is that a refresh
 * must NEVER directly overwrite public truth — it produces a candidate that enters the normal
 * review pipeline instead. This module models that candidate and the pure function that
 * produces one from a verification run's observation.
 *
 * `createCandidateUpdateFromVerificationRun` below takes only primitive/plain-data inputs (an
 * id, ids, strings, an ISO timestamp) — never the `CanonicalClaim`/`EntityRelationship` object
 * itself — so there is no reference through which it COULD mutate the subject it's checking,
 * by construction. See `candidate-update.test.ts` for a test that also verifies this
 * behaviorally (running a check against a frozen claim throws if anything attempts to write to
 * it, and the claim is unchanged afterward).
 *
 * Not wired into the release builder (`../publication/release-builder.ts`) or any publish path
 * — a `CandidateUpdate` with `status: 'accepted'` still requires whatever separate review/apply
 * step turns accepted candidates into an actual new claim version, same as any other
 * human-reviewed proposal.
 */
import type { VerificationSubjectType } from './state.js';

export const CANDIDATE_UPDATE_STATUSES = ['pending_review', 'accepted', 'rejected'] as const;
export type CandidateUpdateStatus = (typeof CANDIDATE_UPDATE_STATUSES)[number];

export function isCandidateUpdateStatus(value: string): value is CandidateUpdateStatus {
  return (CANDIDATE_UPDATE_STATUSES as readonly string[]).includes(value);
}

export type CandidateUpdate = {
  readonly id: string;
  readonly subjectType: VerificationSubjectType;
  /** The claim/relationship/entity id this candidate proposes to update. */
  readonly subjectId: string;
  /** The predicate a verification run checked, when the subject is a claim. */
  readonly predicate?: string;
  /** The subject's value as of the verification run, for diffing/audit. */
  readonly previousValue?: string;
  /** The newly observed value, when the run found a difference. Absent when the run confirmed
   * the existing value still holds (a "no change" verification is still recorded, see
   * `createCandidateUpdateFromVerificationRun` below, but proposes nothing). */
  readonly proposedValue?: string;
  /** The verification run (see `./due.ts` selector output) that produced this candidate. */
  readonly verificationRunId: string;
  readonly status: CandidateUpdateStatus;
  readonly createdAt: string;
  readonly notes?: string;
};

export function assertCandidateUpdateValid(update: CandidateUpdate): void {
  if (!update.id.trim()) throw new Error('CandidateUpdate id is required');
  if (!update.subjectId.trim()) throw new Error('CandidateUpdate subjectId is required');
  if (!update.verificationRunId.trim()) {
    throw new Error('CandidateUpdate verificationRunId is required');
  }
  if (!isCandidateUpdateStatus(update.status)) {
    throw new Error(`Unknown CandidateUpdate status: ${update.status}`);
  }
}

/**
 * Builds a `CandidateUpdate` from a verification run's observation. Takes only plain data
 * (ids/strings/timestamp) — never a live reference to the claim/relationship/entity being
 * checked — so it structurally cannot write back to public truth. Always returns
 * `status: 'pending_review'`: acceptance/rejection is a separate, later, human review decision
 * this function does not make.
 *
 * When `observedValue` matches `previousValue` (verification confirmed the existing value), the
 * returned candidate still records the run (for audit — "this was checked, nothing changed")
 * but omits `proposedValue`, since there is no proposed *change* to review.
 */
export function createCandidateUpdateFromVerificationRun(input: {
  readonly id: string;
  readonly subjectType: VerificationSubjectType;
  readonly subjectId: string;
  readonly predicate?: string;
  readonly previousValue?: string;
  readonly observedValue?: string;
  readonly verificationRunId: string;
  readonly now: string;
  readonly notes?: string;
}): CandidateUpdate {
  const proposesChange =
    input.observedValue !== undefined && input.observedValue !== input.previousValue;
  return {
    id: input.id,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    ...(input.predicate !== undefined ? { predicate: input.predicate } : {}),
    ...(input.previousValue !== undefined ? { previousValue: input.previousValue } : {}),
    ...(proposesChange ? { proposedValue: input.observedValue as string } : {}),
    verificationRunId: input.verificationRunId,
    status: 'pending_review',
    createdAt: input.now,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}
