/**
 * Source adapter registry and contract public surface (BB-037).
 */
export {
  ADAPTER_REGISTRY_STATES,
  ADAPTER_RUN_OUTCOMES,
  type AdapterCandidateProvenance,
  type AdapterCandidateRecord,
  type AdapterRegistryState,
  type AdapterRunContext,
  type AdapterRunOutcome,
  type AdapterRunResult,
  type GeographicCoverage,
  type RateLimitPolicy,
  type SourceAdapterContract,
  type SourceRegistryEntry,
  type VolumeExpectation,
} from './types.js';

export {
  assertGeographicCoverageValid,
  assertRateLimitPolicyValid,
  assertSourceAdapterContractValid,
  assertVolumeExpectationValid,
} from './contract.js';

export {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  getSourceEntry,
  listSourceEntries,
  registerSource,
  setRegistryState,
  type ApproveSourcePolicyInput,
  type RegisterSourceInput,
  type SourceRegistryStore,
} from './registry.js';

export {
  assertAdapterMayRun,
  canAdapterRun,
  isCanaryMode,
  selectCanaryRecordIndices,
} from './gates.js';

export {
  evaluateRunHealth,
  shouldDeadLetterRun,
  shouldQuarantineRun,
  RUN_HEALTH_ISSUES,
  type EvaluateRunHealthInput,
  type EvaluateRunHealthResult,
  type RunHealthIssue,
} from './run-health.js';

export {
  buildParserDriftMetric,
  computeFieldNullRates,
  createDriftAccumulator,
  createInMemoryDriftMetricStore,
  recordFieldObservation,
  type DriftAccumulator,
  type DriftMetricStore,
  type ParserDriftMetric,
} from './drift.js';

export {
  ADAPTER_CANDIDATE_SCHEMA_VERSION,
  assertAdapterCandidateValid,
  assertCandidateHasProvenance,
  parseCandidateFixture,
  parseCandidateFixtureBatch,
  stampCandidateProvenance,
  validateAdapterCandidates,
  type ValidateCandidateOptions,
} from './candidates.js';

export * from './wikimedia/index.js';
export * from './federal/index.js';
