/**
 * `FactRecord` the canonical, versioned, citable atom of the fact registry.
 *
 * Modeled on Wikidata's statement + qualifiers + structured references + rank discipline: a
 * `statement` is the citable text; `qualifiers` are small typed key/values that add nuance
 * without changing the statement; `citations` (`./citation.ts`) are first-class structured
 * references, never a bare URL; `status` (`./status.ts`) is the rank axis. Reuses
 * claims/evidence and provenance vocabulary rather than inventing a parallel one a `FactRecord`
 * is the shared-reference atom that entity/place/event pages, the map, and the evidence UI all
 * embed via `./embed.ts`'s `CompactFactView`, from one canonical URL and one citation set.
 *
 * Ontology alignment (/ see `./issues.jsonl` "Ontology
 * alignment" note): `datePrecision` and `geoPrecision` are IMPORTED from the shared domain
 * modules below, never redefined locally.
 *
 * Derivation lineage: `derivedFromClaimIds`/`derivedFromRelationshipIds` are the (optional,
 * possibly-empty) link BACK from a fact to the `CanonicalClaim`(s) (`../claims/claim.ts`) and/or
 * `EntityRelationship`(s) (`../relationship.ts`) it was written from. A `FactRecord` otherwise
 * carries its own independent `citations`/`confidence`, so without this link a fact's sourcing
 * can silently drift from the canonical claim that backed it. `./derivation.ts`'s
 * `evaluateFactDerivationConsistency` is the check that uses this link to catch that drift; see
 * that module's doc comment for the exact comparison rule (a judgment call, documented there).
 */
import { isDatePrecision, type DatePrecision } from '../era.js';
import { isGeoPrecisionTier, type GeoPrecisionTier } from '../geography/precision.js';
import type { EntityKind } from '../entity-kinds.js';
import { assertFactClaimTypeValid, claimTypeRequiresGeo, claimTypeRequiresWhen, type FactClaimType } from './claim-type.js';
import { assertFactConfidenceValid, type FactConfidenceGrade } from './confidence.js';
import { assertFactCitationStructurallyComplete, type FactCitation } from './citation.js';
import { assertRevisionsAppendOnly, type FactRevision } from './revision.js';
import { isFactId, type FactId } from './ids.js';
import { isFactStatus, type FactStatus } from './status.js';

/** A typed edge from a fact to a CanonicalEntity it is about. Every
 * edge resolves to a real entity id AND its kind see `./subjects.ts`'s `assertFactSubjectsResolve`
 * for the fail-closed check against a live entity resolver. */
export type FactSubjectEdge = {
  readonly entityId: string;
  readonly kind: EntityKind;
  /** Structural role note (e.g. "victim", "actor", "location") provenance only, never a
   * closed vocabulary the mirroring/graph logic interprets (see `./subjects.ts`). */
  readonly role?: string;
};

export const FACT_QUALIFIER_KINDS = [
  'as-reported-by',
  'estimated',
  'disputed-by-contemporaries',
  'name-variant',
] as const;
export type FactQualifierKind = (typeof FACT_QUALIFIER_KINDS)[number];

export type FactQualifier = {
  readonly kind: FactQualifierKind;
  readonly key: string;
  readonly value: string;
};

/** A circulating misreading of the fact plus its one-line refutation feeds pre-bunking
 * and the myths surface. Never a place to relitigate the dispute at length; that belongs in
 * `confidenceNote` `counterClaims.refutation` being deliberately terse. */
export type FactCounterClaim = {
  readonly misreading: string;
  readonly refutation: string;
};

export const RELATED_FACT_TYPES = [
  'supports',
  'contradicts',
  'contextualizes',
  'supersedes',
  'partOf',
  'sameEventAs',
] as const;
export type RelatedFactType = (typeof RELATED_FACT_TYPES)[number];

export type FactRelatedFact = {
  readonly factId: string;
  readonly type: RelatedFactType;
};

export type FactProvenance = {
  readonly researchedBy: string;
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
  readonly method: string;
};

/** A single point-or-range date at a stated precision reuses `EraSpan`'s validFrom/validTo
 * idiom (`../era.ts`) so a fact's `when` composes with the same decade-bucket derivation every
 * other dated record in this package uses. */
export type FactWhen = {
  readonly validFrom: string;
  readonly validTo?: string | null;
  readonly datePrecision: DatePrecision;
};

export type FactGeo = {
  readonly lat: number;
  readonly lng: number;
  readonly geoPrecision: GeoPrecisionTier;
};

export type FactRecord = {
  readonly id: FactId;
  /** Cosmetic, re-derivable slug never part of identity (see `./ids.ts`). */
  readonly slug: string;
  /** The one declarative citable sentence. */
  readonly statement: string;
  /** <=75 chars, for markup/popups/embeds. */
  readonly shortStatement: string;
  readonly claimType: FactClaimType;
  readonly subjects: readonly FactSubjectEdge[];
  readonly geo?: FactGeo;
  readonly when?: FactWhen;
  readonly qualifiers: readonly FactQualifier[];
  readonly counterClaims: readonly FactCounterClaim[];
  readonly relatedFacts: readonly FactRelatedFact[];
  /**
   * `CanonicalClaim.id`s (`../claims/claim.ts`) this fact was derived from, if any. Empty for
   * facts predating this field (see `./derivation.ts`'s module doc for the backfill decision) or
   * for facts that genuinely were not written from a tracked canonical claim. Never assume a
   * non-empty array resolves to LIVE claims without checking they still exist  see
   * `./derivation.ts`.
   */
  readonly derivedFromClaimIds: readonly string[];
  /** `EntityRelationship.id`s (`../relationship.ts`) this fact was derived from, if any. Same
   * empty-is-valid convention as `derivedFromClaimIds`. */
  readonly derivedFromRelationshipIds: readonly string[];
  readonly provenance: FactProvenance;
  readonly status: FactStatus;
  readonly confidence: FactConfidenceGrade;
  readonly confidenceNote?: string;
  readonly citations: readonly FactCitation[];
  readonly revisions: readonly FactRevision[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Fail-closed structural validity for a `FactRecord`. Does NOT enforce the
 * publish-time citation-completeness gate see `./publish-gate.ts` for that (a `draft` fact may
 * legitimately have zero citations yet; this function only checks internal consistency of
 * whatever is present).
 */
export function assertFactRecordStructurallyValid(fact: FactRecord): void {
  if (!isFactId(fact.id)) {
    throw new Error(`FactRecord.id "${fact.id}" is not a valid BB-F-###### id`);
  }
  if (!isNonEmpty(fact.slug)) {
    throw new Error('FactRecord.slug must be non-empty');
  }
  if (!isNonEmpty(fact.statement)) {
    throw new Error('FactRecord.statement must be non-empty');
  }
  if (!isNonEmpty(fact.shortStatement) || fact.shortStatement.length > 75) {
    throw new Error('FactRecord.shortStatement must be non-empty and at most 75 characters');
  }
  assertFactClaimTypeValid(fact.claimType);

  if (claimTypeRequiresGeo(fact.claimType) && !fact.geo) {
    throw new Error(`FactRecord.claimType "${fact.claimType}" requires a geo anchor`);
  }
  if (fact.geo && !isGeoPrecisionTier(fact.geo.geoPrecision)) {
    throw new Error(`FactRecord.geo.geoPrecision "${fact.geo.geoPrecision}" is not a recognized GeoPrecisionTier`);
  }

  if (claimTypeRequiresWhen(fact.claimType) && !fact.when) {
    throw new Error(`FactRecord.claimType "${fact.claimType}" requires a when anchor`);
  }
  if (fact.when && !isDatePrecision(fact.when.datePrecision)) {
    throw new Error(`FactRecord.when.datePrecision "${fact.when.datePrecision}" is not a recognized DatePrecision`);
  }
  if (fact.when && !isNonEmpty(fact.when.validFrom)) {
    throw new Error('FactRecord.when.validFrom must be non-empty when when is present');
  }

  if (fact.subjects.length === 0) {
    throw new Error('FactRecord.subjects[] must name at least one CanonicalEntity');
  }
  for (const subject of fact.subjects) {
    if (!isNonEmpty(subject.entityId)) {
      throw new Error('FactRecord.subjects[].entityId must be non-empty');
    }
  }

  if (!isFactStatus(fact.status)) {
    throw new Error(`Unknown FactRecord.status "${fact.status}"`);
  }
  assertFactConfidenceValid({
    confidence: fact.confidence,
    ...(fact.confidenceNote !== undefined ? { confidenceNote: fact.confidenceNote } : {}),
  });

  for (const claimId of fact.derivedFromClaimIds) {
    if (!isNonEmpty(claimId)) {
      throw new Error('FactRecord.derivedFromClaimIds[] entries must be non-empty when present');
    }
  }
  for (const relationshipId of fact.derivedFromRelationshipIds) {
    if (!isNonEmpty(relationshipId)) {
      throw new Error('FactRecord.derivedFromRelationshipIds[] entries must be non-empty when present');
    }
  }

  if (!isNonEmpty(fact.provenance.researchedBy)) {
    throw new Error('FactRecord.provenance.researchedBy must be non-empty');
  }
  if (!isNonEmpty(fact.provenance.method)) {
    throw new Error('FactRecord.provenance.method must be non-empty');
  }

  for (const citation of fact.citations) {
    assertFactCitationStructurallyComplete(citation);
  }

  assertRevisionsAppendOnly([], fact.revisions);
}

/** True when every citation is structurally complete AND at least one citation exists the
 * per-record predicate `./publish-gate.ts` uses before allowing a status transition to
 * published/corrected. Does not itself decide publishability; see that module. */
export function hasCompleteFactCitations(fact: Pick<FactRecord, 'citations'>): boolean {
  return fact.citations.length > 0 && fact.citations.every((citation) => {
    try {
      assertFactCitationStructurallyComplete(citation);
      return true;
    } catch {
      return false;
    }
  });
}
