# Conditional GCP hard-stop runbook

**Status:** Conditional design procedure. It applies only if the optional GCP resources named below have been separately provisioned and verified; this repository does not establish that they exist.
**Related:** [kill-switch design](../../../docs/security/threat-model.md#t-14-cloud-bill-exhaustion), [cost-controls matrix](./cost-controls-matrix.json)

## When to use

- A GCP billing budget alert at **95%+** with sustained spend velocity, after confirming that the named GCP project and resources are in use
- The optional GCP queue/job controls are actually provisioned and automated soft shutdown (`pause_research`, `throttle_optional`) is insufficient
- A confirmed abuse pattern (DDoS, search flood, geocoder burn) after the controls available in the deployed provider have been engaged

## Principles

1. **Public historical corpus stays online** — Vercel-served read path and static release snapshots remain available unless an operator explicitly chooses full read-only mode.
2. **Optional research stops first** — if provisioned, pause the research and URL-evaluation queues before throttling public APIs.
3. **Fail closed** — when in doubt, deny new expensive work rather than allow unbounded spend.
4. **No secrets in commands** — use authenticated `gcloud` session; never paste service-account JSON.

## Policy targets (not current automation)

| Alert threshold | Automated response | Effect |
|-----------------|-------------------|--------|
| 50% | `alert_only` | Notify on-call; no workload change |
| 80% | `throttle_optional` | Pause optional research queues |
| 95% | `pause_research` | Stop optional research jobs and campaign queue where those resources are provisioned |
| 100% | `pause_research` | Hard stop optional tier; preserve public serving |

Policy source: `packages/security/src/resource-controls.ts` → `DEFAULT_BILLING_ALERTS`.

## Manual hard-stop procedure

### 1. Confirm scope (2 min)
- Verify that the GCP project, queues, jobs, load balancer, and Armor policy are provisioned and correspond to the current incident. If they are absent, stop this procedure and use the actual Vercel, Cloudflare, or Supabase provider controls.
- If the optional GCP edge is provisioned, check Cloud Monitoring for Armor denies, client-header check failures, queue depth, and error rates
- Identify whether spike is volumetric (T-01) or expensive-endpoint abuse (T-02)
- Record incident id and active release id

### 2. Pause optional workloads (5 min, only if provisioned)

Run the commands below only after the scope check confirms that these queue and job resources exist in the incident project. Tasks are retained, not dropped; cancelling a job does not affect public serving.
```bash
# Pause research and URL evaluation queues (tasks retained, not dropped)
gcloud tasks queues pause research-campaign --location=us-central1
gcloud tasks queues pause url-evaluation --location=us-central1

# Cancel in-flight research jobs (does not affect public serving)
gcloud run jobs executions list --job=research-campaign --region=us-central1
# gcloud run jobs executions cancel EXECUTION --region=us-central1
```

### 3. Enable optional GCP edge emergency deny if abuse-driven (5 min)

If a GCP Armor policy is provisioned, follow [`../armor/emergency-deny-runbook.md`](../armor/emergency-deny-runbook.md) to activate its deny rule. This is not a current production control.

### 4. Reduce optional GCP scale ceilings if needed (10 min)

```bash
# Example: cap api-public max instances (replace SERVICE/REGION)
gcloud run services update black-book-api-public \
  --region=us-central1 \
  --max-instances=4
```

The shared `/admin` surface and public web are served by Vercel. Do not infer Vercel scaling or spend controls from these optional Cloud Run commands.

### 5. Disable expensive features via verified kill switches

Use only switches whose stored state is wired to the affected deployed operation. Follow the
[incident response](../../../docs/runbooks/incident-response.md) control map and verify the effect:

- Search throttling (retain static entity pages)
- Geocoder disable
- Submissions pause

### 6. Communicate and document

- Post status: public read path status, disabled optional features
- Record tuning and load-test follow-up in the issue tracker
- After resolution: resume queues in reverse order (research last)

## Recovery order

1. Verify spend velocity normalized
2. Resume `outbox-dispatch`, `submissions-intake`, `publication-preview`
3. Resume `url-evaluation` with reduced rate limits if needed
4. Resume `research-campaign` last
5. If optional GCP resources were used, restore their limits to the verified matrix values in `cost-controls-matrix.json`; otherwise use the provider-specific recovery procedure for Vercel, Cloudflare, or Supabase

## Validation

```bash
node --test infra/gcp/cost-controls/cost-controls.test.mjs
pnpm --filter @repo/security test
```

## Explicit non-actions

- Do **not** delete release snapshots or public projections
- Do **not** disable the shared Vercel Production deployment unless an operator explicitly chooses full static mode
- Do **not** treat this runbook as evidence that GCP budgets, queues, jobs, Cloud Armor, or Cloud Run are live
- Do **not** commit billing account IDs, budget API keys, or notification webhook URLs to the repo
