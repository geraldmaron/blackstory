/**
 * US state (+ DC) polygon asset for the national map.
 *
 * Source: U.S. Census Bureau 2010 cartographic boundary states at 1:20,000,000
 * (public domain U.S. Government work), via Eric Celeste’s GeoJSON conversion of
 * gz_2010_us_040_00_20m. Coordinates rounded; properties enriched with USPS postal codes.
 * Cite the Census Bureau when redistributing.
 *
 * Served from `/geo/us-states-20m.geojson` (apps/web/public). MapLibre loads by URL so the
 * ~1MB geometry is not inlined into the RSC/HTML payload.
 */

export const US_STATES_GEOJSON_PATH = '/geo/us-states-20m.geojson';

export type UsStatePolygonProperties = {
  readonly fips: string;
  readonly postalCode: string;
  readonly name: string;
  readonly densityTier: string;
  readonly count: number;
};
