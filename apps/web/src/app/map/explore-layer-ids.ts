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

/** Place tokens (`place-map.ts`): a state, county or city with its record count. The ids keep
 * their old "cluster" names because every hit test and transition table addresses them. */
export const EXPLORE_CLUSTER_LAYER_ID = 'explore-clusters';
export const EXPLORE_CLUSTER_INCOMING_LAYER_ID = 'explore-clusters-incoming';

export const EXPLORE_CLUSTER_COUNT_LAYER_ID = 'explore-cluster-count';
export const EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID = 'explore-cluster-count-incoming';
/** The place's name under a county or city token. */
export const EXPLORE_PLACE_NAME_LAYER_ID = 'explore-place-name';
/** Thin leaders from a spread site back to the true point it shares (`place-map.ts`). */
export const EXPLORE_PLACE_LEADERS_SOURCE_ID = 'explore-place-leaders';
export const EXPLORE_PLACE_LEADER_LAYER_ID = 'explore-place-leader';
/** Every drawn record: a dot at the site, a hollow ring at the neighborhood or city. */
export const EXPLORE_UNCLUSTERED_POINT_LAYER_ID = 'explore-point';
export const EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID = 'explore-point-incoming';
/** The hovered pin, lifted 2px. */
export const EXPLORE_HOVER_POINT_LAYER_ID = 'explore-point-hover';
/** Records the lens matches but the brushed decades exclude: a sand ghost, never hittable. */
export const EXPLORE_GHOSTS_SOURCE_ID = 'explore-ghosts';
export const EXPLORE_GHOST_POINT_LAYER_ID = 'explore-ghost-point';
/** The lower-48 one paper step off its neighbors, so the country reads on the chart. */
export const EXPLORE_US_LAND_LAYER_ID = 'plate-us-land';
/** Area precision shown as an area: a flat copper tint over states holding state-precision records. */
export const EXPLORE_JURISDICTION_HATCH_LAYER_ID = 'explore-jurisdiction-hatch';
/** The same tint over a county holding county-precision records (`county-hatch.ts`). */
export const EXPLORE_COUNTY_HATCH_LAYER_ID = 'explore-jurisdiction-county-hatch';
/** Atlas waterlines: offset hairlines inside every coast and lake shore, innermost first. */
export const PLATE_WATERLINE_LAYER_IDS = ['plate-waterline-1', 'plate-waterline-2'] as const;
/** Record names beside site pins: an invisible collision layer the DOM labels read (`place-labels.ts`). */
export const EXPLORE_SITE_NAME_LAYER_ID = 'explore-site-name';
/** The selected record: the same shape, 1.6x, copper with an ink ring. */
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
