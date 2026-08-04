/**
 * Codified per-kind content expectations — the minimum bar an entity record (or article) must
 * meet before it reads as "covered" rather than a stub. This is the data-driven counterpart to
 * the structural publish gates (`../citations/completeness-gate.ts`, `../relevance/notability-gate.ts`):
 * those gate *integrity* (every claim cited, inclusion basis recorded); this gates *depth*.
 *
 * Design rules:
 * - Specs are data, not prose: one `ContentExpectationSpec` per entity kind plus one for
 *   articles, versioned via `CONTENT_EXPECTATIONS_SPEC_VERSION` so audit rows recorded against
 *   an older spec remain interpretable.
 * - Evaluation is deterministic and serializable: `evaluateContentExpectations` returns a
 *   `ContentAuditResult` with one reasoned pass/fail per check, suitable for appending to an
 *   audit-history table and for re-attestation when either the spec version or the content
 *   changes (compare `contentFingerprint`).
 * - No hidden scoring: the only aggregate is `passed` (AND of required checks) and the explicit
 *   `failedCheckIds` list. Tiering (minimal/partial/substantial) stays in
 *   `../publication/release-builder.ts` (`computeReleaseResearchCoverage`) and is referenced
 *   here as a floor, not recomputed.
 */
import type { EntityKind } from '../entity-kinds.js';

/** Bump when any spec's requirements change; recorded on every audit result. */
export const CONTENT_EXPECTATIONS_SPEC_VERSION = 1;

export type ResearchCoverageTier = 'minimal' | 'partial' | 'substantial';

const COVERAGE_RANK: Record<ResearchCoverageTier, number> = {
  minimal: 0,
  partial: 1,
  substantial: 2,
};

export interface ContentExpectationSpec {
  /** Kind this spec applies to, or 'article' for the chapters/articles spine. */
  readonly appliesTo: EntityKind | 'article';
  /** Minimum paragraphs of narrative prose (historicalContext + extendedNarrative, blank-line separated). */
  readonly minNarrativeParagraphs: number;
  /** Whether an explicit impact-on-Black-Americans statement is required. */
  readonly requiresImpactStatement: boolean;
  /** Required range of case references (related entities of kind 'case'). Display cap is `max`. */
  readonly caseReferences?: { readonly min: number; readonly max: number };
  /** Minimum distinct evidence sources backing the record (Wikipedia alone = 1). */
  readonly minDistinctSources: number;
  /** Floor on the deterministic researchCoverage tier from the release builder. */
  readonly minResearchCoverage: ResearchCoverageTier;
}

/**
 * The default bar: summary is already schema-enforced (120–400 chars), so the floor here is
 * one narrative paragraph, one source, and at least partial coverage.
 */
const BASELINE: Omit<ContentExpectationSpec, 'appliesTo'> = {
  minNarrativeParagraphs: 1,
  requiresImpactStatement: false,
  minDistinctSources: 1,
  minResearchCoverage: 'partial',
};

/**
 * Per-kind bars. Laws: ≥2 narrative paragraphs, an explicit impact statement, and 1–5 case
 * references (5 is the display cap, 1 the floor). Places (historic sites): a second source
 * beyond the Wikipedia baseline is required — NRHP nominations are the intended tier-1 source.
 */
export const CONTENT_EXPECTATIONS: Record<EntityKind, ContentExpectationSpec> = {
  person: { appliesTo: 'person', ...BASELINE },
  place: { appliesTo: 'place', ...BASELINE, minDistinctSources: 2 },
  school: { appliesTo: 'school', ...BASELINE, minDistinctSources: 2 },
  organization: { appliesTo: 'organization', ...BASELINE },
  institution: { appliesTo: 'institution', ...BASELINE },
  event: { appliesTo: 'event', ...BASELINE },
  law: {
    appliesTo: 'law',
    minNarrativeParagraphs: 2,
    requiresImpactStatement: true,
    caseReferences: { min: 1, max: 5 },
    minDistinctSources: 2,
    minResearchCoverage: 'partial',
  },
  case: {
    appliesTo: 'case',
    ...BASELINE,
    minNarrativeParagraphs: 2,
    requiresImpactStatement: true,
    minDistinctSources: 2,
  },
  publication: { appliesTo: 'publication', ...BASELINE },
  artifact: { appliesTo: 'artifact', ...BASELINE },
  movement: { appliesTo: 'movement', ...BASELINE, minNarrativeParagraphs: 2 },
  other: { appliesTo: 'other', ...BASELINE, minResearchCoverage: 'minimal' },
};

/** Articles/chapters: long-form by definition. */
export const ARTICLE_CONTENT_EXPECTATIONS: ContentExpectationSpec = {
  appliesTo: 'article',
  minNarrativeParagraphs: 6,
  requiresImpactStatement: true,
  minDistinctSources: 2,
  minResearchCoverage: 'substantial',
};

/** Neutral input shape so callers can evaluate canonical rows, projections, or drafts. */
export interface ContentExpectationInput {
  readonly id: string;
  readonly kind: EntityKind | 'article';
  /** Narrative prose blocks; paragraphs are blank-line separated within each block. */
  readonly narrativeBlocks: readonly (string | undefined)[];
  /** An explicit impact-on-Black-Americans statement, when authored. */
  readonly impactStatement?: string;
  /** Count of related entities of kind 'case' (or cited cases, for articles). */
  readonly caseReferenceCount?: number;
  /** Distinct evidence sources (collectors/source orgs) backing the record. */
  readonly distinctSourceCount?: number;
  /** Tier from `computeReleaseResearchCoverage`; absent means not yet derived. */
  readonly researchCoverage?: ResearchCoverageTier;
}

export interface ContentExpectationCheck {
  readonly checkId:
    | 'narrative_paragraphs'
    | 'impact_statement'
    | 'case_references'
    | 'distinct_sources'
    | 'research_coverage';
  readonly passed: boolean;
  readonly reason: string;
}

export interface ContentAuditResult {
  readonly subjectId: string;
  readonly appliesTo: EntityKind | 'article';
  readonly specVersion: number;
  readonly passed: boolean;
  readonly checks: readonly ContentExpectationCheck[];
  readonly failedCheckIds: readonly ContentExpectationCheck['checkId'][];
}

/** Count blank-line-separated paragraphs of ≥40 chars across the narrative blocks. */
export function countNarrativeParagraphs(blocks: readonly (string | undefined)[]): number {
  let count = 0;
  for (const block of blocks) {
    if (!block) continue;
    for (const part of block.split(/\n\s*\n/)) {
      if (part.trim().length >= 40) count += 1;
    }
  }
  return count;
}

export function specForKind(kind: EntityKind | 'article'): ContentExpectationSpec {
  return kind === 'article' ? ARTICLE_CONTENT_EXPECTATIONS : CONTENT_EXPECTATIONS[kind];
}

/** Evaluate a record against its kind's spec. Deterministic; safe to persist as an audit row. */
export function evaluateContentExpectations(input: ContentExpectationInput): ContentAuditResult {
  const spec = specForKind(input.kind);
  const checks: ContentExpectationCheck[] = [];

  const paragraphs = countNarrativeParagraphs(input.narrativeBlocks);
  checks.push({
    checkId: 'narrative_paragraphs',
    passed: paragraphs >= spec.minNarrativeParagraphs,
    reason: `${paragraphs} narrative paragraph(s); minimum for ${spec.appliesTo} is ${spec.minNarrativeParagraphs}.`,
  });

  if (spec.requiresImpactStatement) {
    const hasImpact = Boolean(input.impactStatement && input.impactStatement.trim().length >= 40);
    checks.push({
      checkId: 'impact_statement',
      passed: hasImpact,
      reason: hasImpact
        ? 'Impact-on-Black-Americans statement present.'
        : 'Missing explicit impact-on-Black-Americans statement (≥40 chars).',
    });
  }

  if (spec.caseReferences) {
    const n = input.caseReferenceCount ?? 0;
    checks.push({
      checkId: 'case_references',
      passed: n >= spec.caseReferences.min,
      reason: `${n} case reference(s); requires ≥${spec.caseReferences.min} (display cap ${spec.caseReferences.max}).`,
    });
  }

  const sources = input.distinctSourceCount ?? 0;
  checks.push({
    checkId: 'distinct_sources',
    passed: sources >= spec.minDistinctSources,
    reason: `${sources} distinct source(s); minimum is ${spec.minDistinctSources}.`,
  });

  const coverage = input.researchCoverage ?? 'minimal';
  checks.push({
    checkId: 'research_coverage',
    passed: COVERAGE_RANK[coverage] >= COVERAGE_RANK[spec.minResearchCoverage],
    reason: `researchCoverage is '${coverage}'; floor is '${spec.minResearchCoverage}'.`,
  });

  const failedCheckIds = checks.filter((c) => !c.passed).map((c) => c.checkId);
  return {
    subjectId: input.id,
    appliesTo: spec.appliesTo,
    specVersion: CONTENT_EXPECTATIONS_SPEC_VERSION,
    passed: failedCheckIds.length === 0,
    checks,
    failedCheckIds,
  };
}
