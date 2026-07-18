/**
 * Relevance, connection-strength, and research-coverage measurements.
 * These are distinct from confidence: they answer different questions and must not be conflated.
 */
import type { RelevanceDecision } from '@repo/schemas';
import { evaluateRelevance, loadProductConstitution } from '@repo/schemas';

export const RESEARCH_COVERAGE_LEVELS = [
  'none',
  'minimal',
  'partial',
  'substantial',
  'comprehensive',
] as const;

export type ResearchCoverageLevel = (typeof RESEARCH_COVERAGE_LEVELS)[number];

export type ResearchCoverage = {
  readonly level: ResearchCoverageLevel;
  /** Optional 0–1 coverage score when a numeric estimate is available. */
  readonly score?: number;
  readonly notes?: string;
  readonly lastCheckedAt?: string;
};

export type RelevanceMeasurement = {
  readonly score: number;
  readonly decision: RelevanceDecision;
  readonly policyVersion: string;
  readonly passes: boolean;
};

export type ConnectionStrengthMeasurement = {
  /** 0–1 strength of the entity’s substantive connection to the corpus theme. */
  readonly score: number;
  readonly rationale?: string;
};

export function isResearchCoverageLevel(value: string): value is ResearchCoverageLevel {
  return (RESEARCH_COVERAGE_LEVELS as readonly string[]).includes(value);
}

export function assertResearchCoverageLevel(value: string): ResearchCoverageLevel {
  if (!isResearchCoverageLevel(value)) {
    throw new Error(`Unknown research coverage level: ${value}`);
  }
  return value;
}

export function assertUnitInterval(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1`);
  }
  return value;
}

/** Build a relevance measurement from a score + decision using the constitution. */
export function measureRelevance(
  score: number,
  decision: RelevanceDecision,
): RelevanceMeasurement {
  assertUnitInterval(score, 'relevance score');
  const evaluated = evaluateRelevance(score, decision);
  return {
    score: evaluated.score,
    decision: evaluated.decision,
    policyVersion: evaluated.policyVersion,
    passes: evaluated.passes,
  };
}

export function measureConnectionStrength(
  score: number,
  rationale?: string,
): ConnectionStrengthMeasurement {
  assertUnitInterval(score, 'connection strength');
  if (rationale === undefined) {
    return { score };
  }
  return { score, rationale };
}

/** Default research coverage when none is recorded. */
export function defaultResearchCoverage(
  policy = loadProductConstitution(),
): ResearchCoverage & { policyVersion: string } {
  return {
    level: 'none',
    policyVersion: policy.policyVersion,
  };
}
