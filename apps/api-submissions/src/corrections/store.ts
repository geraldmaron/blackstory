/**
 * In-memory correction receipt store for the api-submissions corrections route.
 * Production wiring persists through Firestore `submissionInbox`; this module provides
 * the same quarantine-only lookup-by-receipt contract for Cloud Run routes and tests.
 * Deliberately exposes lookup-by-receipt only — no list or enumerate API exists for submitters.
 */
import type { QuarantinedSubmissionRecord } from '@repo/security';
import { createReceiptCode, digestReceiptCode } from './receipt-code.js';
import type { CorrectionCategory, CorrectionTargetType } from './categories.js';
import type { PublicClosureReason } from './public-status.js';

export type StoredAppeal = {
  readonly id: string;
  readonly statement: string;
  readonly submittedAt: string;
};

export type StoredCorrectionReceipt = {
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

export type CorrectionReceiptStore = {
  save(entry: StoredCorrectionReceipt): void;
  getBySubmissionId(id: string): StoredCorrectionReceipt | undefined;
  getByReceiptCode(receiptCode: string, pepper: string): StoredCorrectionReceipt | undefined;
};

export function createCorrectionReceiptStore(): CorrectionReceiptStore {
  const bySubmissionId = new Map<string, StoredCorrectionReceipt>();
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
  };
}

export function buildStoredCorrectionReceipt(input: {
  readonly record: QuarantinedSubmissionRecord;
  readonly pepper: string;
  readonly targetType: CorrectionTargetType;
  readonly category: CorrectionCategory;
  readonly classificationDispute: boolean;
}): StoredCorrectionReceipt {
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
