# Manual hard-stop runbook (BB-033)

**Status:** Design — operator procedure for cost emergencies.  
**Related:** [BB-035 kill switches](../../docs/security/threat-model.md#t-14-cloud-bill-exhaustion) (future), [cost-controls matrix](./cost-controls-matrix.json)

## When to use

- GCP billing budget alert at **95%+** with sustained spend velocity
- Automated soft shutdown (`pause_research`, `throttle_optional`) insufficient
- Confirmed abuse pattern (DDoS, search flood, geocoder burn) after BB-023/025 controls engaged

## Principles

1. **Public historical corpus stays online** — static release snapshots and App Hosting read path remain available unless an operator **explicitly** chooses full read-only mode (BB-035).
2. **Optional research stops first** — pause Cloud Tasks `research-campaign` and `url-evaluation` queues before throttling public APIs.
3. **Fail closed** — when in doubt, deny new expensive work rather than allow unbounded spend.
4. **No secrets in commands** — use authenticated `gcloud` session; never paste service-account JSON.

## Automated responses (pre-provisioned)

| Alert threshold | Automated response | Effect |
|-----------------|-------------------|--------|
| 50% | `alert_only` | Notify on-call; no workload change |
| 80% | `throttle_optional` | Pause optional research queues |
| 95% | `pause_research` | Stop research Cloud Run Jobs + campaign queue |
| 100% | `pause_research` | Hard stop optional tier; preserve public serving |

Policy source: `packages/security/src/resource-controls.ts` → `DEFAULT_BILLING_ALERTS`.

## Manual hard-stop procedure

### 1. Confirm scope (2 min)

- Check Cloud Monitoring: Armor denies, App Check failures, queue depth, error rates
- Identify whether spike is volumetric (T-01) or expensive-endpoint abuse (T-02)
- Record incident id and active release id

### 2. Pause optional workloads (5 min)

```bash
# Pause research and URL evaluation queues (tasks retained, not dropped)
gcloud tasks queues pause research-campaign --location=us-central1
gcloud tasks queues pause url-evaluation --location=us-central1

# Cancel in-flight research jobs (does not affect public serving)
gcloud run jobs executions list --job=research-campaign --region=us-central1
# gcloud run jobs executions cancel EXECUTION --region=us-central1
```

### 3. Enable edge emergency deny if abuse-driven (5 min)

See [`../armor/emergency-deny-runbook.md`](../armor/emergency-deny-runbook.md) — activate pre-provisioned Armor deny rule without code deploy.

### 4. Reduce scale ceilings if needed (10 min)

```bash
# Example: cap api-public max instances (replace SERVICE/REGION)
gcloud run services update black-book-api-public \
  --region=us-central1 \
  --max-instances=4
```

App Hosting web caps remain governed by `apps/web/apphosting*.yaml` (BB-022). Do not raise `maxInstances` during an incident.

### 5. Disable expensive features via kill switches (BB-035)

When BB-035 lands, prefer feature kill switches over taking public corpus offline:

- Search throttling (retain static entity pages)
- Geocoder disable
- Submissions pause

### 6. Communicate and document

- Post status: public read path status, disabled optional features
- Open Beads issue for tuning follow-up (BB-059 load tests)
- After resolution: resume queues in reverse order (research last)

## Recovery order

1. Verify spend velocity normalized
2. Resume `outbox-dispatch`, `submissions-intake`, `publication-preview`
3. Resume `url-evaluation` with reduced rate limits if needed
4. Resume `research-campaign` last
5. Restore Cloud Run max-instances to matrix values in `cost-controls-matrix.json`

## Validation

```bash
node --test infra/gcp/cost-controls/cost-controls.test.mjs
pnpm --filter @blap/security test
```

## Explicit non-actions

- Do **not** delete release snapshots or public projections
- Do **not** disable App Hosting web backend unless operator explicitly chooses full static mode
- Do **not** commit billing account IDs, budget API keys, or notification webhook URLs to the repo
