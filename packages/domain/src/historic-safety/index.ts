/**
 * Historic safety and place-context engine — public surface for this module tree.
 * Not yet re-exported from `packages/domain/src/index.ts`; callers inside this package can
 * import from `../historic-safety/index.js` directly until the root barrel adds
 * `export * from './historic-safety/index.js'`.
 */
export {
  HISTORIC_SAFETY_LAYER_IDS,
  isHistoricSafetyLayerId,
  COMPOSITE_ELIGIBLE_LAYER_IDS,
  isCompositeEligibleLayerId,
  HISTORIC_SAFETY_LAYER_LABELS,
  assertLayerCitationValid,
  assertLayerMethodologyNoteValid,
  assertLayerSignalValid,
} from './types.js';
export type {
  HistoricSafetyLayerId,
  CompositeEligibleLayerId,
  LayerCitation,
  LayerMethodologyNote,
  LayerSignal,
} from './types.js';

export {
  SUNDOWN_TOWN_CONFIDENCE_LEVELS,
  isSundownTownConfidence,
  HOLC_GRADES,
  isHolcGrade,
  HOLC_GRADE_LABELS,
  PLACE_CONDITION_DESIGNATION_KINDS,
  assertAreaConditionGeometryValid,
  assertAreaConditionRenderPrecisionValid,
  assertSundownTownDesignationValid,
  assertRedliningGradeDesignationValid,
  assertRestrictiveCovenantDesignationValid,
  assertPlaceConditionDesignationValid,
  sundownTownConfidenceAsOf,
  currentSundownTownConfidence,
  redliningGradeAsOf,
  currentRedliningGrade,
  createInMemoryPlaceConditionLayerStore,
} from './layer-record.js';
export type {
  SundownTownConfidence,
  HolcGrade,
  PlaceConditionDesignationKind,
  AreaGeometry,
  AreaConditionGeometry,
  SundownTownDesignationRecord,
  RedliningGradeDesignationRecord,
  RestrictiveCovenantDesignationRecord,
  PlaceConditionDesignationRecord,
  PlaceConditionLayerStore,
} from './layer-record.js';

export {
  DOCUMENTED_EVENT_CATEGORIES,
  isDocumentedEventCategory,
  DOCUMENTED_EVENT_CATEGORY_WEIGHTS,
  DOCUMENTED_EVENTS_METHODOLOGY_VERSION,
  assertDocumentedEventRecordValid,
  eraBandsForEvents,
  computeDocumentedEventsLayerSignal,
} from './documented-events.js';
export type {
  DocumentedEventCategory,
  DocumentedEventRecord,
  ComputeDocumentedEventsLayerInput,
} from './documented-events.js';

export {
  SUNDOWN_TOWN_METHODOLOGY_VERSION,
  SUNDOWN_TOWN_CONFIDENCE_WEIGHTS,
  computeSundownTownLayerSignal,
} from './sundown-town.js';
export type { ComputeSundownTownLayerInput } from './sundown-town.js';

export {
  EXCLUSION_INFRASTRUCTURE_METHODOLOGY_VERSION,
  HOLC_GRADE_WEIGHTS,
  RESTRICTIVE_COVENANT_PRESENCE_WEIGHT,
  computeExclusionInfrastructureLayerSignal,
} from './exclusion-infrastructure.js';
export type { ComputeExclusionInfrastructureLayerInput } from './exclusion-infrastructure.js';

export {
  PRESENCE_AFFIRMATION_CATEGORIES,
  isPresenceAffirmationCategory,
  PRESENCE_AFFIRMATION_CATEGORY_WEIGHTS,
  PRESENCE_AFFIRMATION_METHODOLOGY_VERSION,
  assertPresenceAffirmationRecordValid,
  computePresenceAffirmationLayerSignal,
} from './presence-affirmation.js';
export type {
  PresenceAffirmationCategory,
  PresenceAffirmationRecord,
  ComputePresenceAffirmationLayerInput,
} from './presence-affirmation.js';

export {
  MODERN_CONTEXT_METHODOLOGY_VERSION,
  HATE_CRIME_BIAS_CAVEAT,
  HATE_CRIME_SATURATION_INCIDENT_COUNT,
  assertHateCrimeStatRecordValid,
  computeModernContextLayerSignal,
  buildGeneralCrimeContextView,
  assertGeneralCrimeContextValid,
  modernContextAdvisoryPointer,
} from './modern-context.js';
export type {
  HateCrimeStatRecord,
  ComputeModernContextLayerInput,
  BuildGeneralCrimeContextViewInput,
} from './modern-context.js';

export {
  ScoringExclusionError,
  GENERAL_CRIME_CONTEXT_BIAS_CAVEAT,
  GENERAL_CRIME_STATS_SCORING_BANNED_KEYS,
  ADVISORY_SCORING_BANNED_KEYS,
  assertNoBannedScoringKeys,
  assertGeneralCrimeStatsAbsentFromScoringInput,
  assertScoringInputFreeOfExcludedData,
  HISTORIC_SAFETY_SCORING_TYPE_INVARIANTS,
} from './scoring-guard.js';
export type { GeneralCrimeContextRecord } from './scoring-guard.js';

export {
  COMPOSITE_ENGINE_VERSION,
  COMPOSITE_METHODOLOGY_VERSION,
  COMPOSITE_AUDIT_VERSION,
  COMPOSITE_LAYER_WEIGHTS,
  COUNTERWEIGHT_MAX_REDUCTION,
  assertNoExcludedLayerInComposite,
  computeComposite,
  compositeInputFingerprints,
  recalculateComposite,
  HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS,
} from './composite.js';
export type {
  CompositeLayerInputs,
  CompositeLayerContributions,
  CompositeResult,
  CompositeInputFingerprints,
  CompositeAudit,
  AuditedCompositeResult,
  RecalculateCompositeInput,
  ComputeCompositeInput,
} from './composite.js';

export {
  REFERENCED_LAUNCH_CORPUS_SLUGS,
  referencedLaunchCorpusRegistryEntryId,
  HISTORIC_SAFETY_SOURCE_IDS,
  isHistoricSafetySourceId,
  assertHistoricSafetySourceRegistrationValid,
  createInMemoryHistoricSafetySourceRegistryStore,
  registerHistoricSafetySource,
  buildHistoricSafetySourceRegistrationInputs,
  registerHistoricSafetySources,
} from './source-registry.js';
export type {
  HistoricSafetySourceId,
  HistoricSafetySourceRegistration,
  HistoricSafetySourceRegistryStore,
  RegisterHistoricSafetySourceInput,
} from './source-registry.js';

export {
  HISTORIC_SAFETY_SOURCE_CADENCE_IDS,
  HISTORIC_SAFETY_SOURCE_CADENCES,
  isLayerAsOfOverdueForCadence,
} from './update-cadence.js';
export type {
  HistoricSafetySourceCadence,
  HistoricSafetySourceCadenceId,
} from './update-cadence.js';

export {
  designationDisputeTargets,
  layerSignalDisputeTargets,
  recommendedCorrectionCategoryFor,
  designationRecordFullyDisputed,
} from './dispute.js';
export type { DesignationDisputeTarget } from './dispute.js';

export {
  MAP_OVERLAY_DIGNITY_RULES,
  MAP_OVERLAY_TONES,
  MapOverlayDignityViolationError,
  PROHIBITED_MAP_OVERLAY_STYLE_TERMS,
  assertNoDangerShadingStyleTerm,
  assertMapOverlayLayerConfigValid,
  buildNarrativeOffRampLabel,
} from './map-overlay.js';
export type { MapOverlayTone, MapOverlayLayerConfig } from './map-overlay.js';
