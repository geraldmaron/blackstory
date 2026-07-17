/**
 * Shared domain primitives for Black Book entities and geography (BB-014).
 * Living-status and public precision rules come from @black-book/schemas (constitution).
 * Firestore document converters live in @black-book/firebase; Cloud SQL / PostGIS are deferred.
 */
export { asEntityId, asRelationshipId, asMergeId, asLocationId } from './ids.js';
export type { EntityId, RelationshipId, MergeId, LocationId } from './ids.js';

export { livingStatuses, treatAsLiving, DEFAULT_LIVING_STATUS } from './living.js';
export type { LivingStatus } from './living.js';

export { ENTITY_KINDS, isEntityKind } from './entity-kinds.js';
export type { EntityKind } from './entity-kinds.js';

export type { EntityAlias, EntityIdentifier, EntityMergeState, CanonicalEntity } from './entity.js';

export type {
  SchoolName,
  SchoolCampus,
  SchoolCampusStatus,
  SchoolStatusEntry,
  SchoolFields,
} from './school.js';

export type {
  PersonFields,
  OrganizationFields,
  InstitutionFields,
  EventFields,
  LawFields,
  CaseFields,
  PublicationFields,
  ArtifactFields,
} from './specialized.js';

export { RELATIONSHIP_TYPES, assertRelationshipHasEvidence } from './relationship.js';
export type {
  RelationshipType,
  TemporalContext,
  GeographicRelationshipContext,
  EntityRelationship,
} from './relationship.js';

export { assertMergeReversible, reverseMerge, isMergeActive } from './merge.js';
export type { EntityMergeStatus, EntityMergeRecord } from './merge.js';

export {
  encodeGeohash,
  geohashPrefixes,
  buildGeoPointFields,
  haversineMeters,
  DEFAULT_GEOHASH_PRECISION,
  MAX_GEOHASH_PRECISION,
} from './geography/geohash.js';
export type { GeoPoint, GeoPointFields } from './geography/geohash.js';

export {
  allowedPublicPrecisionLevels,
  prohibitedPublicPrecisionLevels,
  assertPublicPrecisionAllowed,
  isPublicPrecisionAllowed,
} from './geography/precision.js';
export type { PublicPrecisionLevel } from './geography/precision.js';

export {
  GEOGRAPHIC_MATCH_METHODS,
  assertZipNotHistoricalBoundary,
  locationsMayCoexist,
  hasHistoricalAndCurrent,
} from './geography/location.js';
export type {
  GeoGeometry,
  LocationRole,
  GeographicMatchMethod,
  GeographicMatch,
  ZipCodeRole,
  ZipCodeInput,
  JurisdictionKind,
  Jurisdiction,
  EntityLocation,
  PlaceFields,
} from './geography/location.js';
