/**
 * MapLibre layer/source id constants for the explore canvas. Kept free of domain/map-source
 * imports so client components can reference them without pulling `node:crypto` into the bundle.
 */

export const EXPLORE_ENTITIES_SOURCE_ID = 'explore-entities';
/** Dual-buffer incoming entities for decade/filter crossdissolve (opacity 0 when idle). */
export const EXPLORE_ENTITIES_INCOMING_SOURCE_ID = 'explore-entities-incoming';
export const EXPLORE_STATE_DENSITY_SOURCE_ID = 'explore-state-density';
/** Dual-buffer incoming state density for presence-color crossdissolve. */
export const EXPLORE_STATE_DENSITY_INCOMING_SOURCE_ID = 'explore-state-density-incoming';
export const EXPLORE_COUNTY_LINES_SOURCE_ID = 'explore-county-lines';
export const EXPLORE_JURISDICTION_AREAS_SOURCE_ID = 'explore-jurisdiction-areas';
export const EXPLORE_HISTORY_EDGES_SOURCE_ID = 'explore-history-edges';
/** Dual-buffer incoming relationship lines for decade crossdissolve. */
export const EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID = 'explore-history-edges-incoming';

/** The 51 state abbreviations, as a symbol layer in the same collision pass as the group counts. */
export const EXPLORE_STATE_LABELS_SOURCE_ID = 'explore-state-labels';
export const EXPLORE_STATE_LABEL_LAYER_ID = 'explore-state-label';
export const EXPLORE_STATE_LABEL_SELECTED_LAYER_ID = 'explore-state-label-selected';

export const EXPLORE_CLUSTER_LAYER_ID = 'explore-clusters';
export const EXPLORE_CLUSTER_INCOMING_LAYER_ID = 'explore-clusters-incoming';

export const EXPLORE_CLUSTER_COUNT_LAYER_ID = 'explore-cluster-count';
export const EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID = 'explore-cluster-count-incoming';
/** Every drawn record: a dot at the site, a hollow ring at the neighborhood or city. */
export const EXPLORE_UNCLUSTERED_POINT_LAYER_ID = 'explore-point';
export const EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID = 'explore-point-incoming';
/** Copper fill with a paper halo for the currently selected record. */
export const EXPLORE_SELECTED_POINT_LAYER_ID = 'explore-point-selected';
/** County- and state-precision records, counted at the state's label point ("3 statewide"). */
export const EXPLORE_JURISDICTION_TAGS_SOURCE_ID = 'explore-jurisdiction-tags';
export const EXPLORE_JURISDICTION_TAG_LAYER_ID = 'explore-jurisdiction-tag';
/** The tag that counts the selected record, in copper. */
export const EXPLORE_SELECTED_TAG_LAYER_ID = 'explore-jurisdiction-tag-selected';
export const EXPLORE_STATE_DENSITY_LAYER_ID = 'explore-state-density-fill';
export const EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID = 'explore-state-density-fill-incoming';
/**
 * County boundary hairlines sit beneath stronger state borders and appear only at the
 * configured zoom range.
 */
export const EXPLORE_COUNTY_LINES_LAYER_ID = 'explore-county-lines-line';
/** County name labels on the same GeoJSON source as hairlines (symbol layer, OpenFreeMap glyphs). */
export const EXPLORE_COUNTY_LABEL_LAYER_ID = 'explore-county-labels';
/** County choropleth fill for population share/change models (same GeoJSON source as hairlines). */
export const EXPLORE_COUNTY_CHOROPLETH_LAYER_ID = 'explore-county-choropleth-fill';
export const EXPLORE_JURISDICTION_AREA_LAYER_ID = 'explore-jurisdiction-area-fill';
export const EXPLORE_HISTORY_EDGES_LAYER_ID = 'explore-history-edges-line';
export const EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID = 'explore-history-edges-line-incoming';
export const EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID = 'explore-history-edges-selected';

/** Aerial imagery basemap (`?sat=1`) — directly above `background`, below all cartography. */
export const SATELLITE_LAYER_ID = 'plate-satellite';
