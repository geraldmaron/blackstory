/**
 * Operational verification state keyed by subject type and id, shared across claims,
 * relationships and entities. Due-record selection reads this shape independently of editorial
 * content. It supplements the subject's verification metadata; callers must keep their apply
 * paths consistent.
 */

export const VERIFICATION_STATUSES = ['current', 'due', 'overdue', 'unverified'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export function isVerificationStatus(value: string): value is VerificationStatus {
  return (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export const VERIFICATION_SUBJECT_TYPES = ['claim', 'relationship', 'entity'] as const;
export type VerificationSubjectType = (typeof VERIFICATION_SUBJECT_TYPES)[number];

export function isVerificationSubjectType(value: string): value is VerificationSubjectType {
  return (VERIFICATION_SUBJECT_TYPES as readonly string[]).includes(value);
}

export type VerificationState = {
  readonly subjectType: VerificationSubjectType;
  /** The claim/relationship/entity id this state describes. */
  readonly subjectId: string;
  /** The `VerificationPolicy.id` (`./policy.ts`) currently governing this subject, if resolved. */
  readonly verificationPolicyId?: string;
  readonly verificationStatus: VerificationStatus;
  /** ISO timestamp of the last independent verification pass, if any. */
  readonly lastVerifiedAt?: string;
  /** ISO timestamp this subject is next due for re-verification, if scheduled. */
  readonly nextReviewAt?: string;
  /** Id of the verification run (see `./candidate-update.ts`) that last touched this state. */
  readonly lastVerificationRunId?: string;
  readonly updatedAt: string;
};

export function assertVerificationStateValid(state: VerificationState): void {
  if (!isVerificationSubjectType(state.subjectType)) {
    throw new Error(`Unknown verification subjectType: ${state.subjectType}`);
  }
  if (!state.subjectId.trim()) {
    throw new Error('VerificationState subjectId is required');
  }
  if (!isVerificationStatus(state.verificationStatus)) {
    throw new Error(`Unknown verification status: ${state.verificationStatus}`);
  }
}
