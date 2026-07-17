/**
 * Relevance and confidence feedback-loop calibration layer (BB-081).
 *
 * This module is a read-only LAYER around BB-040's deterministic relevance engine
 * (../relevance/) and BB-044's append-only research-case history (../research-case/). It never
 * mutates either engine, never computes a live relevance/confidence score itself, and never
 * writes anywhere. The core invariant carried through every type and function here: automation
 * PROPOSES, humans APPROVE — no silent auto-tuning, no learned ranker.
 *
 * Clarified interpretation of one bead detail: the bead text says the decision log is keyed by
 * "the input fingerprints BB-043 already stamps." BB-043's `ConfidenceInputFingerprints`
 * (packages/domain/src/confidence-engine/engine.ts) fingerprints CLAIM confidence inputs
 * (evidence links + policy) — it has no direct analog for a relevance candidate, which is scored
 * before any claim exists. Rather than force an import of confidence-engine internals that don't
 * actually apply here, this module reuses the *same deterministic pattern* BB-043 established
 * (canonicalize -> JSON -> sha256, via the already-shared `hashUtf8` helper from
 * ../provenance/hashes.js) applied to the relevance-assessment inputs a decision was made from.
 * See decision-log.ts's `computeRelevanceInputFingerprint`.
 */
import type { RelevanceDecision } from '@black-book/schemas';
import type { RelevanceAssessment, RelevanceDimension } from '../relevance/index.js';
import type {
  ResearchCaseReasonCode,
  ResearchCaseState,
  ResearchCaseTransitionEvent,
} from '../research-case/index.js';
import type { QueryPackEffectivenessMetrics } from '../query-packs/index.js';

export const RELEVANCE_FEEDBACK_SCHEMA_VERSION = 'relevance-feedback.v1' as const;

/**
 * How a human's case transition compared to what the relevance engine recommended:
 *  - 'accept': the human's transition matches the engine's non-overridden decision.
 *  - 'reject': the human's transition goes the other way (e.g. excluded a candidate the engine
 *    scored includable, or confirmed one the engine scored exclude) WITHOUT a formal override.
 *  - 'override': a formal `RelevanceOverride` (../relevance/types.js) is present on the
 *    assessment — the strongest, most explicit disagreement signal available.
 */
export const HUMAN_DISPOSITIONS = ['accept', 'reject', 'override'] as const;
export type HumanDisposition = (typeof HUMAN_DISPOSITIONS)[number];

/** The research-case transition target states that represent a relevance verdict. Transitions
 *  to any other state (enrichment progression, merges, retraction) are not relevance verdicts
 *  and are out of scope for this calibration dataset. */
export const RELEVANCE_VERDICT_TARGET_STATES: ReadonlySet<ResearchCaseState> = new Set([
  'relevance_confirmed',
  'excluded',
  'insufficient_evidence',
]);

export type RelevanceDecisionLogEntry = {
  readonly schemaVersion: typeof RELEVANCE_FEEDBACK_SCHEMA_VERSION;
  readonly caseId: string;
  readonly candidateId: string;
  /** Index into the case's history array of the transition this entry was extracted from. */
  readonly transitionIndex: number;
  readonly from: ResearchCaseTransitionEvent['from'];
  readonly to: ResearchCaseTransitionEvent['to'];
  readonly reasonCode: ResearchCaseReasonCode;
  readonly actorId: string;
  readonly occurredAt: string;
  /** The RelevanceAssessment.decision in effect at this transition — override-adjusted when an
   *  override was applied (see overrideApplied). */
  readonly assessmentDecision: RelevanceDecision;
  readonly compositeScore: number;
  readonly policyVersion: string;
  readonly featureValues: RelevanceAssessment['featureValues'];
  readonly disposition: HumanDisposition;
  readonly overrideApplied: boolean;
  readonly overrideReason?: string;
  /** Deterministic sha256 fingerprint over the relevance-assessment inputs that produced
   *  assessmentDecision/compositeScore/featureValues (see module docstring). */
  readonly inputFingerprint: string;
  readonly assessedAt: string;
  /** Optional enrichment, populated only when the caller supplies a candidatesById lookup to
   *  extractRelevanceDecisionLog. Absent entries are excluded from source-tier precision, not
   *  treated as a failure. */
  readonly adapterId?: string;
  readonly sourceTier?: string;
};

export type RelevanceCalibrationDataset = {
  readonly schemaVersion: typeof RELEVANCE_FEEDBACK_SCHEMA_VERSION;
  readonly extractedAt: string;
  readonly entries: readonly RelevanceDecisionLogEntry[];
};

export type DimensionDisagreementSummary = {
  readonly dimension: RelevanceDimension;
  readonly sampleSize: number;
  readonly disagreementCount: number;
  readonly disagreementRate: number;
  readonly meanValueOnAgreement: number;
  readonly meanValueOnDisagreement: number;
  /** abs(meanValueOnAgreement - meanValueOnDisagreement); dimensions are ranked by this,
   *  descending, in buildRecalibrationReport — the higher the divergence, the more that
   *  dimension's feature value differs between cases humans agreed with vs disagreed with. */
  readonly divergence: number;
};

export type SourceTierPrecisionSummary = {
  readonly adapterId: string;
  readonly sourceTier: string;
  readonly sampleSize: number;
  readonly acceptedCount: number;
  readonly precision: number;
};

export type GraylistYieldSummary = {
  readonly available: true;
  readonly parkedCount: number;
  readonly corroboratedCount: number;
  readonly yieldRate: number;
};

export type GraylistYieldUnavailable = {
  readonly available: false;
  readonly reason: string;
};

export type GraylistYieldInput = {
  readonly parkedSignalId: string;
  readonly parkedAt: string;
  /** Present once a parked weak signal was later corroborated (promoted, or matched by an
   *  independent lineage) — absence means it is still parked / never corroborated. */
  readonly corroboratedAt?: string;
};

export type RecalibrationReport = {
  readonly schemaVersion: typeof RELEVANCE_FEEDBACK_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly sampleSize: number;
  readonly overallDisagreementRate: number;
  readonly dimensionDisagreement: readonly DimensionDisagreementSummary[];
  readonly queryPackEffectiveness: readonly QueryPackEffectivenessMetrics[];
  readonly graylistYield: GraylistYieldSummary | GraylistYieldUnavailable;
  readonly sourceTierPrecision: readonly SourceTierPrecisionSummary[];
};
