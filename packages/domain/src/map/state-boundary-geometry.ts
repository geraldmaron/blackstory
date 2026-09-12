/**
 * Real U.S. state boundary polygons (Census Bureau 1:20,000,000 cartographic boundary file,
 * `./data/us-states-20m.json` — the same GeoJSON `apps/web` serves at `/geo/us-states-20m.geojson`
 * for MapLibre rendering, just renamed `.json` here so Node's ESM loader recognizes the JSON
 * import attribute below; Node resolves JSON-module format from the file extension and does not
 * treat `with { type: 'json' }` as a hint for unrecognized extensions). Used only to disambiguate
 * points that fall inside more than one state's approximate bounding box in `findUsStateForPoint`
 * (see `./us-geography.ts`): the coarse bbox table there is deliberately cheap and wrong at
 * borders (ADR-013 known gap; e.g. Philadelphia's bbox overlaps NJ, and the LA/MS Mississippi
 * River bend overlaps both states' bboxes). This module answers "is this point actually inside
 * state X's real boundary" for a small candidate set, not a general reverse-geocoder.
 *
 * Imported as a JSON module (not `fs.readFileSync`-ed from an `import.meta.url`-derived path) —
 * a runtime file read like that bakes in the build machine's absolute path and breaks in serverless
 * runtimes where that path doesn't exist at request time (see `../graph/mention-resolver.ts` for the
 * same reasoning applied to its own bundled JSON).
 *
 * Ray-casting itself is not reimplemented here: it reuses the same tolerant, exterior-ring
 * `pointInPolygonRings` helper the publish-time geo-integrity gate uses (`../geo-integrity/point-in-
 * polygon.ts`). Holes are not carved out (rings beyond the exterior are ignored) — a real
 * simplification gap in general, but this specific dataset has zero interior rings at 20m
 * resolution, so nothing is lost for the 51 features it actually contains.
 */
import { pointInPolygonRings } from '../geo-integrity/point-in-polygon.js';
import type { GeoRing } from '../geo-integrity/types.js';
import statesGeojson from './data/us-states-20m.json' with { type: 'json' };

/** One polygon "part" of a state — most states are one part; some (coastlines, river islands,
 * detached slivers left by the Census simplification) are a MultiPolygon with several. */
type PolygonPart = readonly GeoRing[];

type StatesFeatureCollection = {
  readonly features: readonly {
    readonly properties: { readonly postalCode: string };
    readonly geometry:
      | { readonly type: 'Polygon'; readonly coordinates: PolygonPart }
      | { readonly type: 'MultiPolygon'; readonly coordinates: readonly PolygonPart[] };
  }[];
};

function toPolygonParts(
  geometry: StatesFeatureCollection['features'][number]['geometry'],
): readonly PolygonPart[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  return geometry.coordinates;
}

function buildIndex(): ReadonlyMap<string, readonly PolygonPart[]> {
  const index = new Map<string, PolygonPart[]>();
  const { features } = statesGeojson as unknown as StatesFeatureCollection;
  for (const feature of features) {
    const postalCode = feature.properties.postalCode;
    const parts = toPolygonParts(feature.geometry);
    const existing = index.get(postalCode);
    if (existing) existing.push(...parts);
    else index.set(postalCode, [...parts]);
  }
  return index;
}

let statePolygonParts: ReadonlyMap<string, readonly PolygonPart[]> | undefined;

function getStatePolygonParts(): ReadonlyMap<string, readonly PolygonPart[]> {
  statePolygonParts ??= buildIndex();
  return statePolygonParts;
}

/**
 * True when (lat, lng) lies inside the real Census polygon for `postalCode`. Returns false — never
 * throws — for a postal code absent from the dataset (e.g. a territory outside the 50-states + D.C.
 * scope line, or a typo).
 */
export function isPointInStatePolygon(lat: number, lng: number, postalCode: string): boolean {
  const parts = getStatePolygonParts().get(postalCode);
  if (!parts) return false;
  const point = { lat, lng };
  return parts.some((rings) => pointInPolygonRings(point, rings));
}
