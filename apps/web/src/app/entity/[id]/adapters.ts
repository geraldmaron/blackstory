/**
 * Maps public claim views into evidence inputs for the record page's evidence list, and decides
 * the record's trauma-content notice.
 */
import {
  classifyStoryDimensions,
  deriveTraumaContentNotice,
  type DisclaimerRecord,
} from '@repo/domain';
import type { EvidenceClaimInput } from '../../../lib/evidence';
import type { PublicClaimView, PublicEntityView } from '../../../data/public-seed';

/**
 * The sensitive-content disclaimer when the record's own accepted prose documents harm, else
 * undefined. Same texts and the same domain rule (`deriveTraumaContentNotice`) the "why this
 * appears" composer uses; it reads the story dimensions directly, so the notice never depends on
 * whether the inclusion explanation passes its separate prose gates.
 */
export function traumaContentDisclaimerFor(entity: PublicEntityView): DisclaimerRecord | undefined {
  const dimensions = classifyStoryDimensions([
    entity.relevanceExplanation,
    entity.historicalContext,
    ...entity.claims.map((claim) => `${claim.predicate} ${claim.object}`),
  ]);
  const notice = deriveTraumaContentNotice(dimensions);
  return notice.warranted ? notice.disclaimer : undefined;
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
 * disclosure, so the two never contradict each other). The record's evidence grade still reads the
 * full claim set, and the record file lists that summary's source under "Also cited".
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
