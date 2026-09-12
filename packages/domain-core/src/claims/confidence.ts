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
} from '@repo/schemas';
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
  bridge: boolean;
  sourceAuthority: number;
  directness: number;
  temporalProximity: number;
  geographicPrecision: number;
  entityMatchQuality: number;
  extractionQuality: number;
  quality: number;
  /** Dimension names this link's own record marked unassessed rather than measured. */
  unassessedDimensions: readonly string[];
};

/**
 * Dimensions that drop out of the weighted score, with their weight redistributed among the
 * rest, when no scored link actually assessed them — rather than averaging in a link's
 * placeholder value as though it were a measurement.
 *
 * Scoped to exactly these two: `directness`/`entityMatchQuality` are already derived from an
 * observation (however weak) rather than a constant, and `geographicPrecision` has no assessed
 * path yet at all, so renormalizing around it is a separate, deliberate step for whenever that
 * lands — not a side effect of this one.
 */
const RENORMALIZABLE_DIMENSIONS = ['temporalProximity', 'extractionQuality'] as const;
type RenormalizableDimension = (typeof RENORMALIZABLE_DIMENSIONS)[number];

function assessedFor(
  scored: readonly LineageAggregate[],
  dimension: RenormalizableDimension,
): LineageAggregate[] {
  return scored.filter((link) => !link.unassessedDimensions.includes(dimension));
}

function linkQuality(link: ClaimEvidenceLink): number {
  const authority = sourceAuthorityForClassification(link.sourceClassification);
  return (
    (authority +
      link.directness +
      link.temporalProximity +
      link.geographicPrecision +
      link.entityMatchQuality +
      link.extractionQuality) /
    6
  );
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
      bridge: link.bridgeSource === true,
      sourceAuthority: sourceAuthorityForClassification(link.sourceClassification),
      directness: link.directness,
      temporalProximity: link.temporalProximity,
      geographicPrecision: link.geographicPrecision,
      entityMatchQuality: link.entityMatchQuality,
      extractionQuality: link.extractionQuality,
      quality: linkQuality(link),
      unassessedDimensions: link.unassessedDimensions ?? [],
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

  /**
   * A bridge may carry a claim and never corroborates one.
   *
   * Two consequences, and both matter:
   *
   *  - Bridges never count toward independent lineage. A Wikipedia article plus a government
   *    record is one corroborating lineage, not two, so the bridge can never be the thing that
   *    lifts a claim over the publish threshold.
   *  - When real evidence is present, bridges are dropped from the quality aggregates entirely.
   *    Averaging a bridge's authority into a government record's would make a claim score LOWER
   *    for having cited an extra source, which is how "more research made the record less
   *    publishable" happened before. A bridge should neither lift nor drag.
   *
   * When a bridge is ALL there is, it stays in the aggregates: a bridge-carried claim is worth
   * more than no claim, and scoring it zero would misrepresent it as unevidenced rather than
   * as thinly evidenced.
   */
  const corroborating = supporting.filter((s) => !s.bridge);
  const scored = corroborating.length > 0 ? corroborating : supporting;

  const independentLineageCount = corroborating.length;
  const temporalAssessed = assessedFor(scored, 'temporalProximity');
  const extractionAssessed = assessedFor(scored, 'extractionQuality');
  const components: ConfidenceComponents = {
    sourceAuthority: round4(mean(scored.map((s) => s.sourceAuthority))),
    directness: round4(mean(scored.map((s) => s.directness))),
    lineageIndependence: round4(lineageIndependenceFromCount(independentLineageCount)),
    temporalProximity: round4(mean(temporalAssessed.map((s) => s.temporalProximity))),
    geographicPrecision: round4(mean(scored.map((s) => s.geographicPrecision))),
    entityMatchQuality: round4(mean(scored.map((s) => s.entityMatchQuality))),
    extractionQuality: round4(mean(extractionAssessed.map((s) => s.extractionQuality))),
    contradictionPenalty: round4(
      clamp01(
        Math.min(
          CONTRADICTION_PENALTY_CAP,
          contradicting.length * CONTRADICTION_PENALTY_PER_LINEAGE,
        ),
      ),
    ),
  };

  /**
   * Weighted sum over only the dimensions actually in play, rescaled so their weights still
   * sum to 1. `temporalProximity`/`extractionQuality` drop out entirely — weight included —
   * when not one scored link assessed them, instead of averaging in a placeholder value that
   * would read as a real (if middling) measurement.
   */
  let includedWeight =
    CONFIDENCE_COMPONENT_WEIGHTS.sourceAuthority +
    CONFIDENCE_COMPONENT_WEIGHTS.directness +
    CONFIDENCE_COMPONENT_WEIGHTS.lineageIndependence +
    CONFIDENCE_COMPONENT_WEIGHTS.geographicPrecision +
    CONFIDENCE_COMPONENT_WEIGHTS.entityMatchQuality;
  let weightedSum =
    components.sourceAuthority * CONFIDENCE_COMPONENT_WEIGHTS.sourceAuthority +
    components.directness * CONFIDENCE_COMPONENT_WEIGHTS.directness +
    components.lineageIndependence * CONFIDENCE_COMPONENT_WEIGHTS.lineageIndependence +
    components.geographicPrecision * CONFIDENCE_COMPONENT_WEIGHTS.geographicPrecision +
    components.entityMatchQuality * CONFIDENCE_COMPONENT_WEIGHTS.entityMatchQuality;
  if (temporalAssessed.length > 0) {
    includedWeight += CONFIDENCE_COMPONENT_WEIGHTS.temporalProximity;
    weightedSum += components.temporalProximity * CONFIDENCE_COMPONENT_WEIGHTS.temporalProximity;
  }
  if (extractionAssessed.length > 0) {
    includedWeight += CONFIDENCE_COMPONENT_WEIGHTS.extractionQuality;
    weightedSum += components.extractionQuality * CONFIDENCE_COMPONENT_WEIGHTS.extractionQuality;
  }
  const weighted = includedWeight > 0 ? weightedSum / includedWeight : 0;

  const score = round4(clamp01(weighted - components.contradictionPenalty));
  const thresholdEval = evaluateClaimConfidence(score, input.claimClass, policy);
  const calculatedAt = input.calculatedAt ?? new Date().toISOString();

  return {
    score,
    components,
    policyVersion: policy.policyVersion,
    independentLineageCount,
    supportingEvidenceCount: input.evidenceLinks.filter((l) => l.role === 'supporting').length,
    contradictingEvidenceCount: input.evidenceLinks.filter((l) => l.role === 'contradicting')
      .length,
    contributingEvidenceIds: scored.map((s) => s.evidenceId),
    calculatedAt,
    passesPublishThreshold: thresholdEval.passesPublishThreshold,
    threshold: thresholdEval.threshold,
    claimClass: input.claimClass,
  };
}
