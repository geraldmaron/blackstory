/**
 * Builds the full evidence-card view model for one claim: evidence-score confidence
 * language, rights-limited excerpt/citation resolution, preserved dispute presentation,
 * and source-lineage / research-coverage / last-checked / revision / retraction metadata
 * kept visibly distinct from confidence. Pure and synchronously testable — no I/O, no
 * React — so `apps/web/src/components/evidence/EntityEvidencePanel.tsx` stays a thin
 * rendering layer over this module, matching this codebase's existing
 * `entity-view-model.ts` convention of separating decision logic from JSX.
 */
import { formatEvidenceScoreLabel } from './confidence-language';
import { buildDisputeView } from './contradiction-view';
import { resolveCitationForDisplay, resolveExcerptForDisplay } from './rights-guard';
import type { EvidenceClaimInput, EvidenceClaimView } from './types';

export function buildEvidenceCard(input: EvidenceClaimInput): EvidenceClaimView {
  const confidenceLabel = formatEvidenceScoreLabel(input.confidenceScore, input.confidenceLevel);
  const citation = resolveCitationForDisplay(input.citation);
  const excerpt = input.excerpt ? resolveExcerptForDisplay(input.excerpt) : undefined;
  const dispute = input.dispute ? buildDisputeView(input.dispute) : undefined;

  return {
    id: input.id,
    predicate: input.predicate,
    object: input.object,
    confidenceLabel,
    confidenceLevel: input.confidenceLevel,
    confidenceScore: input.confidenceScore,
    citation,
    ...(excerpt ? { excerpt } : {}),
    ...(dispute ? { dispute } : {}),
    ...(input.sourceLineage ? { sourceLineage: input.sourceLineage } : {}),
    ...(input.researchCoverage ? { researchCoverage: input.researchCoverage } : {}),
    ...(input.lastCheckedAt ? { lastCheckedAt: input.lastCheckedAt } : {}),
    revisionHistory: input.revisionHistory ?? [],
    ...(input.retraction ? { retraction: input.retraction } : {}),
    ...(input.relevanceNote ? { relevanceNote: input.relevanceNote } : {}),
    ...(input.connectionStrengthNote ? { connectionStrengthNote: input.connectionStrengthNote } : {}),
  };
}

export function buildEvidenceCards(inputs: readonly EvidenceClaimInput[]): readonly EvidenceClaimView[] {
  return inputs.map(buildEvidenceCard);
}

/** Sum of each claim's independent-lineage count, for a record-level source-lineage rollup when
 * the caller has not supplied one explicitly (e.g. from a real projection aggregate). */
export function totalSourceLineageCount(cards: readonly EvidenceClaimView[]): number {
  return cards.reduce((sum, card) => sum + (card.sourceLineage?.independentLineageCount ?? 0), 0);
}

/** Most recent `lastCheckedAt` across all cards and their research-coverage records, or
 * `undefined` when no card carries one \u2014 used as a record-level fallback. */
export function mostRecentLastCheckedAt(cards: readonly EvidenceClaimView[]): string | undefined {
  const dates = cards
    .flatMap((card) => [card.lastCheckedAt, card.researchCoverage?.lastCheckedAt])
    .filter((value): value is string => Boolean(value));
  if (dates.length === 0) return undefined;
  return dates.reduce((latest, current) => (current > latest ? current : latest));
}
