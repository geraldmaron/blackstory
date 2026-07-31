/**
 * Documented accessible peers for search/map journeys.
 * Kept outside test files so `@repo/testing` can re-export the contract.
 */

export const MAP_SEARCH_ACCESSIBLE_PEERS = Object.freeze([
  {
    journey: 'history',
    component: 'HistoryResultList',
    webPath: 'apps/web/src/components/history/HistoryResultList.tsx',
    contract: 'Unified find-in-time result list with labelledBy for screen-reader parity',
  },
  {
    journey: 'explore',
    component: 'SynchronizedResultList',
    webPath: 'apps/web/src/components/map-experience/SynchronizedResultList.tsx',
    contract: 'Full accessibility peer for the map — aria-current tracks selection',
  },
  {
    journey: 'atlas',
    component: 'Atlas noscript filters',
    // Moved with SP-07 slice 2: `/` is the Atlas and `(map)/explore/page.tsx` was deleted, so the
    // native GET FilterBar now ships from the Atlas page itself.
    webPath: 'apps/web/src/app/(map)/page.tsx',
    contract: 'Native GET FilterBar when JavaScript is unavailable',
  },
  {
    journey: 'locate',
    component: 'ManualPlaceSearchForm + search fallback link',
    webPath: 'apps/web/src/components/location/ManualPlaceSearchForm.tsx',
    contract: 'Manual address entry and /history deep link without geolocation',
  },
] as const);
