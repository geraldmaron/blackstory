/**
 * US Census Bureau data API (api.census.gov) — decennial county race tables. Companion to
 * `../census-geo/` (coordinate geocoding); this adapter is DEMOGRAPHICS: total + Black
 * population per county per decennial vintage. Numeric counts are permitted public data under
 * the published-government-statistics carve-out (`../../public-numeric-policy.ts`, category 3)
 * — every parsed row therefore travels with the vintage's source metadata so the writer can
 * satisfy `assertPublishedStatisticProvenance`.
 *
 * Vintage variable ids drift across datasets (2000/2010 SF1 vs 2020 PL redistricting), so a
 * vintage's variable ids are RESOLVED against the dataset's own `variables.json` by label at
 * fetch time (`resolveVariableIds`) — the hardcoded ids below are expectations to assert, not
 * blind inputs. Label matching keys on the Census Bureau's stable phrasing
 * "Black or African American alone".
 */

export type CensusDecennialVintage = {
  /** Decade label the vintage represents (matches `deriveEraBuckets` decade grammar). */
  readonly decade: '2000' | '2010' | '2020';
  /** Dataset path under api.census.gov/data, e.g. "2000/dec/sf1". */
  readonly dataset: string;
  /** Expected variable id for total population — asserted against variables.json. */
  readonly totalVariable: string;
  /** Expected variable id for "Black or African American alone" — asserted likewise. */
  readonly blackAloneVariable: string;
  /** Source identifier recorded on every persisted row (provenance `source` leg). */
  readonly sourceId: string;
};

export const CENSUS_DECENNIAL_VINTAGES: readonly CensusDecennialVintage[] = [
  {
    decade: '2000',
    dataset: '2000/dec/sf1',
    totalVariable: 'P003001',
    blackAloneVariable: 'P003004',
    sourceId: 'us-census-decennial-2000-sf1',
  },
  {
    decade: '2010',
    dataset: '2010/dec/sf1',
    totalVariable: 'P003001',
    blackAloneVariable: 'P003003',
    sourceId: 'us-census-decennial-2010-sf1',
  },
  {
    decade: '2020',
    dataset: '2020/dec/pl',
    totalVariable: 'P1_001N',
    blackAloneVariable: 'P1_003N',
    sourceId: 'us-census-decennial-2020-pl',
  },
] as const;

/** One county's population figures for one decennial vintage. */
export type CountyDecadePopulation = {
  readonly fips5: string;
  readonly stateFips: string;
  readonly countyFips: string;
  readonly countyName: string;
  readonly decade: CensusDecennialVintage['decade'];
  readonly totalPopulation: number;
  readonly blackPopulation: number;
};
