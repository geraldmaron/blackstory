/**
 * Production MapLibre style builder for the `/explore` national map. It replaced the demo-stage
 * `dark-archive-style.ts`, which is gone. Only type-level `maplibre-gl` imports, so this module
 * has zero runtime WebGL dependency and is safe to unit test in plain Node.
 *
 * Every color comes from `../../lib/map-experience/dignity-style.ts` (which reuses
 * `@repo/ui`'s brand palette). This file introduces no new hues, so the dignity rule
 * (no red violence markers, no crime-heat) holds at the render layer, not only in tokens.
 */
import type {
  ExpressionSpecification,
  LineLayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import { brandPalette } from '@repo/ui';
import {
  DENSITY_TIER_FILL,
  DIGNITY_PALETTE,
  CLUSTER_RADIUS_BY_COUNT,
  OPENFREEMAP_GLYPHS_URL,
  OPENFREEMAP_SOURCE_ID,
  OPENFREEMAP_TILE_SOURCE_URL,
  POPULATION_CHANGE_TIER_FILL,
  POPULATION_SHARE_TIER_FILL,
  plateFor,
  SATELLITE_HALO_WIDTH,
  SATELLITE_RASTER_PAINT,
  SATELLITE_STATE_FILL_OPACITY,
  USGS_IMAGERY_ATTRIBUTION,
  USGS_IMAGERY_MAX_ZOOM,
  USGS_IMAGERY_SOURCE_ID,
  USGS_IMAGERY_TILE_URL,
  type MapColorScheme,
  type MapPlate,
} from '../../lib/map-experience/dignity-style';
import { MAP_LABEL_NAME_FIELD } from '../../lib/map-experience/label-expression';
import { DECADE_TRANSITION_PAINT } from '../../lib/map-experience/decade-transition';
import {
  drawnRecordCollection,
  jurisdictionTagCollection,
} from '../../lib/map-experience/record-marks';
import {
  placeLeaderCollection,
  placeMapCollection,
  PLACE_LEVEL_MIN_ZOOM,
  SITE_MIN_ZOOM,
} from '../../lib/map-experience/place-map';
import type { CountyGeometryCollection } from '../../lib/map-experience/county-hatch';
import {
  precisionsWithMark,
  recordMarkFor,
  type RecordMark,
} from '../../lib/map-experience/geo-precision';
import type {
  ExploreMapFeatureCollection,
  JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_COUNTY_LINES_SOURCE_ID,
  EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_JURISDICTION_AREAS_SOURCE_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_JURISDICTION_TAG_LAYER_ID,
  EXPLORE_JURISDICTION_TAGS_SOURCE_ID,
  EXPLORE_SELECTED_TAG_LAYER_ID,
  SATELLITE_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_STATE_LABEL_LAYER_ID,
  EXPLORE_STATE_LABEL_SELECTED_LAYER_ID,
  EXPLORE_STATE_LABELS_SOURCE_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  EXPLORE_HOVER_POINT_LAYER_ID,
  EXPLORE_GHOSTS_SOURCE_ID,
  EXPLORE_GHOST_POINT_LAYER_ID,
  EXPLORE_LIGHTS_LAYER_ID,
  EXPLORE_LIGHTS_SOURCE_ID,
  EXPLORE_US_LAND_LAYER_ID,
  EXPLORE_JURISDICTION_HATCH_LAYER_ID,
  EXPLORE_COUNTY_HATCH_LAYER_ID,
  EXPLORE_PLACE_LEADER_LAYER_ID,
  EXPLORE_PLACE_LEADERS_SOURCE_ID,
  EXPLORE_PLACE_NAME_LAYER_ID,
  EXPLORE_SITE_NAME_LAYER_ID,
  PLATE_WATERLINE_LAYER_IDS,
} from './explore-layer-ids';
import {
  COUNTY_LABELS_MIN_ZOOM,
  COUNTY_LINES_MIN_ZOOM,
} from '../../lib/map-experience/us-county-lines';
import type { ExploreLayerMode } from '../../lib/map-experience/url-state';
import {
  STATE_LABEL_APPEAR_END_ZOOM,
  STATE_LABEL_APPEAR_START_ZOOM,
  STATE_LABEL_FADE_END_ZOOM,
  STATE_LABEL_FADE_START_ZOOM,
  stateLabelPoints,
} from '../../lib/map-experience/state-labels';
import {
  DEFAULT_POPULATION_GEO,
  type ExplorePopulationGeo,
} from '../../lib/map-experience/explore-population';

export {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_COUNTY_LINES_SOURCE_ID,
  EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_JURISDICTION_AREAS_SOURCE_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_JURISDICTION_TAG_LAYER_ID,
  EXPLORE_JURISDICTION_TAGS_SOURCE_ID,
  EXPLORE_SELECTED_TAG_LAYER_ID,
  SATELLITE_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_STATE_LABEL_LAYER_ID,
  EXPLORE_STATE_LABEL_SELECTED_LAYER_ID,
  EXPLORE_STATE_LABELS_SOURCE_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  EXPLORE_HOVER_POINT_LAYER_ID,
  EXPLORE_GHOSTS_SOURCE_ID,
  EXPLORE_GHOST_POINT_LAYER_ID,
  EXPLORE_US_LAND_LAYER_ID,
  EXPLORE_JURISDICTION_HATCH_LAYER_ID,
  EXPLORE_PLACE_LEADER_LAYER_ID,
  EXPLORE_PLACE_LEADERS_SOURCE_ID,
  EXPLORE_PLACE_NAME_LAYER_ID,
  EXPLORE_SITE_NAME_LAYER_ID,
  PLATE_WATERLINE_LAYER_IDS,
} from './explore-layer-ids';
/**
 * OpenMapTiles `transportation.class` width ladder — motorway heaviest down through residential
 * (`minor`) to service/path/track fallback. Used inside zoom-interpolated street casing/fill so
 * the grid orients without a uniform bold diagram stroke.
 */
type RoadClassWidths = {
  readonly motorway: number;
  readonly trunk: number;
  readonly primary: number;
  readonly secondary: number;
  readonly tertiary: number;
  readonly minor: number;
  readonly fallback: number;
};

function roadClassWidthMatch(widths: RoadClassWidths): ExpressionSpecification {
  return [
    'match',
    ['get', 'class'],
    'motorway',
    widths.motorway,
    'trunk',
    widths.trunk,
    'primary',
    widths.primary,
    'secondary',
    widths.secondary,
    'tertiary',
    widths.tertiary,
    'minor',
    widths.minor,
    widths.fallback,
  ] as unknown as ExpressionSpecification;
}

/** Street lines: a quiet class hierarchy; z12≈1.0 / z14≈2.0 at trunk. */
function streetFillWidthExpression(): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    roadClassWidthMatch({
      motorway: 0.28,
      trunk: 0.23,
      primary: 0.2,
      secondary: 0.15,
      tertiary: 0.11,
      minor: 0.08,
      fallback: 0.05,
    }),
    12,
    roadClassWidthMatch({
      motorway: 1.2,
      trunk: 1.0,
      primary: 0.85,
      secondary: 0.63,
      tertiary: 0.45,
      minor: 0.35,
      fallback: 0.23,
    }),
    14,
    roadClassWidthMatch({
      motorway: 2.4,
      trunk: 2.0,
      primary: 1.7,
      secondary: 1.25,
      tertiary: 0.9,
      minor: 0.7,
      fallback: 0.45,
    }),
  ] as unknown as ExpressionSpecification;
}

/** Record mark opacity. Marks are opaque: precision is carried by shape, never by fading. */
export const ENTITY_POINT_FILL_OPACITY = 1;
/** Group circle opacity. Zero: the circle is the token's hit target; the DOM chip is what reads. */
export const ENTITY_CLUSTER_OPACITY = 0;

/**
 * Opaque plate fills — memorial names live as a MapLibre symbol layer in the
 * style stack (above background, below land fills), so the ocean plate stays
 * fully opaque and state fills occlude names on land. No DOM under-canvas bleed.
 */
export const PLATE_BACKGROUND_OPACITY = 1;
/**
 * The opt-in density tint sits over real cartography, not in place of it, so it is translucent:
 * at 1 it hid every lake, river and park inside a state outline.
 */
export const PLATE_STATE_FILL_OPACITY = 0.82;
/** County choropleth fill over the flat plate. Slightly heavier than the state tint: county
 * polygons are small, and a share ramp has to stay separable at that size. */
export const COUNTY_FILL_OPACITY = 0.85;

/**
 * Filter for the single-feature selection layer (`EXPLORE_SELECTED_POINT_LAYER_ID`) and the
 * selected jurisdiction tag. This is the ONLY place selection state touches a MapLibre
 * expression: a `setFilter` on dedicated layers, never a re-filter of the main entities source,
 * so selecting never repaints a neighboring mark.
 */
export function selectedPointFilterExpression(
  entityId: string | undefined,
): ExpressionSpecification {
  const value = entityId && entityId.length > 0 ? entityId : '';
  return ['==', ['get', 'entityId'], value] as unknown as ExpressionSpecification;
}

/** The tag counting a selected county- or state-precision record turns copper. */
export function selectedTagFilterExpression(entityId: string | undefined): ExpressionSpecification {
  const value = entityId && entityId.length > 0 ? `|${entityId}|` : '||';
  return ['in', value, ['get', 'ids']] as unknown as ExpressionSpecification;
}

/** Every other tag: the selected one is drawn once, by the selected layer. */
export function unselectedTagFilterExpression(
  entityId: string | undefined,
): ExpressionSpecification {
  return ['!', selectedTagFilterExpression(entityId)] as unknown as ExpressionSpecification;
}

/** The 51 label points, built once: the data never changes, only which one is selected. */
const STATE_LABEL_FEATURES = {
  type: 'FeatureCollection',
  features: stateLabelPoints().map((point) => ({
    type: 'Feature',
    id: point.postalCode,
    geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
    properties: { postalCode: point.postalCode },
  })),
} as const;

/** State abbreviations fade in above the continental floor and out as cities take over. */
const STATE_LABEL_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  STATE_LABEL_APPEAR_START_ZOOM,
  0,
  STATE_LABEL_APPEAR_END_ZOOM,
  1,
  STATE_LABEL_FADE_START_ZOOM,
  1,
  STATE_LABEL_FADE_END_ZOOM,
  0,
] as unknown as ExpressionSpecification;

/** Filters for the two state-label layers. Selection only swaps these (`setSelectedStateFilter`). */
export function stateLabelFilters(postalCode: string | undefined): {
  readonly rest: ExpressionSpecification;
  readonly selected: ExpressionSpecification;
} {
  const code = postalCode ?? '';
  return {
    rest: ['!=', ['get', 'postalCode'], code] as unknown as ExpressionSpecification,
    selected: ['==', ['get', 'postalCode'], code] as unknown as ExpressionSpecification,
  };
}

/**
 * A solid copper disc with a keyline at the site, an open copper ring at the neighborhood or city
 * (`recordMarkFor`): "the town, not the spot" is visible in the shape.
 */
/**
 * The map's type and marks in px: the same numbers as `--ds-map-count-1..3`, `--ds-map-name-1..3`,
 * `--ds-map-pin`, `--ds-map-ring` and `--ds-map-keyline` in `packages/ui/src/styles/tokens.css`.
 * The DOM labels (`place-labels.ts`, `shell.css`) read the tokens; the invisible symbol layers read
 * these, so MapLibre's collision boxes match what the DOM prints. Change both together.
 */
export const MAP_TYPE = {
  /** A place's numeral by count step (`placeTier`). */
  count: [12, 14, 16],
  /** A place's name by count step. */
  name: [10, 11, 12],
  /** A site record's name beside its pin (`--ds-map-site`). */
  site: 13,
  /** Site pin diameter, area ring diameter, and the pin's keyline. */
  pin: 12,
  ring: 14,
  keyline: 2,
} as const;
/** A Geist Mono capital is about 0.6em wide; the name's tracking is `--ds-tracking-meta`. */
export const NAME_TRACKING_EM = 0.04;
/** A Schibsted 800 tabular digit is about 0.62em wide. */
export const COUNT_DIGIT_EM = 0.62;
const PIN_RADIUS_PX = MAP_TYPE.pin / 2;
/** The area ring is a touch wider than the pin: it marks an area, never a spot. */
const RING_RADIUS_PX = MAP_TYPE.ring / 2;
const PIN_RING_PX = MAP_TYPE.keyline;
const RING_STROKE_PX = 2.5;
/** Selection scales the same shape 1.6x; it never turns a ring into a pin. */
export const SELECTED_SCALE = 1.6;
const SELECTED_PIN_RING_PX = 2;
const SELECTED_RING_STROKE_PX = 4;
/** Pins outside the brushed decades fade to a sand ghost at this opacity. */
export const GHOST_OPACITY = 0.2;

function markIs(mark: RecordMark): ExpressionSpecification {
  return [
    'match',
    ['get', 'precision'],
    precisionsWithMark(mark),
    true,
    false,
  ] as unknown as ExpressionSpecification;
}

function byMark(dot: unknown, ring: unknown): ExpressionSpecification {
  return ['case', markIs('dot'), dot, ring] as unknown as ExpressionSpecification;
}

/** The resting mark radius by shape, for the selection ease (`setSelectedEntityFilter`). */
export function markRadiusExpression(scale = 1): ExpressionSpecification {
  return byMark(PIN_RADIUS_PX * scale, RING_RADIUS_PX * scale);
}

/** The area tint stops at county scale. */
const HATCH_MAX_ZOOM = 9;
/** A held area is a flat copper wash, light enough that the waterlines and type stay on top. */
const AREA_TINT_OPACITY = 0.16;

/**
 * Atlas waterlines: two hairlines inside every sea coast, offset in pixels, the outer one lighter. Offsets stay
 * under the vector tiles' 8px render buffer so a line never surfaces along a tile seam.
 */
const WATERLINES = [
  { offset: 2, opacity: 1 },
  { offset: 5, opacity: 0.7 },
] as const;

/** Below this zoom the whole continent is in frame and the arctic coast would read as static. */
const WATERLINE_MIN_ZOOM = 3.4;

/** Waterlines belong to the generalized coast of the national frame. Past this zoom
 * the coast is marsh and inlet detail, where offset lines clump into bright static. */
const WATERLINE_MAX_ZOOM = 5.5;

/** Past this zoom a state token prints its name; below it, its postal code (national frame). */
export const PLACE_STATE_NAME_MIN_ZOOM = 4.6;

/**
 * The text a place token prints: every place name is meta on the plate, so capitals everywhere
 * (states a postal code below `PLACE_STATE_NAME_MIN_ZOOM`). The DOM label (`place-labels.ts`)
 * prints the same string in the house face; this one only sizes the collision box.
 */
const PLACE_NAME_TEXT = [
  'step',
  ['zoom'],
  ['upcase', ['case', ['==', ['get', 'level'], 'state'], ['get', 'postal'], ['get', 'mapName']]],
  PLACE_STATE_NAME_MIN_ZOOM,
  ['upcase', ['get', 'mapName']],
] as unknown as ExpressionSpecification;

/** A value by count step (`placeTier`): 0, 1, 2. */
function byTier(steps: readonly [unknown, unknown, unknown]): ExpressionSpecification {
  return [
    'match',
    ['get', 'tier'],
    2,
    steps[2],
    1,
    steps[1],
    steps[0],
  ] as unknown as ExpressionSpecification;
}

/** Numeral size by count step. */
const PLACE_COUNT_SIZE = byTier(MAP_TYPE.count);
/** Name size by count step: bigger places, bigger letters. */
const PLACE_NAME_SIZE = byTier(MAP_TYPE.name);

/**
 * The name starts past the numeral: half the numeral's width plus a gap, in ems of the name's own
 * size. The numeral is about 1.3 times the name at every step (MAP_TYPE), so one table by digit
 * count serves all three. It must be a single flat `match`: MapLibre silently drops every symbol
 * whose data-driven text-offset nests one `match` inside another, so no name was placed at all.
 * The DOM label (`.ds-place-token__name` in shell.css) mirrors this within a pixel.
 */
const COUNT_TO_NAME = 1.3;
const nameOffset = (digits: number) => [
  Number(((digits * COUNT_DIGIT_EM * COUNT_TO_NAME) / 2 + 0.6).toFixed(2)),
  0,
];
const PLACE_NAME_OFFSET = [
  'match',
  ['length', ['get', 'point_count_abbreviated']],
  1,
  ['literal', nameOffset(1)],
  2,
  ['literal', nameOffset(2)],
  3,
  ['literal', nameOffset(3)],
  ['literal', nameOffset(4)],
] as unknown as ExpressionSpecification;

/** Jurisdiction tags draw from regional zoom up, never at national scale. */
export const JURISDICTION_TAG_MIN_ZOOM = 5.5;

/**
 * Collision padding around a token's count, in pixels: the numeral has no box, so a small margin
 * keeps another token off its digits. It must stay under the count-to-name gap less the name's
 * own padding, or every name collides with its own numeral and none prints.
 */
const GROUP_COLLISION_PADDING_PX = 2;

/**
 * Draws a feature only inside its `[minZoom, maxZoom)` band: place tokens per level, site records
 * from the site level. Features without a band (the ungrouped embed) always draw. MapLibre
 * evaluates zoom in a filter at integer zooms, which is why the level thresholds are integers.
 */
const IN_ZOOM_BAND = [
  'all',
  ['>=', ['zoom'], ['coalesce', ['get', 'minZoom'], 0]],
  ['<', ['zoom'], ['coalesce', ['get', 'maxZoom'], 99]],
] as unknown as ExpressionSpecification;

/** Group sizes: three steps, never implying precision (`CLUSTER_RADIUS_BY_COUNT`). */
function groupRadiusExpression(): ExpressionSpecification {
  const [small, medium, large] = CLUSTER_RADIUS_BY_COUNT;
  return [
    'step',
    ['get', 'point_count'],
    small![1],
    medium![0],
    medium![1],
    large![0],
    large![1],
  ] as unknown as ExpressionSpecification;
}

/**
 * Presence density fill — resting `fillColor` on each feature, with optional
 * feature-state colorA/colorB/blend lerp for decade morphs (A→B per state).
 */
export function buildPresenceDensityFillColorExpression(
  plate: MapPlate,
  presenceFillActive: boolean,
): ExpressionSpecification {
  if (!presenceFillActive) {
    // The resting plate. This layer is the landmass, so with no data to show it is `land` — not a
    // faint wash over the background. An 8% tint on the old white plate is what defect §0 #11
    // described: the coastline and the state lines had nothing to separate themselves from.
    return plate.land as unknown as ExpressionSpecification;
  }

  const tierFallback = [
    'match',
    ['get', 'densityTier'],
    'concentrated',
    DENSITY_TIER_FILL.concentrated,
    'emerging',
    DENSITY_TIER_FILL.emerging,
    'documented',
    DENSITY_TIER_FILL.documented,
    plate.densityUnknown,
  ] as unknown as ExpressionSpecification;

  const restingColor = [
    'coalesce',
    ['get', 'fillColor'],
    tierFallback,
  ] as unknown as ExpressionSpecification;
  const colorA = [
    'coalesce',
    ['feature-state', 'colorA'],
    restingColor,
  ] as unknown as ExpressionSpecification;
  const colorB = [
    'coalesce',
    ['feature-state', 'colorB'],
    restingColor,
  ] as unknown as ExpressionSpecification;

  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['feature-state', 'blend'], 0],
    0,
    colorA,
    1,
    colorB,
  ] as unknown as ExpressionSpecification;
}

export type BuildExploreMapStyleInput = {
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly layerMode: ExploreLayerMode;
  /** Population choropleth geography — county (modern FIPS) or state (historical). */
  readonly popGeo?: ExplorePopulationGeo;
  readonly historyEdgesEnabled?: boolean;
  /**
   * When true (the default), records are grouped by place: state, county and city tokens by zoom,
   * site records on their own from the site level (`place-map.ts`). When false, every record
   * draws its own mark and county/state records count in jurisdiction tags (the one-record
   * RecordMap embed).
   */
  readonly clusteringEnabled?: boolean;
  /** County geometry once loaded: county tokens need it; without it records group by state. */
  readonly counties?: CountyGeometryCollection;
  /** Site theme — map plate and street ink follow light/dark. */
  readonly colorScheme?: MapColorScheme;
  /**
   * Aerial imagery under the archive instead of the flat cartographic plate (`?sat=1`). Changes
   * the basemap only: which records are on the plate, and how they are encoded, are untouched.
   */
  readonly satellite?: boolean;
  /**
   * Records the lens matches outside the brushed decades. Drawn as a sand ghost so time reads on
   * the map (a brushed-out pin fades rather than vanishes); never hittable, never grouped.
   */
  readonly ghostCollection?: ExploreMapFeatureCollection;
  /**
   * The counties holding county-precision records (`hatchedCountyKeys`), once the county
   * geometry has loaded. Until then a county record hatches nothing; its state's tag counts it.
   */
  readonly hatchedCountyKeys?: readonly string[];
};

/** Paint for one county's hatch: on where the county holds county-precision records. */
function countyHatchOpacityExpression(keys: readonly string[]): ExpressionSpecification | number {
  if (keys.length === 0) return 0;
  return [
    'match',
    ['concat', ['get', 'stateFips'], ['get', 'countyFips']],
    [...keys],
    AREA_TINT_OPACITY,
    0,
  ] as unknown as ExpressionSpecification;
}

/** Paint for one state's hatch: on where the state holds state-precision records. */
function hatchOpacityExpression(postalCodes: readonly string[]): ExpressionSpecification | number {
  if (postalCodes.length === 0) return 0;
  return [
    'match',
    ['get', 'postalCode'],
    [...postalCodes],
    AREA_TINT_OPACITY,
    0,
  ] as unknown as ExpressionSpecification;
}

/** The pin layers for one entities buffer: a site disc and an area ring, shape by precision. */
function pinPaint(plate: MapPlate, opacity: number) {
  return {
    'circle-radius': byMark(PIN_RADIUS_PX, RING_RADIUS_PX),
    'circle-color': byMark(plate.markInk, 'rgba(0,0,0,0)'),
    'circle-opacity': opacity,
    'circle-stroke-width': byMark(PIN_RING_PX, RING_STROKE_PX),
    'circle-stroke-color': byMark(plate.markRing, plate.markInk),
    'circle-stroke-opacity': opacity,
  };
}

/**
 * Builds the full `/explore` MapLibre style: records grouped by place (state, county, city
 * tokens by zoom, site records on their own from the site level; `docs/ui/patterns-place-map.md`),
 * an optional state-level presence/density fill ("presence, not just incidents"), and a
 * jurisdiction-area polygon layer (area records render as geometry, never as a point;
 * empty today, see `build-explore-map-source.ts`). A token tap selects its place (MapStage).
 */
/** Below this zoom the plate is at Orbit: lights, no place tokens (MapStage sets `data-orbit`). */
export const ORBIT_MAX_ZOOM = 2.7;
/** The one emission color of the world: the brand copper pushed toward an ember. */
/** Line, text and non-water fill layers stand down below this zoom (see the end of the builder). */
// 1.9, not 2: the national frame on a 320px phone fits the country at about zoom 1.95, and it
// must keep its state lines, names and tints.
export const ORBIT_LINE_MIN_ZOOM = 1.9;
export const ORBIT_LIGHT_COLOR = '#f2a35c';
/** Where the lights give way to record pins when they are kept lit on the way down. */
export const LIGHTS_DEEP_MAX_ZOOM = 11;

/**
 * How bright the lights are by zoom. At rest they are gone by the national frame, where the place
 * tokens take over. `deep` is for a surface that has stood the tokens down and is flying to one
 * record (the Door's tour; MapStage, `setPlaceTokens`): the lights stay lit the whole way down
 * and fade as the record pins arrive, so the descent is into the lights, not across an empty map.
 */
export function lightsOpacity(deep: boolean): ExpressionSpecification {
  return deep
    ? ['interpolate', ['linear'], ['zoom'], LIGHTS_DEEP_MAX_ZOOM - 2, 0.85, LIGHTS_DEEP_MAX_ZOOM, 0]
    : ['interpolate', ['linear'], ['zoom'], ORBIT_MAX_ZOOM, 0.85, ORBIT_MAX_ZOOM + 0.6, 0];
}

/**
 * The lights are every drawn record, about four thousand points, and the style is rebuilt on
 * every patch. Building them once per feature collection keeps that off the main thread's
 * repeat work, and hands `applyGeographyStyle` the same object so it can skip a redundant
 * `setData` (which re-serializes the lot to the worker).
 */
const LIGHTS_BY_COLLECTION = new WeakMap<object, ReturnType<typeof drawnRecordCollection>>();
function lightsFor(collection: BuildExploreMapStyleInput['featureCollection']) {
  let lights = LIGHTS_BY_COLLECTION.get(collection);
  if (!lights) {
    lights = drawnRecordCollection(collection);
    LIGHTS_BY_COLLECTION.set(collection, lights);
  }
  return lights;
}

export function buildExploreMapStyle(input: BuildExploreMapStyleInput): StyleSpecification {
  const colorScheme = input.colorScheme ?? 'dark';
  const satellite = input.satellite === true;
  const plate = plateFor(colorScheme, satellite);
  /** Halo width for every symbol layer — widened over imagery (see `SATELLITE_HALO_WIDTH`). */
  const haloWidth = (flat: number) => (satellite ? SATELLITE_HALO_WIDTH : flat);
  const clusteringEnabled = input.clusteringEnabled !== false;
  /* Density and choropleth tints back off over imagery so the ground still reads through them —
     see `SATELLITE_STATE_FILL_OPACITY`. The tier ramps themselves are unchanged: this scales how
     hard the whole overlay presses on the basemap, not the relative order of its steps. */
  const overlayFillOpacity = satellite ? SATELLITE_STATE_FILL_OPACITY : PLATE_STATE_FILL_OPACITY;
  const countyOverlayFillOpacity = satellite ? SATELLITE_STATE_FILL_OPACITY : COUNTY_FILL_OPACITY;
  const popGeo = input.popGeo ?? DEFAULT_POPULATION_GEO;
  /* Grouped by place, county and state records are counted in their place's token. Ungrouped,
     they draw no point (`recordMarkFor`) and are counted in a jurisdiction tag instead. */
  const empty = { type: 'FeatureCollection' as const, features: [] };
  const drawn = clusteringEnabled
    ? placeMapCollection(input.featureCollection, input.counties)
    : drawnRecordCollection(input.featureCollection);
  const leaders = clusteringEnabled
    ? placeLeaderCollection(input.featureCollection, input.counties)
    : empty;
  const tags = clusteringEnabled ? empty : jurisdictionTagCollection(input.featureCollection);
  const ghosts = input.ghostCollection
    ? drawnRecordCollection(input.ghostCollection)
    : { type: 'FeatureCollection' as const, features: [] };
  // Only a statewide record hatches its state; a county record hatches its own county below.
  const hatchedStates = [
    ...new Set(
      input.featureCollection.features
        .filter(
          (feature) =>
            recordMarkFor(feature.properties.precision) === 'none' &&
            feature.properties.precision !== 'county' &&
            feature.properties.statePostalCode,
        )
        .map((feature) => feature.properties.statePostalCode!),
    ),
  ];
  const presenceFillActive = input.layerMode === 'presence';
  const populationFillActive =
    input.layerMode === 'blackShare' || input.layerMode === 'blackChange';
  const statePopulationFillActive = populationFillActive && popGeo === 'state';
  const countyPopulationFillActive = populationFillActive && popGeo === 'county';
  const shareFillExpression: ExpressionSpecification = [
    'match',
    ['get', 'shareTier'],
    'majority',
    POPULATION_SHARE_TIER_FILL.majority,
    'high',
    POPULATION_SHARE_TIER_FILL.high,
    'mid',
    POPULATION_SHARE_TIER_FILL.mid,
    'low',
    POPULATION_SHARE_TIER_FILL.low,
    'trace',
    POPULATION_SHARE_TIER_FILL.trace,
    plate.densityUnknown,
  ] as unknown as ExpressionSpecification;
  const changeFillExpression: ExpressionSpecification = [
    'match',
    ['get', 'changeTier'],
    'gainStrong',
    POPULATION_CHANGE_TIER_FILL.gainStrong,
    'gainModerate',
    POPULATION_CHANGE_TIER_FILL.gainModerate,
    'neutral',
    POPULATION_CHANGE_TIER_FILL.neutral,
    'lossModerate',
    POPULATION_CHANGE_TIER_FILL.lossModerate,
    'lossStrong',
    POPULATION_CHANGE_TIER_FILL.lossStrong,
    plate.densityUnknown,
  ] as unknown as ExpressionSpecification;
  const style: StyleSpecification = {
    version: 8,
    name: 'BlackStory — Explore',
    glyphs: OPENFREEMAP_GLYPHS_URL,
    sources: {
      [USGS_IMAGERY_SOURCE_ID]: {
        type: 'raster',
        tiles: [USGS_IMAGERY_TILE_URL],
        tileSize: 256,
        maxzoom: USGS_IMAGERY_MAX_ZOOM,
        attribution: USGS_IMAGERY_ATTRIBUTION,
      },
      [OPENFREEMAP_SOURCE_ID]: {
        type: 'vector',
        url: OPENFREEMAP_TILE_SOURCE_URL,
        attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      },
      [EXPLORE_STATE_DENSITY_SOURCE_ID]: {
        type: 'geojson',
        promoteId: 'id',
        // Empty until ExploreMapCanvas fetches `/geo/us-states-20m.geojson` and joins density.
        // Do not point `data` at the URL — MapLibre’s async URL load would overwrite setData.
        data: { type: 'FeatureCollection', features: [] },
      },
      [EXPLORE_STATE_DENSITY_INCOMING_SOURCE_ID]: {
        type: 'geojson',
        // Dual-buffer partner for decade/filter presence crossdissolve — idle empty at opacity 0.
        data: { type: 'FeatureCollection', features: [] },
      },
      [EXPLORE_COUNTY_LINES_SOURCE_ID]: {
        type: 'geojson',
        // Empty placeholder, same contract as the state source above: the stage lazily fetches
        // `/geo/us-counties-20m.geojson` (~2.3 MB) only when the camera first approaches
        // `COUNTY_LINES_MIN_ZOOM` and setDatas it in — never a URL `data` value.
        data: { type: 'FeatureCollection', features: [] },
      },
      [EXPLORE_JURISDICTION_AREAS_SOURCE_ID]: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: input.jurisdictionAreaFeatures,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        } as any,
      },
      [EXPLORE_ENTITIES_SOURCE_ID]: {
        type: 'geojson',
        // Address features by their record id so the decade morph can hold records that appear in
        // both decades. A place token has no record id and is never held.
        promoteId: 'entityId',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        data: drawn as any,
      },
      [EXPLORE_LIGHTS_SOURCE_ID]: {
        type: 'geojson',
        // The same precision-honest marks the plate draws ungrouped: a county or state record
        // has no point here either.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        data: lightsFor(input.featureCollection) as any,
      },
      [EXPLORE_PLACE_LEADERS_SOURCE_ID]: {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        data: leaders as any,
      },
      [EXPLORE_JURISDICTION_TAGS_SOURCE_ID]: {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        data: tags as any,
      },
      [EXPLORE_GHOSTS_SOURCE_ID]: {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        data: ghosts as any,
      },
      [EXPLORE_STATE_LABELS_SOURCE_ID]: {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        data: STATE_LABEL_FEATURES as any,
      },
      [EXPLORE_ENTITIES_INCOMING_SOURCE_ID]: {
        type: 'geojson',
        // Same promotion as the primary buffer: the hold marks are written to both.
        promoteId: 'entityId',
        // Dual-buffer pin stack — empty until a decade/filter crossdissolve stages the next frame.
        data: { type: 'FeatureCollection', features: [] },
      },
      [EXPLORE_HISTORY_EDGES_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
      [EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': plate.ocean,
          'background-opacity': PLATE_BACKGROUND_OPACITY,
        },
      },
      {
        /* Aerial imagery, directly on top of the plate color and under everything else.
           Deliberately translucent: the `background` layer beneath is what scrims it, which is
           the first half of the contrast strategy documented on `SATELLITE_RASTER_PAINT`.

           The source is declared unconditionally but the layer is hidden when satellite is off,
           so a reader who never turns it on never requests a tile — MapLibre does not fetch for
           an invisible layer. */
        id: SATELLITE_LAYER_ID,
        type: 'raster',
        source: USGS_IMAGERY_SOURCE_ID,
        layout: { visibility: satellite ? 'visible' : 'none' },
        // Held at 0 while hidden, so switching imagery on eases it in over the plate instead of
        // cutting to it. The transition is listed first: paint is pushed in this order.
        paint: {
          'raster-opacity-transition': { duration: 700, delay: 0 },
          ...SATELLITE_RASTER_PAINT[colorScheme],
          ...(satellite ? {} : { 'raster-opacity': 0 }),
        },
      },
      /* —— Base cartography ————————————————————————————————————————————————————————
         The plate is a map before it is a chart. These layers come from the
         OpenFreeMap vector source and read at the continental resting frame, which is where a
         reader spends most of their time; the archive overlays below them are the data.

         Until they existed, `MapPalette`'s `line2`, `label`, `labelHi` and `halo`
         roles were declared, contrast-tested and consumed by nothing, and the plate rendered
         as state polygons floating on a flat field: no coastline, no Great Lakes, no Canada or
         Mexico, and no place names between the state abbreviations and street labels at z11.
         `docs/ui/patterns-map-canvas.md`; reference build `.design-mocks/blackstory-atlas-v9.html`. */
      {
        // The lower-48, one paper step off the neighbors so the country reads on the chart. Under
        // the water layer, so lakes and coastline still cut it.
        id: EXPLORE_US_LAND_LAYER_ID,
        type: 'fill',
        source: EXPLORE_STATE_DENSITY_SOURCE_ID,
        filter: ['!', ['in', ['get', 'postalCode'], ['literal', ['AK', 'HI', 'PR']]]],
        layout: { visibility: satellite ? 'none' : 'visible' },
        paint: { 'fill-color': plate.land },
      },
      {
        /* Area precision shown as an area, never larger than the data: a state holding
           state-precision records carries a sand hatch, a county holding county-precision records
           carries its own (the next layer), and the state's tag gives the count. Under the water
           layer, so rivers and coast cut it; gone past regional zoom, where an area hatch says
           nothing about the streets in view. */
        id: EXPLORE_JURISDICTION_HATCH_LAYER_ID,
        type: 'fill',
        source: EXPLORE_STATE_DENSITY_SOURCE_ID,
        minzoom: JURISDICTION_TAG_MIN_ZOOM,
        maxzoom: HATCH_MAX_ZOOM,
        paint: {
          'fill-color': plate.areaTint,
          'fill-opacity': hatchOpacityExpression(hatchedStates),
          'fill-opacity-transition': { duration: 0 },
        },
      },
      {
        // County precision hatches the county. The county geometry loads before this zoom
        // (`COUNTY_LINES_MIN_ZOOM` < `JURISDICTION_TAG_MIN_ZOOM`).
        id: EXPLORE_COUNTY_HATCH_LAYER_ID,
        type: 'fill',
        source: EXPLORE_COUNTY_LINES_SOURCE_ID,
        minzoom: JURISDICTION_TAG_MIN_ZOOM,
        maxzoom: HATCH_MAX_ZOOM,
        paint: {
          'fill-color': plate.areaTint,
          'fill-opacity': countyHatchOpacityExpression(input.hatchedCountyKeys ?? []),
          'fill-opacity-transition': { duration: 0 },
        },
      },
      {
        // Oceans, lakes and wide rivers. This is what gives the plate a coastline: without it
        // the only edge on the map is the outer boundary of the state polygon set.
        id: 'plate-water',
        type: 'fill',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'water',
        // Same reason as landcover, and more so: the coastline this layer exists to give the flat
        // plate is already in the imagery, at the resolution the imagery has rather than the
        // generalisation the vector tiles carry.
        layout: { visibility: satellite ? 'none' : 'visible' },
        paint: { 'fill-color': plate.water },
      },
      /* Waterlines, the engraved atlas signature: hairlines inside every shore, offset into the
         water (a polygon ring's right-hand side is its inside) and stepping lighter outward. */
      ...WATERLINES.map(({ offset, opacity }, index): LineLayerSpecification => ({
        id: PLATE_WATERLINE_LAYER_IDS[index]!,
        type: 'line',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'water',
        // Sea coasts only: the thousands of small northern lakes would read as static.
        filter: ['==', ['get', 'class'], 'ocean'],
        maxzoom: WATERLINE_MAX_ZOOM,
        layout: { visibility: satellite ? 'none' : 'visible', 'line-join': 'round' },
        paint: {
          'line-color': plate.waterline,
          'line-width': 0.6,
          'line-offset': offset,
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            WATERLINE_MIN_ZOOM,
            0,
            WATERLINE_MIN_ZOOM + 0.6,
            opacity,
          ] as unknown as ExpressionSpecification,
        },
      })),
      {
        // Country borders. Solid and heavier than the state hairline, so the continent reads
        // as a continent rather than as a ragged edge where the state data stops.
        id: 'plate-boundary-country',
        type: 'line',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'boundary',
        // Some boundary features carry no admin_level; a bare `get` compared as a number logs a
        // MapLibre type warning for each one, so a missing level reads as "not a country border".
        filter: [
          'all',
          ['<=', ['to-number', ['coalesce', ['get', 'admin_level'], 99]], 2],
          ['!=', ['get', 'maritime'], 1],
        ],
        paint: {
          'line-color': plate.countryBounds,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.9,
            8,
            1.8,
          ] as unknown as ExpressionSpecification,
        },
      },
      {
        /* Major roads only (motorway/trunk/primary) — design-direction-v9-atlas.md's `road` role,
           `minzoom: 6`. This is the continental register: national/state highway structure visible
           before the reader ever reaches the dense, class-hierarchy-styled local street network
           (`explore-street-casing`/`-fill` below, minzoom 8). `maxzoom` hands off exactly where
           that local layer picks the same classes back up at their own tuned widths, so the two
           never double-paint the same geometry. `plate.road` had no consumer until this layer;
           see the shared palette role. */
        id: 'plate-road',
        type: 'line',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'transportation',
        minzoom: 6,
        maxzoom: 8,
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': plate.road,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6,
            0.4,
            8,
            0.9,
          ] as unknown as ExpressionSpecification,
        },
      },
      {
        /* City and town names. Deliberately NOT state names: state labels are DOM markers
           (`state-labels.ts`) tied to selection and the Lens `Place labels` toggle, and a
           second symbol layer of the same names would collide with them. Cities are the
           register that was missing entirely between z4 and z11. */
        id: 'plate-place-city',
        type: 'symbol',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'place',
        minzoom: 4.2,
        filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
        layout: {
          'text-field': MAP_LABEL_NAME_FIELD,
          'text-font': ['Noto Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            9.5,
            11,
            12.5,
          ] as unknown as ExpressionSpecification,
          'text-max-width': 8,
          'text-anchor': 'top',
          'text-offset': [0, 0.35],
        },
        paint: {
          // The quiet label step: towns the archive holds nothing in orient the reader; the
          // archive's own places (`place-labels.ts`) lead in the house face.
          'text-color': plate.placeLabel,
          'text-halo-color': plate.placeLabelHalo,
          'text-halo-width': haloWidth(1.4),
        },
      },
      {
        /* One quiet line per street, no casing: roads orient, they never out-read a record mark.
           Major roads are one step stronger than the rest, nothing more. */
        id: 'explore-street-fill',
        type: 'line',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'transportation',
        minzoom: 8,
        filter: ['all', ['!=', ['get', 'class'], 'ferry'], ['!=', ['get', 'brunnel'], 'tunnel']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': plate.street,
          'line-width': streetFillWidthExpression(),
          'line-opacity': [
            'match',
            ['get', 'class'],
            ['motorway', 'trunk', 'primary'],
            1,
            0.72,
          ] as unknown as ExpressionSpecification,
        },
      },
      {
        id: 'explore-street-label',
        type: 'symbol',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'transportation_name',
        minzoom: 11,
        layout: {
          'text-field': MAP_LABEL_NAME_FIELD,
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'symbol-placement': 'line',
          'text-max-angle': 30,
        },
        paint: {
          'text-color': plate.streetLabel,
          'text-halo-color': plate.ocean,
          'text-halo-width': haloWidth(1),
        },
      },
      {
        id: EXPLORE_STATE_DENSITY_LAYER_ID,
        type: 'fill',
        source: EXPLORE_STATE_DENSITY_SOURCE_ID,
        // Always hittable for state selection density tint is optional chrome on top.
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': statePopulationFillActive
            ? input.layerMode === 'blackShare'
              ? shareFillExpression
              : changeFillExpression
            : buildPresenceDensityFillColorExpression(plate, presenceFillActive),
          /* The state polygons stopped being the landmass when the tiles started supplying it,
             so this layer paints only when it is actually encoding something. An opaque
             land-colored fill over real cartography is not neutral: it erases the lakes,
             rivers and parks inside every state outline it covers. */
          'fill-opacity': statePopulationFillActive || presenceFillActive ? overlayFillOpacity : 0,
        },
      },
      {
        // Legacy incoming buffer — pins still dual-buffer; density morphs via feature-state color lerp.
        id: EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
        type: 'fill',
        source: EXPLORE_STATE_DENSITY_INCOMING_SOURCE_ID,
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': statePopulationFillActive
            ? input.layerMode === 'blackShare'
              ? shareFillExpression
              : changeFillExpression
            : buildPresenceDensityFillColorExpression(plate, presenceFillActive),
          'fill-opacity': 0,
        },
      },
      {
        id: EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
        type: 'fill',
        source: EXPLORE_COUNTY_LINES_SOURCE_ID,
        // Population choropleths must read at the national resting frame; hairlines stay
        // gated at COUNTY_LINES_MIN_ZOOM so the CONUS view is not noisy with county borders.
        ...(countyPopulationFillActive ? {} : { minzoom: COUNTY_LINES_MIN_ZOOM }),
        layout: {
          visibility: countyPopulationFillActive ? 'visible' : 'none',
        },
        paint: {
          'fill-color':
            input.layerMode === 'blackShare'
              ? shareFillExpression
              : input.layerMode === 'blackChange'
                ? changeFillExpression
                : plate.densityDisabled,
          'fill-opacity': countyPopulationFillActive ? countyOverlayFillOpacity : 0,
        },
      },
      {
        // County boundaries use thinner, more transparent theme-aware ink beneath state borders
        // and entity markers. Their zoom range preserves a clear national frame.
        id: EXPLORE_COUNTY_LINES_LAYER_ID,
        type: 'line',
        source: EXPLORE_COUNTY_LINES_SOURCE_ID,
        minzoom: COUNTY_LINES_MIN_ZOOM,
        paint: {
          'line-color': plate.countyLine,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            COUNTY_LINES_MIN_ZOOM,
            0.4,
            9,
            1,
          ] as unknown as ExpressionSpecification,
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            COUNTY_LINES_MIN_ZOOM,
            0,
            COUNTY_LINES_MIN_ZOOM + 1,
            0.2,
            9,
            0.3,
          ] as unknown as ExpressionSpecification,
        },
      },
      {
        // County *names* gate higher than the hairlines (`COUNTY_LABELS_MIN_ZOOM`, not
        // `COUNTY_LINES_MIN_ZOOM`): the boundary lines are quiet context from the state frame up,
        // but the names are held until the state labels have faded out (see the constant's doc),
        // so the two label tiers never compete and county names only appear once counties read as
        // useful units. MapLibre symbol collision (text-allow-overlap defaults false) then thins
        // any remaining density automatically.
        id: EXPLORE_COUNTY_LABEL_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_COUNTY_LINES_SOURCE_ID,
        minzoom: COUNTY_LABELS_MIN_ZOOM,
        layout: {
          // Ungrouped is one record's own ground (a place page). The basemap prints a county's
          // name once per tile it crosses and nothing there thins them (`hideNamedCounties` runs
          // on tokens), so one view repeated a county five times around the record.
          visibility: clusteringEnabled ? 'visible' : 'none',
          'text-field': ['upcase', ['get', 'name']] as unknown as ExpressionSpecification,
          'text-font': ['Noto Sans Regular'],
          'text-size': 9,
          'text-max-width': 8,
          'text-letter-spacing': 0.24,
        },
        paint: {
          'text-color': plate.countyLabel,
          'text-halo-color': plate.countyLabelHalo,
          'text-halo-width': haloWidth(1.5),
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            COUNTY_LABELS_MIN_ZOOM,
            0,
            COUNTY_LABELS_MIN_ZOOM + 1,
            0.65,
            9,
            0.85,
          ] as unknown as ExpressionSpecification,
        },
      },
      {
        id: 'explore-state-bounds-line',
        type: 'line',
        source: EXPLORE_STATE_DENSITY_SOURCE_ID,
        paint: {
          // Hairlines: state bounds are the chart's ruling, and every mark reads above them.
          'line-color': plate.stateBounds,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.5,
            8,
            1,
          ] as unknown as ExpressionSpecification,
        },
      },
      {
        id: 'explore-state-selected-fill',
        type: 'fill',
        source: EXPLORE_STATE_DENSITY_SOURCE_ID,
        filter: ['==', ['get', 'postalCode'], ''],
        paint: {
          'fill-color': DIGNITY_PALETTE.selectedStateFill,
        },
      },
      {
        id: 'explore-state-selected-line',
        type: 'line',
        source: EXPLORE_STATE_DENSITY_SOURCE_ID,
        filter: ['==', ['get', 'postalCode'], ''],
        paint: {
          'line-color': DIGNITY_PALETTE.point,
          'line-width': 2.5,
          'line-opacity': 1,
        },
      },
      {
        /* State abbreviations: small, low contrast, under every record mark and group in the
           style, so in MapLibre's one top-down collision pass a group count claims its space
           first and a label that would touch it gives way (`text-optional` is implied for a
           text-only symbol). Never drawn across a count. */
        id: EXPLORE_STATE_LABEL_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_STATE_LABELS_SOURCE_ID,
        minzoom: STATE_LABEL_APPEAR_START_ZOOM,
        maxzoom: STATE_LABEL_FADE_END_ZOOM,
        filter: stateLabelFilters(undefined).rest,
        layout: {
          'text-field': ['get', 'postalCode'] as unknown as ExpressionSpecification,
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-letter-spacing': 0.12,
          'text-padding': 2,
        },
        paint: {
          'text-color': plate.placeLabel,
          'text-halo-color': plate.placeLabelHalo,
          'text-halo-width': haloWidth(1),
          'text-opacity': STATE_LABEL_OPACITY,
        },
      },
      {
        // The selected state's abbreviation: copper and bold, beside its copper outline.
        id: EXPLORE_STATE_LABEL_SELECTED_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_STATE_LABELS_SOURCE_ID,
        minzoom: STATE_LABEL_APPEAR_START_ZOOM,
        maxzoom: STATE_LABEL_FADE_END_ZOOM,
        filter: stateLabelFilters(undefined).selected,
        layout: {
          'text-field': ['get', 'postalCode'] as unknown as ExpressionSpecification,
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-letter-spacing': 0.12,
          'text-padding': 2,
        },
        paint: {
          'text-color': plate.selectedStateLabel,
          'text-halo-color': plate.placeLabelHalo,
          'text-halo-width': haloWidth(1),
          'text-opacity': STATE_LABEL_OPACITY,
        },
      },
      {
        id: EXPLORE_JURISDICTION_AREA_LAYER_ID,
        type: 'fill',
        source: EXPLORE_JURISDICTION_AREAS_SOURCE_ID,
        paint: { 'fill-color': brandPalette.pageSand, 'fill-opacity': 0.35 },
      },
      {
        id: EXPLORE_HISTORY_EDGES_LAYER_ID,
        type: 'line',
        source: EXPLORE_HISTORY_EDGES_SOURCE_ID,
        layout: {
          visibility: input.historyEdgesEnabled ? 'visible' : 'none',
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          // Theme-aware copper — never pageSand on the light plate (vanishes against white).
          'line-color': plate.historyEdge,
          'line-width': 2.5,
          'line-opacity': 0.9,
        },
      },
      {
        id: EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
        type: 'line',
        source: EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID,
        layout: {
          visibility: input.historyEdgesEnabled ? 'visible' : 'none',
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': plate.historyEdge,
          'line-width': 2.5,
          'line-opacity': 0,
        },
      },
      {
        id: EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
        type: 'line',
        source: EXPLORE_HISTORY_EDGES_SOURCE_ID,
        filter: ['==', ['get', 'edgeId'], ''],
        layout: {
          visibility: input.historyEdgesEnabled ? 'visible' : 'none',
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': plate.historyEdgeSelected,
          'line-width': 4,
          'line-opacity': 1,
        },
      },
      {
        // County- and state-precision records, counted at the state's label point. Never a
        // point: a pin would claim a place the archive does not hold. Not drawn at national
        // scale, where fifty of them read as clutter; one per state from regional zoom.
        //
        // Stacked BELOW the record marks on purpose: MapLibre places symbols top layer first, so
        // the group counts above claim their space before a tag is placed, and a tag that would
        // touch a group gives way instead of printing over it.
        id: EXPLORE_JURISDICTION_TAG_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_JURISDICTION_TAGS_SOURCE_ID,
        minzoom: JURISDICTION_TAG_MIN_ZOOM,
        filter: unselectedTagFilterExpression(undefined),
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Noto Sans Bold'],
          'text-offset': [0, 1.4],
          'text-max-width': 24,
          'text-letter-spacing': 0.04,
          // A tag that would collide gives way at this zoom and returns as the reader zooms in.
          'text-padding': 4,
        },
        paint: {
          'text-color': plate.tagText,
          'text-halo-color': plate.placeLabelHalo,
          'text-halo-width': haloWidth(2),
        },
      },
      {
        // Orbit: one light per drawn record. Every light is the same size and strength; count,
        // grade and kind are never encoded (design-direction-v11.md, "Darkness is not absence").
        // Gone by the national frame, where the place tokens take over.
        id: EXPLORE_LIGHTS_LAYER_ID,
        type: 'circle',
        source: EXPLORE_LIGHTS_SOURCE_ID,
        // The layer reaches as deep as the lights ever go; at rest its opacity is 0 past the
        // national frame, and a layer at 0 is not drawn.
        maxzoom: LIGHTS_DEEP_MAX_ZOOM,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 1.4, ORBIT_MAX_ZOOM, 2.6],
          'circle-color': ORBIT_LIGHT_COLOR,
          'circle-blur': 0.7,
          'circle-opacity': lightsOpacity(false),
        },
      },
      {
        // Brushed-out records: a sand ghost at the record's own drawn place, under every live mark.
        id: EXPLORE_GHOST_POINT_LAYER_ID,
        type: 'circle',
        source: EXPLORE_GHOSTS_SOURCE_ID,
        paint: {
          'circle-radius': byMark(PIN_RADIUS_PX, RING_RADIUS_PX),
          'circle-color': byMark(plate.ghost, 'rgba(0,0,0,0)'),
          'circle-opacity': GHOST_OPACITY,
          'circle-stroke-width': byMark(0, RING_STROKE_PX),
          'circle-stroke-color': plate.ghost,
          'circle-stroke-opacity': GHOST_OPACITY,
        },
      },
      {
        // A spread site's leader back to the true point it shares: the spread is a reading aid,
        // the stored coordinate is where the line ends.
        id: EXPLORE_PLACE_LEADER_LAYER_ID,
        type: 'line',
        source: EXPLORE_PLACE_LEADERS_SOURCE_ID,
        // Only sites sharing a grid square spread, and those draw from the site level.
        minzoom: PLACE_LEVEL_MIN_ZOOM.site,
        paint: { 'line-color': plate.markInk, 'line-width': 1, 'line-opacity': 0.55 },
      },
      {
        // One layer, two shapes: a copper pin head where the archive holds the site, an open
        // copper ring where it holds the neighborhood or city. Kind is never encoded here.
        id: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], IN_ZOOM_BAND],
        paint: {
          // A decade change crossfades rather than snapping (v9 §11 supersedes v6 §4.4).
          ...DECADE_TRANSITION_PAINT,
          ...pinPaint(plate, ENTITY_POINT_FILL_OPACITY),
        },
      },
      {
        // The place a token counts, named beside its count chip. Under the counts, so in MapLibre's
        // top-down placement every count claims its chip first. Yields to counts and other names
        // rather than overprinting. Invisible: it only places the name; the DOM label
        // (`place-labels.ts`) sets the placed ones in the house face.
        id: EXPLORE_PLACE_NAME_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['all', ['has', 'point_count'], ['has', 'mapName'], IN_ZOOM_BAND],
        layout: {
          'text-field': PLACE_NAME_TEXT,
          'text-size': PLACE_NAME_SIZE,
          'text-font': ['Noto Sans Bold'],
          'text-anchor': 'left',
          'text-offset': PLACE_NAME_OFFSET,
          'text-letter-spacing': NAME_TRACKING_EM,
          'text-max-width': 40,
          'text-padding': 3,
        },
        paint: { 'text-color': plate.placeLabelHi, 'text-opacity': 0 },
      },
      {
        // A site record's name beside its pin, from street scale: the record page's own pin and
        // name, on the plate. Invisible, like the place names: the DOM label sets it.
        id: EXPLORE_SITE_NAME_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        minzoom: SITE_MIN_ZOOM + 1,
        filter: ['all', ['!', ['has', 'point_count']], markIs('dot'), IN_ZOOM_BAND],
        layout: {
          'text-field': ['get', 'displayName'],
          'text-size': MAP_TYPE.site,
          'text-font': ['Noto Sans Bold'],
          'text-anchor': 'left',
          'text-offset': [0.85, 0],
          'text-max-width': 14,
          'text-padding': 2,
        },
        paint: { 'text-color': plate.placeLabelHi, 'text-opacity': 0 },
      },
      {
        id: EXPLORE_CLUSTER_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['all', ['has', 'point_count'], IN_ZOOM_BAND],
        paint: {
          // A decade change crossfades rather than snapping (v9 §11 supersedes v6 §4.4).
          ...DECADE_TRANSITION_PAINT,
          // The hit target only: the token itself is the DOM count chip and name.
          'circle-radius': groupRadiusExpression(),
          'circle-color': plate.markInk,
          'circle-opacity': ENTITY_CLUSTER_OPACITY,
          'circle-stroke-width': 0,
        },
      },
      {
        id: EXPLORE_CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['all', ['has', 'point_count'], IN_ZOOM_BAND],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': PLACE_COUNT_SIZE,
          'text-font': ['Noto Sans Bold'],
          // A count always draws, and claims its chip in the collision index, so no tag or name
          // prints across a token. Invisible: the DOM chip (`place-labels.ts`) is what reads.
          'text-allow-overlap': true,
          'text-padding': GROUP_COLLISION_PADDING_PX,
        },
        paint: { 'text-color': plate.markInk, 'text-opacity': 0 },
      },
      {
        id: EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], IN_ZOOM_BAND],
        paint: pinPaint(plate, 0),
      },
      {
        id: EXPLORE_CLUSTER_INCOMING_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['all', ['has', 'point_count'], IN_ZOOM_BAND],
        paint: {
          'circle-radius': groupRadiusExpression(),
          'circle-color': plate.markInk,
          'circle-opacity': 0,
          'circle-stroke-width': 0,
        },
      },
      {
        id: EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['all', ['has', 'point_count'], IN_ZOOM_BAND],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': PLACE_COUNT_SIZE,
          'text-font': ['Noto Sans Bold'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': plate.markInk, 'text-opacity': 0 },
      },
      {
        id: EXPLORE_SELECTED_TAG_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_JURISDICTION_TAGS_SOURCE_ID,
        filter: selectedTagFilterExpression(undefined),
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Noto Sans Bold'],
          'text-offset': [0, 1.3],
          'text-max-width': 24,
          'text-letter-spacing': 0.04,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': brandPalette.copperTextLight,
          'text-halo-color': plate.placeLabelHalo,
          'text-halo-width': haloWidth(2),
        },
      },
      {
        // Hover: the pin lifts 2px.
        id: EXPLORE_HOVER_POINT_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: selectedPointFilterExpression(undefined),
        paint: { ...pinPaint(plate, 1), 'circle-translate': [0, -2] },
      },
      {
        // Selected, in its own shape, 1.6x: a site pin grows with a heavier keyline; a ring
        // stays an open ring, heavier, so selection never sharpens a city record into a site.
        // The radius eases up from rest (`setSelectedEntityFilter`); the callout is a DOM
        // marker (`selection-flag.ts`), because map glyphs cannot set Schibsted.
        id: EXPLORE_SELECTED_POINT_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: selectedPointFilterExpression(undefined),
        paint: {
          'circle-radius': byMark(PIN_RADIUS_PX * SELECTED_SCALE, RING_RADIUS_PX * SELECTED_SCALE),
          'circle-radius-transition': { duration: 200 },
          'circle-color': byMark(plate.markInk, 'rgba(0,0,0,0)'),
          'circle-opacity': 1,
          'circle-stroke-width': byMark(SELECTED_PIN_RING_PX, SELECTED_RING_STROKE_PX),
          'circle-stroke-color': byMark(plate.markRing, plate.markInk),
          'circle-stroke-opacity': 1,
        },
      },
    ],
  };
  // Orbit shows lights and water, nothing else: lines and names stand down below
  // `ORBIT_LINE_MIN_ZOOM`, and the GeoJSON fills (state land, tints, hatches) cost about half a
  // second of main-thread work at load to drape over the sphere, for a US land shape the
  // background already paints. The water stays: it is what draws the coasts.
  // This comment used to say MapLibre's globe tears line and text layers into spikes down here.
  // It does not: with every line and symbol layer forced on at zoom 1.5 they all draw cleanly
  // (2026-11-20). The spikes were the place tokens' DOM tethers left visible after the tokens
  // were hidden (shell.css, "v11 Orbit").
  return {
    ...style,
    layers: style.layers.map((layer) =>
      (layer.type === 'symbol' ||
        layer.type === 'line' ||
        (layer.type === 'fill' && layer.id !== 'plate-water')) &&
      (layer.minzoom ?? 0) < ORBIT_LINE_MIN_ZOOM
        ? { ...layer, minzoom: ORBIT_LINE_MIN_ZOOM }
        : layer,
    ),
  };
}
