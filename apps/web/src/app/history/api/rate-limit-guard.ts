/**
 * Server-only rate-limit guard for the `/history/api` refine route. Reuses
 * search rate-limit primitives same posture as `/explore/api`.
 */
export {
  createSearchRateLimitGuard as createHistoryRateLimitGuard,
  type SearchRateLimitGuardOptions as HistoryRateLimitGuardOptions,
} from '../../search/api/rate-limit-guard';
