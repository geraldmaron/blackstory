
/**
 * security telemetry event vocabulary, redaction, metrics, anomaly rules, and adapters.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adaptAppCheckTelemetry,
  adaptAuditEvent,
  adaptArmorSignal,
  adaptCostAnomaly,
  adaptRateLimitDenial,
  adaptSlowQuery,
  buildAlertPayload,
  buildMetricSample,
  createSecurityTelemetryRecorder,
  DEFAULT_ALERT_POLICIES,
  evaluateAnomalyRules,
  immediateNotificationAnomalies,
  policiesRequiringImmediateNotification,
  redactSecurityEvent,
  redactSecurityMetadata,
  securityEventKinds,
  triggeredAnomalies,
} from './index.ts';

const context = {
  service: 'api-public',
  correlationId: 'corr_test_1',
  requestId: 'req_test_1',
  releaseId: 'rel_2026_07_17',
};

test('security event vocabulary covers all BB-034 deliverable domains', () => {
  const required = [
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
    'queue.depth',
    'queue.retry',
    'source_adapter.anomaly',
    'publication.activity',
    'retraction.activity',
    'database.unexpected_public_write',
    'storage.access_denied',
    'service.error_rate',
    'service.latency',
    'cost.anomaly',
  ];
  for (const kind of required) {
    assert.ok(securityEventKinds.includes(kind as (typeof securityEventKinds)[number]));
  }
});

test('redaction strips App Check tokens and protected address fields', () => {
  const redacted = redactSecurityMetadata({
    appCheckToken: 'secret-token-value',
    authorization: 'Bearer abc.def.ghi',
    streetAddress: '742 Evergreen Terrace',
    lat: 38.90721,
    note: 'lookup near 1600 Pennsylvania Ave',
  }) as Record<string, unknown>;

  assert.equal(redacted.appCheckToken, undefined);
  assert.equal(redacted.authorization, undefined);
  assert.equal(redacted.streetAddress, undefined);
  assert.equal(redacted.lat, undefined);
  assert.match(String(redacted.note), /\[REDACTED\]/);
});

test('adaptAppCheckTelemetry ignores verified outcomes and redacts failures', () => {
  assert.equal(
    adaptAppCheckTelemetry(
      {
        event: 'app_check_verification',
        mode: 'enforce',
        outcome: 'verified',
        replayProtection: false,
      },
      context,
    ),
    undefined,
  );

  const event = adaptAppCheckTelemetry(
    {
      event: 'app_check_verification',
      mode: 'enforce',
      outcome: 'rejected',
      reason: 'invalid_token',
      replayProtection: true,
    },
    context,
  );
  assert.ok(event);
  const safe = redactSecurityEvent({
    ...event!,
    metadata: { appCheckToken: 'must-not-leak', replayProtection: true },
  });
  assert.equal(safe.metadata?.appCheckToken, undefined);
});

test('adaptAuditEvent maps publication and administrator events with immediate severity', () => {
  const roleChange = adaptAuditEvent(
    {
      id: 'audit_1',
      action: 'administrative.role_changed',
      category: 'administrative',
      actor: { id: 'admin_abc123456789', type: 'user' },
      subject: { type: 'role', id: 'role_editor', path: 'roles/editor' },
      reason: 'onboarding',
      requestId: 'req_1',
      correlationId: 'corr_1',
      idempotencyKey: 'idem_1',
      occurredAt: '2026-07-17T00:00:00.000Z',
    },
    'admin',
  );
  assert.equal(roleChange?.kind, 'administrator.role_changed');
  assert.equal(roleChange?.severity, 'critical');
  assert.match(String(roleChange?.dimensions.actorId), /^fp_/);

  const publication = adaptAuditEvent(
    {
      id: 'audit_2',
      action: 'publication.release_activated',
      category: 'publication',
      actor: { id: 'svc_pub', type: 'service' },
      subject: { type: 'release', id: 'rel_1', path: 'releases/rel_1' },
      reason: 'scheduled activation',
      requestId: 'req_2',
      correlationId: 'corr_2',
      releaseId: 'rel_1',
      idempotencyKey: 'idem_2',
      occurredAt: '2026-07-17T01:00:00.000Z',
    },
    'publication',
  );
  assert.equal(publication?.kind, 'publication.activity');
  assert.equal(publication?.severity, 'critical');
});

test('adapters map rate limits and slow queries to abuse telemetry kinds', () => {
  const searchDenial = adaptRateLimitDenial(
    {
      endpointClass: 'search',
      subject: 'anonymous',
      reason: 'token_bucket_exhausted',
      policyVersion: '1.0.0',
    },
    context,
  );
  assert.equal(searchDenial?.kind, 'search.abuse');

  const slowQuery = adaptSlowQuery(
    {
      event: 'slow_query',
      endpointClass: 'search',
      queryHash: 'qh_abc',
      durationMs: 4_500,
      timedOut: false,
      estimatedCost: 900,
    },
    context,
  );
  assert.equal(slowQuery.kind, 'database.slow_query');
});

test('buildMetricSample produces samples usable in synthetic anomaly tests', () => {
  const samples = buildMetricSample({
    kind: 'armor.throttle',
    value: 1,
    occurredAt: '2026-07-17T00:00:00.000Z',
    service: 'api-public',
    dimensions: { policy: 'black-book-api-public-armor' },
  });
  assert.deepEqual(samples, [
    {
      metric: 'armor_throttles_total',
      value: 1,
      occurredAt: '2026-07-17T00:00:00.000Z',
      labels: { service: 'api-public', policy: 'black-book-api-public-armor' },
    },
  ]);
});

test('evaluateAnomalyRules triggers on synthetic metric bursts', () => {
  const nowMs = Date.parse('2026-07-17T00:10:00.000Z');
  const samples = Array.from({ length: 120 }, (_, index) => ({
    metric: 'armor_throttles_total',
    value: 1,
    occurredAt: new Date(nowMs - index * 1_000).toISOString(),
    labels: { service: 'api-public', policy: 'black-book-api-public-armor' },
  }));

  const evaluations = evaluateAnomalyRules({ samples, nowMs });
  const armor = evaluations.find((entry) => entry.ruleId === 'SEC-ARMOR-01');
  assert.ok(armor?.triggered);
  assert.equal(armor?.observedValue, 120);
});

test('alert payloads include severity, runbook, release, service, and correlation identifiers', () => {
  const policy = DEFAULT_ALERT_POLICIES.find((entry) => entry.id === 'SEC-PUB-01');
  assert.ok(policy);
  const alert = buildAlertPayload({
    policy: policy!,
    service: 'publication',
    correlationId: 'corr_pub_1',
    releaseId: 'rel_live',
    requestId: 'req_pub_1',
    observedValue: 1,
    triggeredAt: '2026-07-17T02:00:00.000Z',
  });
  assert.equal(alert.severity, 'critical');
  assert.equal(alert.runbookId, 'runbook/publication-change');
  assert.equal(alert.service, 'publication');
  assert.equal(alert.releaseId, 'rel_live');
  assert.equal(alert.correlationId, 'corr_pub_1');
  assert.equal(alert.requestId, 'req_pub_1');
});

test('recorder emits metrics, evaluates anomalies, and fires immediate alerts', () => {
  const events: unknown[] = [];
  const metrics: unknown[] = [];
  const alerts: unknown[] = [];
  const recorder = createSecurityTelemetryRecorder({
    service: 'admin',
    releaseId: 'rel_test',
    clock: () => new Date('2026-07-17T03:00:00.000Z'),
    sink: {
      recordEvent: (event) => events.push(event),
      recordMetric: (sample) => metrics.push(sample),
      recordAlert: (alert) => alerts.push(alert),
    },
  });

  const roleEvent = adaptAuditEvent(
    {
      id: 'audit_admin',
      action: 'administrative.role_changed',
      category: 'administrative',
      actor: { id: 'admin_1', type: 'user' },
      subject: { type: 'role', id: 'role_admin', path: 'roles/admin' },
      reason: 'elevation',
      requestId: 'req_admin',
      correlationId: 'corr_admin',
      idempotencyKey: 'idem_admin',
      occurredAt: '2026-07-17T03:00:00.000Z',
    },
    'admin',
  );
  assert.ok(roleEvent);
  const result = recorder.record(roleEvent!);

  assert.equal(events.length, 1);
  assert.ok(metrics.length >= 1);
  assert.ok(result.alerts.length >= 1);
  const immediate = immediateNotificationAnomalies(result.evaluations);
  assert.ok(immediate.some((entry) => entry.ruleId === 'SEC-ADMIN-01'));
});

test('policies requiring immediate notification cover publication and administrator events', () => {
  const ids = new Set(policiesRequiringImmediateNotification().map((policy) => policy.id));
  assert.ok(ids.has('SEC-ADMIN-01'));
  assert.ok(ids.has('SEC-PUB-01'));
  assert.ok(ids.has('SEC-RET-01'));
});

test('armor and cost adapters produce expected telemetry kinds', () => {
  const armor = adaptArmorSignal(
    {
      action: 'deny',
      policy: 'black-book-api-public-armor',
      rulePriority: 1000,
      backendService: 'black-book-api-public-backend',
    },
    context,
  );
  assert.equal(armor.kind, 'armor.deny');

  const cost = adaptCostAnomaly({ sku: 'cloud-run', score: 82 }, context);
  assert.equal(cost.kind, 'cost.anomaly');
  assert.equal(cost.severity, 'critical');
});

test('triggeredAnomalies filters evaluation results', () => {
  const evaluations = evaluateAnomalyRules({
    samples: [],
    nowMs: Date.now(),
  });
  assert.equal(triggeredAnomalies(evaluations).length, 0);
});
