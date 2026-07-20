/**
 * Explore population layer helpers: state vs county geography, decade validation against
 * the platform registry (1790–2020 state, 2000–2020 county), and honest comparability labels.
 */
import {
  CENSUS_POPULATION_DECADES,
  DEFAULT_POPULATION_CHANGE_FROM,
  DEFAULT_POPULATION_CHANGE_TO,
  DEFAULT_POPULATION_DECADE,
  isCensusPopulationDecade,
  type CensusPopulationDecade,
} from '@repo/domain/map/county-population';
import {
  changeCrossesDefinitionBoundary,
  getPopulationDecadeMeta,
  isPopulationDecade,
  POPULATION_DECADES,
  type PopulationDecade,
} from '@repo/domain/demographics/population-decades';

export type ExplorePopulationGeo = 'state' | 'county';

export const DEFAULT_POPULATION_GEO: ExplorePopulationGeo = 'county';

export type ExplorePopulationDecade = PopulationDecade;

export function isExplorePopulationGeo(raw: string | undefined): raw is ExplorePopulationGeo {
  return raw === 'state' || raw === 'county';
}

/** Decades exposed in the layer picker for the selected geography. */
export function populationDecadesForGeo(
  geo: ExplorePopulationGeo,
): readonly (PopulationDecade | CensusPopulationDecade)[] {
  return geo === 'county' ? CENSUS_POPULATION_DECADES : POPULATION_DECADES;
}

export function parseExplorePopulationGeo(
  raw: string | undefined,
  fallback: ExplorePopulationGeo = DEFAULT_POPULATION_GEO,
): ExplorePopulationGeo {
  const trimmed = raw?.trim();
  return trimmed && isExplorePopulationGeo(trimmed) ? trimmed : fallback;
}

export function parseExplorePopulationDecade(
  raw: string | undefined,
  geo: ExplorePopulationGeo,
  fallback: string,
): string {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  if (geo === 'county') {
    return isCensusPopulationDecade(trimmed) ? trimmed : fallback;
  }
  return isPopulationDecade(trimmed) ? trimmed : fallback;
}

/** County choropleths only exist for modern FIPS vintages — coerce geo when URL asks otherwise. */
export function coercePopulationGeoForDecade(
  geo: ExplorePopulationGeo,
  decade: string,
): ExplorePopulationGeo {
  if (geo === 'county' && !isCensusPopulationDecade(decade)) {
    return 'state';
  }
  return geo;
}

export function defaultPopulationDecade(geo: ExplorePopulationGeo): string {
  return geo === 'county' ? DEFAULT_POPULATION_DECADE : DEFAULT_POPULATION_DECADE;
}

export function defaultPopulationChangeFrom(geo: ExplorePopulationGeo): string {
  return geo === 'county' ? DEFAULT_POPULATION_CHANGE_FROM : '1990';
}

export function defaultPopulationChangeTo(geo: ExplorePopulationGeo): string {
  return geo === 'county' ? DEFAULT_POPULATION_CHANGE_TO : DEFAULT_POPULATION_DECADE;
}

/** Short honesty note for a selected vintage (measurement regime, coverage caveats). */
export function populationDecadeComparabilityNote(decade: string): string | undefined {
  const meta = getPopulationDecadeMeta(decade);
  if (!meta) return undefined;
  if (meta.hasFreeEnslavedSplit) {
    return '1790–1860: Black totals combine free and enslaved counts — not comparable to post-emancipation share tiers alone.';
  }
  if (meta.southernUndercountCaveat) {
    return '1870: documented Southern undercount — treat shares as lower bounds, not exact.';
  }
  if (meta.opensDefinitionBoundary) {
    return '2000: opens the “Black alone” category — not directly comparable to pre-2000 race definitions.';
  }
  return undefined;
}

/** Warning when a change pair crosses a measurement-regime boundary (e.g. 1990→2000). */
export function populationChangeComparabilityNote(
  fromDecade: string,
  toDecade: string,
): string | undefined {
  if (changeCrossesDefinitionBoundary(fromDecade, toDecade)) {
    return 'Change across 2000 crosses a measurement-regime boundary — treat as indicative, not a clean comparison.';
  }
  return undefined;
}
