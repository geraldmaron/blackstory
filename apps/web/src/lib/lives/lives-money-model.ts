/**
 * Resolve derived income and modeled affordance for a Lives decade from published dollar cells.
 * Returns null when inputs are missing; never invents a sticker price. Method:
 * docs/methodology/lives-across-decades.md.
 */
import {
  computeLivesAffordance,
  deriveLivesRealIncome,
  LIVES_SERIES,
  livesDecadeForReferencePeriod,
  livesIncomeReferenceYear,
  type LivesAffordanceResult,
  type LivesDecade,
  type LivesDecadeBundle,
  type LivesDerivedIncome,
  type LivesLens,
  type LivesObservationInput,
  type LivesUnit,
} from '@repo/domain/statistics/lives';

export type LivesDecadeMoneyModel = {
  readonly derivedIncome: LivesDerivedIncome | null;
  readonly affordance: LivesAffordanceResult | null;
};

function decadeRows(
  observations: readonly LivesObservationInput[],
  metricId: string,
  decade: LivesDecade,
): LivesObservationInput[] {
  return observations.filter((row) => {
    if (row.metricId !== metricId || row.jurisdictionId !== 'nation:US') return false;
    return livesDecadeForReferencePeriod(row.referencePeriod) === decade;
  });
}

function pickDollar(
  observations: readonly LivesObservationInput[],
  metricId: string,
  decade: LivesDecade,
  lens: LivesLens,
): LivesObservationInput | undefined {
  const forDecade = decadeRows(observations, metricId, decade);
  const preferSlices =
    lens === 'black'
      ? ['black', 'negro', 'nonwhite', 'all']
      : lens === 'white'
        ? ['white', 'all']
        : ['hispanic', 'spanish_origin', 'spanish_surname', 'all'];
  for (const slice of preferSlices) {
    const hit = forDecade.find((row) => (row.raceEthnicitySlice ?? 'all') === slice);
    if (hit) return hit;
  }
  return forDecade[0];
}

/** Same-race price cells only. Do not pair a group income with an all-race rent residual. */
function pickPriceMatchingIncome(
  observations: readonly LivesObservationInput[],
  metricId: string,
  decade: LivesDecade,
  incomeSlice: string,
): LivesObservationInput | undefined {
  const forDecade = decadeRows(observations, metricId, decade);
  const aliases =
    incomeSlice === 'black' || incomeSlice === 'negro' || incomeSlice === 'nonwhite'
      ? ['black', 'negro', 'nonwhite']
      : incomeSlice === 'hispanic' ||
          incomeSlice === 'spanish_origin' ||
          incomeSlice === 'spanish_surname'
        ? ['hispanic', 'spanish_origin', 'spanish_surname']
        : [incomeSlice];
  for (const slice of aliases) {
    const hit = forDecade.find((row) => (row.raceEthnicitySlice ?? 'all') === slice);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * From published median income / rent / value observations, build labeled models.
 * Woman and child units never run affordance from household income.
 */
export function resolveLivesDecadeMoneyModel(input: {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
  readonly unit: LivesUnit;
  readonly observations: readonly LivesObservationInput[];
}): LivesDecadeMoneyModel {
  const { decade, emphasis, unit, observations } = input;
  const incomeYear = livesIncomeReferenceYear(decade.decade);
  const incomeObs = pickDollar(observations, LIVES_SERIES.incomeMedian, decade.decade, emphasis);
  const incomeSlice = incomeObs?.raceEthnicitySlice ?? 'all';
  const rentObs = incomeObs
    ? pickPriceMatchingIncome(observations, LIVES_SERIES.medianRent, decade.decade, incomeSlice)
    : undefined;
  const valueObs = incomeObs
    ? pickPriceMatchingIncome(
        observations,
        LIVES_SERIES.medianHomeValue,
        decade.decade,
        incomeSlice,
      )
    : undefined;

  const derivedIncome =
    incomeObs && incomeYear !== null
      ? deriveLivesRealIncome({
          amount: incomeObs.estimate,
          year: incomeYear,
          sourceLabel: `${emphasis} national median family income`,
        })
      : null;

  if (unit !== 'household' || incomeYear === null || !incomeObs) {
    return { derivedIncome, affordance: null };
  }

  if (rentObs) {
    return {
      derivedIncome,
      affordance: computeLivesAffordance({
        kind: 'rent_to_income',
        annualIncome: incomeObs.estimate,
        price: rentObs.estimate,
        incomeYear,
        priceYear: incomeYear,
        incomeGeography: 'nation',
        priceGeography: 'nation',
        incomeSourceLabel: incomeObs.source,
        priceSourceLabel: rentObs.source,
        incomeObservationIds: [`${incomeObs.metricId}:${incomeObs.referencePeriod}`],
        priceObservationIds: [`${rentObs.metricId}:${rentObs.referencePeriod}`],
      }),
    };
  }

  if (valueObs) {
    return {
      derivedIncome,
      affordance: computeLivesAffordance({
        kind: 'value_to_income',
        annualIncome: incomeObs.estimate,
        price: valueObs.estimate,
        incomeYear,
        priceYear: incomeYear,
        incomeGeography: 'nation',
        priceGeography: 'nation',
        incomeSourceLabel: incomeObs.source,
        priceSourceLabel: valueObs.source,
        incomeObservationIds: [`${incomeObs.metricId}:${incomeObs.referencePeriod}`],
        priceObservationIds: [`${valueObs.metricId}:${valueObs.referencePeriod}`],
      }),
    };
  }

  return { derivedIncome, affordance: null };
}
