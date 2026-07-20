/**
 * Compact MapLibre style for entity-page location snippets: OpenFreeMap streets plus
 * one public-precision pin. Shares dignity palette / OpenFreeMap hosts with explore
 * (ADR-013) — no commercial tile or Maps API key.
 */
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';
import {
  DIGNITY_PALETTE,
  OPENFREEMAP_GLYPHS_URL,
  OPENFREEMAP_SOURCE_ID,
  OPENFREEMAP_TILE_SOURCE_URL,
  plateForScheme,
  type MapColorScheme,
} from './dignity-style';

export const ENTITY_LOCATION_PIN_SOURCE_ID = 'entity-location-pin';
export const ENTITY_LOCATION_PIN_HALO_LAYER_ID = 'entity-location-pin-halo';
export const ENTITY_LOCATION_PIN_LAYER_ID = 'entity-location-pin-point';

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

function streetFillWidthExpression(): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    roadClassWidthMatch({
      motorway: 0.28,
      trunk: 0.24,
      primary: 0.2,
      secondary: 0.14,
      tertiary: 0.1,
      minor: 0.08,
      fallback: 0.06,
    }),
    12,
    roadClassWidthMatch({
      motorway: 1.2,
      trunk: 1,
      primary: 0.86,
      secondary: 0.62,
      tertiary: 0.46,
      minor: 0.34,
      fallback: 0.22,
    }),
    14,
    roadClassWidthMatch({
      motorway: 2.4,
      trunk: 2,
      primary: 1.7,
      secondary: 1.2,
      tertiary: 0.9,
      minor: 0.7,
      fallback: 0.45,
    }),
  ] as unknown as ExpressionSpecification;
}

/** Camera zoom matched to the public precision label shown on the entity page. */
export function zoomForLocationPrecision(
  precision: 'city' | 'neighborhood' | 'campus' | 'institution',
): number {
  if (precision === 'city') return 10;
  if (precision === 'neighborhood') return 12;
  return 13;
}

export type BuildEntityLocationMapStyleInput = {
  readonly lat: number;
  readonly lng: number;
  readonly colorScheme?: MapColorScheme;
};

/** Style for a single-record street context map (OpenFreeMap + copper pin). */
export function buildEntityLocationMapStyle(
  input: BuildEntityLocationMapStyleInput,
): StyleSpecification {
  const plate = plateForScheme(input.colorScheme ?? 'dark');
  return {
    version: 8,
    name: 'BlackStory — Entity location',
    glyphs: OPENFREEMAP_GLYPHS_URL,
    sources: {
      [OPENFREEMAP_SOURCE_ID]: {
        type: 'vector',
        url: OPENFREEMAP_TILE_SOURCE_URL,
        attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      },
      [ENTITY_LOCATION_PIN_SOURCE_ID]: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [input.lng, input.lat],
              },
            },
          ],
        },
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': plate.ocean },
      },
      {
        id: 'entity-street-casing',
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
        id: 'entity-street-fill',
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
        id: 'entity-street-label',
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
        id: ENTITY_LOCATION_PIN_HALO_LAYER_ID,
        type: 'circle',
        source: ENTITY_LOCATION_PIN_SOURCE_ID,
        paint: {
          'circle-radius': 14,
          'circle-color': DIGNITY_PALETTE.pointHalo,
          'circle-opacity': 0.35,
        },
      },
      {
        id: ENTITY_LOCATION_PIN_LAYER_ID,
        type: 'circle',
        source: ENTITY_LOCATION_PIN_SOURCE_ID,
        paint: {
          'circle-radius': 7,
          'circle-color': DIGNITY_PALETTE.point,
          'circle-stroke-width': 2,
          'circle-stroke-color': DIGNITY_PALETTE.pointHalo,
        },
      },
    ],
  };
}
