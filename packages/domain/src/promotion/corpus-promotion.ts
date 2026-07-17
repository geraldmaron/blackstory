/**
 * Streamlined corpus-bulk promotion path (BB-094): the "vet once, import bulk" optimization
 * documented on `../corpus-vetting.ts`. This module is a promotion-path OPTIMIZATION, not a
 * gate removal — every hard gate from the standard pipeline survives:
 *
 *  - citation completeness (reuses `isCitationStructurallyComplete` from `../citations/citation.js`,
 *    the same structural bar `../citations/completeness-gate.ts` enforces at publish time);
 *  - geo stored at best-documented precision with `precisionBasis: 'source-documented'`
 *    (BB-091 — bulk-loaded records are never default-coarsened, mirroring
 *    `../geography/precision.ts`'s `resolveEntityLocationPrecision` policy note);
 *  - `notabilityBasis` auto-derived from corpus class (BB-090) — corpus membership itself is the
 *    notability criterion, recorded per record via the vetting record's `notabilityCriterion`;
 *  - a mandatory per-batch human spot-check sample (deterministic selection reusing
 *    `selectCanaryRecordIndices` from `../adapters/gates.js`, the same sampling primitive BB-037
 *    canary rollout already uses — no second sampling algorithm invented);
 *  - any failing check, or a record flagged ambiguous by the importer, demotes that record to
 *    the `standard_consensus` lane. Nothing in this module ever marks a record published —
 *    `standard_consensus` records are ordinary quarantine submissions bound for the existing
 *    BB-076 consensus-review lane; `corpus_fast_track` records are still ordinary quarantine
 *    submissions (identical BB-085 pipeline, see `packages/operator-cli/src/bulk-import.ts`),
 *    just annotated with the auto-derived notability/precision facts a downstream reviewer or
 *    the eventual claim-promotion step (`./controls.js`) can use instead of re-deriving them.
 *
 * Deliberately does NOT reuse `evaluatePromotionGate`/`PromotionClaim` from `./model.js` and
 * `./controls.js`: those evaluate independent-lineage corroboration across MULTIPLE sources for
 * one claim, which is the exact cost a vetted corpus is meant to replace with corpus-level
 * authority — forcing bulk corpus records through that machinery would silently require multiple
 * independent lineages the corpus was vetted specifically so single-lineage records don't need.
 */
import { isCitationStructurallyComplete, type Citation } from '../citations/citation.js';
import { selectCanaryRecordIndices } from '../adapters/gates.js';
import type { GeoPrecisionTier, PrecisionBasis } from '../geography/precision.js';
import type { NotabilityBasisRecord } from '../entity-status.js';
import type { CorpusVettingRecord } from '../corpus-vetting.js';

// ---------------------------------------------------------------------------
// Candidate record shape
// ---------------------------------------------------------------------------

export type CorpusGeometryType = 'Point' | 'Polygon';

/** One parsed record out of a corpus batch, prior to intake (BB-094 acceptance criterion 2:
 *  per-record provenance is corpusId + batchId + sourceRecordId). */
export type CorpusBulkRecordCandidate = {
  readonly corpusId: string;
  readonly batchId: string;
  readonly sourceRecordId: string;
  readonly title: string;
  /** At least one must be structurally complete (citation completeness gate). */
  readonly citations: readonly Pick<Citation, 'sourceName' | 'location' | 'capture' | 'retrievalDate'>[];
  /** Finest tier this specific record is actually documented at — never coarsened by default. */
  readonly documentedGeoPrecisionTier: GeoPrecisionTier;
  readonly geometryType: CorpusGeometryType;
  /** Set by the importer/parser when a record reads as contested or unclear — always demotes. */
  readonly ambiguousFlag?: boolean;
  readonly ambiguousReason?: string;
};

// ---------------------------------------------------------------------------
// Spot-check sampling (mandatory per batch)
// ---------------------------------------------------------------------------

export type SpotCheckVerdict = 'pass' | 'fail';

export type SpotCheckSample = {
  readonly sourceRecordId: string;
  readonly reviewerId: string;
  readonly verdict: SpotCheckVerdict;
  readonly reviewedAt: string;
  readonly notes?: string;
};

/**
 * Deterministically selects the mandatory per-batch human spot-check sample (BB-094 acceptance
 * criterion 3). Reuses `selectCanaryRecordIndices` (BB-037) rather than a second sampling
 * algorithm — it already guarantees >=1 index for any non-empty input, which is what makes the
 * sample "mandatory" rather than "mandatory unless the batch is small."
 */
export function selectSpotCheckSampleIndices(
  totalRecords: number,
  sampleFraction = 0.1,
): readonly number[] {
  return selectCanaryRecordIndices(totalRecords, sampleFraction);
}

export function selectSpotCheckSample<T>(
  candidates: readonly T[],
  sampleFraction = 0.1,
): readonly T[] {
  const indices = selectSpotCheckSampleIndices(candidates.length, sampleFraction);
  return indices.map((index) => candidates[index]!);
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export const CORPUS_BULK_PROMOTION_LANES = ['corpus_fast_track', 'standard_consensus'] as const;
export type CorpusBulkPromotionLane = (typeof CORPUS_BULK_PROMOTION_LANES)[number];

export const CORPUS_BULK_PROMOTION_REASONS = [
  'no_structurally_complete_citation',
  'polygon_geometry_required',
  'flagged_ambiguous',
  'spot_check_not_yet_sampled',
  'spot_check_failed',
] as const;
export type CorpusBulkPromotionReason = (typeof CORPUS_BULK_PROMOTION_REASONS)[number];

export type CorpusBulkPromotionResult = {
  readonly lane: CorpusBulkPromotionLane;
  /** Empty only when lane === 'corpus_fast_track'. Never publishes on its own either way. */
  readonly reasons: readonly CorpusBulkPromotionReason[];
  readonly notabilityBasis: NotabilityBasisRecord;
  readonly geoPrecisionTier: GeoPrecisionTier;
  /** Always 'source-documented' for bulk-vetted corpus records — BB-091 bans default coarsening
   *  for this lane; a record needing coarsening (e.g. a living-person redaction rule firing)
   *  does not belong in a settled-corpus bulk batch and must demote instead. */
  readonly precisionBasis: PrecisionBasis;
  readonly citationComplete: boolean;
  readonly spotCheckSelected: boolean;
  readonly spotCheckVerdict?: SpotCheckVerdict;
};

export type EvaluateCorpusBulkPromotionInput = {
  readonly vetting: CorpusVettingRecord;
  readonly candidate: CorpusBulkRecordCandidate;
  readonly spotCheckSelected: boolean;
  readonly spotCheckVerdict?: SpotCheckVerdict;
  /** Evidence ids backing the auto-derived notability basis (e.g. the record's own citation ids). */
  readonly evidenceIds: readonly string[];
};

/**
 * Evaluates one corpus-vetted candidate record against every hard gate the streamlined path must
 * keep (BB-094 acceptance criterion 3). Never throws — an ineligible record demotes to
 * `standard_consensus` rather than failing the whole batch; the caller (the BB-085 bulk-import
 * pipeline) still runs every record, fast-tracked or not, through the identical quarantine
 * intake call.
 */
export function evaluateCorpusBulkPromotion(
  input: EvaluateCorpusBulkPromotionInput,
): CorpusBulkPromotionResult {
  const { vetting, candidate } = input;
  const reasons: CorpusBulkPromotionReason[] = [];

  const citationComplete = candidate.citations.some((citation) =>
    isCitationStructurallyComplete(citation),
  );
  if (!citationComplete) {
    reasons.push('no_structurally_complete_citation');
  }

  if (vetting.requiresPolygonGeometry && candidate.geometryType !== 'Polygon') {
    reasons.push('polygon_geometry_required');
  }

  if (candidate.ambiguousFlag) {
    reasons.push('flagged_ambiguous');
  }

  if (input.spotCheckSelected) {
    if (!input.spotCheckVerdict) {
      reasons.push('spot_check_not_yet_sampled');
    } else if (input.spotCheckVerdict === 'fail') {
      reasons.push('spot_check_failed');
    }
  }

  const notabilityBasis: NotabilityBasisRecord = {
    criterion: vetting.notabilityCriterion,
    note: `Corpus membership: ${vetting.corpusDisplayName} (${vetting.corpus}, custodian: ${vetting.custodian}).`,
    evidenceIds: input.evidenceIds,
  };

  return Object.freeze({
    lane: reasons.length === 0 ? 'corpus_fast_track' : 'standard_consensus',
    reasons: Object.freeze(reasons),
    notabilityBasis,
    geoPrecisionTier: candidate.documentedGeoPrecisionTier,
    precisionBasis: 'source-documented',
    citationComplete,
    spotCheckSelected: input.spotCheckSelected,
    ...(input.spotCheckVerdict ? { spotCheckVerdict: input.spotCheckVerdict } : {}),
  });
}

// ---------------------------------------------------------------------------
// Per-batch report (BB-094 acceptance criterion 6)
// ---------------------------------------------------------------------------

export type CorpusBulkImportRowOutcome = 'accepted' | 'rejected' | 'skipped_duplicate';

export type CorpusBulkImportBatchRow = {
  readonly candidate: CorpusBulkRecordCandidate;
  readonly decision: CorpusBulkPromotionResult;
  readonly outcome: CorpusBulkImportRowOutcome;
  readonly rejectionReason?: string;
};

export type CorpusBulkImportBatchReport = {
  readonly corpusId: string;
  readonly batchId: string;
  readonly generatedAt: string;
  readonly counts: {
    readonly total: number;
    readonly accepted: number;
    readonly fastTracked: number;
    readonly demotedToConsensus: number;
    readonly rejected: number;
    readonly skippedDuplicate: number;
  };
  readonly precisionTiers: Readonly<Record<GeoPrecisionTier, number>>;
  readonly spotCheck: {
    readonly sampledCount: number;
    readonly passCount: number;
    readonly failCount: number;
  };
  readonly rejects: readonly { readonly sourceRecordId: string; readonly reason: string }[];
};

const EMPTY_TIER_COUNTS: Readonly<Record<GeoPrecisionTier, number>> = {
  'exact-site': 0,
  block: 0,
  locality: 0,
  county: 0,
  state: 0,
};

/**
 * Builds the per-batch operator-audit report (BB-094 acceptance criterion 6): counts, precision
 * tiers, spot-check results, rejects. Pure and deterministic — the caller (bulk-import CLI)
 * attaches it to the existing BB-018 audit/outbox mechanism, no new audit sink invented.
 */
export function buildCorpusBulkImportBatchReport(input: {
  readonly corpusId: string;
  readonly batchId: string;
  readonly generatedAt: string;
  readonly rows: readonly CorpusBulkImportBatchRow[];
}): CorpusBulkImportBatchReport {
  const tiers: Record<GeoPrecisionTier, number> = { ...EMPTY_TIER_COUNTS };
  let fastTracked = 0;
  let demotedToConsensus = 0;
  let accepted = 0;
  let rejected = 0;
  let skippedDuplicate = 0;
  let sampledCount = 0;
  let passCount = 0;
  let failCount = 0;
  const rejects: { sourceRecordId: string; reason: string }[] = [];

  for (const row of input.rows) {
    tiers[row.decision.geoPrecisionTier] += 1;
    if (row.decision.lane === 'corpus_fast_track') fastTracked += 1;
    else demotedToConsensus += 1;

    if (row.decision.spotCheckSelected) {
      sampledCount += 1;
      if (row.decision.spotCheckVerdict === 'pass') passCount += 1;
      if (row.decision.spotCheckVerdict === 'fail') failCount += 1;
    }

    if (row.outcome === 'accepted') accepted += 1;
    if (row.outcome === 'skipped_duplicate') skippedDuplicate += 1;
    if (row.outcome === 'rejected') {
      rejected += 1;
      rejects.push({
        sourceRecordId: row.candidate.sourceRecordId,
        reason: row.rejectionReason ?? row.decision.reasons.join(', ') ?? 'rejected',
      });
    }
  }

  return Object.freeze({
    corpusId: input.corpusId,
    batchId: input.batchId,
    generatedAt: input.generatedAt,
    counts: Object.freeze({
      total: input.rows.length,
      accepted,
      fastTracked,
      demotedToConsensus,
      rejected,
      skippedDuplicate,
    }),
    precisionTiers: Object.freeze(tiers),
    spotCheck: Object.freeze({ sampledCount, passCount, failCount }),
    rejects: Object.freeze(rejects),
  });
}
