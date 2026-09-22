/**
 * In-memory correction submission store — the test double and fallback, not production wiring.
 * This module's doc comment previously claimed "production wiring persists through Postgres
 * submissions.intake_items"; that was never true (repo-vl155.1) — nothing ever called out from
 * this store to Postgres, so every publicly submitted correction was invisible to the admin
 * console (which reads Postgres) and lost on the next cold start, confirmed empirically 2026-09-21
 * against the live database (zero `kind='correction'`/`'abuse_report'` rows ever, out of 2,175
 * submissions of other kinds). The real store is `./postgres-store.ts`; this one still backs
 * tests, matching the same `CorrectionSubmissionStore` contract. Deliberately exposes
 * lookup-by-receipt only — no list or enumerate API exists for submitters.
 */
import type { QuarantinedSubmissionRecord } from '@repo/security';
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

/**
 * Async throughout: the real implementation (`./postgres-store.ts`) is a database, and a
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
