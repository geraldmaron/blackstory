import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import {
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_HOVER_POINT_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_JURISDICTION_TAG_LAYER_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_SELECTED_TAG_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import {
  markRadiusExpression,
  SELECTED_SCALE,
  selectedPointFilterExpression,
  selectedTagFilterExpression,
  unselectedTagFilterExpression,
} from '../../app/map/explore-style';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';

/**
 * Selects/deselects through the two selection layers only (`setFilter` on the selected mark and
 * the selected jurisdiction tag) — never a re-filter or `setData` on the main entities source,
 * so neighboring marks never repaint. A county- or state-precision record has no mark; its
 * state's tag turns copper instead.
 */
let lastSelected: string | undefined;

export function setSelectedEntityFilter(map: MapLibreMap, entityId: string | undefined): void {
  if (map.getLayer(EXPLORE_SELECTED_POINT_LAYER_ID)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
    map.setFilter(EXPLORE_SELECTED_POINT_LAYER_ID, selectedPointFilterExpression(entityId) as any);
    if (entityId && entityId !== lastSelected) growSelectedPin(map);
  }
  lastSelected = entityId;
  if (map.getLayer(EXPLORE_SELECTED_TAG_LAYER_ID)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
    map.setFilter(EXPLORE_SELECTED_TAG_LAYER_ID, selectedTagFilterExpression(entityId) as any);
  }
  if (map.getLayer(EXPLORE_JURISDICTION_TAG_LAYER_ID)) {
    const unselected = unselectedTagFilterExpression(entityId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
    map.setFilter(EXPLORE_JURISDICTION_TAG_LAYER_ID, unselected as any);
  }
}
/**
 * The selected pin grows from its resting size to 1.6x over 200ms (ease-out, MapLibre's paint
 * transition). Under reduced motion it is simply drawn at 1.6x.
 */
function growSelectedPin(map: MapLibreMap): void {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  if (reduced) return;
  map.setPaintProperty(EXPLORE_SELECTED_POINT_LAYER_ID, 'circle-radius-transition', {
    duration: 0,
  });
  map.setPaintProperty(EXPLORE_SELECTED_POINT_LAYER_ID, 'circle-radius', markRadiusExpression());
  requestAnimationFrame(() => {
    if (!map.getLayer(EXPLORE_SELECTED_POINT_LAYER_ID)) return;
    map.setPaintProperty(EXPLORE_SELECTED_POINT_LAYER_ID, 'circle-radius-transition', {
      duration: 200,
    });
    map.setPaintProperty(
      EXPLORE_SELECTED_POINT_LAYER_ID,
      'circle-radius',
      markRadiusExpression(SELECTED_SCALE),
    );
  });
}

/** How far an arriving pin drops from, and how long it takes (the decade fade, 400ms). */
export const PIN_DROP_PX = 10;
export const PIN_DROP_MS = 400;

/**
 * Pins entering a brushed decade range drop onto the chart: the incoming buffer starts 10px high
 * and settles as it fades in. One move for the arriving set (MapLibre paints a layer, not a
 * feature, so there is no per-pin stagger). Only the morph path calls this, and it never runs
 * under reduced motion.
 */
export function dropInIncomingPins(map: MapLibreMap): void {
  const targets: Array<[string, [number, number]]> = [
    [EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID, [0, 0]],
  ];
  for (const [id, rest] of targets) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, 'circle-translate-transition', { duration: 0 });
    map.setPaintProperty(id, 'circle-translate', [rest[0], rest[1] - PIN_DROP_PX]);
  }
  requestAnimationFrame(() => {
    for (const [id, rest] of targets) {
      if (!map.getLayer(id)) continue;
      map.setPaintProperty(id, 'circle-translate-transition', { duration: PIN_DROP_MS });
      map.setPaintProperty(id, 'circle-translate', rest);
    }
  });
}

/** The hovered pin lifts 2px; `undefined` clears it. */
export function setHoveredEntityFilter(map: MapLibreMap, entityId: string | undefined): void {
  const filter = selectedPointFilterExpression(entityId);
  if (map.getLayer(EXPLORE_HOVER_POINT_LAYER_ID)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
    map.setFilter(EXPLORE_HOVER_POINT_LAYER_ID, filter as any);
  }
}

export function setHistoryEdgeData(map: MapLibreMap, collection: HistoryEdgeLineCollection): void {
  const source = map.getSource(EXPLORE_HISTORY_EDGES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
  source.setData(collection as any);
}
export function setSelectedEdgeFilter(map: MapLibreMap, edgeId: string | undefined): void {
  const filter =
    edgeId && edgeId.length > 0
      ? (['==', ['get', 'edgeId'], edgeId] as unknown as [string, ...unknown[]])
      : (['==', ['get', 'edgeId'], ''] as unknown as [string, ...unknown[]]);
  if (map.getLayer(EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
    map.setFilter(EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID, filter as any);
  }
}
export function setHistoryEdgesVisibility(map: MapLibreMap, enabled: boolean): void {
  const visibility = enabled ? 'visible' : 'none';
  for (const id of [
    EXPLORE_HISTORY_EDGES_LAYER_ID,
    EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
    EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  ]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visibility);
    }
  }
}
