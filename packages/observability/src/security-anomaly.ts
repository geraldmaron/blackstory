/**
 * Declarative anomaly detection rules and synthetic evaluator.
 * Rules operate on metric samples and security events without external dependencies.
 */
import type { SecurityMetricSample } from './security-metrics.js';
import type { SecurityEventKind, SecurityEventSeverity } from './security-events.js';

export const SECURITY_ANOMALY_POLICY_VERSION = '1.0.0' as const;

export type AnomalyComparator = 'gt' | 'gte' | 'lt' | 'lte';

export type AnomalyRule = {
  readonly id: string;
  readonly kind: SecurityEventKind;
  readonly metric: string;
  readonly description: string;
  readonly severity: SecurityEventSeverity;
  readonly runbookId: string;
  readonly windowMs: number;
  readonly threshold: number;
  readonly comparator: AnomalyComparator;
  readonly immediateNotification: boolean;
};

export const DEFAULT_ANOMALY_RULES: readonly AnomalyRule[] = [
  {
    id: 'SEC-ARMOR-01',
    kind: 'armor.throttle',
    metric: 'armor_throttles_total',
    description: 'Armor throttle rate exceeds baseline',
    severity: 'warning',
    runbookId: 'runbook/armor-throttle-spike',
    windowMs: 300_000,
    threshold: 100,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-ARMOR-02',
    kind: 'armor.deny',
    metric: 'armor_denies_total',
    description: 'Armor WAF deny rate exceeds baseline',
    severity: 'warning',
    runbookId: 'runbook/armor-deny-spike',
    windowMs: 600_000,
    threshold: 50,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-APPCHK-01',
    kind: 'app_check.failure',
    metric: 'app_check_failures_total',
    description: 'App Check failure burst',
    severity: 'warning',
    runbookId: 'runbook/app-check-failures',
    windowMs: 300_000,
    threshold: 25,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-AUTH-01',
    kind: 'authentication.failure',
    metric: 'authentication_failures_total',
    description: 'Authentication failure spike',
    severity: 'warning',
    runbookId: 'runbook/auth-failure-spike',
    windowMs: 300_000,
    threshold: 30,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-ADMIN-01',
    kind: 'administrator.role_changed',
    metric: 'administrator_role_changes_total',
    description: 'Any administrator role change',
    severity: 'critical',
    runbookId: 'runbook/admin-role-change',
    windowMs: 60_000,
    threshold: 0,
    comparator: 'gt',
    immediateNotification: true,
  },
  {
    id: 'SEC-SUB-01',
    kind: 'submission.spike',
    metric: 'submission_requests_total',
    description: 'Submission intake spike',
    severity: 'warning',
    runbookId: 'runbook/submission-spike',
    windowMs: 300_000,
    threshold: 200,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-SEARCH-01',
    kind: 'search.abuse',
    metric: 'search_guardrail_denials_total',
    description: 'Search guardrail denial burst',
    severity: 'warning',
    runbookId: 'runbook/search-abuse',
    windowMs: 300_000,
    threshold: 40,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-GEO-01',
    kind: 'geocoder.abuse',
    metric: 'geocoder_guardrail_denials_total',
    description: 'Geocoder abuse denial burst',
    severity: 'warning',
    runbookId: 'runbook/geocoder-abuse',
    windowMs: 300_000,
    threshold: 40,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-DB-01',
    kind: 'database.slow_query',
    metric: 'database_slow_queries_total',
    description: 'Slow query rate exceeds threshold',
    severity: 'warning',
    runbookId: 'runbook/slow-query',
    windowMs: 600_000,
    threshold: 10,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-DB-02',
    kind: 'database.unexpected_public_write',
    metric: 'database_unexpected_public_writes_total',
    description: 'Unexpected public schema write detected',
    severity: 'critical',
    runbookId: 'runbook/unexpected-public-write',
    windowMs: 60_000,
    threshold: 0,
    comparator: 'gt',
    immediateNotification: true,
  },
  {
    id: 'SEC-QUEUE-01',
    kind: 'queue.depth',
    metric: 'queue_depth',
    description: 'Queue depth exceeds safe operating level',
    severity: 'warning',
    runbookId: 'runbook/queue-depth',
    windowMs: 300_000,
    threshold: 500,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-QUEUE-02',
    kind: 'queue.retry',
    metric: 'queue_retries_total',
    description: 'Queue retry burst',
    severity: 'warning',
    runbookId: 'runbook/queue-retries',
    windowMs: 600_000,
    threshold: 50,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-SRC-01',
    kind: 'source_adapter.anomaly',
    metric: 'source_adapter_anomalies_total',
    description: 'Source adapter anomaly burst',
    severity: 'critical',
    runbookId: 'runbook/source-adapter-anomaly',
    windowMs: 600_000,
    threshold: 5,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-PUB-01',
    kind: 'publication.activity',
    metric: 'publication_events_total',
    description: 'Publication or release activation event',
    severity: 'critical',
    runbookId: 'runbook/publication-change',
    windowMs: 60_000,
    threshold: 0,
    comparator: 'gt',
    immediateNotification: true,
  },
  {
    id: 'SEC-RET-01',
    kind: 'retraction.activity',
    metric: 'retraction_events_total',
    description: 'Retraction or reversal event',
    severity: 'critical',
    runbookId: 'runbook/retraction-change',
    windowMs: 60_000,
    threshold: 0,
    comparator: 'gt',
    immediateNotification: true,
  },
  {
    id: 'SEC-STOR-01',
    kind: 'storage.access_denied',
    metric: 'storage_access_denials_total',
    description: 'Storage access denial burst',
    severity: 'warning',
    runbookId: 'runbook/storage-denial',
    windowMs: 600_000,
    threshold: 20,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-ERR-01',
    kind: 'service.error_rate',
    metric: 'service_errors_total',
    description: 'Service error rate spike',
    severity: 'critical',
    runbookId: 'runbook/error-rate-spike',
    windowMs: 300_000,
    threshold: 25,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-LAT-01',
    kind: 'service.latency',
    metric: 'service_latency_ms',
    description: 'p95 latency exceeds SLO',
    severity: 'warning',
    runbookId: 'runbook/latency-spike',
    windowMs: 300_000,
    threshold: 2_000,
    comparator: 'gt',
    immediateNotification: false,
  },
  {
    id: 'SEC-COST-01',
    kind: 'cost.anomaly',
    metric: 'cost_anomaly_score',
    description: 'Cost anomaly score exceeds budget guardrail',
    severity: 'critical',
    runbookId: 'runbook/cost-anomaly',
    windowMs: 3_600_000,
    threshold: 75,
    comparator: 'gte',
    immediateNotification: false,
  },
];

export type AnomalyEvaluation = {
  readonly ruleId: string;
  readonly kind: SecurityEventKind;
  readonly severity: SecurityEventSeverity;
  readonly runbookId: string;
  readonly observedValue: number;
  readonly threshold: number;
  readonly triggered: boolean;
  readonly immediateNotification: boolean;
  readonly windowMs: number;
};

function compare(value: number, threshold: number, comparator: AnomalyComparator): boolean {
  switch (comparator) {
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
  }
}

function parseTimestamp(iso: string): number {
  return Date.parse(iso);
}

/**
 * Evaluate anomaly rules against metric samples within each rule's time window.
 * Used by synthetic tests and local recorders before Cloud Monitoring wiring.
 */
export function evaluateAnomalyRules(input: {
  readonly rules?: readonly AnomalyRule[];
  readonly samples: readonly SecurityMetricSample[];
  readonly nowMs?: number;
}): readonly AnomalyEvaluation[] {
  const rules = input.rules ?? DEFAULT_ANOMALY_RULES;
  const nowMs = input.nowMs ?? Date.now();

  return rules.map((rule) => {
    const windowStart = nowMs - rule.windowMs;
    const matching = input.samples.filter((sample) => {
      if (sample.metric !== rule.metric) {
        return false;
      }
      const at = parseTimestamp(sample.occurredAt);
      return at >= windowStart && at <= nowMs;
    });
    const observedValue = matching.reduce((sum, sample) => sum + sample.value, 0);
    const triggered = compare(observedValue, rule.threshold, rule.comparator);

    return {
      ruleId: rule.id,
      kind: rule.kind,
      severity: rule.severity,
      runbookId: rule.runbookId,
      observedValue,
      threshold: rule.threshold,
      triggered,
      immediateNotification: rule.immediateNotification && triggered,
      windowMs: rule.windowMs,
    };
  });
}

export function triggeredAnomalies(
  evaluations: readonly AnomalyEvaluation[],
): readonly AnomalyEvaluation[] {
  return evaluations.filter((evaluation) => evaluation.triggered);
}

export function immediateNotificationAnomalies(
  evaluations: readonly AnomalyEvaluation[],
): readonly AnomalyEvaluation[] {
  return evaluations.filter((evaluation) => evaluation.immediateNotification);
}
