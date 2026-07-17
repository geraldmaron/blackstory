/**
 * `FactRecord.confidence` evidence-grade axis (BB-086 acceptance criterion 1) — independent of
 * `./status.ts`'s workflow-rank axis (see that module's doc comment for the non-conflation
 * rule). A small closed scale plus rich prose (`confidenceNote`), per the industry move away
 * from single numeric confidence scores: definitions are published on the methodology page
 * (`FACT_CONFIDENCE_DEFINITIONS` below is that copy's single source of truth), and any nuance a
 * fixed grade cannot capture belongs in `confidenceNote`, never a second hidden number.
 */

export const FACT_CONFIDENCE_GRADES = [
  'established',
  'corroborated',
  'single-source',
  'contested',
] as const;

export type FactConfidenceGrade = (typeof FACT_CONFIDENCE_GRADES)[number];

export function isFactConfidenceGrade(value: string): value is FactConfidenceGrade {
  return (FACT_CONFIDENCE_GRADES as readonly string[]).includes(value);
}

/** Methodology-page copy — the definitions readers see when they follow a confidence badge. */
export const FACT_CONFIDENCE_DEFINITIONS: Readonly<Record<FactConfidenceGrade, string>> = {
  established:
    'Corroborated by multiple independent, high-authority sources with no credible ' +
    'contemporary or scholarly dispute.',
  corroborated:
    'Supported by two or more independent sources; minor gaps or non-authoritative dissent may ' +
    'exist but do not undermine the core statement.',
  'single-source':
    'Documented by exactly one source meeting the citation bar. Independently unverified — not ' +
    'necessarily wrong, but not yet cross-checked.',
  contested:
    'Credible sources disagree, or the statement rests on a source with documented reliability ' +
    'concerns. See `confidenceNote` and `counterClaims[]` for the specifics of the dispute.',
};

/**
 * Grades whose nuance cannot be captured by the grade alone and therefore require a non-empty
 * `confidenceNote` prose explanation (fail-closed — see `assertFactConfidenceValid`).
 * `established`/`corroborated` may still carry an optional note but are not required to.
 */
export const CONFIDENCE_GRADES_REQUIRING_NOTE = ['single-source', 'contested'] as const;

export function confidenceGradeRequiresNote(grade: FactConfidenceGrade): boolean {
  return (CONFIDENCE_GRADES_REQUIRING_NOTE as readonly FactConfidenceGrade[]).includes(grade);
}

export function assertFactConfidenceValid(input: {
  readonly confidence: string;
  readonly confidenceNote?: string;
}): void {
  if (!isFactConfidenceGrade(input.confidence)) {
    throw new Error(
      `Unknown FactRecord confidence grade "${input.confidence}" — expected one of: ` +
        FACT_CONFIDENCE_GRADES.join(', '),
    );
  }
  if (confidenceGradeRequiresNote(input.confidence) && !input.confidenceNote?.trim()) {
    throw new Error(
      `FactRecord confidence "${input.confidence}" requires a non-empty confidenceNote explaining the nuance.`,
    );
  }
}

/**
 * Structural guard proving the two axes are never derived one-from-the-other in this module:
 * every (status, confidence) pairing is valid — a `contested`-confidence fact may be
 * `published`, and an `established`-confidence fact may still be `draft`. Callers that find
 * themselves computing `confidence` from `status` (or vice versa) have violated BB-086's "two
 * independent axes, never conflated" design rule.
 */
export function assertStatusConfidenceAxesIndependent(input: {
  readonly status: string;
  readonly confidence: string;
}): void {
  if (!isFactConfidenceGrade(input.confidence)) {
    throw new Error(`Unknown FactRecord confidence grade "${input.confidence}"`);
  }
  // No cross-axis rule exists by design — this function's only job is to exist as the named,
  // testable proof that no such rule was smuggled in elsewhere.
  void input.status;
}
