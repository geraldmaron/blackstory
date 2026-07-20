/**
 * Security metric descriptors and Cloud Monitoring mapping contracts.
 * Metrics are designed for synthetic validation before production traffic exists.
 */
import type { SecurityEventKind } from './security-events.js';

export const SECURITY_METRICS_NAMESPACE = 'black_book/security' as const;

export type SecurityMetricType = 'counter' | 'gauge' | 'distribution';

export type SecurityMetricDescriptor = {
  readonly name: string;
  readonly type: SecurityMetricType;
  readonly description: string;
  readonly unit?: string | undefined;
  readonly labelKeys: readonly string[];
  readonly gcpMetricType?: string | undefined;
};

/** Metric catalog keyed by logical name. */
export const SECURITY_METRIC_DESCRIPTORS: Readonly<Record<string, SecurityMetricDescriptor>> = {
  armor_denies_total: {
    name: 'armor_denies_total',
    type: 'counter',
    description: 'Cloud Armor WAF and manual deny events',
    labelKeys: ['service', 'policy', 'rule_priority'],
    gcpMetricType: 'networksecurity.googleapis.com/https/requests_dropped',
  },
  armor_throttles_total: {
    name: 'armor_throttles_total',
    type: 'counter',
    description: 'Cloud Armor rate-limit and throttle events',
    labelKeys: ['service', 'policy'],
    gcpMetricType: 'networksecurity.googleapis.com/https/requests_throttled',
  },
  app_check_failures_total: {
    name: 'app_check_failures_total',
    type: 'counter',
    description: 'App Check verification failures (monitor or enforce)',
    labelKeys: ['service', 'mode', 'reason'],
  },
  authentication_failures_total: {
    name: 'authentication_failures_total',
    type: 'counter',
    description: 'Failed sign-in and token validation attempts',
    labelKeys: ['service', 'provider'],
  },
  administrator_role_changes_total: {
    name: 'administrator_role_changes_total',
    type: 'counter',
    description: 'Administrator role grant or revoke events',
    labelKeys: ['service', 'actor_type'],
  },
  submission_requests_total: {
    name: 'submission_requests_total',
    type: 'counter',
    description: 'Correction and submission intake volume',
    labelKeys: ['service', 'endpoint_class'],
  },
  search_guardrail_denials_total: {
    name: 'search_guardrail_denials_total',
    type: 'counter',
    description: 'Search query guardrail denials',
    labelKeys: ['service', 'reason'],
  },
  geocoder_guardrail_denials_total: {
    name: 'geocoder_guardrail_denials_total',
    type: 'counter',
    description: 'Geocoder abuse guardrail denials',
    labelKeys: ['service', 'reason'],
  },
  database_connections_active: {
    name: 'database_connections_active',
    type: 'gauge',
    description: 'Active database connections by role',
    labelKeys: ['service', 'role'],
  },
  database_slow_queries_total: {
    name: 'database_slow_queries_total',
    type: 'counter',
    description: 'Queries exceeding configured duration threshold',
    labelKeys: ['service', 'endpoint_class'],
  },
  database_unexpected_public_writes_total: {
    name: 'database_unexpected_public_writes_total',
    type: 'counter',
    description: 'Writes to public schema outside publication pipeline',
    labelKeys: ['service', 'table'],
  },
  queue_depth: {
    name: 'queue_depth',
    type: 'gauge',
    description: 'Pending queue messages by topic',
    labelKeys: ['service', 'topic'],
  },
  queue_retries_total: {
    name: 'queue_retries_total',
    type: 'counter',
    description: 'Queue message retry attempts',
    labelKeys: ['service', 'topic'],
  },
  source_adapter_anomalies_total: {
    name: 'source_adapter_anomalies_total',
    type: 'counter',
    description: 'Source adapter fetch or parse anomalies',
    labelKeys: ['service', 'adapter_id'],
  },
  publication_events_total: {
    name: 'publication_events_total',
    type: 'counter',
    description: 'Publication and release lifecycle events',
    labelKeys: ['service', 'action'],
  },
  retraction_events_total: {
    name: 'retraction_events_total',
    type: 'counter',
    description: 'Retraction and reversal events',
    labelKeys: ['service', 'action'],
  },
  storage_access_denials_total: {
    name: 'storage_access_denials_total',
    type: 'counter',
    description: 'Firebase Storage rule denials',
    labelKeys: ['service', 'bucket'],
  },
  service_errors_total: {
    name: 'service_errors_total',
    type: 'counter',
    description: 'HTTP 5xx and unhandled application errors',
    labelKeys: ['service', 'route'],
  },
  service_latency_ms: {
    name: 'service_latency_ms',
    type: 'distribution',
    description: 'Request latency in milliseconds',
    unit: 'ms',
    labelKeys: ['service', 'route'],
    gcpMetricType: 'loadbalancing.googleapis.com/https/backend_latencies',
  },
  cost_anomaly_score: {
    name: 'cost_anomaly_score',
    type: 'gauge',
    description: 'Normalized cost anomaly score (0–100)',
    labelKeys: ['service', 'sku'],
  },
};

/** Maps security event kinds to one or more metric names for emission. */
export const EVENT_KIND_TO_METRICS: Readonly<
  Partial<Record<SecurityEventKind, readonly string[]>>
> = {
  'armor.deny': ['armor_denies_total'],
  'armor.throttle': ['armor_throttles_total'],
  'app_check.failure': ['app_check_failures_total'],
  'authentication.failure': ['authentication_failures_total'],
  'administrator.role_changed': ['administrator_role_changes_total'],
  'submission.spike': ['submission_requests_total'],
  'search.abuse': ['search_guardrail_denials_total'],
  'geocoder.abuse': ['geocoder_guardrail_denials_total'],
  'database.connection': ['database_connections_active'],
  'database.slow_query': ['database_slow_queries_total'],
  'database.unexpected_public_write': ['database_unexpected_public_writes_total'],
  'queue.depth': ['queue_depth'],
  'queue.retry': ['queue_retries_total'],
  'source_adapter.anomaly': ['source_adapter_anomalies_total'],
  'publication.activity': ['publication_events_total'],
  'retraction.activity': ['retraction_events_total'],
  'storage.access_denied': ['storage_access_denials_total'],
  'service.error_rate': ['service_errors_total'],
  'service.latency': ['service_latency_ms'],
  'cost.anomaly': ['cost_anomaly_score'],
};

export type SecurityMetricSample = {
  readonly metric: string;
  readonly value: number;
  readonly occurredAt: string;
  readonly labels: Readonly<Record<string, string>>;
};

export function buildMetricSample(input: {
  kind: SecurityEventKind;
  value: number;
  occurredAt: string;
  service: string;
  dimensions?: Readonly<Record<string, string | number | boolean | undefined>>;
}): readonly SecurityMetricSample[] {
  const metricNames = EVENT_KIND_TO_METRICS[input.kind] ?? [];
  const labels: Record<string, string> = { service: input.service };
  for (const [key, value] of Object.entries(input.dimensions ?? {})) {
    if (value !== undefined) {
      labels[key] = String(value);
    }
  }
  return metricNames.map((metric) => ({
    metric,
    value: input.value,
    occurredAt: input.occurredAt,
    labels,
  }));
}

export function metricDescriptor(name: string): SecurityMetricDescriptor {
  const descriptor = SECURITY_METRIC_DESCRIPTORS[name];
  if (descriptor === undefined) {
    throw new Error(`Unknown security metric: ${name}`);
  }
  return descriptor;
}

export function fullyQualifiedMetricName(name: string): string {
  return `${SECURITY_METRICS_NAMESPACE}/${name}`;
}
