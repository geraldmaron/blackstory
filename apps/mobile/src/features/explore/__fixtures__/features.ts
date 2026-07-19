/**
 * Small, explicit fixtures for the Explore pure-module tests (MOB-012).
 * Coordinates mirror the redacted 2-decimal precision the artifact ships at.
 */
import type { LngLat } from '@/features/map/mapCamera';
import type { ExploreFeature } from '../explore-feature';

export function makeFeature(
  id: string,
  coordinates: LngLat,
  overrides: Partial<Omit<ExploreFeature, 'id' | 'coordinates'>> = {},
): ExploreFeature {
  return {
    type: 'Feature',
    id,
    entityId: overrides.entityId ?? id,
    label: overrides.label ?? id,
    kind: overrides.kind ?? 'place',
    coordinates,
    properties: {
      entityId: overrides.entityId ?? id,
      kind: overrides.kind ?? 'place',
      displayName: overrides.label ?? id,
      precision: 'city',
      ...overrides.properties,
    },
  };
}

/** Three well-separated, 2-decimal-precision points (DC, Houston, LA-ish). */
export const SEPARATED: ExploreFeature[] = [
  makeFeature('a', [-77.04, 38.9], { label: 'Alpha', kind: 'place' }),
  makeFeature('b', [-95.37, 29.76], { label: 'Bravo', kind: 'school' }),
  makeFeature('c', [-118.24, 34.05], { label: 'Charlie', kind: 'place' }),
];
