/**
 * Alert policy metadata contracts for BB-034 — severity, runbook, release, service,
 * and correlation identifiers required on every alert payload.
 */
import type { SecurityEventKind, SecurityEventSeverity } from './security-events.js';
import { DEFAULT_ANOMALY_RULES, type AnomalyRule } from './security-anomaly.js';

export const SECURITY_ALERT_POLICY_VERSION = '1.0.0' as const;

export type AlertNotificationChannel = 'pager' | 'security_alerts' | 'ops' | 'email';

export type SecurityAlertPolicy = {
  readonly id: string;
  readonly kind: SecurityEventKind;
  readonly severity: SecurityEventSeverity;
  readonly runbookId: string;
  readonly description: string;
  readonly notificationChannels: readonly AlertNotificationChannel[];
  readonly metric: string;
  readonly windowMs: number;
  readonly threshold: number;
  readonly comparator: AnomalyRule['comparator'];
  readonly immediateNotification: boolean;
  readonly enabled: boolean;
};

export type SecurityAlertPayload = {
  readonly alertId: string;
  readonly policyId: string;
  readonly severity: SecurityEventSeverity;
  readonly runbookId: string;
  readonly service: string;
  readonly releaseId?: string | undefined;
  readonly correlationId: string;
  readonly requestId?: string | undefined;
  readonly kind: SecurityEventKind;
  readonly observedValue: number;
  readonly threshold: number;
  readonly triggeredAt: string;
  readonly message: string;
};

export const DEFAULT_ALERT_POLICIES: readonly SecurityAlertPolicy[] = DEFAULT_ANOMALY_RULES.map(
  (rule) => ({
    id: rule.id,
    kind: rule.kind,
    severity: rule.severity,
    runbookId: rule.runbookId,
    description: rule.description,
    notificationChannels: rule.immediateNotification
      ? (['pager', 'security_alerts'] as const)
      : (['security_alerts'] as const),
    metric: rule.metric,
    windowMs: rule.windowMs,
    threshold: rule.threshold,
    comparator: rule.comparator,
    immediateNotification: rule.immediateNotification,
    enabled: true,
  }),
);

export function buildAlertPayload(input: {
  policy: SecurityAlertPolicy;
  service: string;
  correlationId: string;
  observedValue: number;
  triggeredAt: string;
  releaseId?: string | undefined;
  requestId?: string | undefined;
}): SecurityAlertPayload {
  return {
    alertId: `alert_${input.policy.id}_${Date.now().toString(36)}`,
    policyId: input.policy.id,
    severity: input.policy.severity,
    runbookId: input.policy.runbookId,
    service: input.service,
    correlationId: input.correlationId,
    kind: input.policy.kind,
    observedValue: input.observedValue,
    threshold: input.policy.threshold,
    triggeredAt: input.triggeredAt,
    message: `${input.policy.description} on ${input.service} (observed=${input.observedValue}, threshold=${input.policy.threshold})`,
    ...(input.releaseId === undefined ? {} : { releaseId: input.releaseId }),
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
  };
}

export function alertPolicyById(id: string): SecurityAlertPolicy | undefined {
  return DEFAULT_ALERT_POLICIES.find((policy) => policy.id === id);
}

export function policiesRequiringImmediateNotification(): readonly SecurityAlertPolicy[] {
  return DEFAULT_ALERT_POLICIES.filter((policy) => policy.immediateNotification);
}
