/**
 * Bounded mobile search feature (MOB-013). Self-contained: the route
 * (`src/app/(tabs)/search.tsx`) imports only `SearchScreen` from here.
 */
export { SearchScreen, type SearchScreenProps } from './SearchScreen';
export { useSearch, type UseSearchOptions, type UseSearchResult } from './useSearch';
export {
  createSearchController,
  type SearchController,
  type SearchControllerState,
  type SearchFreshness,
} from './search-controller';
export { getSearchRuntime, type SearchRuntime } from './search-runtime';
export {
  normalizeSearchQuery,
  foldForComparison,
  getSearchMode,
  MAX_RAW_INPUT_LENGTH,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
  type SearchMode,
} from './query-normalization';
export { createDebouncer, useDebouncedValue, type Debouncer, type DebounceTimers } from './debounce';
export {
  addRecentSearch,
  removeRecentSearch,
  parseRecentSearches,
  serializeRecentSearches,
  createRecentSearchesStore,
  createExpoRecentSearchesBackend,
  RECENT_SEARCHES_SECRET_KEY,
  MAX_RECENT_ITEMS,
  MAX_RECENT_TERM_LENGTH,
  type RecentSearchEntry,
  type RecentSearchesStore,
} from './recent-searches';
export {
  buildSearchRequestPath,
  buildQueryShapeKey,
  assertNoRankingSignal,
  RankingSignalLeakError,
  DEFAULT_SEARCH_PAGE_SIZE,
  MAX_SEARCH_RESULTS_PER_RESPONSE,
  type SearchResultV1,
  type SearchResponseV1,
  type SearchFacetCountsV1,
  type SearchRequestParams,
} from './search-contracts';
export { SearchResultCard, toSearchResultCardProps, type SearchResultCardProps, type SearchResultCardHandlers } from './SearchResultCard';
export { BROWSE_CATEGORIES, type BrowseCategory } from './browse-categories';
export { BrowseCategoryList, type BrowseCategoryListProps } from './BrowseCategoryList';
