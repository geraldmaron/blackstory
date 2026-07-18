/**
 * Parent-owned adapters that map entity views into evidence inputs and
 * public "why this appears" payloads. Keeps the entity page free of field-renaming clutter.
 * When an entity carries a real `notabilityBasis` (the related workstream's release builder,
 * `@repo/domain`'s `buildReleaseEntityArtifacts`) this uses it as-is — real `evidenceIds`
 * pointing at real claims. Bundled seed fixtures predate the release builder and carry only
 * `notabilityLabels`, so this falls back to the same label → criterion synthesis as the snapshot
 * search index for those. The synthesized fallback's `evidenceIds` is empty: that means "no
 * structured evidence-id linkage recorded", not "zero evidence exists". Callers must not render
 * `evidenceIds.length` as a documented-source count for these records (see `WhyThisAppears`,
 * which hides the count when it's empty).
 */
import {
  NOTABILITY_RUBRIC,
  buildPublicWhyThisAppears,
  type NotabilityBasisRecord,
  type NotabilityCriterion,
  type PublicWhyThisAppears,
  type RelevanceEvidence,
} from '@repo/domain';
import type { EvidenceClaimInput } from '../../../lib/evidence';
import type { PublicClaimView, PublicEntityView } from '../../../data/public-seed';

const RUBRIC_ENTRIES = Object.entries(NOTABILITY_RUBRIC) as readonly [
  NotabilityCriterion,
  string,
][];

function criterionForLabel(label: string): NotabilityCriterion {
  const match = RUBRIC_ENTRIES.find(([, text]) => text === label);
  return match ? match[0] : 'documented_site';
}

function synthesizeNotabilityBasis(
  labels: readonly string[] | undefined,
): readonly NotabilityBasisRecord[] {
  return (labels ?? []).map((note) => ({
    criterion: criterionForLabel(note),
    note,
    evidenceIds: [] as const,
  }));
}

/** Real notabilityBasis when the entity carries one (the related workstream release builder output);
 * otherwise the label-synthesis fallback above for pre-builder seed fixtures. */
function notabilityBasisFor(entity: PublicEntityView): readonly NotabilityBasisRecord[] {
  if (entity.notabilityBasis && entity.notabilityBasis.length > 0) {
    return entity.notabilityBasis;
  }
  return synthesizeNotabilityBasis(entity.notabilityLabels);
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
    };
    const dispute =
      claim.disputed === true || claim.disputeNote !== undefined
        ? {
            primaryValue: claim.object,
            ...(claim.disputed !== undefined ? { disputed: claim.disputed } : {}),
            ...(claim.disputeNote !== undefined ? { disputeNote: claim.disputeNote } : {}),
          }
        : undefined;
    return {
      id: claim.id,
      predicate: claim.predicate,
      object: claim.object,
      confidenceScore: claim.confidenceScore,
      confidenceLevel: claim.confidenceLevel,
      citation,
      ...(dispute !== undefined ? { dispute } : {}),
    };
  });
}

function relevanceEvidenceForEntity(entity: PublicEntityView): readonly RelevanceEvidence[] {
  const evidence: RelevanceEvidence[] = [
    {
      kind: 'thematic',
      summary: 'Topic tags connect this record to documented Black history themes.',
      detail: entity.topicTags.join(', '),
    },
    {
      kind: 'geographic',
      summary: 'Record is jurisdiction-anchored to a U.S. place context.',
      detail: entity.jurisdictionLabel,
    },
  ];
  return evidence;
}

/** Builds the public why-this-appears payload from a seed entity view.  */
export function buildWhyThisAppearsForEntity(entity: PublicEntityView): PublicWhyThisAppears {
  return buildPublicWhyThisAppears({
    explanation: entity.relevanceExplanation,
    evidence: relevanceEvidenceForEntity(entity),
    notabilityBasis: notabilityBasisFor(entity),
    storyTexts: [entity.historicalContext, ...entity.claims.map((c) => `${c.predicate} ${c.object}`)],
  });
}
