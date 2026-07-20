/**
 * Joins population choropleth tiers onto the vendored US state polygon FeatureCollection
 * so MapLibre fill paint can style share/change at state granularity for historical decades.
 */
import type { StateChoroplethLevel } from './state-choropleth';

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

export function joinPopulationOntoStatePolygons(
  collection: LooseFeatureCollection,
  levels: readonly StateChoroplethLevel[],
): LooseFeatureCollection {
  const byFips = new Map(levels.map((level) => [level.stateFips, level] as const));
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const fips = String(feature.properties.fips ?? feature.id ?? '').padStart(2, '0');
      const level = byFips.get(fips);
      return {
        ...feature,
        id: fips,
        properties: {
          ...feature.properties,
          fips,
          shareTier: level?.shareTier ?? 'unknown',
          changeTier: level?.changeTier ?? 'unknown',
          ...(level?.sharePercent !== undefined ? { sharePercent: level.sharePercent } : {}),
          ...(level?.shareDeltaPp !== undefined ? { shareDeltaPp: level.shareDeltaPp } : {}),
        },
      };
    }),
  };
}
