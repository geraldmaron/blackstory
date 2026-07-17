/**
 * Deterministic relevance assessment types.
 * Composite scores and feature values are private research metadata never public numeric output.
 */
import type { RelevanceDecision } from '@black-book/schemas';
import type { DiscoveryCandidateRecord } from '../discovery/types.js';

export const RELEVANCE_ASSESSMENT_SCHEMA_VERSION = 'relevance-assessment.v1' as const;

export const RELEVANCE_FIXTURE_SCHEMA_VERSION = 'relevance-fixture.v1' as const;

/** Scoring dimensions weighted into the composite relevance score. */
export const RELEVANCE_DIMENSIONS = [
  'signal_strength',
  'thematic_alignment',
  'geographic_connection',
  'source_authority',
  'distinctiveness',
] as const;

export type RelevanceDimension = (typeof RELEVANCE_DIMENSIONS)[number];

export type RelevanceFeatureValue = {
  readonly dimension: RelevanceDimension;
  /** Normalized 0–1 feature value for the dimension. */
  readonly value: number;
  /** Weight applied when composing the composite score. */
  readonly weight: number;
  /** Weighted contribution (value × weight). */
  readonly contribution: number;
  readonly rationale: string;
};

/**
 * The 7 discovery-time gates plus `notability_basis` an 8th,
 * publish-time gate over an entity's own `notabilityBasis` (../entity-status.ts). It EXTENDS
 * this list, it never replaces any of the original 7: see ../relevance/notability-gate.ts for
 * its evaluator and ./gates.ts for the discovery-time 7.
 */
export const RELEVANCE_GATE_IDS = [
  'signal_present',
  'weak_signal_independent',
  'negative_only',
  'threshold',
  'distinctiveness',
  'duplicate',
  'include_evidence',
  'notability_basis',
] as const;

export type RelevanceGateId = (typeof RELEVANCE_GATE_IDS)[number];

export type RelevanceGateResult = {
  readonly gateId: RelevanceGateId;
  readonly passed: boolean;
  readonly reason: string;
};

export type RelevanceEvidenceKind =
  | 'signal'
  | 'geographic'
  | 'thematic'
  | 'source'
  | 'gate'
  | 'override';

export type RelevanceEvidence = {
  readonly kind: RelevanceEvidenceKind;
  readonly summary: string;
  readonly detail?: string;
};

/** Manual override requires a non-empty human reason. */
export type RelevanceOverride = {
  readonly decision: RelevanceDecision;
  readonly reason: string;
  readonly overriddenBy: string;
  readonly overriddenAt: string;
};

export type RelevanceAssessment = {
  readonly schemaVersion: typeof RELEVANCE_ASSESSMENT_SCHEMA_VERSION;
  readonly candidateId: string;
  readonly decision: RelevanceDecision;
  /** Private composite score must not appear in public projections. */
  readonly compositeScore: number;
  readonly policyVersion: string;
  readonly passes: boolean;
  readonly featureValues: readonly RelevanceFeatureValue[];
  readonly gates: readonly RelevanceGateResult[];
  readonly evidence: readonly RelevanceEvidence[];
  readonly whyThisAppears: string;
  readonly exclusionReason?: string;
  readonly override?: RelevanceOverride;
  readonly distinctivenessKey: string;
  readonly isDuplicate: boolean;
  readonly assessedAt: string;
};

/** Public-safe relevance explanation numeric scores are intentionally omitted. */
export type PublicRelevanceExplanation = {
  readonly whyThisAppears: string;
  readonly decision: RelevanceDecision;
};

export type EvaluateRelevanceInput = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly existingAssessments?: readonly RelevanceAssessment[];
  readonly override?: RelevanceOverride;
  readonly assessedAt?: string;
};

export type RelevanceFixtureCase = {
  readonly id: string;
  readonly title: string;
  readonly classification?: string;
  readonly payload?: Readonly<Record<string, string>>;
  readonly expectedDecision: RelevanceDecision;
  readonly expectedPasses: boolean;
  readonly expectedGateFailures?: readonly RelevanceGateId[];
  readonly mustNotExposeScore: boolean;
  readonly notes?: string;
};

export type RelevanceFixture = {
  readonly schemaVersion: typeof RELEVANCE_FIXTURE_SCHEMA_VERSION;
  readonly description: string;
  readonly cases: readonly RelevanceFixtureCase[];
};
