/**
 * Browser-safe entry point for Lives Across the Decades.
 *
 * `@repo/domain/statistics` re-exports modules that read files with `node:fs`, so a client
 * component importing from it breaks the browser bundle. Everything here is pure: import Lives
 * code from `@repo/domain/statistics/lives` in web and mobile, never from the statistics barrel.
 */
export { JUXTAPOSITION_DISCLAIMER } from '../juxtaposition.js';

export {
  CANONICAL_RACE_ETHNICITY_SLICES,
  LIVES_GROUP_DEFINITIONS,
  LIVES_GROUP_LABELS,
  LIVES_GROUP_SLICES,
  isLivesGroupSlice,
  normalizeRaceEthnicitySlice,
} from './race-ethnicity-slices.js';
export type { CanonicalRaceEthnicitySlice, LivesGroupSlice } from './race-ethnicity-slices.js';

export {
  LIVES_DECADES,
  LIVES_MEASUREMENT_REGIMES,
  LIVES_REGIME_DESCRIPTIONS,
  crossesLivesRegimeBoundary,
  isLivesDecade,
  livesHispanicOriginImputed,
  livesIncomeReferenceYear,
  livesRegimeForDecade,
  livesRegimesShareIncomeFooting,
} from './lives-regimes.js';
export type {
  LivesDecade,
  LivesMeasurementRegime,
  LivesRegimeDescription,
} from './lives-regimes.js';

export {
  LIVES_CLASS_BUCKETS,
  LIVES_CLASS_SHARE_METRIC,
  LIVES_CONDITION_METRICS,
  LIVES_TIER_KEYS,
  livesMetricId,
  livesMetricLabel,
} from './lives-metrics.js';
export type {
  LivesClassBucket,
  LivesMetricDefinition,
  LivesMetricKey,
  LivesMetricUnit,
  LivesTierKey,
} from './lives-metrics.js';

export { LIVES_REGIONS, livesRegionById, livesRegionBySlug } from './lives-regions.js';
export type { LivesRegionConfig } from './lives-regions.js';

export { buildLivesRegionBundle, livesComparableChange } from './lives-timeline.js';
export type {
  BuildLivesRegionBundleInput,
  LivesApplicabilityInput,
  LivesBoundaryKind,
  LivesCell,
  LivesCellState,
  LivesConditionBundle,
  LivesDecadeBundle,
  LivesFrameInput,
  LivesJurisdictionInput,
  LivesObservationInput,
  LivesRegionBundle,
  LivesRegionDecadeDefinitionInput,
  LivesRule,
  LivesSourceRef,
} from './lives-timeline.js';
