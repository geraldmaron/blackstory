/**
 * Leftover Firestore access path constants and claim guards. Nothing outside this package's
 * own test imports them. The live store is Supabase Postgres, and the publish boundary is
 * enforced by schema grants and RLS in supabase/migrations/, not here. See
 * docs/decisions-carryover.md, "Firestore as system of record, reversed".
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
