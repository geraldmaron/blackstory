/**
 * Parent-owned adapters that map BB-052 seed entity views into BB-053 evidence inputs and
 * BB-054 public "why this appears" payloads. Keeps the entity page free of field-renaming clutter
 * and reuses the same notability-label → BB-090 criterion synthesis as the snapshot search index.
 */
import {
  NOTABILITY_RUBRIC,
  buildPublicWhyThisAppears,
  type NotabilityBasisRecord,
  type NotabilityCriterion,
  type PublicWhyThisAppears,
  type RelevanceEvidence,
} from '@black-book/domain';
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

/** Maps seed `PublicClaimView` rows into BB-053 `EvidenceClaimInput` (citation field rename + dispute). */
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

/** Builds the BB-054 public why-this-appears payload from a seed entity view. */
export function buildWhyThisAppearsForEntity(entity: PublicEntityView): PublicWhyThisAppears {
  return buildPublicWhyThisAppears({
    explanation: entity.relevanceExplanation,
    evidence: relevanceEvidenceForEntity(entity),
    notabilityBasis: synthesizeNotabilityBasis(entity.notabilityLabels),
    storyTexts: [entity.historicalContext, ...entity.claims.map((c) => `${c.predicate} ${c.object}`)],
  });
}
