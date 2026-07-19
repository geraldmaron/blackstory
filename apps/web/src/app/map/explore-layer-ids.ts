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
/** Memorial names typographic field (ocean-fringe GeoJSON; under land fills). */
export const EXPLORE_MEMORIAL_NAMES_SOURCE_ID = 'explore-memorial-names';

/**
 * Live plate memorial name field — off for now. Dataset, builders, and the
 * symbol layer stay in-repo; flip to `true` to restore ocean-fringe labels.
 */
export const MEMORIAL_NAMES_MAP_LAYER_ENABLED = false;

export const EXPLORE_CLUSTER_LAYER_ID = 'explore-clusters';
export const EXPLORE_CLUSTER_INCOMING_LAYER_ID = 'explore-clusters-incoming';
/** Plate memorial name labels — above background, below state/land fills and markers. */
export const EXPLORE_MEMORIAL_NAMES_LAYER_ID = 'explore-memorial-names-label';

export const EXPLORE_CLUSTER_COUNT_LAYER_ID = 'explore-cluster-count';
export const EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID = 'explore-cluster-count-incoming';
export const EXPLORE_UNCLUSTERED_HALO_LAYER_ID = 'explore-point-halo';
export const EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID = 'explore-point-halo-incoming';
export const EXPLORE_UNCLUSTERED_POINT_LAYER_ID = 'explore-point';
export const EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID = 'explore-point-incoming';
/** the `event` kind's "diamond" glyph approximation — a second thin, unfilled ring
 * offset around the point marker (see kind-encoding.ts's module doc for why this is an
 * approximation rather than literal diamond geometry). */
export const EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID = 'explore-point-event-glyph';
export const EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID = 'explore-point-event-glyph-incoming';
/** Copper orientation ring for the currently selected entity (not a heat signal). */
export const EXPLORE_SELECTED_POINT_LAYER_ID = 'explore-point-selected';
export const EXPLORE_STATE_DENSITY_LAYER_ID = 'explore-state-density-fill';
export const EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID = 'explore-state-density-fill-incoming';
/** the related workstream: county hairlines — the fainter tier of the boundary system beneath the
 * state bounds line, zoom-gated so the national frame stays clean. */
export const EXPLORE_COUNTY_LINES_LAYER_ID = 'explore-county-lines-line';
/** County name labels on the same GeoJSON source as hairlines (symbol layer, OpenFreeMap glyphs). */
export const EXPLORE_COUNTY_LABEL_LAYER_ID = 'explore-county-labels';
/** County choropleth fill for population share/change models (same GeoJSON source as hairlines). */
export const EXPLORE_COUNTY_CHOROPLETH_LAYER_ID = 'explore-county-choropleth-fill';
export const EXPLORE_JURISDICTION_AREA_LAYER_ID = 'explore-jurisdiction-area-fill';
export const EXPLORE_HISTORY_EDGES_LAYER_ID = 'explore-history-edges-line';
export const EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID = 'explore-history-edges-line-incoming';
export const EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID = 'explore-history-edges-selected';
