/**
 * Query term validation and public-safe projection.
 * Offensive historical terminology is never emitted as default public language.
 */
import type { PublicSafeTerm, QueryTerm, TermClass } from './types.js';
import { TERM_CLASSES } from './types.js';

export function isTermClass(value: string): value is TermClass {
  return (TERM_CLASSES as readonly string[]).includes(value);
}

export function assertTermClass(value: string): asserts value is TermClass {
  if (!isTermClass(value)) {
    throw new Error(`Unknown term class: ${value}`);
  }
}

export function assertQueryTermValid(term: QueryTerm): void {
  const text = term.text.trim();
  if (!text) {
    throw new Error('Query term text is required');
  }
  assertTermClass(term.termClass);
  if (term.termClass === 'source_specific' && !term.sourceId?.trim()) {
    throw new Error('source_specific terms require sourceId');
  }
  if (term.weight !== undefined && (term.weight < 0 || !Number.isFinite(term.weight))) {
    throw new Error('Query term weight must be a non-negative finite number');
  }
}

export function assertQueryTermsValid(terms: readonly QueryTerm[]): void {
  for (const term of terms) {
    assertQueryTermValid(term);
  }
}

function isResearchOnlyOffensive(term: QueryTerm): boolean {
  return term.researchOnlyOffensive === true;
}

/**
 * Strip or flag terms that must not appear in public interfaces.
 * Research-only offensive terms are omitted from public output entirely.
 */
export function toPublicSafeTerms(terms: readonly QueryTerm[]): readonly PublicSafeTerm[] {
  const safe: PublicSafeTerm[] = [];
  for (const term of terms) {
    if (isResearchOnlyOffensive(term)) {
      continue;
    }
    safe.push({
      text: term.text,
      termClass: term.termClass,
      redacted: false,
    });
  }
  return safe;
}

/**
 * Returns research terms including offensive historical language for internal query building.
 * Callers must never expose this output through public APIs without explicit review gates.
 */
export function toResearchQueryTerms(terms: readonly QueryTerm[]): readonly QueryTerm[] {
  return terms.map((term) => ({ ...term }));
}

export function countRedactedTerms(terms: readonly QueryTerm[]): number {
  return terms.filter((term) => isResearchOnlyOffensive(term)).length;
}

export function publicSafeSummary(terms: readonly QueryTerm[]): {
  readonly publicCount: number;
  readonly redactedCount: number;
} {
  const redactedCount = countRedactedTerms(terms);
  return {
    publicCount: terms.length - redactedCount,
    redactedCount,
  };
}
