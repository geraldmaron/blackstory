/**
 * Restates a published income into comparison-year dollars using the chained CPI-U-RS index.
 * Returns null before 1913 or when the index lacks either year. Status is derived, never observed.
 * Method: docs/methodology/lives-across-decades.md.
 */
import {
  LIVES_CPI_COMPARISON_YEAR,
  LIVES_CPI_FIRST_YEAR,
  LIVES_CPI_U,
  LIVES_CPI_U_RS,
} from './lives-cpi-annual.js';
import { chainCpiUrs, toYearDollars } from './lives-cpi-math.js';

export type LivesDerivedIncome = {
  readonly status: 'derived';
  readonly methodId: 'lives-cpi-real-income';
  readonly methodVersion: '1';
  readonly originalAmount: number;
  readonly originalYear: number;
  readonly comparisonYear: number;
  readonly comparisonAmount: number;
  readonly formula: string;
  readonly assumptions: readonly string[];
  readonly caption: string;
};

const INDEX = chainCpiUrs({ cpiU: LIVES_CPI_U, cpiURs: LIVES_CPI_U_RS });

export function deriveLivesRealIncome(input: {
  readonly amount: number;
  readonly year: number;
  readonly comparisonYear?: number;
  readonly sourceLabel: string;
}): LivesDerivedIncome | null {
  const comparisonYear = input.comparisonYear ?? LIVES_CPI_COMPARISON_YEAR;
  if (input.year < LIVES_CPI_FIRST_YEAR) return null;
  if (!(input.amount > 0)) return null;
  if (!INDEX[input.year] || !INDEX[comparisonYear]) return null;
  try {
    const comparisonAmount = toYearDollars(input.amount, input.year, comparisonYear, INDEX);
    return {
      status: 'derived',
      methodId: 'lives-cpi-real-income',
      methodVersion: '1',
      originalAmount: input.amount,
      originalYear: input.year,
      comparisonYear,
      comparisonAmount,
      formula: 'amount * CPI(comparisonYear) / CPI(originalYear) on chained CPI-U-RS',
      assumptions: [
        'All-items CPI-U-RS (national), not a regional CPI or rent index.',
        'Restates a published income; does not invent a historical price for a modern good.',
      ],
      caption: `${input.sourceLabel}: $${Math.round(input.amount).toLocaleString('en-US')} in ${input.year} dollars is about $${Math.round(comparisonAmount).toLocaleString('en-US')} in ${comparisonYear} dollars (CPI-U-RS).`,
    };
  } catch {
    return null;
  }
}

export { INDEX as LIVES_CPI_CHAINED_INDEX };
