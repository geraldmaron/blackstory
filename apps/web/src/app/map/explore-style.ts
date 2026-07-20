/**
 * Production MapLibre style builder for the `/explore` national map — the production evolution
 * of `dark-archive-style.ts`. Only type-level `maplibre-gl` imports (same convention as the demo
 * style), so this module has zero runtime WebGL dependency and is safe to unit test in plain Node.
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
  plateForScheme,
  type MapColorScheme,
} from '../../lib/map-experience/dignity-style';
import {
  KIND_ENCODING_ENTRIES,
  DEFAULT_KIND_ENCODING,
  MAP_SEMANTIC_TONE_ENCODING,
} from '../../lib/map-experience/kind-encoding';
import {
  markerHaloRadiusExpression,
  markerRadiusExpression,
  markerRadiusPlusExpression,
} from '../../lib/map-experience/marker-size';
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
  EXPLORE_MEMORIAL_NAMES_LAYER_ID,
  EXPLORE_MEMORIAL_NAMES_SOURCE_ID,
  MEMORIAL_NAMES_MAP_LAYER_ENABLED,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-layer-ids';
import {
  COUNTY_LABELS_MIN_ZOOM,
  COUNTY_LINES_MIN_ZOOM,
} from '../../lib/map-experience/us-county-lines';
import type { ExploreLayerMode } from '../../lib/map-experience/url-state';
import { DEFAULT_POPULATION_GEO, type ExplorePopulationGeo } from '../../lib/map-experience/explore-population';
import {
  buildMemorialNameFeatures,
  MEMORIAL_LABEL_TEXT_FONT,
  type MemorialNameFeatureCollection,
} from '../../lib/map-experience/build-memorial-name-features';

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
  EXPLORE_MEMORIAL_NAMES_LAYER_ID,
  EXPLORE_MEMORIAL_NAMES_SOURCE_ID,
  MEMORIAL_NAMES_MAP_LAYER_ENABLED,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
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

/** Street casing: muted hierarchy; z12≈1.8 / z14≈3.5 at trunk, thinner elsewhere. */
function streetCasingWidthExpression(): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    roadClassWidthMatch({
      motorway: 0.48,
      trunk: 0.42,
      primary: 0.36,
      secondary: 0.26,
      tertiary: 0.19,
      minor: 0.14,
      fallback: 0.1,
    }),
    12,
    roadClassWidthMatch({
      motorway: 2.06,
      trunk: 1.8,
      primary: 1.54,
      secondary: 1.13,
      tertiary: 0.82,
      minor: 0.62,
      fallback: 0.41,
    }),
    14,
    roadClassWidthMatch({
      motorway: 4,
      trunk: 3.5,
      primary: 3,
      secondary: 2.2,
      tertiary: 1.6,
      minor: 1.2,
      fallback: 0.8,
    }),
  ] as unknown as ExpressionSpecification;
}

/** Street fill: always thinner than casing at the same class; z12≈1.0 / z14≈2.0 at trunk. */
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

/**
 * Approximate meters-per-pixel at a given zoom under spherical Web Mercator, ignoring latitude
 * distortion (the same order of approximation this repo already uses for state bounding boxes
 * see `packages/domain/src/map/us-geography.ts`'s module doc "good enough for national-zoom …
 * never survey-grade"). Expressed as a MapLibre style expression so the radius-affordance circle
 * scales correctly as the user zooms, per-feature, from each point's own `radiusMeters` property.
 */
const WEB_MERCATOR_METERS_AT_ZOOM_0 = 156_543.03392;

function _radiusMetersToPixelsExpression(): ExpressionSpecification {
  return [
    '/',
    ['*', ['coalesce', ['get', 'radiusMeters'], 0], ['^', 2, ['zoom']]],
    WEB_MERCATOR_METERS_AT_ZOOM_0,
  ] as ExpressionSpecification;
}

/**
 * kind -> shade + glyph paint. Every entity kind gets a `DIGNITY_PALETTE` shade (via
 * `kind-encoding.ts`, so color is one source of truth) AND a non-color fill/stroke signature
 * (WCAG 1.4.1 color is never the only signal), keyed by glyph identity rather than kind so two
 * kinds that ever shared a glyph would automatically share a signature too:
 *  - `circle` (place): solid fill, thin rim the map's original default marker treatment.
 *  - `square` (school): solid fill, a disproportionately thick rim ("blocky").
 *  - `diamond` (event): solid fill, thin rim, PLUS a second offset unfilled ring layer
 *    (`EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID` below) an "orbit ring" marker.
 *  - `ring` (institution): mostly-hollow fill, thick Stone rim a literal ring.
 * MapLibre `circle`-type layers cannot render literal square/diamond geometry (no shape
 * parameter exists in the style spec), and this style has no icon sprite / glyph server to draw
 * true shapes via `symbol` layers (ADR-013 "known gaps" the exact reason
 * `EXPLORE_CLUSTER_COUNT_LAYER_ID` below is already a documented no-op). `MapExperienceLegend`
 * renders the literal circle/square/diamond/ring shapes via CSS, which has no such limitation;
 * this fill/stroke vocabulary is the canvas-side echo of the same four glyph identities.
 */
type KindGlyphPaintSignature = {
  readonly opacity: number;
  readonly strokeWidth: number;
  readonly strokeColor: string;
};

/** Unclustered solid-fill disc opacity — translucent enough to read basemap/county
 * hairlines through the marker while kind shade stays readable. HTML hit-targets
 * (`.ds-map-entity-marker`) use the same value via CSS. */
export const ENTITY_POINT_FILL_OPACITY = 0.52;
/** Soft halo under every unclustered point. */
export const ENTITY_HALO_OPACITY = 0.16;
/** Cluster aggregate disc opacity (grouped view). */
export const ENTITY_CLUSTER_OPACITY = 0.55;
/** Institution "ring" glyph — mostly hollow by design. */
export const ENTITY_RING_FILL_OPACITY = 0.2;

/**
 * Opaque plate fills — memorial names live as a MapLibre symbol layer in the
 * style stack (above background, below land fills), so the ocean plate stays
 * fully opaque and state fills occlude names on land. No DOM under-canvas bleed.
 */
export const PLATE_BACKGROUND_OPACITY = 1;
export const PLATE_STATE_FILL_OPACITY = 1;

const GLYPH_PAINT_SIGNATURE: Readonly<Record<string, KindGlyphPaintSignature>> = {
  // Solid-fill kinds sit below full opacity so geography stays legible through the disc.
  // `ring` stays far lower; mostly-hollow IS its glyph signature.
  circle: {
    opacity: ENTITY_POINT_FILL_OPACITY,
    strokeWidth: 1.5,
    strokeColor: DIGNITY_PALETTE.selected,
  },
  square: {
    opacity: ENTITY_POINT_FILL_OPACITY,
    strokeWidth: 4,
    strokeColor: DIGNITY_PALETTE.selected,
  },
  diamond: {
    opacity: ENTITY_POINT_FILL_OPACITY,
    strokeWidth: 1.5,
    strokeColor: DIGNITY_PALETTE.selected,
  },
  ring: {
    opacity: ENTITY_RING_FILL_OPACITY,
    strokeWidth: 3,
    strokeColor: DIGNITY_PALETTE.kindInstitutionStroke,
  },
};

const DEFAULT_GLYPH_PAINT_SIGNATURE: KindGlyphPaintSignature = GLYPH_PAINT_SIGNATURE.circle!;

function glyphSignatureFor(glyph: string): KindGlyphPaintSignature {
  return GLYPH_PAINT_SIGNATURE[glyph] ?? DEFAULT_GLYPH_PAINT_SIGNATURE;
}

/** Builds a `['match', ['get', 'kind'], k1, v1, k2, v2, ..., fallback]` expression from
 * `KIND_ENCODING_ENTRIES`, so every kind-keyed paint property here is generated from the same
 * table `kind-encoding.ts` exports rather than re-listing `place | school | event | institution`
 * by hand at each call site. */
function kindMatchExpression(
  valueForEntry: (entry: (typeof KIND_ENCODING_ENTRIES)[number][1]) => string | number,
  fallback: string | number,
): ExpressionSpecification {
  const cases = KIND_ENCODING_ENTRIES.flatMap(([kind, entry]) => [kind, valueForEntry(entry)]);
  // `cases` is a variable-length spread, so this array's inferred shape is not one of
  // `ExpressionSpecification`'s fixed-length tuple variants; go through `unknown` (same escape
  // hatch this repo already uses for other MapLibre expression/filter casts, e.g.
  // `ExploreMapCanvas.tsx`'s `as unknown as [string, ...unknown[]]`).
  return ['match', ['get', 'kind'], ...cases, fallback] as unknown as ExpressionSpecification;
}

function kindColorExpression(): ExpressionSpecification {
  // Prefer the denormalized `shade` property (same hex KindBadge uses via displayEncodingFor).
  // Fall back to kind/mapTone match tables for any older GeoJSON that lacks `shade`.
  const semanticCases = Object.entries(MAP_SEMANTIC_TONE_ENCODING).flatMap(([tone, entry]) => [
    tone,
    entry.shade,
  ]);
  const kindCases = KIND_ENCODING_ENTRIES.flatMap(([kind, entry]) => [kind, entry.shade]);
  return [
    'case',
    ['has', 'shade'],
    ['get', 'shade'],
    ['has', 'mapTone'],
    ['match', ['get', 'mapTone'], ...semanticCases, DEFAULT_KIND_ENCODING.shade],
    ['match', ['get', 'kind'], ...kindCases, DEFAULT_KIND_ENCODING.shade],
  ] as unknown as ExpressionSpecification;
}

function kindFillOpacityExpression(): ExpressionSpecification {
  return kindMatchExpression(
    (entry) => glyphSignatureFor(entry.glyph).opacity,
    DEFAULT_GLYPH_PAINT_SIGNATURE.opacity,
  );
}

function kindStrokeWidthExpression(): ExpressionSpecification {
  return kindMatchExpression(
    (entry) => glyphSignatureFor(entry.glyph).strokeWidth,
    DEFAULT_GLYPH_PAINT_SIGNATURE.strokeWidth,
  );
}

function kindStrokeColorExpression(rimColor: string): ExpressionSpecification {
  return kindMatchExpression(
    (entry) => (entry.glyph === 'ring' ? DIGNITY_PALETTE.kindInstitutionStroke : rimColor),
    rimColor,
  );
}

/**
 * Presence density fill — resting `fillColor` on each feature, with optional
 * feature-state colorA/colorB/blend lerp for decade morphs (A→B per state).
 */
export function buildPresenceDensityFillColorExpression(
  plate: ReturnType<typeof plateForScheme>,
  presenceFillActive: boolean,
): ExpressionSpecification {
  if (!presenceFillActive) {
    return plate.densityDisabled as unknown as ExpressionSpecification;
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
};

/**
 * Builds the full `/explore` MapLibre style: entity points with a radius-affordance
 * halo (precision-tier rendering), optional clustering when zoomed out, an optional
 * state-level presence/density fill ("presence, not just incidents"), and a
 * jurisdiction-area polygon layer (area records render as geometry, never as a point;
 * empty today, see `build-explore-map-source.ts`).
 * Clustering config (`EXPLORE_CLUSTER_CONFIG`) is the one place that governs
 * "every cluster decomposes to named entities within two interactions" when grouping is on.
 */
export function buildExploreMapStyle(input: BuildExploreMapStyleInput): StyleSpecification {
  const plate = plateForScheme(input.colorScheme ?? 'dark');
  const clusteringEnabled = input.clusteringEnabled !== false;
  const popGeo = input.popGeo ?? DEFAULT_POPULATION_GEO;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        data: input.featureCollection as any,
        ...(clusteringEnabled
          ? {
              cluster: true,
              clusterRadius: EXPLORE_CLUSTER_CONFIG.clusterRadius,
              clusterMaxZoom: EXPLORE_CLUSTER_CONFIG.clusterMaxZoom,
            }
          : { cluster: false }),
      },
      [EXPLORE_ENTITIES_INCOMING_SOURCE_ID]: {
        type: 'geojson',
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
      [EXPLORE_MEMORIAL_NAMES_SOURCE_ID]: {
        type: 'geojson',
        promoteId: 'id',
        // Hidden for now — keep the source wired; builders/data stay in-repo.
        // Re-enable: MEMORIAL_NAMES_MAP_LAYER_ENABLED + restore feature build below.
        data: (MEMORIAL_NAMES_MAP_LAYER_ENABLED
          ? buildMemorialNameFeatures({ seedKey: 'map-stage' })
          : { type: 'FeatureCollection', features: [] }) satisfies MemorialNameFeatureCollection,
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
        // Memorial typographic field — eligible full names on non-state anchors.
        // Name-only; Italic face + per-feature size/rotation for collage texture
        // (not a typeset grid). Currently hidden via MEMORIAL_NAMES_MAP_LAYER_ENABLED.
        // Decade fade via paint feature-state only when the layer is live again.
        id: EXPLORE_MEMORIAL_NAMES_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_MEMORIAL_NAMES_SOURCE_ID,
        layout: {
          visibility: MEMORIAL_NAMES_MAP_LAYER_ENABLED ? 'visible' : 'none',
          'text-field': ['get', 'name'],
          'text-font': [...MEMORIAL_LABEL_TEXT_FONT],
          'text-size': ['get', 'size'],
          'text-rotate': ['get', 'rotate'],
          'text-letter-spacing': 0.05,
          'text-max-width': 7,
          'text-justify': 'center',
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          // Minimal padding — pack the ocean field; MapLibre still blocks overlaps.
          'text-padding': 0.75,
          'text-optional': false,
          'symbol-sort-key': ['get', 'priority'],
          'symbol-z-order': 'source',
        },
        paint: {
          'text-color':
            (input.colorScheme ?? 'dark') === 'light'
              ? brandPalette.blackInk
              : brandPalette.archivePaper,
          // feature-state is paint-only in MapLibre — layout.text-size cannot use it.
          'text-opacity': [
            'case',
            ['boolean', ['feature-state', 'passed'], false],
            0,
            ['get', 'ink'],
          ],
          'text-opacity-transition': { duration: 720, delay: 0 },
          // Flat matte contrast on the ocean plate — not a glow/shadow.
          'text-halo-color': plate.ocean,
          'text-halo-width': 0.75,
        },
      },
      {
        id: 'explore-street-casing',
        type: 'line',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'transportation',
        minzoom: 8,
        filter: ['all', ['!=', ['get', 'class'], 'ferry'], ['!=', ['get', 'brunnel'], 'tunnel']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': plate.streetCasing,
          'line-width': streetCasingWidthExpression(),
        },
      },
      {
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
        },
      },
      {
        id: 'explore-street-label',
        type: 'symbol',
        source: OPENFREEMAP_SOURCE_ID,
        'source-layer': 'transportation_name',
        minzoom: 11,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'symbol-placement': 'line',
          'text-max-angle': 30,
        },
        paint: {
          'text-color': plate.streetLabel,
          'text-halo-color': plate.ocean,
          'text-halo-width': 1,
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
          'fill-opacity': PLATE_STATE_FILL_OPACITY,
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
          'fill-opacity': countyPopulationFillActive ? 0.85 : 0,
        },
      },
      {
        // County hairlines (the related workstream): the fainter tier of the same boundary system as
        // the state bounds line below it in this array — theme-aware ink (stone on light, paper on
        // dark), thinner and more transparent, fading in from `minzoom` so the national frame stays
        // clean. Sits BELOW state bounds (so state borders keep reading stronger) and far below the
        // entity marker stack, whose zoom-scaled radius (marker-size.ts's `markerZoomScaleExpression`)
        // keeps a circle proportionate to the county polygon behind it at every zoom.
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
            0.28,
            9,
            0.45,
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
          'text-halo-width': 1.5,
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
          // Warm hairlines, not stark paper strokes — state bounds are the
          // chart's ruling, and the entity stack must always read above them.
          'line-color': plate.stateBounds,
          'line-width': 1,
          'line-opacity': 0.55,
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
          'line-color': DIGNITY_PALETTE.pointHalo,
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
          'line-color': DIGNITY_PALETTE.pointHalo,
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
          'line-color': DIGNITY_PALETTE.point,
          'line-width': 4,
          'line-opacity': 1,
        },
      },
      {
        id: EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          // data-driven radius (marker-size.ts's formula + the fixed halo offset), one
          // source of truth with the point layer below. Halo uses the same kind/tone shade as
          // the point (and KindBadge) at low opacity — a neutral sand wash was washing every
          // marker toward the same warm tone and hiding kind color coding.
          'circle-radius': markerHaloRadiusExpression(),
          'circle-color': kindColorExpression(),
          'circle-opacity': ENTITY_HALO_OPACITY,
        },
      },
      {
        id: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          // size from marker-size.ts (evidenceCount + confidenceTier, clamped [6, 16]);
          // color + fill/stroke signature from kind-encoding.ts via DIGNITY_PALETTE (color marks
          // kind only; the fill/stroke signature is the non-color channel WCAG 1.4.1 requires).
          'circle-radius': markerRadiusExpression(),
          'circle-color': kindColorExpression(),
          'circle-opacity': kindFillOpacityExpression(),
          'circle-stroke-width': kindStrokeWidthExpression(),
          'circle-stroke-color': kindStrokeColorExpression(plate.selected),
        },
      },
      {
        // the `event` kind's "diamond" glyph a second, unfilled ring offset around the
        // point marker (see the `GLYPH_PAINT_SIGNATURE` doc comment above for why this
        // approximates rather than draws literal diamond geometry). Filtered to `event` only;
        // every other kind's glyph is fully carried by the point layer above.
        id: EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'kind'], 'event']],
        paint: {
          // Offset ring via marker-size.ts's top-level zoom interpolate — `['+', radiusExpr, 4]`
          // would nest the zoom expression and be rejected by the style spec (see
          // `markerRadiusPlusExpression`'s doc comment).
          'circle-radius': markerRadiusPlusExpression(4),
          'circle-color': kindColorExpression(),
          'circle-opacity': 0,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': kindColorExpression(),
          'circle-stroke-opacity': 0.9,
        },
      },
      {
        id: EXPLORE_CLUSTER_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          // Zoom-outermost interpolate (MapLibre paint restriction) × count steps — national
          // frames keep aggregates small so dense catalogs do not blot geography.
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            [
              '*',
              [
                'step',
                ['get', 'point_count'],
                CLUSTER_RADIUS_BY_COUNT[0]![1],
                CLUSTER_RADIUS_BY_COUNT[1]![0],
                CLUSTER_RADIUS_BY_COUNT[1]![1],
                CLUSTER_RADIUS_BY_COUNT[2]![0],
                CLUSTER_RADIUS_BY_COUNT[2]![1],
                CLUSTER_RADIUS_BY_COUNT[3]![0],
                CLUSTER_RADIUS_BY_COUNT[3]![1],
              ],
              0.45,
            ],
            5.5,
            [
              '*',
              [
                'step',
                ['get', 'point_count'],
                CLUSTER_RADIUS_BY_COUNT[0]![1],
                CLUSTER_RADIUS_BY_COUNT[1]![0],
                CLUSTER_RADIUS_BY_COUNT[1]![1],
                CLUSTER_RADIUS_BY_COUNT[2]![0],
                CLUSTER_RADIUS_BY_COUNT[2]![1],
                CLUSTER_RADIUS_BY_COUNT[3]![0],
                CLUSTER_RADIUS_BY_COUNT[3]![1],
              ],
              0.85,
            ],
            9,
            [
              'step',
              ['get', 'point_count'],
              CLUSTER_RADIUS_BY_COUNT[0]![1],
              CLUSTER_RADIUS_BY_COUNT[1]![0],
              CLUSTER_RADIUS_BY_COUNT[1]![1],
              CLUSTER_RADIUS_BY_COUNT[2]![0],
              CLUSTER_RADIUS_BY_COUNT[2]![1],
              CLUSTER_RADIUS_BY_COUNT[3]![0],
              CLUSTER_RADIUS_BY_COUNT[3]![1],
            ],
          ],
          'circle-color': DIGNITY_PALETTE.point,
          'circle-opacity': ENTITY_CLUSTER_OPACITY,
          'circle-stroke-width': 2,
          'circle-stroke-color': plate.selected,
        },
      },
      {
        // Cluster count label — glyphs now supplied via OpenFreeMap fonts.
        id: EXPLORE_CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 11,
          'text-font': ['Noto Sans Regular'],
        },
        paint: { 'text-color': plate.clusterText },
      },
      {
        id: EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': markerHaloRadiusExpression(),
          'circle-color': kindColorExpression(),
          'circle-opacity': 0,
        },
      },
      {
        id: EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': markerRadiusExpression(),
          'circle-color': kindColorExpression(),
          'circle-opacity': 0,
          'circle-stroke-width': kindStrokeWidthExpression(),
          'circle-stroke-color': kindStrokeColorExpression(plate.selected),
          'circle-stroke-opacity': 0,
        },
      },
      {
        id: EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'kind'], 'event']],
        paint: {
          'circle-radius': markerRadiusPlusExpression(4),
          'circle-color': kindColorExpression(),
          'circle-opacity': 0,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': kindColorExpression(),
          'circle-stroke-opacity': 0,
        },
      },
      {
        id: EXPLORE_CLUSTER_INCOMING_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            [
              '*',
              [
                'step',
                ['get', 'point_count'],
                CLUSTER_RADIUS_BY_COUNT[0]![1],
                CLUSTER_RADIUS_BY_COUNT[1]![0],
                CLUSTER_RADIUS_BY_COUNT[1]![1],
                CLUSTER_RADIUS_BY_COUNT[2]![0],
                CLUSTER_RADIUS_BY_COUNT[2]![1],
                CLUSTER_RADIUS_BY_COUNT[3]![0],
                CLUSTER_RADIUS_BY_COUNT[3]![1],
              ],
              0.45,
            ],
            5.5,
            [
              '*',
              [
                'step',
                ['get', 'point_count'],
                CLUSTER_RADIUS_BY_COUNT[0]![1],
                CLUSTER_RADIUS_BY_COUNT[1]![0],
                CLUSTER_RADIUS_BY_COUNT[1]![1],
                CLUSTER_RADIUS_BY_COUNT[2]![0],
                CLUSTER_RADIUS_BY_COUNT[2]![1],
                CLUSTER_RADIUS_BY_COUNT[3]![0],
                CLUSTER_RADIUS_BY_COUNT[3]![1],
              ],
              0.85,
            ],
            9,
            [
              'step',
              ['get', 'point_count'],
              CLUSTER_RADIUS_BY_COUNT[0]![1],
              CLUSTER_RADIUS_BY_COUNT[1]![0],
              CLUSTER_RADIUS_BY_COUNT[1]![1],
              CLUSTER_RADIUS_BY_COUNT[2]![0],
              CLUSTER_RADIUS_BY_COUNT[2]![1],
              CLUSTER_RADIUS_BY_COUNT[3]![0],
              CLUSTER_RADIUS_BY_COUNT[3]![1],
            ],
          ],
          'circle-color': DIGNITY_PALETTE.point,
          'circle-opacity': 0,
          'circle-stroke-width': 2,
          'circle-stroke-color': plate.selected,
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
          'text-font': ['Noto Sans Regular'],
        },
        paint: { 'text-color': plate.clusterText, 'text-opacity': 0 },
      },
      {
        id: EXPLORE_SELECTED_POINT_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['==', ['get', 'entityId'], ''],
        paint: {
          'circle-radius': markerRadiusPlusExpression(6),
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': DIGNITY_PALETTE.point,
          'circle-stroke-opacity': 1,
          'circle-opacity': 1,
        },
      },
    ],
  };
}
