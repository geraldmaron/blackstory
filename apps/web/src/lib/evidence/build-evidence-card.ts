/** Build evidence cards without inferring scores or independent source lineages. */
import { formatEvidenceScoreLabel } from './confidence-language';
import { buildDisputeView } from './contradiction-view';
import { resolveCitationForDisplay, resolveExcerptForDisplay } from './rights-guard';
import type { EvidenceClaimInput, EvidenceClaimView, EvidenceSourceLineageInput } from './types';

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
    ...(input.confidenceScore !== undefined ? { confidenceScore: input.confidenceScore } : {}),
    citation,
    ...(excerpt ? { excerpt } : {}),
    ...(dispute ? { dispute } : {}),
    ...(input.sourceLineage ? { sourceLineage: input.sourceLineage } : {}),
    ...(input.researchCoverage ? { researchCoverage: input.researchCoverage } : {}),
    ...(input.lastCheckedAt ? { lastCheckedAt: input.lastCheckedAt } : {}),
    revisionHistory: input.revisionHistory ?? [],
    ...(input.retraction ? { retraction: input.retraction } : {}),
    ...(input.relevanceNote ? { relevanceNote: input.relevanceNote } : {}),
    ...(input.connectionStrengthNote
      ? { connectionStrengthNote: input.connectionStrengthNote }
      : {}),
  };
}

export function buildEvidenceCards(
  inputs: readonly EvidenceClaimInput[],
): readonly EvidenceClaimView[] {
  return inputs.map(buildEvidenceCard);
}

/** Only a reviewed aggregate or the sole claim's lineage count can describe the record.
 * Multiple claims may reuse the same lineage; citation labels do not establish independence. */
export function resolveRecordSourceLineage(
  cards: readonly EvidenceClaimView[],
  explicit?: EvidenceSourceLineageInput,
): EvidenceSourceLineageInput | undefined {
  return explicit ?? (cards.length === 1 ? cards[0]?.sourceLineage : undefined);
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
