/**
 * Server-only rate-limit guard for the `/explore/api` refine route. Reuses 
 * search endpoint class and evaluator explore refinement is an expensive read, not a mutation.
 */
export {
  createSearchRateLimitGuard as createExploreRateLimitGuard,
  type SearchRateLimitGuardOptions as ExploreRateLimitGuardOptions,
} from '../../../search/api/rate-limit-guard';
