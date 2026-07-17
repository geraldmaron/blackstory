/**
 * Server-only App Check verification for the `/history/api` refine route. Reuses the
 * search route's guard factory verbatim same policy as `/explore/api`.
 */
export {
  createSearchAppCheckGuard as createHistoryAppCheckGuard,
  type SearchAppCheckGuard as HistoryAppCheckGuard,
} from '../../search/api/app-check-guard';
