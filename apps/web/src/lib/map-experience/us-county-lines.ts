/**
 * US county polygon asset for the national map (black-book-uda: county hairlines as boundary
 * context beneath the entity markers).
 *
 * Source: U.S. Census Bureau 2010 cartographic boundary counties at 1:20,000,000 (public
 * domain U.S. Government work), via the plotly/datasets GeoJSON conversion of
 * `gz_2010_us_050_00_20m`; territories dropped, properties slimmed to name + FIPS pair,
 * coordinates rounded to 4 decimals (~11 m — hairline-rendering precision, not survey). Cite
 * the Census Bureau when redistributing.
 *
 * Served from `/geo/us-counties-20m.geojson` (apps/web/public), same URL-not-inlined pattern
 * as `us-state-polygons.ts`. The stage fetches it lazily, and only once the camera first
 * approaches `COUNTY_LINES_MIN_ZOOM` — the ~2.3 MB geometry never taxes the national resting
 * frame, where county hairlines would be sub-pixel noise anyway.
 */

export const US_COUNTIES_GEOJSON_PATH = '/geo/us-counties-20m.geojson';

/** Zoom below which county hairlines stay hidden: at the CONUS resting frame (~z3.8) the
 * median county is a few pixels wide, so the lines earn their ink from state-level zooms up. */
export const COUNTY_LINES_MIN_ZOOM = 4.5;

/** Camera zoom at which the lazy fetch kicks off — half a level before the layer's `minzoom`,
 * so the hairlines are usually decoded and tiled by the moment they become visible. */
export const COUNTY_LINES_PREFETCH_ZOOM = COUNTY_LINES_MIN_ZOOM - 0.5;

export type UsCountyPolygonProperties = {
  readonly name: string;
  readonly stateFips: string;
  readonly countyFips: string;
};
