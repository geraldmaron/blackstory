/**
 * Area precision drawn no larger than the data: a county-precision record hatches its county, a
 * state-precision record its state (`explore-style.ts`, the two hatch layers).
 *
 * Records carry a point and a state, not a county id, so the county is the polygon in the
 * county geometry (`/geo/us-counties-20m.geojson`, already loaded at the zooms where hatches
 * show) that contains the record's point. A record whose point falls in no county polygon (a
 * coastline the 1:20m outline cuts, bad data) hatches nothing; its state's tag still counts it.
 */
import type { ExploreMapFeatureCollection } from './build-explore-map-source';

type Ring = readonly (readonly [number, number])[];
type CountyFeature = {
  readonly properties: Record<string, unknown>;
  readonly geometry: unknown;
};
export type CountyGeometryCollection = { readonly features: readonly CountyFeature[] };

/** The key a county hatch matches on: state FIPS then county FIPS ("01001"). */
export function countyKey(properties: Record<string, unknown>): string | undefined {
  const state = properties.stateFips;
  const county = properties.countyFips;
  return typeof state === 'string' && typeof county === 'string' ? `${state}${county}` : undefined;
}

function insideRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A polygon is its outer ring minus its holes. */
function insidePolygon(lng: number, lat: number, rings: readonly Ring[]): boolean {
  const [outer, ...holes] = rings;
  return !!outer && insideRing(lng, lat, outer) && !holes.some((h) => insideRing(lng, lat, h));
}

type IndexedCounty = {
  readonly key: string;
  readonly box: readonly [number, number, number, number];
  readonly polygons: readonly (readonly Ring[])[];
};

const indexCache = new WeakMap<CountyGeometryCollection, readonly IndexedCounty[]>();

function indexCounties(counties: CountyGeometryCollection): readonly IndexedCounty[] {
  const cached = indexCache.get(counties);
  if (cached) return cached;
  const indexed: IndexedCounty[] = [];
  for (const feature of counties.features) {
    const key = countyKey(feature.properties);
    const geometry = feature.geometry as { type?: string; coordinates?: unknown } | null;
    if (!key || !geometry) continue;
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates as Ring[]]
        : geometry.type === 'MultiPolygon'
          ? (geometry.coordinates as Ring[][])
          : [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const polygon of polygons) {
      for (const [x, y] of polygon[0] ?? []) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (polygons.length > 0) indexed.push({ key, box: [minX, minY, maxX, maxY], polygons });
  }
  indexCache.set(counties, indexed);
  return indexed;
}

const keysCache = new WeakMap<
  ExploreMapFeatureCollection,
  WeakMap<CountyGeometryCollection, readonly string[]>
>();

/** The counties holding at least one county-precision record, as `countyKey`s, sorted. */
export function hatchedCountyKeys(
  records: ExploreMapFeatureCollection,
  counties: CountyGeometryCollection | undefined,
): readonly string[] {
  if (!counties) return [];
  const byCounties = keysCache.get(records) ?? new WeakMap();
  keysCache.set(records, byCounties);
  const cached = byCounties.get(counties);
  if (cached) return cached;
  const index = indexCounties(counties);
  const keys = new Set<string>();
  for (const feature of records.features) {
    if (feature.properties.precision !== 'county') continue;
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    const county = index.find(
      ({ box, polygons }) =>
        lng >= box[0] &&
        lng <= box[2] &&
        lat >= box[1] &&
        lat <= box[3] &&
        polygons.some((polygon) => insidePolygon(lng, lat, polygon)),
    );
    if (county) keys.add(county.key);
  }
  const sorted = [...keys].sort();
  byCounties.set(counties, sorted);
  return sorted;
}
