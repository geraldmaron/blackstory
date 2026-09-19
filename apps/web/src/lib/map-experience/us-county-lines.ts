/**
 * County boundary asset from Census 2010 cartographic boundaries at 1:20,000,000 via the Plotly
 * GeoJSON conversion. Territories are omitted, properties retain name/FIPS and coordinates are
 * rounded for display, not survey precision. Cite Census on redistribution. Load
 * /geo/us-counties-20m.geojson lazily near COUNTY_LINES_MIN_ZOOM.
 */

export const US_COUNTIES_GEOJSON_PATH = '/geo/us-counties-20m.geojson';

/** Zoom below which county hairlines stay hidden: at the CONUS resting frame (~z3.8) the
 * median county is a few pixels wide, so the lines earn their ink from state-level zooms up. */
export const COUNTY_LINES_MIN_ZOOM = 4.5;

/** Camera zoom at which the lazy fetch kicks off — half a level before the layer's `minzoom`,
 * so the hairlines are usually decoded and tiled by the moment they become visible. */
export const COUNTY_LINES_PREFETCH_ZOOM = COUNTY_LINES_MIN_ZOOM - 0.5;

/** Zoom below which county *names* stay hidden. Higher than `COUNTY_LINES_MIN_ZOOM`: faint
 * hairlines are useful boundary context from the state-zoom frame up, but the names are text
 * clutter at national/state zoom and would collide with the state labels (which fade to 0 by
 * `STATE_LABEL_FADE_END_ZOOM` = 6.2 in `state-labels.ts`). Gating names at that same 6.2 hands
 * the label register cleanly from states to counties: states clear, then counties name in — and
 * only once the camera is close enough (single-state frame and tighter) for a county to read as a
 * useful unit rather than a sub-pixel sliver. */
export const COUNTY_LABELS_MIN_ZOOM = 6.2;

export type UsCountyPolygonProperties = {
  readonly name: string;
  readonly stateFips: string;
  readonly countyFips: string;
};
