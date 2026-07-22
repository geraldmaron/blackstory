/**
 * ACS 5-year variable specs for Phase 1 context indicators (county + state).
 * Labels/concepts verified against 2024/acs/acs5 variables.json (2026-07-22).
 */
import type { AcsVariableSpec, AcsVintage } from './acs-types.js';

/** County + state variables for Phase 1 ACS metrics from phase1-indicator-catalog.ts. */
export const PHASE1_ACS5_VARIABLES: readonly AcsVariableSpec[] = [
  { id: 'B02001_001E', field: 'raceUniverse', labelPattern: /^estimate\s*total/i },
  {
    id: 'B02001_003E',
    field: 'blackPopulation',
    labelPattern: /black or african american alone/i,
  },
  {
    id: 'B19013B_001E',
    field: 'medianHouseholdIncomeBlack',
    labelPattern: /median household income/i,
    conceptPattern: /black or african american alone householder/i,
  },
  {
    id: 'B19013B_001M',
    field: 'medianHouseholdIncomeBlackMoe',
    labelPattern: /margin of error.*median household income/i,
    conceptPattern: /black or african american alone householder/i,
  },
  {
    id: 'B19013A_001E',
    field: 'medianHouseholdIncomeWhite',
    labelPattern: /median household income/i,
    conceptPattern: /white alone householder/i,
  },
  {
    id: 'B19013A_001M',
    field: 'medianHouseholdIncomeWhiteMoe',
    labelPattern: /margin of error.*median household income/i,
    conceptPattern: /white alone householder/i,
  },
  { id: 'B17001B_001E', field: 'povertyUniverse', labelPattern: /^estimate\s*total/i },
  {
    id: 'B17001B_002E',
    field: 'povertyCount',
    labelPattern: /income in the past 12 months below poverty level/i,
  },
  { id: 'B25003B_001E', field: 'tenureUniverseBlack', labelPattern: /^estimate\s*total/i },
  {
    id: 'B25003B_002E',
    field: 'ownerOccupiedBlack',
    labelPattern: /owner occupied/i,
  },
  { id: 'C15002B_001E', field: 'educationUniverse25PlusBlack', labelPattern: /^estimate\s*total/i },
  {
    id: 'C15002B_006E',
    field: 'baPlusMaleBlack',
    labelPattern: /bachelor'?s degree or higher/i,
  },
  {
    id: 'C15002B_011E',
    field: 'baPlusFemaleBlack',
    labelPattern: /bachelor'?s degree or higher/i,
  },
  {
    id: 'C23002B_007E',
    field: 'employedMaleBlack1664',
    labelPattern: /male.*16 to 64.*employed/i,
  },
  {
    id: 'C23002B_008E',
    field: 'unemployedMaleBlack1664',
    labelPattern: /male.*16 to 64.*unemployed/i,
  },
  {
    id: 'C23002B_020E',
    field: 'employedFemaleBlack1664',
    labelPattern: /female.*16 to 64.*employed/i,
  },
  {
    id: 'C23002B_021E',
    field: 'unemployedFemaleBlack1664',
    labelPattern: /female.*16 to 64.*unemployed/i,
  },
] as const;

export const PHASE1_ACS5_2024_VINTAGE: AcsVintage = {
  vintage: '2024',
  dataset: '2024/acs/acs5',
  variables: PHASE1_ACS5_VARIABLES,
  sourceId: 'acs-census-api',
} as const;

/**
 * Default bounded county pull: top Black-population states plus MD/GA fixtures.
 * AL, CA, FL, GA, IL, LA, MD, MS, NC, NY, SC, TX — 12 states (~800 counties).
 * State unemployment (`acs-unemployment-black-state`) remains all states + territories.
 */
export const PHASE1_ACS_DEFAULT_COUNTY_STATE_FIPS = [
  '01', // Alabama
  '06', // California
  '12', // Florida
  '13', // Georgia
  '17', // Illinois
  '22', // Louisiana
  '24', // Maryland
  '28', // Mississippi
  '36', // New York
  '37', // North Carolina
  '45', // South Carolina
  '48', // Texas
] as const;

export function phase1AcsReferencePeriod(vintage: AcsVintage): string {
  const endYear = Number(vintage.vintage);
  if (!Number.isFinite(endYear)) {
    throw new Error(`Invalid ACS vintage year: ${vintage.vintage}`);
  }
  return `${endYear - 4}-${endYear}`;
}

export function phase1AcsDatasetVintageLabel(vintage: AcsVintage): string {
  return `ACS ${vintage.vintage} 5-Year`;
}
