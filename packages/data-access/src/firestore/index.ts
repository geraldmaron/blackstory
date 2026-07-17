/**
 * Firestore access path constants and claim guards for server packages (ADR-011).
 * Prefer Admin SDK writes from Cloud Run workers; do not import from browsers.
 *
 * Postgres SQL Connect helpers remain in the parent package under deferred exports 
 * see DEFERRED.md and infra/database/README.md.
 */
export {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_PATHS,
  assertStaffMayPublish,
  assertNotResearchPublish,
} from './access.js';
export type { FirestoreCollectionId, StaffClaims } from './access.js';
