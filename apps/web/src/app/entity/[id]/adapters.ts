/**
 * Parent-owned adapters that map entity views into evidence inputs and
 * public "why this appears" payloads. Keeps the entity page free of field-renaming clutter.
 *
 * Inclusion basis must resolve to named claim citations. When a release carries real
 * `notabilityBasis` with `evidenceIds`, those ids are kept; notes that are only a dump of
 * `NOTABILITY_RUBRIC` methodology prose are rewritten from the entity's cited claims so already-
 * published projections stay honest without a republish. Seed fixtures that only have
 * `notabilityLabels` get a single citation-backed basis (not empty-evidence theater).
 * Topic tags and jurisdiction labels are catalog metadata — never passed as source evidence.
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

function citedClaims(entity: PublicEntityView): readonly PublicClaimView[] {
  return entity.claims.filter((claim) => claim.citationSource.trim().length > 0);
}

function citedClaimIds(entity: PublicEntityView): readonly string[] {
  return citedClaims(entity).map((claim) => claim.id);
}

/** Record-specific inclusion note from cited claims — never methodology rubric prose alone. */
function noteFromCitedClaims(entity: PublicEntityView): string {
  const cited = citedClaims(entity);
  if (cited.length === 0) {
    return 'Inclusion is pending linked source citations.';
  }
  const [first] = cited;
  const sources = [...new Set(cited.map((claim) => claim.citationSource.trim()))];
  return `${first!.predicate.replaceAll('_', ' ')}: ${first!.object}. Cited from ${sources.join('; ')}.`;
}

function isRubricOnlyNote(criterion: NotabilityCriterion, note: string): boolean {
  return note.trim() === NOTABILITY_RUBRIC[criterion].trim();
}

/**
 * Real notabilityBasis when present; rewrite rubric-only notes and fill empty evidenceIds from
 * this entity's cited claims. Seed labels synthesize one citation-backed basis.
 */
function notabilityBasisFor(entity: PublicEntityView): readonly NotabilityBasisRecord[] {
  const citedIds = citedClaimIds(entity);
  const fallbackNote = noteFromCitedClaims(entity);

  if (entity.notabilityBasis && entity.notabilityBasis.length > 0) {
    return entity.notabilityBasis.map((record) => {
      const evidenceIds = record.evidenceIds.length > 0 ? record.evidenceIds : citedIds;
      const note = isRubricOnlyNote(record.criterion, record.note) ? fallbackNote : record.note;
      return {
        criterion: record.criterion,
        note,
        evidenceIds,
      };
    });
  }

  const labels = entity.notabilityLabels ?? [];
  if (labels.length === 0) {
    if (citedIds.length === 0) {
      return [];
    }
    return [
      {
        criterion: 'documented_site' as const,
        note: fallbackNote,
        evidenceIds: citedIds,
      },
    ];
  }

  return labels.map((label) => ({
    criterion: criterionForLabel(label),
    note: fallbackNote,
    evidenceIds: citedIds,
  }));
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
    // Only pass through scored lineage. Do not invent `1` from a citation — that would make
    // the record rollup sum claims instead of unique sources; EntityEvidencePanel falls back to
    // distinct citation sources when claim lineage is absent.
    const sourceLineage =
      claim.independentLineageCount !== undefined && claim.independentLineageCount > 0
        ? { independentLineageCount: claim.independentLineageCount }
        : undefined;
    return {
      id: claim.id,
      predicate: claim.predicate,
      object: claim.object,
      confidenceScore: claim.confidenceScore,
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
    detail: `${claim.citationLabel}: ${claim.predicate.replaceAll('_', ' ')} — ${claim.object}`,
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

/** Builds the public why-this-appears payload from an entity view.  */
export function buildWhyThisAppearsForEntity(entity: PublicEntityView): PublicWhyThisAppears {
  return buildPublicWhyThisAppears({
    explanation: entity.relevanceExplanation,
    evidence: relevanceEvidenceForEntity(entity),
    notabilityBasis: notabilityBasisFor(entity),
    storyTexts: [entity.historicalContext, ...entity.claims.map((c) => `${c.predicate} ${c.object}`)],
  });
}
