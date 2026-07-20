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
  type DiscoveryCatalogMatch,
  type AuthorityFollowUpLead,
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

export { buildSourceReference, candidateIdentityKey, buildCandidateIdentity } from './identity.js';

export { extractGeographicHints, geographicHintWithinCountries } from './geography.js';

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

export {
  attachCatalogMatch,
  attachCatalogMatchesToSurvivors,
  type CatalogMatchCatalog,
  type AttachCatalogMatchResult,
  type AttachCatalogMatchesResult,
} from './catalog-match.js';

export {
  AUTHORITY_HOST_SUFFIXES,
  isAuthorityHost,
  normalizeAuthorityUrl,
  harvestAuthorityFollowUpsForCandidate,
  harvestAuthorityFollowUpsForCandidates,
  type AuthorityHostSuffix,
  type HarvestAuthorityFollowUpsInput,
  type HarvestAuthorityFollowUpsBatchInput,
} from './authority-harvest.js';

export {
  COMMUNITY_OBSCURITY_CAMPAIGN_KIND,
  runCommunityObscurityCampaign,
  type CommunityObscurityRankedLead,
  type CommunityObscurityCampaignResult,
  type RunCommunityObscurityCampaignInput,
} from './community-obscurity-campaign.js';

export {
  RSS_DISCOVERY_CAMPAIGN_KIND,
  runRssDiscoveryCampaign,
  type RssDiscoveryRankedLead,
  type RssDiscoveryCampaignResult,
  type RunRssDiscoveryCampaignInput,
} from './rss-campaign.js';

export {
  WIKIMEDIA_FEDERAL_CAMPAIGN_KIND,
  WIKIMEDIA_SUB_BUDGET_RESERVE,
  PARTICIPATING_ADAPTER_IDS,
  computeAdapterSubBudgets,
  runWikimediaFederalCampaign,
  type WikimediaFederalPerAdapterYield,
  type WikimediaFederalCampaignResult,
  type RunWikimediaFederalCampaignInput,
} from './wikimedia-federal-campaign.js';

export {
  ARCHIVE_DPLA_CAMPAIGN_KIND,
  ARCHIVE_DPLA_ADAPTER_IDS,
  ARCHIVE_DPLA_SUB_BUDGET_POLICY,
  applyArchiveDplaSubBudgets,
  runArchiveDplaCampaign,
  type ArchiveDplaSubBudgetSnapshot,
  type ArchiveDplaCampaignResult,
  type RunArchiveDplaCampaignInput,
} from './archive-dpla-campaign.js';

export {
  WEB_SEARCH_CAMPAIGN_KIND,
  WEB_SEARCH_MAX_REQUESTS_PER_RUN,
  assertWebSearchCampaignStorageTerms,
  runWebSearchCampaign,
  type WebSearchWaybackGate,
  type WebSearchCampaignRequestBudget,
  type WebSearchCampaignResult,
  type RunWebSearchCampaignInput,
} from './web-search-campaign.js';

export {
  OBSCURITY_METHODOLOGY_VERSION,
  OBSCURITY_METHODOLOGY_DISCLAIMER,
  OBSCURITY_WEIGHTS,
  HIGH_VISIBILITY_NAME_PHRASES,
  catalogNoveltyRaw,
  identifierSparsenessRaw,
  nameRarityRaw,
  geographicSpecificityRaw,
  lowAuthorityBoostRaw,
  highVisibilityPenaltyRaw,
  historyDayBoostRaw,
  brandCommercePenaltyRaw,
  obscurityBand,
  scoreObscurity,
  rankByObscurity,
  type ObscurityFactorId,
  type ObscurityFactorBreakdown,
  type ObscurityAssessment,
  type ObscurityReferenceCorpus,
  type ScoreObscurityInput,
} from './obscurity.js';

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

// Shared post-pipeline helpers for fixture-first discovery campaign runners.
export {
  CAMPAIGN_RUNNER_HELPERS_VERSION,
  assertCampaignCannotPublish,
  assertSurvivorSnippetsCapped,
  listCampaignSurvivors,
  partitionSurvivorsByRelevance,
  summarizeCampaignYield,
  runOptionalEditorialHook,
  toEditorialLeadPreview,
  type CampaignYieldSummary,
  type EditorialLeadPreview,
  type EditorialReviewDecision,
  type EditorialReviewResult,
  type CampaignEditorialHook,
  type PartitionByRelevanceInput,
  type PartitionByRelevanceResult,
} from './campaign-runner.js';
