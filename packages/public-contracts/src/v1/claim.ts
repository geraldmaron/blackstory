/**
 * Public evidence claim shape — extracted from `apps/web/src/lib/evidence/types.ts`'s
 * `EvidenceClaimView` and `apps/web/src/data/public-seed.ts`'s `PublicClaimView` (the two
 * structurally-compatible web-owned shapes this schema unifies into one versioned contract).
 *
 * Per MOB-003 requirements: "disputes and provenance remain visible" — `dispute`,
 * `revisionHistory`, and `retraction` are deliberately part of the PUBLIC shape (they are
 * transparency features, not internal fields to hide). What is excluded by construction:
 * `sourceLineage`'s full internal rollup is flattened to the single public
 * `independentLineageCount` integer (matching `PublicClaimView`'s existing shape) — no internal
 * `researchCoverage` notes object, no reviewer identity, no moderation metadata. `confidenceScore`
 * here is the existing nominal, level-derived display value already shipped in
 * `PublicEntityView`/`PublicProjectionInput` (`NOMINAL_CONFIDENCE_SCORE` in
 * `apps/web/src/lib/public-data/map-projection.ts`) — a deterministic function of
 * `confidenceLevel`, never a raw internal ranking signal.
 */
import { z } from 'zod';
import { boundedArray, idString, nonEmptyText } from '../internal/primitives.js';
import { citationV1Schema } from './citation.js';

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export const confidenceLevelSchema = z.enum(CONFIDENCE_LEVELS);
export type ConfidenceLevelV1 = (typeof CONFIDENCE_LEVELS)[number];

export const DISPUTE_ALTERNATE_KINDS = ['contradicting', 'alternative'] as const;

export const claimDisputeAlternateV1Schema = z
  .object({
    value: nonEmptyText(2000),
    credible: z.boolean(),
    kind: z.enum(DISPUTE_ALTERNATE_KINDS),
  });

export const claimDisputeV1Schema = z
  .object({
    hasDispute: z.boolean(),
    primaryValue: nonEmptyText(2000),
    note: z.string().max(2000).optional(),
    alternates: boundedArray(claimDisputeAlternateV1Schema, 50),
  });

export type ClaimDisputeV1 = z.infer<typeof claimDisputeV1Schema>;

export const REVISION_CHANGE_KINDS = ['created', 'revised', 'corrected', 'retracted'] as const;

export const claimRevisionEntryV1Schema = z
  .object({
    id: idString(200),
    changedAt: z.string().max(64),
    changeKind: z.enum(REVISION_CHANGE_KINDS),
    summary: nonEmptyText(2000),
    policyVersion: z.string().max(100).optional(),
  });

export type ClaimRevisionEntryV1 = z.infer<typeof claimRevisionEntryV1Schema>;

export const claimRetractionV1Schema = z
  .object({
    retractedAt: z.string().max(64),
    reason: nonEmptyText(2000),
    supersededByClaimId: idString(200).optional(),
  });

export type ClaimRetractionV1 = z.infer<typeof claimRetractionV1Schema>;

export const claimV1Schema = z
  .object({
    id: idString(200),
    predicate: nonEmptyText(300),
    object: nonEmptyText(4000),
    confidenceScore: z.number().min(0).max(1),
    confidenceLevel: confidenceLevelSchema,
    citation: citationV1Schema,
    /** Independent-lineage count only — never the full internal `EvidenceSourceLineageInput`
     * rollup (no supporting/contradicting-evidence counts, those are ranking-adjacent internal
     * signals). Matches `PublicClaimView.independentLineageCount`. */
    independentLineageCount: z.number().int().min(0).max(100_000).optional(),
    dispute: claimDisputeV1Schema.optional(),
    revisionHistory: boundedArray(claimRevisionEntryV1Schema, 200).optional(),
    retraction: claimRetractionV1Schema.optional(),
  });

export type ClaimV1 = z.infer<typeof claimV1Schema>;
