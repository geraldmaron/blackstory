
/**
 * Scheduled-job registry public surface. Other packages' recurring jobs plug into this
 * framework — see types.ts for the design note and roster.ts for the initial job roster
 * (real vs stub entries clearly marked).
 */
export {
  SCHEDULED_JOB_REGISTRY_VERSION,
  TARGET_WORKER_PACKAGES,
  SCHEDULED_JOB_ENVIRONMENTS,
  ALLOWED_AUTOMATIC_PUBLIC_EFFECTS,
  JOB_ROSTER_STATUSES,
  type TargetWorkerPackage,
  type ScheduledJobEnvironment,
  type AllowedAutomaticPublicEffect,
  type JobPublicEffect,
  type JobRosterStatus,
  type JobCadence,
  type JobBudget,
  type JobTargetWorker,
  type ScheduledJobDefinition,
} from './types.js';

export { isValidCronExpression, assertValidCronExpression, EVENT_DRIVEN_CADENCE_SENTINEL } from './cron.js';

export { scheduledJobKillSwitchId } from './kill-switch.js';

export {
  ScheduledJobNotRegisteredError,
  assertScheduledJobDefinitionValid,
  createInMemoryScheduledJobRegistry,
  registerScheduledJob,
  getScheduledJob,
  requireScheduledJob,
  listScheduledJobs,
  assertJobMayBeDispatched,
  type ScheduledJobRegistryStore,
  type ListScheduledJobsFilter,
} from './registry.js';

export { DEFAULT_SCHEDULED_JOBS, createDefaultScheduledJobRegistry } from './roster.js';

export {
  JOB_RUN_STATUSES,
  startJobRun,
  completeJobRun,
  failJobRun,
  createInMemoryJobRunStore,
  type JobRunStatus,
  type JobRunRecord,
  type JobRunStore,
} from './run-record.js';

export {
  evaluateMissedRuns,
  evaluateJobBudget,
  type MissedRunEvaluation,
  type BudgetEvaluation,
} from './health.js';

export {
  buildMissedRunAlert,
  buildBudgetExceededAlert,
  buildJobRunAlerts,
} from './alerting.js';

export { assertScheduledJobOperationAllowed, jobDeclaresPublicEffect } from './publish-guard.js';

export {
  buildJobRunAuditEvent,
  buildJobRunOutboxMessage,
  type BuildJobRunAuditEventInput,
  type BuildJobRunOutboxMessageInput,
} from './audit.js';

export {
  SOURCE_DRIFT_RUN_HEALTH_JOB_ID,
  runSourceDriftRunHealthJob,
  type SourceDriftRunHealthJobInput,
  type SourceDriftRunHealthJobResult,
} from './jobs/source-drift-run-health.js';

export {
  GOLD_CORPUS_REGRESSION_JOB_ID,
  runGoldCorpusRegressionJob,
  type GoldCorpusRegressionJobInput,
  type GoldCorpusRegressionJobResult,
} from './jobs/gold-corpus-regression.js';

export {
  BACKUP_VERIFICATION_JOB_ID,
  runBackupVerificationJob,
  buildVerifyRestoreArgs,
  type ExecFileFn,
  type ExecFileResult,
  type BackupVerificationJobInput,
  type BackupVerificationJobResult,
} from './jobs/backup-verification.js';

export {
  RESTORE_DRILL_JOB_ID,
  runRestoreDrillJob,
  type RestoreDrillJobInput,
  type RestoreDrillJobResult,
} from './jobs/restore-drill.js';

export {
  RECALIBRATION_REPORT_JOB_ID,
  DEFAULT_RECALIBRATION_DRIFT_THRESHOLDS,
  runRecalibrationReportJob,
  buildRecalibrationDriftAlert,
  type RecalibrationReportJobInput,
  type RecalibrationReportJobResult,
} from './jobs/recalibration-report.js';

export {
  CITATION_LINK_HEALTH_SWEEP_JOB_ID,
  nodeResolveHost as citationLinkHealthNodeResolveHost,
  nodePinnedTransport as citationLinkHealthNodePinnedTransport,
  checkCitationLinkThroughSafeFetch,
  runCitationLinkHealthSweepJob,
  type CitationLinkHealthCheckInput,
  type CitationLinkHealthRepair,
  type CitationLinkHealthCheckOutcome,
  type CitationLinkHealthSweepJobInput,
  type CitationLinkHealthSweepJobResult,
} from './jobs/citation-link-health-sweep.js';

export {
  REDDIT_DELETION_SYNC_JOB_ID,
  runRedditDeletionSyncJob,
  type RedditDeletionSyncJobInput,
  type RedditDeletionSyncJobResult,
} from './jobs/reddit-deletion-sync.js';

export {
  LEGAL_CHANGE_MONITORING_JOB_ID,
  runLegalChangeMonitoringJob,
  type LegalChangeMonitoringJobInput,
  type LegalChangeMonitoringJobResult,
} from './jobs/legal-change-monitoring.js';

export {
  COMMUNITY_OBSCURITY_DISCOVERY_JOB_ID,
  runCommunityObscurityDiscoveryJob,
  type CommunityObscurityDiscoveryJobInput,
  type CommunityObscurityDiscoveryJobResult,
} from './jobs/community-obscurity-discovery.js';

export {
  RSS_DISCOVERY_CAMPAIGN_JOB_ID,
  runRssDiscoveryCampaignJob,
  type RssDiscoveryCampaignJobInput,
  type RssDiscoveryCampaignJobResult,
} from './jobs/discovery-campaign-rss.js';

export {
  DISCOVERY_CAMPAIGN_WIKIMEDIA_FEDERAL_JOB_ID,
  runDiscoveryCampaignWikimediaFederalJob,
  type DiscoveryCampaignWikimediaFederalJobInput,
  type DiscoveryCampaignWikimediaFederalJobResult,
} from './jobs/discovery-campaign-wikimedia-federal.js';

export {
  DISCOVERY_CAMPAIGN_ARCHIVE_DPLA_JOB_ID,
  runDiscoveryCampaignArchiveDplaJob,
  type DiscoveryCampaignArchiveDplaJobInput,
  type DiscoveryCampaignArchiveDplaJobResult,
} from './jobs/discovery-campaign-archive-dpla.js';

export {
  DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID,
  runDiscoveryCampaignWebSearchJob,
  type DiscoveryCampaignWebSearchJobInput,
  type DiscoveryCampaignWebSearchJobResult,
} from './jobs/discovery-campaign-web-search.js';
