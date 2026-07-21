/**
 * Public surface of @repo/operator-cli.
 *
 * Every operation here PROPOSES data into the existing quarantine research-case
 * pipeline. Nothing exported from this package can approve, promote, or publish anything
 * see `promotion-boundary.test.ts`, which enumerates this exact export list to prove it.
 */
export {
  OPERATOR_SOURCES,
  assertOperatorIdentity,
  buildOperatorActor,
  operatorStamp,
  type OperatorIdentity,
  type OperatorSource,
  type OperatorStamp,
} from './identity.js';

export {
  buildOperatorAuditEvent,
  buildOperatorOutboxMessage,
  type BuildOperatorAuditEventInput,
  type BuildOperatorOutboxMessageInput,
} from './audit.js';

export {
  OPERATOR_PROPOSAL_KINDS,
  buildLeadSubmission,
  prepareEvidenceAttachmentIntake,
  prepareLeadIntake,
  prepareOperatorIntake,
  prepareSourceRegistrationIntake,
  type EvidenceAttachmentInput,
  type LeadInput,
  type OperatorIntakeAccepted,
  type OperatorIntakeContext,
  type OperatorIntakeOutcome,
  type OperatorIntakeRejected,
  type OperatorProposalKind,
  type OperatorSubmission,
  type OperatorSubmissionKind,
  type PrepareOperatorIntakeOptions,
  type SourceRegistrationInput,
} from './intake.js';

export {
  parseLeadsFromCsv,
  parseLeadsFromMarkdown,
  parseLeadsFromText,
  prepareBulkLeadIntake,
  type BulkImportFormat,
  type BulkImportRowOutcome,
  type BulkImportSummary,
} from './bulk-import.js';

export { commitOperatorIntake } from './commit.js';

export {
  prepareDiscoverySurvivorIntake,
  DISCOVERY_SURVIVOR_INTAKE_VERSION,
  type DiscoverySurvivorIntakeItem,
  type DiscoverySurvivorIntakeResult,
  type PrepareDiscoverySurvivorIntakeInput,
} from './discovery-survivor-intake.js';

export {
  buildCitationPrefill,
  createNodeSafeFetchDependencies,
  nodePinnedTransport,
  nodeResolveHost,
  planSelectiveCapture,
  runQuickAddFetch,
  type CapturePlan,
  type CitationPrefill,
} from './fetch.js';

export {
  runResearchIntake,
  type ResearchIntakeInput,
  type ResearchIntakeOutcome,
} from './research-intake.js';

export {
  runBoundedDiscoveryCampaign,
  summarizeDiscoveryYield,
  type DiscoveryRunBatch,
  type DiscoveryYieldSummary,
  type RunBoundedDiscoveryCampaignInput,
} from './discovery-run.js';

export {
  runCommunityObscurityOperatorCampaign,
  summarizeCommunityObscurityRun,
  type CommunityObscurityRunInput,
  type CommunityObscurityRunSummary,
} from './community-obscurity-run.js';

export {
  runRssOperatorCampaign,
  summarizeRssCampaignRun,
  type RssCampaignRunInput,
  type RssCampaignRunSummary,
} from './rss-campaign-run.js';

export {
  createLlmProvider,
  createMockLlmProvider,
  createOpenRouterLlmProvider,
  createOllamaLlmProvider,
  createHybridLlmProvider,
  extractMessageContent,
  type LlmProvider,
  type CreateLlmProviderOptions,
} from './llm-provider.js';
export {
  DEFAULT_STORY_REWRITE_MODEL,
  DEFAULT_STORY_REWRITE_MODELS,
  STORY_REWRITE_MIN_WORDS,
  rewriteStory,
  validateStoryRewrite,
  type StoryRewriteDraft,
  type StoryRewriteResult,
  type StoryProjection,
  type PublicStorySection,
} from './story-rewrite.js';
export {
  STORY_REWRITE_ARTIFACT_DIR,
  buildMockStoryRewriteBody,
  createMockStoryRewriteProvider,
  formatStoryRewriteLaneResult,
  hasOpenRouterCredentials,
  resolveStoryRewriteProvider,
  runStoryRewriteLane,
  writeStoryRewriteArtifact,
  type StoryRewriteLaneInput,
  type StoryRewriteLaneSummary,
} from './story-rewrite-lane.js';

export { mapPool } from './map-pool.js';

export {
  runWorkerPreflight,
  type WorkerPreflightCheck,
  type WorkerPreflightDependencies,
  type WorkerPreflightReport,
} from './worker-preflight.js';

export {
  LEDGER_PARITY_CHECKLIST,
  DEFAULT_PARITY_CYCLES,
  parityChecklistMarkdown,
  type ParityChecklistItem,
  type ParityCycleRecord,
  type ParityCycleStatus,
} from './ledger-parity.js';

export {
  assertPostgresOpsDataSource,
  editorialCatalogFromError,
  POSTGRES_OPS_DATA_SOURCE_MESSAGE,
} from './ops-data-source-gate.js';

export {
  runEditorialJudge,
  type EditorialRunInput,
  type EditorialRunResult,
  type EditorialProgressEvent,
  type EditorialSubject,
  type EditorialCatalogEntity,
} from './editorial-run.js';

export {
  mergeEditorialCatalogFromDocs,
  mergeJsonCatalogOverCanonical,
  extractEmbeddingVector,
} from './editorial-catalog.js';

export { loadEditorialCatalogFromPostgres } from './editorial-catalog-postgres.js';

export { runEnrichmentJudge, type EnrichmentRunResult } from './enrichment-run.js';

export { loadPendingEditorialItems, type PendingListResult } from './pending-list.js';

export { prepareEditorialPacketIntake } from './editorial-intake.js';

export {
  runStoryResearch,
  gatherStoryTopicSourceSnippets,
  type StoryTopicSeed,
  type StoryResearchRunInput,
  type StoryResearchRunResult,
  type StoryResearchRunItem,
} from './story-research-run.js';

export {
  runResearchDirective,
  defaultDirectiveGather,
  createTargetedBriefHandlers,
  createSundownTownCountyHandlers,
  runSundownTownCountyBrief,
  loadTougalooGeojsonFeatures,
  filterSundownGeojsonFeatures,
  parseSundownTownPageText,
  TOUGALOO_GEOJSON_URL,
  TOUGALOO_STATE_LIST_URL,
  type ResearchDirectiveKind,
  type ResearchDirectivePlan,
  type ResearchDirectiveGatherResult,
  type ResearchDirectiveContext,
  type ResearchDirectiveHandlers,
  type ResearchDirectiveRunResult,
  type TargetedBriefSubject,
  type TargetedBriefExtracted,
  type TargetedBriefDecision,
  type SundownTownCountyBrief,
  type SundownTownCandidateStub,
  type SundownTownCountyExtracted,
  type SundownTownCountyDecision,
} from './research-directive.js';

export {
  gatherSourceSnippet,
  gatherSourceSnippetsFromUrls,
  wrapPrefetchedSourceSnippet,
  formatGatheredSourceSnippet,
  formatGatheredSourceSnippets,
  type GatheredSourceSnippet,
  type GatherSourceSnippetsOptions,
} from './research-source-gather.js';

export { prepareStoryPacketIntake } from './story-intake.js';

export {
  prepareLocate,
  commitLocate,
  type LocateInput,
  type LocateOutcome,
  type LocateSuccess,
  type LocateFailure,
  type LocateDependencies,
  type CommitLocateInput,
} from './locate.js';

export { censusSafeHttpClient } from './census-http.js';

export { runCli, type CliDependencies } from './cli.js';
