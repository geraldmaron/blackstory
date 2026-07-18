/**
 * Production MapLibre style builder for the `/explore` national map — the production evolution
 * of `dark-archive-style.ts`. Only type-level `maplibre-gl` imports (same convention as the demo
 * style), so this module has zero runtime WebGL dependency and is safe to unit test in plain Node.
 *
 * Every color comes from `../../lib/map-experience/dignity-style.ts` (which reuses
 * `@blap/ui`'s brand palette). This file introduces no new hues, so the dignity rule
 * (no red violence markers, no crime-heat) holds at the render layer, not only in tokens.
 */
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';
import { brandPalette } from '@blap/ui';
import {
  DENSITY_TIER_FILL,
  DIGNITY_PALETTE,
  EXPLORE_CLUSTER_CONFIG,
} from '../../lib/map-experience/dignity-style';
import { KIND_ENCODING_ENTRIES, DEFAULT_KIND_ENCODING } from '../../lib/map-experience/kind-encoding';
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
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_COUNTY_LINES_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_JURISDICTION_AREAS_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-layer-ids';
import { COUNTY_LINES_MIN_ZOOM } from '../../lib/map-experience/us-county-lines';

export {
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_COUNTY_LINES_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_JURISDICTION_AREAS_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-layer-ids';

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
 * BB-099 kind -> shade + glyph paint. Every entity kind gets a `DIGNITY_PALETTE` shade (via
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

const GLYPH_PAINT_SIGNATURE: Readonly<Record<string, KindGlyphPaintSignature>> = {
  // Solid-fill kinds sit at 0.82, not 1: with county hairlines beneath the marker stack
  // (black-book-uda), a fully opaque disc erases the boundary context it sits on — slight
  // transparency keeps the geography legible through the marker without weakening the
  // kind-shade read. `ring` stays far lower; mostly-hollow IS its glyph signature.
  circle: { opacity: 0.82, strokeWidth: 1.5, strokeColor: DIGNITY_PALETTE.selected },
  square: { opacity: 0.82, strokeWidth: 4, strokeColor: DIGNITY_PALETTE.selected },
  diamond: { opacity: 0.82, strokeWidth: 1.5, strokeColor: DIGNITY_PALETTE.selected },
  ring: { opacity: 0.3, strokeWidth: 3, strokeColor: DIGNITY_PALETTE.kindInstitutionStroke },
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
  return kindMatchExpression((entry) => entry.shade, DEFAULT_KIND_ENCODING.shade);
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

function kindStrokeColorExpression(): ExpressionSpecification {
  return kindMatchExpression(
    (entry) => glyphSignatureFor(entry.glyph).strokeColor,
    DEFAULT_GLYPH_PAINT_SIGNATURE.strokeColor,
  );
}

export type BuildExploreMapStyleInput = {
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly densityLayerEnabled: boolean;
  readonly historyEdgesEnabled?: boolean;
};

/**
 * Builds the full `/explore` MapLibre style: clustered entity points with a radius-affordance
 * halo (precision-tier rendering), an optional state-level presence/density fill (
 * "presence, not just incidents"), and a jurisdiction-area polygon layer (area records
 * render as geometry, never as a point; empty today, see `build-explore-map-source.ts`).
 * Clustering config (`EXPLORE_CLUSTER_CONFIG`) is the one place that governs
 * "every cluster decomposes to named entities within two interactions."
 */
export function buildExploreMapStyle(input: BuildExploreMapStyleInput): StyleSpecification {
  return {
    version: 8,
    name: 'Blap — Explore',
    sources: {
      [EXPLORE_STATE_DENSITY_SOURCE_ID]: {
        type: 'geojson',
        // Empty until ExploreMapCanvas fetches `/geo/us-states-20m.geojson` and joins density.
        // Do not point `data` at the URL — MapLibre’s async URL load would overwrite setData.
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
        cluster: true,
        clusterRadius: EXPLORE_CLUSTER_CONFIG.clusterRadius,
        clusterMaxZoom: EXPLORE_CLUSTER_CONFIG.clusterMaxZoom,
      },
      [EXPLORE_HISTORY_EDGES_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': DIGNITY_PALETTE.background },
      },
      {
        id: EXPLORE_STATE_DENSITY_LAYER_ID,
        type: 'fill',
        source: EXPLORE_STATE_DENSITY_SOURCE_ID,
        // Always hittable for state selection density tint is optional chrome on top.
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': input.densityLayerEnabled
            ? [
                'match',
                ['get', 'densityTier'],
                'concentrated',
                DENSITY_TIER_FILL.concentrated,
                'emerging',
                DENSITY_TIER_FILL.emerging,
                'documented',
                DENSITY_TIER_FILL.documented,
                DIGNITY_PALETTE.densityUnknownFill,
              ]
            : DIGNITY_PALETTE.densityDisabledFill,
          'fill-opacity': 1,
        },
      },
      {
        // County hairlines (black-book-uda): the fainter tier of the same boundary system as
        // the state bounds line below it in this array — same Archive Paper ink, thinner and
        // more transparent, fading in from `minzoom` so the national frame stays clean. Sits
        // BELOW state bounds (so state borders keep reading stronger) and far below the entity
        // marker stack, whose zoom-scaled radius (marker-size.ts's `markerZoomScaleExpression`)
        // keeps a circle proportionate to the county polygon behind it at every zoom.
        id: EXPLORE_COUNTY_LINES_LAYER_ID,
        type: 'line',
        source: EXPLORE_COUNTY_LINES_SOURCE_ID,
        minzoom: COUNTY_LINES_MIN_ZOOM,
        paint: {
          'line-color': DIGNITY_PALETTE.selected,
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
        id: 'explore-state-bounds-line',
        type: 'line',
        source: EXPLORE_STATE_DENSITY_SOURCE_ID,
        paint: {
          'line-color': DIGNITY_PALETTE.selected,
          'line-width': 1.25,
          'line-opacity': 1,
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
          // BB-099: data-driven radius (marker-size.ts's formula + the fixed halo offset), one
          // source of truth with the point layer below. Halo color stays neutral/decorative
          // (not kind-carrying) kind is fully carried by the point layer's shade + glyph
          // signature and, for `event`, the extra glyph layer below.
          'circle-radius': markerHaloRadiusExpression(),
          'circle-color': DIGNITY_PALETTE.pointHalo,
          'circle-opacity': 0.32,
        },
      },
      {
        id: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          // BB-099: size from marker-size.ts (evidenceCount + confidenceTier, clamped [6, 16]);
          // color + fill/stroke signature from kind-encoding.ts via DIGNITY_PALETTE (color marks
          // kind only; the fill/stroke signature is the non-color channel WCAG 1.4.1 requires).
          'circle-radius': markerRadiusExpression(),
          'circle-color': kindColorExpression(),
          'circle-opacity': kindFillOpacityExpression(),
          'circle-stroke-width': kindStrokeWidthExpression(),
          'circle-stroke-color': kindStrokeColorExpression(),
        },
      },
      {
        // BB-099: the `event` kind's "diamond" glyph a second, unfilled ring offset around the
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
          'circle-color': DIGNITY_PALETTE.kindEvent,
          'circle-opacity': 0,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': DIGNITY_PALETTE.kindEvent,
          'circle-stroke-opacity': 0.9,
        },
      },
      {
        id: EXPLORE_CLUSTER_LAYER_ID,
        type: 'circle',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30],
          'circle-color': DIGNITY_PALETTE.point,
          // Same slight transparency as the unclustered glyph signatures — aggregate discs
          // shouldn't blot out the boundary lines beneath them either.
          'circle-opacity': 0.82,
          'circle-stroke-width': 3,
          'circle-stroke-color': DIGNITY_PALETTE.selected,
        },
      },
      {
        // Cluster count label. No `glyphs` URL is configured on this style (same honest gap as
        // `dark-archive-style.ts`'s demo style no self-hosted font/sprite server wired up yet,
        // see ADR-013 "known gaps"), so this renders as a silent no-op today rather than visible
        // text; the cluster's real name-bearing content is never gated on it the accessible
        // list and each point's own narrative card carry that information regardless.
        id: EXPLORE_CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: EXPLORE_ENTITIES_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
          'text-font': ['Noto Sans Regular'],
        },
        paint: { 'text-color': DIGNITY_PALETTE.clusterText },
      },
    ],
  };
}
