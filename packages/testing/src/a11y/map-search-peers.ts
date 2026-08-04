/**
 * Documented accessible peers for search/map journeys.
 * Kept outside test files so `@repo/testing` can re-export the contract.
 */

export const MAP_SEARCH_ACCESSIBLE_PEERS = Object.freeze([
  // The `history` journey's peer left with repo-92n2.27, which deleted the orphaned /history
  // render layer once /history became a redirect. Its accessibility contract did not disappear
  // with it: the find-in-time journey now lands on /records, whose rows, filters and page steps
  // are server-rendered anchors, and the test below asserts exactly that.
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
    // native GET FilterBar now ships from the Atlas page itself. Moved again when a216dd88
    // deleted the `(map)` route group and the Atlas landed at the app root.
    webPath: 'apps/web/src/app/page.tsx',
    contract: 'Native GET FilterBar when JavaScript is unavailable',
  },
  {
    journey: 'locate',
    component: 'ManualPlaceSearchForm + search fallback link',
    webPath: 'apps/web/src/components/location/ManualPlaceSearchForm.tsx',
    contract: 'Manual address entry and /history deep link without geolocation',
  },
] as const);
