/**
 * Server-only App Check verification for the `/explore/api` refine route (BB-051). Reuses the
 * search route's guard factory verbatim — same policy, same verifier, same replayProtection=false
 * posture for idempotent GET reads (see `apps/web/src/app/search/api/app-check-guard.ts`).
 */
export {
  createSearchAppCheckGuard as createExploreAppCheckGuard,
  type SearchAppCheckGuard as ExploreAppCheckGuard,
} from '../../search/api/app-check-guard';
