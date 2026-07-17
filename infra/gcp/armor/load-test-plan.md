# Load and rate-limit test plan stub (BB-023)

**Status:** Design-only — do not run against production `black-book-efaaf` without an
approved change window. Execute in a dedicated staging LB + Cloud Run stack (BB-059).

## Prerequisites

- Global external ALB applied per [`alb-neg-design.md`](./alb-neg-design.md)
- Cloud Armor policies attached
- Cloud Run ingress `internal-and-cloud-load-balancing`
- Monitoring dashboard from [`metrics-alerts-checklist.md`](./metrics-alerts-checklist.md)

## Tools (examples)

- `k6` or `vegeta` for HTTP load
- `curl` for single-request verification
- Cloud Monitoring console for throttle metrics

## Scenarios

### 1. `direct-url-negative-test` (AC-ARMOR-2)

**Goal:** Direct `run.app` URLs fail; LB hostnames succeed.

```bash
# Must fail (403/404) from public internet
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://black-book-api-public-REPLACE-uc.a.run.app/health"

# Must succeed (200)
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://api.blackbook.app/health"
```

**Pass:** Direct URL ≠ 200; LB URL = 200.

### 2. `api-public-rate-limit` (AC-ARMOR-3)

**Goal:** Sustained read flood triggers 429 and `requests_throttled` metric.

| Parameter | Value |
|-----------|-------|
| Target | `https://api.blackbook.app/v1/search?q=test` |
| Rate | 400 req/min from single IP (exceeds 300/min path rule) |
| Duration | 3 minutes |
| Expected | Mix of 200 then 429; ban after threshold (`banDurationSec=600`) |

**Pass:** ≥10% responses 429 during burst; Armor throttle metric increases.

### 3. `api-submissions-rate-limit` (AC-ARMOR-3)

**Goal:** POST burst to intake triggers stricter 429 / ban.

| Parameter | Value |
|-----------|-------|
| Target | `https://submit.blackbook.app/v1/submissions` |
| Method | POST (valid minimal JSON body) |
| Rate | 30 POST/min from single IP (exceeds 20/min rule) |
| Duration | 2 minutes |

**Pass:** 429 responses; longer `banDurationSec` (1800) observable in logs.

### 4. `waf-deny-smoke`

**Goal:** Preconfigured WAF denies obvious injection (403, not 500).

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://api.blackbook.app/v1/search?q=%27%20OR%201%3D1--"
```

**Pass:** HTTP 403 from edge; `requests_dropped` increments.

### 5. `cdn-cache-bust` (AC-02 prep)

**Goal:** Cache-busting query params do not force origin on every repeat for same logical query.

1. Request `https://api.blackbook.app/v1/entities/TEST_ID?release=current`
2. Repeat with `&_=random` appended
3. Compare `Age` / cache headers

**Pass:** Second request still HIT when only noise param differs (after BB-025 cache-key normalization).

### 6. `emergency-deny-drill` (AC-ARMOR-4)

**Goal:** Rule 10 flip blocks traffic without redeploy.

1. Record baseline RPS on LB hostname
2. Activate deny per [`emergency-deny-runbook.md`](./emergency-deny-runbook.md)
3. Confirm 403 on `/health` within 60s
4. Deactivate; confirm 200 restored

**Pass:** No Cloud Run revision change during drill (`gcloud run revisions list` unchanged).

## Reporting template

| Scenario | Date | Environment | Pass/Fail | Notes |
|----------|------|-------------|-----------|-------|
| direct-url-negative-test | | | | |
| api-public-rate-limit | | | | |
| api-submissions-rate-limit | | | | |
| waf-deny-smoke | | | | |
| cdn-cache-bust | | | | |
| emergency-deny-drill | | | | |

File results under BB-059 load-test evidence. Link metrics screenshots for ARMOR-01/02 alerts.

## Acceptance mapping

- **AC-ARMOR-2:** Scenario 1
- **AC-ARMOR-3:** Scenarios 2–3 + metrics checklist
- **AC-ARMOR-4:** Scenario 6
