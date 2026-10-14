/**
 * Maps public claim views into evidence inputs and inclusion explanations.
 * Stored inclusion decisions and their evidence links remain intact. A citation about the
 * subject cannot establish a criterion or repair a missing evidence assignment.
 */
import {
  buildPublicWhyThisAppears,
  type PublicWhyThisAppears,
  type RelevanceEvidence,
} from '@repo/domain';
import type { EvidenceClaimInput } from '../../../lib/evidence';
import type { PublicClaimView, PublicEntityView } from '../../../data/public-seed';

function citedClaims(entity: PublicEntityView): readonly PublicClaimView[] {
  return entity.claims.filter((claim) => claim.citationSource.trim().length > 0);
}

/**
 * Normalizes prose for the summary-echo comparison below: case, surrounding and internal
 * whitespace, and a single trailing period are all display noise, not content differences.
 */
function normalizeForEcho(text: string): string {
  return text.trim().replace(/\s+/gu, ' ').replace(/\.$/u, '').toLowerCase();
}

/**
 * Drops claims whose object is the summary restated. Lanes that publish a `documented_site`
 * claim built from the row's own summary (see `buildReleaseSourceFromLandscape`) make the page
 * print the same paragraph twice: once as the lede, once under "What the sources say". The
 * claim carries no information the reader has not already had, so it is not shown.
 *
 * Suppression is display-only and scoped to the claims section (and the matching research-gap
 * disclosure, so the two never contradict each other). The rail's source list and the record's
 * evidence grade still read the full claim set — the citation behind that summary is real and
 * stays visible as a source.
 */
export function withoutSummaryEchoClaims(
  claims: readonly PublicClaimView[],
  summary: string,
): readonly PublicClaimView[] {
  const normalizedSummary = normalizeForEcho(summary);
  if (normalizedSummary.length === 0) return claims;
  return claims.filter((claim) => normalizeForEcho(claim.object) !== normalizedSummary);
}

/** Maps seed `PublicClaimView` rows into `EvidenceClaimInput` (citation field rename + dispute).  */
export function toEvidenceClaimInputs(
  claims: readonly PublicClaimView[],
): readonly EvidenceClaimInput[] {
  return claims.map((claim) => {
    const citation: EvidenceClaimInput['citation'] = {
      source: claim.citationSource,
      label: claim.citationLabel,
      ...(claim.citationHref !== undefined ? { href: claim.citationHref } : {}),
      ...(claim.archivedUrl !== undefined ? { archivedUrl: claim.archivedUrl } : {}),
      ...(claim.archivedAt !== undefined ? { archivedAt: claim.archivedAt } : {}),
    };
    const dispute =
      claim.disputed === true || claim.disputeNote !== undefined
        ? {
            primaryValue: claim.object,
            ...(claim.disputed !== undefined ? { disputed: claim.disputed } : {}),
            ...(claim.disputeNote !== undefined ? { disputeNote: claim.disputeNote } : {}),
          }
        : undefined;
    // A citation alone does not establish source independence.
    const sourceLineage =
      claim.independentLineageCount !== undefined && claim.independentLineageCount >= 0
        ? { independentLineageCount: claim.independentLineageCount }
        : undefined;
    return {
      id: claim.id,
      predicate: claim.predicate,
      object: claim.object,
      ...(claim.confidenceScore !== undefined ? { confidenceScore: claim.confidenceScore } : {}),
      confidenceLevel: claim.confidenceLevel,
      citation,
      ...(dispute !== undefined ? { dispute } : {}),
      ...(sourceLineage !== undefined ? { sourceLineage } : {}),
    };
  });
}

/** Source-kind evidence from real claim citations only — never topic/jurisdiction metadata. */
function relevanceEvidenceForEntity(entity: PublicEntityView): readonly RelevanceEvidence[] {
  return citedClaims(entity).map((claim) => ({
    kind: 'source' as const,
    summary: claim.citationSource,
    detail: `${claim.citationLabel}: ${claim.predicate.replaceAll('_', ' ')}. ${claim.object}`,
  }));
}

/** Claim-id → public citation for WhyThisAppears link rendering. */
export type WhyAppearsEvidenceCitation = {
  readonly id: string;
  readonly source: string;
  readonly label: string;
  readonly href?: string;
};

export function whyAppearsEvidenceById(
  entity: PublicEntityView,
): Readonly<Record<string, WhyAppearsEvidenceCitation>> {
  const map: Record<string, WhyAppearsEvidenceCitation> = {};
  for (const claim of citedClaims(entity)) {
    map[claim.id] = {
      id: claim.id,
      source: claim.citationSource,
      label: claim.citationLabel,
      ...(claim.citationHref !== undefined ? { href: claim.citationHref } : {}),
    };
  }
  return map;
}

/**
 * Returns the structured inclusion explanation, or undefined when the domain composer rejects
 * it. The record page reports the missing explanation without substituting a general rubric
 * for record-specific evidence. Publication applies the stricter content gate.
 */
export function buildWhyThisAppearsForEntity(
  entity: PublicEntityView,
): PublicWhyThisAppears | undefined {
  try {
    return buildPublicWhyThisAppears({
      explanation: entity.relevanceExplanation,
      evidence: relevanceEvidenceForEntity(entity),
      notabilityBasis: entity.notabilityBasis ?? [],
      storyTexts: [
        entity.historicalContext,
        ...entity.claims.map((c) => `${c.predicate} ${c.object}`),
      ],
    });
  } catch {
    return undefined;
  }
}
