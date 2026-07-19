# Cost and resource exhaustion controls

**Status:** Policy matrix + evaluators in-repo; GCP billing budgets and live queue/job provisioning are follow-on work (, ).
**Depends on:** [ App Hosting hardening](../apps/web/apphosting.yaml), [ ingress / Cloud Armor](./ingress-armor.md), [ rate limits](./rate-limits.md)
**Threats:** [T-01](./threat-model.md#t-01-volumetric-and-application-layer-denial-of-service), [T-13](./threat-model.md#t-13-database-exhaustion-and-connection-starvation), [T-14](./threat-model.md#t-14-cloud-bill-exhaustion)

## Objective

Ensure a traffic spike, retry storm, or budget burn cannot scale every service without bound. Optional research workloads stop before public historical serving. All evaluators **fail closed** when limits are exceeded or policy is unknown.

## Control layers

| Layer | Scope | Implementation |
|-------|-------|----------------|
| App Hosting / Cloud Run scaling | Per-service maxInstances, concurrency |  `apphosting*.yaml` + `DEFAULT_SERVICE_SCALING_LIMITS` |
| Cloud Tasks | Rate, concurrency, depth, retries | `DEFAULT_CLOUD_TASKS_POLICIES` |
| Cloud Run Jobs | CPU, memory, duration, retries | `DEFAULT_CLOUD_RUN_JOB_POLICIES` |
| Database | Connections, statement/lock timeouts | `DEFAULT_DATABASE_LIMITS` |
| Daily budgets | Geocoder, model, OCR, source fetch, research | `DEFAULT_DAILY_BUDGETS` |
| Billing alerts | Threshold → automated response | `DEFAULT_BILLING_ALERTS` |
| Soft shutdown | Tier ordering under pressure | `DEFAULT_SOFT_SHUTDOWN_POLICY` |
| Circuit breaker | Fail closed on repeated failures | `evaluateCircuitBreaker` |

## Workload tiers

| Tier | Examples | Shutdown priority |
|------|----------|-------------------|
| `public_serving` | web, api-public | **Preserved** — never auto-disabled |
| `essential_ops` | submissions, internal, publication jobs | Second |
| `optional_research` | research campaigns, URL fetch | **First** |

`autoDisablePublicCorpus` is hard-coded `false`. Full read-only mode requires an explicit operator choice.

## Package layout

| Path | Role |
|------|------|
| [`packages/security/src/resource-controls.ts`](../../packages/security/src/resource-controls.ts) | Policy matrices, evaluators, abusive-traffic simulation |
| [`packages/security/src/resource-controls.test.ts`](../../packages/security/src/resource-controls.test.ts) | Unit tests |
| [`infra/gcp/cost-controls/`](../../infra/gcp/cost-controls/) | Declarative GCP stubs + hard-stop runbook |

## References to other beads (not rewritten)

- **:** Web `maxInstances=6`, `concurrency=40` — validated via `BB022_APP_HOSTING_LIMITS` mirror
- **:** Endpoint quotas — referenced via `BB025_POLICY_REF`; rate-limit math unchanged

## Retry policy

All queues and jobs use capped exponential backoff:

```
delay = min(initialBackoffMs × multiplier^(attempt-1), maxBackoffMs)
```

`isRetryBudgetExhausted` fails closed when `attempt >= maxAttempts`.

## Budget automated responses

| Response | Effect |
|----------|--------|
| `alert_only` | Notify only |
| `throttle_optional` | Reduce optional workload dispatch rate |
| `pause_research` | Pause research queues and jobs |
| `disable_geocoder` | Reject new geocode requests |
| `disable_model` | Block LLM calls (future ) |
| `disable_source_fetch` | Pause URL/source fetch workers |

## Manual hard-stop

Operator procedure: [`infra/gcp/cost-controls/hard-stop-runbook.md`](../../infra/gcp/cost-controls/hard-stop-runbook.md)

## Validation

```bash
pnpm --filter @repo/security test
node --test infra/gcp/cost-controls/cost-controls.test.mjs
```

## Acceptance mapping

| Criterion | Evidence |
|-----------|----------|
| Traffic spike cannot scale without bound | `assertAllServicesBounded`, `evaluateScalingCap`, matrix `services[].maxInstances` |
| Capped exponential backoff retries | `computeRetryDelay`, `assertRetryPoliciesBounded` |
| Optional research stops before public serving | `evaluateSoftShutdown`, `assertShutdownOrdering` |
| Budget alerts + automated responses | `evaluateDailyBudget`, `billingAlerts` in matrix |
| Abusive traffic simulation | `simulateAbusiveTrafficPattern` tests |

## Follow-on

- : Cost anomaly dashboards and alerts
- : Kill switches wired to automated responses
- : Load/abuse/cost integration tests against staging
