/**
 * ops-data re-export of Lives CPI annual averages. Prefer @repo/domain/statistics/lives for
 * browser and shared math; this path keeps ingest scripts that already import from ./cpi-series.
 */
export {
  LIVES_CPI_U,
  LIVES_CPI_U_RS,
  LIVES_CPI_COMPARISON_YEAR,
  LIVES_CPI_FIRST_YEAR,
} from '@repo/domain/statistics/lives';
