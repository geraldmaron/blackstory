
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
