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
import { humanizeToken } from '../../../components/entity/format';
import { resolveMapTone } from '../../../lib/map-experience/kind-encoding';

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

/**
 * A sensitive or violence-adjacent record: a sensitivity flag, a trauma content note, or a
 * massacre or plantation tone (by topic or by name). Its exhibits are quiet and its map still on
 * its own page and is never lifted onto the home page.
 */
export function isQuietRecord(entity: PublicEntityView): boolean {
  if (entity.sensitivity) return true;
  if (traumaContentDisclaimerFor(entity) !== undefined) return true;
  // Topics first, then the name: a record titled a massacre whose topics do not say so (the
  // Wilmington massacre of 1898) is still one.
  const tone = resolveMapTone({
    topicTags: entity.topicIds ?? entity.topicTags,
    displayName: entity.displayName,
  });
  return tone === 'massacre' || tone === 'plantation';
}

/** A citation's publisher as a reader names it: the bare host, no scheme or `www.`. */
export function publisherOf(claim: PublicClaimView): string {
  return claim.citationSource
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

/** A claim that is a sentence quoted from a source, not a fact stated about the record. */
export function isSourceExcerpt(predicate: string): boolean {
  return predicate.trim().toLowerCase().replace(/[_-]/g, ' ') === 'source states';
}

/** "Dr. Martin Luther King Jr." and "Washington, D.C." end on a period without being sentences. */
const ENDS_ON_ABBREVIATION =
  /(?:\b(?:Jr|Sr|Dr|Mr|Mrs|Ms|Rev|St|Ave|Blvd|Rd|Inc|Co|Corp|Ltd|No|etc)|\b\p{Lu})\.$/u;

/** Does the text end the way a whole sentence does? */
export function endsAsSentence(text: string): boolean {
  const trimmed = text.trim();
  return /[.!?]["')\]”]?$/u.test(trimmed) && !ENDS_ON_ABBREVIATION.test(trimmed);
}

/**
 * A claim in words. A source excerpt is the source's own sentence and stands as written. Any
 * other claim is a fact about the record, and its object alone ("Dr. Martin Luther King Jr.",
 * "on the National Register of Historic Places ...") says nothing without its predicate, however
 * long it is; only an object that is itself a whole sentence goes without one.
 */
export function statementFor(predicate: string, object: string): string {
  const text = object.trim();
  const label = predicate.trim();
  if (label.length === 0 || isSourceExcerpt(label) || endsAsSentence(text)) return text;
  return `${humanizeToken(label)}: ${text}`;
}
