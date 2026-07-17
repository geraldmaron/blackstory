/**
 * Signal-strength classification for query-pack matches (BB-038).
 * Weak signals may produce candidates only — never independent promotion.
 */
import type {
  MatchOutcome,
  QueryTerm,
  SignalStrength,
  TermClass,
} from './types.js';

const STRONG_CLASSES: ReadonlySet<TermClass> = new Set(['positive', 'historical', 'modern']);
const SUPPORTING_CLASSES: ReadonlySet<TermClass> = new Set(['geographic', 'alias', 'source_specific']);
const WEAK_ONLY_CLASSES: ReadonlySet<TermClass> = new Set(['negative', 'alias', 'geographic']);

export type ClassifySignalInput = {
  readonly matchedTerms: readonly QueryTerm[];
};

export type ClassifySignalResult = {
  readonly strength: SignalStrength;
  readonly outcome: MatchOutcome;
  readonly matchedClasses: readonly TermClass[];
  readonly reasons: readonly string[];
};

function uniqueClasses(terms: readonly QueryTerm[]): TermClass[] {
  return [...new Set(terms.map((term) => term.termClass))];
}

function hasAnyClass(classes: readonly TermClass[], targets: ReadonlySet<TermClass>): boolean {
  return classes.some((value) => targets.has(value));
}

/**
 * Classify matched terms into strong / medium / weak signal strength.
 * - strong: positive paired with historical/modern, or positive + geographic
 * - medium: positive alone, or alias/source_specific with supporting context
 * - weak: negative-only, alias-only, or geographic-only matches
 */
export function classifySignalStrength(input: ClassifySignalInput): ClassifySignalResult {
  const matchedClasses = uniqueClasses(input.matchedTerms);
  const reasons: string[] = [];

  if (input.matchedTerms.length === 0) {
    return {
      strength: 'weak',
      outcome: 'candidate_only',
      matchedClasses,
      reasons: ['no_terms_matched'],
    };
  }

  const hasPositive = matchedClasses.includes('positive');
  const hasHistoricalOrModern =
    matchedClasses.includes('historical') || matchedClasses.includes('modern');
  const hasGeographic = matchedClasses.includes('geographic');
  const hasAlias = matchedClasses.includes('alias');
  const hasSourceSpecific = matchedClasses.includes('source_specific');
  const hasNegative = matchedClasses.includes('negative');

  if (hasPositive && hasHistoricalOrModern) {
    reasons.push('positive_with_period_term');
    return { strength: 'strong', outcome: 'promotable', matchedClasses, reasons };
  }

  if (hasPositive && hasGeographic) {
    reasons.push('positive_with_geographic');
    return { strength: 'strong', outcome: 'promotable', matchedClasses, reasons };
  }

  if (hasPositive && (hasAlias || hasSourceSpecific)) {
    reasons.push('positive_with_alias_or_source');
    return { strength: 'medium', outcome: 'promotable', matchedClasses, reasons };
  }

  if (hasPositive) {
    reasons.push('positive_only');
    return { strength: 'medium', outcome: 'promotable', matchedClasses, reasons };
  }

  if (hasHistoricalOrModern && !hasPositive) {
    reasons.push('period_term_without_positive');
    return { strength: 'weak', outcome: 'candidate_only', matchedClasses, reasons };
  }

  if (hasNegative && matchedClasses.length === 1) {
    reasons.push('negative_only');
    return { strength: 'weak', outcome: 'candidate_only', matchedClasses, reasons };
  }

  if (hasAlias && matchedClasses.every((value) => WEAK_ONLY_CLASSES.has(value))) {
    reasons.push('alias_without_positive');
    return { strength: 'weak', outcome: 'candidate_only', matchedClasses, reasons };
  }

  if (hasGeographic && !hasAnyClass(matchedClasses, STRONG_CLASSES)) {
    reasons.push('geographic_without_positive');
    return { strength: 'weak', outcome: 'candidate_only', matchedClasses, reasons };
  }

  if (hasSourceSpecific && hasAnyClass(matchedClasses, SUPPORTING_CLASSES) && !hasPositive) {
    reasons.push('source_specific_without_positive');
    return { strength: 'weak', outcome: 'candidate_only', matchedClasses, reasons };
  }

  reasons.push('residual_medium');
  return { strength: 'medium', outcome: 'promotable', matchedClasses, reasons };
}

export function outcomeForSignalStrength(strength: SignalStrength): MatchOutcome {
  return strength === 'weak' ? 'candidate_only' : 'promotable';
}

export function assertMayPromoteBeyondCandidate(result: ClassifySignalResult): void {
  if (result.outcome === 'candidate_only') {
    throw new Error(
      `Weak signal (${result.strength}) produces candidates only: ${result.reasons.join(', ')}`,
    );
  }
}

export function mayPromoteBeyondCandidate(result: ClassifySignalResult): boolean {
  return result.outcome === 'promotable';
}
