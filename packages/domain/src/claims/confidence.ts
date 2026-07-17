/**
 * Deterministic claim confidence engine.
 * Scores retain component values and constitution policyVersion.
 * Syndicated copies sharing lineageRootId count as one independent lineage.
 */
import {
  evaluateClaimConfidence,
  loadProductConstitution,
  type ClaimClass,
  type ProductConstitution,
} from '@black-book/schemas';
import type { ClaimEvidenceLink } from './evidence-link.js';
import { assertUnitInterval } from './measurements.js';

export type ConfidenceComponents = {
  readonly sourceAuthority: number;
  readonly directness: number;
  readonly lineageIndependence: number;
  readonly temporalProximity: number;
  readonly geographicPrecision: number;
  readonly entityMatchQuality: number;
  readonly extractionQuality: number;
  /** Applied penalty in [0, 1]; higher means more penalty subtracted from the raw score. */
  readonly contradictionPenalty: number;
};

export type ConfidenceScore = {
  readonly score: number;
  readonly components: ConfidenceComponents;
  readonly policyVersion: string;
  readonly independentLineageCount: number;
  readonly supportingEvidenceCount: number;
  readonly contradictingEvidenceCount: number;
  /** Evidence ids that contributed after lineage dedupe. */
  readonly contributingEvidenceIds: readonly string[];
  readonly calculatedAt: string;
};

/** Fixed component weights deterministic; not tunable at runtime without a policy version bump. */
export const CONFIDENCE_COMPONENT_WEIGHTS = {
  sourceAuthority: 0.25,
  directness: 0.15,
  lineageIndependence: 0.15,
  temporalProximity: 0.1,
  geographicPrecision: 0.1,
  entityMatchQuality: 0.1,
  extractionQuality: 0.15,
} as const;

const CLASSIFICATION_AUTHORITY: Readonly<Record<string, number>> = {
  primary_archival: 1,
  government_record: 0.95,
  peer_reviewed: 0.9,
  reputable_secondary: 0.75,
  news_reportage: 0.55,
  community_oral: 0.5,
  self_published: 0.3,
  unknown: 0.2,
};

const CONTRADICTION_PENALTY_PER_LINEAGE = 0.12;
const CONTRADICTION_PENALTY_CAP = 0.45;

export type ConfidenceEngineInput = {
  readonly claimClass: ClaimClass;
  readonly evidenceLinks: readonly ClaimEvidenceLink[];
  readonly calculatedAt?: string;
  readonly policy?: ProductConstitution;
};

export type ConfidenceEngineResult = ConfidenceScore & {
  readonly passesPublishThreshold: boolean;
  readonly threshold: number;
  readonly claimClass: ClaimClass;
};

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function sourceAuthorityForClassification(classification: string): number {
  return CLASSIFICATION_AUTHORITY[classification] ?? CLASSIFICATION_AUTHORITY.unknown!;
}

/**
 * Lineage-independence component from unique supporting lineage count.
 * One lineage cannot look like many; additional independent lineages raise the component.
 */
export function lineageIndependenceFromCount(independentLineageCount: number): number {
  if (independentLineageCount <= 0) return 0;
  if (independentLineageCount === 1) return 0.4;
  if (independentLineageCount === 2) return 0.7;
  if (independentLineageCount === 3) return 0.9;
  return clamp01(0.9 + Math.min(0.1, (independentLineageCount - 3) * 0.02));
}

type LineageAggregate = {
  lineageRootId: string;
  evidenceId: string;
  sourceAuthority: number;
  directness: number;
  temporalProximity: number;
  geographicPrecision: number;
  entityMatchQuality: number;
  extractionQuality: number;
  quality: number;
};

function linkQuality(link: ClaimEvidenceLink): number {
  const authority = sourceAuthorityForClassification(link.sourceClassification);
  return (
    authority +
    link.directness +
    link.temporalProximity +
    link.geographicPrecision +
    link.entityMatchQuality +
    link.extractionQuality
  ) / 6;
}

/**
 * Collapse syndicated mirrored evidence onto one row per lineageRootId.
 * When blockSyndicatedCopiesAsIndependent is on (constitution default), copies count once.
 */
export function uniqueLineageAggregates(
  links: readonly ClaimEvidenceLink[],
  role: 'supporting' | 'contradicting',
  options: { blockSyndicatedCopiesAsIndependent: boolean },
): LineageAggregate[] {
  const eligible = links.filter((link) => link.role === role && link.credible);
  const byRoot = new Map<string, LineageAggregate>();

  for (const link of eligible) {
    const root = options.blockSyndicatedCopiesAsIndependent
      ? link.lineageRootId
      : `${link.lineageRootId}::${link.evidenceId}`;
    const candidate: LineageAggregate = {
      lineageRootId: link.lineageRootId,
      evidenceId: link.evidenceId,
      sourceAuthority: sourceAuthorityForClassification(link.sourceClassification),
      directness: link.directness,
      temporalProximity: link.temporalProximity,
      geographicPrecision: link.geographicPrecision,
      entityMatchQuality: link.entityMatchQuality,
      extractionQuality: link.extractionQuality,
      quality: linkQuality(link),
    };
    const existing = byRoot.get(root);
    if (!existing || candidate.quality > existing.quality) {
      byRoot.set(root, candidate);
    }
  }

  return [...byRoot.values()].sort((a, b) => a.lineageRootId.localeCompare(b.lineageRootId));
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate claim confidence deterministically from evidence links.
 * Always returns component values and policyVersion for auditability.
 */
export function calculateClaimConfidence(input: ConfidenceEngineInput): ConfidenceEngineResult {
  const policy = input.policy ?? loadProductConstitution();
  const blockSyndicated = policy.publicationRestrictions.blockSyndicatedCopiesAsIndependent;

  for (const link of input.evidenceLinks) {
    assertUnitInterval(link.directness, 'directness');
    assertUnitInterval(link.temporalProximity, 'temporalProximity');
    assertUnitInterval(link.geographicPrecision, 'geographicPrecision');
    assertUnitInterval(link.entityMatchQuality, 'entityMatchQuality');
    assertUnitInterval(link.extractionQuality, 'extractionQuality');
  }

  const supporting = uniqueLineageAggregates(input.evidenceLinks, 'supporting', {
    blockSyndicatedCopiesAsIndependent: blockSyndicated,
  });
  const contradicting = uniqueLineageAggregates(input.evidenceLinks, 'contradicting', {
    blockSyndicatedCopiesAsIndependent: blockSyndicated,
  });

  const independentLineageCount = supporting.length;
  const components: ConfidenceComponents = {
    sourceAuthority: round4(mean(supporting.map((s) => s.sourceAuthority))),
    directness: round4(mean(supporting.map((s) => s.directness))),
    lineageIndependence: round4(lineageIndependenceFromCount(independentLineageCount)),
    temporalProximity: round4(mean(supporting.map((s) => s.temporalProximity))),
    geographicPrecision: round4(mean(supporting.map((s) => s.geographicPrecision))),
    entityMatchQuality: round4(mean(supporting.map((s) => s.entityMatchQuality))),
    extractionQuality: round4(mean(supporting.map((s) => s.extractionQuality))),
    contradictionPenalty: round4(
      clamp01(Math.min(CONTRADICTION_PENALTY_CAP, contradicting.length * CONTRADICTION_PENALTY_PER_LINEAGE)),
    ),
  };

  const weighted =
    components.sourceAuthority * CONFIDENCE_COMPONENT_WEIGHTS.sourceAuthority +
    components.directness * CONFIDENCE_COMPONENT_WEIGHTS.directness +
    components.lineageIndependence * CONFIDENCE_COMPONENT_WEIGHTS.lineageIndependence +
    components.temporalProximity * CONFIDENCE_COMPONENT_WEIGHTS.temporalProximity +
    components.geographicPrecision * CONFIDENCE_COMPONENT_WEIGHTS.geographicPrecision +
    components.entityMatchQuality * CONFIDENCE_COMPONENT_WEIGHTS.entityMatchQuality +
    components.extractionQuality * CONFIDENCE_COMPONENT_WEIGHTS.extractionQuality;

  const score = round4(clamp01(weighted - components.contradictionPenalty));
  const thresholdEval = evaluateClaimConfidence(score, input.claimClass, policy);
  const calculatedAt = input.calculatedAt ?? new Date().toISOString();

  return {
    score,
    components,
    policyVersion: policy.policyVersion,
    independentLineageCount,
    supportingEvidenceCount: input.evidenceLinks.filter((l) => l.role === 'supporting').length,
    contradictingEvidenceCount: input.evidenceLinks.filter((l) => l.role === 'contradicting').length,
    contributingEvidenceIds: supporting.map((s) => s.evidenceId),
    calculatedAt,
    passesPublishThreshold: thresholdEval.passesPublishThreshold,
    threshold: thresholdEval.threshold,
    claimClass: input.claimClass,
  };
}
