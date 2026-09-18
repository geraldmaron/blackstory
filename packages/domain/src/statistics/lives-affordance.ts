/**
 * Modeled affordance for Lives: same-year published rent or home value against same-year income.
 * CPI may restate both sides into comparison-year dollars for captions; the ratio uses original-year
 * dollars. Work-based class never enters. Status is always modeled.
 * Method: docs/methodology/lives-across-decades.md.
 */
export type LivesAffordanceKind = 'rent_to_income' | 'value_to_income';

export type LivesAffordanceInput = {
  readonly kind: LivesAffordanceKind;
  /** Annual income in original-year dollars. */
  readonly annualIncome: number;
  /** Monthly contract rent, or home value, in original-year dollars. */
  readonly price: number;
  readonly incomeYear: number;
  readonly priceYear: number;
  readonly incomeGeography: 'nation' | 'region' | 'state';
  readonly priceGeography: 'nation' | 'region' | 'state';
  readonly incomeSourceLabel: string;
  readonly priceSourceLabel: string;
  readonly incomeObservationIds: readonly string[];
  readonly priceObservationIds: readonly string[];
};

export type LivesAffordanceResult = {
  readonly status: 'modeled';
  readonly kind: LivesAffordanceKind;
  readonly methodId: string;
  readonly methodVersion: string;
  /** Rent share of monthly income, or years of income to equal home value. */
  readonly value: number;
  readonly formula: string;
  readonly assumptions: readonly string[];
  readonly inputObservationIds: readonly string[];
  readonly uncertaintyLabel: string;
  readonly covers: boolean;
  readonly caption: string;
};

const METHOD_VERSION = '1';

/**
 * Monthly rent as a share of monthly income, or home value in years of income.
 * Returns null when years mismatch, incomes or prices are non-positive, or work-based
 * (no annual income) would be required.
 */
export function computeLivesAffordance(input: LivesAffordanceInput): LivesAffordanceResult | null {
  if (input.incomeYear !== input.priceYear) return null;
  if (!(input.annualIncome > 0) || !(input.price > 0)) return null;

  const geoMismatch = input.incomeGeography !== input.priceGeography;
  const assumptions = [
    'Ratio uses original-year dollars for both sides.',
    'CPI may restate both sides for a caption; it does not invent a historical sticker price.',
    ...(geoMismatch
      ? [
          `Income geography is ${input.incomeGeography}; price geography is ${input.priceGeography}. The model is illustrative across that mismatch.`,
        ]
      : []),
  ];

  if (input.kind === 'rent_to_income') {
    const monthlyIncome = input.annualIncome / 12;
    const share = input.price / monthlyIncome;
    const covers = share <= 1;
    return {
      status: 'modeled',
      kind: input.kind,
      methodId: 'lives-affordance-rent-to-income',
      methodVersion: METHOD_VERSION,
      value: share,
      formula: 'monthly_contract_rent / (annual_income / 12)',
      assumptions,
      inputObservationIds: [...input.incomeObservationIds, ...input.priceObservationIds],
      uncertaintyLabel: geoMismatch
        ? 'Modeled across mismatched geographies.'
        : 'Modeled from published same-year rent and income.',
      covers,
      caption: covers
        ? `At the published contract rent (${input.priceSourceLabel}), one month of rent was about ${(
            share * 100
          ).toFixed(0)} percent of monthly income from ${input.incomeSourceLabel}.`
        : `At the published contract rent (${input.priceSourceLabel}), one month of rent would not be covered by monthly income alone from ${input.incomeSourceLabel}.`,
    };
  }

  const years = input.price / input.annualIncome;
  return {
    status: 'modeled',
    kind: input.kind,
    methodId: 'lives-affordance-value-to-income',
    methodVersion: METHOD_VERSION,
    value: years,
    formula: 'home_value / annual_income',
    assumptions,
    inputObservationIds: [...input.incomeObservationIds, ...input.priceObservationIds],
    uncertaintyLabel: geoMismatch
      ? 'Modeled across mismatched geographies.'
      : 'Modeled from published same-year home value and income.',
    covers: years <= 3,
    caption: `The published home value (${input.priceSourceLabel}) equaled about ${years.toFixed(
      1,
    )} years of income from ${input.incomeSourceLabel}.`,
  };
}
