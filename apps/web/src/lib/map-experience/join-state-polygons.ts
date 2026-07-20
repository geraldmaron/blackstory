/**
 * Joins presence/density tiers onto the vendored US state polygon FeatureCollection
 * so MapLibre fill paint can style “documented → emerging → concentrated” without
 * shipping rectangle bboxes. Each feature carries a stable `id` (FIPS) for
 * `setFeatureState` decade color morphs and a denormalized `fillColor` hex/rgba.
 */
import { plateForScheme, resolveDensityFillColor, type MapColorScheme } from './dignity-style';
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

export type JoinStatePolygonsOptions = {
  readonly colorScheme?: MapColorScheme;
};

export function joinDensityOntoStatePolygons(
  collection: LooseFeatureCollection,
  densityLevels: readonly StateDensityLevel[],
  options?: JoinStatePolygonsOptions,
): LooseFeatureCollection {
  const plate = plateForScheme(options?.colorScheme ?? 'dark');
  const byFips = new Map(densityLevels.map((level) => [level.stateFips, level] as const));
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const fips = String(feature.properties.fips ?? feature.id ?? '');
      const density = byFips.get(fips);
      const densityTier = density && density.count > 0 ? density.tier : 'none';
      const fillColor = resolveDensityFillColor(densityTier, plate);
      return {
        ...feature,
        id: fips,
        properties: {
          ...feature.properties,
          densityTier,
          fillColor,
          count: density?.count ?? 0,
        },
      };
    }),
  };
}

/** Map FIPS → settled fillColor after a join/setData (decade morph colorA source). */
export function indexDensityFillColors(
  collection: LooseFeatureCollection,
): Map<string, string> {
  const byFips = new Map<string, string>();
  for (const feature of collection.features) {
    const fips = String(feature.properties.fips ?? feature.id ?? '');
    if (!fips) continue;
    byFips.set(fips, String(feature.properties.fillColor ?? ''));
  }
  return byFips;
}
