/**
 * Joins population choropleth tiers onto the vendored US county polygon FeatureCollection
 * so MapLibre fill paint can style share/change without shipping counts in GeoJSON URLs.
 */
import type { CountyChoroplethLevel } from './county-choropleth';
import { fips5FromCountyProperties } from './county-choropleth';

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

export function joinPopulationOntoCountyPolygons(
  collection: LooseFeatureCollection,
  levels: readonly CountyChoroplethLevel[],
): LooseFeatureCollection {
  const byFips = new Map(levels.map((level) => [level.fips5, level] as const));
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const fips5 = fips5FromCountyProperties(feature.properties);
      const level = byFips.get(fips5);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          fips5,
          shareTier: level?.shareTier ?? 'unknown',
          changeTier: level?.changeTier ?? 'unknown',
          ...(level?.sharePercent !== undefined ? { sharePercent: level.sharePercent } : {}),
          ...(level?.shareDeltaPp !== undefined ? { shareDeltaPp: level.shareDeltaPp } : {}),
        },
      };
    }),
  };
}
