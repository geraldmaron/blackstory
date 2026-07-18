# Cloud Armor and protected public API ingress (BB-023)

Design stubs for a **global external HTTP(S) load balancer**, **serverless NEGs**, **Cloud
Armor**, and **Cloud CDN** protecting `api-public` and `api-submissions`. Nothing in this
directory is applied to GCP by default.

**Security narrative:** [`../../docs/security/ingress-armor.md`](../../docs/security/ingress-armor.md)  
**Surface matrix (BB-021):** [`../surfaces/surface-matrix.json`](../surfaces/surface-matrix.json)

## Artifacts

| File | Purpose |
|------|---------|
| [`ingress-matrix.json`](./ingress-matrix.json) | Machine source of truth — LB, NEGs, ingress, CDN, acceptance |
| [`ingress-matrix.schema.json`](./ingress-matrix.schema.json) | JSON Schema for ingress matrix |
| [`policies/api-public-policy.json`](./policies/api-public-policy.json) | Cloud Armor policy — read API |
| [`policies/api-submissions-policy.json`](./policies/api-submissions-policy.json) | Cloud Armor policy — intake API |
| [`policies/armor-policy.schema.json`](./policies/armor-policy.schema.json) | JSON Schema for Armor policies |
| [`policies/emergency-deny-snippet.yaml`](./policies/emergency-deny-snippet.yaml) | gcloud-oriented emergency deny snippet |
| [`alb-neg-design.md`](./alb-neg-design.md) | Global external ALB + serverless NEG notes |
| [`cdn-design.md`](./cdn-design.md) | Cloud CDN for cacheable read responses |
| [`geo-controls.md`](./geo-controls.md) | Geographic restrictions — **default OFF** |
| [`emergency-deny-runbook.md`](./emergency-deny-runbook.md) | Activate deny without code deploy |
| [`metrics-alerts-checklist.md`](./metrics-alerts-checklist.md) | Monitoring and alert stubs |
| [`load-test-plan.md`](./load-test-plan.md) | Rate-limit and ingress negative tests (not live) |
| [`../../docs/security/rate-limits.md`](../../docs/security/rate-limits.md) | Application quota matrix and guard stubs (BB-025) |

## Application quotas (BB-025)

Edge Armor policies (above) provide coarse per-IP throttles. **Application-layer quotas** live in
`@blap/security` and are wired through `createPublicRateLimitGuard` /
`createSubmissionsRateLimitGuard` in the API apps. See
[`docs/security/rate-limits.md`](../../docs/security/rate-limits.md) for the policy matrix,
risk-signal aggregation, and remaining shared-store / middleware work.

## Design invariants

1. **LB-only internet path** — `internetTrafficOnlyThroughLb: true`
2. **No direct run.app** — Cloud Run ingress `internal-and-cloud-load-balancing` on both public APIs
3. **Armor at edge** — WAF preconfigured rules + per-IP rate-based bans (429)
4. **Geo default OFF** — enable only with evidence ([`geo-controls.md`](./geo-controls.md))
5. **Emergency deny** — priority 10 rule toggled via `gcloud` ([`emergency-deny-runbook.md`](./emergency-deny-runbook.md))

## Validate

```bash
cd infra/gcp/armor

# JSON Schema (ingress matrix)
uv run --with jsonschema python -c "
import json, sys
from jsonschema import Draft7Validator
s = json.load(open('ingress-matrix.schema.json'))
d = json.load(open('ingress-matrix.json'))
errs = list(Draft7Validator(s).iter_errors(d))
print('ingress-matrix OK' if not errs else '\n'.join(e.message for e in errs))
sys.exit(1 if errs else 0)
"

# Node acceptance tests (required rules, LB-only asserts)
node --test armor-policy.test.mjs
```

## Human apply steps (summary)

1. Create Armor policies from `policies/*.json`.
2. Create serverless NEGs + backend services (CDN on `api-public` only).
3. Create global external HTTPS load balancer + DNS.
4. Set Cloud Run ingress to `internal-and-cloud-load-balancing` for both public APIs.
5. Verify direct `run.app` fails and LB hostnames succeed ([`load-test-plan.md`](./load-test-plan.md)).
6. Wire alerts per [`metrics-alerts-checklist.md`](./metrics-alerts-checklist.md).

Deploy identity remains WIF-only (`infra/gcp/wif/`). No secrets in this directory.

## Acceptance (artifact evidence)

| ID | Criterion | Evidence |
|----|-----------|----------|
| AC-ARMOR-1 | Internet traffic only through LB | `ingress-matrix.json`, `armor-policy.test.mjs` |
| AC-ARMOR-2 | Direct run.app fails | Ingress fields + `load-test-plan.md` |
| AC-ARMOR-3 | Rate limits → 429 + metrics | Policy rules + metrics checklist + load-test stub |
| AC-ARMOR-4 | Emergency deny without deploy | Rule priority 10 + runbook + snippet |
