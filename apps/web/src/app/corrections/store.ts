/** In-memory correction store for tests; production uses lib/public-data/corrections-store. */
import type { QuarantinedSubmissionRecord } from '@repo/security';
import { createReceiptCode, digestReceiptCode } from './receipt-code';
import type { CorrectionCategory, CorrectionTargetType } from './categories';
import { buildPublicCorrectionStatus, type PublicClosureReason } from './public-status';

export type StoredAppeal = {
  readonly id: string;
  readonly statement: string;
  readonly submittedAt: string;
  readonly record?: QuarantinedSubmissionRecord;
};

export type StoredCorrection = {
  readonly record: QuarantinedSubmissionRecord;
  readonly receiptCode: string;
  readonly intakeStatus?: string;
  readonly receiptDigest: string;
  readonly targetType: CorrectionTargetType;
  readonly category: CorrectionCategory;
  readonly classificationDispute: boolean;
  readonly appeals: readonly StoredAppeal[];
  readonly closureReason?: PublicClosureReason;
  readonly updatedAt: string;
};

/**
 * Async throughout: the production implementation uses Postgres, and a
 * `CorrectionSubmissionStore` local variable must be swappable between that and this in-memory
 * one without the caller knowing which it has.
 */
export type CorrectionSubmissionStore = {
  save(entry: StoredCorrection): Promise<void>;
  getBySubmissionId(id: string): Promise<StoredCorrection | undefined>;
  getByReceiptCode(receiptCode: string, pepper: string): Promise<StoredCorrection | undefined>;
  attachAppeal(
    receiptCode: string,
    pepper: string,
    appeal: StoredAppeal,
  ): Promise<StoredCorrection | undefined>;
  markClosed(
    submissionId: string,
    closureReason: PublicClosureReason,
  ): Promise<StoredCorrection | undefined>;
};

export function createCorrectionSubmissionStore(): CorrectionSubmissionStore {
  const bySubmissionId = new Map<string, StoredCorrection>();
  const byReceiptDigest = new Map<string, string>();

  async function getByReceiptCode(
    receiptCode: string,
    pepper: string,
  ): Promise<StoredCorrection | undefined> {
    const digest = digestReceiptCode(receiptCode, pepper);
    if (!digest) return undefined;
    const submissionId = byReceiptDigest.get(digest);
    if (!submissionId) return undefined;
    return bySubmissionId.get(submissionId);
  }

  return {
    async save(entry) {
      if (bySubmissionId.has(entry.record.id)) {
        throw new Error('Submission id already exists.');
      }
      bySubmissionId.set(entry.record.id, entry);
      byReceiptDigest.set(entry.receiptDigest, entry.record.id);
    },
    async getBySubmissionId(id) {
      return bySubmissionId.get(id);
    },
    getByReceiptCode,
    async attachAppeal(receiptCode, pepper, appeal) {
      const existing = await getByReceiptCode(receiptCode, pepper);
      if (!existing) return undefined;
      if (
        !buildPublicCorrectionStatus({
          ...existing,
          moderationState: existing.record.moderationState,
          submittedAt: existing.record.createdAt,
          appealCount: existing.appeals.length,
        }).appealAvailable
      )
        return undefined;
      const { closureReason: _closureReason, ...reopened } = existing;
      const updated: StoredCorrection = {
        ...reopened,
        intakeStatus: 'quarantined',
        appeals: [...existing.appeals, appeal],
        updatedAt: appeal.submittedAt,
        record: {
          ...existing.record,
          moderationState: 'pending_review',
        },
      };
      bySubmissionId.set(existing.record.id, updated);
      return updated;
    },
    async markClosed(submissionId, closureReason) {
      const existing = bySubmissionId.get(submissionId);
      if (!existing) return undefined;
      const updated: StoredCorrection = {
        ...existing,
        closureReason,
        updatedAt: new Date().toISOString(),
        record: {
          ...existing.record,
          moderationState: closureReason === 'rejected' ? 'blocked' : 'resolved',
        },
      };
      bySubmissionId.set(submissionId, updated);
      return updated;
    },
  };
}

export function buildStoredCorrection(input: {
  readonly record: QuarantinedSubmissionRecord;
  readonly pepper: string;
  readonly targetType: CorrectionTargetType;
  readonly category: CorrectionCategory;
  readonly classificationDispute: boolean;
}): StoredCorrection {
  const receiptCode = createReceiptCode(input.record.id, input.pepper);
  const receiptDigest = digestReceiptCode(receiptCode, input.pepper);
  if (!receiptDigest) {
    throw new Error('Failed to derive receipt digest.');
  }
  return {
    record: input.record,
    receiptCode,
    receiptDigest,
    targetType: input.targetType,
    category: input.category,
    classificationDispute: input.classificationDispute,
    appeals: [],
    updatedAt: input.record.createdAt,
  };
}
