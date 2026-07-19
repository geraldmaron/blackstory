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
  // ── Free/slave era (1790–1860): Black = free + enslaved. "Non-White"/"Colored" ≈ Black; the
  //    census counted essentially no other non-white persons in these decades. Several tables
  //    split by sex, so a category sums its male + female variables.
  {
    decade: '1790',
    dataset: '1790_cPop',
    dataTable: 'NT6',
    nhgisCode: 'AAQ',
    hasFreeEnslavedSplit: true,
    variables: { AAQ003: 'white', AAQ001: 'blackFree', AAQ002: 'blackEnslaved' },
  },
  {
    decade: '1800',
    dataset: '1800_cPop',
    dataTable: 'NT6',
    nhgisCode: 'AAY',
    hasFreeEnslavedSplit: true,
    variables: { AAY001: 'blackFree', AAY002: 'blackEnslaved' },
  },
  {
    decade: '1810',
    dataset: '1810_cPop',
    dataTable: 'NT6',
    nhgisCode: 'AA7',
    hasFreeEnslavedSplit: true,
    variables: { AA7001: 'blackFree', AA7002: 'blackEnslaved' },
  },
  {
    decade: '1820',
    dataset: '1820_cPop',
    dataTable: 'NT10', // Race/Slave Status by Sex
    nhgisCode: 'ABB',
    hasFreeEnslavedSplit: true,
    variables: {
      ABB001: 'white',
      ABB002: 'white',
      ABB005: 'blackFree',
      ABB006: 'blackFree',
      ABB003: 'blackEnslaved',
      ABB004: 'blackEnslaved',
    },
  },
  {
    decade: '1830',
    dataset: '1830_cPop',
    dataTable: 'NT12', // Race/Slave Status by Sex
    nhgisCode: 'ABO',
    hasFreeEnslavedSplit: true,
    variables: {
      ABO001: 'white',
      ABO002: 'white',
      ABO005: 'blackFree',
      ABO006: 'blackFree',
      ABO003: 'blackEnslaved',
      ABO004: 'blackEnslaved',
    },
  },
  {
    decade: '1840',
    dataset: '1840_cPopX',
    dataTable: 'NT25', // Race/Slave Status
    nhgisCode: 'ACS',
    hasFreeEnslavedSplit: true,
    variables: { ACS001: 'white', ACS002: 'blackFree', ACS003: 'blackEnslaved' },
  },
  {
    decade: '1850',
    dataset: '1850_cPAX',
    dataTable: 'NT6', // Race/Slave Status
    nhgisCode: 'AE6',
    hasFreeEnslavedSplit: true,
    variables: { AE6001: 'white', AE6002: 'blackFree', AE6003: 'blackEnslaved' },
  },
  {
    decade: '1860',
    dataset: '1860_cPAX',
    dataTable: 'NT6', // Race and Slave Status
    nhgisCode: 'AH3',
    hasFreeEnslavedSplit: true,
    variables: { AH3001: 'white', AH3002: 'blackFree', AH3003: 'blackEnslaved' },
  },
  // ── Post-emancipation (1870+): no free/slave split. Black = "Colored" (1870/1880) or "Negro".
  //    Chinese/Indian/other races have their own columns and are excluded from Black.
  {
    decade: '1870',
    dataset: '1870_cPAX',
    dataTable: 'NT4', // Race
    nhgisCode: 'AK3',
    hasFreeEnslavedSplit: false,
    variables: { AK3001: 'white', AK3002: 'black' }, // Colored
  },
  {
    decade: '1880',
    dataset: '1880_cPAX',
    dataTable: 'NT4', // Race
    nhgisCode: 'APP',
    hasFreeEnslavedSplit: false,
    variables: { APP001: 'white', APP002: 'black' }, // Colored
  },
  {
    // NT4 lists Negro for 1890, 1880 AND 1870 — take ONLY the 1890 column (AVF001).
    decade: '1890',
    dataset: '1890_cPHAM',
    dataTable: 'NT4', // Non-White Population by Race by Year
    nhgisCode: 'AVF',
    hasFreeEnslavedSplit: false,
    variables: { AVF001: 'black' }, // Negro >> 1890
  },
  {
    decade: '1900',
    dataset: '1900_cPHAM',
    dataTable: 'NT7', // Non-White Population by Race by Sex
    nhgisCode: 'AZ3',
    hasFreeEnslavedSplit: false,
    variables: { AZ3003: 'black', AZ3004: 'black' }, // Negro M+F ("Other Colored" excluded)
  },
  {
    decade: '1910',
    dataset: '1910_cPHA',
    dataTable: 'NT11', // Race by Sex
    nhgisCode: 'A30',
    hasFreeEnslavedSplit: false,
    variables: { A30001: 'white', A30002: 'white', A30003: 'black', A30004: 'black' },
  },
  {
    decade: '1920',
    dataset: '1920_cPHAM',
    dataTable: 'NT5', // Race/Nativity by Sex
    nhgisCode: 'A8L',
    hasFreeEnslavedSplit: false,
    variables: {
      A8L001: 'white',
      A8L002: 'white',
      A8L003: 'white',
      A8L004: 'white',
      A8L005: 'black',
      A8L006: 'black',
    },
  },
  {
    decade: '1930',
    dataset: '1930_cPAE',
    dataTable: 'NT5', // Race/Nativity by Sex
    nhgisCode: 'BEP',
    hasFreeEnslavedSplit: false,
    variables: {
      BEP001: 'white',
      BEP002: 'white',
      BEP003: 'white',
      BEP004: 'white',
      BEP005: 'black',
      BEP006: 'black',
    },
  },
  {
    decade: '1940',
    dataset: '1940_cPHAE',
    dataTable: 'NT6', // Race/Nativity
    nhgisCode: 'BYA',
    hasFreeEnslavedSplit: false,
    variables: { BYA001: 'white', BYA002: 'white', BYA003: 'black' },
  },
  {
    decade: '1950',
    dataset: '1950_cPHA',
    dataTable: 'NT6', // Sex by Race/Nativity
    nhgisCode: 'B3P',
    hasFreeEnslavedSplit: false,
    variables: {
      B3P001: 'white',
      B3P002: 'white',
      B3P005: 'white',
      B3P006: 'white',
      B3P003: 'black',
      B3P007: 'black',
    },
  },
  {
    decade: '1960',
    dataset: '1960_cPop',
    dataTable: 'NT13', // Sex by Race
    nhgisCode: 'B5S',
    hasFreeEnslavedSplit: false,
    variables: { B5S001: 'white', B5S008: 'white', B5S002: 'black', B5S009: 'black' },
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
