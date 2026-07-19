/**
 * IPUMS NHGIS county race adapter types.
 *
 * NHGIS delivers historical county race data NOT as harmonized time-series tables (those begin
 * 1970) but as per-decade DATASETS, each with an era-specific race table and its own category
 * scheme — free/slave pre-1870, "colored"/"Negro" later. `NHGIS_DECADE_RACE_TABLES` is the
 * registry of which dataset + data table + variable codes carry Black population for each decade
 * (confirmed live against the IPUMS metadata API). County rows are keyed by NHGIS `GISJOIN` on
 * that decade's HISTORICAL boundaries — never assume it equals a modern 5-digit FIPS; joining to
 * modern geography requires an NHGIS crosswalk (a separate, deferred step).
 */

/** Registry id shared with `external-data-sources.ts` (`nhgis-county-race`). */
export const NHGIS_COUNTY_RACE_SOURCE_ID = 'nhgis-county-race';

/** Stable adapter namespace for future SourceAdapterContract registration. */
export const NHGIS_ADAPTER_ID = `external-data:${NHGIS_COUNTY_RACE_SOURCE_ID}` as const;

/** The categories we consume from a decade's race table. */
export type NhgisRaceCategory = 'white' | 'blackFree' | 'blackEnslaved' | 'black';

/** One decade's NHGIS county race table + the variable codes → categories we read from it. */
export type NhgisDecadeRaceTable = {
  readonly decade: string;
  /** NHGIS dataset name, e.g. `1860_cPAX`. */
  readonly dataset: string;
  /** Data table code within the dataset, e.g. `NT6`. */
  readonly dataTable: string;
  /** NHGIS table code prefix on the CSV columns, e.g. `AH3`. */
  readonly nhgisCode: string;
  /** True when Black is tabulated as free + enslaved (pre-1870). */
  readonly hasFreeEnslavedSplit: boolean;
  /** CSV variable code → category. Only the columns we consume are listed. */
  readonly variables: Readonly<Record<string, NhgisRaceCategory>>;
};

/**
 * Per-decade race tables, confirmed against the IPUMS NHGIS metadata API. 1860 is fully
 * verified end-to-end (extract → parse → cross-checked against twps0056 national totals within
 * the expected ~0.3% "population not in any county" territorial residual). Additional decades
 * (1790 NT6, 1830 NT13+NT15, 1900 NT7, 1940 NT6 — codes recorded on repo-lcl9.3) are added here
 * as each is verified the same way, rather than encoded unverified.
 */
export const NHGIS_DECADE_RACE_TABLES: readonly NhgisDecadeRaceTable[] = [
  {
    // "Non-White: Free/Slave" ≈ Black in 1790 (the census counted essentially no other non-white
    // persons), matching twps0056's Black = free + slave for this decade.
    decade: '1790',
    dataset: '1790_cPop',
    dataTable: 'NT6',
    nhgisCode: 'AAQ',
    hasFreeEnslavedSplit: true,
    variables: { AAQ003: 'white', AAQ001: 'blackFree', AAQ002: 'blackEnslaved' },
  },
  {
    // Race/Slave Status BY SEX — each category sums its male + female variables.
    decade: '1830',
    dataset: '1830_cPop',
    dataTable: 'NT12',
    nhgisCode: 'ABO',
    hasFreeEnslavedSplit: true,
    variables: {
      ABO001: 'white',
      ABO002: 'white',
      ABO005: 'blackFree', // Nonwhite Free (M+F)
      ABO006: 'blackFree',
      ABO003: 'blackEnslaved', // Nonwhite Slave (M+F)
      ABO004: 'blackEnslaved',
    },
  },
  {
    decade: '1860',
    dataset: '1860_cPAX',
    dataTable: 'NT6',
    nhgisCode: 'AH3',
    hasFreeEnslavedSplit: true,
    variables: {
      AH3001: 'white',
      AH3002: 'blackFree', // "Free colored"
      AH3003: 'blackEnslaved', // "Slave"
    },
  },
  {
    // Post-emancipation: no free/slave split. Black = Negro (M+F); "Other Colored" is excluded.
    decade: '1900',
    dataset: '1900_cPHAM',
    dataTable: 'NT7',
    nhgisCode: 'AZ3',
    hasFreeEnslavedSplit: false,
    variables: { AZ3003: 'black', AZ3004: 'black' },
  },
  {
    // Race/Nativity: Black = Negro; White = native + foreign-born; "Other" excluded.
    decade: '1940',
    dataset: '1940_cPHAE',
    dataTable: 'NT6',
    nhgisCode: 'BYA',
    hasFreeEnslavedSplit: false,
    variables: { BYA001: 'white', BYA002: 'white', BYA003: 'black' },
  },
];

export function getNhgisDecadeRaceTable(decade: string): NhgisDecadeRaceTable | undefined {
  return NHGIS_DECADE_RACE_TABLES.find((entry) => entry.decade === decade);
}

/** One parsed NHGIS county race row on that decade's historical boundaries. */
export type NhgisCountyRaceRow = {
  /** NHGIS historical geography key (e.g. `G0100010`); NOT a modern FIPS. */
  readonly gisJoin: string;
  readonly decade: string;
  readonly stateName: string;
  /** NHGIS STATEA code (historical, not necessarily modern FIPS). */
  readonly stateCode: string;
  readonly countyName: string;
  /** NHGIS COUNTYA code (historical). */
  readonly countyCode: string;
  /** Geography vintage key, e.g. `nhgis-1860`. */
  readonly boundaryVersion: string;
  readonly white: number | null;
  /** Present only for free/slave decades. */
  readonly blackFree: number | null;
  readonly blackEnslaved: number | null;
  /** Black total for the county (free + enslaved where split, else the Black category). */
  readonly black: number;
};

export type NhgisCountyRaceExtractRequest = {
  readonly decade: string;
};

export type NhgisCountyRaceExtractResult = {
  readonly request: NhgisCountyRaceExtractRequest;
  readonly rows: readonly NhgisCountyRaceRow[];
  readonly rejected: readonly string[];
};
