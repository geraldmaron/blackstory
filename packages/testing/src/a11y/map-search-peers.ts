
/**
 * Documented accessible peers for search/map journeys.
 * Kept outside test files so `@black-book/testing` can re-export the contract.
 */

export const MAP_SEARCH_ACCESSIBLE_PEERS = Object.freeze([
  {
    journey: 'search',
    component: 'ResultList (@black-book/ui)',
    webPath: 'packages/ui/src/components/ResultList.tsx',
    contract: 'Server-rendered result list with labelledBy for screen-reader parity',
  },
  {
    journey: 'explore',
    component: 'SynchronizedResultList',
    webPath: 'apps/web/src/components/map-experience/SynchronizedResultList.tsx',
    contract: 'Full accessibility peer for the map — aria-current tracks selection',
  },
  {
    journey: 'explore',
    component: 'Explore noscript filters',
    webPath: 'apps/web/src/app/explore/page.tsx',
    contract: 'Native GET FilterBar when JavaScript is unavailable',
  },
  {
    journey: 'locate',
    component: 'ManualPlaceSearchForm + search fallback link',
    webPath: 'apps/web/src/components/location/ManualPlaceSearchForm.tsx',
    contract: 'Manual address entry and /search deep link without geolocation',
  },
] as const);
