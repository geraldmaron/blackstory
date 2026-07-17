/**
 * Versioned historical query packs public surface.
 */
export {
  QUERY_PACK_SCHEMA_VERSION,
  TERM_CLASSES,
  SIGNAL_STRENGTHS,
  MATCH_OUTCOMES,
  QUERY_PACK_THEMES,
  type TermClass,
  type SignalStrength,
  type MatchOutcome,
  type QueryPackTheme,
  type QueryTerm,
  type QueryPackVersion,
  type QueryPackVersionId,
  type QueryPack,
  type PublicSafeTerm,
  type DiscoveryRunContext,
  type StampedDiscoveryRun,
  type QueryPackEffectivenessRecord,
  type QueryPackEffectivenessMetrics,
  type FixtureMatchExpectation,
  type QueryPackFixture,
} from './types.js';

export {
  isTermClass,
  assertTermClass,
  assertQueryTermValid,
  assertQueryTermsValid,
  toPublicSafeTerms,
  toResearchQueryTerms,
  countRedactedTerms,
  publicSafeSummary,
} from './terms.js';

export {
  assertSemverValid,
  computeQueryPackContentHash,
  buildQueryPackVersionId,
  buildQueryPackVersion,
  buildQueryPack,
  assertQueryPackValid,
  parseQueryPackFixture,
  evaluateTextAgainstTerms,
  type BuildQueryPackInput,
} from './pack.js';

export {
  classifySignalStrength,
  outcomeForSignalStrength,
  assertMayPromoteBeyondCandidate,
  mayPromoteBeyondCandidate,
  type ClassifySignalInput,
  type ClassifySignalResult,
} from './classification.js';

export { stampDiscoveryRun, assertDiscoveryRunStamped } from './discovery.js';

export {
  createInMemoryEffectivenessStore,
  recordQueryPackMetric,
  computeEffectivenessMetrics,
  listEffectivenessRecords,
  type EffectivenessMetricStore,
  type RecordEffectivenessInput,
  type ComputeEffectivenessInput,
} from './metrics.js';

export {
  createInMemoryQueryPackRegistry,
  registerQueryPack,
  getQueryPack,
  listQueryPacks,
  resolveQueryPackForRun,
  type QueryPackRegistryStore,
  type ListQueryPacksFilter,
} from './registry.js';
