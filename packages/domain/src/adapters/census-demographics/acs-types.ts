/**
 * ACS 5-year estimates — the comparison/reporting layer beside the decennial county counts
 * (./types.ts). Same fail-closed discipline: every variable id carries the label (and, where
 * a label alone is ambiguous across race-iterated tables, the concept) we expect the
 * dataset's own variables.json to attach to it, asserted at fetch time before any row is
 * parsed. Estimates are published government statistics (public-numeric-policy category 3)
 * and always travel with the vintage's source metadata.
 *
 * Unlike decennial counts, ACS estimates use negative sentinel values (-666666666 and
 * friends) for suppressed/uncomputable cells — the parser maps ANY negative estimate to a
 * suppression marker rather than ingesting it (see ./acs-response-parser.ts).
 */

export type AcsVariableSpec = {
  /** Variable id, e.g. `B02001_003E`. */
  readonly id: string;
  /** Field name the value lands under in parsed rows and persisted docs. */
  readonly field: string;
  /** Expected label in the dataset's variables.json — asserted, fail closed. */
  readonly labelPattern: RegExp;
  /** Expected concept, for race-iterated tables whose labels are identical (e.g. B19013B). */
  readonly conceptPattern?: RegExp;
};

export type AcsVintage = {
  /** ACS 5-year end year, e.g. '2024' = 2020–2024 estimates. */
  readonly vintage: string;
  /** Dataset path under api.census.gov/data, e.g. "2024/acs/acs5". */
  readonly dataset: string;
  readonly variables: readonly AcsVariableSpec[];
  /** Source identifier recorded on every persisted row (provenance `source` leg). */
  readonly sourceId: string;
};

/** Starter comparison set — verified against 2024/acs/acs5 variables.json (2026-07-18). */
export const ACS5_STARTER_VARIABLES: readonly AcsVariableSpec[] = [
  { id: 'B01003_001E', field: 'totalPopulation', labelPattern: /^estimate\s*total/i },
  { id: 'B02001_001E', field: 'raceUniverse', labelPattern: /^estimate\s*total/i },
  {
    id: 'B02001_003E',
    field: 'blackPopulation',
    labelPattern: /black or african american alone/i,
  },
  {
    id: 'B19013_001E',
    field: 'medianHouseholdIncome',
    labelPattern: /median household income/i,
  },
  {
    id: 'B19013B_001E',
    field: 'medianHouseholdIncomeBlack',
    labelPattern: /median household income/i,
    conceptPattern: /black or african american alone householder/i,
  },
  { id: 'B25003_001E', field: 'tenureUniverse', labelPattern: /^estimate\s*total/i },
  { id: 'B25003_002E', field: 'ownerOccupied', labelPattern: /owner occupied/i },
  { id: 'B25003_003E', field: 'renterOccupied', labelPattern: /renter occupied/i },
  { id: 'B15003_001E', field: 'educationUniverse25Plus', labelPattern: /^estimate\s*total/i },
  { id: 'B15003_022E', field: 'bachelorsDegree', labelPattern: /bachelor'?s degree/i },
  { id: 'B15003_023E', field: 'mastersDegree', labelPattern: /master'?s degree/i },
  { id: 'B15003_024E', field: 'professionalDegree', labelPattern: /professional school degree/i },
  { id: 'B15003_025E', field: 'doctorateDegree', labelPattern: /doctorate degree/i },
] as const;

export const ACS5_2024_VINTAGE: AcsVintage = {
  vintage: '2024',
  dataset: '2024/acs/acs5',
  variables: ACS5_STARTER_VARIABLES,
  sourceId: 'us-census-acs5-2024',
} as const;

/** One geography's parsed ACS estimates. Suppressed cells are listed by field name and
 * absent from `values` — a negative sentinel is never carried as a value. */
export type AcsProfileRow = {
  /** 5-digit county GEOID, or 11-digit tract GEOID for tract rows. */
  readonly geoid: string;
  readonly stateFips: string;
  readonly countyFips: string;
  /** 6-digit tract code; tract rows only. */
  readonly tractCode?: string;
  /** Census `NAME` column as published. */
  readonly name: string;
  readonly values: Readonly<Record<string, number>>;
  readonly suppressed: readonly string[];
};
