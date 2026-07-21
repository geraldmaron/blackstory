/**
 * Explore API request-integrity guard.
 *
 * Re-exports the shared search-route factory so map refine stays on the same
 * same-origin integrity control without duplicating policy.
 */
export {
  createSearchRequestIntegrityGuard as createExploreRequestIntegrityGuard,
  type SearchRequestIntegrityGuard as ExploreRequestIntegrityGuard,
  type SearchRequestIntegrityOptions as ExploreRequestIntegrityOptions,
} from '../../../search/api/request-integrity-guard';
