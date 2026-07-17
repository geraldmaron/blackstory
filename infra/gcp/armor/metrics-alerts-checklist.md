# Cloud Armor metrics and alerts checklist (BB-023)

Use this checklist when applying ingress (human provisioning) and when wiring BB-034
security telemetry. All metrics are available in Cloud Monitoring under Load Balancing and
Cloud Armor resource types.

## Core metrics to watch

| Metric | Resource | Indicates |
|--------|----------|-----------|
| `loadbalancing.googleapis.com/https/backend_request_count` | Backend service | Total traffic; split by `response_code` |
| `loadbalancing.googleapis.com/https/backend_latencies` | Backend service | Origin slowness under load |
| `networksecurity.googleapis.com/https/request_count` | Cloud Armor policy | Allowed vs denied vs rate-limited |
| `networksecurity.googleapis.com/https/requests_dropped` | Cloud Armor policy | WAF / manual deny drops |
| `networksecurity.googleapis.com/https/requests_throttled` | Cloud Armor policy | Rate-limit / ban triggers (429 path) |
| `networksecurity.googleapis.com/https/adaptive_protection/alert` | Cloud Armor policy | L7 DDoS adaptive protection signals |

Filter by:

- `backend_service_name`: `black-book-api-public-backend`, `black-book-api-submissions-backend`
- `security_policy_name`: `black-book-api-public-armor`, `black-book-api-submissions-armor`

## Alert policies (stub — tune thresholds after baseline)

| ID | Condition | Severity | Notification |
|----|-----------|----------|--------------|
| ARMOR-01 | `requests_throttled` rate > 100/min for 5m on either policy | warning | `#security-alerts` |
| ARMOR-02 | `requests_dropped` (WAF) rate > 50/min for 10m | warning | `#security-alerts` |
| ARMOR-03 | `backend_request_count` 5xx > 5% of requests for 5m | critical | pager |
| ARMOR-04 | `adaptive_protection/alert` fires | critical | pager + incident |
| ARMOR-05 | `backend_request_count` 429 > 30% for 15m (possible mis-tuned limit) | warning | `#security-alerts` |
| ARMOR-06 | Emergency deny active — rule 10 `deny` + request drop to near zero on public host | info | `#security-alerts` (manual check) |

## Dashboard panels (minimum)

1. Requests/sec per backend (2xx / 4xx / 5xx / 429 stacked)
2. Armor throttled vs dropped vs allowed
3. CDN cache hit ratio (`api-public` only)
4. p95 backend latency
5. Top denied client IPs (log-based metric from LB logs — BB-034)

## Log-based metrics (BB-034 follow-up)

Create log metrics from external HTTP(S) LB logs:

- `armor_deny_by_rule` — extract `jsonPayload.enforcedSecurityPolicy.name` and rule priority
- `rate_limit_429_client_ip` — `httpRequest.status=429`

## Denial / throttle → response playbook

| Signal | Likely cause | First action |
|--------|--------------|--------------|
| Throttle spike, 429 | Volumetric abuse or load test | Confirm intent; tighten ban duration if attack |
| WAF deny spike | Scanner or injection attempt | Review sampled payloads; no app change needed |
| Adaptive protection alert | L7 DDoS | Enable preview rules; consider emergency deny |
| 5xx with low Armor drops | Origin / Cloud Run issue | Check Run concurrency and Firestore quotas |

## Sign-off before production

- [ ] Alert policies ARMOR-01–05 created in `black-book-efaaf`
- [ ] Dashboard linked from ops runbook
- [ ] On-call knows emergency deny steps ([`emergency-deny-runbook.md`](./emergency-deny-runbook.md))
- [ ] Load test plan executed once in staging ([`load-test-plan.md`](./load-test-plan.md))

## Acceptance mapping

**AC-ARMOR-3:** Denials and throttles observable via metrics above; validated in load-test stub.
