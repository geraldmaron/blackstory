/**
 * Browser-safe entry point for Lives Across the Decades.
 *
 * `@repo/domain/statistics` re-exports modules that read files with `node:fs`, so a client component
 * importing from it breaks the browser bundle. Everything here is pure: import Lives code from
 * `@repo/domain/statistics/lives` in web and mobile, never from the statistics barrel.
 */
export { JUXTAPOSITION_DISCLAIMER } from '../juxtaposition.js';

export {
  CANONICAL_RACE_ETHNICITY_SLICES,
  LIVES_LENSES,
  LIVES_LENS_DEFINITIONS,
  LIVES_LENS_LABELS,
  RACE_ETHNICITY_DEFINITION_LABELS,
  isLivesLens,
  lensForDefinition,
  normalizeRaceEthnicitySlice,
  preferredDefinition,
} from './race-ethnicity-slices.js';
export type { CanonicalRaceEthnicitySlice, LivesLens } from './race-ethnicity-slices.js';

export {
  LIVES_DECADES,
  LIVES_MEASUREMENT_REGIMES,
  LIVES_REGIME_DESCRIPTIONS,
  crossesLivesRegimeBoundary,
  isLivesDecade,
  livesAcsVintage,
  livesHispanicCounting,
  livesIncomeReferenceYear,
  livesRegimeForDecade,
  livesRegimesShareIncomeFooting,
} from './lives-regimes.js';
export type {
  LivesDecade,
  LivesHispanicCounting,
  LivesMeasurementRegime,
  LivesRegimeDescription,
} from './lives-regimes.js';

export {
  LIVES_CLASS_BUCKETS,
  LIVES_CONDITIONS,
  LIVES_SERIES,
  LIVES_TIER_KEYS,
  incomeBracketSeriesId,
  livesConditionLabel,
  livesConditionPublishedIn,
  livesDecadeForReferencePeriod,
  parseIncomeBracketSeriesId,
  workClassSeriesId,
} from './lives-metrics.js';
export type {
  LivesClassBucket,
  LivesConditionDefinition,
  LivesConditionKey,
  LivesTierKey,
} from './lives-metrics.js';

export {
  LIVES_AREAS,
  LIVES_NATIONAL,
  LIVES_REGIONS,
  livesAreaById,
  livesAreaBySlug,
  livesRegionForState,
  livesStateJurisdictionId,
} from './lives-regions.js';
export type { LivesAreaConfig } from './lives-regions.js';

export { livesPlaceAnchorsForArea } from './lives-place-anchors.js';
export type { LivesPlaceAnchor } from './lives-place-anchors.js';

export { livesFipsMentionedInPlace, livesSpeakerPlaceMismatch } from './lives-speaker-place.js';

export {
  aggregateDistribution,
  aggregateRate,
  coverageShare,
  estimateBandShares,
  estimateCountBelow,
  estimateMedian,
  sumBrackets,
} from './lives-aggregate.js';
export type { AggregatedRate, BandShares, IncomeBracket, StateCount } from './lives-aggregate.js';

export {
  LIVES_MIN_BASE,
  LIVES_MIN_COVERAGE,
  buildLivesAreaBundle,
  livesComparableChange,
} from './lives-timeline.js';
export type {
  BuildLivesAreaBundleInput,
  LivesApplicabilityInput,
  LivesAreaBundle,
  LivesBoundaryKind,
  LivesCell,
  LivesCellState,
  LivesConditionBundle,
  LivesCountNote,
  LivesCountNoteInput,
  LivesCoverageInput,
  LivesDecadeBundle,
  LivesFrameInput,
  LivesJurisdictionInput,
  LivesObservationInput,
  LivesRule,
  LivesSourceRef,
} from './lives-timeline.js';

export {
  LIVES_SNAPSHOT_VERSION,
  isLivesAreaSnapshot,
  livesSnapshotName,
} from './lives-snapshot.js';
export type { LivesAreaSnapshot, LivesRuleEntityRef } from './lives-snapshot.js';

export {
  LIVES_UNITS,
  LIVES_UNIT_LABELS,
  LIVES_UNIT_KICKERS,
  isLivesUnit,
  livesUnitEmphasis,
} from './lives-units.js';
export type { LivesUnit } from './lives-units.js';

export {
  LIVES_WORLD_DOMAINS,
  LIVES_WORLD_DOMAIN_LABELS,
  LIVES_WORLD_CLAIM_TYPES,
  LIVES_WORLD_GAP_STATES,
  LIVES_WORLD_CORE_DOMAINS,
  isLivesWorldDomain,
  isLivesWorldClaimType,
  validateLivesWorldBeats,
  livesWorldGapCard,
  selectLivesWorldBeats,
} from './lives-world.js';
export type {
  LivesWorldDomain,
  LivesWorldClaimType,
  LivesWorldGapState,
  LivesWorldSpeaker,
  LivesWorldBeatInput,
  LivesWorldBeat,
  LivesWorldGapCard,
} from './lives-world.js';

export { computeLivesAffordance } from './lives-affordance.js';
export type {
  LivesAffordanceKind,
  LivesAffordanceInput,
  LivesAffordanceResult,
} from './lives-affordance.js';

export { chainCpiUrs, toYearDollars, CPI_U_RS_LINK_YEAR } from './lives-cpi-math.js';
export type { AnnualIndex } from './lives-cpi-math.js';

export {
  LIVES_CPI_U,
  LIVES_CPI_U_RS,
  LIVES_CPI_COMPARISON_YEAR,
  LIVES_CPI_FIRST_YEAR,
} from './lives-cpi-annual.js';

export { deriveLivesRealIncome, LIVES_CPI_CHAINED_INDEX } from './lives-derived-income.js';
export type { LivesDerivedIncome } from './lives-derived-income.js';
