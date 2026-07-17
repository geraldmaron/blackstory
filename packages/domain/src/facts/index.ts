/**
 * BB-086 canonical fact registry — the fact framework.
 *
 * A `FactRecord` (`./record.ts`) is a canonical, versioned, citable atom modeled on Wikidata's
 * statement + qualifiers + structured-references + rank discipline. It serves two purposes at
 * once, per the owner brief this bead expands: (1) a searchable fact library
 * (`./search-index.ts` hooks published facts into the BB-049 search lane), and (2) a
 * shared-reference layer other surfaces embed via `./embed.ts`'s `CompactFactView` — the map,
 * entity/place/event pages, and the evidence UI all cite the SAME canonical URL and citation set
 * for a given fact, never a per-surface copy.
 *
 * Reuses, rather than re-implements: BB-014/BB-016 claims/evidence/provenance vocabulary, BB-019
 * publication/projection discipline (`./publish-gate.ts` mirrors
 * `../citations/completeness-gate.ts`'s fail-closed posture), BB-049 search primitives
 * (`./search-index.ts`), BB-053 evidence-UI shapes (`./embed.ts`'s citation view mirrors
 * `apps/web/src/lib/evidence`'s `EvidenceCitationView`), and the BB-090/BB-091 shared
 * `datePrecision`/`geoPrecision` vocabularies (imported in `./record.ts`, never redefined here).
 *
 * `subjects[]` (`./subjects.ts`) is confirmed as a BB-092 graph-view input: `toFactSubjectSource`
 * adapts a `FactRecord` into `../graph/fact-subjects.ts`'s structural port so
 * `mirrorFactSubjectsIntoRelationships` folds a fact's subjects into the published browse graph
 * at publish time — a fact-only entity linkage is never invisible to the graph (BB-092 AC8).
 *
 * Citation rendering: `./citation.ts`'s `FactCitation` stores CSL-JSON (MIT schema) plus the
 * Black Book extension block; the intended renderer is citation.js (`@citation-js/core`, MIT) at
 * the presentation layer (`apps/web`) — this package does not depend on citation.js itself, it
 * only stores CSL-JSON in the shape that library expects.
 *
 * PARENT WIRING NOTE: this barrel is intentionally NOT re-exported from
 * `packages/domain/src/index.ts` yet — per this repo's multi-agent convention, the parent adds
 * `export * from './facts/index.js';` (and the matching `export type *`, if any type-only
 * re-export split is needed) to that shared barrel after reviewing this module, rather than this
 * bead editing the shared file directly.
 */

export {
  isFactId,
  asFactId,
  formatFactId,
  slugifyFactStatement,
  buildFactPath,
  buildFactRevisionPath,
  buildFactJsonPath,
  slugNeedsRedirect,
} from './ids.js';
export type { FactId } from './ids.js';

export {
  FACT_CLAIM_TYPES,
  isFactClaimType,
  CLAIM_TYPE_REQUIRES_GEO,
  CLAIM_TYPE_REQUIRES_WHEN,
  CLAIM_TYPE_ABOUT_SCHEMA_TYPE,
  assertFactClaimTypeValid,
  claimTypeRequiresGeo,
  claimTypeRequiresWhen,
} from './claim-type.js';
export type { FactClaimType } from './claim-type.js';

export {
  FACT_STATUSES,
  isFactStatus,
  PUBLISHABLE_FACT_STATUSES,
  isPublishableFactStatus,
  PUBLICLY_RESOLVABLE_FACT_STATUSES,
  isPubliclyResolvableFactStatus,
  SEARCH_INDEXABLE_FACT_STATUSES,
  isSearchIndexableFactStatus,
  assertFactStatusNeverResolvesTo404,
  assertFactResolutionBannerValid,
} from './status.js';
export type { FactStatus, PublishableFactStatus, FactResolutionBanner } from './status.js';

export {
  FACT_CONFIDENCE_GRADES,
  isFactConfidenceGrade,
  FACT_CONFIDENCE_DEFINITIONS,
  CONFIDENCE_GRADES_REQUIRING_NOTE,
  confidenceGradeRequiresNote,
  assertFactConfidenceValid,
  assertStatusConfidenceAxesIndependent,
} from './confidence.js';
export type { FactConfidenceGrade } from './confidence.js';

export {
  CITATION_SOURCE_CLASSES,
  CITATION_ROLES,
  isWebFactCitation,
  assertFactCitationStructurallyComplete,
  isFactCitationStructurallyComplete,
} from './citation.js';
export type {
  CitationSourceClass,
  CitationRole,
  CslJsonReference,
  FactCitationExtension,
  FactCitation,
} from './citation.js';

export {
  FACT_REVISION_CHANGE_TYPES,
  isFactRevisionChangeType,
  assertFactRevisionValid,
  assertRevisionsAppendOnly,
  buildNextRevision,
  currentFactRevision,
} from './revision.js';
export type {
  FactRevisionChangeType,
  FactRevisionAgent,
  FactRevisionDiffEntry,
  FactRevision,
} from './revision.js';

export {
  RELATED_FACT_TYPES,
  FACT_QUALIFIER_KINDS,
  assertFactRecordStructurallyValid,
  hasCompleteFactCitations,
} from './record.js';
export type {
  FactSubjectEdge,
  FactQualifierKind,
  FactQualifier,
  FactCounterClaim,
  RelatedFactType,
  FactRelatedFact,
  FactProvenance,
  FactWhen,
  FactGeo,
  FactRecord,
} from './record.js';

export {
  evaluateFactPublishGate,
  assertFactMayPublish,
  evaluateFactProjectionPublishGate,
  assertFactProjectionPublishGate,
  assertFactRemainsResolvable,
  isFactSearchIndexable,
} from './publish-gate.js';
export type { FactPublishGateFailureReason, FactPublishGateResult } from './publish-gate.js';

export { buildCompactFactView, buildCompactFactViewsForEntity } from './embed.js';
export type { CompactFactSubjectView, CompactFactCitationView, CompactFactView } from './embed.js';

export { buildFactArticleJsonLd, assertNeverClaimReview } from './jsonld.js';
export type { FactJsonLdOptions } from './jsonld.js';

export {
  evaluateFactSubjectReferences,
  assertFactSubjectsResolve,
  toFactSubjectSource,
  mirrorFactsIntoRelationships,
} from './subjects.js';
export type { FactSubjectEntityResolver, DanglingFactSubjectReference } from './subjects.js';

export { buildFactSearchIndexDoc, buildFactSearchIndexDocs } from './search-index.js';
export type { FactSearchIndexDoc, SkippedFactRecord, BuildFactSearchIndexResult } from './search-index.js';
