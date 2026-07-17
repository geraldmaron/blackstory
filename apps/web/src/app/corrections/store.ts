/**
 * In-memory correction submission store for the web intake lane. Production wiring
 * persists through Firestore `submissionInbox`; this module provides the same quarantine-only
 * contract for App Hosting routes and tests. Deliberately exposes lookup-by-receipt only no
 * list or enumerate API exists for submitters.
 */
import type { QuarantinedSubmissionRecord } from '@black-book/security';
import { createReceiptCode, digestReceiptCode } from './receipt-code';
import type { CorrectionCategory, CorrectionTargetType } from './categories';
import type { PublicClosureReason } from './public-status';

export type StoredAppeal = {
  readonly id: string;
  readonly statement: string;
  readonly submittedAt: string;
};

export type StoredCorrection = {
  readonly record: QuarantinedSubmissionRecord;
  readonly receiptCode: string;
  readonly receiptDigest: string;
  readonly targetType: CorrectionTargetType;
  readonly category: CorrectionCategory;
  readonly classificationDispute: boolean;
  readonly appeals: readonly StoredAppeal[];
  readonly closureReason?: PublicClosureReason;
  readonly updatedAt: string;
};

export type CorrectionSubmissionStore = {
  save(entry: StoredCorrection): void;
  getBySubmissionId(id: string): StoredCorrection | undefined;
  getByReceiptCode(receiptCode: string, pepper: string): StoredCorrection | undefined;
  attachAppeal(receiptCode: string, pepper: string, appeal: StoredAppeal): StoredCorrection | undefined;
  markClosed(
    submissionId: string,
    closureReason: PublicClosureReason,
  ): StoredCorrection | undefined;
};

export function createCorrectionSubmissionStore(): CorrectionSubmissionStore {
  const bySubmissionId = new Map<string, StoredCorrection>();
  const byReceiptDigest = new Map<string, string>();

  return {
    save(entry) {
      if (bySubmissionId.has(entry.record.id)) {
        throw new Error('Submission id already exists.');
      }
      bySubmissionId.set(entry.record.id, entry);
      byReceiptDigest.set(entry.receiptDigest, entry.record.id);
    },
    getBySubmissionId(id) {
      return bySubmissionId.get(id);
    },
    getByReceiptCode(receiptCode, pepper) {
      const digest = digestReceiptCode(receiptCode, pepper);
      if (!digest) return undefined;
      const submissionId = byReceiptDigest.get(digest);
      if (!submissionId) return undefined;
      return bySubmissionId.get(submissionId);
    },
    attachAppeal(receiptCode, pepper, appeal) {
      const existing = this.getByReceiptCode(receiptCode, pepper);
      if (!existing) return undefined;
      const updated: StoredCorrection = {
        ...existing,
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
    markClosed(submissionId, closureReason) {
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
