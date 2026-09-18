/**
 * Converting census dollars to comparison-year dollars for Lives Across the Decades.
 * Math and annual series live in @repo/domain/statistics/lives (browser-safe). This module
 * re-exports for ingest scripts that already import from ops-data.
 */
export {
  chainCpiUrs,
  toYearDollars,
  CPI_U_RS_LINK_YEAR,
  type AnnualIndex,
} from '@repo/domain/statistics/lives';
export {
  LIVES_CPI_U,
  LIVES_CPI_U_RS,
  LIVES_CPI_COMPARISON_YEAR,
  LIVES_CPI_FIRST_YEAR,
} from '@repo/domain/statistics/lives';
