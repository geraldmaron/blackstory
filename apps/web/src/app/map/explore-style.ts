/**
 * Production MapLibre style builder for BB-051's `/explore` national map experience — the
 * production evolution of `dark-archive-style.ts`'s BB-070 demo style. Only type-level
 * `maplibre-gl` imports here (matching `dark-archive-style.ts`'s own convention), so this module
 * has zero runtime WebGL dependency and is safe to unit test in plain Node.
 *
 * Every color comes from `../../lib/map-experience/dignity-style.ts` (which itself only reuses
 * `@black-book/ui`'s brand palette) — this file introduces no new color, honoring the BB-051
 * dignity rule (no red violence markers, no crime-heat) at the actual render layer, not just in
 * the token module.
 */
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';
import { brandPalette } from '@black-book/ui';
import {
  DENSITY_TIER_FILL,
  DIGNITY_PALETTE,
  EXPLORE_CLUSTER_CONFIG,
} from '../../lib/map-experience/dignity-style';
import type {
  ExploreMapFeatureCollection,
  JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import {
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_JURISDICTION_AREAS_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-layer-ids';

export {
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_JURISDICTION_AREAS_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-layer-ids';

/**
 * Approximate meters-per-pixel at a given zoom under spherical Web Mercator, ignoring latitude
 * distortion (the same order of approximation this repo already uses for state bounding boxes —
 * see `packages/domain/src/map/us-geography.ts`'s module doc — "good enough for national-zoom …
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

export type BuildExploreMapStyleInput = {
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly densityLayerEnabled: boolean;
  readonly historyEdgesEnabled?: boolean;
};

/**
 * Builds the full `/explore` MapLibre style: clustered entity points with a radius-affordance
 * halo (precision-tier rendering — BB-091), an optional state-level presence/density fill (BB-051
 * "presence, not just incidents"), and a jurisdiction-area polygon layer (BB-091 — area records
 * render as geometry, never as a point; empty today, see `build-explore-map-source.ts`'s
 * INTEGRATION POINT). Clustering config (`EXPLORE_CLUSTER_CONFIG`) is the one place that governs
 * "every cluster decomposes to named entities within two interactions."
 */
export function buildExploreMapStyle(input: BuildExploreMapStyleInput): StyleSpecification {
  return {
    version: 8,
    name: 'Black Book — Explore (BB-051)',
    sources: {
      [EXPLORE_STATE_DENSITY_SOURCE_ID]: {
        type: 'geojson',
        // Empty until ExploreMapCanvas fetches `/geo/us-states-20m.geojson` and joins density.
        // Do not point `data` at the URL — MapLibre’s async URL load would overwrite setData.
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
        // Always hittable for state selection — density tint is optional chrome on top.
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
                'rgba(255, 255, 255, 0.1)',
              ]
            : 'rgba(255, 255, 255, 0.12)',
          'fill-opacity': 1,
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
          'fill-color': 'rgba(184, 107, 42, 0.35)',
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
          // Circular entity markers — fixed px radii (not rectangular state fills). Precision
          // affordance copy remains on the entity page and explore list.
          'circle-radius': 22,
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
          'circle-radius': 11,
          'circle-color': DIGNITY_PALETTE.point,
          'circle-stroke-width': 3,
          'circle-stroke-color': DIGNITY_PALETTE.selected,
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
          'circle-stroke-width': 3,
          'circle-stroke-color': DIGNITY_PALETTE.selected,
        },
      },
      {
        // Cluster count label. No `glyphs` URL is configured on this style (same honest gap as
        // `dark-archive-style.ts`'s demo style — no self-hosted font/sprite server wired up yet,
        // see ADR-013 "known gaps"), so this renders as a silent no-op today rather than visible
        // text; the cluster's real name-bearing content is never gated on it — the accessible
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
