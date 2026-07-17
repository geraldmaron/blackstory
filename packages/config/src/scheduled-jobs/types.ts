
/**
 * Scheduled-job registry contracts that other packages' recurring jobs plug into.
 * ADR-007 already picked the mechanism (Cloud Scheduler -> Cloud Tasks -> Cloud Run
 * Jobs/workers); this module only declares the versioned, fail-closed config contract that
 * mechanism is driven by. No live GCP mutation happens anywhere in this package — see
 * infra/gcp/scheduler/ for the declarative (not-applied) Cloud Scheduler mirror.
 *
 * Binding operating principle: automation PROPOSES, humans/reviewers DISPOSE. Every job here
 * either writes nothing public at all, or is one of the two pre-approved mechanical + reversible
 * exceptions declared below.
 */
import type { KillSwitchId } from '../kill-switches.js';

export const SCHEDULED_JOB_REGISTRY_VERSION = '1.0.0' as const;

/** ADR-007: worker code lives only in these three packages never a new worker microservice. */
export const TARGET_WORKER_PACKAGES = ['research', 'publication', 'security'] as const;
export type TargetWorkerPackage = (typeof TARGET_WORKER_PACKAGES)[number];


/**
 * Environment every scheduled job runs in. (ADR-012, landed in parallel with this)
 * names the research/admin pipeline project `blackbook-internal`; that ADR is committed, so we
 * reference the name directly rather than a numeric GCP project id (which may
 * still change before the project is actually provisioned).
 */
export const SCHEDULED_JOB_ENVIRONMENTS = ['blackbook-internal'] as const;
export type ScheduledJobEnvironment = (typeof SCHEDULED_JOB_ENVIRONMENTS)[number];


/**
 * Automation proposes, humans dispose. Every scheduled job's declared public-facing effect is
 * either fully private ('none', the default candidates/reports/flags only) or one of exactly
 * two pre-approved, mechanical, and reversible exceptions. Nothing else may reach a public
 * surface automatically, and even these two still go through assertScheduledJobOperationAllowed
 * (see publish-guard.ts), which never grants the four forbidden discovery operations.
 */
export const ALLOWED_AUTOMATIC_PUBLIC_EFFECTS = [
  /** Repairs a dead citation link to point at an archived copy. Reversible: the repair
   * only ever swaps in an archive.org/Wayback-style URL alongside the original, never deletes
   * or rewrites evidence. */
  'link-repair-archived-copy',
  /** Rebuilds a derived, regenerable artifact (map source tiles, search index) tied to
   * an already-activated release. Reversible: rebuilding from the same release is idempotent
   * and never changes canonical or public entity data. */
  'release-coupled-rebuild',
] as const;
export type AllowedAutomaticPublicEffect = (typeof ALLOWED_AUTOMATIC_PUBLIC_EFFECTS)[number];
export type JobPublicEffect = 'none' | AllowedAutomaticPublicEffect;

/** 'real': wired to already-shipped, tested code. 'stub': registry entry only; the owning
 * workstream has not built the job body yet. Both are equally "no unregistered job can run";
 * rosterStatus is reporting/documentation metadata, not a run-time gate. */
export const JOB_ROSTER_STATUSES = ['real', 'stub'] as const;
export type JobRosterStatus = (typeof JOB_ROSTER_STATUSES)[number];

export type JobCadence = {
  /** Five-field cron expression (minute hour day-of-month month day-of-week), UTC, OR the
   * literal sentinel 'event-driven' for jobs primarily triggered by a Pub/Sub event (mirrors
   * infra/firebase/backup/export-schedule.md's firestore-export-on-release convention) such
   * jobs still declare nominalIntervalMs as the safety-net poll missed-run window. */
  readonly cronExpression: string;
  /** Nominal interval in ms between expected runs. Cron intervals for monthly/annual cadences
   * are not evenly spaced; this is the deliberate operating approximation used for missed-run
   * math (see health.ts) rather than a full cron-to-schedule solver. */
  readonly nominalIntervalMs: number;
  readonly humanReadable: string;
};

export type JobBudget = {
  readonly unit: string;
  readonly maxPerRun: number;
};

export type JobTargetWorker = {
  readonly package: TargetWorkerPackage;
  /** Dotted reference to the function this job invokes, e.g.
   * 'adapters.run_health.evaluate_run_health'. Advisory/documentation for stub entries;
   * exercised directly by the real job wrappers under ./jobs/. */
  readonly function: string;
};

export type ScheduledJobDefinition = {
  readonly id: string;
  /** Owning workstream id(s) for this job's behavior. */
  readonly owner: string;
  readonly description: string;
  readonly cadence: JobCadence;
  readonly budget: JobBudget;
  readonly timeoutSec: number;
  /** Idempotency-key template; must reference {jobId} and a time-window token so replayed
   * Cloud Tasks dispatches within the same window collapse to one effect. */
  readonly idempotencyKeyScheme: string;
  readonly killSwitchId: KillSwitchId;
  readonly targetWorker: JobTargetWorker;
  readonly environment: ScheduledJobEnvironment;
  readonly publicEffect: JobPublicEffect;
  readonly rosterStatus: JobRosterStatus;
  /** Required when rosterStatus is 'stub': which workstream owns the still-to-be-built job body. */
  readonly implementationOwnerBead?: string;
  /** Consecutive missed nominal intervals before evaluateMissedRuns reports triggered=true.
   * Silence is a failure mode, not a default — see health.ts and alerting.ts. */
  readonly consecutiveMissedRunThreshold: number;
};
