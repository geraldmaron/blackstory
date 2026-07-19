# Security telemetry and anomaly detection

Design-only contracts for security dashboards, metrics, anomaly rules, and alert policies.
Producers (App Check guards, rate limiters, audit writers, query guardrails) keep their existing
implementations and emit signals through `@repo/observability` adapters.

**Depends on:** [ audit/outbox](../../packages/domain/src/audit/index.ts),
[ Cloud Armor](../../infra/gcp/armor/metrics-alerts-checklist.md),
[ App Check](../../infra/firebase/auth-and-app-check.md),
[ rate limits](./rate-limits.md)

## Package surface

| Module | Role |
|--------|------|
| `security-events.ts` | Event vocabulary and correlation envelope |
| `security-redaction.ts` | Strips App Check tokens, credentials, and protected addresses |
| `security-metrics.ts` | Metric descriptors and Cloud Monitoring mapping |
| `security-anomaly.ts` | Declarative anomaly rules + synthetic evaluator |
| `security-alerts.ts` | Alert metadata (severity, runbook, release, service, correlation) |
| `security-adapters.ts` | Normalizes producer signals without rewriting producers |
| `security-telemetry.ts` | Recorder that redacts, emits metrics, and evaluates alerts |

Import from `@repo/observability`:

```typescript
import {
  createSecurityTelemetryRecorder,
  adaptAppCheckTelemetry,
  adaptAuditEvent,
} from '@repo/observability';
```

## Event coverage (PDF deliverables)

| Domain | Event kind | Primary metric |
|--------|------------|----------------|
| Cloud Armor denies | `armor.deny` | `armor_denies_total` |
| Cloud Armor throttles | `armor.throttle` | `armor_throttles_total` |
| App Check failures | `app_check.failure` | `app_check_failures_total` |
| Authentication failures | `authentication.failure` | `authentication_failures_total` |
| Administrator role changes | `administrator.role_changed` | `administrator_role_changes_total` |
| Submission spikes | `submission.spike` | `submission_requests_total` |
| Search abuse | `search.abuse` | `search_guardrail_denials_total` |
| Geocoder abuse | `geocoder.abuse` | `geocoder_guardrail_denials_total` |
| Database connections | `database.connection` | `database_connections_active` |
| Slow queries | `database.slow_query` | `database_slow_queries_total` |
| Queue depth / retries | `queue.depth`, `queue.retry` | `queue_depth`, `queue_retries_total` |
| Source adapter anomalies | `source_adapter.anomaly` | `source_adapter_anomalies_total` |
| Publication activity | `publication.activity` | `publication_events_total` |
| Retraction activity | `retraction.activity` | `retraction_events_total` |
| Unexpected public writes | `database.unexpected_public_write` | `database_unexpected_public_writes_total` |
| Storage denials | `storage.access_denied` | `storage_access_denials_total` |
| Error rates | `service.error_rate` | `service_errors_total` |
| Latency | `service.latency` | `service_latency_ms` |
| Cost anomalies | `cost.anomaly` | `cost_anomaly_score` |

## Redaction policy

Security telemetry **never** emits:

- Raw Firebase App Check tokens or `Authorization` headers
- Session cookies, JWTs, API keys, or credentials
- Residential street addresses or high-precision coordinates (via `@repo/security`)

Opaque identifiers (actor IDs, object paths) are fingerprinted before they become metric labels.

## Producer integration (type contracts)

| Producer | Adapter | Notes |
|----------|---------|-------|
| `@repo/firebase` App Check guard | `adaptAppCheckTelemetry` | Mirrors `AppCheckTelemetryEvent` shape |
|  audit events | `adaptAuditEvent` | Maps `authentication.failed`, `administrative.role_changed`, publication/retraction actions |
|  rate limit denials | `adaptRateLimitDenial` | Classifies search/geocoder/submission/auth abuse |
|  slow query events | `adaptSlowQuery` | Uses query hash — never raw query text |
| Cloud Armor LB logs | `adaptArmorSignal` | Policy + rule priority dimensions |
| Queue / outbox monitors | `adaptQueueSignal` | Depth and retry counters |
| Storage rules denials | `adaptStorageDenial` | Bucket + fingerprinted object path |
| Service middleware | `adaptServiceHealth` | Error rate and latency |
| Billing guardrails | `adaptCostAnomaly` | Normalized 0–100 score |

Wire a recorder once per service:

```typescript
const security = createSecurityTelemetryRecorder({
  service: 'api-public',
  releaseId: process.env.RELEASE_ID,
});

const event = adaptAppCheckTelemetry(appCheckEvent, {
  service: 'api-public',
  correlationId: requestId,
  requestId,
});
if (event) {
  security.record(event);
}
```

## Anomaly rules and alerts

Nineteen declarative rules (`SEC-ARMOR-01` … `SEC-COST-01`) live in
`packages/observability/src/security-anomaly.ts`. Each rule maps to an alert policy stub in
[`../../infra/gcp/observability/security-alerts/`](../../infra/gcp/observability/security-alerts/).

Every alert payload includes:

- **severity** — `info`, `warning`, or `critical`
- **runbookId** — relative runbook path (e.g. `runbook/admin-role-change`)
- **releaseId** — active release when known
- **service** — emitting surface (`api-public`, `admin`, …)
- **correlationId** — ties to request and audit trail

### Immediate notification (acceptance)

These events generate **pager + `#security-alerts`** notification when triggered:

- `administrator.role_changed` (`SEC-ADMIN-01`)
- `publication.activity` (`SEC-PUB-01`)
- `retraction.activity` (`SEC-RET-01`)
- `database.unexpected_public_write` (`SEC-DB-02`)

## Synthetic validation (pre-launch)

Run package tests before production traffic exists:

```bash
pnpm --filter @repo/observability test
```

Tests prove:

1. Metric samples feed the anomaly evaluator (`evaluateAnomalyRules`)
2. Synthetic bursts trigger expected rules (e.g. 120 Armor throttles → `SEC-ARMOR-01`)
3. Redaction removes tokens and protected addresses from emitted events
4. Alert payloads carry required correlation metadata

Infra stubs validate separately:

```bash
node infra/gcp/observability/security-alerts/security-alerts.test.mjs
```

## GCP stubs (design-only)

| Artifact | Purpose |
|----------|---------|
| [`security-alert-policies.json`](../../infra/gcp/observability/security-alerts/security-alert-policies.json) | Alert policy catalog |
| [`security-dashboard.json`](../../infra/gcp/observability/security-alerts/security-dashboard.json) | Dashboard panel definitions |
| [`README.md`](../../infra/gcp/observability/security-alerts/README.md) | Apply checklist (no live apply in ) |

Cross-reference  Armor metrics: [`../../infra/gcp/armor/metrics-alerts-checklist.md`](../../infra/gcp/armor/metrics-alerts-checklist.md).

## Acceptance mapping

| Acceptance criterion | Implementation |
|---------------------|----------------|
| Alerts include severity, runbook, release, service, correlation identifiers | `buildAlertPayload`, infra JSON stubs |
| Logs exclude secrets and protected addresses | `redactSecurityEvent`, `@repo/security` redactor |
| Metrics useful before launch via synthetic tests | `evaluateAnomalyRules` + `security.test.ts` |
| High-severity publication and administrator events → immediate notification | `IMMEDIATE_NOTIFICATION_KINDS`, `SEC-ADMIN-01`, `SEC-PUB-01`, `SEC-RET-01` |
