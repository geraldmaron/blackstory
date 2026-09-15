/**
 * Decades and measurement regimes for Lives Across the Decades.
 *
 * The census changed what it asked, so "class" is measured differently across the timeline:
 * work-based strata before 1940, earnings in 1940, income afterward. Each decade belongs to
 * exactly one regime, the surface marks every boundary, and no change is ever computed across
 * one. Binding method: docs/methodology/lives-across-decades.md.
 */

export const LIVES_DECADES = [
  1870, 1880, 1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020,
] as const;

export type LivesDecade = (typeof LIVES_DECADES)[number];

export function isLivesDecade(value: number): value is LivesDecade {
  return (LIVES_DECADES as readonly number[]).includes(value);
}

export const LIVES_MEASUREMENT_REGIMES = [
  'occupational_strata',
  'earnings',
  'sample_line_income',
  'constructed_household_income',
  'household_income',
  'acs_household_income',
  'no_microdata',
] as const;

export type LivesMeasurementRegime = (typeof LIVES_MEASUREMENT_REGIMES)[number];

export type LivesRegimeDescription = {
  readonly regime: LivesMeasurementRegime;
  /** Short label for the class measure, shown next to every tier share. */
  readonly classLabel: string;
  /** One sentence a reader sees when the decade is selected. */
  readonly readerNote: string;
};

export const LIVES_REGIME_DESCRIPTIONS: Readonly<
  Record<LivesMeasurementRegime, LivesRegimeDescription>
> = {
  occupational_strata: {
    regime: 'occupational_strata',
    classLabel: 'Work-based class',
    readerNote:
      'The census did not ask about income before 1940, so class here comes from the kind of work the head of the household did.',
  },
  earnings: {
    regime: 'earnings',
    classLabel: 'Earnings tier',
    readerNote:
      'The 1940 census asked about wages and salaries only, and recorded nothing above $5,000, so these tiers leave out other income.',
  },
  sample_line_income: {
    regime: 'sample_line_income',
    classLabel: 'Income tier',
    readerNote:
      'In 1950 the census asked about income only for a sample of people, so these tiers rest on fewer records.',
  },
  constructed_household_income: {
    regime: 'constructed_household_income',
    classLabel: 'Income tier',
    readerNote: 'For 1960 and 1970, household income is the sum of what each member reported.',
  },
  household_income: {
    regime: 'household_income',
    classLabel: 'Income tier',
    readerNote:
      'Tiers compare household income, adjusted for household size, to the national median.',
  },
  acs_household_income: {
    regime: 'acs_household_income',
    classLabel: 'Income tier',
    readerNote:
      'These figures come from five years of American Community Survey responses, not a single census.',
  },
  no_microdata: {
    regime: 'no_microdata',
    classLabel: 'No data',
    readerNote:
      'Almost all of the 1890 census was destroyed by fire in 1921, so there are no records to count.',
  },
};

/** The regime a decade's cells are measured under. */
export function livesRegimeForDecade(decade: LivesDecade): LivesMeasurementRegime {
  if (decade === 1890) return 'no_microdata';
  if (decade <= 1930) return 'occupational_strata';
  if (decade === 1940) return 'earnings';
  if (decade === 1950) return 'sample_line_income';
  if (decade <= 1970) return 'constructed_household_income';
  if (decade <= 2000) return 'household_income';
  return 'acs_household_income';
}

/**
 * Whether a comparison between two decades crosses a measurement boundary. The 1890 gap is a
 * boundary on both sides. Callers must not compute a change when this is true.
 */
export function crossesLivesRegimeBoundary(a: LivesDecade, b: LivesDecade): boolean {
  return livesRegimeForDecade(a) !== livesRegimeForDecade(b);
}

/**
 * Whether tiers in two regimes are compared on the same footing (both income-based after
 * 1960). Earnings (1940) and sample-line income (1950) are income tiers but are not
 * comparable to household income, so they are excluded.
 */
export function livesRegimesShareIncomeFooting(
  a: LivesMeasurementRegime,
  b: LivesMeasurementRegime,
): boolean {
  const footing: readonly LivesMeasurementRegime[] = [
    'constructed_household_income',
    'household_income',
    'acs_household_income',
  ];
  return footing.includes(a) && footing.includes(b);
}

/** Hispanic origin was imputed by IPUMS before the 1970 census asked about it. */
export function livesHispanicOriginImputed(decade: LivesDecade): boolean {
  return decade < 1970;
}

/**
 * The calendar year census income questions referred to. Decennial censuses asked about the
 * previous calendar year; ACS five-year files are adjusted to their final year.
 */
export function livesIncomeReferenceYear(decade: LivesDecade): number | null {
  const regime = livesRegimeForDecade(decade);
  if (regime === 'occupational_strata' || regime === 'no_microdata') return null;
  if (regime === 'acs_household_income') return decade === 2010 ? 2012 : 2023;
  return decade - 1;
}
