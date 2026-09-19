/**
 * Public entity DTO shared by web and mobile. Excludes internal ranking scores, reviewer
 * identity, moderation state and private lineage details. Public location precision is a
 * restricted vocabulary, but coordinate coarseness must be enforced by the producing
 * projection. Status history, sensitivity, disputes, revisions and retractions remain visible.
 */
import { z } from 'zod';
import {
  boundedArray,
  datePrecisionSchema,
  idString,
  nonEmptyText,
} from '../internal/primitives.js';
import { claimV1Schema } from './claim.js';
import { mediaV1Schema } from './media.js';
import { relatedEntryV1Schema, relatedNeighborV1Schema } from './related.js';
import { revisionMetadataV1Schema } from './revision.js';
import { citingStoriesV1Schema } from './story-citation.js';
import { timelineEventV1Schema } from './timeline.js';

/**
 * Full public ontology (docs/decisions-carryover.md, "Entity ontology") — same closed set as
 * `packages/schemas`
 * `PublicEntityProjectionDoc.kind`. Early mobile/API scaffolds only listed the
 * four Dunbar-seed kinds; live releases pin people, orgs, laws, etc., and web
 * Explore already maps every kind. Restricting the wire enum dropped ~40% of
 * geo-anchored records from `GET /v1/map` / entity detail.
 */
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
  // A technology or process a reader recognizes as a thing, distinct from `artifact` (an
  // object). An invention needs no patent to exist: patent access was unequal, and innovation
  // that never entered the patent system is still innovation.
  'invention',
  'other',
] as const;
export const entityKindSchema = z.enum(ENTITY_KINDS);
export type EntityKindV1 = (typeof ENTITY_KINDS)[number];

export const LOCATION_PRECISIONS = ['city', 'neighborhood', 'campus', 'institution'] as const;
export const locationPrecisionSchema = z.enum(LOCATION_PRECISIONS);
export type LocationPrecisionV1 = (typeof LOCATION_PRECISIONS)[number];

export const RESEARCH_COVERAGE_LEVELS = ['minimal', 'partial', 'substantial'] as const;
export const researchCoverageSchema = z.enum(RESEARCH_COVERAGE_LEVELS);
export type ResearchCoverageV1 = (typeof RESEARCH_COVERAGE_LEVELS)[number];

export const statusHistoryEntryV1Schema = z.object({
  status: nonEmptyText(100),
  validFrom: z.string().max(64).optional(),
  validTo: z.union([z.string().max(64), z.null()]).optional(),
  datePrecision: datePrecisionSchema,
  basisClaimIds: boundedArray(idString(200), 500),
});

export type StatusHistoryEntryV1 = z.infer<typeof statusHistoryEntryV1Schema>;

export const eventWindowV1Schema = z.object({
  startAt: z.string().max(64).optional(),
  endAt: z.union([z.string().max(64), z.null()]).optional(),
  datePrecision: datePrecisionSchema,
  eventType: z.string().max(100).optional(),
});

export type EventWindowV1 = z.infer<typeof eventWindowV1Schema>;

export const SENSITIVITY_CLASSES = [
  'racial_terror',
  'exclusion_zone',
  'ongoing_dispute',
  'living_person_sensitive',
] as const;

/** A wider string is intentionally accepted (not a closed enum): the sensitivity taxonomy is
 * still evolving server-side, and a client must never fail closed on an unrecognized-but-real
 * classification it simply doesn't have a label for yet. Callers should treat any non-empty value
 * as "render the sensitivity banner." */
export const entitySensitivityV1Schema = z.object({
  class: nonEmptyText(100),
  note: nonEmptyText(2000),
  basisClaimIds: boundedArray(idString(200), 500),
});

export type EntitySensitivityV1 = z.infer<typeof entitySensitivityV1Schema>;

export const notabilityBasisEntryV1Schema = z.object({
  criterion: nonEmptyText(100),
  note: nonEmptyText(2000),
  /** Never a score — a citation trail only. */
  evidenceIds: boundedArray(idString(200), 500),
});

export type NotabilityBasisEntryV1 = z.infer<typeof notabilityBasisEntryV1Schema>;

/** Public-precision coordinate anchor. `lat`/`lng` are the already-redacted representative point
 * a live release projection carries (redaction discipline: `docs/decisions-carryover.md`,
 * "Public projection and immutable publication snapshots" and "Map stack" for the
 * redaction-injected builder, plus `docs/security/location-precision-standard.md` §4
 * "One engine on the publish path") — never a raw
 * residential address. Bounded to valid coordinate ranges as a structural sanity check. */
export const geoAnchorV1Schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geohash: z.string().max(20),
  matchMethod: z.string().max(100),
});

export type GeoAnchorV1 = z.infer<typeof geoAnchorV1Schema>;

export const entityV1Schema = z.object({
  id: idString(200),
  kind: entityKindSchema,
  displayName: nonEmptyText(300),
  summary: z.string().max(5000),
  status: z.string().max(100).optional(),
  statusHistory: boundedArray(statusHistoryEntryV1Schema, 500).optional(),
  eventWindow: eventWindowV1Schema.optional(),
  eraBuckets: boundedArray(z.string().max(20), 200).optional(),
  notabilityLabels: boundedArray(z.string().max(300), 100).optional(),
  notabilityBasis: boundedArray(notabilityBasisEntryV1Schema, 100).optional(),
  sensitivityClass: z.string().max(100).optional(),
  sensitivity: entitySensitivityV1Schema.optional(),
  topicTags: boundedArray(z.string().max(100), 200),
  topicIds: boundedArray(z.string().max(100), 200).optional(),
  jurisdictionLabel: nonEmptyText(200),
  locationPrecision: locationPrecisionSchema,
  locationLabel: nonEmptyText(300),
  relevanceExplanation: nonEmptyText(4000),
  /**
   * Always present but may be empty when historical context has not been written. Clients must
   * preserve that absence rather than invent prose or treat the record as missing.
   */
  historicalContext: z.string().max(4000),
  extendedNarrative: z.string().max(20_000).optional(),
  primaryImage: mediaV1Schema.optional(),
  recordMaturity: nonEmptyText(100),
  researchCoverage: researchCoverageSchema,
  geoAnchor: geoAnchorV1Schema.optional(),
  claims: boundedArray(claimV1Schema, 500),
  timeline: boundedArray(timelineEventV1Schema, 1000),
  revision: revisionMetadataV1Schema,
  related: boundedArray(relatedEntryV1Schema, 500).optional(),
  relatedNeighbors: boundedArray(relatedNeighborV1Schema, 50).optional(),
  continueLearning: boundedArray(relatedNeighborV1Schema, 50).optional(),
  /**
   * The published stories that cite this record — the record side of "every record links back
   * to the writing about it". Derived by `@repo/domain/publication/cites-edge` from the article
   * projection the release already carries, so it states an edge the data holds rather than
   * inferring one from prose.
   *
   * Optional, and absent rather than empty when nothing cites the record: a record no story has
   * reached yet is the ordinary state of most of the catalog, not a gap to advertise.
   */
  citingStories: citingStoriesV1Schema.optional(),
});

export type EntityV1 = z.infer<typeof entityV1Schema>;
