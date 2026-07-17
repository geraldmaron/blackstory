/**
 * MapLibre layer/source id constants for the explore canvas. Kept free of domain/map-source
 * imports so client components can reference them without pulling `node:crypto` into the bundle.
 */

export const EXPLORE_ENTITIES_SOURCE_ID = 'explore-entities';
export const EXPLORE_STATE_DENSITY_SOURCE_ID = 'explore-state-density';
export const EXPLORE_JURISDICTION_AREAS_SOURCE_ID = 'explore-jurisdiction-areas';
export const EXPLORE_HISTORY_EDGES_SOURCE_ID = 'explore-history-edges';

export const EXPLORE_CLUSTER_LAYER_ID = 'explore-clusters';
export const EXPLORE_CLUSTER_COUNT_LAYER_ID = 'explore-cluster-count';
export const EXPLORE_UNCLUSTERED_HALO_LAYER_ID = 'explore-point-halo';
export const EXPLORE_UNCLUSTERED_POINT_LAYER_ID = 'explore-point';
export const EXPLORE_STATE_DENSITY_LAYER_ID = 'explore-state-density-fill';
export const EXPLORE_JURISDICTION_AREA_LAYER_ID = 'explore-jurisdiction-area-fill';
export const EXPLORE_HISTORY_EDGES_LAYER_ID = 'explore-history-edges-line';
export const EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID = 'explore-history-edges-selected';
