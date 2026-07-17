/**
 * Human-readable “Why this appears” explanations.
 * Explanations describe evidence and policy outcomes never numeric scores.
 */
import type { RelevanceDecision } from '@black-book/schemas';
import type { DiscoveryCandidateRecord } from '../discovery/types.js';
import type { RelevanceEvidence, RelevanceOverride } from './types.js';

export type BuildWhyInput = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly decision: RelevanceDecision;
  readonly evidence: readonly RelevanceEvidence[];
  readonly exclusionReason?: string;
  readonly override?: RelevanceOverride;
};

function joinEvidenceSummaries(evidence: readonly RelevanceEvidence[]): string {
  const summaries = evidence
    .filter((entry) => entry.kind !== 'gate')
    .map((entry) => entry.summary);
  if (summaries.length === 0) {
    return 'No substantive relevance evidence was found.';
  }
  return summaries.join(' ');
}

/** Build a public-safe explanation without numeric relevance scores. */
export function buildWhyThisAppears(input: BuildWhyInput): string {
  const { candidate, decision, evidence, exclusionReason, override } = input;

  if (override) {
    return `Manual review override (${decision.replace('_', ' ')}): ${override.reason.trim()}`;
  }

  if (decision === 'exclude') {
    const reason =
      exclusionReason ??
      evidence.find((entry) => entry.kind === 'gate')?.detail ??
      'Candidate was excluded during relevance review.';
    return `Excluded from inclusion: ${reason}`;
  }

  const placeHint = candidate.geographicHints[0]?.text;
  const matchedTerms = candidate.signals.matchedTerms.slice(0, 3).join(', ');
  const base = joinEvidenceSummaries(evidence);

  if (decision === 'include') {
    const placePhrase = placeHint ? ` with place connection to ${placeHint}` : '';
    const termPhrase = matchedTerms ? ` Matching terms include ${matchedTerms}.` : '';
    return `Included because archival and discovery signals connect this record to Black historical scope${placePhrase}.${termPhrase} ${base}`.trim();
  }

  const termPhrase = matchedTerms ? ` Terms matched: ${matchedTerms}.` : '';
  return `Retained as supporting context only — geographic or thematic signals are present but do not independently meet inclusion thresholds.${termPhrase} ${base}`.trim();
}

export function assertExplanationHasNoNumericScore(explanation: string): void {
  const forbiddenPatterns = [
    /\bscore\s*[:\s]\s*0?\.\d+/i,
    /\brelevance\s*[:\s]\s*0?\.\d+/i,
    /\b0\.\d{2,}\b/,
  ];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(explanation)) {
      throw new Error('Public relevance explanation must not expose numeric scores.');
    }
  }
}
