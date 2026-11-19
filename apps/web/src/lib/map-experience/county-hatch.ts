/**
 * Area precision drawn no larger than the data: a county-precision record hatches its county, a
 * state-precision record its state (`explore-style.ts`, the two hatch layers).
 *
 * Records carry a point and a state, not a county id, so the county is the polygon in the
 * county geometry (`/geo/us-counties-20m.geojson`, already loaded at the zooms where hatches
 * show) that contains the record's point. A record whose point falls in no county polygon (a
 * coastline the 1:20m outline cuts, bad data) hatches nothing; its state's tag still counts it.
 */
import type { CountyRef } from '@repo/domain/map/place-groups';
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
  readonly name: string;
  readonly box: readonly [number, number, number, number];
  readonly polygons: readonly (readonly Ring[])[];
  /** The middle of the county's largest piece: a canonical anchor, not a record's point. */
  readonly anchor: readonly [number, number];
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
    let anchor: readonly [number, number] = [0, 0];
    let largest = -1;
    for (const polygon of polygons) {
      let pMinX = Infinity;
      let pMinY = Infinity;
      let pMaxX = -Infinity;
      let pMaxY = -Infinity;
      for (const [x, y] of polygon[0] ?? []) {
        pMinX = Math.min(pMinX, x);
        pMinY = Math.min(pMinY, y);
        pMaxX = Math.max(pMaxX, x);
        pMaxY = Math.max(pMaxY, y);
      }
      minX = Math.min(minX, pMinX);
      minY = Math.min(minY, pMinY);
      maxX = Math.max(maxX, pMaxX);
      maxY = Math.max(maxY, pMaxY);
      const area = (pMaxX - pMinX) * (pMaxY - pMinY);
      if (area > largest) {
        largest = area;
        anchor = [(pMinX + pMaxX) / 2, (pMinY + pMaxY) / 2];
      }
    }
    if (polygons.length > 0) {
      indexed.push({
        key,
        name: countyDisplayName(feature.properties),
        box: [minX, minY, maxX, maxY],
        polygons,
        anchor,
      });
    }
  }
  indexCache.set(counties, indexed);
  return indexed;
}

/**
 * A county as a reader names it. The 1:20m asset carries the bare name, so the suffix is put
 * back: Louisiana's parishes, Alaska's boroughs and census areas (bare), D.C. (bare), and the
 * independent cities (county FIPS 500 and up), which share names with counties beside them.
 */
function countyDisplayName(properties: Record<string, unknown>): string {
  const name = typeof properties.name === 'string' ? properties.name : 'Unnamed';
  const state = properties.stateFips;
  const county = typeof properties.countyFips === 'string' ? Number(properties.countyFips) : 0;
  if (state === '02' || state === '11') return name;
  if (state === '22') return `${name} Parish`;
  if (county >= 500) return /city$/i.test(name) ? name : `${name} City`;
  return `${name} County`;
}

function countyContaining(
  index: readonly IndexedCounty[],
  lng: number,
  lat: number,
): IndexedCounty | undefined {
  return index.find(
    ({ box, polygons }) =>
      lng >= box[0] &&
      lng <= box[2] &&
      lat >= box[1] &&
      lat <= box[3] &&
      polygons.some((polygon) => insidePolygon(lng, lat, polygon)),
  );
}

/**
 * The county containing a point, for place grouping (`place-map.ts`). A point in no county
 * polygon (a coastline the 1:20m outline cuts) resolves to nothing; the record stays in its
 * state.
 */
export function countyLookupFor(
  counties: CountyGeometryCollection,
): (lng: number, lat: number) => CountyRef | undefined {
  const index = indexCounties(counties);
  return (lng, lat) => {
    const county = countyContaining(index, lng, lat);
    return county ? { fips: county.key, name: county.name, anchor: county.anchor } : undefined;
  };
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
    const county = countyContaining(index, lng, lat);
    if (county) keys.add(county.key);
  }
  const sorted = [...keys].sort();
  byCounties.set(counties, sorted);
  return sorted;
}
