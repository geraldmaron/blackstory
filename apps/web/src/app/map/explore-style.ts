/**
 * Production MapLibre style builder for the `/explore` national map. It replaced the demo-stage
 * `dark-archive-style.ts`, which is gone. Only type-level `maplibre-gl` imports, so this module
 * has zero runtime WebGL dependency and is safe to unit test in plain Node.
 *
 * Every color comes from `../../lib/map-experience/dignity-style.ts` (which reuses
 * `@repo/ui`'s brand palette). This file introduces no new hues, so the dignity rule
 * (no red violence markers, no crime-heat) holds at the render layer, not only in tokens.
 */
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';
import { brandPalette } from '@repo/ui';
import {
  DENSITY_TIER_FILL,
  DIGNITY_PALETTE,
  EXPLORE_CLUSTER_CONFIG,
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
import { precisionsWithMark, type RecordMark } from '../../lib/map-experience/geo-precision';
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
/** Group circle opacity. Opaque paper, so a group reads as a single counted object. */
export const ENTITY_CLUSTER_OPACITY = 1;

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

/** A dot at the site, a hollow ring at the neighborhood or city (`recordMarkFor`). */
const DOT_RADIUS_PX = 4;
const RING_RADIUS_PX = 7;
const SELECTED_HALO_PX = 2;
/** A selected ring's copper stroke: twice the resting ring's weight. */
const SELECTED_RING_PX = 3;

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

/** Jurisdiction tags draw from regional zoom up, never at national scale. */
export const JURISDICTION_TAG_MIN_ZOOM = 5.5;

/**
 * Collision padding around a group's count, in pixels: enough to cover the largest group circle
 * (`CLUSTER_RADIUS_BY_COUNT`) around an 11px count. `text-padding` cannot vary by feature, so
 * every group reserves the largest circle's box.
 */
const GROUP_COLLISION_PADDING_PX = (CLUSTER_RADIUS_BY_COUNT.at(-1)?.[1] ?? 20) - 4;

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
   * When true, nearby points aggregate while zoomed out (opt-in via `/explore?group=1`). When false, every
   * unclustered disc stays visible at national/regional zoom — the shareable `group`
   * URL toggle on `/explore`.
   */
  readonly clusteringEnabled?: boolean;
  /** Site theme — map plate and street ink follow light/dark. */
  readonly colorScheme?: MapColorScheme;
  /**
   * Aerial imagery under the archive instead of the flat cartographic plate (`?sat=1`). Changes
   * the basemap only: which records are on the plate, and how they are encoded, are untouched.
   */
  readonly satellite?: boolean;
};

/**
 * Builds the full `/explore` MapLibre style: entity points with a radius-affordance
 * halo (precision-tier rendering), optional clustering when zoomed out, an optional
 * state-level presence/density fill ("presence, not just incidents"), and a
 * jurisdiction-area polygon layer (area records render as geometry, never as a point;
 * empty today, see `build-explore-map-source.ts`).
 * Clustering config (`EXPLORE_CLUSTER_CONFIG`) sets radius and max zoom; cluster taps
 * ease the camera to expansion zoom (see `cluster-expand.ts`) rather than opening a leaf record.
 */
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
  /* County- and state-precision records draw no point (`recordMarkFor`): they leave the
     entities source and are counted in a jurisdiction tag instead. */
  const drawn = drawnRecordCollection(input.featureCollection);
  const tags = jurisdictionTagCollection(input.featureCollection);
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
  return {
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
        // both decades. This is safe alongside clustering: MapLibre promotes
        // the property when it is there and keeps its generated id for a cluster, which has none.
        promoteId: 'entityId',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        data: drawn as any,
        ...(clusteringEnabled
          ? {
              cluster: true,
              clusterRadius: EXPLORE_CLUSTER_CONFIG.clusterRadius,
              clusterMaxZoom: EXPLORE_CLUSTER_CONFIG.clusterMaxZoom,
            }
          : { cluster: false }),
      },
      [EXPLORE_JURISDICTION_TAGS_SOURCE_ID]: {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        data: tags as any,
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
        ...(clusteringEnabled
          ? {
              cluster: true,
              clusterRadius: EXPLORE_CLUSTER_CONFIG.clusterRadius,
              clusterMaxZoom: EXPLORE_CLUSTER_CONFIG.clusterMaxZoom,
            }
          : { cluster: false }),
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
        paint: { ...SATELLITE_RASTER_PAINT[colorScheme] },
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
            10,
            11,
            14,
          ] as unknown as ExpressionSpecification,
          'text-max-width': 8,
          'text-anchor': 'top',
          'text-offset': [0, 0.35],
        },
        paint: {
          'text-color': plate.placeLabelHi,
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
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-max-width': 8,
          'text-letter-spacing': 0.02,
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
          'text-size': 10,
          'text-font': ['Noto Sans Regular'],
          'text-offset': [0, 1.4],
          'text-max-width': 24,
          'text-letter-spacing': 0.04,
          // A tag that would collide gives way at this zoom and returns as the reader zooms in.
          'text-padding': 4,
        },
        paint: {
          'text-color': plate.tagText,
          'text-halo-color': plate.ocean,
          'text-halo-width': haloWidth(1.2),
        },
      },
      {
        // One layer, two shapes: a solid dot where the archive holds the site, a hollow ring
        // where it holds the neighborhood or city. Kind is never encoded here.
        id: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          // A decade change crossfades rather than snapping (v9 §11 supersedes v6 §4.4).
          ...DECADE_TRANSITION_PAINT,
          'circle-radius': byMark(DOT_RADIUS_PX, RING_RADIUS_PX),
          'circle-color': byMark(plate.markInk, 'rgba(0,0,0,0)'),
          'circle-opacity': ENTITY_POINT_FILL_OPACITY,
          'circle-stroke-width': byMark(1, 1.5),
          'circle-stroke-color': byMark(plate.ocean, plate.markInk),
          'circle-stroke-opacity': 0.9,
        },
      },
      {
        id: EXPLORE_CLUSTER_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          // A decade change crossfades rather than snapping (v9 §11 supersedes v6 §4.4).
          ...DECADE_TRANSITION_PAINT,
          'circle-radius': groupRadiusExpression(),
          'circle-color': plate.groupFill,
          'circle-opacity': ENTITY_CLUSTER_OPACITY,
          'circle-stroke-width': 1,
          'circle-stroke-color': plate.groupStroke,
        },
      },
      {
        id: EXPLORE_CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 11,
          'text-font': ['Noto Sans Bold'],
          // A count always draws, and claims the whole group circle in the collision index (the
          // padding reaches the largest circle's edge), so no tag or label prints across a group.
          'text-allow-overlap': true,
          'text-padding': GROUP_COLLISION_PADDING_PX,
        },
        paint: { 'text-color': plate.groupText },
      },
      {
        id: EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': byMark(DOT_RADIUS_PX, RING_RADIUS_PX),
          'circle-color': byMark(plate.markInk, 'rgba(0,0,0,0)'),
          'circle-opacity': 0,
          'circle-stroke-width': byMark(1, 1.5),
          'circle-stroke-color': byMark(plate.ocean, plate.markInk),
          'circle-stroke-opacity': 0,
        },
      },
      {
        id: EXPLORE_CLUSTER_INCOMING_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': groupRadiusExpression(),
          'circle-color': plate.groupFill,
          'circle-opacity': 0,
          'circle-stroke-width': 1,
          'circle-stroke-color': plate.groupStroke,
        },
      },
      {
        id: EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 11,
          'text-font': ['Noto Sans Bold'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': plate.groupText, 'text-opacity': 0 },
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
          'text-color': DIGNITY_PALETTE.point,
          'text-halo-color': plate.ocean,
          'text-halo-width': haloWidth(1.2),
        },
      },
      {
        // Selected, in its own shape: a site dot turns copper with a paper halo; a ring stays a
        // hollow ring, drawn in copper and heavier, so selection never sharpens a city record
        // into a site. Copper on the map means the current thing and nothing else.
        id: EXPLORE_SELECTED_POINT_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: selectedPointFilterExpression(undefined),
        paint: {
          // Larger than the mark it replaces, so selection never reads by color alone.
          'circle-radius': byMark(DOT_RADIUS_PX + 2, RING_RADIUS_PX + 1),
          'circle-color': byMark(DIGNITY_PALETTE.point, 'rgba(0,0,0,0)'),
          'circle-opacity': 1,
          'circle-stroke-width': byMark(SELECTED_HALO_PX, SELECTED_RING_PX),
          'circle-stroke-color': byMark(plate.selectedHalo, DIGNITY_PALETTE.point),
          'circle-stroke-opacity': 1,
        },
      },
    ],
  };
}
