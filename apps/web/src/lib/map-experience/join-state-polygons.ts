/**
 * Joins presence/density tiers onto the vendored US state polygon FeatureCollection
 * so MapLibre fill paint can style “documented / emerging / concentrated” without
 * shipping rectangle bboxes.
 */
import type { StateDensityLevel } from './density';

type LooseFeature = {
  type: string;
  id?: string;
  properties: Record<string, unknown>;
  geometry: unknown;
};

type LooseFeatureCollection = {
  type: 'FeatureCollection';
  features: LooseFeature[];
};

export function joinDensityOntoStatePolygons(
  collection: LooseFeatureCollection,
  densityLevels: readonly StateDensityLevel[],
): LooseFeatureCollection {
  const byFips = new Map(densityLevels.map((level) => [level.stateFips, level] as const));
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const fips = String(feature.properties.fips ?? feature.id ?? '');
      const density = byFips.get(fips);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          densityTier: density && density.count > 0 ? density.tier : 'none',
          count: density?.count ?? 0,
        },
      };
    }),
  };
}
