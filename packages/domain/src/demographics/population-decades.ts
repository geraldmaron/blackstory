/**
 * The single source of truth for the decades the population platform covers, 1790–2020.
 *
 * Before this module the decade list `['2000','2010','2020']` was duplicated across at least
 * nine sites (the county Firestore schema regex, the national-stats aggregation loops, the
 * census url-builder, the static county index JSON, and the `CENSUS_POPULATION_DECADES` map
 * constant). Adding a decade meant editing every copy. This registry replaces that: every
 * consumer derives its decade domain from here.
 *
 * IMPORTANT — this module holds decade METADATA only (source lane, comparability band,
 * whether the Black count carries a free/enslaved split, whether the decade opens a
 * measurement-regime boundary). It never holds a population NUMBER: counts come exclusively
 * from parsed, provenance-carrying source artifacts (twps0056 for 1790–1990, api.census.gov
 * county sums for 2000–2020) so that no historical figure originates in application code.
 */
import type { DecadeComparabilityBand } from './comparability.js';
import { getDecadeRaceCategoryBand } from './comparability.js';

/** A decennial census year, as a string label, 1790 through 2020 (the platform's grammar). */
export type PopulationDecade =
  | '1790'
  | '1800'
  | '1810'
  | '1820'
  | '1830'
  | '1840'
  | '1850'
  | '1860'
  | '1870'
  | '1880'
  | '1890'
  | '1900'
  | '1910'
  | '1920'
  | '1930'
  | '1940'
  | '1950'
  | '1960'
  | '1970'
  | '1980'
  | '1990'
  | '2000'
  | '2010'
  | '2020';

/**
 * Which canonical dataset provides the *national* number for a decade.
 *  - `twps0056`: Census Bureau working paper 56 (Gibson & Jung 2002), national race totals
 *    1790–1990, public domain — the historical lane.
 *  - `census-county-sum`: national total obtained by summing the modern `censusCountyDecades`
 *    county observations (api.census.gov decennial SF1/PL), 2000–2020 — the modern lane.
 *
 * The two lanes cover disjoint years (twps0056 ends 1990, county-sum begins 2000), so a
 * merged national timeline never double-counts a decade and never has to reconcile two
 * conflicting national values for the same year.
 */
export type NationalPopulationSource = 'twps0056' | 'census-county-sum';

/** Per-decade metadata. No population counts — see module doc. */
export type PopulationDecadeMeta = {
  readonly decade: PopulationDecade;
  readonly year: number;
  readonly nationalSource: NationalPopulationSource;
  readonly band: DecadeComparabilityBand;
  /**
   * True for 1790–1860, when the decennial Black population was tabulated as a free count plus
   * an enslaved count (twps0056 Table 1 splits the Black column into Free/Slave for these
   * decades). False from 1870 on: emancipation ended the legal category, so the Black total is
   * a single number with no free/enslaved sub-series.
   */
  readonly hasFreeEnslavedSplit: boolean;
  /**
   * True when the Black *total* series crosses a measurement-regime change entering this decade
   * — a boundary the UI must visually break and adjacent-decade change must flag as not
   * cleanly comparable. Only 2000 qualifies: it introduced the multiple-race methodology and
   * the "Black or African American alone" one-race category, a different concept from the
   * historical single-race "Negro"/"Black" enumerations. Emancipation (1870) is NOT a
   * boundary for the Black total — the total Black count is continuous 1860→1870; only the
   * free/enslaved sub-series ends. See `southernUndercountCaveat` for 1870.
   */
  readonly opensDefinitionBoundary: boolean;
  /**
   * True for 1870: the original 1870 enumeration is documented by the Census Bureau to have
   * undercounted the Black population of the South (partial re-enumeration followed). Surfaced
   * as a per-decade caveat, not a line break.
   */
  readonly southernUndercountCaveat: boolean;
};

function bandFor(decade: PopulationDecade): DecadeComparabilityBand {
  const band = getDecadeRaceCategoryBand(decade)?.band;
  if (!band) {
    // Every PopulationDecade is covered by DECADE_RACE_CATEGORY_BANDS; a miss is a wiring bug.
    throw new Error(`No comparability band registered for decade ${decade}`);
  }
  return band;
}

const HISTORICAL_TWPS0056_END: PopulationDecade = '1990';
const FREE_ENSLAVED_SPLIT_END: PopulationDecade = '1860';

function metaFor(year: number): PopulationDecadeMeta {
  const decade = String(year) as PopulationDecade;
  return {
    decade,
    year,
    nationalSource: year <= Number(HISTORICAL_TWPS0056_END) ? 'twps0056' : 'census-county-sum',
    band: bandFor(decade),
    hasFreeEnslavedSplit: year <= Number(FREE_ENSLAVED_SPLIT_END),
    opensDefinitionBoundary: year === 2000,
    southernUndercountCaveat: year === 1870,
  };
}

/** Every decade the platform covers, 1790–2020, in ascending order. */
export const POPULATION_DECADE_METAS: readonly PopulationDecadeMeta[] = Array.from(
  { length: (2020 - 1790) / 10 + 1 },
  (_unused, index) => metaFor(1790 + index * 10),
);

/** Just the decade labels, ascending — the canonical ordered list every consumer derives from. */
export const POPULATION_DECADES: readonly PopulationDecade[] = POPULATION_DECADE_METAS.map(
  (meta) => meta.decade,
);

/** Historical national lane: decades whose national number comes from twps0056 (1790–1990). */
export const HISTORICAL_NATIONAL_DECADES: readonly PopulationDecade[] =
  POPULATION_DECADE_METAS.filter((meta) => meta.nationalSource === 'twps0056').map(
    (meta) => meta.decade,
  );

/** Modern county lane: decades served by the `censusCountyDecades` collection (2000–2020). */
export const MODERN_COUNTY_DECADES: readonly PopulationDecade[] = POPULATION_DECADE_METAS.filter(
  (meta) => meta.nationalSource === 'census-county-sum',
).map((meta) => meta.decade);

/** Decades whose Black count carries a free/enslaved split (1790–1860). */
export const FREE_ENSLAVED_SPLIT_DECADES: readonly PopulationDecade[] =
  POPULATION_DECADE_METAS.filter((meta) => meta.hasFreeEnslavedSplit).map((meta) => meta.decade);

const META_BY_DECADE: ReadonlyMap<string, PopulationDecadeMeta> = new Map(
  POPULATION_DECADE_METAS.map((meta) => [meta.decade, meta]),
);

export function isPopulationDecade(value: string): value is PopulationDecade {
  return META_BY_DECADE.has(value);
}

export function getPopulationDecadeMeta(decade: string): PopulationDecadeMeta | undefined {
  return META_BY_DECADE.get(decade);
}

/**
 * Whether adjacent-decade change from `fromDecade` to `toDecade` crosses a measurement-regime
 * boundary and must therefore be presented as not-cleanly-comparable (the 1990→2000 historical
 * race → "Black alone" transition). Returns `false` for non-adjacent or unknown decades — this
 * is a comparability flag for a change record, not a validity check on the decades themselves.
 */
export function changeCrossesDefinitionBoundary(fromDecade: string, toDecade: string): boolean {
  const to = META_BY_DECADE.get(toDecade);
  const from = META_BY_DECADE.get(fromDecade);
  if (!to || !from) return false;
  return to.opensDefinitionBoundary && to.year === from.year + 10;
}
