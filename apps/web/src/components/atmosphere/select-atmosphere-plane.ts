/**
 * Deterministic atmosphere-plane selection for story (and future entity) masts.
 *
 * Mosaic tiles come from the rights-cleared collage pool. Related entity ids are preferred
 * when present in the pool, then the rotated window fills remaining slots. Geometric mode
 * is used when the caller forces a fallback (tests, Save-Data, reduced motion).
 */
import { hashString } from './hash';
import {
  GEOMETRIC_FALLBACKS,
  geometricFallbackById,
  type GeometricFallback,
  type GeometricFallbackId,
} from './geometric-fallbacks';
import {
  ATMOSPHERE_ATTRIBUTION_HREF,
  ATMOSPHERE_TILE_CREDITS,
  type AtmosphereTileCredit,
} from './tile-credits';

export type AtmosphereDensity = 12 | 16 | 24 | 32 | 48;

export type AtmospherePlaneSelectionInput = {
  readonly seedKey: string;
  readonly relatedEntityIds?: readonly string[];
  readonly density?: AtmosphereDensity;
  /** Force geometric plane (failed tiles, reduced motion, Save-Data). */
  readonly preferGeometric?: boolean;
};

export type AtmospherePlaneSelection = {
  readonly mode: 'mosaic' | 'geometric';
  readonly planeId: string;
  readonly tiles: readonly AtmosphereTileCredit[];
  readonly geometric: GeometricFallback;
  readonly attributionHref: string;
};

const DEFAULT_DENSITY: AtmosphereDensity = 16;

export function selectAtmospherePlane(
  input: AtmospherePlaneSelectionInput,
): AtmospherePlaneSelection {
  const density = input.density ?? DEFAULT_DENSITY;
  const geometric = pickGeometric(input.seedKey);
  const planeId = `atm-${hashString(input.seedKey).toString(16)}`;

  if (input.preferGeometric) {
    return {
      mode: 'geometric',
      planeId,
      tiles: [],
      geometric,
      attributionHref: ATMOSPHERE_ATTRIBUTION_HREF,
    };
  }

  const tiles = selectMosaicTiles(input.seedKey, density, input.relatedEntityIds);
  return {
    mode: 'mosaic',
    planeId,
    tiles,
    geometric,
    attributionHref: ATMOSPHERE_ATTRIBUTION_HREF,
  };
}

function pickGeometric(seedKey: string): GeometricFallback {
  const index = hashString(`geometric:${seedKey}`) % GEOMETRIC_FALLBACKS.length;
  const id = GEOMETRIC_FALLBACKS[index]!.id as GeometricFallbackId;
  return geometricFallbackById(id);
}

/**
 * Prefer tiles whose entityId intersects relatedEntityIds, then fill from a
 * seed-stable rotation of the full pool (no duplicates).
 */
export function selectMosaicTiles(
  seedKey: string,
  density: AtmosphereDensity,
  relatedEntityIds?: readonly string[],
): readonly AtmosphereTileCredit[] {
  const out: AtmosphereTileCredit[] = [];
  const seen = new Set<string>();

  for (const entityId of relatedEntityIds ?? []) {
    if (out.length >= density) break;
    const tile = ATMOSPHERE_TILE_CREDITS.find((entry) => entry.entityId === entityId);
    if (!tile || seen.has(tile.path)) continue;
    seen.add(tile.path);
    out.push(tile);
  }

  const start = hashString(`tiles:${seedKey}`) % ATMOSPHERE_TILE_CREDITS.length;
  for (let offset = 0; offset < ATMOSPHERE_TILE_CREDITS.length && out.length < density; offset += 1) {
    const tile = ATMOSPHERE_TILE_CREDITS[(start + offset) % ATMOSPHERE_TILE_CREDITS.length]!;
    if (seen.has(tile.path)) continue;
    seen.add(tile.path);
    out.push(tile);
  }

  return out;
}
