/**
 * Padded pointer hits for Explore entity discs and clusters. National GL circles are a few
 * pixels across; MapLibre layer clicks use the painted radius, so a near-miss selected the
 * state fill underneath instead of opening the record sheet.
 */
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from '../../app/map/explore-layer-ids';

/** Search box around the click, sized for a 24px-class target around a national disc. */
export const ENTITY_POINTER_HIT_PAD_PX = 16;

/** MapLibre default is 3px; a national disc plus a slight drag was classified as pan. */
export const MAP_CLICK_TOLERANCE_PX = 12;

export const ENTITY_POINTER_HIT_LAYER_IDS = [
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
] as const;

export type EntityPointerHit =
  | { readonly kind: 'entity'; readonly entityId: string }
  | { readonly kind: 'cluster'; readonly clusterId: number; readonly sourceId: string };

export type RenderedPointerFeature = {
  readonly layerId?: string;
  readonly properties?: { readonly [key: string]: unknown } | null;
};

export function pointerHitBox(
  point: { readonly x: number; readonly y: number },
  padPx = ENTITY_POINTER_HIT_PAD_PX,
): [[number, number], [number, number]] {
  return [
    [point.x - padPx, point.y - padPx],
    [point.x + padPx, point.y + padPx],
  ];
}

export function entityIdFromProperties(properties: unknown): string | undefined {
  if (properties === null || typeof properties !== 'object') return undefined;
  const entityId = (properties as { readonly entityId?: unknown }).entityId;
  return typeof entityId === 'string' && entityId.length > 0 ? entityId : undefined;
}

export function clusterSourceIdForLayer(layerId: string): string | undefined {
  if (layerId === EXPLORE_CLUSTER_LAYER_ID || layerId === EXPLORE_CLUSTER_COUNT_LAYER_ID) {
    return EXPLORE_ENTITIES_SOURCE_ID;
  }
  if (
    layerId === EXPLORE_CLUSTER_INCOMING_LAYER_ID ||
    layerId === EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID
  ) {
    return EXPLORE_ENTITIES_INCOMING_SOURCE_ID;
  }
  return undefined;
}

function clusterIdFromProperties(
  properties: RenderedPointerFeature['properties'],
): number | undefined {
  const raw = properties?.cluster_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.length > 0) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function hasPointCount(properties: RenderedPointerFeature['properties']): boolean {
  const count = properties?.point_count;
  return typeof count === 'number' || (typeof count === 'string' && count.length > 0);
}

/**
 * Prefer a named unclustered pin when the pad covers both a disc and a cluster.
 * Cluster hits carry `cluster_id` so the map can open one leaf's record sheet.
 */
export function resolveEntityPointerHit(
  features: readonly RenderedPointerFeature[],
): EntityPointerHit | undefined {
  for (const feature of features) {
    if (hasPointCount(feature.properties)) continue;
    const entityId = entityIdFromProperties(feature.properties);
    if (entityId) return { kind: 'entity', entityId };
  }
  for (const feature of features) {
    const clusterId = clusterIdFromProperties(feature.properties);
    if (clusterId === undefined) continue;
    const sourceId = clusterSourceIdForLayer(feature.layerId ?? '');
    if (!sourceId) continue;
    return { kind: 'cluster', clusterId, sourceId };
  }
  return undefined;
}
