/**
 * Pointer and camera listeners for the persistent plate.
 *
 * Everything here takes the live map and its callbacks as explicit arguments rather than reading
 * provider refs, the same shape `camera.ts` uses. The stage owns the refs; this module owns the
 * handlers and the order they go on in.
 *
 * One click reaches several of them: the state fill, the relationship line, and the bare plate
 * all listen, alongside the entity pins. What keeps them from all answering is the padded
 * entity/cluster hit test — each handler below stands down when it reports a hit, so a pin wins
 * over the polygon beneath it — plus the background handler's own query, which fires `activate`
 * only when no fill or line was under the pointer either.
 *
 * The hit test itself stays in `MapStage.tsx`, next to the cluster expansion it feeds.
 */
import type { Map as MapLibreMap, MapLayerMouseEvent, MapMouseEvent } from 'maplibre-gl';
import {
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import type { EntityPointerHit } from '../../lib/map-experience/entity-pointer-hit';
import type { ExploreViewportFrame } from '../../lib/map-experience/url-state';
import { readViewport } from './viewport-geometry';

/**
 * The padded entity/cluster hit test. A defined result means the pin path owns this pointer, so
 * the state, relationship-line, and background handlers all stand down.
 */
export type EntityPointerProbe = (point: {
  readonly x: number;
  readonly y: number;
}) => EntityPointerHit | undefined;

export type PlateClickWiring = {
  readonly pointerHitAt: EntityPointerProbe;
  /** Entity and cluster clicks. Registered between the layer handlers and the background one. */
  readonly onEntityPointerClick: (event: MapMouseEvent) => void;
  readonly onStateSelect: (postalCode: string) => void;
  readonly onEdgeSelect: (edgeId: string) => void;
  /** Nothing on the plate was hit — the surface decides what an empty click means. */
  readonly onActivate: (viewport: ExploreViewportFrame) => void;
};

export type PlateCameraWiring = {
  /** The settled camera frame, after any move. */
  readonly publishViewport: (viewport: ExploreViewportFrame) => void;
  /** State-label opacity tracks zoom, so a flight that ends re-syncs it against where it landed. */
  readonly applyZoomOpacity: (zoom: number) => void;
  /** The camera has stopped zooming: remount DOM discs, fetch polygons for the new detail. */
  readonly onZoomSettled: () => void;
  /**
   * Live bearing, on every rotate frame rather than once the gesture settles — the compass
   * needle (`CameraConsole`) tracks a drag or twist while it is happening, and the settled
   * viewport frame arrives too late for that.
   */
  readonly publishBearing: (bearing: number) => void;
};

/** Pointer affordance for a layer whose features answer a click. */
function bindLayerHoverCursor(map: MapLibreMap, layerId: string): void {
  map.on('mouseenter', layerId, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', layerId, () => {
    map.getCanvas().style.cursor = '';
  });
}

/**
 * Binds the click handlers that turn a pointer into a selection. Call once the style has loaded:
 * each layer binding is conditional on the layer existing, and a plate built for a surface that
 * never turns on presence fills or relationship lines simply gets fewer of them.
 */
export function bindPlateClickListeners(map: MapLibreMap, wiring: PlateClickWiring): void {
  function handleStateClick(event: MapLayerMouseEvent) {
    if (wiring.pointerHitAt(event.point)) return;
    const postal = event.features?.[0]?.properties?.postalCode;
    if (typeof postal === 'string' && postal.length > 0) {
      wiring.onStateSelect(postal);
    }
  }

  function handleEdgeClick(event: MapLayerMouseEvent) {
    if (wiring.pointerHitAt(event.point)) return;
    const edgeId = event.features?.[0]?.properties?.edgeId;
    if (typeof edgeId === 'string' && edgeId.length > 0) {
      wiring.onEdgeSelect(edgeId);
    }
  }

  function handleBackgroundClick(event: MapMouseEvent) {
    if (wiring.pointerHitAt(event.point)) return;
    const hitLayers = [
      EXPLORE_STATE_DENSITY_LAYER_ID,
      EXPLORE_HISTORY_EDGES_LAYER_ID,
      EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
    ].filter((id) => map.getLayer(id));
    const hits = hitLayers.length
      ? map.queryRenderedFeatures(event.point, { layers: hitLayers })
      : [];
    if (hits.length > 0) return;
    wiring.onActivate(readViewport(map));
  }

  if (map.getLayer(EXPLORE_STATE_DENSITY_LAYER_ID)) {
    map.on('click', EXPLORE_STATE_DENSITY_LAYER_ID, handleStateClick);
    bindLayerHoverCursor(map, EXPLORE_STATE_DENSITY_LAYER_ID);
  }
  if (map.getLayer(EXPLORE_HISTORY_EDGES_LAYER_ID)) {
    map.on('click', EXPLORE_HISTORY_EDGES_LAYER_ID, handleEdgeClick);
    bindLayerHoverCursor(map, EXPLORE_HISTORY_EDGES_LAYER_ID);
  }
  map.on('click', wiring.onEntityPointerClick);
  map.on('click', handleBackgroundClick);
}

/**
 * Binds the listeners that follow the camera. Safe to call before `load` — none of these touch
 * layers, and the stage publishes camera frames from the moment the map exists.
 */
export function bindPlateCameraListeners(map: MapLibreMap, wiring: PlateCameraWiring): void {
  map.on('moveend', () => {
    wiring.publishViewport(readViewport(map));
    wiring.applyZoomOpacity(map.getZoom());
  });
  map.on('zoomend', () => {
    wiring.onZoomSettled();
  });
  map.on('rotate', () => {
    wiring.publishBearing(map.getBearing());
  });
}
