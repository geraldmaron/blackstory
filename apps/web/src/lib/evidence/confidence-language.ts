/**
 * Confidence, relevance, connection-strength, and research-coverage copy for the evidence
 * interface.
 *
 * Confidence is always labeled as a deterministic evidence score derived from the
 * component-weighted engine (`@repo/domain`'s `calculateClaimConfidence`), never framed as
 * a probability that a claim is true unless the caller passes an explicit `calibrated: true`
 * flag proving the score has been statistically calibrated against an observed outcome
 * distribution. This codebase ships no such calibration today, so every real call site uses the
 * default (`calibrated: false`) evidence-score phrasing.
 *
 * `EVIDENCE_DIMENSION_COPY` gives confidence, relevance, connection strength, and research
 * coverage each their own label and description so a reader (and a future maintainer) never
 * conflates "how strong is the evidence for this claim" with "does this record belong here",
 * "how substantively is this entity connected to the corpus theme", or "how much research has
 * been done on this record so far" — four different questions with four different answers.
 */
import type { ConfidenceLevel } from '@repo/ui';

export type ConfidenceCalibration = {
  readonly calibrated: boolean;
  readonly calibrationMethodNote?: string;
};

const CONFIDENCE_LEVEL_TEXT: Readonly<Record<ConfidenceLevel, string>> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const PROBABILITY_LANGUAGE_PATTERN =
  /\bprobability\b|\bchance(?:s)? (?:of|that)\b|\blikely to be true\b/i;

/**
 * Defense-in-depth guard: fails closed if uncalibrated confidence copy drifts toward probability
 * language. Mirrors this codebase's existing scoring-poisoning-guard pattern
 * (`packages/domain/src/confidence-engine`) of proving a policy invariant with a runtime check
 * rather than only a code-review convention.
 */
export function assertNoUncalibratedProbabilityLanguage(text: string, calibrated: boolean): void {
  if (!calibrated && PROBABILITY_LANGUAGE_PATTERN.test(text)) {
    throw new Error(
      `Confidence copy uses probability language without a calibrated score: "${text}"`,
    );
  }
}

/**
 * Format the evidence-score label shown alongside a claim's confidence. Always reads as a score
 * ("Evidence score: high (0.78 of 1.00)"), never as a probability, unless `calibration.calibrated`
 * is explicitly set in which case the label switches to calibrated-confidence phrasing.
 */
export function formatEvidenceScoreLabel(
  score: number,
  level: ConfidenceLevel,
  calibration: ConfidenceCalibration = { calibrated: false },
): string {
  const rounded = score.toFixed(2);
  const label = calibration.calibrated
    ? `Calibrated confidence: ${CONFIDENCE_LEVEL_TEXT[level]} (${rounded})${
        calibration.calibrationMethodNote ? ` \u2014 ${calibration.calibrationMethodNote}` : ''
      }`
    : `Evidence score: ${CONFIDENCE_LEVEL_TEXT[level]} (${rounded} of 1.00)`;
  assertNoUncalibratedProbabilityLanguage(label, calibration.calibrated);
  return label;
}

export type EvidenceDimensionKey =
  'confidence' | 'relevance' | 'connectionStrength' | 'researchCoverage';

export type EvidenceDimensionCopy = {
  readonly label: string;
  readonly description: string;
};

/** Distinguishing copy for each measurement dimension — deliberately never merged into one
 * blended figure or label. Each answers a different question about a claim or record. */
export const EVIDENCE_DIMENSION_COPY: Readonly<
  Record<EvidenceDimensionKey, EvidenceDimensionCopy>
> = {
  confidence: {
    label: 'Confidence \u2014 evidence score',
    description:
      'How strong the supporting evidence is for this specific claim: source authority, ' +
      'directness, independent corroborating lineages, and extraction quality, weighted and ' +
      'combined per the product constitution policy. This is a score, not a probability that the ' +
      'claim is true.',
  },
  relevance: {
    label: 'Relevance',
    description:
      'Whether this record belongs in BlackStory at all \u2014 its connection to documented ' +
      'Black history against the constitution relevance gates. Distinct from how confident any ' +
      'single claim on the record is.',
  },
  connectionStrength: {
    label: 'Connection strength',
    description:
      'How substantively this entity connects to the corpus theme, independent of any one ' +
      'claim\u2019s evidentiary confidence.',
  },
  researchCoverage: {
    label: 'Research coverage',
    description:
      'How much of this record has been researched so far \u2014 a statement about research ' +
      'completeness, not about the certainty of any individual claim already found.',
  },
} as const;
