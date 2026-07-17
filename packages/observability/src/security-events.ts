
/**
 * Security telemetry event vocabulary and typed envelopes.
 * Producers emit domain-specific signals; adapters normalize them into this contract
 * before metrics, logs, and anomaly evaluation.
 */
export const SECURITY_TELEMETRY_VERSION = '1.0.0' as const;

/** Canonical security signal kinds aligned with dashboard and alert coverage. */
export const securityEventKinds = [
  'armor.deny',
  'armor.throttle',
  'app_check.failure',
  'authentication.failure',
  'administrator.role_changed',
  'submission.spike',
  'search.abuse',
  'geocoder.abuse',
  'database.connection',
  'database.slow_query',
  'database.unexpected_public_write',
  'queue.depth',
  'queue.retry',
  'source_adapter.anomaly',
  'publication.activity',
  'retraction.activity',
  'storage.access_denied',
  'service.error_rate',
  'service.latency',
  'cost.anomaly',
] as const;

export type SecurityEventKind = (typeof securityEventKinds)[number];

export const securityEventSeverities = ['info', 'warning', 'critical'] as const;
export type SecurityEventSeverity = (typeof securityEventSeverities)[number];

/** Required correlation envelope for every security telemetry record. */
export type SecurityEventContext = {
  readonly service: string;
  readonly correlationId: string;
  readonly requestId?: string | undefined;
  readonly releaseId?: string | undefined;
  readonly runbookId?: string | undefined;
};

/** Low-cardinality dimensions safe for metric labels (never raw tokens or PII). */
export type SecurityEventDimensions = Readonly<
  Record<string, string | number | boolean | undefined>
>;

export type SecurityTelemetryEvent = {
  readonly id: string;
  readonly version: typeof SECURITY_TELEMETRY_VERSION;
  readonly kind: SecurityEventKind;
  readonly severity: SecurityEventSeverity;
  readonly occurredAt: string;
  readonly context: SecurityEventContext;
  readonly dimensions: SecurityEventDimensions;
  /** Optional detail payload always passed through the security redactor before emit. */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
};

/** Maps audit and security actions to telemetry kinds for integration. */
export const AUDIT_ACTION_TO_SECURITY_KIND: Readonly<
  Partial<Record<string, SecurityEventKind>>
> = {
  'authentication.failed': 'authentication.failure',
  'administrative.role_changed': 'administrator.role_changed',
  'publication.published': 'publication.activity',
  'publication.release_activated': 'publication.activity',
  'publication.release_retired': 'publication.activity',
  'retraction.retracted': 'retraction.activity',
  'retraction.reversed': 'retraction.activity',
};

/** Events that require immediate notification per acceptance. */
export const IMMEDIATE_NOTIFICATION_KINDS = new Set<SecurityEventKind>([
  'administrator.role_changed',
  'publication.activity',
  'retraction.activity',
]);

export function defaultSeverityForKind(kind: SecurityEventKind): SecurityEventSeverity {
  if (IMMEDIATE_NOTIFICATION_KINDS.has(kind)) {
    return 'critical';
  }
  switch (kind) {
    case 'armor.deny':
    case 'armor.throttle':
    case 'search.abuse':
    case 'geocoder.abuse':
    case 'database.unexpected_public_write':
    case 'storage.access_denied':
    case 'cost.anomaly':
      return 'warning';
    case 'service.error_rate':
    case 'source_adapter.anomaly':
      return 'critical';
    default:
      return 'info';
  }
}

export function defaultRunbookForKind(kind: SecurityEventKind): string {
  const runbooks: Record<SecurityEventKind, string> = {
    'armor.deny': 'runbook/armor-deny-spike',
    'armor.throttle': 'runbook/armor-throttle-spike',
    'app_check.failure': 'runbook/app-check-failures',
    'authentication.failure': 'runbook/auth-failure-spike',
    'administrator.role_changed': 'runbook/admin-role-change',
    'submission.spike': 'runbook/submission-spike',
    'search.abuse': 'runbook/search-abuse',
    'geocoder.abuse': 'runbook/geocoder-abuse',
    'database.connection': 'runbook/database-connections',
    'database.slow_query': 'runbook/slow-query',
    'database.unexpected_public_write': 'runbook/unexpected-public-write',
    'queue.depth': 'runbook/queue-depth',
    'queue.retry': 'runbook/queue-retries',
    'source_adapter.anomaly': 'runbook/source-adapter-anomaly',
    'publication.activity': 'runbook/publication-change',
    'retraction.activity': 'runbook/retraction-change',
    'storage.access_denied': 'runbook/storage-denial',
    'service.error_rate': 'runbook/error-rate-spike',
    'service.latency': 'runbook/latency-spike',
    'cost.anomaly': 'runbook/cost-anomaly',
  };
  return runbooks[kind];
}

export function createSecurityEventId(prefix = 'sec'): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}
