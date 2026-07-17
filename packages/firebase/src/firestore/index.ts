/**
 * Firestore model surface for Black Book (ADR-011 / BB-013–014).
 */
export { FIRESTORE_ROOT, firestorePaths } from './paths.js';
export type { FirestoreRootCollection } from './paths.js';

export {
  authClaimFlagsSchema,
  entityKindSchema,
  geoPointFieldsSchema,
  geoGeometrySchema,
  zipCodeInputSchema,
  geographicMatchSchema,
  entityLocationSchema,
  entityAliasSchema,
  entityIdentifierSchema,
  entityMergeStateSchema,
  schoolFieldsSchema,
  policyActiveSchema,
  policyVersionSchema,
  canonicalEntitySchema,
  entityRelationshipSchema,
  entityMergeSchema,
  evidenceRecordSchema,
  publicationReleaseSchema,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  submissionInboxSchema,
  auditEventSchema,
  killSwitchSchema,
} from './types.js';
export type {
  AuthClaimFlags,
  EntityKindDoc,
  GeoPointFields,
  GeoGeometryDoc,
  ZipCodeInputDoc,
  GeographicMatchDoc,
  EntityLocationDoc,
  PolicyActiveDoc,
  PolicyVersionDoc,
  CanonicalEntityDoc,
  EntityRelationshipDoc,
  EntityMergeDoc,
  EvidenceRecordDoc,
  PublicationReleaseDoc,
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
  SubmissionInboxDoc,
  AuditEventDoc,
  KillSwitchDoc,
} from './types.js';

export {
  parseWithSchema,
  policyActiveConverter,
  policyVersionConverter,
  canonicalEntityConverter,
  entityLocationConverter,
  entityRelationshipConverter,
  entityMergeConverter,
  evidenceRecordConverter,
  publicationReleaseConverter,
  publicActiveReleaseConverter,
  publicEntityProjectionConverter,
  submissionInboxConverter,
  auditEventConverter,
  killSwitchConverter,
} from './converters.js';

export { resolveStaffRoles, canPublish, canResearchWrite, researchMayPublish } from './claims.js';
export type { StaffRole } from './claims.js';
