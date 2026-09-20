/**
 * What Lives Across the Decades measures, where each figure is stored, and in which decades the census
 * published it by race. Figures are stored at state and national level as published; region figures
 * are derived from them by the builder. Method: docs/methodology/lives-across-decades.md.
 */
import {
  LIVES_DECADES,
  livesAcsVintage,
  type LivesDecade,
  type LivesMeasurementRegime,
} from './lives-regimes.js';

/** Class buckets a group is split into. `unclassified` exists only for work-based class. */
export const LIVES_CLASS_BUCKETS = ['lower', 'middle', 'upper', 'unclassified'] as const;

export type LivesClassBucket = (typeof LIVES_CLASS_BUCKETS)[number];

/** The class tier a reader can emphasize. */
export const LIVES_TIER_KEYS = ['all', 'lower', 'middle', 'upper'] as const;

export type LivesTierKey = (typeof LIVES_TIER_KEYS)[number];

/** Stored series. Each row carries numerator and denominator counts as the table published them. */
export const LIVES_SERIES = {
  /** numerator: the group's population; denominator: everyone. */
  population: 'lives-population',
  urban: 'lives-urban',
  homeownership: 'lives-homeownership',
  literacy: 'lives-literacy',
  schoolAttendance: 'lives-school-attendance',
  highSchool: 'lives-high-school',
  unemployed: 'lives-unemployed',
  farmTenancy: 'lives-farm-tenancy',
  /** National median of the decade's income unit, slice `all`, at `nation:US`. */
  incomeMedian: 'lives-income-median',
  /** Median monthly contract rent for rented nonfarm homes, dollars. */
  medianRent: 'lives-median-rent',
  /** Median value of owned nonfarm homes, dollars. */
  medianHomeValue: 'lives-median-home-value',
} as const;

const WORK_CLASS_PREFIX = 'lives-class-work-';
const INCOME_BRACKET_PREFIX = 'lives-income-bracket-';

/** Series id for workers (or farm operators) in one work-based class bucket. */
export function workClassSeriesId(bucket: LivesClassBucket): string {
  return `${WORK_CLASS_PREFIX}${bucket}`;
}

/** Series id for one published income bracket; the upper bound is exclusive, null for the open top. */
export function incomeBracketSeriesId(lower: number, upper: number | null): string {
  return `${INCOME_BRACKET_PREFIX}${lower}-${upper === null ? 'open' : upper}`;
}

export function parseIncomeBracketSeriesId(
  seriesId: string,
): { readonly lower: number; readonly upper: number | null } | null {
  if (!seriesId.startsWith(INCOME_BRACKET_PREFIX)) return null;
  const match = /^(\d+)-(\d+|open)$/.exec(seriesId.slice(INCOME_BRACKET_PREFIX.length));
  if (!match) return null;
  const lower = Number(match[1]);
  const upper = match[2] === 'open' ? null : Number(match[2]);
  if (upper !== null && upper <= lower) return null;
  return { lower, upper };
}

export type LivesConditionKey =
  | 'population_share'
  | 'urban'
  | 'homeownership'
  | 'literacy'
  | 'school_attendance'
  | 'high_school'
  | 'unemployed'
  | 'income_to_national_median'
  | 'farm_tenancy'
  | 'life_expectancy'
  | 'infant_mortality';

/**
 * What a condition's figure measures. Every census condition is a percentage of a group. The two
 * vital-statistics conditions are not: life expectancy is a number of years and infant mortality is
 * deaths per 1,000 live births, and neither may be formatted, drawn, or compared as a percent.
 */
export type LivesConditionUnit = 'percent' | 'years' | 'per_1000';

export type LivesConditionDefinition = {
  readonly key: LivesConditionKey;
  /** Stored series, or null when the condition is derived from income brackets. */
  readonly seriesId: string | null;
  readonly universe: string;
  /** First and last decades the census published this by race. */
  readonly firstDecade: LivesDecade;
  readonly lastDecade: LivesDecade;
  /** Defaults to percent. */
  readonly unit?: LivesConditionUnit;
  /**
   * A national series an agency publishes as a finished value, one metric per group, with no
   * counts behind it to sum. It has no regional figure: a region's cell says so.
   */
  readonly valueSeries?: Readonly<Record<'black' | 'white', string>>;
};

export function livesConditionUnit(key: LivesConditionKey): LivesConditionUnit {
  return LIVES_CONDITIONS.find((condition) => condition.key === key)?.unit ?? 'percent';
}

/** Conditions in display order. */
export const LIVES_CONDITIONS: readonly LivesConditionDefinition[] = [
  {
    key: 'population_share',
    seriesId: LIVES_SERIES.population,
    universe: 'Everyone living in the area',
    firstDecade: 1870,
    lastDecade: 2020,
  },
  {
    key: 'urban',
    seriesId: LIVES_SERIES.urban,
    universe: 'Everyone in the group',
    firstDecade: 1890,
    lastDecade: 2020,
  },
  {
    key: 'homeownership',
    seriesId: LIVES_SERIES.homeownership,
    universe: 'Occupied homes, by the race of the household head',
    firstDecade: 1900,
    lastDecade: 2020,
  },
  {
    key: 'literacy',
    seriesId: LIVES_SERIES.literacy,
    universe: 'People 10 and older',
    firstDecade: 1870,
    lastDecade: 1930,
  },
  {
    key: 'school_attendance',
    seriesId: LIVES_SERIES.schoolAttendance,
    universe: 'School-age children',
    firstDecade: 1870,
    lastDecade: 1930,
  },
  {
    key: 'high_school',
    seriesId: LIVES_SERIES.highSchool,
    universe: 'Adults 25 and older',
    firstDecade: 1940,
    lastDecade: 2020,
  },
  {
    key: 'unemployed',
    seriesId: LIVES_SERIES.unemployed,
    universe: 'People in the labor force',
    firstDecade: 1930,
    lastDecade: 2020,
  },
  {
    key: 'income_to_national_median',
    seriesId: null,
    universe: 'The decade’s income unit (wage earners, families or households)',
    firstDecade: 1940,
    lastDecade: 2020,
  },
  {
    key: 'farm_tenancy',
    seriesId: LIVES_SERIES.farmTenancy,
    universe: 'Farm operators',
    firstDecade: 1900,
    lastDecade: 1950,
  },
  {
    // NCHS: "the average number of years that a group of infants would live if they were to
    // experience throughout life the age-specific death rates prevailing" in the year of birth.
    key: 'life_expectancy',
    seriesId: null,
    unit: 'years',
    valueSeries: {
      black: 'nchs-life-expectancy-birth-black-nation',
      white: 'nchs-life-expectancy-birth-white-nation',
    },
    universe: 'Babies born that year, if that year’s death rates lasted their whole lives',
    firstDecade: 1900,
    lastDecade: 2020,
  },
  {
    // The NCHS series runs 1915 to 2013, so the census years it covers are 1920 through 2010.
    key: 'infant_mortality',
    seriesId: null,
    unit: 'per_1000',
    valueSeries: {
      black: 'nchs-infant-mortality-black-nation',
      white: 'nchs-infant-mortality-white-nation',
    },
    universe: 'Babies born alive that year',
    firstDecade: 1920,
    lastDecade: 2010,
  },
];

export function livesConditionPublishedIn(
  condition: LivesConditionDefinition,
  decade: LivesDecade,
): boolean {
  return decade >= condition.firstDecade && decade <= condition.lastDecade;
}

/** Reader-facing label, which depends on what the decade's regime measured. */
export function livesConditionLabel(
  key: LivesConditionKey,
  regime: LivesMeasurementRegime,
): string {
  switch (key) {
    case 'population_share':
      return 'Share of everyone living in the area';
    case 'urban':
      return 'Living in a city or town';
    case 'homeownership':
      return 'Owning their home';
    case 'literacy':
      return 'Able to read and write';
    case 'school_attendance':
      return 'Children attending school';
    case 'high_school':
      return 'Finished high school';
    case 'unemployed':
      return 'Looking for work';
    case 'income_to_national_median':
      if (regime === 'wage_income') return 'Median wages, as a share of the national median';
      if (regime === 'family_income')
        return 'Median family income, as a share of the national median';
      return 'Median household income, as a share of the national median';
    case 'farm_tenancy':
      return 'Farm operators who rented or sharecropped';
    case 'life_expectancy':
      return 'Years a newborn could expect to live';
    case 'infant_mortality':
      return 'Babies who died before their first birthday';
  }
}

/**
 * The decade a stored reference period belongs to: a census year ("1960") or an ACS five-year vintage
 * ("2019-2023"). Null for anything else.
 */
export function livesDecadeForReferencePeriod(period: string): LivesDecade | null {
  const trimmed = period.trim();
  if (/^\d{4}$/.test(trimmed)) {
    const year = Number(trimmed);
    return (LIVES_DECADES as readonly number[]).includes(year) ? (year as LivesDecade) : null;
  }
  const match = /^(\d{4})-(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const decade = Math.floor(Number(match[2]) / 10) * 10;
  if (!(LIVES_DECADES as readonly number[]).includes(decade)) return null;
  return livesAcsVintage(decade as LivesDecade) === trimmed ? (decade as LivesDecade) : null;
}
