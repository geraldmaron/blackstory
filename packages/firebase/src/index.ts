/**
 * Firebase client and Admin helpers shared across Black Book surfaces.
 * Production project: black-book-efaaf. Local defaults: demo-black-book emulators.
 */
export {
  ADMIN_APP_ID,
  DEMO_PROJECT_ID,
  FIREBASE_PACKAGE,
  PRODUCTION_API_KEY,
  PRODUCTION_AUTH_DOMAIN,
  PRODUCTION_BREAK_GLASS_ENV,
  PRODUCTION_HOSTING_SITE,
  PRODUCTION_MESSAGING_SENDER_ID,
  PRODUCTION_PROJECT_ID,
  PRODUCTION_PROJECT_NUMBER,
  PRODUCTION_STORAGE_BUCKET,
  REGISTERED_APPS,
  WEB_APP_ID,
} from './constants.js';
export type { FirebaseSurface, RegisteredWebApp } from './constants.js';

export {
  assertFirebaseProjectAllowed,
  hasEmulatorSignals,
  isEmulatorHost,
  resolveFirebaseRuntimeMode,
} from './guard.js';
export type { EnvironmentLike, FirebaseRuntimeMode } from './guard.js';

export {
  firebaseClientConfigSchema,
  parseAdminFirebaseEnv,
  parseServerFirebaseEnv,
  parseWebFirebaseEnv,
} from './env.js';
export type {
  FirebaseClientConfig,
  ParsedFirebaseClientEnv,
  ParsedFirebaseServerEnv,
} from './env.js';

export {
  applyAdminEmulatorEnvironment,
  connectClientEmulators,
  getAdminEmulatorServices,
  readEmulatorHosts,
} from './emulators.js';
export type { EmulatorHosts } from './emulators.js';

export { initializeAppCheckScaffold } from './app-check.js';
export type { AppCheckScaffoldOptions } from './app-check.js';

export { createWebFirebaseClient } from './web-client.js';
export type { WebFirebaseClient } from './web-client.js';

export { createAdminFirebaseClient } from './admin-client.js';
export type { AdminFirebaseClient } from './admin-client.js';

export { createServerFirebaseApp, getServerFirebaseApp } from './server.js';
export type { ServerFirebaseApp } from './server.js';

export {
  FIRESTORE_ROOT,
  firestorePaths,
  authClaimFlagsSchema,
  entityKindSchema,
  geoPointFieldsSchema,
  geoGeometrySchema,
  zipCodeInputSchema,
  geographicMatchSchema,
  entityLocationSchema,
  entityRelationshipSchema,
  entityMergeSchema,
  policyActiveSchema,
  policyVersionSchema,
  canonicalEntitySchema,
  evidenceRecordSchema,
  publicationReleaseSchema,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  submissionInboxSchema,
  auditEventSchema,
  killSwitchSchema,
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
  resolveStaffRoles,
  canPublish,
  canResearchWrite,
  researchMayPublish,
} from './firestore/index.js';
export type {
  FirestoreRootCollection,
  AuthClaimFlags,
  EntityKindDoc,
  GeoPointFields,
  GeoGeometryDoc,
  ZipCodeInputDoc,
  GeographicMatchDoc,
  EntityLocationDoc,
  EntityRelationshipDoc,
  EntityMergeDoc,
  PolicyActiveDoc,
  PolicyVersionDoc,
  CanonicalEntityDoc,
  EvidenceRecordDoc,
  PublicationReleaseDoc,
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
  SubmissionInboxDoc,
  AuditEventDoc,
  KillSwitchDoc,
  StaffRole,
} from './firestore/index.js';
