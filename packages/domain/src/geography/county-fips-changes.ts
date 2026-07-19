/** * Canonical county / county-equivalent FIPS change records sourced from the Census Bureau * "Substantial Changes to Counties and County Equivalent Entities: 1970–Present" lists. * * Each entry is a directed edge from a retired or superseded 5-digit GEOID to its successor. * Connecticut's 2022 county→planning-region switch uses Census Federal Register Table 2 * approximations where one legacy county spans multiple planning regions (marked approximate). */ /** Kind of FIPS transition — renames keep the same footprint; retired-replaced swaps equivalents. */
export type CountyFipsChangeKind =
  'rename' | 'retired-replaced'; /** One Census-documented county FIPS transition. */
export type CountyFipsChange = {
  /** Retired or superseded 5-digit county GEOID (state FIPS + county FIPS). */ readonly fromFips5: string;
  /** Successor 5-digit county GEOID valid on or after `effectiveYear`. */ readonly toFips5: string;
  /** Census reference year when the successor first appears in products (January 1 rule). */ readonly effectiveYear: number;
  readonly kind: CountyFipsChangeKind;
  readonly priorName: string;
  readonly currentName: string;
  /** Authoritative documentation URL for this change. */ readonly sourceUrl: string;
  /** True when the mapping is an approximation (legacy CT counties split across regions). */ readonly approximate?: boolean;
}; /** * Census substantial-changes list (2010 decade) + Connecticut FR notice (2022). * @see https://www.census.gov/programs-surveys/geography/technical-documentation/county-changes.html */
export const COUNTY_FIPS_CHANGES: readonly CountyFipsChange[] = [
  {
    fromFips5: '46113',
    toFips5: '46102',
    effectiveYear: 2015,
    kind: 'rename',
    priorName: 'Shannon County, South Dakota',
    currentName: 'Oglala Lakota County, South Dakota',
    sourceUrl:
      'https://www.census.gov/programs-surveys/geography/technical-documentation/county-changes/2010.html',
  },
  {
    fromFips5: '02270',
    toFips5: '02158',
    effectiveYear: 2015,
    kind: 'rename',
    priorName: 'Wade Hampton Census Area, Alaska',
    currentName: 'Kusilvak Census Area, Alaska',
    sourceUrl:
      'https://www.census.gov/programs-surveys/geography/technical-documentation/county-changes/2010.html',
  }, // Connecticut legacy counties → planning regions (effective 2022; FR notice 2022-06-06). // Table 2 approximations — Fairfield and New Haven span multiple planning regions. { fromFips5: '09001', toFips5: '09190', effectiveYear: 2022, kind: 'retired-replaced', priorName: 'Fairfield County, Connecticut', currentName: 'Western Connecticut Planning Region', sourceUrl: 'https://www.federalregister.gov/documents/2022/06/06/2022-12063/change-to-county-equivalents-in-the-state-of-connecticut', approximate: true, }, { fromFips5: '09003', toFips5: '09110', effectiveYear: 2022, kind: 'retired-replaced', priorName: 'Hartford County, Connecticut', currentName: 'Capitol Planning Region', sourceUrl: 'https://www.federalregister.gov/documents/2022/06/06/2022-12063/change-to-county-equivalents-in-the-state-of-connecticut', }, { fromFips5: '09005', toFips5: '09160', effectiveYear: 2022, kind: 'retired-replaced', priorName: 'Litchfield County, Connecticut', currentName: 'Northwest Hills Planning Region', sourceUrl: 'https://www.federalregister.gov/documents/2022/06/06/2022-12063/change-to-county-equivalents-in-the-state-of-connecticut', }, { fromFips5: '09007', toFips5: '09130', effectiveYear: 2022, kind: 'retired-replaced', priorName: 'Middlesex County, Connecticut', currentName: 'Lower Connecticut River Valley Planning Region', sourceUrl: 'https://www.federalregister.gov/documents/2022/06/06/2022-12063/change-to-county-equivalents-in-the-state-of-connecticut', }, { fromFips5: '09009', toFips5: '09170', effectiveYear: 2022, kind: 'retired-replaced', priorName: 'New Haven County, Connecticut', currentName: 'South Central Connecticut Planning Region', sourceUrl: 'https://www.federalregister.gov/documents/2022/06/06/2022-12063/change-to-county-equivalents-in-the-state-of-connecticut', approximate: true, }, { fromFips5: '09011', toFips5: '09180', effectiveYear: 2022, kind: 'retired-replaced', priorName: 'New London County, Connecticut', currentName: 'Southeastern Connecticut Planning Region', sourceUrl: 'https://www.federalregister.gov/documents/2022/06/06/2022-12063/change-to-county-equivalents-in-the-state-of-connecticut', }, { fromFips5: '09013', toFips5: '09110', effectiveYear: 2022, kind: 'retired-replaced', priorName: 'Tolland County, Connecticut', currentName: 'Capitol Planning Region', sourceUrl: 'https://www.federalregister.gov/documents/2022/06/06/2022-12063/change-to-county-equivalents-in-the-state-of-connecticut', approximate: true, }, { fromFips5: '09015', toFips5: '09150', effectiveYear: 2022, kind: 'retired-replaced', priorName: 'Windham County, Connecticut', currentName: 'Northeastern Connecticut Planning Region', sourceUrl: 'https://www.federalregister.gov/documents/2022/06/06/2022-12063/change-to-county-equivalents-in-the-state-of-connecticut', },
] as const; /** Latest Census reference year covered by {@link COUNTY_FIPS_CHANGES}. */
export const COUNTY_FIPS_CROSSWALK_CURRENT_YEAR = 2026; /** Connecticut planning-region FIPS codes (091xx) adopted as county equivalents in 2022. */
export const CONNECTICUT_PLANNING_REGION_FIPS5 = [
  '09110',
  '09120',
  '09130',
  '09140',
  '09150',
  '09160',
  '09170',
  '09180',
  '09190',
] as const; /** Retired Connecticut legacy county FIPS codes (09001–09015, odd increments). */
export const CONNECTICUT_LEGACY_COUNTY_FIPS5 = [
  '09001',
  '09003',
  '09005',
  '09007',
  '09009',
  '09011',
  '09013',
  '09015',
] as const;
