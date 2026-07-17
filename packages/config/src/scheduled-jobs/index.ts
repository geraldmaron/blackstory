/**
 * BB-084: scheduled-job registry public surface. The framework other beads' recurring jobs
 * plug into — see types.ts for the full design note and packages/config/src/scheduled-jobs/
 * roster.ts for the initial job roster (real vs stub entries clearly marked).
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
