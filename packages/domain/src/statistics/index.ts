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

export * from './public-data-summaries.js';

export {
  DATA_PAGE_INDICATOR_FIXTURE_BUNDLE,
  mergeDataPageIndicatorBundle,
  isDataPageIndicatorBundle,
} from './data-page-series.js';
export type {
  DataPageSourceRef,
  DataPageValueUnit,
  DataPageRacePairPoint,
  DataPageRacePairSeries,
  DataPageGroupedBarSeriesDef,
  DataPageGroupedBarPoint,
  DataPageGroupedBarSeries,
  DataPageIndicatorBundle,
  DataPageObservationRow,
} from './data-page-series.js';

export {
  PHASE1_INDICATOR_THEMES,
  PHASE1_INDICATOR_CATALOG,
  getPhase1Indicator,
  listPhase1IndicatorsByTheme,
  summarizePhase1IndicatorCatalog,
} from './phase1-indicator-catalog.js';
export type {
  Phase1IndicatorTheme,
  Phase1IndicatorDefinition,
  Phase1IndicatorCatalogSummary,
} from './phase1-indicator-catalog.js';

export { PHASE1_USSC_INDICATOR_DEFINITIONS } from './phase1-ussc-indicator-catalog.js';
export { PHASE1_DSL_RENEWING_INEQUALITY_INDICATOR_DEFINITIONS } from './phase1-dsl-renewing-inequality-indicator-catalog.js';
export { PHASE1_NHGIS_INDICATOR_DEFINITIONS } from './phase1-nhgis-indicator-catalog.js';
export {
  PHASE1_EJI_TRI_INDICATOR_DEFINITIONS,
  listPhase1EjiTriIndicators,
} from './phase1-eji-tri-indicator-catalog.js';
export {
  PHASE1_CHAS_INDICATOR_DEFINITIONS,
} from './phase1-chas-indicator-catalog.js';

export {
  THEME_IMPACT_THEME_IDS,
  THEME_IMPACT_PRIORITIES,
  REDLINING_POLICY_ERAS,
  DRUG_POLICY_ERAS,
  THEME_IMPACT_V1_SOURCE_ALLOWLIST,
  THEME_IMPACT_QUESTIONS,
  getThemeImpactQuestion,
  listThemeImpactQuestionsByTheme,
  listThemeImpactQuestionsByPriority,
  resolvePhase1BindingsForQuestion,
  assertThemeImpactPhase1BindingsValid,
  summarizeThemeImpactCatalog,
} from './theme-impact-questions.js';
export type {
  ThemeImpactThemeId,
  ThemeImpactPriority,
  RedliningPolicyEra,
  DrugPolicyEra,
  ThemeImpactAnswerShape,
  ThemeImpactMetricBinding,
  ThemeImpactArtifactClass,
  ThemeImpactQuestion,
  ThemeImpactV1SourceId,
  ThemeImpactCatalogSummary,
} from './theme-impact-questions.js';

export {
  THEME_IMPACT_PACKET_KIND,
  THEME_IMPACT_METHOD_STANCES,
  THEME_IMPACT_PACKET_STATUSES,
  THEME_IMPACT_GAP_STATES,
  THEME_IMPACT_BINDING_PURPOSES,
  buildThemeImpactPacket,
  assertThemeImpactPacketPublishable,
  createRedliningQ3FixturePacket,
} from './theme-impact-packet.js';
export type {
  ThemeImpactMethodStance,
  ThemeImpactPacketStatus,
  ThemeImpactGapState,
  ThemeImpactBindingPurpose,
  ThemeImpactProvenanceQuartet,
  ThemeImpactPacketGeography,
  ThemeImpactPacketObservation,
  ThemeImpactPacketDerived,
  ThemeImpactPacketArtifact,
  ThemeImpactEntityBinding,
  ThemeImpactPacket,
  BuildThemeImpactPacketInput,
} from './theme-impact-packet.js';
export {
  resolveThemeImpactPolicyEra,
  resolveThemeImpactPolicyEras,
} from './theme-impact-policy-eras.js';
export type { ThemeImpactPolicyEraView } from './theme-impact-policy-eras.js';
export {
  formatThemeImpactEstimate,
  parseThemeImpactPacketRow,
  themeImpactPacketToView,
} from './theme-impact-view.js';
export type {
  ThemeImpactArtifactView,
  ThemeImpactDerivedView,
  ThemeImpactObservationView,
  ThemeImpactPacketView,
  ThemeImpactProvenanceView,
} from './theme-impact-view.js';
