/**
 * Source adapter registry and contract public surface.
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

// community discovery adapters wave 1 (RSS/Atom, Internet Archive + Wayback SPN, DPLA v2).
export * from './rss/index.js';
export * from './internet-archive/index.js';
export * from './dpla/index.js';

// Reddit discovery adapter (gated channel). Ships registered but DISABLED see
// /reddit/contract.ts for the HUMAN STEP (Responsible Builder application) that blocks
// ever moving this adapter's registry entry out of 'disabled'.
export * from './reddit/index.js';

// web-search (Brave Search API) and Common Crawl retrospective discovery. The web-search
// adapter ships registered DISABLED see ./web-search/normalizer.ts's assertStorageTermsConfirmed
// for the second, independent gate that blocks persistence until a human obtains real written
// storage-rights confirmation from the vendor. Common Crawl needs no such gate (free/fair-use).
export * from './web-search/index.js';
export * from './common-crawl/index.js';

// Census TIGER/Gazetteer source registry entry (jurisdiction reference data).
export * from './census-geo/index.js';
export * from './census-demographics/index.js';

// Legal landscape adapters fixtures-first.
export * from './legal/index.js';
