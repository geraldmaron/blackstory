/**
 * Published 1870 through 1970 census tables by race for Lives Across the Decades. Pure: the ingest
 * script downloads one IPUMS NHGIS extract of these tables for the nation and every state, and these
 * functions turn its CSV files into observations that keep the published counts, so the domain builder
 * can sum states into regions.
 *
 * These decades do not fit `decennial.ts`. There, one table yields a group's numerator and its
 * denominator through geographic-component breakdowns, which is true of the 1980-2020 summary files
 * and false here: before 1970 the NHGIS datasets carry no breakdowns at all, race lives inside the
 * variable description, and a rate usually needs two tables that can sit in two different datasets
 * (1870 school attendance is 1870_cPAX NT11 over 1870_sPHX NT41). So a measure here is an explicit
 * numerator and denominator, each naming its own dataset, table and cells.
 *
 * Cells are found by NHGIS variable code **and** checked against the description the published table
 * carries, and a description that has moved throws with what was expected and what was found. That is
 * stricter than the 1980-2020 loader on purpose: these are 150-year-old tables, and a silently shifted
 * column would publish a wrong figure about people's lives.
 *
 * Race slices follow what each table actually counted, never what a reader would like it to say:
 * "Colored" is Black in 1870 and 1880, where Chinese and Indian have their own columns, and is an
 * all-non-white aggregate in 1890, 1900 and the farm tables, which is stored as `nonwhite`. Hispanic
 * origin was not published anywhere before 1970, so no decade before it has a Hispanic cell and no
 * proxy stands in for one. Gaps here are content, not failures: what the count could not see is part
 * of what the timeline shows. Method: docs/methodology/lives-across-decades.md.
 */
import { createHash } from 'node:crypto';
import {
  LIVES_NATIONAL,
  LIVES_SERIES,
  incomeBracketSeriesId,
  livesStateJurisdictionId,
} from '@repo/domain/statistics/lives';
import { contiguousIncomeBrackets } from './acs.js';
import type { LivesGeographyLevel } from './decennial.js';
import type { LivesPublishedObservation } from './published-observation.js';

export type LivesHistoricalCensus =
  1870 | 1880 | 1890 | 1900 | 1910 | 1920 | 1930 | 1940 | 1950 | 1960 | 1970;

const HISTORICAL_CENSUSES: readonly LivesHistoricalCensus[] = [
  1870, 1880, 1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970,
];

/** One published cell: the NHGIS variable code, and the description that table publishes for it. */
export type LivesHistoricalCell = {
  readonly code: string;
  /** Exact description text, as the NHGIS metadata API returns it. */
  readonly text: string;
};

/**
 * Cells from one published table that add up to one side of a rate. `breakdown` names the breakdown
 * values NHGIS writes in front of the description, for the 1970 datasets that have them.
 */
export type LivesHistoricalRef = {
  readonly dataset: string;
  /** NHGIS table name, as the extract requests it. */
  readonly table: string;
  /** NHGIS column prefix. */
  readonly code: string;
  readonly variables: readonly LivesHistoricalCell[];
  readonly breakdown?: readonly string[];
};

/**
 * How a measure's two sides become a figure. `share` divides; `complement` reads a published count of
 * the people a condition left out (the illiterate) and stores the rest; `income` turns each numerator
 * cell into its own published income bracket over the sum of them all; `median` stores a published
 * dollar median as printed (never summed across states).
 */
export type LivesHistoricalKind = 'share' | 'complement' | 'income' | 'median';

export type LivesHistoricalMeasure = {
  readonly census: LivesHistoricalCensus;
  /** Stored series, or `null` for `income`, where each bracket carries its own series id. */
  readonly series: string | null;
  readonly slice: string;
  readonly kind: LivesHistoricalKind;
  readonly numerator: LivesHistoricalRef;
  readonly denominator: LivesHistoricalRef;
  /** The published tables, as a citation names them. */
  readonly title: string;
  /** What the published table counted, which is often not what the series usually counts. */
  readonly universe: string;
  /** A definitional break a reader has to be told about. */
  readonly note?: string;
  readonly levels: readonly LivesGeographyLevel[];
};

export type LivesHistoricalDataset = {
  /** The census and its published volumes, as a citation names them. */
  readonly name: string;
  /** Census Bureau index of that census's official publications. */
  readonly sourceUrl: string;
  /** Geographic components and race groups the extract asks for; empty where the dataset has none. */
  readonly breakdownValues: readonly string[];
};

/** Census Bureau index of official publications for one census year. */
function publicationsUrl(census: LivesHistoricalCensus): string {
  return `https://www.census.gov/programs-surveys/decennial-census/decade/decennial-publications.${census}.html`;
}

/** The 1970 breakdown values, which are the only ones any of these datasets has. */
const TOTAL_AREA = 'Total area';
const URBAN = 'Urban';
const ALL_RACES = 'All races';
const NHGIS_BLACK_1970 = 'Black';
const NHGIS_WHITE_1970 = 'White';
const SPANISH_AMERICAN_1970 = 'Spanish American (Hispanic)';

/** Breakdown labels that name the whole area or everyone in it, which NHGIS may leave unwritten. */
const DEFAULT_BREAKDOWNS: ReadonlySet<string> = new Set([TOTAL_AREA, ALL_RACES]);

export const LIVES_HISTORICAL_DATASETS: Readonly<Record<string, LivesHistoricalDataset>> = {
  '1870_cPAX': {
    name: '1870 Census, Population, Agriculture & Other Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1870),
    breakdownValues: [],
  },
  '1870_sPHX': {
    name: '1870 Census, Population, Housing & Other Data [US & States]',
    sourceUrl: publicationsUrl(1870),
    breakdownValues: [],
  },
  '1880_cPAX': {
    name: '1880 Census, Population, Agriculture & Other Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1880),
    breakdownValues: [],
  },
  '1880_sPHX': {
    name: '1880 Census, Population, Housing & Other Data [US & States]',
    sourceUrl: publicationsUrl(1880),
    breakdownValues: [],
  },
  '1880_sPbSMX': {
    name: '1880 Census, Place of Birth, School, Manufacturing & Other Data [US & States]',
    sourceUrl: publicationsUrl(1880),
    breakdownValues: [],
  },
  '1890_cPHAM': {
    name: '1890 Census, Population, Housing, Agriculture & Manufacturing Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1890),
    breakdownValues: [],
  },
  '1900_cPHAM': {
    name: '1900 Census, Population, Housing, Agriculture & Manufacturing Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1900),
    breakdownValues: [],
  },
  '1910_cPHA': {
    name: '1910 Census, Population, Housing & Agriculture Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1910),
    breakdownValues: [],
  },
  '1910_sOccFarmer': {
    name: '1910 Census, Occupation Data & Farmer Characteristics [US & States]',
    sourceUrl: publicationsUrl(1910),
    breakdownValues: [],
  },
  '1920_cPHAM': {
    name: '1920 Census, Population, Housing, Agriculture & Manufacturing Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1920),
    breakdownValues: [],
  },
  '1920_sOccFarmer': {
    name: '1920 Census, Occupation Data & Farmer Characteristics [US & States]',
    sourceUrl: publicationsUrl(1920),
    breakdownValues: [],
  },
  '1930_cPAE': {
    name: '1930 Census, Population, Agriculture & Economic Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1930),
    breakdownValues: [],
  },
  '1930_cFH': {
    name: '1930 Census, Family & Housing Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1930),
    breakdownValues: [],
  },
  '1930_cAg': {
    name: '1930 Census, Agriculture Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1930),
    breakdownValues: [],
  },
  '1940_cPHAE': {
    name: '1940 Census, Population, Housing, Agriculture & Economic Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1940),
    breakdownValues: [],
  },
  '1950_cPHA': {
    name: '1950 Census, Population, Housing & Agriculture Data [US, States & Counties]',
    sourceUrl: publicationsUrl(1950),
    breakdownValues: [],
  },
  '1960_cPop': {
    name: '1960 Census, Population Data [US, States, Counties]',
    sourceUrl: publicationsUrl(1960),
    breakdownValues: [],
  },
  '1970_Cnt1': {
    name: '1970 Census, Count 1 (100-percent data)',
    sourceUrl: publicationsUrl(1970),
    breakdownValues: [],
  },
  // Count 2's urban geographic subarea is published for tracts and urban areas, not for the nation
  // or a state, so only the whole area is asked for here and 1970 urban comes from Count 4Pb.
  '1970_Cnt2': {
    name: '1970 Census, Count 2 (100-percent data)',
    sourceUrl: publicationsUrl(1970),
    breakdownValues: ['bs01.ge000'],
  },
  '1970_Cnt4Pb': {
    name: '1970 Census, Count 4Pb (sample data with a race and ethnicity breakdown)',
    sourceUrl: publicationsUrl(1970),
    breakdownValues: [
      'bs01.ge000',
      'bs01.ge001',
      'bs02.ch000',
      'bs02.ch001',
      'bs02.ch004',
      'bs02.ch235',
    ],
  },
  '1970_Cnt4H': {
    name: '1970 Census, Count 4H (sample housing data)',
    sourceUrl: publicationsUrl(1970),
    breakdownValues: ['bs01.ge000'],
  },
};

const NATION_AND_STATE: readonly LivesGeographyLevel[] = ['nation', 'state'];
/**
 * 1970's sample file carries its race and urban breakdowns for states but not for the nation: the
 * national file comes back with the whole area and all races only. Those measures are states-only
 * and the builder sums them, as the 1980 attainment table already is in `decennial.ts`.
 */
const STATE: readonly LivesGeographyLevel[] = ['state'];

// ---- 1870 ----------------------------------------------------------------------------------

const EVERYONE_1870: LivesHistoricalRef = {
  dataset: '1870_cPAX',
  table: 'NT1',
  code: 'AJ3',
  variables: [{ code: 'AJ3001', text: 'Total' }],
};

/** 1870 lists Chinese and Indian in their own columns, so "Colored" here is Black. */
const RACE_1870 = (code: string, text: string): LivesHistoricalRef => ({
  dataset: '1870_cPAX',
  table: 'NT4',
  code: 'AK3',
  variables: [{ code, text }],
});

const SCHOOL_1870 = (cells: readonly LivesHistoricalCell[]): LivesHistoricalRef => ({
  dataset: '1870_cPAX',
  table: 'NT11',
  code: 'AJ5',
  variables: cells,
});

const SCHOOL_AGE_1870 = (cells: readonly LivesHistoricalCell[]): LivesHistoricalRef => ({
  dataset: '1870_sPHX',
  table: 'NT41',
  code: 'AMN',
  variables: cells,
});

// ---- 1880 ----------------------------------------------------------------------------------

const AGES_1880 = ['10 to 14 years of age', '15 to 20 years of age', '21 years of age and over'];
const SEXES = ['Male', 'Female'];

/** ASA (cannot write) and AR9 (the same universe) publish the same twelve age-by-sex cells. */
function literacyCells1880(code: string, race: string, first: number): LivesHistoricalCell[] {
  const cells: LivesHistoricalCell[] = [];
  let offset = first;
  for (const age of AGES_1880) {
    for (const sex of SEXES) {
      cells.push({
        code: `${code}${String(offset).padStart(3, '0')}`,
        text: `${race} >> ${age} >> ${sex}`,
      });
      offset += 1;
    }
  }
  return cells;
}

// ---- 1970 ----------------------------------------------------------------------------------

/** 1970_Cnt2 NT1 publishes nine races by sex; a group is its two cells, everyone is all eighteen. */
const RACES_1970 = [
  'White',
  'Negro',
  'Indian',
  'Japanese',
  'Chinese',
  'Filipino',
  'Hawaiian',
  'Korean',
  'Other',
];

function race1970Cells(pick?: string): LivesHistoricalCell[] {
  const cells: LivesHistoricalCell[] = [];
  SEXES.forEach((sex, sexIndex) => {
    RACES_1970.forEach((race, raceIndex) => {
      if (pick !== undefined && race !== pick) return;
      cells.push({
        code: `CEB${String(sexIndex * RACES_1970.length + raceIndex + 1).padStart(3, '0')}`,
        text: `${sex} >> ${race}`,
      });
    });
  });
  return cells;
}

function population1970(breakdown: readonly string[], pick?: string): LivesHistoricalRef {
  return {
    dataset: '1970_Cnt2',
    table: 'NT1',
    code: 'CEB',
    variables: race1970Cells(pick),
    breakdown,
  };
}

/** Household relationship, the shortest 1970_Cnt4Pb table whose cells add up to a group's people. */
const RELATIONSHIP_1970: readonly LivesHistoricalCell[] = [
  { code: 'C1V001', text: 'Male primary individual' },
  { code: 'C1V002', text: 'Female primary individual' },
  { code: 'C1V003', text: 'Family head of household with male head' },
  { code: 'C1V004', text: 'Family head of household with female head' },
  { code: 'C1V005', text: 'Wife of head' },
  { code: 'C1V006', text: 'Child of head' },
  { code: 'C1V007', text: 'Other relative of head' },
  {
    code: 'C1V008',
    text: 'Nonrelative (includes roomer, boarder or lodger) of head of household',
  },
  { code: 'C1V009', text: 'Male inmate of institution' },
  { code: 'C1V010', text: 'Female inmate of institution' },
  { code: 'C1V011', text: 'Male in other group quarters' },
  { code: 'C1V012', text: 'Female in other group quarters' },
];

function people1970(breakdown: readonly string[]): LivesHistoricalRef {
  return {
    dataset: '1970_Cnt4Pb',
    table: 'NT18',
    code: 'C1V',
    variables: RELATIONSHIP_1970,
    breakdown,
  };
}

/** 1970 publishes "College: 4" with no trailing "years"; that is the string, not a slip. */
const SCHOOLING_1970 = [
  'No school years completed (includes nursery and kindergarten)',
  'Elementary: 1-4 years',
  'Elementary: 5-6 years',
  'Elementary: 7 years',
  'Elementary: 8 years',
  'High school: 1-3 years',
  'High school: 4 years',
  'College: 1-3 years',
  'College: 4',
  'College: 5 years or more',
];

const HIGH_SCHOOL_OR_MORE_1970 = SCHOOLING_1970.slice(6);

function schooling1970(
  breakdown: readonly string[],
  levels: readonly string[],
): LivesHistoricalRef {
  const cells: LivesHistoricalCell[] = [];
  SEXES.forEach((sex, sexIndex) => {
    SCHOOLING_1970.forEach((level, levelIndex) => {
      if (!levels.includes(level)) return;
      cells.push({
        code: `C2M${String(sexIndex * SCHOOLING_1970.length + levelIndex + 1).padStart(3, '0')}`,
        text: `${sex} >> ${level}`,
      });
    });
  });
  return { dataset: '1970_Cnt4Pb', table: 'NT42', code: 'C2M', variables: cells, breakdown };
}

function labor1970(breakdown: readonly string[], statuses: readonly string[]): LivesHistoricalRef {
  const cells: LivesHistoricalCell[] = [];
  for (const status of statuses) {
    for (const [sex, code] of [
      ['Male', status === 'Employed' ? 'C23002' : 'C23003'],
      ['Female', status === 'Employed' ? 'C23011' : 'C23012'],
    ] as const) {
      cells.push({ code, text: `${sex} >> In labor force: ${status}` });
    }
  }
  return { dataset: '1970_Cnt4Pb', table: 'NT54', code: 'C23', variables: cells, breakdown };
}

/** Family income in 1969 dollars, exactly as the published boundaries read. */
const INCOME_1970: readonly LivesHistoricalCell[] = [
  { code: 'C3T001', text: 'Under $1000 (includes $1-$999, none, and loss)' },
  { code: 'C3T002', text: '$1000-$1999' },
  { code: 'C3T003', text: '$2000-$2999' },
  { code: 'C3T004', text: '$3000-$3999' },
  { code: 'C3T005', text: '$4000-$4999' },
  { code: 'C3T006', text: '$5000-$5999' },
  { code: 'C3T007', text: '$6000-$6999' },
  { code: 'C3T008', text: '$7000-$7999' },
  { code: 'C3T009', text: '$8000-$8999' },
  { code: 'C3T010', text: '$9000-$9999' },
  { code: 'C3T011', text: '$10000-$11999' },
  { code: 'C3T012', text: '$12000-$14999' },
  { code: 'C3T013', text: '$15000-$24999' },
  { code: 'C3T014', text: '$25000-$49999' },
  { code: 'C3T015', text: '$50000 and over' },
];

function income1970(breakdown: readonly string[]): LivesHistoricalRef {
  return { dataset: '1970_Cnt4Pb', table: 'NT75', code: 'C3T', variables: INCOME_1970, breakdown };
}

function tenure1970(pick: 'owner' | 'all'): LivesHistoricalCell[] {
  const sizes = [
    '1 person in unit',
    '2 persons in unit',
    '3 persons in unit',
    '4 persons in unit',
    '5 persons in unit',
    '6 persons in unit',
    '7 persons in unit',
    '8 persons in unit',
    '9 persons or more in unit',
  ];
  const cells: LivesHistoricalCell[] = [];
  (['Owner-occupied', 'Renter-occupied'] as const).forEach((tenure, tenureIndex) => {
    if (pick === 'owner' && tenure !== 'Owner-occupied') return;
    sizes.forEach((size, sizeIndex) => {
      cells.push({
        code: `CVG${String(tenureIndex * sizes.length + sizeIndex + 1).padStart(3, '0')}`,
        text: `${tenure} >> ${size}`,
      });
    });
  });
  return cells;
}

function spanishTenure1970(pick: 'owner' | 'all'): LivesHistoricalRef {
  return {
    dataset: '1970_Cnt4H',
    table: 'NT37F',
    code: 'CVG',
    variables: tenure1970(pick),
    breakdown: [TOTAL_AREA],
  };
}

/**
 * Every measure the loader builds, in extract order. A decade and condition missing here is missing
 * from NHGIS by race at nation and state level, not overlooked: 1890 has no literacy table at all,
 * no census before 1970 crosses urban residence with race, 1940 and 1950 publish no attainment,
 * unemployment or income by race, and 1960 publishes nothing by race except the population itself.
 */
export const LIVES_HISTORICAL_MEASURES: readonly LivesHistoricalMeasure[] = [
  // ---- 1870 --------------------------------------------------------------------------------
  {
    census: 1870,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: RACE_1870('AK3002', 'Colored'),
    denominator: EVERYONE_1870,
    title: 'Race (1870_cPAX NT4) over Total Population (NT1)',
    universe: 'Persons',
    note: '"Colored" in 1870 is Black: Chinese and Indian are counted in their own columns. The Census Office itself doubted the 1870 returns for several ex-Confederate states.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1870,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: RACE_1870('AK3001', 'White'),
    denominator: EVERYONE_1870,
    title: 'Race (1870_cPAX NT4) over Total Population (NT1)',
    universe: 'Persons',
    levels: NATION_AND_STATE,
  },
  {
    census: 1870,
    series: LIVES_SERIES.schoolAttendance,
    slice: 'black',
    kind: 'share',
    numerator: SCHOOL_1870([
      { code: 'AJ5003', text: 'Colored >> Male' },
      { code: 'AJ5004', text: 'Colored >> Female' },
    ]),
    denominator: SCHOOL_AGE_1870([
      { code: 'AMN003', text: 'Colored >> Male' },
      { code: 'AMN004', text: 'Colored >> Female' },
    ]),
    title:
      'Persons Attending School by Race by Sex (1870_cPAX NT11) over Population 5 to 18 Years of Age by Race by Sex (1870_sPHX NT41)',
    universe: 'Persons attending school, over persons 5 to 18 years of age',
    note: 'School attendance per 100 children aged 5 to 18, not the share of children 5 to 18 attending school: the numerator counts everyone attending school at any age, and the two tables come from different published volumes.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1870,
    series: LIVES_SERIES.schoolAttendance,
    slice: 'white',
    kind: 'share',
    numerator: SCHOOL_1870([
      { code: 'AJ5001', text: 'White >> Male' },
      { code: 'AJ5002', text: 'White >> Female' },
    ]),
    denominator: SCHOOL_AGE_1870([
      { code: 'AMN001', text: 'White >> Male' },
      { code: 'AMN002', text: 'White >> Female' },
    ]),
    title:
      'Persons Attending School by Race by Sex (1870_cPAX NT11) over Population 5 to 18 Years of Age by Race by Sex (1870_sPHX NT41)',
    universe: 'Persons attending school, over persons 5 to 18 years of age',
    note: 'School attendance per 100 children aged 5 to 18, not the share of children 5 to 18 attending school: the numerator counts everyone attending school at any age, and the two tables come from different published volumes.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1870,
    series: LIVES_SERIES.literacy,
    slice: 'black',
    kind: 'complement',
    numerator: {
      dataset: '1870_cPAX',
      table: 'NT16',
      code: 'AKA',
      variables: [{ code: 'AKA011', text: 'Colored >> 21 years of age and over >> Male' }],
    },
    denominator: {
      dataset: '1870_sPHX',
      table: 'NT47',
      code: 'AMT',
      variables: [{ code: 'AMT002', text: 'Colored' }],
    },
    title:
      'Persons Who Cannot Write by Race by Age by Sex (1870_cPAX NT16) over Male Population 21 Years of Age and Over by Race (1870_sPHX NT47)',
    universe: 'Males 21 years and over',
    note: 'Men 21 and over who could write, not the 10-and-over rate the other decades give: 1870 publishes no population 10 and over by race. The published measure is "cannot write"; 1870 publishes "cannot read" only as an all-races total.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1870,
    series: LIVES_SERIES.literacy,
    slice: 'white',
    kind: 'complement',
    numerator: {
      dataset: '1870_cPAX',
      table: 'NT16',
      code: 'AKA',
      variables: [{ code: 'AKA005', text: 'White >> 21 years of age and over >> Male' }],
    },
    denominator: {
      dataset: '1870_sPHX',
      table: 'NT47',
      code: 'AMT',
      variables: [{ code: 'AMT001', text: 'White' }],
    },
    title:
      'Persons Who Cannot Write by Race by Age by Sex (1870_cPAX NT16) over Male Population 21 Years of Age and Over by Race (1870_sPHX NT47)',
    universe: 'Males 21 years and over',
    note: 'Men 21 and over who could write, not the 10-and-over rate the other decades give: 1870 publishes no population 10 and over by race. The published measure is "cannot write"; 1870 publishes "cannot read" only as an all-races total.',
    levels: NATION_AND_STATE,
  },

  // ---- 1880 --------------------------------------------------------------------------------
  {
    census: 1880,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1880_cPAX',
      table: 'NT4',
      code: 'APP',
      variables: [{ code: 'APP002', text: 'Colored' }],
    },
    denominator: {
      dataset: '1880_cPAX',
      table: 'NT1',
      code: 'AOT',
      variables: [{ code: 'AOT001', text: 'Total' }],
    },
    title: 'Race (1880_cPAX NT4) over Total Population (NT1)',
    universe: 'Persons',
    note: '"Colored" in 1880 is Black: Chinese and Indian are counted in their own columns.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1880,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1880_cPAX',
      table: 'NT4',
      code: 'APP',
      variables: [{ code: 'APP001', text: 'White' }],
    },
    denominator: {
      dataset: '1880_cPAX',
      table: 'NT1',
      code: 'AOT',
      variables: [{ code: 'AOT001', text: 'Total' }],
    },
    title: 'Race (1880_cPAX NT4) over Total Population (NT1)',
    universe: 'Persons',
    levels: NATION_AND_STATE,
  },
  {
    census: 1880,
    series: LIVES_SERIES.literacy,
    slice: 'black',
    kind: 'complement',
    numerator: {
      dataset: '1880_sPHX',
      table: 'NT19',
      code: 'ASA',
      variables: literacyCells1880('ASA', 'Colored', 7),
    },
    denominator: {
      dataset: '1880_sPHX',
      table: 'NT18',
      code: 'AR9',
      variables: literacyCells1880('AR9', 'Colored', 7),
    },
    title:
      'Persons 10 Years of Age and Over Who Cannot Write by Race by Age by Sex (1880_sPHX NT19) over Persons 10 Years of Age and Over by Race by Age by Sex (NT18)',
    universe: 'Persons 10 years and over',
    note: 'The published measure is "cannot write"; the 1880 "cannot read" count is all races together and is not mixed in here.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1880,
    series: LIVES_SERIES.literacy,
    slice: 'white',
    kind: 'complement',
    numerator: {
      dataset: '1880_sPHX',
      table: 'NT19',
      code: 'ASA',
      variables: literacyCells1880('ASA', 'White', 1),
    },
    denominator: {
      dataset: '1880_sPHX',
      table: 'NT18',
      code: 'AR9',
      variables: literacyCells1880('AR9', 'White', 1),
    },
    title:
      'Persons 10 Years of Age and Over Who Cannot Write by Race by Age by Sex (1880_sPHX NT19) over Persons 10 Years of Age and Over by Race by Age by Sex (NT18)',
    universe: 'Persons 10 years and over',
    note: 'The published measure is "cannot write"; the 1880 "cannot read" count is all races together and is not mixed in here.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1880,
    series: LIVES_SERIES.schoolAttendance,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1880_sPbSMX',
      table: 'NT25',
      code: 'AQR',
      variables: [{ code: 'AQR002', text: 'Colored' }],
    },
    denominator: {
      dataset: '1880_sPHX',
      table: 'NT2',
      code: 'ASB',
      variables: [
        { code: 'ASB005', text: 'Colored >> Male' },
        { code: 'ASB006', text: 'Colored >> Female' },
      ],
    },
    title:
      'Total Number of Pupils Attending School During the Year by Race (1880_sPbSMX NT25) over Population 5 to 17 Years of Age by Race/Nativity by Sex (1880_sPHX NT2)',
    universe: 'Public school pupils during the year, over persons 5 to 17 years of age',
    note: 'Public-school enrollment per 100 children aged 5 to 17. The numerator comes from school-board returns, counts pupils of any age enrolled at some point in the year, and leaves out private and parochial pupils; 1880 publishes no attendance-by-race figure from the population schedule.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1880,
    series: LIVES_SERIES.schoolAttendance,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1880_sPbSMX',
      table: 'NT25',
      code: 'AQR',
      variables: [{ code: 'AQR001', text: 'White' }],
    },
    denominator: {
      dataset: '1880_sPHX',
      table: 'NT2',
      code: 'ASB',
      variables: [
        { code: 'ASB001', text: 'White: Native-born >> Male' },
        { code: 'ASB002', text: 'White: Native-born >> Female' },
        { code: 'ASB003', text: 'White: Foreign-born >> Male' },
        { code: 'ASB004', text: 'White: Foreign-born >> Female' },
      ],
    },
    title:
      'Total Number of Pupils Attending School During the Year by Race (1880_sPbSMX NT25) over Population 5 to 17 Years of Age by Race/Nativity by Sex (1880_sPHX NT2)',
    universe: 'Public school pupils during the year, over persons 5 to 17 years of age',
    note: 'Public-school enrollment per 100 children aged 5 to 17. The numerator comes from school-board returns, counts pupils of any age enrolled at some point in the year, and leaves out private and parochial pupils; 1880 publishes no attendance-by-race figure from the population schedule.',
    levels: NATION_AND_STATE,
  },

  // ---- 1890 --------------------------------------------------------------------------------
  {
    census: 1890,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1890_cPHAM',
      table: 'NT4',
      code: 'AVF',
      variables: [{ code: 'AVF001', text: 'Negro >> 1890' }],
    },
    denominator: {
      dataset: '1890_cPHAM',
      table: 'NT1',
      code: 'AUM',
      variables: [{ code: 'AUM001', text: 'Total' }],
    },
    title: 'Non-White Population by Race by Year (1890_cPHAM NT4) over Total Population (NT1)',
    universe: 'Persons',
    note: 'Read from the Negro column of the race-by-year table. 1890\'s "Colored" elsewhere is Negro, Chinese, Japanese and civilized Indian together, and is not Black. 1890 also split Black people by blood fraction, a question the Census Bureau itself treated as unreliable.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1890,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1890_cPHAM',
      table: 'NT61',
      code: 'AV2',
      variables: [{ code: 'AV2001', text: 'Total' }],
    },
    denominator: {
      dataset: '1890_cPHAM',
      table: 'NT1',
      code: 'AUM',
      variables: [{ code: 'AUM001', text: 'Total' }],
    },
    title: 'Total White Population (1890_cPHAM NT61) over Total Population (NT1)',
    universe: 'Persons',
    levels: NATION_AND_STATE,
  },
  {
    census: 1890,
    series: LIVES_SERIES.schoolAttendance,
    slice: 'nonwhite',
    kind: 'share',
    numerator: {
      dataset: '1890_cPHAM',
      table: 'NT44',
      code: 'AVK',
      variables: [
        { code: 'AVK007', text: 'Pupils >> Colored >> Male' },
        { code: 'AVK008', text: 'Pupils >> Colored >> Female' },
      ],
    },
    denominator: {
      dataset: '1890_cPHAM',
      table: 'NT10',
      code: 'AUN',
      variables: [
        { code: 'AUN005', text: 'Colored >> Male' },
        { code: 'AUN006', text: 'Colored >> Female' },
      ],
    },
    title:
      'Persons in Common Schools by Race by Sex (1890_cPHAM NT44) over Population 5 to 20 Years of Age by Race/Nativity by Sex (NT10)',
    universe: 'Common school pupils, over persons 5 to 20 years of age',
    note: '"Colored" in both 1890 tables is every non-white group counted together — Negro, Chinese, Japanese and civilized Indian — so this is not a Black rate. Common schools are public schools, so the numerator is enrollment from school returns rather than a census attendance count, and the age base is 5 to 20 where 1870 used 5 to 18 and 1880 used 5 to 17.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1890,
    series: LIVES_SERIES.schoolAttendance,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1890_cPHAM',
      table: 'NT44',
      code: 'AVK',
      variables: [
        { code: 'AVK005', text: 'Pupils >> White >> Male' },
        { code: 'AVK006', text: 'Pupils >> White >> Female' },
      ],
    },
    denominator: {
      dataset: '1890_cPHAM',
      table: 'NT10',
      code: 'AUN',
      variables: [
        { code: 'AUN001', text: 'White: Native-born >> Male' },
        { code: 'AUN002', text: 'White: Native-born >> Female' },
        { code: 'AUN003', text: 'White: Foreign-born >> Male' },
        { code: 'AUN004', text: 'White: Foreign-born >> Female' },
      ],
    },
    title:
      'Persons in Common Schools by Race by Sex (1890_cPHAM NT44) over Population 5 to 20 Years of Age by Race/Nativity by Sex (NT10)',
    universe: 'Common school pupils, over persons 5 to 20 years of age',
    note: 'Common schools are public schools, so the numerator is enrollment from school returns rather than a census attendance count, and the age base is 5 to 20 where 1870 used 5 to 18 and 1880 used 5 to 17.',
    levels: NATION_AND_STATE,
  },

  // ---- 1900 --------------------------------------------------------------------------------
  {
    census: 1900,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1900_cPHAM',
      table: 'NT7',
      code: 'AZ3',
      variables: [
        { code: 'AZ3003', text: 'Negro >> Male' },
        { code: 'AZ3004', text: 'Negro >> Female' },
      ],
    },
    denominator: {
      dataset: '1900_cPHAM',
      table: 'NT1',
      code: 'AYM',
      variables: [{ code: 'AYM001', text: 'Total' }],
    },
    title: 'Non-White Population by Race by Sex (1900_cPHAM NT7) over Total Population (NT1)',
    universe: 'Persons',
    levels: NATION_AND_STATE,
  },
  {
    census: 1900,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1900_cPHAM',
      table: 'NT64',
      code: 'AZ2',
      variables: [{ code: 'AZ2001', text: 'Total' }],
    },
    denominator: {
      dataset: '1900_cPHAM',
      table: 'NT1',
      code: 'AYM',
      variables: [{ code: 'AYM001', text: 'Total' }],
    },
    title: 'Total White Population (1900_cPHAM NT64) over Total Population (NT1)',
    universe: 'Persons',
    levels: NATION_AND_STATE,
  },
  {
    census: 1900,
    series: LIVES_SERIES.literacy,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1900_cPHAM',
      table: 'NT10',
      code: 'AYN',
      variables: [{ code: 'AYN003', text: 'Negro >> Literate' }],
    },
    denominator: {
      dataset: '1900_cPHAM',
      table: 'NT10',
      code: 'AYN',
      variables: [
        { code: 'AYN003', text: 'Negro >> Literate' },
        { code: 'AYN004', text: 'Negro >> Illiterate' },
      ],
    },
    title: 'Native-Born Males 21 Years of Age and Over by Race by Literacy (1900_cPHAM NT10)',
    universe: 'Native-born males 21 years and over',
    note: 'Native-born men 21 and over, a much narrower universe than the 1880 and 1910 rates for everyone 10 and over: 1900 publishes illiterate counts for the whole 10-and-over population by race but no matching base.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1900,
    series: LIVES_SERIES.literacy,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1900_cPHAM',
      table: 'NT10',
      code: 'AYN',
      variables: [{ code: 'AYN001', text: 'White >> Literate' }],
    },
    denominator: {
      dataset: '1900_cPHAM',
      table: 'NT10',
      code: 'AYN',
      variables: [
        { code: 'AYN001', text: 'White >> Literate' },
        { code: 'AYN002', text: 'White >> Illiterate' },
      ],
    },
    title: 'Native-Born Males 21 Years of Age and Over by Race by Literacy (1900_cPHAM NT10)',
    universe: 'Native-born males 21 years and over',
    note: 'Native-born men 21 and over, a much narrower universe than the 1880 and 1910 rates for everyone 10 and over: 1900 publishes illiterate counts for the whole 10-and-over population by race but no matching base.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1900,
    series: LIVES_SERIES.farmTenancy,
    slice: 'nonwhite',
    kind: 'share',
    numerator: {
      dataset: '1900_cPHAM',
      table: 'NT51',
      code: 'AZO',
      variables: [
        { code: 'AZO011', text: 'Colored >> Cash tenant' },
        { code: 'AZO012', text: 'Colored >> Share tenant' },
      ],
    },
    denominator: {
      dataset: '1900_cPHAM',
      table: 'NT51',
      code: 'AZO',
      variables: [
        { code: 'AZO007', text: 'Colored >> Owner' },
        { code: 'AZO008', text: 'Colored >> Part owner' },
        { code: 'AZO009', text: 'Colored >> Owner and tenant' },
        { code: 'AZO010', text: 'Colored >> Farm manager' },
        { code: 'AZO011', text: 'Colored >> Cash tenant' },
        { code: 'AZO012', text: 'Colored >> Share tenant' },
      ],
    },
    title: 'Number of Farms by Race of Farmer by Tenure of Farmer (1900_cPHAM NT51)',
    universe: 'Farms',
    note: '"Colored" in the 1900 farm table is every non-white operator counted together, not Negro alone, so this is not a Black rate. The unit is the farm, not the farmer and not the household; "Part owner" and "Owner and tenant" are mixed categories and count as neither tenants nor clean owners here.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1900,
    series: LIVES_SERIES.farmTenancy,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1900_cPHAM',
      table: 'NT51',
      code: 'AZO',
      variables: [
        { code: 'AZO005', text: 'White >> Cash tenant' },
        { code: 'AZO006', text: 'White >> Share tenant' },
      ],
    },
    denominator: {
      dataset: '1900_cPHAM',
      table: 'NT51',
      code: 'AZO',
      variables: [
        { code: 'AZO001', text: 'White >> Owner' },
        { code: 'AZO002', text: 'White >> Part owner' },
        { code: 'AZO003', text: 'White >> Owner and tenant' },
        { code: 'AZO004', text: 'White >> Farm manager' },
        { code: 'AZO005', text: 'White >> Cash tenant' },
        { code: 'AZO006', text: 'White >> Share tenant' },
      ],
    },
    title: 'Number of Farms by Race of Farmer by Tenure of Farmer (1900_cPHAM NT51)',
    universe: 'Farms',
    note: 'The unit is the farm, not the farmer and not the household; "Part owner" and "Owner and tenant" are mixed categories and count as neither tenants nor clean owners here.',
    levels: NATION_AND_STATE,
  },

  // ---- 1910 --------------------------------------------------------------------------------
  {
    census: 1910,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1910_cPHA',
      table: 'NT11',
      code: 'A30',
      variables: [
        { code: 'A30003', text: 'Negro >> Male' },
        { code: 'A30004', text: 'Negro >> Female' },
      ],
    },
    denominator: {
      dataset: '1910_cPHA',
      table: 'NT1',
      code: 'A3Y',
      variables: [{ code: 'A3Y001', text: '1910' }],
    },
    title: 'Race by Sex (1910_cPHA NT11) over Total Population by Year (NT1)',
    universe: 'Persons',
    note: 'The 1910 total-population table publishes 1910 and 1900 side by side; this reads the 1910 column.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1910,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1910_cPHA',
      table: 'NT11',
      code: 'A30',
      variables: [
        { code: 'A30001', text: 'White >> Male' },
        { code: 'A30002', text: 'White >> Female' },
      ],
    },
    denominator: {
      dataset: '1910_cPHA',
      table: 'NT1',
      code: 'A3Y',
      variables: [{ code: 'A3Y001', text: '1910' }],
    },
    title: 'Race by Sex (1910_cPHA NT11) over Total Population by Year (NT1)',
    universe: 'Persons',
    note: 'The 1910 total-population table publishes 1910 and 1900 side by side; this reads the 1910 column.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1910,
    series: LIVES_SERIES.literacy,
    slice: 'black',
    kind: 'complement',
    numerator: {
      dataset: '1910_cPHA',
      table: 'NT24',
      code: 'A4A',
      variables: [{ code: 'A4A003', text: 'Negro' }],
    },
    denominator: {
      dataset: '1910_cPHA',
      table: 'NT23',
      code: 'A39',
      variables: [{ code: 'A39003', text: 'Negro' }],
    },
    title:
      'Illiterate Population 10 Years of Age and Over by Race/Nativity (1910_cPHA NT24) over Population 10 Years of Age and Over by Race/Nativity (NT23)',
    universe: 'Persons 10 years and over',
    levels: NATION_AND_STATE,
  },
  {
    census: 1910,
    series: LIVES_SERIES.literacy,
    slice: 'white',
    kind: 'complement',
    numerator: {
      dataset: '1910_cPHA',
      table: 'NT24',
      code: 'A4A',
      variables: [
        { code: 'A4A001', text: 'White: Native-born' },
        { code: 'A4A002', text: 'White: Foreign-born' },
      ],
    },
    denominator: {
      dataset: '1910_cPHA',
      table: 'NT23',
      code: 'A39',
      variables: [
        { code: 'A39001', text: 'White: Native-born' },
        { code: 'A39002', text: 'White: Foreign-born' },
      ],
    },
    title:
      'Illiterate Population 10 Years of Age and Over by Race/Nativity (1910_cPHA NT24) over Population 10 Years of Age and Over by Race/Nativity (NT23)',
    universe: 'Persons 10 years and over',
    note: 'White here is native-born and foreign-born summed, a different white definition from the 1910 population table, which does not split by nativity.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1910,
    series: LIVES_SERIES.schoolAttendance,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1910_cPHA',
      table: 'NT36',
      code: 'A4L',
      variables: [{ code: 'A4L004', text: 'Negro' }],
    },
    denominator: {
      dataset: '1910_cPHA',
      table: 'NT35',
      code: 'A4K',
      variables: [{ code: 'A4K004', text: 'Negro' }],
    },
    title:
      'Population 6 to 14 Years of Age Attending School by Race/Nativity (1910_cPHA NT36) over Population 6 to 14 Years of Age by Race/Nativity (NT35)',
    universe: 'Persons 6 to 14 years of age',
    note: 'The 1910 race-crossed attendance table covers ages 6 to 14, where 1870 used 5 to 18, 1880 used 5 to 17 and 1890 used 5 to 20. The decades are not one series.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1910,
    series: LIVES_SERIES.schoolAttendance,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1910_cPHA',
      table: 'NT36',
      code: 'A4L',
      variables: [
        { code: 'A4L001', text: 'White: Native-born with native parentage' },
        { code: 'A4L002', text: 'White: Native-born with foreign or mixed parentage' },
        { code: 'A4L003', text: 'White: Foreign-born' },
      ],
    },
    denominator: {
      dataset: '1910_cPHA',
      table: 'NT35',
      code: 'A4K',
      variables: [
        { code: 'A4K001', text: 'White: Native-born with native parentage' },
        { code: 'A4K002', text: 'White: Native-born with foreign or mixed parentage' },
        { code: 'A4K003', text: 'White: Foreign-born' },
      ],
    },
    title:
      'Population 6 to 14 Years of Age Attending School by Race/Nativity (1910_cPHA NT36) over Population 6 to 14 Years of Age by Race/Nativity (NT35)',
    universe: 'Persons 6 to 14 years of age',
    note: 'The 1910 race-crossed attendance table covers ages 6 to 14, where 1870 used 5 to 18, 1880 used 5 to 17 and 1890 used 5 to 20. The decades are not one series.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1910,
    series: LIVES_SERIES.farmTenancy,
    slice: 'nonwhite',
    kind: 'share',
    numerator: {
      dataset: '1910_sOccFarmer',
      table: 'NT12',
      code: 'A5F',
      variables: [{ code: 'A5F004', text: 'Tenant >> Colored' }],
    },
    denominator: {
      dataset: '1910_sOccFarmer',
      table: 'NT12',
      code: 'A5F',
      variables: [
        { code: 'A5F002', text: 'Owner >> Colored' },
        { code: 'A5F004', text: 'Tenant >> Colored' },
        { code: 'A5F006', text: 'Manager >> Colored' },
      ],
    },
    title: 'Tenure of Farmer by Race of Farmer (1910_sOccFarmer NT12)',
    universe: 'Farms',
    note: '"Colored" folds in every non-white operator, not Negro alone, so this is not a Black rate. The unit is the farm; 1910 has no part-owner and no cropper class, both of which arrive in 1930.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1910,
    series: LIVES_SERIES.farmTenancy,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1910_sOccFarmer',
      table: 'NT12',
      code: 'A5F',
      variables: [{ code: 'A5F003', text: 'Tenant >> White' }],
    },
    denominator: {
      dataset: '1910_sOccFarmer',
      table: 'NT12',
      code: 'A5F',
      variables: [
        { code: 'A5F001', text: 'Owner >> White' },
        { code: 'A5F003', text: 'Tenant >> White' },
        { code: 'A5F005', text: 'Manager >> White' },
      ],
    },
    title: 'Tenure of Farmer by Race of Farmer (1910_sOccFarmer NT12)',
    universe: 'Farms',
    note: 'The unit is the farm; 1910 has no part-owner and no cropper class, both of which arrive in 1930.',
    levels: NATION_AND_STATE,
  },

  // ---- 1920 --------------------------------------------------------------------------------
  {
    census: 1920,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1920_cPHAM',
      table: 'NT5',
      code: 'A8L',
      variables: [
        { code: 'A8L005', text: 'Negro >> Male' },
        { code: 'A8L006', text: 'Negro >> Female' },
      ],
    },
    denominator: {
      dataset: '1920_cPHAM',
      table: 'NT1',
      code: 'A7L',
      variables: [{ code: 'A7L001', text: 'Total' }],
    },
    title: 'Race/Nativity by Sex (1920_cPHAM NT5) over Total Population (NT1)',
    universe: 'Persons',
    levels: NATION_AND_STATE,
  },
  {
    census: 1920,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1920_cPHAM',
      table: 'NT5',
      code: 'A8L',
      variables: [
        { code: 'A8L001', text: 'White: Native-born >> Male' },
        { code: 'A8L002', text: 'White: Native-born >> Female' },
        { code: 'A8L003', text: 'White: Foreign-born >> Male' },
        { code: 'A8L004', text: 'White: Foreign-born >> Female' },
      ],
    },
    denominator: {
      dataset: '1920_cPHAM',
      table: 'NT1',
      code: 'A7L',
      variables: [{ code: 'A7L001', text: 'Total' }],
    },
    title: 'Race/Nativity by Sex (1920_cPHAM NT5) over Total Population (NT1)',
    universe: 'Persons',
    note: 'White is native-born and foreign-born summed; 1910 published a single white column.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1920,
    series: LIVES_SERIES.literacy,
    slice: 'black',
    kind: 'complement',
    numerator: {
      dataset: '1920_cPHAM',
      table: 'NT22',
      code: 'A7W',
      variables: [{ code: 'A7W003', text: 'Negro' }],
    },
    denominator: {
      dataset: '1920_cPHAM',
      table: 'NT21',
      code: 'A7V',
      variables: [{ code: 'A7V003', text: 'Negro' }],
    },
    title:
      'Illiterate Population 10 Years of Age and Over by Race/Nativity (1920_cPHAM NT22) over Population 10 Years of Age and Over by Race/Nativity (NT21)',
    universe: 'Persons 10 years and over',
    levels: NATION_AND_STATE,
  },
  {
    census: 1920,
    series: LIVES_SERIES.literacy,
    slice: 'white',
    kind: 'complement',
    numerator: {
      dataset: '1920_cPHAM',
      table: 'NT22',
      code: 'A7W',
      variables: [
        { code: 'A7W001', text: 'White: Native-born' },
        { code: 'A7W002', text: 'White: Foreign-born' },
      ],
    },
    denominator: {
      dataset: '1920_cPHAM',
      table: 'NT21',
      code: 'A7V',
      variables: [
        { code: 'A7V001', text: 'White: Native-born' },
        { code: 'A7V002', text: 'White: Foreign-born' },
      ],
    },
    title:
      'Illiterate Population 10 Years of Age and Over by Race/Nativity (1920_cPHAM NT22) over Population 10 Years of Age and Over by Race/Nativity (NT21)',
    universe: 'Persons 10 years and over',
    levels: NATION_AND_STATE,
  },
  {
    census: 1920,
    series: LIVES_SERIES.farmTenancy,
    slice: 'nonwhite',
    kind: 'share',
    numerator: {
      dataset: '1920_sOccFarmer',
      table: 'NT22',
      code: 'A9M',
      variables: [{ code: 'A9M006', text: 'Tenant >> Colored' }],
    },
    denominator: {
      dataset: '1920_sOccFarmer',
      table: 'NT22',
      code: 'A9M',
      variables: [
        { code: 'A9M002', text: 'Owner >> Colored' },
        { code: 'A9M004', text: 'Manager >> Colored' },
        { code: 'A9M006', text: 'Tenant >> Colored' },
      ],
    },
    title: 'Tenure of Farmer by Race of Farmer (1920_sOccFarmer NT22)',
    universe: 'Farms',
    note: '"Colored" folds in every non-white operator, not Negro alone, so this is not a Black rate. The unit is the farm. 1920 orders the tenure classes owner, manager, tenant where 1910 orders them owner, tenant, manager.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1920,
    series: LIVES_SERIES.farmTenancy,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1920_sOccFarmer',
      table: 'NT22',
      code: 'A9M',
      variables: [{ code: 'A9M005', text: 'Tenant >> White' }],
    },
    denominator: {
      dataset: '1920_sOccFarmer',
      table: 'NT22',
      code: 'A9M',
      variables: [
        { code: 'A9M001', text: 'Owner >> White' },
        { code: 'A9M003', text: 'Manager >> White' },
        { code: 'A9M005', text: 'Tenant >> White' },
      ],
    },
    title: 'Tenure of Farmer by Race of Farmer (1920_sOccFarmer NT22)',
    universe: 'Farms',
    note: 'The unit is the farm. 1920 orders the tenure classes owner, manager, tenant where 1910 orders them owner, tenant, manager.',
    levels: NATION_AND_STATE,
  },

  // ---- 1930 --------------------------------------------------------------------------------
  {
    census: 1930,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1930_cPAE',
      table: 'NT5',
      code: 'BEP',
      variables: [
        { code: 'BEP005', text: 'Negro >> Male' },
        { code: 'BEP006', text: 'Negro >> Female' },
      ],
    },
    denominator: {
      dataset: '1930_cPAE',
      table: 'NT1',
      code: 'BDP',
      variables: [{ code: 'BDP001', text: 'Total' }],
    },
    title: 'Race/Nativity by Sex (1930_cPAE NT5) over Total Population (NT1)',
    universe: 'Persons',
    note: '1930 counted "Mexican" as a race, but no NHGIS 1930 table at nation or state level names it: those people sit inside an undifferentiated non-white, non-Negro residual that also holds American Indian, Chinese and Japanese counts. There is no 1930 Mexican figure here and no Hispanic one.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1930_cPAE',
      table: 'NT5',
      code: 'BEP',
      variables: [
        { code: 'BEP001', text: 'White: Native-born >> Male' },
        { code: 'BEP002', text: 'White: Native-born >> Female' },
        { code: 'BEP003', text: 'White: Foreign-born >> Male' },
        { code: 'BEP004', text: 'White: Foreign-born >> Female' },
      ],
    },
    denominator: {
      dataset: '1930_cPAE',
      table: 'NT1',
      code: 'BDP',
      variables: [{ code: 'BDP001', text: 'Total' }],
    },
    title: 'Race/Nativity by Sex (1930_cPAE NT5) over Total Population (NT1)',
    universe: 'Persons',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.homeownership,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1930_cFH',
      table: 'NT8',
      code: 'BGV',
      variables: [{ code: 'BGV003', text: 'Owner >> Negro' }],
    },
    denominator: {
      dataset: '1930_cFH',
      table: 'NT8',
      code: 'BGV',
      variables: [
        { code: 'BGV003', text: 'Owner >> Negro' },
        { code: 'BGV006', text: 'Renter >> Negro' },
      ],
    },
    title: 'Families by Tenant Status by Race/Nativity of Head (1930_cFH NT8)',
    universe: 'Families',
    note: 'The unit is the family, not the housing unit and not the household, so this is not the same count as the 1940 dwelling units or the 1970 and later occupied housing units. The all-families table has a third "unknown tenancy status" class that the race-crossed table does not, so these rates will not reconcile against it.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.homeownership,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1930_cFH',
      table: 'NT8',
      code: 'BGV',
      variables: [
        { code: 'BGV001', text: 'Owner >> White: Native born' },
        { code: 'BGV002', text: 'Owner >> White: Foreign born' },
      ],
    },
    denominator: {
      dataset: '1930_cFH',
      table: 'NT8',
      code: 'BGV',
      variables: [
        { code: 'BGV001', text: 'Owner >> White: Native born' },
        { code: 'BGV002', text: 'Owner >> White: Foreign born' },
        { code: 'BGV004', text: 'Renter >> White: Native born' },
        { code: 'BGV005', text: 'Renter >> White: Foreign born' },
      ],
    },
    title: 'Families by Tenant Status by Race/Nativity of Head (1930_cFH NT8)',
    universe: 'Families',
    note: 'The unit is the family, not the housing unit and not the household. The 1930 family and housing tables write "White: Native born" without the hyphen the population tables use.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.medianHomeValue,
    slice: 'black',
    kind: 'median',
    numerator: {
      dataset: '1930_cFH',
      table: 'NT17',
      code: 'BFX',
      variables: [{ code: 'BFX003', text: 'Median value of non-farm homes >> Negro' }],
    },
    denominator: {
      dataset: '1930_cFH',
      table: 'NT17',
      code: 'BFX',
      variables: [{ code: 'BFX003', text: 'Median value of non-farm homes >> Negro' }],
    },
    title: 'Median Value of Non-Farm Homes by Race/Nativity of Owner (1930_cFH NT17)',
    universe: 'Non-Farm Homes',
    note: 'Published median, not a count. Do not sum states into a region. NHGIS labels the universe Non-Farm Homes; the all-race companion is owned nonfarm homes. White native-born and foreign-born medians are not averaged into a white figure.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.medianHomeValue,
    slice: 'all',
    kind: 'median',
    numerator: {
      dataset: '1930_cFH',
      table: 'NT16',
      code: 'BFW',
      variables: [{ code: 'BFW001', text: 'Median value of non-farm homes' }],
    },
    denominator: {
      dataset: '1930_cFH',
      table: 'NT16',
      code: 'BFW',
      variables: [{ code: 'BFW001', text: 'Median value of non-farm homes' }],
    },
    title: 'Median Value of All Owned Non-Farm Homes (1930_cFH NT16)',
    universe: 'Owned Non-Farm Homes',
    note: 'Published median, not a count. Do not sum states into a region. All-race owned nonfarm homes; not a white figure.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.medianRent,
    slice: 'black',
    kind: 'median',
    numerator: {
      dataset: '1930_cFH',
      table: 'NT22',
      code: 'BF1',
      variables: [{ code: 'BF1003', text: 'Median monthly rent >> Negro' }],
    },
    denominator: {
      dataset: '1930_cFH',
      table: 'NT22',
      code: 'BF1',
      variables: [{ code: 'BF1003', text: 'Median monthly rent >> Negro' }],
    },
    title: 'Median Monthly Rent of Non-Farm Homes by Race/Nativity of Tenant (1930_cFH NT22)',
    universe: 'Occupied Non-Farm Homes',
    note: 'Published median monthly contract rent, not a count. Do not sum states into a region. NHGIS labels the universe Occupied Non-Farm Homes; the all-race companion is rented nonfarm homes. White native-born and foreign-born medians are not averaged into a white figure.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.medianRent,
    slice: 'all',
    kind: 'median',
    numerator: {
      dataset: '1930_cFH',
      table: 'NT21',
      code: 'BF0',
      variables: [{ code: 'BF0001', text: 'Median monthly rent' }],
    },
    denominator: {
      dataset: '1930_cFH',
      table: 'NT21',
      code: 'BF0',
      variables: [{ code: 'BF0001', text: 'Median monthly rent' }],
    },
    title: 'Median Monthly Rent of All Tenants in Rented Non-Farm Homes (1930_cFH NT21)',
    universe: 'Rented Non-Farm Homes',
    note: 'Published median, not a count. Do not sum states into a region. All-race rented nonfarm homes; not a white figure.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.literacy,
    slice: 'black',
    kind: 'complement',
    numerator: {
      dataset: '1930_cPAE',
      table: 'NT20',
      code: 'BDY',
      variables: [{ code: 'BDY003', text: 'Negro' }],
    },
    denominator: {
      dataset: '1930_cPAE',
      table: 'NT19',
      code: 'BDW',
      variables: [{ code: 'BDW003', text: 'Negro' }],
    },
    title:
      'Illiterate Population 10 Years of Age and Over by Race/Nativity (1930_cPAE NT20) over Population 10 Years of Age and Over by Race/Nativity (NT19)',
    universe: 'Persons 10 years and over',
    note: '1930 is the last census to publish illiteracy this way. 1940 replaced it with years of school completed, which is a different question, not a continuation.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.literacy,
    slice: 'white',
    kind: 'complement',
    numerator: {
      dataset: '1930_cPAE',
      table: 'NT20',
      code: 'BDY',
      variables: [
        { code: 'BDY001', text: 'White: Native-born' },
        { code: 'BDY002', text: 'White: Foreign-born' },
      ],
    },
    denominator: {
      dataset: '1930_cPAE',
      table: 'NT19',
      code: 'BDW',
      variables: [
        { code: 'BDW001', text: 'White: Native-born' },
        { code: 'BDW002', text: 'White: Foreign-born' },
      ],
    },
    title:
      'Illiterate Population 10 Years of Age and Over by Race/Nativity (1930_cPAE NT20) over Population 10 Years of Age and Over by Race/Nativity (NT19)',
    universe: 'Persons 10 years and over',
    note: '1930 is the last census to publish illiteracy this way. 1940 replaced it with years of school completed, which is a different question, not a continuation.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.farmTenancy,
    slice: 'nonwhite',
    kind: 'share',
    numerator: {
      dataset: '1930_cAg',
      table: 'NT002',
      code: 'AB96',
      variables: [{ code: 'AB96014', text: 'Farms of colored tenants, number, 1930' }],
    },
    denominator: {
      dataset: '1930_cAg',
      table: 'NT002',
      code: 'AB96',
      variables: [
        { code: 'AB96011', text: 'Farms of colored full owners, number, 1930' },
        { code: 'AB96012', text: 'Farms of colored part owners, number, 1930' },
        { code: 'AB96013', text: 'Farms of colored managers, number, 1930' },
        { code: 'AB96014', text: 'Farms of colored tenants, number, 1930' },
      ],
    },
    title: 'Farms by Race and Tenure of Operator (1930_cAg NT002)',
    universe: 'Farms',
    note: '"Colored" folds in every non-white operator, not Negro alone, so this is not a Black rate. The 1930 Census of Agriculture crossed race with tenure only for the seventeen Southern and border states and DC, so the other states have no figure. The tenure classes changed in 1930: owners split into full owners and part owners, and croppers became a class inside the main table, where 1910 and 1920 published owner, tenant and manager with cropper detail in a separate table.',
    levels: STATE,
  },
  {
    census: 1930,
    series: LIVES_SERIES.farmTenancy,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1930_cAg',
      table: 'NT002',
      code: 'AB96',
      variables: [{ code: 'AB96006', text: 'Farms of white tenants, number, 1930' }],
    },
    denominator: {
      dataset: '1930_cAg',
      table: 'NT002',
      code: 'AB96',
      variables: [
        { code: 'AB96003', text: 'Farms of white full owners, number, 1930' },
        { code: 'AB96004', text: 'Farms of white part owners, number, 1930' },
        { code: 'AB96005', text: 'Farms of white managers, number, 1930' },
        { code: 'AB96006', text: 'Farms of white tenants, number, 1930' },
      ],
    },
    title: 'Farms by Race and Tenure of Operator (1930_cAg NT002)',
    universe: 'Farms',
    note: 'The 1930 Census of Agriculture crossed race with tenure only for the seventeen Southern and border states and DC, so the other states have no figure. The tenure classes changed in 1930: owners split into full owners and part owners, and croppers became a class inside the main table. The agriculture dataset spells race in lower case where the occupation datasets capitalize it.',
    levels: STATE,
  },

  // ---- 1940 --------------------------------------------------------------------------------
  {
    census: 1940,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1940_cPHAE',
      table: 'NT6',
      code: 'BYA',
      variables: [{ code: 'BYA003', text: 'Negro' }],
    },
    denominator: {
      dataset: '1940_cPHAE',
      table: 'NT1',
      code: 'BV7',
      variables: [{ code: 'BV7001', text: 'Total' }],
    },
    title: 'Race/Nativity (1940_cPHAE NT6) over Total Population (NT1)',
    universe: 'Persons',
    note: '1930\'s "Mexican" race was gone by 1940: the race cells are white by nativity, Negro and other.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1940,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1940_cPHAE',
      table: 'NT6',
      code: 'BYA',
      variables: [
        { code: 'BYA001', text: 'White: Native-born' },
        { code: 'BYA002', text: 'White: Foreign-born' },
      ],
    },
    denominator: {
      dataset: '1940_cPHAE',
      table: 'NT1',
      code: 'BV7',
      variables: [{ code: 'BV7001', text: 'Total' }],
    },
    title: 'Race/Nativity (1940_cPHAE NT6) over Total Population (NT1)',
    universe: 'Persons',
    note: 'White in 1940 includes people later counted as Hispanic.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1940,
    series: LIVES_SERIES.homeownership,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1940_cPHAE',
      table: 'NT49',
      code: 'BXX',
      variables: [{ code: 'BXX002', text: 'Owner >> Negro' }],
    },
    denominator: {
      dataset: '1940_cPHAE',
      table: 'NT49',
      code: 'BXX',
      variables: [
        { code: 'BXX002', text: 'Owner >> Negro' },
        { code: 'BXX005', text: 'Tenant >> Negro' },
      ],
    },
    title: 'Occupied Dwelling Units by Tenancy Status by Race of Occupants (1940_cPHAE NT49)',
    universe: 'Occupied dwelling units',
    note: 'This is race of the occupants, not race of the household head, which is what the 1980 to 2020 tables count; the unit is the occupied dwelling unit. The published tenure words are "Owner" and "Tenant", not "Owner occupied" and "Renter occupied". "Other non-white" is a separate published class and is not folded into Negro here.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1940,
    series: LIVES_SERIES.homeownership,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1940_cPHAE',
      table: 'NT49',
      code: 'BXX',
      variables: [{ code: 'BXX001', text: 'Owner >> White' }],
    },
    denominator: {
      dataset: '1940_cPHAE',
      table: 'NT49',
      code: 'BXX',
      variables: [
        { code: 'BXX001', text: 'Owner >> White' },
        { code: 'BXX004', text: 'Tenant >> White' },
      ],
    },
    title: 'Occupied Dwelling Units by Tenancy Status by Race of Occupants (1940_cPHAE NT49)',
    universe: 'Occupied dwelling units',
    note: 'This is race of the occupants, not race of the household head, which is what the 1980 to 2020 tables count; the unit is the occupied dwelling unit. The published tenure words are "Owner" and "Tenant", not "Owner occupied" and "Renter occupied".',
    levels: NATION_AND_STATE,
  },

  // ---- 1950 --------------------------------------------------------------------------------
  {
    census: 1950,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1950_cPHA',
      table: 'NT6',
      code: 'B3P',
      variables: [
        { code: 'B3P003', text: 'Male >> Negro' },
        { code: 'B3P007', text: 'Female >> Negro' },
      ],
    },
    denominator: {
      dataset: '1950_cPHA',
      table: 'NT1',
      code: 'B18',
      variables: [{ code: 'B18001', text: 'Total' }],
    },
    title: 'Sex by Race/Nativity (1950_cPHA NT6) over Population (NT1)',
    universe: 'Persons',
    note: 'This is the only 1950 table at nation or state level that separates Negro from other non-white groups; every other 1950 race table publishes white and non-white only, and a figure from one of those is nonwhite, never Black.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1950,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1950_cPHA',
      table: 'NT6',
      code: 'B3P',
      variables: [
        { code: 'B3P001', text: 'Male >> White: Native-born' },
        { code: 'B3P002', text: 'Male >> White: Foreign-born' },
        { code: 'B3P005', text: 'Female >> White: Native-born' },
        { code: 'B3P006', text: 'Female >> White: Foreign-born' },
      ],
    },
    denominator: {
      dataset: '1950_cPHA',
      table: 'NT1',
      code: 'B18',
      variables: [{ code: 'B18001', text: 'Total' }],
    },
    title: 'Sex by Race/Nativity (1950_cPHA NT6) over Population (NT1)',
    universe: 'Persons',
    levels: NATION_AND_STATE,
  },

  // ---- 1960 --------------------------------------------------------------------------------
  {
    census: 1960,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1960_cPop',
      table: 'NT13',
      code: 'B5S',
      variables: [
        { code: 'B5S002', text: 'Male >> Negro' },
        { code: 'B5S009', text: 'Female >> Negro' },
      ],
    },
    denominator: {
      dataset: '1960_cPop',
      table: 'NT1',
      code: 'B5O',
      variables: [{ code: 'B5O001', text: 'Total' }],
    },
    title: 'Sex by Race (1960_cPop NT13) over Total Population (NT1)',
    universe: 'Persons',
    note: '1960 publishes seven named races here, so this is a Negro count. The separate 1960 white-and-nonwhite tables count Indian, Japanese, Chinese, Filipino and other races alongside Negro and are a different concept.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1960,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1960_cPop',
      table: 'NT13',
      code: 'B5S',
      variables: [
        { code: 'B5S001', text: 'Male >> White' },
        { code: 'B5S008', text: 'Female >> White' },
      ],
    },
    denominator: {
      dataset: '1960_cPop',
      table: 'NT1',
      code: 'B5O',
      variables: [{ code: 'B5O001', text: 'Total' }],
    },
    title: 'Sex by Race (1960_cPop NT13) over Total Population (NT1)',
    universe: 'Persons',
    note: 'White in 1960 includes people later counted as Hispanic.',
    levels: NATION_AND_STATE,
  },

  // ---- 1970 --------------------------------------------------------------------------------
  {
    census: 1970,
    series: LIVES_SERIES.population,
    slice: 'black',
    kind: 'share',
    numerator: population1970([TOTAL_AREA], 'Negro'),
    denominator: population1970([TOTAL_AREA]),
    title: 'Sex by Race (1970_Cnt2 NT1)',
    universe: 'Persons',
    note: 'NHGIS labels the 1970 breakdown "Black" while the 100-percent tables say "Negro", which is what 1970 published.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.population,
    slice: 'white',
    kind: 'share',
    numerator: population1970([TOTAL_AREA], 'White'),
    denominator: population1970([TOTAL_AREA]),
    title: 'Sex by Race (1970_Cnt2 NT1)',
    universe: 'Persons',
    note: 'White in 1970 includes people of Spanish origin.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.population,
    slice: 'spanish_origin',
    kind: 'share',
    numerator: people1970([TOTAL_AREA, SPANISH_AMERICAN_1970]),
    denominator: people1970([TOTAL_AREA, ALL_RACES]),
    title: 'Household Relationship and Sex (1970_Cnt4Pb NT18)',
    universe: 'Persons',
    note: 'Sample data, not the 100-percent count the Black and white shares come from. NHGIS calls the breakdown "Spanish American (Hispanic)" and states no composition for it; 1970 published several different Spanish concepts with different counts, one of them five states only, so the definition behind this figure is still open.',
    levels: STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.urban,
    slice: 'black',
    kind: 'share',
    numerator: people1970([URBAN, NHGIS_BLACK_1970]),
    denominator: people1970([TOTAL_AREA, NHGIS_BLACK_1970]),
    title: 'Household Relationship and Sex (1970_Cnt4Pb NT18), urban area over whole area',
    universe: 'Persons',
    note: '1970 urban is the post-1950 definition: urbanized areas plus places of 2,500 or more. This is sample data, not the 100-percent count the population share comes from: the 100-percent race table publishes no urban figure for a state.',
    levels: STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.urban,
    slice: 'white',
    kind: 'share',
    numerator: people1970([URBAN, NHGIS_WHITE_1970]),
    denominator: people1970([TOTAL_AREA, NHGIS_WHITE_1970]),
    title: 'Household Relationship and Sex (1970_Cnt4Pb NT18), urban area over whole area',
    universe: 'Persons',
    note: '1970 urban is the post-1950 definition: urbanized areas plus places of 2,500 or more. This is sample data, not the 100-percent count the population share comes from. White in 1970 includes people of Spanish origin.',
    levels: STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.urban,
    slice: 'spanish_origin',
    kind: 'share',
    numerator: people1970([URBAN, SPANISH_AMERICAN_1970]),
    denominator: people1970([TOTAL_AREA, SPANISH_AMERICAN_1970]),
    title: 'Household Relationship and Sex (1970_Cnt4Pb NT18), urban area over whole area',
    universe: 'Persons',
    note: 'Sample data, and the definition behind the Spanish American breakdown is still open.',
    levels: STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.homeownership,
    slice: 'black',
    kind: 'share',
    numerator: {
      dataset: '1970_Cnt1',
      table: 'NT26A3',
      code: 'CB6',
      variables: [{ code: 'CB6001', text: 'Owner occupied' }],
    },
    denominator: {
      dataset: '1970_Cnt1',
      table: 'NT26A3',
      code: 'CB6',
      variables: [
        { code: 'CB6001', text: 'Owner occupied' },
        { code: 'CB6002', text: 'Renter occupied' },
      ],
    },
    title: 'Tenure, Negro occupied housing units (1970_Cnt1 NT26A3)',
    universe: 'Negro occupied housing units',
    note: "The race is in the table's universe, not in a cell: 1970 published one tenure table per group. The white table words its universe as householders and the Negro table as occupied housing units; both count occupied units.",
    levels: NATION_AND_STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.homeownership,
    slice: 'white',
    kind: 'share',
    numerator: {
      dataset: '1970_Cnt1',
      table: 'NT26A2',
      code: 'CB5',
      variables: [{ code: 'CB5001', text: 'Owner occupied' }],
    },
    denominator: {
      dataset: '1970_Cnt1',
      table: 'NT26A2',
      code: 'CB5',
      variables: [
        { code: 'CB5001', text: 'Owner occupied' },
        { code: 'CB5002', text: 'Renter occupied' },
      ],
    },
    title: 'Tenure, white householders in occupied housing units (1970_Cnt1 NT26A2)',
    universe: 'White householders in occupied housing units',
    note: "The race is in the table's universe, not in a cell. White householders in 1970 include Spanish-origin householders.",
    levels: NATION_AND_STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.homeownership,
    slice: 'spanish_origin',
    kind: 'share',
    numerator: spanishTenure1970('owner'),
    denominator: spanishTenure1970('all'),
    title:
      'Tenure by Number of Persons in Unit, Spanish American occupied units (1970_Cnt4H NT37F)',
    universe: 'Spanish American occupied units',
    note: 'Sample data with no white comparator in the same dataset: 1970_Cnt4H publishes no white universe at all, so the white figure beside this one is a 100-percent count from a different file. The definition behind the Spanish American universe is still open.',
    levels: NATION_AND_STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.highSchool,
    slice: 'black',
    kind: 'share',
    numerator: schooling1970([TOTAL_AREA, NHGIS_BLACK_1970], HIGH_SCHOOL_OR_MORE_1970),
    denominator: schooling1970([TOTAL_AREA, NHGIS_BLACK_1970], SCHOOLING_1970),
    title: 'Sex by Years of School Completed (1970_Cnt4Pb NT42)',
    universe: 'Persons 25 years and over',
    note: 'Sample data. NHGIS labels the breakdown "Black" where the 100-percent tables say "Negro".',
    levels: STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.highSchool,
    slice: 'white',
    kind: 'share',
    numerator: schooling1970([TOTAL_AREA, NHGIS_WHITE_1970], HIGH_SCHOOL_OR_MORE_1970),
    denominator: schooling1970([TOTAL_AREA, NHGIS_WHITE_1970], SCHOOLING_1970),
    title: 'Sex by Years of School Completed (1970_Cnt4Pb NT42)',
    universe: 'Persons 25 years and over',
    note: 'Sample data. White in 1970 includes people of Spanish origin.',
    levels: STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.highSchool,
    slice: 'spanish_origin',
    kind: 'share',
    numerator: schooling1970([TOTAL_AREA, SPANISH_AMERICAN_1970], HIGH_SCHOOL_OR_MORE_1970),
    denominator: schooling1970([TOTAL_AREA, SPANISH_AMERICAN_1970], SCHOOLING_1970),
    title: 'Sex by Years of School Completed (1970_Cnt4Pb NT42)',
    universe: 'Persons 25 years and over',
    note: 'Sample data, and the definition behind the Spanish American breakdown is still open.',
    levels: STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.unemployed,
    slice: 'black',
    kind: 'share',
    numerator: labor1970([TOTAL_AREA, NHGIS_BLACK_1970], ['Unemployed']),
    denominator: labor1970([TOTAL_AREA, NHGIS_BLACK_1970], ['Employed', 'Unemployed']),
    title: 'Sex by Labor Force Status and Selected Characteristics (1970_Cnt4Pb NT54)',
    universe: 'Civilian labor force 16 years and over',
    note: 'Sample data. People in the armed forces are a separate published cell and are left out of the base.',
    levels: STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.unemployed,
    slice: 'white',
    kind: 'share',
    numerator: labor1970([TOTAL_AREA, NHGIS_WHITE_1970], ['Unemployed']),
    denominator: labor1970([TOTAL_AREA, NHGIS_WHITE_1970], ['Employed', 'Unemployed']),
    title: 'Sex by Labor Force Status and Selected Characteristics (1970_Cnt4Pb NT54)',
    universe: 'Civilian labor force 16 years and over',
    note: 'Sample data. People in the armed forces are a separate published cell and are left out of the base.',
    levels: STATE,
  },
  {
    census: 1970,
    series: LIVES_SERIES.unemployed,
    slice: 'spanish_origin',
    kind: 'share',
    numerator: labor1970([TOTAL_AREA, SPANISH_AMERICAN_1970], ['Unemployed']),
    denominator: labor1970([TOTAL_AREA, SPANISH_AMERICAN_1970], ['Employed', 'Unemployed']),
    title: 'Sex by Labor Force Status and Selected Characteristics (1970_Cnt4Pb NT54)',
    universe: 'Civilian labor force 16 years and over',
    note: 'Sample data, and the definition behind the Spanish American breakdown is still open.',
    levels: STATE,
  },
  {
    census: 1970,
    series: null,
    slice: 'black',
    kind: 'income',
    numerator: income1970([TOTAL_AREA, NHGIS_BLACK_1970]),
    denominator: income1970([TOTAL_AREA, NHGIS_BLACK_1970]),
    title: 'Family Income (1970_Cnt4Pb NT75)',
    universe: 'Families, income in 1969 dollars',
    note: 'Family income, not household income: these bands describe families and do not chain to the 1990 and later household series.',
    levels: STATE,
  },
  {
    census: 1970,
    series: null,
    slice: 'white',
    kind: 'income',
    numerator: income1970([TOTAL_AREA, NHGIS_WHITE_1970]),
    denominator: income1970([TOTAL_AREA, NHGIS_WHITE_1970]),
    title: 'Family Income (1970_Cnt4Pb NT75)',
    universe: 'Families, income in 1969 dollars',
    note: 'Family income, not household income: these bands describe families and do not chain to the 1990 and later household series.',
    levels: STATE,
  },
  {
    census: 1970,
    series: null,
    slice: 'spanish_origin',
    kind: 'income',
    numerator: income1970([TOTAL_AREA, SPANISH_AMERICAN_1970]),
    denominator: income1970([TOTAL_AREA, SPANISH_AMERICAN_1970]),
    title: 'Family Income (1970_Cnt4Pb NT75)',
    universe: 'Families, income in 1969 dollars',
    note: 'Family income, and the definition behind the Spanish American breakdown is still open.',
    levels: STATE,
  },
];

/** The IPUMS extract request for every historical table, at the geography levels each needs. */
export function livesHistoricalExtractDefinition(): Record<string, unknown> {
  const datasets: Record<
    string,
    { dataTables: string[]; geogLevels: string[]; breakdownValues?: string[] }
  > = {};
  for (const measure of LIVES_HISTORICAL_MEASURES) {
    for (const ref of [measure.numerator, measure.denominator]) {
      const dataset = LIVES_HISTORICAL_DATASETS[ref.dataset];
      if (!dataset) throw new Error(`no dataset definition for ${ref.dataset}`);
      const entry = (datasets[ref.dataset] ??= {
        dataTables: [],
        geogLevels: [],
        ...(dataset.breakdownValues.length > 0
          ? { breakdownValues: [...dataset.breakdownValues] }
          : {}),
      });
      if (!entry.dataTables.includes(ref.table)) entry.dataTables.push(ref.table);
      for (const level of measure.levels) {
        if (!entry.geogLevels.includes(level)) entry.geogLevels.push(level);
      }
      entry.geogLevels.sort();
    }
  }
  return {
    datasets,
    dataFormat: 'csv_header',
    breakdownAndDataTypeLayout: 'single_file',
    description: 'BlackStory Lives 1870-1970 census tables by race, states and nation',
  };
}

/** Census year and geography level from an NHGIS file name such as `nhgis0023_ds14_1870_state.csv`. */
export function readHistoricalFileName(
  name: string,
): { readonly census: LivesHistoricalCensus; readonly level: LivesGeographyLevel } | null {
  const match = /_(\d{4})_(nation|state)\.csv$/.exec(name);
  if (!match) return null;
  const census = Number(match[1]) as LivesHistoricalCensus;
  if (!HISTORICAL_CENSUSES.includes(census)) return null;
  return { census, level: match[2] as LivesGeographyLevel };
}

export type LivesHistoricalFile = {
  readonly census: LivesHistoricalCensus;
  readonly level: LivesGeographyLevel;
  /** Parsed CSV: codes, then descriptions, then one row per place. */
  readonly csv: readonly (readonly string[])[];
};

/**
 * One census year and geography level, with every dataset's file merged: a description for each NHGIS
 * column, and each place's published values. Merging is what lets a rate cross two datasets.
 */
type Merged = {
  readonly census: LivesHistoricalCensus;
  readonly level: LivesGeographyLevel;
  readonly descriptions: Map<string, string>;
  readonly places: Map<string, Map<string, string>>;
};

/**
 * Columns that belong to a table one of this census's measures reads. Everything else in the file —
 * the join code, the area name, the suppression flags — is left out, so two datasets merged into one
 * census never collide over a shared housekeeping column.
 */
function dataColumnPattern(census: LivesHistoricalCensus): RegExp {
  const codes = [
    ...new Set(
      LIVES_HISTORICAL_MEASURES.filter((measure) => measure.census === census).flatMap(
        (measure) => [measure.numerator.code, measure.denominator.code],
      ),
    ),
  ];
  return new RegExp(`^(?:${codes.join('|')})[A-Z]{0,4}\\d{3,}$`);
}

/**
 * The state FIPS code a row belongs to. 1970 writes the two-digit FIPS code; every older file writes
 * NHGIS's own three-digit code, which is the FIPS code followed by a zero for a place that is a state
 * today and by a five for one that was not — Dakota Territory, Alaska Territory, Oklahoma Territory,
 * and a "Persons in Military" row in 1900. Those are skipped rather than folded into a present-day
 * state, because Dakota Territory is not North Dakota and Washington Territory is not Washington. The
 * people they counted are still inside the national figure, which is read from the nation file as
 * published. Puerto Rico is out of the timeline's geography at either width.
 */
function stateFips(code: string | undefined): string | null {
  const fips = code && /^\d{2}(0?)$/.test(code) ? code.slice(0, 2) : null;
  return fips === null || fips === '72' ? null : fips;
}

function mergeFiles(files: readonly LivesHistoricalFile[]): Merged[] {
  const merged = new Map<string, Merged>();
  for (const file of files) {
    const key = `${file.census}:${file.level}`;
    const group = merged.get(key) ?? {
      census: file.census,
      level: file.level,
      descriptions: new Map<string, string>(),
      places: new Map<string, Map<string, string>>(),
    };
    merged.set(key, group);

    const [codes = [], descriptions = []] = file.csv;
    const isData = dataColumnPattern(file.census);
    const columns = codes.flatMap((code, column) => (isData.test(code) ? [{ code, column }] : []));
    for (const { code, column } of columns) {
      const description = descriptions[column] ?? '';
      const seen = group.descriptions.get(code);
      if (seen !== undefined && seen !== description) {
        throw new Error(
          `${file.census} ${file.level}: column ${code} is "${description}" in one file and "${seen}" in another`,
        );
      }
      group.descriptions.set(code, description);
    }

    const stateColumn = codes.indexOf('STATEA');
    for (const row of file.csv.slice(1)) {
      if (row.length !== codes.length || row[0] === 'GIS Join Match Code') continue;
      let jurisdictionId: string;
      if (file.level === 'nation') {
        jurisdictionId = LIVES_NATIONAL.id;
      } else {
        const fips = stateFips(row[stateColumn]);
        if (fips === null) continue;
        jurisdictionId = livesStateJurisdictionId(fips);
      }
      const values = group.places.get(jurisdictionId) ?? new Map<string, string>();
      group.places.set(jurisdictionId, values);
      for (const { code, column } of columns) values.set(code, row[column] ?? '');
    }
  }
  return [...merged.values()];
}

function refName(ref: LivesHistoricalRef): string {
  return `${ref.dataset} ${ref.table} (${ref.code})`;
}

/**
 * How NHGIS writes a breakdown in front of a description ("Total area: Black: Male >> Negro"). It
 * writes the spatial value first and the race value second, and both orders are accepted rather than
 * the file's column order being trusted. A dataset asked for one breakdown value writes the value's
 * name unevenly — 1970 Count 4H writes no prefix, 1970 Count 2 writes an empty name and keeps the
 * colon — so where a ref asks for nothing but the whole area and all races, those two shapes are
 * accepted too. Any other breakdown has to be written out, so `Urban` can never be read as the whole
 * area.
 */
function expectedDescriptions(ref: LivesHistoricalRef, text: string): string[] {
  const labels = ref.breakdown ?? [];
  if (labels.length === 0) return [text];
  const orders = labels.length === 2 ? [labels, [labels[1]!, labels[0]!]] : [labels];
  const expected = orders.map((order) => `${order.map((label) => `${label}: `).join('')}${text}`);
  if (labels.every((label) => DEFAULT_BREAKDOWNS.has(label))) expected.push(text, `: ${text}`);
  return expected;
}

function tablePattern(ref: LivesHistoricalRef): RegExp {
  return new RegExp(`^${ref.code}[A-Z]{0,4}\\d{3,}$`);
}

/** Whether a file carries the table at all, so a measure whose table this file has not got is skipped. */
function tableAbsent(group: Merged, ref: LivesHistoricalRef): boolean {
  const pattern = tablePattern(ref);
  for (const code of group.descriptions.keys()) if (pattern.test(code)) return false;
  return true;
}

/**
 * The column one published cell sits in. Matching is by variable code, and then the description the
 * file carries has to be the one the table publishes; anything else throws rather than loading a
 * figure from a column that moved.
 */
function columnFor(group: Merged, ref: LivesHistoricalRef, cell: LivesHistoricalCell): string {
  if (!cell.code.startsWith(ref.code)) {
    throw new Error(`${refName(ref)}: cell ${cell.code} is not in this table`);
  }
  const digits = cell.code.slice(ref.code.length);
  if (!/^\d{3,}$/.test(digits)) {
    throw new Error(`${refName(ref)}: cell ${cell.code} has no variable number`);
  }
  // A breakdown dataset writes its value into the column code (CEB002 becomes CEBAA002).
  const pattern = new RegExp(`^${ref.code}[A-Z]{0,4}${digits}$`);
  const candidates = [...group.descriptions].filter(([code]) => pattern.test(code));
  const expected = expectedDescriptions(ref, cell.text);
  const found = candidates.find(([, description]) => expected.includes(description));
  if (found) return found[0];
  throw new Error(
    `${refName(ref)} ${cell.code}: expected "${expected[0]}", found ${
      candidates.length === 0
        ? 'no column with that variable code'
        : candidates.map(([code, description]) => `${code} "${description}"`).join(', ')
    }`,
  );
}

/** A published count, or null when the cell is empty or unreadable. */
function readCount(values: ReadonlyMap<string, string>, column: string): number | null {
  const raw = values.get(column);
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function sumColumns(
  values: ReadonlyMap<string, string>,
  columns: readonly string[],
): number | null {
  let total = 0;
  for (const column of columns) {
    const count = readCount(values, column);
    if (count === null) return null;
    total += count;
  }
  return total;
}

/**
 * 1970's published income boundaries in the shape `contiguousIncomeBrackets` reads. Its bottom band
 * spells out what it includes ("Under $1000 (includes $1-$999, none, and loss)") and its top band
 * says "and over", neither of which the 1980-2020 wording covers; the brackets themselves are the
 * published ones, and the check that they run from zero to an open top with no gap is unchanged.
 */
function historicalBracketLabel(text: string): string {
  const bottom = /^Under (\$[\d,]+)/.exec(text);
  if (bottom) return `Less than ${bottom[1]}`;
  const top = /^(\$[\d,]+) and over$/.exec(text);
  if (top) return `${top[1]} or more`;
  const band = /^(\$[\d,]+)-(\$[\d,]+)$/.exec(text);
  if (band) return `${band[1]} to ${band[2]}`;
  return text;
}

const METRIC_FAMILY_INCOME = 'lives-income-bracket-*';

function measureSeries(measure: LivesHistoricalMeasure): string {
  return measure.kind === 'income' ? METRIC_FAMILY_INCOME : (measure.series ?? '');
}

function measureTables(measure: LivesHistoricalMeasure): string {
  const numerator = refName(measure.numerator);
  const denominator = refName(measure.denominator);
  return numerator === denominator ? numerator : `${numerator} over ${denominator}`;
}

/**
 * Observations for every measure the files carry. Places with an empty cell or a zero base are
 * skipped; a cell whose description has moved, or an income table whose bands are not contiguous,
 * throws.
 */
export function buildHistoricalObservations(
  files: readonly LivesHistoricalFile[],
): LivesPublishedObservation[] {
  const observations: LivesPublishedObservation[] = [];
  for (const group of mergeFiles(files)) {
    for (const measure of LIVES_HISTORICAL_MEASURES) {
      if (measure.census !== group.census || !measure.levels.includes(group.level)) continue;
      if (tableAbsent(group, measure.numerator) || tableAbsent(group, measure.denominator))
        continue;
      const numerator = measure.numerator.variables.map((cell) =>
        columnFor(group, measure.numerator, cell),
      );
      const denominator = measure.denominator.variables.map((cell) =>
        columnFor(group, measure.denominator, cell),
      );
      const brackets =
        measure.kind === 'income'
          ? contiguousIncomeBrackets(
              measure.numerator.variables.map((cell, index) => ({
                key: numerator[index]!,
                label: historicalBracketLabel(cell.text),
              })),
              refName(measure.numerator),
            )
          : [];
      if (measure.kind === 'income' && brackets.length !== numerator.length) {
        throw new Error(`${refName(measure.numerator)}: cells that are not income brackets`);
      }

      const dataset = LIVES_HISTORICAL_DATASETS[measure.numerator.dataset]!;
      const names = [
        dataset.name,
        ...(measure.denominator.dataset === measure.numerator.dataset
          ? []
          : [LIVES_HISTORICAL_DATASETS[measure.denominator.dataset]!.name]),
      ];
      const metadata = {
        table: measure.title,
        nhgisTable: measureTables(measure),
        universe: measure.universe,
        ...(measure.note ? { note: measure.note } : {}),
      };

      for (const [jurisdictionId, values] of group.places) {
        if (measure.kind === 'median') {
          const value = readCount(values, numerator[0]!);
          if (value === null || value <= 0) continue;
          observations.push({
            id: `obs:${measure.series}:${jurisdictionId}:${group.census}:${measure.slice}`,
            metricId: measure.series!,
            jurisdictionId,
            boundaryVersion: `${group.level}-${group.census}`,
            referencePeriod: String(group.census),
            datasetVintage: names.join(' and '),
            estimate: value,
            marginOfError: null,
            numerator: value,
            denominator: null,
            raceEthnicitySlice: measure.slice,
            source: `Census Bureau, ${names.join(' and ')}, table "${measure.title}", via IPUMS NHGIS`,
            sourceUrl: dataset.sourceUrl,
            contentHash: createHash('sha256')
              .update(JSON.stringify([value, metadata]))
              .digest('hex'),
            metadata,
          });
          continue;
        }

        const base = sumColumns(values, denominator);
        if (base === null || base <= 0) continue;

        const push = (metricId: string, count: number) => {
          observations.push({
            id: `obs:${metricId}:${jurisdictionId}:${group.census}:${measure.slice}`,
            metricId,
            jurisdictionId,
            boundaryVersion: `${group.level}-${group.census}`,
            referencePeriod: String(group.census),
            datasetVintage: names.join(' and '),
            estimate: (100 * count) / base,
            marginOfError: null,
            numerator: count,
            denominator: base,
            raceEthnicitySlice: measure.slice,
            source: `Census Bureau, ${names.join(' and ')}, table "${measure.title}", via IPUMS NHGIS`,
            sourceUrl: dataset.sourceUrl,
            contentHash: createHash('sha256')
              .update(JSON.stringify([count, base, metadata]))
              .digest('hex'),
            metadata,
          });
        };

        if (measure.kind === 'income') {
          for (const bracket of brackets) {
            const count = readCount(values, bracket.key);
            if (count === null) continue;
            push(incomeBracketSeriesId(bracket.lower, bracket.upper), count);
          }
          continue;
        }

        const published = sumColumns(values, numerator);
        if (published === null) continue;
        if (measure.kind === 'complement' && published > base) {
          throw new Error(
            `${refName(measure.numerator)}: ${jurisdictionId} in ${group.census} counts ${published} of ${base}, more than the whole universe`,
          );
        }
        push(measure.series!, measure.kind === 'complement' ? base - published : published);
      }
    }
  }
  return observations;
}

/** Groups observations by census, tables, measure and group, to count the places each covers. */
export function historicalCoverageKey(observation: LivesPublishedObservation): string {
  const family = observation.metricId.startsWith('lives-income-bracket')
    ? METRIC_FAMILY_INCOME
    : observation.metricId;
  return `${observation.referencePeriod} ${observation.metadata.nhgisTable} ${family} ${observation.raceEthnicitySlice}`;
}

/**
 * Every coverage key the extract should fill. Unlike the 1980-2020 loader this carries no expected
 * number of places: the union had 37 states in 1870 and 50 in 1970, so the run reports what each
 * measure covered rather than asserting one number across a century.
 */
export function expectedHistoricalCoverage(): string[] {
  return LIVES_HISTORICAL_MEASURES.map(
    (measure) =>
      `${measure.census} ${measureTables(measure)} ${measureSeries(measure)} ${measure.slice}`,
  );
}
