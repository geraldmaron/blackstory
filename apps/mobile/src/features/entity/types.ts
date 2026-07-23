/**
 * Vendored entity/claim/citation/timeline/revision/media/related TYPES for the entity detail
 * screen (MOB-014).
 *
 * INTEGRATION GAP — same situation `apps/mobile/src/data/contracts.ts` already documents:
 * `apps/mobile` ships its own isolated npm lockfile with no `@repo` scope wired in, so
 * `@repo/public-contracts` cannot be imported here today. Rather than invent a different shape,
 * every type below is a field-for-field mirror of its schema in
 * `packages/public-contracts/src/v1/{entity,claim,citation,timeline,revision,media,related}.ts`
 * — same field names, same optionality, same enums, same bounds (as named constants). Nothing
 * here adds a field the wire schema doesn't have, and nothing renames one.
 *
 * `data/contracts.ts`'s own vendored `EntityV1` is intentionally minimal (id/kind/displayName/
 * revision + an opaque catch-all) because the cache layer treats entity bodies as opaque JSON.
 * This screen is the first consumer that actually RENDERS the full shape, so it needs the fuller
 * mirror — kept in `features/entity` (this bead's exclusive path) rather than editing
 * `data/contracts.ts` (out of this bead's ownership).
 *
 * These are TYPES only, matching ADR-021 discipline (no zod, no runtime schema — see
 * `normalize.ts` for the defensive runtime narrowing that stands in for schema validation here).
 */

// ---------------------------------------------------------------------------
// Enums (mirrored verbatim from public-contracts)
// ---------------------------------------------------------------------------

export const ENTITY_KINDS = [
  'person',
  'place',
  'school',
  'organization',
  'institution',
  'event',
  'law',
  'case',
  'publication',
  'artifact',
  'movement',
  'other',
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const LOCATION_PRECISIONS = ['city', 'neighborhood', 'campus', 'institution'] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export const RESEARCH_COVERAGE_LEVELS = ['minimal', 'partial', 'substantial'] as const;
export type ResearchCoverage = (typeof RESEARCH_COVERAGE_LEVELS)[number];

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const DATE_PRECISIONS = ['day', 'month', 'year', 'decade', 'circa'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export const DISPUTE_ALTERNATE_KINDS = ['contradicting', 'alternative'] as const;
export type DisputeAlternateKind = (typeof DISPUTE_ALTERNATE_KINDS)[number];

export const REVISION_CHANGE_KINDS = ['created', 'revised', 'corrected', 'retracted'] as const;
export type RevisionChangeKind = (typeof REVISION_CHANGE_KINDS)[number];

export const MEDIA_RIGHTS_STATUSES = ['public_domain', 'licensed', 'fair_use'] as const;
export type MediaRightsStatus = (typeof MEDIA_RIGHTS_STATUSES)[number];

export const RELATION_DIRECTIONS = ['outgoing', 'incoming'] as const;
export type RelationDirection = (typeof RELATION_DIRECTIONS)[number];

// ---------------------------------------------------------------------------
// Bounds (mirrored from the `boundedArray`/`max` calls in public-contracts).
// Used by normalize.ts to cap arrays defensively, independent of server-side enforcement.
// ---------------------------------------------------------------------------

export const MAX_CLAIMS = 500;
export const MAX_TIMELINE_EVENTS = 1000;
export const MAX_RELATED_ENTRIES = 500;
export const MAX_RELATED_NEIGHBORS = 50;
export const MAX_CONTINUE_LEARNING = 50;
export const MAX_DISPUTE_ALTERNATES = 50;
export const MAX_CLAIM_REVISION_HISTORY = 200;
export const MAX_STATUS_HISTORY = 500;
export const MAX_NOTABILITY_LABELS = 100;
export const MAX_NOTABILITY_BASIS = 100;
export const MAX_TOPIC_TAGS = 200;
export const MAX_TOPIC_IDS = 200;
export const MAX_ERA_BUCKETS = 200;
export const MAX_BASIS_CLAIM_IDS = 500;
/** Client-side render cap for `extendedNarrative`, matching the schema's own `max(20_000)` —
 * defense in depth so a malformed/oversized payload can never force an unbounded render even
 * if it slipped past server-side validation (adversarial case: "maliciously large narrative"). */
export const MAX_EXTENDED_NARRATIVE_CHARS = 20_000;
export const MAX_SUMMARY_CHARS = 5000;
export const MAX_SHORT_TEXT = 300;
export const MAX_LONG_TEXT = 4000;
export const MAX_NOTE_TEXT = 2000;

// ---------------------------------------------------------------------------
// Citation (citation.ts)
// ---------------------------------------------------------------------------

export interface Citation {
  readonly source: string;
  readonly label: string;
  readonly href?: string;
  readonly withheldReason?: string;
}

// ---------------------------------------------------------------------------
// Claim (claim.ts)
// ---------------------------------------------------------------------------

export interface ClaimDisputeAlternate {
  readonly value: string;
  readonly credible: boolean;
  readonly kind: DisputeAlternateKind;
}

export interface ClaimDispute {
  readonly hasDispute: boolean;
  readonly primaryValue: string;
  readonly note?: string;
  readonly alternates: readonly ClaimDisputeAlternate[];
}

export interface ClaimRevisionEntry {
  readonly id: string;
  readonly changedAt: string;
  readonly changeKind: RevisionChangeKind;
  readonly summary: string;
  readonly policyVersion?: string;
}

export interface ClaimRetraction {
  readonly retractedAt: string;
  readonly reason: string;
  readonly supersededByClaimId?: string;
}

export interface Claim {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceScore: number;
  readonly confidenceLevel: ConfidenceLevel;
  /** Required on the wire; kept optional here ONLY because the defensive normalizer must
   * tolerate a malformed/absent citation without throwing (adversarial case: "a claim with no
   * citations") — the UI renders an explicit "no source" fallback rather than crash. */
  readonly citation?: Citation;
  readonly independentLineageCount?: number;
  readonly dispute?: ClaimDispute;
  readonly revisionHistory?: readonly ClaimRevisionEntry[];
  readonly retraction?: ClaimRetraction;
}

// ---------------------------------------------------------------------------
// Timeline (timeline.ts)
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  readonly id: string;
  readonly atLabel: string;
  readonly at?: string;
  readonly datePrecision: DatePrecision;
  readonly title: string;
  readonly body: string;
}

// ---------------------------------------------------------------------------
// Revision (revision.ts)
// ---------------------------------------------------------------------------

export interface RevisionMetadata {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly recordUpdatedAt: string;
}

// ---------------------------------------------------------------------------
// Media (media.ts)
// ---------------------------------------------------------------------------

export interface Media {
  readonly url: string;
  readonly alt: string;
  readonly credit: string;
  readonly rightsStatus: MediaRightsStatus;
  readonly width?: number;
  readonly height?: number;
  readonly objectPath?: string;
}

// ---------------------------------------------------------------------------
// Related (related.ts)
// ---------------------------------------------------------------------------

export interface RelationTimespan {
  readonly label?: string;
  readonly validFrom?: string;
  readonly validTo?: string | null;
}

export interface RelatedEntry {
  readonly id: string;
  readonly type: string;
  readonly direction: RelationDirection;
  readonly timespan?: RelationTimespan;
}

export interface RelatedNeighbor {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly summary: string;
  readonly relationType: string;
  readonly direction: RelationDirection;
  readonly timespan?: RelationTimespan;
}

// ---------------------------------------------------------------------------
// Entity (entity.ts)
// ---------------------------------------------------------------------------

export interface StatusHistoryEntry {
  readonly status: string;
  readonly validFrom?: string;
  readonly validTo?: string | null;
  readonly datePrecision: DatePrecision;
  readonly basisClaimIds: readonly string[];
}

export interface EventWindow {
  readonly startAt?: string;
  readonly endAt?: string | null;
  readonly datePrecision: DatePrecision;
  readonly eventType?: string;
}

export interface EntitySensitivity {
  readonly class: string;
  readonly note: string;
  readonly basisClaimIds: readonly string[];
}

export interface NotabilityBasisEntry {
  readonly criterion: string;
  readonly note: string;
  readonly evidenceIds: readonly string[];
}

export interface GeoAnchor {
  readonly lat: number;
  readonly lng: number;
  readonly geohash: string;
  readonly matchMethod: string;
}

export interface Entity {
  readonly id: string;
  readonly kind: EntityKind | (string & {});
  readonly displayName: string;
  readonly summary: string;
  readonly status?: string;
  readonly statusHistory?: readonly StatusHistoryEntry[];
  readonly eventWindow?: EventWindow;
  readonly eraBuckets?: readonly string[];
  readonly notabilityLabels?: readonly string[];
  readonly notabilityBasis?: readonly NotabilityBasisEntry[];
  readonly sensitivityClass?: string;
  readonly sensitivity?: EntitySensitivity;
  readonly topicTags: readonly string[];
  readonly topicIds?: readonly string[];
  readonly jurisdictionLabel: string;
  readonly locationPrecision?: LocationPrecision;
  readonly locationLabel: string;
  readonly relevanceExplanation: string;
  readonly historicalContext: string;
  readonly extendedNarrative?: string;
  readonly primaryImage?: Media;
  readonly recordMaturity: string;
  readonly researchCoverage?: ResearchCoverage;
  readonly geoAnchor?: GeoAnchor;
  readonly claims: readonly Claim[];
  readonly timeline: readonly TimelineEvent[];
  readonly revision: RevisionMetadata;
  readonly related?: readonly RelatedEntry[];
  readonly relatedNeighbors?: readonly RelatedNeighbor[];
  readonly continueLearning?: readonly RelatedNeighbor[];
}
