
/**
 * Cost and resource exhaustion controls.
 *
 * Deterministic policy matrix for bounded scaling, queue/job limits, database caps,
 * daily budgets, circuit breakers, and soft-shutdown ordering. Complements
 * App Hosting limits and endpoint quotas without duplicating their evaluators.
 * Fail closed when limits are exceeded or policy is unknown.
 */

import { RATE_LIMIT_POLICY_VERSION } from './rate-limits.js';

export const RESOURCE_CONTROL_POLICY_VERSION = '1.0.0' as const;

/** Workload priority optional research stops before public serving under pressure. */
export type WorkloadTier = 'public_serving' | 'essential_ops' | 'optional_research';

export type ServiceId =
  | 'web'
  | 'api-public'
  | 'api-submissions'
  | 'api-internal'
  | 'admin';

export type WorkerJobId =
  | 'research-discovery'
  | 'research-campaign'
  | 'publication-projection'
  | 'publication-release'
  | 'security-url-fetch'
  | 'security-quarantine';

export type CloudTasksQueueId =
  | 'submissions-intake'
  | 'url-evaluation'
  | 'publication-preview'
  | 'outbox-dispatch'
  | 'research-campaign';

export type BudgetCategory =
  | 'geocoder'
  | 'model'
  | 'ocr'
  | 'source_fetch'
  | 'research_campaign';

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export type ResourceDenialReason =
  | 'scaling_cap_exceeded'
  | 'queue_rate_exceeded'
  | 'queue_concurrency_exceeded'
  | 'job_duration_exceeded'
  | 'retry_budget_exhausted'
  | 'database_connection_exhausted'
  | 'statement_timeout'
  | 'daily_budget_exceeded'
  | 'campaign_budget_exceeded'
  | 'circuit_breaker_open'
  | 'soft_shutdown_active'
  | 'hard_stop_active'
  | 'unknown_policy';

export type RetryPolicy = {
  readonly maxAttempts: number;
  readonly initialBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly multiplier: number;
};

export type ServiceScalingLimits = {
  readonly serviceId: ServiceId;
  readonly runtime: 'firebase-app-hosting' | 'cloud-run';
  readonly tier: WorkloadTier;
  readonly minInstances: number;
  readonly maxInstances: number;
  readonly concurrency: number;
  readonly cpu: number;
  readonly memoryMiB: number;
  /** Reference to apphosting*.yaml when applicable. */
  readonly bb022Ref?: string;
};

export type CloudTasksQueuePolicy = {
  readonly queueId: CloudTasksQueueId;
  readonly tier: WorkloadTier;
  readonly maxDispatchesPerSecond: number;
  readonly maxConcurrentDispatches: number;
  readonly maxAttempts: number;
  readonly retry: RetryPolicy;
  readonly maxQueueDepth: number;
};

export type CloudRunJobPolicy = {
  readonly jobId: WorkerJobId;
  readonly tier: WorkloadTier;
  readonly cpu: number;
  readonly memoryMiB: number;
  readonly maxDurationSec: number;
  readonly maxRetries: number;
  readonly retry: RetryPolicy;
  readonly taskCount: number;
  readonly parallelism: number;
};

export type DatabaseResourceLimits = {
  readonly role: string;
  readonly maxConnections: number;
  readonly statementTimeoutMs: number;
  readonly idleTransactionTimeoutMs: number;
  readonly lockTimeoutMs: number;
};

export type DailyBudgetPolicy = {
  readonly category: BudgetCategory;
  readonly dailyCap: number;
  readonly unit: 'requests' | 'tokens' | 'bytes' | 'usd_cents';
  /** Percent of daily cap (0–100) triggering soft shutdown for optional workloads. */
  readonly softShutdownAtPercent: number;
  /** Percent of daily cap (0–100) triggering hard stop for the category. */
  readonly hardStopAtPercent: number;
  readonly automatedResponse: BudgetAutomatedResponse;
};

export type BudgetAutomatedResponse =
  | 'alert_only'
  | 'throttle_optional'
  | 'pause_research'
  | 'disable_geocoder'
  | 'disable_model'
  | 'disable_source_fetch';

export type ResearchCampaignBudget = {
  readonly maxCandidatesPerRun: number;
  readonly maxConcurrentAdapters: number;
  readonly maxDailyRuns: number;
  readonly maxWallClockSec: number;
  readonly maxEgressBytes: number;
};

export type BillingAlertPolicy = {
  readonly alertId: string;
  readonly thresholdPercent: number;
  readonly automatedResponse: BudgetAutomatedResponse;
  readonly notifyChannels: readonly ('email' | 'pagerduty' | 'slack')[];
  readonly runbookRef: string;
};

export type SoftShutdownPolicy = {
  /** Public historical corpus is never auto-disabled unless explicitly chosen. */
  readonly autoDisablePublicCorpus: false;
  readonly shutdownOrder: readonly WorkloadTier[];
  readonly preserveTiers: readonly WorkloadTier[];
};

export type ResourceControlDecisionAllowed = {
  readonly allowed: true;
  readonly policyVersion: string;
  readonly remainingBudget?: number;
  readonly retryAfterMs?: number;
};

export type ResourceControlDecisionDenied = {
  readonly allowed: false;
  readonly reason: ResourceDenialReason;
  readonly failClosed: true;
  readonly policyVersion: string;
  readonly retryAfterMs: number;
  readonly automatedResponse?: BudgetAutomatedResponse;
};

export type ResourceControlDecision =
  | ResourceControlDecisionAllowed
  | ResourceControlDecisionDenied;


/**
 * App Hosting caps mirrored here for cross-service validation only.
 * Authoritative values remain in apps/web/apphosting*.yaml (do not duplicate edits).
 */
export const BB022_APP_HOSTING_LIMITS = {
  production: {
    minInstances: 2,
    maxInstances: 6,
    concurrency: 40,
    cpu: 1,
    memoryMiB: 384,
  },
  staging: {
    minInstances: 0,
    maxInstances: 2,
    concurrency: 20,
    cpu: 1,
    memoryMiB: 256,
  },
} as const;

/** Conservative Cloud Run + App Hosting scaling matrix every service has a hard max. */
export const DEFAULT_SERVICE_SCALING_LIMITS: Record<ServiceId, ServiceScalingLimits> = {
  web: {
    serviceId: 'web',
    runtime: 'firebase-app-hosting',
    tier: 'public_serving',
    minInstances: BB022_APP_HOSTING_LIMITS.production.minInstances,
    maxInstances: BB022_APP_HOSTING_LIMITS.production.maxInstances,
    concurrency: BB022_APP_HOSTING_LIMITS.production.concurrency,
    cpu: BB022_APP_HOSTING_LIMITS.production.cpu,
    memoryMiB: BB022_APP_HOSTING_LIMITS.production.memoryMiB,
    bb022Ref: 'apps/web/apphosting.production.yaml',
  },
  'api-public': {
    serviceId: 'api-public',
    runtime: 'cloud-run',
    tier: 'public_serving',
    minInstances: 1,
    maxInstances: 8,
    concurrency: 80,
    cpu: 1,
    memoryMiB: 512,
  },
  'api-submissions': {
    serviceId: 'api-submissions',
    runtime: 'cloud-run',
    tier: 'essential_ops',
    minInstances: 0,
    maxInstances: 4,
    concurrency: 40,
    cpu: 1,
    memoryMiB: 512,
  },
  'api-internal': {
    serviceId: 'api-internal',
    runtime: 'cloud-run',
    tier: 'essential_ops',
    minInstances: 0,
    maxInstances: 3,
    concurrency: 20,
    cpu: 1,
    memoryMiB: 512,
  },
  admin: {
    serviceId: 'admin',
    runtime: 'cloud-run',
    tier: 'essential_ops',
    minInstances: 0,
    maxInstances: 2,
    concurrency: 20,
    cpu: 1,
    memoryMiB: 512,
  },
};

const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 5,
  initialBackoffMs: 1_000,
  maxBackoffMs: 300_000,
  multiplier: 2,
};

/** Cloud Tasks queue limits rate, concurrency, depth, and capped retries. */
export const DEFAULT_CLOUD_TASKS_POLICIES: Record<CloudTasksQueueId, CloudTasksQueuePolicy> = {
  'submissions-intake': {
    queueId: 'submissions-intake',
    tier: 'essential_ops',
    maxDispatchesPerSecond: 10,
    maxConcurrentDispatches: 20,
    maxAttempts: 5,
    retry: DEFAULT_RETRY,
    maxQueueDepth: 5_000,
  },
  'url-evaluation': {
    queueId: 'url-evaluation',
    tier: 'optional_research',
    maxDispatchesPerSecond: 5,
    maxConcurrentDispatches: 10,
    maxAttempts: 4,
    retry: { ...DEFAULT_RETRY, maxAttempts: 4 },
    maxQueueDepth: 2_000,
  },
  'publication-preview': {
    queueId: 'publication-preview',
    tier: 'essential_ops',
    maxDispatchesPerSecond: 2,
    maxConcurrentDispatches: 4,
    maxAttempts: 3,
    retry: { ...DEFAULT_RETRY, maxAttempts: 3, maxBackoffMs: 120_000 },
    maxQueueDepth: 500,
  },
  'outbox-dispatch': {
    queueId: 'outbox-dispatch',
    tier: 'essential_ops',
    maxDispatchesPerSecond: 20,
    maxConcurrentDispatches: 30,
    maxAttempts: 5,
    retry: DEFAULT_RETRY,
    maxQueueDepth: 10_000,
  },
  'research-campaign': {
    queueId: 'research-campaign',
    tier: 'optional_research',
    maxDispatchesPerSecond: 1,
    maxConcurrentDispatches: 2,
    maxAttempts: 3,
    retry: { ...DEFAULT_RETRY, maxAttempts: 3 },
    maxQueueDepth: 200,
  },
};

/** Cloud Run Job resource and retry limits per worker type. */
export const DEFAULT_CLOUD_RUN_JOB_POLICIES: Record<WorkerJobId, CloudRunJobPolicy> = {
  'research-discovery': {
    jobId: 'research-discovery',
    tier: 'optional_research',
    cpu: 1,
    memoryMiB: 1024,
    maxDurationSec: 3_600,
    maxRetries: 2,
    retry: { ...DEFAULT_RETRY, maxAttempts: 3 },
    taskCount: 1,
    parallelism: 1,
  },
  'research-campaign': {
    jobId: 'research-campaign',
    tier: 'optional_research',
    cpu: 2,
    memoryMiB: 2048,
    maxDurationSec: 14_400,
    maxRetries: 1,
    retry: { ...DEFAULT_RETRY, maxAttempts: 2, maxBackoffMs: 600_000 },
    taskCount: 1,
    parallelism: 1,
  },
  'publication-projection': {
    jobId: 'publication-projection',
    tier: 'essential_ops',
    cpu: 2,
    memoryMiB: 2048,
    maxDurationSec: 7_200,
    maxRetries: 2,
    retry: { ...DEFAULT_RETRY, maxAttempts: 3 },
    taskCount: 1,
    parallelism: 1,
  },
  'publication-release': {
    jobId: 'publication-release',
    tier: 'essential_ops',
    cpu: 1,
    memoryMiB: 1024,
    maxDurationSec: 1_800,
    maxRetries: 1,
    retry: { ...DEFAULT_RETRY, maxAttempts: 2 },
    taskCount: 1,
    parallelism: 1,
  },
  'security-url-fetch': {
    jobId: 'security-url-fetch',
    tier: 'optional_research',
    cpu: 1,
    memoryMiB: 512,
    maxDurationSec: 300,
    maxRetries: 2,
    retry: { ...DEFAULT_RETRY, maxAttempts: 3, maxBackoffMs: 60_000 },
    taskCount: 1,
    parallelism: 1,
  },
  'security-quarantine': {
    jobId: 'security-quarantine',
    tier: 'essential_ops',
    cpu: 1,
    memoryMiB: 512,
    maxDurationSec: 600,
    maxRetries: 2,
    retry: { ...DEFAULT_RETRY, maxAttempts: 3 },
    taskCount: 1,
    parallelism: 1,
  },
};

/** Per-role database connection and statement limits (Firestore-era: pool sizing for deferred SQL). */
export const DEFAULT_DATABASE_LIMITS: Record<string, DatabaseResourceLimits> = {
  role_public_read: {
    role: 'role_public_read',
    maxConnections: 10,
    statementTimeoutMs: 5_000,
    idleTransactionTimeoutMs: 30_000,
    lockTimeoutMs: 2_000,
  },
  role_submissions: {
    role: 'role_submissions',
    maxConnections: 5,
    statementTimeoutMs: 3_000,
    idleTransactionTimeoutMs: 15_000,
    lockTimeoutMs: 1_000,
  },
  role_publication: {
    role: 'role_publication',
    maxConnections: 8,
    statementTimeoutMs: 30_000,
    idleTransactionTimeoutMs: 60_000,
    lockTimeoutMs: 5_000,
  },
  role_research: {
    role: 'role_research',
    maxConnections: 4,
    statementTimeoutMs: 60_000,
    idleTransactionTimeoutMs: 30_000,
    lockTimeoutMs: 3_000,
  },
};

/** Daily geocoder, model, OCR, and source-fetch budgets with automated responses. */
export const DEFAULT_DAILY_BUDGETS: Record<BudgetCategory, DailyBudgetPolicy> = {
  geocoder: {
    category: 'geocoder',
    dailyCap: 5_000,
    unit: 'requests',
    softShutdownAtPercent: 80,
    hardStopAtPercent: 100,
    automatedResponse: 'disable_geocoder',
  },
  model: {
    category: 'model',
    dailyCap: 500_000,
    unit: 'tokens',
    softShutdownAtPercent: 75,
    hardStopAtPercent: 100,
    automatedResponse: 'disable_model',
  },
  ocr: {
    category: 'ocr',
    dailyCap: 1_000,
    unit: 'requests',
    softShutdownAtPercent: 80,
    hardStopAtPercent: 100,
    automatedResponse: 'throttle_optional',
  },
  source_fetch: {
    category: 'source_fetch',
    dailyCap: 2_000,
    unit: 'requests',
    softShutdownAtPercent: 80,
    hardStopAtPercent: 100,
    automatedResponse: 'disable_source_fetch',
  },
  research_campaign: {
    category: 'research_campaign',
    dailyCap: 50,
    unit: 'requests',
    softShutdownAtPercent: 70,
    hardStopAtPercent: 100,
    automatedResponse: 'pause_research',
  },
};

export const DEFAULT_RESEARCH_CAMPAIGN_BUDGET: ResearchCampaignBudget = {
  maxCandidatesPerRun: 500,
  maxConcurrentAdapters: 2,
  maxDailyRuns: 10,
  maxWallClockSec: 14_400,
  maxEgressBytes: 512 * 1024 * 1024,
};

export const DEFAULT_BILLING_ALERTS: readonly BillingAlertPolicy[] = [
  {
    alertId: 'budget-50-warning',
    thresholdPercent: 50,
    automatedResponse: 'alert_only',
    notifyChannels: ['email'],
    runbookRef: 'infra/gcp/cost-controls/hard-stop-runbook.md',
  },
  {
    alertId: 'budget-80-soft-shutdown',
    thresholdPercent: 80,
    automatedResponse: 'throttle_optional',
    notifyChannels: ['email', 'slack'],
    runbookRef: 'infra/gcp/cost-controls/hard-stop-runbook.md',
  },
  {
    alertId: 'budget-95-pause-research',
    thresholdPercent: 95,
    automatedResponse: 'pause_research',
    notifyChannels: ['email', 'slack', 'pagerduty'],
    runbookRef: 'infra/gcp/cost-controls/hard-stop-runbook.md',
  },
  {
    alertId: 'budget-100-hard-stop-optional',
    thresholdPercent: 100,
    automatedResponse: 'pause_research',
    notifyChannels: ['email', 'slack', 'pagerduty'],
    runbookRef: 'infra/gcp/cost-controls/hard-stop-runbook.md',
  },
];

export const DEFAULT_SOFT_SHUTDOWN_POLICY: SoftShutdownPolicy = {
  autoDisablePublicCorpus: false,
  shutdownOrder: ['optional_research', 'essential_ops'],
  preserveTiers: ['public_serving'],
};

export const BB025_POLICY_REF = RATE_LIMIT_POLICY_VERSION;

function allow(remainingBudget?: number): ResourceControlDecisionAllowed {
  const decision: ResourceControlDecisionAllowed = {
    allowed: true,
    policyVersion: RESOURCE_CONTROL_POLICY_VERSION,
  };
  if (remainingBudget !== undefined) {
    return { ...decision, remainingBudget };
  }
  return decision;
}

function deny(
  reason: ResourceDenialReason,
  retryAfterMs: number,
  automatedResponse?: BudgetAutomatedResponse,
): ResourceControlDecisionDenied {
  const decision: ResourceControlDecisionDenied = {
    allowed: false,
    reason,
    failClosed: true,
    policyVersion: RESOURCE_CONTROL_POLICY_VERSION,
    retryAfterMs,
  };
  if (automatedResponse !== undefined) {
    return { ...decision, automatedResponse };
  }
  return decision;
}

/** Capped exponential backoff for queue/job retries (attempt is 1-based). */
export function computeRetryDelay(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY,
): number {
  if (attempt < 1) {
    return policy.initialBackoffMs;
  }
  const exponent = Math.min(attempt - 1, 20);
  const delay = policy.initialBackoffMs * policy.multiplier ** exponent;
  return Math.min(Math.floor(delay), policy.maxBackoffMs);
}

/** Returns true when attempt exceeds configured max (fail closed no further retries). */
export function isRetryBudgetExhausted(attempt: number, policy: RetryPolicy): boolean {
  return attempt >= policy.maxAttempts;
}

/** Validates every deployable service has a conservative, finite maxInstances cap. */
export function assertAllServicesBounded(
  limits: Record<ServiceId, ServiceScalingLimits> = DEFAULT_SERVICE_SCALING_LIMITS,
): void {
  for (const [id, row] of Object.entries(limits) as Array<[ServiceId, ServiceScalingLimits]>) {
    if (row.maxInstances <= 0 || row.maxInstances > 100) {
      throw new Error(`${id}: maxInstances ${row.maxInstances} out of conservative range`);
    }
    if (row.minInstances > row.maxInstances) {
      throw new Error(`${id}: minInstances exceeds maxInstances`);
    }
    if (row.concurrency <= 0) {
      throw new Error(`${id}: concurrency must be positive`);
    }
  }
}

/** Validates optional research tier stops before public serving under soft shutdown. */
export function assertShutdownOrdering(
  policy: SoftShutdownPolicy = DEFAULT_SOFT_SHUTDOWN_POLICY,
): void {
  if (policy.autoDisablePublicCorpus !== false) {
    throw new Error('public corpus must never auto-disable unless explicitly chosen');
  }
  if (!policy.preserveTiers.includes('public_serving')) {
    throw new Error('public_serving must be preserved during soft shutdown');
  }
  const optionalIndex = policy.shutdownOrder.indexOf('optional_research');
  const essentialIndex = policy.shutdownOrder.indexOf('essential_ops');
  if (optionalIndex === -1 || essentialIndex === -1 || optionalIndex >= essentialIndex) {
    throw new Error('optional_research must shutdown before essential_ops');
  }
}

export type EvaluateScalingInput = {
  readonly serviceId: ServiceId;
  readonly requestedInstances: number;
};

/** Denies scale-out beyond configured maxInstances (fail closed). */
export function evaluateScalingCap(
  input: EvaluateScalingInput,
  limits: Record<ServiceId, ServiceScalingLimits> = DEFAULT_SERVICE_SCALING_LIMITS,
): ResourceControlDecision {
  const row = limits[input.serviceId];
  if (!row) {
    return deny('unknown_policy', 60_000);
  }
  if (input.requestedInstances > row.maxInstances) {
    return deny('scaling_cap_exceeded', 30_000);
  }
  return allow(row.maxInstances - input.requestedInstances);
}

export type EvaluateQueueDispatchInput = {
  readonly queueId: CloudTasksQueueId;
  readonly dispatchesThisSecond: number;
  readonly activeDispatches: number;
  readonly queueDepth: number;
  readonly attempt: number;
};

/** Evaluates Cloud Tasks dispatch against rate, concurrency, depth, and retry caps. */
export function evaluateQueueDispatch(
  input: EvaluateQueueDispatchInput,
  policies: Record<CloudTasksQueueId, CloudTasksQueuePolicy> = DEFAULT_CLOUD_TASKS_POLICIES,
): ResourceControlDecision {
  const policy = policies[input.queueId];
  if (!policy) {
    return deny('unknown_policy', 60_000);
  }
  if (isRetryBudgetExhausted(input.attempt, policy.retry)) {
    return deny('retry_budget_exhausted', 0);
  }
  if (input.queueDepth >= policy.maxQueueDepth) {
    return deny('queue_rate_exceeded', 60_000);
  }
  if (input.dispatchesThisSecond >= policy.maxDispatchesPerSecond) {
    return deny('queue_rate_exceeded', 1_000);
  }
  if (input.activeDispatches >= policy.maxConcurrentDispatches) {
    return deny('queue_concurrency_exceeded', 5_000);
  }
  return allow(policy.maxQueueDepth - input.queueDepth);
}

export type EvaluateDatabaseAcquireInput = {
  readonly role: string;
  readonly activeConnections: number;
  readonly statementElapsedMs?: number;
};

/** Fail closed on connection exhaustion or statement timeout breach. */
export function evaluateDatabaseAcquire(
  input: EvaluateDatabaseAcquireInput,
  limits: Record<string, DatabaseResourceLimits> = DEFAULT_DATABASE_LIMITS,
): ResourceControlDecision {
  const row = limits[input.role];
  if (!row) {
    return deny('unknown_policy', 60_000);
  }
  if (input.activeConnections >= row.maxConnections) {
    return deny('database_connection_exhausted', 5_000);
  }
  if (
    input.statementElapsedMs !== undefined &&
    input.statementElapsedMs >= row.statementTimeoutMs
  ) {
    return deny('statement_timeout', 0);
  }
  return allow(row.maxConnections - input.activeConnections);
}

export type EvaluateBudgetInput = {
  readonly category: BudgetCategory;
  readonly consumed: number;
  readonly billingAlertPercent?: number;
};

export type BudgetEvaluation = ResourceControlDecision & {
  readonly percentUsed: number;
  readonly softShutdownTriggered: boolean;
  readonly hardStopTriggered: boolean;
  readonly automatedResponse?: BudgetAutomatedResponse;
};

/** Evaluates daily budget consumption and pairs alerts with automated responses. */
export function evaluateDailyBudget(
  input: EvaluateBudgetInput,
  budgets: Record<BudgetCategory, DailyBudgetPolicy> = DEFAULT_DAILY_BUDGETS,
  billingAlerts: readonly BillingAlertPolicy[] = DEFAULT_BILLING_ALERTS,
): BudgetEvaluation {
  const policy = budgets[input.category];
  if (!policy) {
    return { ...deny('unknown_policy', 60_000), percentUsed: 100, softShutdownTriggered: true, hardStopTriggered: true };
  }

  const percentUsed = Math.min(100, Math.floor((input.consumed / policy.dailyCap) * 100));
  const softShutdownTriggered = percentUsed >= policy.softShutdownAtPercent;
  const hardStopTriggered = percentUsed >= policy.hardStopAtPercent;

  const billingResponse = [...billingAlerts]
    .reverse()
    .find((alert) => (input.billingAlertPercent ?? percentUsed) >= alert.thresholdPercent);

  const automatedResponse = hardStopTriggered
    ? policy.automatedResponse
    : softShutdownTriggered
      ? billingResponse?.automatedResponse ?? policy.automatedResponse
      : undefined;

  if (hardStopTriggered) {
    const denied = deny('daily_budget_exceeded', 3_600_000, automatedResponse);
    return {
      ...denied,
      percentUsed,
      softShutdownTriggered,
      hardStopTriggered,
      ...(automatedResponse !== undefined ? { automatedResponse } : {}),
    };
  }

  const allowed = allow(policy.dailyCap - input.consumed);
  return {
    ...allowed,
    percentUsed,
    softShutdownTriggered,
    hardStopTriggered,
    ...(automatedResponse !== undefined ? { automatedResponse } : {}),
  };
}

export type EvaluateSoftShutdownInput = {
  readonly tier: WorkloadTier;
  readonly budgetPercentUsed: number;
  readonly hardStopActive?: boolean;
};

/** Optional research stops before public serving; public corpus never auto-disabled. */
export function evaluateSoftShutdown(
  input: EvaluateSoftShutdownInput,
  policy: SoftShutdownPolicy = DEFAULT_SOFT_SHUTDOWN_POLICY,
  budgets: Record<BudgetCategory, DailyBudgetPolicy> = DEFAULT_DAILY_BUDGETS,
): ResourceControlDecision {
  if (input.hardStopActive) {
    if (policy.preserveTiers.includes(input.tier)) {
      return allow();
    }
    return deny('hard_stop_active', 3_600_000, 'pause_research');
  }

  const researchSoft = budgets.research_campaign.softShutdownAtPercent;
  if (
    input.budgetPercentUsed >= researchSoft &&
    policy.shutdownOrder.includes(input.tier)
  ) {
    if (input.tier === 'optional_research') {
      return deny('soft_shutdown_active', 1_800_000, 'pause_research');
    }
    if (input.tier === 'essential_ops' && input.budgetPercentUsed >= 95) {
      return deny('soft_shutdown_active', 1_800_000, 'throttle_optional');
    }
  }

  return allow();
}

export type CircuitBreakerConfig = {
  readonly failureThreshold: number;
  readonly recoveryTimeoutMs: number;
  readonly halfOpenMaxAttempts: number;
};

export type CircuitBreakerSnapshot = {
  readonly state: CircuitBreakerState;
  readonly failureCount: number;
  readonly openedAtMs?: number;
  readonly halfOpenAttempts: number;
};

/** Simple circuit breaker opens after threshold failures, fail closed while open. */
export function evaluateCircuitBreaker(
  snapshot: CircuitBreakerSnapshot,
  config: CircuitBreakerConfig,
  nowMs: number,
): { readonly decision: ResourceControlDecision; readonly next: CircuitBreakerSnapshot } {
  if (snapshot.state === 'open') {
    const elapsed = snapshot.openedAtMs ? nowMs - snapshot.openedAtMs : 0;
    if (elapsed >= config.recoveryTimeoutMs) {
      const next: CircuitBreakerSnapshot = {
        state: 'half_open',
        failureCount: 0,
        halfOpenAttempts: 0,
      };
      return { decision: allow(), next };
    }
    return {
      decision: deny('circuit_breaker_open', config.recoveryTimeoutMs - elapsed),
      next: snapshot,
    };
  }

  if (snapshot.state === 'half_open') {
    if (snapshot.halfOpenAttempts >= config.halfOpenMaxAttempts) {
      return {
        decision: deny('circuit_breaker_open', config.recoveryTimeoutMs),
        next: { state: 'open', failureCount: snapshot.failureCount, openedAtMs: nowMs, halfOpenAttempts: 0 },
      };
    }
    return { decision: allow(), next: snapshot };
  }

  if (snapshot.failureCount >= config.failureThreshold) {
    return {
      decision: deny('circuit_breaker_open', config.recoveryTimeoutMs),
      next: { state: 'open', failureCount: snapshot.failureCount, openedAtMs: nowMs, halfOpenAttempts: 0 },
    };
  }

  return { decision: allow(), next: snapshot };
}

export function recordCircuitFailure(
  snapshot: CircuitBreakerSnapshot,
  config: CircuitBreakerConfig,
  nowMs: number,
): CircuitBreakerSnapshot {
  if (snapshot.state === 'half_open') {
    return {
      state: 'open',
      failureCount: snapshot.failureCount + 1,
      openedAtMs: nowMs,
      halfOpenAttempts: snapshot.halfOpenAttempts + 1,
    };
  }
  const failureCount = snapshot.failureCount + 1;
  if (failureCount >= config.failureThreshold) {
    return { state: 'open', failureCount, openedAtMs: nowMs, halfOpenAttempts: 0 };
  }
  return { ...snapshot, failureCount };
}

export type AbusiveTrafficStep = {
  readonly serviceId: ServiceId;
  readonly requestedInstances: number;
  readonly queueId?: CloudTasksQueueId;
  readonly dispatchesPerSecond?: number;
  readonly category?: BudgetCategory;
  readonly budgetConsumed?: number;
};

export type AbusiveTrafficSimulationResult = {
  readonly scalingDenials: number;
  readonly queueDenials: number;
  readonly budgetHardStops: number;
  readonly researchSoftShutdowns: number;
  readonly publicServingPreserved: boolean;
  readonly maxObservedInstances: Record<ServiceId, number>;
};


/**
 * Simulates abusive traffic pattern: spike scaling, queue flood, budget burn.
 * Validates traffic cannot scale without bound and optional research stops first.
 */
export function simulateAbusiveTrafficPattern(
  steps: readonly AbusiveTrafficStep[],
): AbusiveTrafficSimulationResult {
  const maxObservedInstances: Record<ServiceId, number> = {
    web: 0,
    'api-public': 0,
    'api-submissions': 0,
    'api-internal': 0,
    admin: 0,
  };

  let scalingDenials = 0;
  let queueDenials = 0;
  let budgetHardStops = 0;
  let researchSoftShutdowns = 0;
  let publicServingPreserved = true;

  for (const step of steps) {
    const scaling = evaluateScalingCap({
      serviceId: step.serviceId,
      requestedInstances: step.requestedInstances,
    });
    maxObservedInstances[step.serviceId] = Math.max(
      maxObservedInstances[step.serviceId],
      scaling.allowed ? step.requestedInstances : DEFAULT_SERVICE_SCALING_LIMITS[step.serviceId].maxInstances,
    );
    if (!scaling.allowed) {
      scalingDenials += 1;
    }

    if (step.queueId !== undefined) {
      const queue = evaluateQueueDispatch({
        queueId: step.queueId,
        dispatchesThisSecond: step.dispatchesPerSecond ?? 0,
        activeDispatches: step.dispatchesPerSecond ?? 0,
        queueDepth: 0,
        attempt: 1,
      });
      if (!queue.allowed) {
        queueDenials += 1;
      }
    }

    if (step.category !== undefined && step.budgetConsumed !== undefined) {
      const budget = evaluateDailyBudget({
        category: step.category,
        consumed: step.budgetConsumed,
      });
      if (budget.hardStopTriggered) {
        budgetHardStops += 1;
      }
      const shutdown = evaluateSoftShutdown({
        tier: 'optional_research',
        budgetPercentUsed: budget.percentUsed,
      });
      if (!shutdown.allowed) {
        researchSoftShutdowns += 1;
      }
      const publicCheck = evaluateSoftShutdown({
        tier: 'public_serving',
        budgetPercentUsed: budget.percentUsed,
        hardStopActive: budget.hardStopTriggered,
      });
      if (!publicCheck.allowed) {
        publicServingPreserved = false;
      }
    }
  }

  return {
    scalingDenials,
    queueDenials,
    budgetHardStops,
    researchSoftShutdowns,
    publicServingPreserved,
    maxObservedInstances,
  };
}

/** Validates retry policies across queues and jobs use capped exponential backoff. */
export function assertRetryPoliciesBounded(
  queues: Record<CloudTasksQueueId, CloudTasksQueuePolicy> = DEFAULT_CLOUD_TASKS_POLICIES,
  jobs: Record<WorkerJobId, CloudRunJobPolicy> = DEFAULT_CLOUD_RUN_JOB_POLICIES,
): void {
  for (const policy of Object.values(queues)) {
    assertRetryBounded(policy.retry, policy.queueId);
  }
  for (const policy of Object.values(jobs)) {
    assertRetryBounded(policy.retry, policy.jobId);
    if (policy.maxRetries >= policy.retry.maxAttempts) {
      throw new Error(`${policy.jobId}: maxRetries must be less than retry.maxAttempts`);
    }
  }
}

function assertRetryBounded(retry: RetryPolicy, label: string): void {
  if (retry.maxAttempts < 1 || retry.maxAttempts > 10) {
    throw new Error(`${label}: maxAttempts out of range`);
  }
  if (retry.initialBackoffMs <= 0 || retry.maxBackoffMs <= retry.initialBackoffMs) {
    throw new Error(`${label}: invalid backoff bounds`);
  }
  if (retry.multiplier < 1.5) {
    throw new Error(`${label}: multiplier too low for exponential backoff`);
  }
  const lastDelay = computeRetryDelay(retry.maxAttempts, retry);
  if (lastDelay > retry.maxBackoffMs) {
    throw new Error(`${label}: retry delay exceeds maxBackoffMs`);
  }
}
