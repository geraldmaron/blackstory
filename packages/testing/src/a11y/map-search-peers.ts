/**
 * Documented accessible peers for search/map journeys.
 * Kept outside test files so `@repo/testing` can re-export the contract.
 */

export const MAP_SEARCH_ACCESSIBLE_PEERS = Object.freeze([
  // The `history` journey moved when the orphaned /history
  // render layer once /history became a redirect. Its accessibility contract did not disappear
  // with it: the find-in-time journey now lands on /records, whose rows, filters and page steps
  // are server-rendered anchors, and the test below asserts exactly that.
  {
    // SynchronizedResultList went with the Door (9cc8a7ab). The map view's column list is the
    // peer now: a labelled listbox whose options carry the selection and their real position.
    journey: 'explore',
    component: 'ExploreRecordList',
    webPath: 'apps/web/src/components/map-experience/ExploreRecordList.tsx',
    contract: 'Full accessibility peer for the map — aria-selected tracks selection',
  },
  {
    // The Atlas left `/` (now the front page). Without JavaScript the map's records are the
    // archive's list view at `/archive`: the record index, server-rendered anchors throughout.
    journey: 'atlas',
    component: 'Archive list view',
    webPath: 'apps/web/src/app/archive/list-view.tsx',
    contract: 'Server-rendered rows, link filters and page steps when JavaScript is unavailable',
  },
  {
    // ManualPlaceSearchForm went with the Door (9cc8a7ab). The map's place field takes a typed
    // city, state, ZIP or address and resolves it on the server, so location stays opt-in.
    journey: 'locate',
    component: 'PlaceControl',
    webPath: 'apps/web/src/components/map-experience/PlaceControl.tsx',
    contract: 'Manual place entry without geolocation',
  },
] as const);
