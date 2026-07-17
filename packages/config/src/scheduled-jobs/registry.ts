/**
 * In-memory scheduled-job registry: register/get/list/require, mirroring the BB-037 adapter
 * registry (packages/domain/src/adapters/registry.ts) and BB-038 query-pack registry
 * (packages/domain/src/query-packs/registry.ts) "versioned config, fail-closed if unregistered"
 * discipline. No unregistered recurring job can be dispatched — requireScheduledJob /
 * assertJobMayBeDispatched throw for any id that was never registered.
 */
import { assertValidCronExpression } from './cron.js';
import {
  ALLOWED_AUTOMATIC_PUBLIC_EFFECTS,
  SCHEDULED_JOB_ENVIRONMENTS,
  TARGET_WORKER_PACKAGES,
  type JobRosterStatus,
  type ScheduledJobDefinition,
} from './types.js';

const JOB_ID_PATTERN = /^[a-z][a-z0-9-]{1,127}$/;

export class ScheduledJobNotRegisteredError extends Error {
  readonly jobId: string;
  constructor(jobId: string) {
    super(
      `No scheduled job is registered for id "${jobId}"; unregistered recurring jobs cannot run.`,
    );
    this.name = 'ScheduledJobNotRegisteredError';
    this.jobId = jobId;
  }
}

export function assertScheduledJobDefinitionValid(definition: ScheduledJobDefinition): void {
  if (!JOB_ID_PATTERN.test(definition.id)) {
    throw new Error(`Scheduled job id "${definition.id}" must be a safe lowercase slug`);
  }
  if (definition.owner.trim().length === 0) {
    throw new Error(`Scheduled job "${definition.id}" must declare an owner`);
  }
  assertValidCronExpression(definition.cadence.cronExpression);
  if (!(definition.cadence.nominalIntervalMs > 0)) {
    throw new Error(`Scheduled job "${definition.id}" must declare a positive nominalIntervalMs`);
  }
  if (!(definition.budget.maxPerRun > 0)) {
    throw new Error(`Scheduled job "${definition.id}" must declare a positive budget.maxPerRun`);
  }
  if (!(definition.timeoutSec > 0) || definition.timeoutSec > 86_400) {
    throw new Error(
      `Scheduled job "${definition.id}" timeoutSec must be between 1 and 86400 (24h)`,
    );
  }
  if (
    !definition.idempotencyKeyScheme.includes('{jobId}') ||
    !/\{[a-zA-Z]+\}/.test(definition.idempotencyKeyScheme.replace('{jobId}', ''))
  ) {
    throw new Error(
      `Scheduled job "${definition.id}" idempotencyKeyScheme must reference {jobId} and a time-window token`,
    );
  }
  if (!TARGET_WORKER_PACKAGES.includes(definition.targetWorker.package)) {
    throw new Error(
      `Scheduled job "${definition.id}" targetWorker.package must be one of ${TARGET_WORKER_PACKAGES.join(', ')} (ADR-007)`,
    );
  }
  if (definition.targetWorker.function.trim().length === 0) {
    throw new Error(`Scheduled job "${definition.id}" must declare targetWorker.function`);
  }
  if (!SCHEDULED_JOB_ENVIRONMENTS.includes(definition.environment)) {
    throw new Error(
      `Scheduled job "${definition.id}" environment must be one of ${SCHEDULED_JOB_ENVIRONMENTS.join(', ')}`,
    );
  }
  if (
    definition.publicEffect !== 'none' &&
    !(ALLOWED_AUTOMATIC_PUBLIC_EFFECTS as readonly string[]).includes(definition.publicEffect)
  ) {
    throw new Error(
      `Scheduled job "${definition.id}" publicEffect "${definition.publicEffect}" is not one of the pre-approved exceptions`,
    );
  }
  if (definition.rosterStatus === 'stub' && !definition.implementationOwnerBead) {
    throw new Error(
      `Scheduled job "${definition.id}" is a stub and must declare implementationOwnerBead`,
    );
  }
  if (!(definition.consecutiveMissedRunThreshold >= 1)) {
    throw new Error(
      `Scheduled job "${definition.id}" consecutiveMissedRunThreshold must be >= 1`,
    );
  }
}

export type ScheduledJobRegistryStore = {
  get(id: string): ScheduledJobDefinition | undefined;
  list(): readonly ScheduledJobDefinition[];
  save(definition: ScheduledJobDefinition): void;
};

export function createInMemoryScheduledJobRegistry(
  seed: readonly ScheduledJobDefinition[] = [],
): ScheduledJobRegistryStore {
  const entries = new Map<string, ScheduledJobDefinition>(
    seed.map((definition) => [definition.id, definition]),
  );
  return {
    get(id) {
      return entries.get(id);
    },
    list() {
      return [...entries.values()];
    },
    save(definition) {
      entries.set(definition.id, definition);
    },
  };
}

export function registerScheduledJob(
  store: ScheduledJobRegistryStore,
  definition: ScheduledJobDefinition,
): ScheduledJobDefinition {
  assertScheduledJobDefinitionValid(definition);
  if (store.get(definition.id)) {
    throw new Error(`Scheduled job already registered: ${definition.id}`);
  }
  store.save(definition);
  return definition;
}

export function getScheduledJob(
  store: ScheduledJobRegistryStore,
  id: string,
): ScheduledJobDefinition | undefined {
  return store.get(id);
}

/** Fail-closed lookup: throws ScheduledJobNotRegisteredError for any id never registered. */
export function requireScheduledJob(
  store: ScheduledJobRegistryStore,
  id: string,
): ScheduledJobDefinition {
  const found = store.get(id);
  if (!found) {
    throw new ScheduledJobNotRegisteredError(id);
  }
  return found;
}

export type ListScheduledJobsFilter = {
  readonly owner?: string;
  readonly rosterStatus?: JobRosterStatus;
  readonly targetWorkerPackage?: ScheduledJobDefinition['targetWorker']['package'];
};

export function listScheduledJobs(
  store: ScheduledJobRegistryStore,
  filter: ListScheduledJobsFilter = {},
): readonly ScheduledJobDefinition[] {
  return store.list().filter((definition) => {
    if (filter.owner !== undefined && definition.owner !== filter.owner) return false;
    if (filter.rosterStatus !== undefined && definition.rosterStatus !== filter.rosterStatus)
      return false;
    if (
      filter.targetWorkerPackage !== undefined &&
      definition.targetWorker.package !== filter.targetWorkerPackage
    )
      return false;
    return true;
  });
}

/** The entry point a dispatcher (Cloud Scheduler -> Cloud Tasks handler) calls before running a
 *  job id. Fail-closed: an id that was never registered is rejected, not silently skipped. */
export function assertJobMayBeDispatched(
  store: ScheduledJobRegistryStore,
  id: string,
): ScheduledJobDefinition {
  return requireScheduledJob(store, id);
}
