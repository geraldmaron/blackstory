/**
 * Data feature barrel — mobile `/data` surface mirroring web DataSections.
 */
export { DataScreen } from './DataScreen';
export { getDataPageModel, DATA_INDICATOR_FIXTURE_BUNDLE, PHASE1_COVERAGE_SUMMARY } from './indicator-snapshot';
export { formatDataValue, formatCount } from './format';
export type {
  DataPageModel,
  DataIndicatorBundle,
  DataRacePairSeries,
  DataGroupedBarSeries,
  DataSourceRef,
  DataValueUnit,
  Phase1CoverageSummary,
} from './types';
