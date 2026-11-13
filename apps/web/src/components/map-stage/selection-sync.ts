import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import {
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_JURISDICTION_TAG_LAYER_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_SELECTED_TAG_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import {
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
export function setSelectedEntityFilter(map: MapLibreMap, entityId: string | undefined): void {
  if (map.getLayer(EXPLORE_SELECTED_POINT_LAYER_ID)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
    map.setFilter(EXPLORE_SELECTED_POINT_LAYER_ID, selectedPointFilterExpression(entityId) as any);
  }
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
