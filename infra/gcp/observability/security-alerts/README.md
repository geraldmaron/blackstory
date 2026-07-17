# Security telemetry alert and dashboard stubs (BB-034)

Design-only Cloud Monitoring artifacts for Black Book security telemetry. **Do not apply**
during BB-034 — human provisioning follows staging baseline and BB-059 load tests.

| Artifact | Role |
|----------|------|
| [`security-alert-policies.json`](./security-alert-policies.json) | Alert policy catalog with runbook and notification metadata |
| [`security-alert-policies.schema.json`](./security-alert-policies.schema.json) | JSON Schema validator |
| [`security-dashboard.json`](./security-dashboard.json) | Dashboard panel definitions |
| [`security-dashboard.schema.json`](./security-dashboard.schema.json) | JSON Schema validator |
| [`security-alerts.test.mjs`](./security-alerts.test.mjs) | Local invariant tests |

TypeScript source of truth for rules and metrics:
`packages/observability/src/security-{anomaly,alerts,metrics}.ts`.

Cross-links:

- [BB-023 Armor metrics checklist](../../armor/metrics-alerts-checklist.md)
- [BB-034 narrative](../../../docs/security/telemetry-anomaly.md)

## Validate locally

```bash
node infra/gcp/observability/security-alerts/security-alerts.test.mjs
```

## Apply checklist (human, post-BB-034)

1. Import alert policies from `security-alert-policies.json` into project `black-book-efaaf`.
2. Create dashboard from `security-dashboard.json` panels.
3. Wire notification channels: `#security-alerts`, pager duty rotation.
4. Confirm immediate-notification policies (`SEC-ADMIN-01`, `SEC-PUB-01`, `SEC-RET-01`, `SEC-DB-02`) route to pager.
5. Run synthetic metric injection from `@black-book/observability` tests in staging.

## Sign-off

- [ ] All `SEC-*` alert policies created (design JSON → Monitoring)
- [ ] Dashboard linked from ops runbook
- [ ] Publication and administrator alerts verified with synthetic audit events
- [ ] Redaction spot-check: no App Check tokens in log-based metrics
