/**
 * Human-readable "why this result" affordances for hybrid search (BB-072 / BB-054).
 *
 * Explanations describe match reasons in plain language — never numeric scores, ranks, or
 * internal fusion weights.
 */
import { eraBucketOverlapsRecord } from './lanes.js';
import type { RankedRecord } from './ranking.js';
import type { SearchableEntityRecord, SearchMatchField } from './types.js';

export type HybridMatchContext = {
  readonly fromStructuredLane: boolean;
  readonly fromVectorLane: boolean;
  readonly placeAnchored: boolean;
  readonly eraFilter?: string;
  readonly eraPreFilter?: string;
};

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function structuredReason(matchedOn: SearchMatchField, matchedText: string): string {
  switch (matchedOn) {
    case 'displayName':
      return 'Matched on name.';
    case 'alias':
      return `Matched alias "${matchedText}".`;
    case 'topicTags':
      return `Matched topic: ${capitalize(matchedText)}.`;
    case 'summary':
      return 'Matched in the summary text.';
    default:
      return 'Matched your search terms.';
  }
}

function nearMatchReason(query: string, record: SearchableEntityRecord): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 4) return false;
  const name = record.nameLower;
  if (name.includes(q)) return false;
  return record.aliases.some((alias) => alias.includes(q));
}

/**
 * Builds the public "why this result" affordance list for a hybrid result. Each entry is a short,
 * factual sentence suitable for UI display.
 */
export function buildWhyThisResult(
  record: SearchableEntityRecord,
  ranked: RankedRecord | undefined,
  query: string,
  context: HybridMatchContext,
): readonly string[] {
  const reasons: string[] = [];

  if (query.trim() === '') {
    reasons.push('Included in the current release.');
    return reasons;
  }

  if (ranked) {
    reasons.push(structuredReason(ranked.matchedOn, ranked.matchedText));
    if (ranked.matchedOn === 'displayName' && nearMatchReason(query, record)) {
      reasons.push('Near-match on name spelling.');
    }
  } else if (context.fromVectorLane) {
    reasons.push('Semantic recall matched your query.');
  }

  if (context.fromVectorLane && context.fromStructuredLane) {
    reasons.push('Confirmed by both keyword and semantic recall.');
  }

  const eraHint = context.eraFilter ?? context.eraPreFilter;
  if (eraHint && eraBucketOverlapsRecord(eraHint, record.eraBuckets)) {
    reasons.push(`Era connection: overlaps ${eraHint}.`);
  }

  if (context.placeAnchored && record.jurisdictionState) {
    reasons.push(`Place connection: ${record.jurisdictionState}.`);
  }

  if (record.researchCoverage === 'minimal') {
    reasons.push('Sparse record — shown because it may still be relevant.');
  }

  if (reasons.length === 0) {
    reasons.push('Matched your search.');
  }

  return reasons;
}

/** Guard that public hybrid explanations never leak numeric scores. */
export function assertHybridExplanationHasNoNumericScore(reasons: readonly string[]): void {
  const forbiddenPatterns = [
    /\bscore\s*[:\s]\s*0?\.\d+/i,
    /\bdistance\s*[:\s]\s*0?\.\d+/i,
    /\bfusion\s*[:\s]\s*0?\.\d+/i,
    /\b0\.\d{2,}\b/,
    /\brank\s*[:\s]\s*\d+/i,
  ];
  for (const reason of reasons) {
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(reason)) {
        throw new Error('Hybrid explanation must not expose numeric scores.');
      }
    }
  }
}
