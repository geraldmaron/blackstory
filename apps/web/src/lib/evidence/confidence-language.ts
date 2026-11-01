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

/**
 * Reader wording for the pipeline's record-maturity tokens.
 *
 * The Record file printed these raw through `humanizeToken`, so a public page said
 * "Maturity: Partial Enrichment" — a pipeline state, in pipeline words, to someone who has
 * never seen the pipeline. The facts are kept; only the wording changes. Anything unmapped
 * falls back to a neutral phrase rather than exposing a new token the day one is added.
 */
export const RECORD_MATURITY_COPY: Readonly<Record<string, string>> = {
  projection_stub: 'Listed, not yet researched',
  partial_enrichment: 'Partly researched',
  full_enrichment: 'Fully researched',
} as const;

export function recordMaturityLabel(token: string): string {
  return RECORD_MATURITY_COPY[token] ?? 'Research in progress';
}

/**
 * Plain-word phrasing for a confidence tier.
 *
 * The record's first screen led with a bare letter — "Grade A" — which means nothing to a
 * reader who has not read the methodology, and sat next to a second vocabulary ("Evidence
 * grade: high") saying the same thing differently. The letter is not dropped: it is what the
 * fixed citation string carries, and it is the vocabulary the native app shares through
 * `@repo/public-contracts/evidence`. It simply stops being the first thing a reader meets.
 *
 * Web-only on purpose. Adding this to public-contracts would change the native app's
 * vocabulary too, and that package is the mobile token source.
 */
export function confidenceTierPhrase(tier: string): string {
  switch (tier) {
    case 'high':
      return 'Well evidenced';
    case 'medium':
      return 'Partly evidenced';
    case 'low':
      return 'Thinly evidenced';
    default:
      return 'Not graded';
  }
}
