/**
 * Maps internal moderation states to public-safe status surfaces. Never
 * exposes spam scores, campaign detection, duplicate lists, or other moderation-sensitive data.
 */
import type { SubmissionModerationState } from '@blap/security';

export type PublicCorrectionPhase = 'received' | 'under_review' | 'closed';

export type PublicCorrectionStatus = {
  readonly phase: PublicCorrectionPhase;
  readonly receiptCode: string;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly appealAvailable: boolean;
  readonly classificationDispute: boolean;
};

export type PublicClosureReason = 'resolved' | 'rejected' | 'withdrawn';

export function mapModerationToPublicPhase(
  moderationState: SubmissionModerationState,
  closureReason?: PublicClosureReason,
): PublicCorrectionPhase {
  if (moderationState === 'resolved' || moderationState === 'blocked') {
    return 'closed';
  }
  if (closureReason === 'rejected' || closureReason === 'withdrawn') {
    return 'closed';
  }
  if (
    moderationState === 'pending_review' ||
    moderationState === 'flagged' ||
    moderationState === 'duplicate' ||
    moderationState === 'coordinated_campaign'
  ) {
    return moderationState === 'pending_review' ? 'received' : 'under_review';
  }
  return 'under_review';
}

export function isAppealEligible(input: {
  readonly phase: PublicCorrectionPhase;
  readonly closureReason?: PublicClosureReason;
  readonly classificationDispute: boolean;
  readonly appealCount: number;
}): boolean {
  if (input.appealCount >= 1) return false;
  if (input.classificationDispute && input.phase === 'closed') return true;
  return input.phase === 'closed' && input.closureReason === 'rejected';
}

export function buildPublicCorrectionStatus(input: {
  readonly receiptCode: string;
  readonly moderationState: SubmissionModerationState;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly classificationDispute: boolean;
  readonly closureReason?: PublicClosureReason;
  readonly appealCount: number;
}): PublicCorrectionStatus {
  const phase = mapModerationToPublicPhase(input.moderationState, input.closureReason);
  return {
    phase,
    receiptCode: input.receiptCode,
    submittedAt: input.submittedAt,
    updatedAt: input.updatedAt,
    appealAvailable: isAppealEligible({
      phase,
      ...(input.closureReason ? { closureReason: input.closureReason } : {}),
      classificationDispute: input.classificationDispute,
      appealCount: input.appealCount,
    }),
    classificationDispute: input.classificationDispute,
  };
}
