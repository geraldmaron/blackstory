/**
 * Correction submission + opaque receipt/status shapes (MOB-016).
 *
 * Extracted from `apps/web/src/app/corrections/categories.ts` (`CorrectionTargetType`,
 * `CorrectionCategory`), `.../correction-intake.ts`'s `CorrectionSubmissionInput`, and
 * `.../public-status.ts`'s `PublicCorrectionStatus`/`PublicCorrectionPhase`.
 *
 * Per ADR-021 §3 and its red-team resolution #3: these are the one write path a client has
 * (quarantine-only intake via `apps/api-submissions` — never a canonical write, invariant 2/6),
 * and they stay in `packages/public-contracts` under their own `v1/corrections` subpath rather
 * than a second contracts package, because the split is a server-routing concern, not a
 * client-safety one. Deliberately excluded: `apps/web/src/app/corrections/public-status.ts`'s
 * `mapModerationToPublicPhase`/`isAppealEligible`/`buildPublicCorrectionStatus` functions and the
 * `SubmissionModerationState` type they consume — those are server-only mapping logic over an
 * internal moderation state machine (spam scores, campaign-detection flags, duplicate lists) that
 * must never reach a client; only their PUBLIC output shape (`correctionStatusV1Schema`) belongs
 * here. Receipt-code generation/verification (`receipt-code.ts`'s `createReceiptCode` /
 * `digestReceiptCode`, which use `node:crypto`) is also excluded for the same reason and because
 * it is a `node:` dependency by construction — exactly what this package must never carry.
 */
import { z } from 'zod';
import { httpUrl, nonEmptyText } from '../internal/primitives.js';

export const CORRECTION_TARGET_TYPES = ['entity', 'claim', 'source', 'location'] as const;
export const correctionTargetTypeSchema = z.enum(CORRECTION_TARGET_TYPES);
export type CorrectionTargetTypeV1 = (typeof CORRECTION_TARGET_TYPES)[number];

export const CORRECTION_CATEGORIES = [
  'factual_error',
  'missing_context',
  'source_issue',
  'location_precision',
  'living_person',
  'classification_dispute',
] as const;
export const correctionCategorySchema = z.enum(CORRECTION_CATEGORIES);
export type CorrectionCategoryV1 = (typeof CORRECTION_CATEGORIES)[number];

const MIN_STATEMENT_LENGTH = 20;
const MAX_STATEMENT_LENGTH = 4_000;

export const correctionSubmissionRequestV1Schema = z
  .object({
    targetType: correctionTargetTypeSchema,
    targetRecordId: nonEmptyText(128),
    category: correctionCategorySchema,
    statement: z.string().min(MIN_STATEMENT_LENGTH).max(MAX_STATEMENT_LENGTH),
    sourceUrl: httpUrl(2000).optional(),
    privacyConsent: z.literal(true),
    contact: z.string().max(320).optional(),
  });

export type CorrectionSubmissionRequestV1 = z.infer<typeof correctionSubmissionRequestV1Schema>;

/** Opaque receipt returned once, at acceptance time. There is no browse/enumerate API — status
 * lookup requires the exact code (see `correctionStatusRequestV1Schema`). */
export const correctionSubmissionReceiptV1Schema = z
  .object({
    receiptCode: nonEmptyText(64),
    submittedAt: z.string().max(64),
  });

export type CorrectionSubmissionReceiptV1 = z.infer<typeof correctionSubmissionReceiptV1Schema>;

export const correctionStatusRequestV1Schema = z
  .object({
    receiptCode: nonEmptyText(64),
  });

export type CorrectionStatusRequestV1 = z.infer<typeof correctionStatusRequestV1Schema>;

export const CORRECTION_PHASES = ['received', 'under_review', 'closed'] as const;
export const correctionPhaseSchema = z.enum(CORRECTION_PHASES);
export type CorrectionPhaseV1 = (typeof CORRECTION_PHASES)[number];

/** Public correction status — never carries spam scores, campaign-detection flags, duplicate
 * lists, or any other moderation-internal signal (see module doc). */
export const correctionStatusV1Schema = z
  .object({
    phase: correctionPhaseSchema,
    receiptCode: nonEmptyText(64),
    submittedAt: z.string().max(64),
    updatedAt: z.string().max(64),
    appealAvailable: z.boolean(),
    classificationDispute: z.boolean(),
  });

export type CorrectionStatusV1 = z.infer<typeof correctionStatusV1Schema>;
