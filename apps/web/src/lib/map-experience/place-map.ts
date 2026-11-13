/**
 * The place map on the web plate: `@repo/domain/map/place-groups` applied to the Explore
 * features, as GeoJSON the style can draw. Spec: `docs/ui/patterns-place-map.md`.
 *
 * One point collection carries both kinds of mark, so the existing group and record layers draw
 * them without MapLibre's pixel clustering:
 * - place tokens, with `point_count` (the group layers' filter) and a `[minZoom, maxZoom)` band;
 * - record features, site records at their spread point from the site level, city-scale
 *   records in the source but never in a zoom band (so a selection can still draw its ring).
 * County- and state-precision records are counted in tokens only, as before.
 *
 * County grouping needs the county geometry; until it has loaded, records count in their
 * state at the county level (the domain module's fallback), and the stage refreshes the source
 * once the geometry arrives.
 */
import {
  buildPlaceGroups,
  pathIncludes,
  PLACE_LEVEL_MIN_ZOOM,
  PLACE_NEVER_ZOOM,
  placeSummary,
  precisionBandFor,
  type PlaceGroups,
  type PlaceInfo,
  type PlaceToken,
} from '@repo/domain/map/place-groups';
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import { countyLookupFor, type CountyGeometryCollection } from './county-hatch';
import { stateLabelPoints } from './state-labels';

export { PLACE_LEVEL_MIN_ZOOM };
export type { PlaceInfo };

/**
 * The first zoom a site record can draw on its own (a site alone in its grid square); below it
 * every record is inside a place token. Sites sharing a square draw from `PLACE_LEVEL_MIN_ZOOM.site`.
 */
export const SITE_MIN_ZOOM = PLACE_LEVEL_MIN_ZOOM.square;

const NEXT_LEVEL_MIN_ZOOM: Readonly<Record<PlaceToken['level'], number>> = {
  state: PLACE_LEVEL_MIN_ZOOM.county,
  county: PLACE_LEVEL_MIN_ZOOM.city,
  city: PLACE_LEVEL_MIN_ZOOM.square,
  square: PLACE_LEVEL_MIN_ZOOM.site,
};

/** The zoom that opens a place one level deeper (`placeDrillZoom`'s floor). */
export function placeNextLevelZoom(level: PlaceToken['level']): number {
  return NEXT_LEVEL_MIN_ZOOM[level];
}

/**
 * The zoom a token tap lands on: the place's own frame, but never short of the next level, so
 * one tap always opens the place one level deeper.
 */
export function placeDrillZoom(
  level: PlaceToken['level'],
  framedZoom: number | undefined,
  maxZoom: number,
): number {
  const fit = framedZoom !== undefined && Number.isFinite(framedZoom) ? framedZoom : 0;
  return Math.min(maxZoom, Math.max(fit, NEXT_LEVEL_MIN_ZOOM[level]));
}

let stateAnchors: ReadonlyMap<string, readonly [number, number]> | undefined;
function stateAnchor(postal: string): readonly [number, number] | undefined {
  stateAnchors ??= new Map(stateLabelPoints().map((p) => [p.postalCode, [p.lng, p.lat] as const]));
  return stateAnchors.get(postal);
}

const NO_COUNTIES = {} as CountyGeometryCollection;
const groupsCache = new WeakMap<
  ExploreMapFeatureCollection,
  WeakMap<CountyGeometryCollection, PlaceGroups>
>();

/** Place groups for a feature set, memoized on the collection and the county geometry. */
export function placeGroupsFor(
  collection: ExploreMapFeatureCollection,
  counties: CountyGeometryCollection | undefined,
): PlaceGroups {
  const key = counties ?? NO_COUNTIES;
  const byCounties = groupsCache.get(collection) ?? new WeakMap();
  groupsCache.set(collection, byCounties);
  const cached = byCounties.get(key);
  if (cached) return cached;
  const groups = buildPlaceGroups(
    collection.features.map((feature) => ({
      id: feature.properties.entityId,
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      precision: feature.properties.precision,
      ...(feature.properties.statePostalCode
        ? { statePostalCode: feature.properties.statePostalCode }
        : {}),
      ...(feature.properties.stateName ? { stateName: feature.properties.stateName } : {}),
      ...(feature.properties.jurisdictionLabel
        ? { jurisdictionLabel: feature.properties.jurisdictionLabel }
        : {}),
    })),
    {
      stateAnchor,
      ...(counties ? { countyAt: countyLookupFor(counties) } : {}),
    },
  );
  byCounties.set(key, groups);
  return groups;
}

function abbreviate(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(count);
}

/**
 * The name the plate prints beside a token, atlas style: the state's postal code at national scale
 * and its name past it (the style switches, `PLACE_STATE_NAME_MIN_ZOOM`), a county without its
 * "County" and state suffix (the frame already says which state), a city without its state.
 */
export function placeMapName(level: PlaceToken['level'], name: string): string {
  // A grid square has no name of its own: its count tab sits among the named streets.
  if (level === 'square') return '';
  const bare = name.replace(/,\s*[A-Z]{2}$/, '');
  return level === 'county' ? bare.replace(/\s+County$/, '') : bare;
}

/** Type size step by record count, the same three steps as `CLUSTER_RADIUS_BY_COUNT`. */
export function placeTier(count: number): 0 | 1 | 2 {
  return count >= 100 ? 2 : count >= 10 ? 1 : 0;
}

export type PlaceTokenProperties = {
  readonly placeKey: string;
  readonly level: PlaceToken['level'];
  /** Printed under the token; empty for state tokens, whose state label already names them. */
  readonly label: string;
  /** The name the plate prints beside the count (`placeMapName`). */
  readonly mapName: string;
  /** A state token's postal code, printed at national scale; empty below the state level. */
  readonly postal: string;
  readonly tier: 0 | 1 | 2;
  readonly summary: string;
  readonly point_count: number;
  readonly point_count_abbreviated: string;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
};

type PlaceMapFeature =
  | ExploreMapFeature
  | {
      readonly type: 'Feature';
      readonly id: string;
      readonly geometry: {
        readonly type: 'Point';
        readonly coordinates: readonly [number, number];
      };
      readonly properties: PlaceTokenProperties;
    };

export type PlaceMapCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly PlaceMapFeature[];
};

const collectionCache = new WeakMap<PlaceGroups, PlaceMapCollection>();

/** Tokens plus record marks, the data of the entities source on a grouped plate. */
export function placeMapCollection(
  collection: ExploreMapFeatureCollection,
  counties: CountyGeometryCollection | undefined,
): PlaceMapCollection {
  const groups = placeGroupsFor(collection, counties);
  const cached = collectionCache.get(groups);
  if (cached) return cached;
  const drawnAt = new Map(groups.sites.map((site) => [site.id, site.drawnPoint] as const));
  const squared = (id: string) => groups.pathById.get(id)?.square !== undefined;
  const features: PlaceMapFeature[] = [];
  for (const token of groups.tokens) {
    const count = token.memberIds.length;
    features.push({
      type: 'Feature',
      id: token.id,
      geometry: { type: 'Point', coordinates: token.anchor },
      properties: {
        placeKey: token.placeKey,
        level: token.level,
        label: token.level === 'state' ? '' : token.name,
        mapName: placeMapName(token.level, token.name),
        postal: token.level === 'state' ? token.placeKey.replace(/^state-/, '').toUpperCase() : '',
        tier: placeTier(count),
        summary: placeSummary(token.name, token.breakdown),
        point_count: count,
        point_count_abbreviated: abbreviate(count),
        minZoom: token.minZoom,
        maxZoom: token.maxZoom,
        west: token.bounds[0],
        south: token.bounds[1],
        east: token.bounds[2],
        north: token.bounds[3],
      },
    });
  }
  for (const feature of collection.features) {
    const band = precisionBandFor(feature.properties.precision);
    if (band === 'county' || band === 'state') continue;
    const drawn = drawnAt.get(feature.properties.entityId);
    features.push({
      ...feature,
      geometry: { type: 'Point', coordinates: drawn ?? feature.geometry.coordinates },
      properties: {
        ...feature.properties,
        minZoom:
          band !== 'site'
            ? PLACE_NEVER_ZOOM
            : squared(feature.properties.entityId)
              ? PLACE_LEVEL_MIN_ZOOM.site
              : SITE_MIN_ZOOM,
        maxZoom: PLACE_NEVER_ZOOM,
      } as ExploreMapFeature['properties'],
    });
  }
  const built = { type: 'FeatureCollection' as const, features };
  collectionCache.set(groups, built);
  return built;
}

/** Thin leaders from each spread site back to the true point it shares with its neighbors. */
export function placeLeaderCollection(
  collection: ExploreMapFeatureCollection,
  counties: CountyGeometryCollection | undefined,
) {
  const groups = placeGroupsFor(collection, counties);
  return {
    type: 'FeatureCollection' as const,
    features: groups.sites
      .filter((site) => site.drawnPoint !== site.truePoint)
      .map((site) => ({
        type: 'Feature' as const,
        properties: { entityId: site.id },
        geometry: { type: 'LineString' as const, coordinates: [site.truePoint, site.drawnPoint] },
      })),
  };
}

/** The records a place holds (inclusive: a county holds its cities' records). */
export function placeMemberIds(
  collection: ExploreMapFeatureCollection,
  placeKey: string,
  counties: CountyGeometryCollection | undefined,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const [id, path] of placeGroupsFor(collection, counties).pathById) {
    if (pathIncludes(path, placeKey)) ids.add(id);
  }
  return ids;
}

/** The place and its full precision mix, for the list header that a place selection scopes. */
export function placeDescription(
  collection: ExploreMapFeatureCollection,
  placeKey: string,
  counties: CountyGeometryCollection | undefined,
):
  | {
      readonly place: PlaceInfo;
      readonly summary: string;
      readonly bounds: readonly [number, number, number, number];
    }
  | undefined {
  const groups = placeGroupsFor(collection, counties);
  const place = groups.places.get(placeKey);
  if (!place) return undefined;
  // The level a place is first drawn at holds all of its records.
  const token = groups.tokens.find((t) => t.id === `${place.level}:${placeKey}`);
  if (!token) return undefined;
  return { place, summary: placeSummary(place.name, token.breakdown), bounds: token.bounds };
}

/**
 * The places that hold a place, widest first (state, county, city), for the column's trail back
 * up. Read from one member's path: every member of a county or city shares its state, and every
 * member of a square shares its city only when the square sits wholly in one, so the trail stops
 * at the first level the members disagree on.
 */
export function placeTrail(
  collection: ExploreMapFeatureCollection,
  placeKey: string,
  counties: CountyGeometryCollection | undefined,
): readonly PlaceInfo[] {
  const groups = placeGroupsFor(collection, counties);
  const paths = [...groups.pathById.values()].filter((path) => pathIncludes(path, placeKey));
  if (paths.length === 0) return [];
  const trail: PlaceInfo[] = [];
  for (const level of ['state', 'county', 'city'] as const) {
    const key = paths[0]![level];
    if (!key || key === placeKey || paths.some((path) => path[level] !== key)) break;
    const place = groups.places.get(key);
    if (place) trail.push(place);
  }
  return trail;
}
