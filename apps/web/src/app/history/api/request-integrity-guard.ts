/**
 * History API request-integrity guard.
 *
 * Re-exports the shared search-route factory so history refine stays on the same
 * same-origin integrity control without duplicating policy.
 */
export {
  createSearchRequestIntegrityGuard as createHistoryRequestIntegrityGuard,
  type SearchRequestIntegrityGuard as HistoryRequestIntegrityGuard,
  type SearchRequestIntegrityOptions as HistoryRequestIntegrityOptions,
} from '../../search/api/request-integrity-guard';
