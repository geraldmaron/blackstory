/**
 * Decades and class-measurement regimes for Lives Across the Decades, from published census tables.
 *
 * The census changed what it asked and what it published by race, so "class" is measured differently
 * across the timeline: by kind of work before 1940, wages in 1940, family income 1950–1980, household
 * income afterward. Each decade belongs to exactly one regime, the surface marks every boundary, and no
 * change is computed across one. Binding method: docs/methodology/lives-across-decades.md.
 */

export const LIVES_DECADES = [
  1870, 1880, 1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020,
] as const;

export type LivesDecade = (typeof LIVES_DECADES)[number];

export function isLivesDecade(value: number): value is LivesDecade {
  return (LIVES_DECADES as readonly number[]).includes(value);
}

export const LIVES_MEASUREMENT_REGIMES = [
  'work_based',
  'wage_income',
  'family_income',
  'household_income',
  'acs_household_income',
] as const;

export type LivesMeasurementRegime = (typeof LIVES_MEASUREMENT_REGIMES)[number];

export type LivesRegimeDescription = {
  readonly regime: LivesMeasurementRegime;
  /** Short label for the class measure, shown next to every class share. */
  readonly classLabel: string;
  /** One sentence a reader sees when the decade is selected. */
  readonly readerNote: string;
};

export const LIVES_REGIME_DESCRIPTIONS: Readonly<
  Record<LivesMeasurementRegime, LivesRegimeDescription>
> = {
  work_based: {
    regime: 'work_based',
    classLabel: 'Work-based class',
    readerNote:
      'The census did not ask about income before 1940, so class here comes from the kinds of work it published by race.',
  },
  wage_income: {
    regime: 'wage_income',
    classLabel: 'Earnings bands',
    readerNote:
      'The 1940 census asked only about wages and salaries, so these bands leave out farm, business and other income.',
  },
  family_income: {
    regime: 'family_income',
    classLabel: 'Family income bands',
    readerNote:
      'From 1950 to 1980 the census published income by race for families, so these bands describe families rather than every household.',
  },
  household_income: {
    regime: 'household_income',
    classLabel: 'Household income bands',
    readerNote:
      'These bands compare household income with the national median, from census long-form tables.',
  },
  acs_household_income: {
    regime: 'acs_household_income',
    classLabel: 'Household income bands',
    readerNote:
      'These figures come from five years of American Community Survey responses, not a single census.',
  },
};

/** The regime a decade's class figures are measured under. */
export function livesRegimeForDecade(decade: LivesDecade): LivesMeasurementRegime {
  if (decade <= 1930) return 'work_based';
  if (decade === 1940) return 'wage_income';
  if (decade <= 1980) return 'family_income';
  if (decade <= 2000) return 'household_income';
  return 'acs_household_income';
}

/** Whether comparing two decades crosses a measurement boundary. Never compute a change when true. */
export function crossesLivesRegimeBoundary(a: LivesDecade, b: LivesDecade): boolean {
  return livesRegimeForDecade(a) !== livesRegimeForDecade(b);
}

/**
 * Whether two regimes measure the same unit (households), so a boundary between them is a method
 * note rather than a different measure.
 */
export function livesRegimesShareIncomeFooting(
  a: LivesMeasurementRegime,
  b: LivesMeasurementRegime,
): boolean {
  const households: readonly LivesMeasurementRegime[] = [
    'household_income',
    'acs_household_income',
  ];
  return households.includes(a) && households.includes(b);
}

/**
 * The calendar year income figures refer to. Decennial censuses asked about the previous year; ACS
 * five-year tables are stated in the final year's dollars.
 */
export function livesIncomeReferenceYear(decade: LivesDecade): number | null {
  const regime = livesRegimeForDecade(decade);
  if (regime === 'work_based') return null;
  if (regime === 'acs_household_income') return decade === 2010 ? 2012 : 2023;
  return decade - 1;
}

/** The ACS five-year vintage that stands for a decade. */
export function livesAcsVintage(decade: LivesDecade): string | null {
  if (decade === 2010) return '2008-2012';
  if (decade === 2020) return '2019-2023';
  return null;
}

/**
 * How visible Hispanic Americans were to the census in a decade:
 * - `not_counted`: no category; most were recorded as white.
 * - `mexican_race`: 1930 only, "Mexican" as a race.
 * - `proxies`: 1950–1960 Spanish surname (five Southwestern states) and Puerto Rican birth or parentage.
 * - `sample_question`: 1970 Spanish origin, asked of a sample, with known misclassification.
 * - `counted`: 1980 on, asked of everyone.
 */
export type LivesHispanicCounting =
  'not_counted' | 'mexican_race' | 'proxies' | 'sample_question' | 'counted';

export function livesHispanicCounting(decade: LivesDecade): LivesHispanicCounting {
  if (decade === 1930) return 'mexican_race';
  if (decade === 1950 || decade === 1960) return 'proxies';
  if (decade === 1970) return 'sample_question';
  if (decade >= 1980) return 'counted';
  return 'not_counted';
}
