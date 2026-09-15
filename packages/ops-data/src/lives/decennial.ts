/**
 * Published 1980, 1990 and 2000 census tables by race for Lives Across the Decades (bead
 * repo-0clax.23). Pure: the ingest script downloads one IPUMS NHGIS extract of these tables for the
 * nation and every state, and these functions turn its CSV files into observations that keep the
 * published counts, so the domain builder can sum states into regions.
 *
 * Groups follow the pattern of the ACS decades, so each decade reads like the next: population and
 * urban shares count non-Hispanic Black and white residents and Hispanic residents of any race;
 * homeownership, schooling, work and income count Black residents of any origin, non-Hispanic white
 * residents and Hispanic residents. The 1980 sample tables published only "White", which included
 * Hispanic people, and those figures carry that definition.
 *
 * Cells are found through each file's description row ("Total area: Black: Owner occupied"), never by
 * column position, and a table whose cells don't match fails loudly. Decennial tables have no margins.
 * Method: docs/methodology/lives-across-decades.md.
 */
import { createHash } from 'node:crypto';
import {
  LIVES_NATIONAL,
  LIVES_SERIES,
  incomeBracketSeriesId,
  livesStateJurisdictionId,
} from '@repo/domain/statistics/lives';
import { contiguousIncomeBrackets } from './acs.js';
import type { LivesPublishedObservation } from './published-observation.js';

export type LivesCensusYear = 1980 | 1990 | 2000;
export type LivesGeographyLevel = 'nation' | 'state';

export type LivesDecennialKind =
  'population' | 'urban' | 'tenure' | 'education' | 'employment' | 'income' | 'median';

/** One group a table is read for. At most one of `breakdown`, `race` and `cells` is set. */
export type LivesDecennialGroup = {
  readonly slice: string;
  /** Race or origin label a breakdown dataset writes before the cell ("Black, not of Hispanic origin"). */
  readonly breakdown?: string;
  /** Race text a race-crossed table writes first or last in the cell ("Black >> Less than $5,000"). */
  readonly race?: string;
  /** Leading cell text that counts the group, for a population table without breakdowns. */
  readonly cells?: string;
};

export type LivesDecennialTable = {
  readonly census: LivesCensusYear;
  readonly dataset: string;
  /** NHGIS table name, as the extract requests it. */
  readonly table: string;
  /** NHGIS column prefix. */
  readonly code: string;
  /** The table's title and universe as published. */
  readonly title: string;
  readonly kind: LivesDecennialKind;
  readonly groups: readonly LivesDecennialGroup[];
  /** The breakdown that counts everyone, for a population table that has one. */
  readonly everyone?: string;
  readonly levels: readonly LivesGeographyLevel[];
};

export type LivesDecennialDataset = {
  /** The summary file, as a citation names it. */
  readonly name: string;
  /** Census Bureau page for the summary file. */
  readonly sourceUrl: string;
  /** Geographic components and race or origin groups the extract asks for. */
  readonly breakdownValues: readonly string[];
};

export const LIVES_DECENNIAL_DATASETS: Readonly<Record<string, LivesDecennialDataset>> = {
  '1980_STF2b': {
    name: '1980 Census Summary Tape File 2B (100-percent data)',
    sourceUrl: 'https://www2.census.gov/census_1980/stf2b/',
    breakdownValues: [
      'bs03.ge0000',
      'bs03.ge0100',
      'bs04.ch00',
      'bs04.ch02',
      'bs04.ch19',
      'bs04.ch24',
      'bs04.ch25',
    ],
  },
  '1980_STF3': {
    name: '1980 Census Summary Tape File 3 (sample data)',
    sourceUrl: 'https://www2.census.gov/census_1980/stf3a/',
    breakdownValues: ['bs03.ge0000'],
  },
  '1980_STF4Pb': {
    name: '1980 Census Summary Tape File 4 (sample data)',
    sourceUrl: 'https://www2.census.gov/prod2/decennial/documents/D1-D80-S400-14-TECH.pdf',
    breakdownValues: ['bs03.ge0000', 'bs04.ch01', 'bs04.ch02', 'bs04.ch19'],
  },
  '1990_STF2b': {
    name: '1990 Census Summary Tape File 2B (100-percent data)',
    sourceUrl: 'https://www.census.gov/data/datasets/1990/dec/summary-file-2.html',
    breakdownValues: [
      'bs09.ge00',
      'bs09.ge01',
      'bs10.ch000',
      'bs10.ch002',
      'bs10.ch100',
      'bs10.ch120',
      'bs10.ch121',
    ],
  },
  '1990_STF3': {
    name: '1990 Census Summary Tape File 3 (sample data)',
    sourceUrl: 'https://www.census.gov/data/datasets/1990/dec/summary-file-3.html',
    breakdownValues: ['bs09.ge00'],
  },
  '1990_STF4b': {
    name: '1990 Census Summary Tape File 4B (sample data)',
    sourceUrl: 'https://www.census.gov/data/datasets/1990/dec/summary-file-4.html',
    breakdownValues: ['bs09.ge00', 'bs10.ch002', 'bs10.ch100', 'bs10.ch120'],
  },
  '2000_SF1a': {
    name: 'Census 2000 Summary File 1 (100-percent data)',
    sourceUrl: 'https://www.census.gov/data/datasets/2000/dec/summary-file-1.html',
    breakdownValues: ['bs21.ge00', 'bs21.ge01'],
  },
  '2000_SF3a': {
    name: 'Census 2000 Summary File 3 (sample data)',
    sourceUrl: 'https://www.census.gov/data/datasets/2000/dec/summary-file-3.html',
    breakdownValues: ['bs21.ge00'],
  },
};

const NATION_AND_STATE: readonly LivesGeographyLevel[] = ['nation', 'state'];
const NATION: readonly LivesGeographyLevel[] = ['nation'];
const STATE: readonly LivesGeographyLevel[] = ['state'];

const SPANISH_1980 = 'Spanish origin subtotal (subtotal of summaries 20-23)';
const WHITE_NOT_SPANISH_1980 =
  "White not of Spanish origin (on STF4B; not available for MCD's or CCD's under 2500";
const BLACK_NOT_SPANISH_1980 =
  "Black not of Spanish origin (on STF4B; not available for MCD's or CCD's under 2500";
const HISPANIC_1990 = 'Hispanic origin (of any race)';
const WHITE_NOT_HISPANIC_1990 = 'White, not of Hispanic origin';
const BLACK_NOT_HISPANIC_1990 = 'Black, not of Hispanic origin';
const BLACK_ALONE_2000 = 'Black or African American alone';

const POPULATION_1980: readonly LivesDecennialGroup[] = [
  { slice: 'black_nh', breakdown: BLACK_NOT_SPANISH_1980 },
  { slice: 'white_nh', breakdown: WHITE_NOT_SPANISH_1980 },
  { slice: 'hispanic', breakdown: SPANISH_1980 },
];
const POPULATION_1990: readonly LivesDecennialGroup[] = [
  { slice: 'black_nh', breakdown: BLACK_NOT_HISPANIC_1990 },
  { slice: 'white_nh', breakdown: WHITE_NOT_HISPANIC_1990 },
  { slice: 'hispanic', breakdown: HISPANIC_1990 },
];
const CONDITIONS_1990: readonly LivesDecennialGroup[] = [
  { slice: 'black', breakdown: 'Black' },
  { slice: 'white_nh', breakdown: WHITE_NOT_HISPANIC_1990 },
  { slice: 'hispanic', breakdown: HISPANIC_1990 },
];
const POPULATION_2000: readonly LivesDecennialGroup[] = [
  { slice: 'black_nh', cells: `Not Hispanic or Latino >> ${BLACK_ALONE_2000}` },
  { slice: 'white_nh', cells: 'Not Hispanic or Latino >> White alone' },
  { slice: 'hispanic', cells: 'Hispanic or Latino' },
];

/** Every table the loader reads, in extract order. */
export const LIVES_DECENNIAL_TABLES: readonly LivesDecennialTable[] = [
  {
    census: 1980,
    dataset: '1980_STF2b',
    table: 'NTB1',
    code: 'DCF',
    title: 'Persons',
    kind: 'population',
    everyone: 'All races',
    groups: POPULATION_1980,
    levels: NATION_AND_STATE,
  },
  {
    census: 1980,
    dataset: '1980_STF2b',
    table: 'NTB1',
    code: 'DCF',
    title: 'Persons',
    kind: 'urban',
    groups: POPULATION_1980,
    levels: NATION_AND_STATE,
  },
  {
    census: 1980,
    dataset: '1980_STF2b',
    table: 'NTB19A',
    code: 'DCR',
    title: 'Tenure (occupied units)',
    kind: 'tenure',
    groups: [
      { slice: 'black', breakdown: 'Black' },
      { slice: 'white_nh', breakdown: WHITE_NOT_SPANISH_1980 },
      { slice: 'hispanic', breakdown: SPANISH_1980 },
    ],
    levels: NATION_AND_STATE,
  },
  {
    census: 1980,
    dataset: '1980_STF3',
    table: 'NT55B',
    code: 'DHY',
    title: 'Race by Sex by Labor Force Status (persons 16 years and over)',
    kind: 'employment',
    groups: [
      { slice: 'black', race: 'Black' },
      { slice: 'white', race: 'White' },
    ],
    levels: NATION_AND_STATE,
  },
  {
    census: 1980,
    dataset: '1980_STF3',
    table: 'NT56',
    code: 'DHZ',
    title: 'Sex by Labor Force Status (persons of Spanish origin 16 years and over)',
    kind: 'employment',
    groups: [{ slice: 'hispanic' }],
    levels: NATION_AND_STATE,
  },
  {
    census: 1980,
    dataset: '1980_STF3',
    table: 'NT74',
    code: 'DIL',
    title: 'Median Family Income in 1979',
    kind: 'median',
    groups: [{ slice: 'all' }],
    levels: NATION,
  },
  {
    census: 1980,
    dataset: '1980_STF3',
    table: 'NT75',
    code: 'DIM',
    title: 'Race by Family Income in 1979 (families)',
    kind: 'income',
    groups: [
      { slice: 'black', race: 'Black' },
      { slice: 'white', race: 'White' },
    ],
    levels: NATION_AND_STATE,
  },
  {
    census: 1980,
    dataset: '1980_STF3',
    table: 'NT76',
    code: 'DIN',
    title: 'Family Income in 1979 (families with a householder of Spanish origin)',
    kind: 'income',
    groups: [{ slice: 'hispanic' }],
    levels: NATION_AND_STATE,
  },
  {
    census: 1980,
    dataset: '1980_STF4Pb',
    table: 'NTPB48',
    code: 'DX4',
    title: 'Sex by Age by Years of School Completed (persons 25 years and over)',
    kind: 'education',
    groups: [
      { slice: 'black', breakdown: 'Black' },
      { slice: 'white', breakdown: 'White' },
      { slice: 'hispanic', breakdown: SPANISH_1980 },
    ],
    levels: STATE,
  },
  {
    census: 1990,
    dataset: '1990_STF2b',
    table: 'NPB1',
    code: 'EWZ',
    title: 'Persons',
    kind: 'population',
    everyone: 'All races',
    groups: POPULATION_1990,
    levels: NATION_AND_STATE,
  },
  {
    census: 1990,
    dataset: '1990_STF2b',
    table: 'NPB1',
    code: 'EWZ',
    title: 'Persons',
    kind: 'urban',
    groups: POPULATION_1990,
    levels: NATION_AND_STATE,
  },
  {
    census: 1990,
    dataset: '1990_STF2b',
    table: 'NHB2',
    code: 'EWJ',
    title: 'Tenure (occupied housing units)',
    kind: 'tenure',
    groups: CONDITIONS_1990,
    levels: NATION_AND_STATE,
  },
  {
    census: 1990,
    dataset: '1990_STF3',
    table: 'NP80A',
    code: 'E4U',
    title: 'Median Household Income in 1989',
    kind: 'median',
    groups: [{ slice: 'all' }],
    levels: NATION,
  },
  {
    census: 1990,
    dataset: '1990_STF4b',
    table: 'NPB44',
    code: 'FF5',
    title: 'Sex by Educational Attainment (persons 25 years and over)',
    kind: 'education',
    groups: CONDITIONS_1990,
    levels: NATION_AND_STATE,
  },
  {
    census: 1990,
    dataset: '1990_STF4b',
    table: 'NPB56',
    code: 'FGI',
    title: 'Sex by Age by Employment Status (persons 16 years and over)',
    kind: 'employment',
    groups: CONDITIONS_1990,
    levels: NATION_AND_STATE,
  },
  {
    census: 1990,
    dataset: '1990_STF4b',
    table: 'NPB65',
    code: 'FGU',
    title: 'Household Income in 1989 (households)',
    kind: 'income',
    groups: CONDITIONS_1990,
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF1a',
    table: 'NP008A',
    code: 'FMS',
    title: 'Hispanic or Latino and Not Hispanic or Latino by Race (total population)',
    kind: 'population',
    groups: POPULATION_2000,
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF1a',
    table: 'NP008A',
    code: 'FMS',
    title: 'Hispanic or Latino and Not Hispanic or Latino by Race (total population)',
    kind: 'urban',
    groups: POPULATION_2000,
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF1a',
    table: 'NH014A',
    code: 'FLE',
    title: 'Tenure by Race of Householder (occupied housing units)',
    kind: 'tenure',
    groups: [{ slice: 'black_alone', race: BLACK_ALONE_2000 }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF1a',
    table: 'NH015I',
    code: 'FLN',
    title: 'Tenure (occupied housing units with a white alone, not Hispanic or Latino householder)',
    kind: 'tenure',
    groups: [{ slice: 'white_nh' }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF1a',
    table: 'NH015F',
    code: 'FLK',
    title: 'Tenure (occupied housing units with a Hispanic or Latino householder)',
    kind: 'tenure',
    groups: [{ slice: 'hispanic' }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP053A',
    code: 'GMY',
    title: 'Median Household Income in 1999',
    kind: 'median',
    groups: [{ slice: 'all' }],
    levels: NATION,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP148C',
    code: 'GRW',
    title: 'Sex by Educational Attainment by Race (persons 25 years and over)',
    kind: 'education',
    groups: [{ slice: 'black_alone', race: BLACK_ALONE_2000 }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP148I',
    code: 'GR2',
    title: 'Sex by Educational Attainment (white alone, not Hispanic or Latino, 25 years and over)',
    kind: 'education',
    groups: [{ slice: 'white_nh' }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP148F',
    code: 'GRZ',
    title: 'Sex by Educational Attainment (Hispanic or Latino, 25 years and over)',
    kind: 'education',
    groups: [{ slice: 'hispanic' }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP150E',
    code: 'GSS',
    title: 'Sex by Employment Status by Race (civilian labor force 16 years and over)',
    kind: 'employment',
    groups: [{ slice: 'black_alone', race: BLACK_ALONE_2000 }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP150O',
    code: 'GS2',
    title:
      'Sex by Employment Status (white alone, not Hispanic or Latino civilian labor force 16 years and over)',
    kind: 'employment',
    groups: [{ slice: 'white_nh' }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP150J',
    code: 'GSX',
    title: 'Sex by Employment Status (Hispanic or Latino civilian labor force 16 years and over)',
    kind: 'employment',
    groups: [{ slice: 'hispanic' }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP151A',
    code: 'GS3',
    title: 'Household Income in 1999 by Race of Householder (households)',
    kind: 'income',
    groups: [{ slice: 'black_alone', race: BLACK_ALONE_2000 }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP151C',
    code: 'GS5',
    title:
      'Household Income in 1999 (households with a white alone, not Hispanic or Latino householder)',
    kind: 'income',
    groups: [{ slice: 'white_nh' }],
    levels: NATION_AND_STATE,
  },
  {
    census: 2000,
    dataset: '2000_SF3a',
    table: 'NP151B',
    code: 'GS4',
    title: 'Household Income in 1999 (households with a Hispanic or Latino householder)',
    kind: 'income',
    groups: [{ slice: 'hispanic' }],
    levels: NATION_AND_STATE,
  },
];

/** The IPUMS extract request for every decennial table, at the geography levels each needs. */
export function livesDecennialExtractDefinition(): Record<string, unknown> {
  const datasets: Record<
    string,
    { dataTables: string[]; geogLevels: string[]; breakdownValues: string[] }
  > = {};
  for (const table of LIVES_DECENNIAL_TABLES) {
    const entry = (datasets[table.dataset] ??= {
      dataTables: [],
      geogLevels: [],
      breakdownValues: [...LIVES_DECENNIAL_DATASETS[table.dataset]!.breakdownValues],
    });
    if (!entry.dataTables.includes(table.table)) entry.dataTables.push(table.table);
    for (const level of table.levels) {
      if (!entry.geogLevels.includes(level)) entry.geogLevels.push(level);
    }
    entry.geogLevels.sort();
  }
  return {
    datasets,
    dataFormat: 'csv_header',
    breakdownAndDataTypeLayout: 'single_file',
    description: 'BlackStory Lives 1980-2000 census tables by race, states and nation',
  };
}

/** Census year and geography level from an NHGIS file name such as `nhgis0021_ds125_1990_state.csv`. */
export function readDecennialFileName(
  name: string,
): { readonly census: LivesCensusYear; readonly level: LivesGeographyLevel } | null {
  const match = /_(1980|1990|2000)_(nation|state)\.csv$/.exec(name);
  if (!match) return null;
  return { census: Number(match[1]) as LivesCensusYear, level: match[2] as LivesGeographyLevel };
}

export type LivesDecennialFile = {
  readonly census: LivesCensusYear;
  readonly level: LivesGeographyLevel;
  /** Parsed CSV: codes, then descriptions, then one row per place. */
  readonly csv: readonly (readonly string[])[];
};

const COMPONENTS = ['Total area', 'Urban'] as const;
type Component = (typeof COMPONENTS)[number];
type Cell = { readonly component: Component; readonly text: string; readonly column: number };

const METRIC_FAMILY: Readonly<Record<LivesDecennialKind, string>> = {
  population: LIVES_SERIES.population,
  urban: LIVES_SERIES.urban,
  tenure: LIVES_SERIES.homeownership,
  education: LIVES_SERIES.highSchool,
  employment: LIVES_SERIES.unemployed,
  income: 'lives-income-bracket-*',
  median: LIVES_SERIES.incomeMedian,
};

/** Levels of schooling short of a high school diploma, as 1980, 1990 and 2000 tables name them. */
const BELOW_HIGH_SCHOOL: ReadonlySet<string> = new Set([
  'Elementary (0 to 8 years)',
  'High School: 1 to 3 years',
  'No school or less than 1st grade',
  '1st to 4th grade',
  '5th to 8th grade',
  '9th grade',
  '10th grade',
  '11th grade',
  '12th grade, no diploma',
  'Less than 9th grade',
  '9th to 12th grade, no diploma',
]);

const HIGH_SCHOOL_OR_MORE: ReadonlySet<string> = new Set([
  'High School: 4 years',
  'College: 1 to 3 years',
  'College: 4 or more years',
  'High school graduate (includes equivalency)',
  'Some college, no degree',
  'Associate degree',
  'Associate degree in college (occupational program)',
  'Associate degree in college (academic program)',
  "Bachelor's degree",
  "Master's degree",
  'Professional school degree',
  'Doctorate degree',
  'Graduate or professional degree',
]);

function tableCells(table: LivesDecennialTable, csv: LivesDecennialFile['csv']): Cell[] {
  const [codes = [], descriptions = []] = csv;
  const pattern = new RegExp(`^${table.code}[A-Z]{0,3}\\d{3}$`);
  const cells: Cell[] = [];
  codes.forEach((code, column) => {
    if (!pattern.test(code)) return;
    const description = descriptions[column] ?? '';
    const component = COMPONENTS.find((name) => description.startsWith(`${name}: `));
    cells.push({
      component: component ?? 'Total area',
      text: component ? description.slice(component.length + 2) : description,
      column,
    });
  });
  return cells;
}

function groupCells(
  cells: readonly Cell[],
  group: LivesDecennialGroup,
  component: Component,
): Cell[] {
  let selected = cells.filter((cell) => cell.component === component);
  if (group.breakdown) {
    const prefix = `${group.breakdown}: `;
    selected = selected
      .filter((cell) => cell.text.startsWith(prefix))
      .map((cell) => ({ ...cell, text: cell.text.slice(prefix.length) }));
  }
  if (group.race) {
    const lead = `${group.race} >> `;
    const tail = ` >> ${group.race}`;
    selected = selected.flatMap((cell) =>
      cell.text.startsWith(lead)
        ? [{ ...cell, text: cell.text.slice(lead.length) }]
        : cell.text.endsWith(tail)
          ? [{ ...cell, text: cell.text.slice(0, -tail.length) }]
          : [],
    );
  }
  if (group.cells) {
    const cellsText = group.cells;
    selected = selected.filter(
      (cell) => cell.text === cellsText || cell.text.startsWith(`${cellsText} >> `),
    );
  }
  return selected;
}

function lastSegment(text: string): string {
  return text.split(' >> ').at(-1) ?? text;
}

/** A published count, or null when the cell is empty or suppressed. */
function readCount(row: readonly string[], column: number): number | null {
  const raw = row[column];
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function sumCells(row: readonly string[], cells: readonly Cell[]): number | null {
  let total = 0;
  for (const cell of cells) {
    const value = readCount(row, cell.column);
    if (value === null) return null;
    total += value;
  }
  return total;
}

function tableName(table: LivesDecennialTable): string {
  return `${table.dataset} ${table.table}`;
}

function requireCells(cells: readonly Cell[], table: LivesDecennialTable, what: string): Cell[] {
  if (cells.length === 0) throw new Error(`${tableName(table)}: no cells for ${what}`);
  return [...cells];
}

/** The one cell a group's count is published in (`Total`), or the cells that add up to it. */
function groupCountCells(
  cells: readonly Cell[],
  table: LivesDecennialTable,
  group: LivesDecennialGroup,
  component: Component,
): Cell[] {
  const selected = groupCells(cells, group, component);
  if (group.cells) return requireCells(selected, table, `${group.slice} in ${component}`);
  const total = selected.filter((cell) => cell.text === 'Total');
  if (total.length !== 1) {
    throw new Error(
      `${tableName(table)}: expected one Total cell for ${group.slice} in ${component}, found ${total.length}`,
    );
  }
  return total;
}

/**
 * Observations for every table the file carries. Rows with an empty cell or a zero base are skipped,
 * and a table whose cells don't match the layout this loader reads throws.
 */
export function buildDecennialObservations(file: LivesDecennialFile): LivesPublishedObservation[] {
  const [codes = []] = file.csv;
  const rows = file.csv
    .slice(1)
    .filter((row) => row.length === codes.length && row[0] !== 'GIS Join Match Code');
  const stateColumn = codes.indexOf('STATEA');
  const observations: LivesPublishedObservation[] = [];

  for (const table of LIVES_DECENNIAL_TABLES) {
    if (table.census !== file.census || !table.levels.includes(file.level)) continue;
    const cells = tableCells(table, file.csv);
    if (cells.length === 0) continue;
    const dataset = LIVES_DECENNIAL_DATASETS[table.dataset]!;
    const metadata = {
      table: table.title,
      nhgisTable: `${table.dataset} ${table.table} (${table.code})`,
    };

    for (const row of rows) {
      let jurisdictionId: string;
      if (file.level === 'nation') {
        jurisdictionId = LIVES_NATIONAL.id;
      } else {
        const state = row[stateColumn];
        if (!state || !/^\d{2}$/.test(state) || state === '72') continue;
        jurisdictionId = livesStateJurisdictionId(state);
      }

      const push = (
        metricId: string,
        slice: string,
        estimate: number,
        numerator: number | null,
        denominator: number | null,
      ) => {
        observations.push({
          id: `obs:${metricId}:${jurisdictionId}:${file.census}:${slice}`,
          metricId,
          jurisdictionId,
          boundaryVersion: `${file.level}-${file.census}`,
          referencePeriod: String(file.census),
          datasetVintage: dataset.name,
          estimate,
          marginOfError: null,
          numerator,
          denominator,
          raceEthnicitySlice: slice,
          source: `Census Bureau, ${dataset.name}, table "${table.title}", via IPUMS NHGIS`,
          sourceUrl: dataset.sourceUrl,
          contentHash: createHash('sha256')
            .update(JSON.stringify([estimate, numerator, denominator, metadata]))
            .digest('hex'),
          metadata,
        });
      };
      const share = (
        metricId: string,
        slice: string,
        numerator: number | null,
        denominator: number | null,
      ) => {
        if (numerator === null || denominator === null || denominator <= 0) return;
        push(metricId, slice, (100 * numerator) / denominator, numerator, denominator);
      };

      if (table.kind === 'population') {
        const everyoneCells = table.everyone
          ? groupCountCells(cells, table, { slice: 'all', breakdown: table.everyone }, 'Total area')
          : requireCells(
              cells.filter((cell) => cell.component === 'Total area'),
              table,
              'everyone',
            );
        const everyone = sumCells(row, everyoneCells);
        for (const group of table.groups) {
          const count = sumCells(row, groupCountCells(cells, table, group, 'Total area'));
          share(LIVES_SERIES.population, group.slice, count, everyone);
        }
        continue;
      }

      if (table.kind === 'median') {
        if (file.level !== 'nation') continue;
        const median = sumCells(row, requireCells(cells, table, 'the median'));
        if (median !== null && median > 0) {
          push(LIVES_SERIES.incomeMedian, 'all', median, null, null);
        }
        continue;
      }

      for (const group of table.groups) {
        switch (table.kind) {
          case 'urban': {
            share(
              LIVES_SERIES.urban,
              group.slice,
              sumCells(row, groupCountCells(cells, table, group, 'Urban')),
              sumCells(row, groupCountCells(cells, table, group, 'Total area')),
            );
            break;
          }
          case 'tenure': {
            const selected = requireCells(
              groupCells(cells, group, 'Total area'),
              table,
              group.slice,
            );
            const tenureOf = (cell: Cell) =>
              (cell.text.split(': ')[0] ?? '').replace('-', ' ').toLowerCase();
            const owners = selected.filter((cell) => tenureOf(cell) === 'owner occupied');
            const renters = selected.filter((cell) => tenureOf(cell) === 'renter occupied');
            if (owners.length === 0 || renters.length === 0) {
              throw new Error(`${tableName(table)}: ${group.slice} lacks owner or renter cells`);
            }
            if (owners.length + renters.length !== selected.length) {
              throw new Error(`${tableName(table)}: ${group.slice} has cells that are not tenure`);
            }
            share(
              LIVES_SERIES.homeownership,
              group.slice,
              sumCells(row, owners),
              sumCells(row, selected),
            );
            break;
          }
          case 'education': {
            const selected = requireCells(
              groupCells(cells, group, 'Total area'),
              table,
              group.slice,
            );
            const completed: Cell[] = [];
            for (const cell of selected) {
              const level = lastSegment(cell.text);
              if (HIGH_SCHOOL_OR_MORE.has(level)) completed.push(cell);
              else if (!BELOW_HIGH_SCHOOL.has(level)) {
                throw new Error(`${tableName(table)}: unknown schooling level "${level}"`);
              }
            }
            if (completed.length === 0 || completed.length === selected.length) {
              throw new Error(`${tableName(table)}: ${group.slice} does not split at high school`);
            }
            share(
              LIVES_SERIES.highSchool,
              group.slice,
              sumCells(row, completed),
              sumCells(row, selected),
            );
            break;
          }
          case 'employment': {
            const selected = requireCells(
              groupCells(cells, group, 'Total area'),
              table,
              group.slice,
            );
            const statusOf = (cell: Cell) => lastSegment(cell.text).split(': ').at(-1);
            const unemployed = selected.filter((cell) => statusOf(cell) === 'Unemployed');
            const employed = selected.filter((cell) => statusOf(cell) === 'Employed');
            if (unemployed.length === 0 || unemployed.length !== employed.length) {
              throw new Error(
                `${tableName(table)}: ${group.slice} has ${unemployed.length} unemployed cells for ${employed.length} employed cells`,
              );
            }
            const unemployedCount = sumCells(row, unemployed);
            const employedCount = sumCells(row, employed);
            share(
              LIVES_SERIES.unemployed,
              group.slice,
              unemployedCount,
              unemployedCount === null || employedCount === null
                ? null
                : unemployedCount + employedCount,
            );
            break;
          }
          case 'income': {
            const selected = requireCells(
              groupCells(cells, group, 'Total area'),
              table,
              group.slice,
            );
            const brackets = contiguousIncomeBrackets(
              selected.map((cell) => ({
                key: cell,
                label: cell.text.replace(/^(\$[\d,]+)-(\$[\d,]+)$/, '$1 to $2'),
              })),
              tableName(table),
            );
            if (brackets.length !== selected.length) {
              throw new Error(
                `${tableName(table)}: ${group.slice} has cells that are not brackets`,
              );
            }
            const households = sumCells(row, selected);
            for (const bracket of brackets) {
              share(
                incomeBracketSeriesId(bracket.lower, bracket.upper),
                group.slice,
                readCount(row, bracket.key.column),
                households,
              );
            }
            break;
          }
        }
      }
    }
  }
  return observations;
}

/** Groups observations by census, table, measure and group, to count the places each covers. */
export function decennialCoverageKey(observation: LivesPublishedObservation): string {
  const family = observation.metricId.startsWith('lives-income-bracket')
    ? METRIC_FAMILY.income
    : observation.metricId;
  return `${observation.referencePeriod} ${observation.metadata.nhgisTable} ${family} ${observation.raceEthnicitySlice}`;
}

/** Every coverage key the extract should fill, with the number of places: the nation and 51 states. */
export function expectedDecennialCoverage(): { readonly key: string; readonly places: number }[] {
  return LIVES_DECENNIAL_TABLES.flatMap((table) =>
    table.groups.map((group) => ({
      key: `${table.census} ${table.dataset} ${table.table} (${table.code}) ${METRIC_FAMILY[table.kind]} ${group.slice}`,
      places: (table.levels.includes('nation') ? 1 : 0) + (table.levels.includes('state') ? 51 : 0),
    })),
  );
}
