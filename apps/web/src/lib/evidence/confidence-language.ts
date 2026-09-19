/** Public evidence grades and supplied heuristic scores are never probabilities. */
import type { ConfidenceLevel } from '@repo/ui';

/** A qualitative grade cannot be converted into a measured score. */
export function formatEvidenceScoreLabel(
  score: number | undefined,
  level: ConfidenceLevel,
): string {
  if (score === undefined || !Number.isFinite(score) || score < 0 || score > 1) {
    return `Evidence grade: ${level}`;
  }
  return `Evidence score: ${level} (${score.toFixed(2)} of 1.00)`;
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
    label: 'Confidence: evidence grade',
    description:
      'The recorded strength of evidence for this claim. A grade is qualitative; a numerical ' +
      'score appears only when supplied by an evidence assessment. Neither is a calibrated ' +
      'probability that the claim is true.',
  },
  relevance: {
    label: 'Relevance',
    description:
      'Whether this record belongs in BlackStory at all: its connection to documented ' +
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
      'How much of this record has been researched so far: a statement about research ' +
      'completeness, not about the certainty of any individual claim already found.',
  },
} as const;
