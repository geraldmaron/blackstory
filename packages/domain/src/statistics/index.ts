export {
  STATISTICAL_GEOGRAPHY_TYPES,
  isStatisticalGeographyType,
  STATISTICAL_ESTIMATE_TYPES,
  isStatisticalEstimateType,
  STATISTICAL_PERIOD_TYPES,
  isStatisticalPeriodType,
  asMetricId,
  asStatisticalObservationId,
  asDerivedMeasurementId,
} from './types.js';
export type {
  MetricId,
  StatisticalObservationId,
  DerivedMeasurementId,
  StatisticalGeographyType,
  StatisticalEstimateType,
  StatisticalPeriodType,
  StatisticalSeries,
  StatisticalObservation,
  DerivedMeasurement,
} from './types.js';

export {
  jurisdictionsAreDisjoint,
  validateSafeSummation,
  combineStandardErrors,
  combineMarginsOfError,
  computeGrowthRecord,
} from './combination-rules.js';
export type {
  JurisdictionDisjointnessInput,
  SafeSummationCheck,
  GrowthObservationInput,
  GrowthSignificanceResult,
  GrowthRecord,
} from './combination-rules.js';

export {
  CENSUS_COUNTY_BLACK_POPULATION_SERIES,
  CENSUS_COUNTY_TOTAL_POPULATION_SERIES,
  CENSUS_COUNTY_BLACK_POPULATION_SERIES_ID,
  CENSUS_COUNTY_TOTAL_POPULATION_SERIES_ID,
  censusCountyDecadeToObservations,
  nationalBlackGrowthFromDecades,
} from './census-county-decade.js';
export type {
  CensusCountyDecadeObservationInput,
  NationalBlackPopulationDecadeRow,
} from './census-county-decade.js';

export {
  CENSUS_NATIONAL_TOTAL_POPULATION_SERIES,
  CENSUS_NATIONAL_BLACK_POPULATION_SERIES,
  CENSUS_NATIONAL_FREE_BLACK_POPULATION_SERIES,
  CENSUS_NATIONAL_ENSLAVED_BLACK_POPULATION_SERIES,
  censusNationalDecadeToObservations,
  freeEnslavedTotalDiscrepancy,
  blackShareOfTotalPct,
  computeNationalPopulationChanges,
  assertKnownTimelineDecade,
} from './census-national-decade.js';
export type {
  CensusNationalDecadeObservationInput,
  NationalPopulationTimelineRow,
  NationalPopulationChange,
} from './census-national-decade.js';
