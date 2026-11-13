/**
 * Padded pointer hits for Explore record discs and place tokens. National GL circles are a few
 * pixels across; MapLibre layer clicks use the painted radius, so a near-miss selected the
 * state fill underneath instead of opening the record sheet.
 */
import type { PlaceLevel } from '@repo/domain/map/place-groups';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from '../../app/map/explore-layer-ids';

/** Search box around the click, sized for a 24px-class target around a national disc. */
export const ENTITY_POINTER_HIT_PAD_PX = 16;

/** MapLibre default is 3px; a national disc plus a slight drag was classified as pan. */
export const MAP_CLICK_TOLERANCE_PX = 12;

export const ENTITY_POINTER_HIT_LAYER_IDS = [
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
] as const;

export type EntityPointerHit =
  | { readonly kind: 'entity'; readonly entityId: string }
  | { readonly kind: 'overlap'; readonly entityIds: readonly string[] }
  | {
      readonly kind: 'place';
      readonly placeKey: string;
      readonly level: Exclude<PlaceLevel, 'site'>;
      /** The place's member extent `[west, south, east, north]`. */
      readonly bounds: readonly [number, number, number, number];
    };

export type RenderedPointerFeature = {
  readonly layerId?: string;
  readonly properties?: { readonly [key: string]: unknown } | null;
  readonly coordinates?: readonly number[];
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

const PLACE_LEVELS = new Set(['state', 'county', 'city']);

/** A place token's key, level and extent, when every part is well formed. */
function placeFromProperties(
  properties: RenderedPointerFeature['properties'],
): Omit<Extract<EntityPointerHit, { kind: 'place' }>, 'kind'> | undefined {
  const placeKey = properties?.placeKey;
  const level = properties?.level;
  if (typeof placeKey !== 'string' || placeKey.length === 0) return undefined;
  if (typeof level !== 'string' || !PLACE_LEVELS.has(level)) return undefined;
  const bounds = [properties?.west, properties?.south, properties?.east, properties?.north].map(
    Number,
  );
  if (!bounds.every(Number.isFinite)) return undefined;
  return {
    placeKey,
    level: level as Exclude<PlaceLevel, 'site'>,
    bounds: bounds as unknown as readonly [number, number, number, number],
  };
}

function hasPointCount(properties: RenderedPointerFeature['properties']): boolean {
  const count = properties?.point_count;
  return typeof count === 'number' || (typeof count === 'string' && count.length > 0);
}

/**
 * Prefer a named record disc when the pad covers both a disc and a place token.
 * Token hits carry the place key and extent for the drill-in.
 */
export function resolveEntityPointerHit(
  features: readonly RenderedPointerFeature[],
): EntityPointerHit | undefined {
  const entityIds = [
    ...new Set(
      features.flatMap((feature) => {
        if (hasPointCount(feature.properties)) return [];
        const entityId = entityIdFromProperties(feature.properties);
        return entityId ? [entityId] : [];
      }),
    ),
  ];
  if (entityIds.length > 1) return { kind: 'overlap', entityIds };
  if (entityIds[0]) return { kind: 'entity', entityId: entityIds[0] };
  for (const feature of features) {
    if (!hasPointCount(feature.properties)) continue;
    const place = placeFromProperties(feature.properties);
    if (place) return { kind: 'place', ...place };
  }
  return undefined;
}
