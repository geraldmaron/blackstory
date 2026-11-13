/**
 * The selected place, resolved on the plate (`docs/ui/patterns-place-map.md`, "Entering a place"):
 * its boundary drawn in copper, and everything outside it receding under a flat veil of the
 * plate's own water color. A state or county is its polygon; a city is its records' extent;
 * a grid square is the square. Pure geography from published outlines and already-public points,
 * so it never draws anything sharper than the marks inside it.
 *
 * The layers are added through the live map, not the style builder, so a place change never
 * rebuilds the style; they are re-added after every style rebuild (`styledata`).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { SQUARE_STEP_DEG } from '@repo/domain/map/place-groups';
import {
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_PLACE_LEADER_LAYER_ID,
} from '../../map/explore-layer-ids';
import { countyKey, type CountyGeometryCollection } from '../../../lib/map-experience/county-hatch';
import {
  fetchStatePolygons,
  type StatePolygonCollection,
} from '../../../components/map-stage/geo-source-loaders';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';

type Position = readonly [number, number];
type Ring = readonly Position[];
type Bounds = readonly [number, number, number, number];

const SOURCE = 'explore-place-focus';
const RECEDE_LAYER = 'explore-place-recede';
const EDGE_LAYER = 'explore-place-edge';
/** How far the plate outside a place recedes. */
const RECEDE_OPACITY = 0.55;
const RESOLVE_MS = 420;
/** A city frame stands a little off its outermost records, so no record sits on the line. */
const CITY_MARGIN_DEG = 0.01;

const WORLD: Ring = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

function rectangle([west, south, east, north]: Bounds): Ring {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

/** The outer rings of a Polygon or MultiPolygon. */
function outerRings(geometry: unknown): Ring[] {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (g?.type === 'Polygon') return [(g.coordinates as Ring[])[0]!];
  if (g?.type === 'MultiPolygon') return (g.coordinates as Ring[][]).map((polygon) => polygon[0]!);
  return [];
}

/**
 * The rings that outline a place, or none when its outline is not on hand yet. `memberBounds` is
 * the place's records' extent `[west, south, east, north]`.
 */
export function placeOutline(
  placeKey: string,
  memberBounds: Bounds | undefined,
  states: StatePolygonCollection | undefined,
  counties: CountyGeometryCollection | undefined,
): Ring[] {
  if (placeKey.startsWith('state-')) {
    const postal = placeKey.slice('state-'.length).toUpperCase();
    const feature = states?.features.find((f) => f.properties.postalCode === postal);
    return feature ? outerRings(feature.geometry) : [];
  }
  if (placeKey.startsWith('county-')) {
    const fips = placeKey.slice('county-'.length);
    const feature = counties?.features.find((f) => countyKey(f.properties) === fips);
    return feature ? outerRings(feature.geometry) : [];
  }
  if (placeKey.startsWith('square-')) {
    const [, column, row] = placeKey.split('-').map(Number) as [number, number, number];
    const west = column * SQUARE_STEP_DEG - 180;
    const south = row * SQUARE_STEP_DEG - 90;
    return [rectangle([west, south, west + SQUARE_STEP_DEG, south + SQUARE_STEP_DEG])];
  }
  if (!memberBounds) return [];
  const [west, south, east, north] = memberBounds;
  return [
    rectangle([
      west - CITY_MARGIN_DEG,
      south - CITY_MARGIN_DEG,
      east + CITY_MARGIN_DEG,
      north + CITY_MARGIN_DEG,
    ]),
  ];
}

/** The outline's extent, for framing the place itself rather than only its records. */
export function outlineBounds(rings: readonly Ring[]): Bounds | undefined {
  if (rings.length === 0) return undefined;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  return [west, south, east, north];
}

/** The veil (the world with the place cut out) and the edge, as one collection. */
export function placeFocusCollection(rings: readonly Ring[]) {
  if (rings.length === 0) return { type: 'FeatureCollection' as const, features: [] };
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { role: 'recede' },
        geometry: { type: 'Polygon' as const, coordinates: [WORLD, ...rings] },
      },
      {
        type: 'Feature' as const,
        properties: { role: 'edge' },
        geometry: { type: 'MultiLineString' as const, coordinates: rings },
      },
    ],
  };
}

type FocusMap = {
  getSource(id: string): { setData(data: unknown): void } | undefined;
  addSource(id: string, source: unknown): void;
  getLayer(id: string): unknown;
  addLayer(layer: unknown, beforeId?: string): void;
  getPaintProperty(layer: string, name: string): unknown;
  setPaintProperty(layer: string, name: string, value: unknown): void;
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
};

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const accentColor = () => token('--ds-accent-graphic', '#c48a4a');
/** The plate's water: ink on the night atlas, stone sand on the day one. */
const veilColor = () => token('--ds-map-water', '#0a0a0a');

/** Draws the selected place's outline and veil, fading them in and out on the plate. */
export function usePlaceFocus(
  stage: MapStageHandle,
  placeKey: string | undefined,
  memberBounds: Bounds | undefined,
  counties: CountyGeometryCollection | undefined,
  reducedMotion: boolean,
  /** The plate is live (`ready`): before it, there is no map to draw on. */
  plateReady: boolean,
): Bounds | undefined {
  const [states, setStates] = useState<StatePolygonCollection | undefined>();
  useEffect(() => {
    if (!placeKey?.startsWith('state-') || states) return;
    let live = true;
    fetchStatePolygons()
      .then((loaded) => {
        if (live) setStates(loaded);
      })
      .catch(() => {
        // No outline: the place is still scoped, framed by its records.
      });
    return () => {
      live = false;
    };
  }, [placeKey, states]);

  const rings = placeKey ? placeOutline(placeKey, memberBounds, states, counties) : [];
  const ringsKey = placeKey ? `${placeKey}:${rings.length}:${memberBounds?.join(',') ?? ''}` : '';
  const ringsRef = useRef(rings);
  ringsRef.current = rings;

  useEffect(() => {
    if (!plateReady) return;
    const map = stage.getMap() as unknown as FocusMap | null;
    if (!map) return;
    const shown = ringsRef.current.length > 0;
    let clearTimer: number | undefined;

    const mount = () => {
      const data = placeFocusCollection(ringsRef.current);
      const source = map.getSource(SOURCE);
      if (!source) map.addSource(SOURCE, { type: 'geojson', data });
      else if (shown) source.setData(data);
      // Leaving a place: the veil fades back before its geometry goes.
      else clearTimer = window.setTimeout(() => map.getSource(SOURCE)?.setData(data), RESOLVE_MS);
      // Under the record marks and tokens, over every line and label of the plate.
      const before = map.getLayer(EXPLORE_JURISDICTION_AREA_LAYER_ID)
        ? EXPLORE_JURISDICTION_AREA_LAYER_ID
        : map.getLayer(EXPLORE_PLACE_LEADER_LAYER_ID)
          ? EXPLORE_PLACE_LEADER_LAYER_ID
          : undefined;
      if (!map.getLayer(RECEDE_LAYER)) {
        map.addLayer(
          {
            id: RECEDE_LAYER,
            type: 'fill',
            source: SOURCE,
            filter: ['==', ['get', 'role'], 'recede'],
            paint: {
              'fill-color': veilColor(),
              'fill-opacity': 0,
              'fill-opacity-transition': { duration: reducedMotion ? 0 : RESOLVE_MS, delay: 0 },
            },
          },
          before,
        );
      }
      if (!map.getLayer(EDGE_LAYER)) {
        map.addLayer(
          {
            id: EDGE_LAYER,
            type: 'line',
            source: SOURCE,
            filter: ['==', ['get', 'role'], 'edge'],
            layout: { 'line-join': 'round' },
            paint: {
              'line-color': accentColor(),
              'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 10, 2.5],
              'line-opacity': 0,
              'line-opacity-transition': { duration: reducedMotion ? 0 : RESOLVE_MS, delay: 0 },
            },
          },
          before,
        );
      }
      map.setPaintProperty(RECEDE_LAYER, 'fill-opacity', shown ? RECEDE_OPACITY : 0);
      map.setPaintProperty(EDGE_LAYER, 'line-opacity', shown ? 1 : 0);
    };

    // A style rebuild drops the layers, and a rebuild in flight refuses them, so mounting retries
    // whenever the map settles until they are in.
    const ensure = () => {
      try {
        if (!map.getLayer(RECEDE_LAYER) || !map.getLayer(EDGE_LAYER) || !map.getSource(SOURCE)) {
          mount();
        } else {
          // A theme switch repaints the plate under the veil: keep the veil the plate's water.
          const veil = veilColor();
          if (veil !== map.getPaintProperty(RECEDE_LAYER, 'fill-color')) {
            map.setPaintProperty(RECEDE_LAYER, 'fill-color', veil);
            map.setPaintProperty(EDGE_LAYER, 'line-color', accentColor());
          }
        }
      } catch {
        // The style is mid-rebuild; the next settle mounts it.
      }
    };
    try {
      mount();
    } catch {
      // As above: `ensure` mounts it once the style has loaded.
    }
    map.on('styledata', ensure);
    map.on('idle', ensure);
    return () => {
      map.off('styledata', ensure);
      map.off('idle', ensure);
      if (clearTimer !== undefined) window.clearTimeout(clearTimer);
    };
  }, [stage, ringsKey, reducedMotion, plateReady]);

  return outlineBounds(rings);
}
