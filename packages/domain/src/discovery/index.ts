/**
 * Candidate discovery pipeline public surface.
 * Discovery produces private research candidates only never public entities.
 */
export {
  DISCOVERY_CANDIDATE_SCHEMA_VERSION,
  DISCOVERY_CANDIDATE_STATUSES,
  DISCOVERY_FAILURE_OUTCOMES,
  DISCOVERY_INGEST_MODES,
  type DiscoveryCandidateStatus,
  type DiscoveryFailureOutcome,
  type DiscoveryIngestMode,
  type SourceReference,
  type DiscoveryCandidateIdentity,
  type GeographicHint,
  type DiscoverySignal,
  type DiscoveryCandidateRecord,
  type DiscoveryCampaignBudget,
  type DiscoveryCampaignBoundaries,
  type DiscoveryCampaignConfig,
  type DiscoveryReproducibilityStamp,
  type DiscoveryCampaignResult,
  type BulkIngestBatch,
  type ApiIngestRequest,
  type DiscoveryQuarantineRecord,
} from './types.js';

export {
  FORBIDDEN_DISCOVERY_OPERATIONS,
  assertDiscoveryCannotPublish,
  validateDiscoveryOperationsSafe,
  type ForbiddenDiscoveryOperation,
  type DiscoveryOperationAttempt,
} from './guard.js';

export { hashCandidateContent, stampDiscoveryReproducibility } from './hashing.js';

export {
  buildSourceReference,
  candidateIdentityKey,
  buildCandidateIdentity,
} from './identity.js';

export {
  extractGeographicHints,
  geographicHintWithinCountries,
} from './geography.js';

export {
  matchTermsInCandidate,
  classifyDiscoverySignal,
  extractDiscoverySignals,
  toDiscoverySignal,
} from './signals.js';

export {
  mergeDuplicateCandidates,
  areDuplicateCandidates,
  deduplicateByContentHash,
  type MergeDuplicateCandidatesResult,
} from './deduplication.js';

export {
  shouldRetryCandidate,
  resolveFailureOutcome,
  handleCandidateFailure,
  quarantineCandidate,
  deadLetterCandidate,
  shouldContinueCampaign,
  shouldStopForDeadLetters,
  type HandleCandidateFailureInput,
  type HandleCandidateFailureResult,
} from './quarantine.js';

export {
  assertCampaignBudgetValid,
  assertCampaignBoundariesValid,
  createDiscoveryCampaignConfig,
  isWithinCandidateBudget,
  isWithinQuarantineBudget,
  isWithinDeadLetterBudget,
  isWithinCampaignBudget,
  recordWithinCampaignBoundaries,
  type CampaignBudgetSnapshot,
} from './campaign.js';

export {
  ingestBulkCandidates,
  ingestApiCandidate,
  type IngestDiscoveryCandidateInput,
  type BulkIngestInterface,
  type ApiIngestInterface,
} from './ingestion.js';

export { runDiscoveryCampaign, type RunDiscoveryCampaignInput } from './pipeline.js';

// graylist recall lane below-threshold candidates parked with disposition, never
// silently dropped, queryable for later corroboration.
export {
  GRAYLIST_SCHEMA_VERSION,
  GRAYLIST_DISPOSITIONS,
  GRAYLIST_ENTRY_STATUSES,
  type GraylistDisposition,
  type GraylistEntryStatus,
  type GraylistEntry,
  type GraylistStore,
  createInMemoryGraylistStore,
  shouldPark,
  deriveGraylistDisposition,
  corroborationKeyFor,
  buildGraylistEntry,
  parkCandidate,
  queryGraylistByCorroborationKey,
  listGraylistByDisposition,
  promoteGraylistEntry,
  archiveGraylistEntry,
} from './graylist.js';
