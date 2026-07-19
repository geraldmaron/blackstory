/**
 * Per-subject verification STATE (the related workstream): `lastVerifiedAt`, `nextReviewAt`,
 * `verificationStatus`, `verificationPolicyId`, `lastVerificationRunId`.
 *
 * Design choice — a SEPARATE type keyed by `(subjectType, subjectId)`, rather than adding these
 * 4 fields directly onto `CanonicalClaim` (`../claims/claim.ts`, which already carries
 * `lastVerifiedAt`/`lastVerifiedVersionId` per the related workstream) or `EntityRelationship`
 * (`../relationship.ts`, already carries `lastVerifiedAt` per the related workstream):
 *
 *  1. Entities need the same state shape, but `../entity.ts` is explicitly off-limits this pass
 *     (large file, recently touched by other work). A single `VerificationState` type usable
 *     for claims, relationships, AND entities means the due-record selector and candidate-update
 *     flow (`./due.ts`, `./candidate-update.ts`) have one shape to work with instead of three
 *     parallel branches, one of which (entity) couldn't be embedded even if desired.
 *  2. Blast radius: `claim.ts` and `relationship.ts` are both actively-touched shared files this
 *     session (per this session's own guardrails: prefer new files over editing shared existing
 *     ones). A separate keyed-by-id table is strictly additive with zero risk to any existing
 *     consumer of `CanonicalClaim`/`EntityRelationship` shape.
 *  3. Cardinality/nature: verification state is operational scheduling metadata ("did a bot
 *     check this, is a re-check due"), not editorial content — the same separation
 *     `../adapters/types.ts` already draws between `SourceRegistryEntry` (operational) and the
 *     `EvidenceSource`/candidate records it governs.
 *
 * The two existing `lastVerifiedAt` fields on `CanonicalClaim`/`EntityRelationship` are left
 * untouched; a `VerificationState` for a given subject is additional bookkeeping, not a
 * replacement. A future pass could reconcile them, but that is out of scope here.
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
