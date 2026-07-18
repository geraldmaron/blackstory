
/**
 * Adapters that normalize producer signals into security telemetry events.
 * Structural contracts mirror existing producers no rewrites required.
 */
import type { DomainAuditEvent } from '@blap/domain';
import {
  AUDIT_ACTION_TO_SECURITY_KIND,
  createSecurityEventId,
  defaultRunbookForKind,
  defaultSeverityForKind,
  IMMEDIATE_NOTIFICATION_KINDS,
  SECURITY_TELEMETRY_VERSION,
  type SecurityEventContext,
  type SecurityEventKind,
  type SecurityTelemetryEvent,
} from './security-events.js';
import { fingerprintDimension } from './security-redaction.js';

/** Mirrors @blap/firebase AppCheckTelemetryEvent without a runtime dependency. */
export type AppCheckTelemetryInput = {
  readonly event: 'app_check_verification';
  readonly mode: 'monitor' | 'enforce';
  readonly outcome: 'verified' | 'monitored_failure' | 'rejected' | 'trusted_service';
  readonly reason?: string | undefined;
  readonly replayProtection: boolean;
};

export type RateLimitDenialInput = {
  readonly endpointClass: string;
  readonly subject: string;
  readonly reason: string;
  readonly policyVersion: string;
};

export type SlowQueryInput = {
  readonly event: 'slow_query';
  readonly endpointClass: string;
  readonly queryHash: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
  readonly estimatedCost: number;
};

export type QueueSignalInput = {
  readonly topic: string;
  readonly depth?: number | undefined;
  readonly retryCount?: number | undefined;
};

export type ArmorSignalInput = {
  readonly action: 'deny' | 'throttle';
  readonly policy: string;
  readonly rulePriority?: number | undefined;
  readonly backendService: string;
};

export type StorageDenialInput = {
  readonly bucket: string;
  readonly objectPath?: string | undefined;
  readonly rule?: string | undefined;
};

export type ServiceHealthInput = {
  readonly route: string;
  readonly statusCode?: number | undefined;
  readonly latencyMs?: number | undefined;
  readonly errorCount?: number | undefined;
};

export type CostAnomalyInput = {
  readonly sku: string;
  readonly score: number;
  readonly currency?: string | undefined;
};

function baseEvent(
  kind: SecurityEventKind,
  context: SecurityEventContext,
  dimensions: SecurityTelemetryEvent['dimensions'],
  metadata?: Readonly<Record<string, unknown>>,
  severityOverride?: SecurityTelemetryEvent['severity'],
  occurredAt?: string,
): SecurityTelemetryEvent {
  const severity = severityOverride ?? defaultSeverityForKind(kind);
  return {
    id: createSecurityEventId(),
    version: SECURITY_TELEMETRY_VERSION,
    kind,
    severity,
    occurredAt: occurredAt ?? new Date().toISOString(),
    context: {
      ...context,
      runbookId: context.runbookId ?? defaultRunbookForKind(kind),
    },
    dimensions,
    ...(metadata === undefined ? {} : { metadata }),
  };
}

export function adaptAppCheckTelemetry(
  input: AppCheckTelemetryInput,
  context: SecurityEventContext,
): SecurityTelemetryEvent | undefined {
  if (input.outcome === 'verified' || input.outcome === 'trusted_service') {
    return undefined;
  }
  return baseEvent(
    'app_check.failure',
    context,
    {
      mode: input.mode,
      outcome: input.outcome,
      reason: input.reason ?? 'unknown',
      replayProtection: input.replayProtection,
    },
    { replayProtection: input.replayProtection },
  );
}

export function adaptAuditEvent(
  audit: DomainAuditEvent,
  service: string,
): SecurityTelemetryEvent | undefined {
  const kind = AUDIT_ACTION_TO_SECURITY_KIND[audit.action];
  if (kind === undefined) {
    return undefined;
  }
  const context: SecurityEventContext = {
    service,
    correlationId: audit.correlationId,
    requestId: audit.requestId,
    ...(audit.releaseId === undefined ? {} : { releaseId: audit.releaseId }),
    runbookId: defaultRunbookForKind(kind),
  };
  const severity = IMMEDIATE_NOTIFICATION_KINDS.has(kind) ? 'critical' : defaultSeverityForKind(kind);
  return baseEvent(
    kind,
    context,
    {
      action: audit.action,
      actorType: audit.actor.type,
      actorId: fingerprintDimension(audit.actor.id),
      subjectType: audit.subject.type,
      subjectId: fingerprintDimension(audit.subject.id),
    },
    { reason: audit.reason },
    severity,
    audit.occurredAt,
  );
}

export function adaptRateLimitDenial(
  input: RateLimitDenialInput,
  context: SecurityEventContext,
): SecurityTelemetryEvent | undefined {
  const endpoint = input.endpointClass.toLowerCase();
  let kind: SecurityEventKind | undefined;
  if (endpoint.includes('search')) {
    kind = 'search.abuse';
  } else if (endpoint.includes('geocod') || endpoint.includes('nearby')) {
    kind = 'geocoder.abuse';
  } else if (endpoint.includes('correction') || endpoint.includes('submission')) {
    kind = 'submission.spike';
  } else if (endpoint.includes('auth')) {
    kind = 'authentication.failure';
  }
  if (kind === undefined) {
    return undefined;
  }
  return baseEvent(
    kind,
    context,
    {
      endpointClass: input.endpointClass,
      subject: input.subject,
      reason: input.reason,
      policyVersion: input.policyVersion,
    },
  );
}

export function adaptSlowQuery(
  input: SlowQueryInput,
  context: SecurityEventContext,
): SecurityTelemetryEvent {
  return baseEvent(
    'database.slow_query',
    context,
    {
      endpointClass: input.endpointClass,
      queryHash: input.queryHash,
      durationMs: input.durationMs,
      timedOut: input.timedOut,
      estimatedCost: input.estimatedCost,
    },
  );
}

export function adaptQueueSignal(
  input: QueueSignalInput,
  context: SecurityEventContext,
): SecurityTelemetryEvent | undefined {
  if (input.depth !== undefined && input.depth > 0) {
    return baseEvent(
      'queue.depth',
      context,
      { topic: input.topic, depth: input.depth },
    );
  }
  if (input.retryCount !== undefined && input.retryCount > 0) {
    return baseEvent(
      'queue.retry',
      context,
      { topic: input.topic, retryCount: input.retryCount },
    );
  }
  return undefined;
}

export function adaptArmorSignal(
  input: ArmorSignalInput,
  context: SecurityEventContext,
): SecurityTelemetryEvent {
  const kind = input.action === 'deny' ? 'armor.deny' : 'armor.throttle';
  return baseEvent(
    kind,
    context,
    {
      policy: input.policy,
      backendService: input.backendService,
      ...(input.rulePriority === undefined ? {} : { rulePriority: input.rulePriority }),
    },
  );
}

export function adaptStorageDenial(
  input: StorageDenialInput,
  context: SecurityEventContext,
): SecurityTelemetryEvent {
  return baseEvent(
    'storage.access_denied',
    context,
    {
      bucket: input.bucket,
      ...(input.rule === undefined ? {} : { rule: input.rule }),
    },
    input.objectPath === undefined
      ? undefined
      : { objectPath: fingerprintDimension(input.objectPath) },
  );
}

export function adaptServiceHealth(
  input: ServiceHealthInput,
  context: SecurityEventContext,
): SecurityTelemetryEvent | undefined {
  if (input.errorCount !== undefined && input.errorCount > 0) {
    return baseEvent(
      'service.error_rate',
      context,
      {
        route: input.route,
        errorCount: input.errorCount,
        ...(input.statusCode === undefined ? {} : { statusCode: input.statusCode }),
      },
    );
  }
  if (input.latencyMs !== undefined) {
    return baseEvent(
      'service.latency',
      context,
      {
        route: input.route,
        latencyMs: input.latencyMs,
      },
    );
  }
  return undefined;
}

export function adaptCostAnomaly(
  input: CostAnomalyInput,
  context: SecurityEventContext,
): SecurityTelemetryEvent {
  const severity = input.score >= 75 ? 'critical' : input.score >= 50 ? 'warning' : 'info';
  return baseEvent(
    'cost.anomaly',
    context,
    {
      sku: input.sku,
      score: input.score,
      ...(input.currency === undefined ? {} : { currency: input.currency }),
    },
    undefined,
    severity,
  );
}

export function adaptSourceAdapterAnomaly(
  adapterId: string,
  reason: string,
  context: SecurityEventContext,
): SecurityTelemetryEvent {
  return baseEvent(
    'source_adapter.anomaly',
    context,
    { adapterId, reason },
  );
}

export function adaptUnexpectedPublicWrite(
  table: string,
  role: string,
  context: SecurityEventContext,
): SecurityTelemetryEvent {
  return baseEvent(
    'database.unexpected_public_write',
    context,
    { table, role },
    undefined,
    'critical',
  );
}

export function adaptDatabaseConnections(
  role: string,
  activeConnections: number,
  context: SecurityEventContext,
): SecurityTelemetryEvent {
  return baseEvent(
    'database.connection',
    context,
    { role, activeConnections },
  );
}
