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
      /** The first zoom its records draw finer than the place; a tap lands no shallower. */
      readonly openZoom?: number;
    };

export type RenderedPointerFeature = {
  readonly layerId?: string;
  readonly properties?: { readonly [key: string]: unknown } | null;
  /** Screen distance from the pointer to a point feature's center. */
  readonly offsetPx?: number;
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

const PLACE_LEVELS = new Set(['state', 'county', 'city', 'square']);

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
  const openZoom = Number(properties?.openZoom);
  return {
    placeKey,
    level: level as Exclude<PlaceLevel, 'site'>,
    bounds: bounds as unknown as readonly [number, number, number, number],
    ...(Number.isFinite(openZoom) && properties?.openZoom !== undefined ? { openZoom } : {}),
  };
}

function hasPointCount(properties: RenderedPointerFeature['properties']): boolean {
  const count = properties?.point_count;
  return typeof count === 'number' || (typeof count === 'string' && count.length > 0);
}

/** Inside a drawn disc: the area ring's radius (7px) plus its keyline. */
export const ENTITY_UNDER_POINTER_PX = 9;
/** Two discs whose centers are this close to the same distance are stacked, not one over another. */
const STACKED_PX = 3;

/**
 * The records whose discs are under the pointer: one when one clearly is, several when they are
 * stacked (many records share a city's center). At national zoom the padded box nearly always
 * holds several discs, so without this a click squarely on one disc asked "which one?" about
 * every neighbor in the box.
 */
function discsUnderPointer(features: readonly RenderedPointerFeature[]): readonly string[] {
  const under = features
    .flatMap((feature) => {
      const entityId = entityIdFromProperties(feature.properties);
      const offset = feature.offsetPx;
      if (!entityId || hasPointCount(feature.properties) || offset === undefined) return [];
      return offset <= ENTITY_UNDER_POINTER_PX ? [{ entityId, offset }] : [];
    })
    .sort((a, b) => a.offset - b.offset);
  const nearest = under[0];
  if (!nearest) return [];
  return [
    ...new Set(
      under.filter((disc) => disc.offset - nearest.offset < STACKED_PX).map((d) => d.entityId),
    ),
  ];
}

/**
 * The disc under the pointer wins, and stacked discs under it ask among themselves. Otherwise prefer a named record disc when the pad covers both
 * a disc and a place token, and ask when it covers several. Token hits carry the place key and
 * extent for the drill-in.
 */
export function resolveEntityPointerHit(
  features: readonly RenderedPointerFeature[],
): EntityPointerHit | undefined {
  const under = discsUnderPointer(features);
  if (under.length > 1) return { kind: 'overlap', entityIds: under };
  if (under[0]) return { kind: 'entity', entityId: under[0] };
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
