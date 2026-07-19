/**
 * Deterministic atmosphere-plane selection for story (and future entity) masts.
 * Always returns a flat geometric SVG plate — seed-stable plane id and pattern pick.
 */
import { hashString } from './hash';
import {
  GEOMETRIC_FALLBACKS,
  geometricFallbackById,
  type GeometricFallback,
  type GeometricFallbackId,
} from './geometric-fallbacks';

export type AtmosphereDensity = 12 | 16;

export type AtmospherePlaneSelectionInput = {
  readonly seedKey: string;
  readonly relatedEntityIds?: readonly string[];
  readonly density?: AtmosphereDensity;
  /** Ignored — geometric is the only mode; kept for caller compatibility. */
  readonly preferGeometric?: boolean;
};

export type AtmospherePlaneSelection = {
  readonly mode: 'geometric';
  readonly planeId: string;
  readonly tiles: readonly [];
  readonly geometric: GeometricFallback;
};

export function selectAtmospherePlane(
  input: AtmospherePlaneSelectionInput,
): AtmospherePlaneSelection {
  const geometric = pickGeometric(input.seedKey);
  const planeId = `atm-${hashString(input.seedKey).toString(16)}`;

  return {
    mode: 'geometric',
    planeId,
    tiles: [],
    geometric,
  };
}

function pickGeometric(seedKey: string): GeometricFallback {
  const index = hashString(`geometric:${seedKey}`) % GEOMETRIC_FALLBACKS.length;
  const id = GEOMETRIC_FALLBACKS[index]!.id as GeometricFallbackId;
  return geometricFallbackById(id);
}
