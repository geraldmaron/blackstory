# Cost and resource exhaustion controls

**Status:** Policy matrix + evaluators in-repo; GCP billing budgets and live queue/job provisioning are follow-on work (, ).
**Depends on:** [admin App Hosting hardening](../../apphosting.admin.yaml), [Vercel public web (ADR-027)](../adr/ADR-027-vercel-public-web-hosting.md), [ ingress / Cloud Armor](./ingress-armor.md), [ rate limits](./rate-limits.md)
**Threats:** [T-01](./threat-model.md#t-01-volumetric-and-application-layer-denial-of-service), [T-13](./threat-model.md#t-13-database-exhaustion-and-connection-starvation), [T-14](./threat-model.md#t-14-cloud-bill-exhaustion)

## Objective

Ensure a traffic spike, retry storm, or budget burn cannot scale every service without bound. Optional research workloads stop before public historical serving. All evaluators **fail closed** when limits are exceeded or policy is unknown.

## Control layers

| Layer | Scope | Implementation |
|-------|-------|----------------|
| App Hosting / Cloud Run scaling | Per-service maxInstances, concurrency | Admin `apphosting.admin.yaml` + `DEFAULT_SERVICE_SCALING_LIMITS`; public web caps on Vercel |
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

## Build-time spend (Vercel)

Every control above governs **runtime** resource exhaustion. The Aug 2026 invoice showed that is
only half the surface: of $234.41 on Vercel, **$64.68 was Build CPU Minutes** (12d 23h) — the
second-largest line, and one no evaluator in this document can see. Build spend is not a traffic
spike; it scales with commit velocity, and this repo ran 437 commits in Aug 2026.

**Control:** [`scripts/vercel-ignore-build.sh`](../../scripts/vercel-ignore-build.sh), wired as
`ignoreCommand` in both `apps/web/vercel.json` and `apps/admin/vercel.json`. It skips a build when
no changed file can reach that project's deployed bundle.

Measured against Aug 2026 history (per commit): **60% of commits skippable for web, 78% for admin**.
Realized saving depends on push granularity — the rule is evaluated per *deployment*, so a push
batching one relevant commit with twenty irrelevant ones still builds. A day-batched simulation
skips only 2 of 21 days. Actual behaviour sits between those bounds.

The script **fails open**: every uncertain branch builds. A needless build costs cents; a wrongly
skipped build means production silently does not get the fix and nothing reports it.

## Cloudflare edge cache posture

`blackstory.app` is **Cloudflare-proxied** (orange cloud) in front of Vercel, on the **Free**
plan. Zone `653abe0dbd1b10d22411306cb1f645be`. The cutover runbook's DNS row said grey cloud /
DNS-only until 2026-08-24; that was stale, and it mattered — grey cloud would make every rule
below a no-op.

**Cache rule** (ruleset `fbba310d91a3483f88cc5686b25684e1`, phase `http_request_cache_settings`):
`/`, `/rooms`, `/memorial`, excluding requests carrying the `rsc` header, are edge-cached for
one hour with `browser_ttl: respect_origin` and `status_code_ttl` `200-226 -> 3600`,
`300-526 -> 0`.

Three constraints that are not obvious and cost a live incident on 2026-08-24 when they were
missed:

1. **`browser_ttl` must be set explicitly.** Omit it and the zone's Browser Cache TTL applies.
   That default was `14400`, so the first version of this rule answered `/` with
   `cache-control: max-age=14400` while the site was serving a maintenance **503** — pinning that
   503 in every visitor's own browser for four hours, where no CDN purge can reach it. The zone
   setting is now `0` (Respect Existing Headers), so the origin's `Cache-Control` governs.
2. **`300-526 -> 0` is mandatory, not tidiness.** Without it the maintenance 503 caches at the
   edge and outlives the wall.
3. **Do NOT add a custom cache key here.** "Ignore query string" *is* available on Free (only
   per-parameter include/exclude is Enterprise), so it is tempting. It was wrong when `/` still
   rendered Atlas filters: collapsing `state`/`era`/`kind` would have served one state's page to
   everyone. `/` is now the Door and ignores facet query; leftover `?state=` 308s to the bare
   path. The faceted long tail lives on `/explore`. `/atlas/catalog` and `/sitemap.xml` are
   separate origins that must not be cache-busted by junk query. `cache_by_device_type` is off
   for the same reason in reverse — it splits each entry three ways for a site that serves no
   device-specific HTML.

A second rule, `Cache HTML at edge`, is present but **disabled**: its expression was an empty
wildcard (`http.request.full_uri wildcard r""`), zone-wide and unreviewed. Left in place rather
than deleted so its intent can be recovered before someone re-creates it.

**Verified on live 200s, 2026-08-25**, after the maintenance wall came down:

| Probe | Result |
|-------|--------|
| `/` repeat requests | `cf-cache-status: HIT`, `age` climbing — repeat front-door hits never reach Vercel |
| `/?state=AL` | 308 to `/` — Door has no facet query; junk keys must not fork the HTML cache |
| `/` with `rsc: 1` | `DYNAMIC` — the bypass holds, RSC and HTML never share an entry |
| `/atlas/catalog` | `x-vercel-cache: MISS` then `HIT`, `HIT` with rising `age` |

Two things that settle long-standing questions:

**Vercel DOES honour a route handler's `s-maxage`** (`repo-27nn`). The whole 2026-08-22 shell/catalog
split rested on that premise and it had never been tested, because a dynamic *page* has its header
overwritten with `no-store`. A route handler keeps its own. Confirmed.

**The payload is gone.** `/` is now **33.6 KB gzipped** (372 KB raw), against the ~15–17 MB RSC
payload that was, by itself, the July–August Vercel bill. `/atlas/catalog` carries the 949 KB
(gzipped) catalog and is CDN-cached. The Door must not re-embed that catalog as `catalogFeatures`
on the client; spotlight `pin-N` is resolved on the server.

**Origin cost pass, 2026-09-01.** Named AI-training crawlers (`GPTBot`, `ClaudeBot`, …) get a
cached 403 on `/explore`, `/atlas/catalog`, `/sitemap.xml`, and the search/refine/geocode APIs.
Googlebot is not denied. `/sitemap.xml` is a route handler with `s-maxage` so crawler polling
does not rebuild the URL list on every hit. Search/locate/explore refine stay rate-limited via
`@repo/security`. `autoDisablePublicCorpus` stays false.

Note the browser still receives `private, no-cache, no-store` on `/` while Cloudflare serves a
`HIT`. That is the intended split: `override_origin` caches at the edge, the origin's header passes
downstream untouched, so no visitor caches a dynamic page locally.

### Second rule: ISR surfaces (added 2026-08-25)

`/methodology`, `/submit`, `/entity/`, `/books/`, `/law/`, `/stories/`, `/chapters/` — same `rsc`
bypass — with **`edge_ttl: respect_origin`** rather than the `override_origin` the first rule uses.

The two groups need opposite treatment, which is why they are two rules and not one. `/rooms`
and `/memorial` are `force-dynamic` and send `no-store`, so the edge must *override* the origin
or nothing caches. `/` is ISR (`revalidate = 300`) and stays in the same override rule so the
front door still caches for an hour at Cloudflare. The other ISR surfaces already declare
exactly the right thing (`public, s-maxage=3600, stale-while-revalidate=86400`), so the edge
should *respect* it and keep one source of truth in the app.

`respect_origin` also makes the prefix list safe to be generous with: a route that declares
`no-store` or `max-age=0` simply does not cache. Verified — `/stories/mosaic-credits` sends
`public, max-age=0, must-revalidate` and stays uncached even though `/stories/` is matched. Adding a
prefix cannot force-cache something the app said not to.

Verified after deploy: `/methodology`, `/entity/[id]` and `/submit` each go `MISS` then `HIT`; `/`
and `/rooms` still `HIT` (no regression); an entity page with `rsc: 1` returns `DYNAMIC`;
`/corrections` and `/records` stay `DYNAMIC`, correctly excluded.

Before this, every one of 4,107 entity pages was served from Vercel on every request despite the
origin declaring it cacheable for an hour.

## Cloudflare zone security posture (blackstory.app)

Audited and hardened 2026-08-25. Zone `653abe0dbd1b10d22411306cb1f645be`, Free plan.

| Setting | Was | Now | Why |
|---------|-----|-----|-----|
| `min_tls_version` | `1.0` | **`1.2`** | TLS 1.0/1.1 are deprecated and disallowed under PCI-DSS. Verified after the change: a TLS 1.1 handshake is refused, 1.2 succeeds. |
| `always_use_https` | `off` | **`on`** | Cloudflare now 301s `http://` to `https://` at the edge. Verified. |
| `ssl` | `full` | **`strict`** | `full` does not validate the origin certificate. Precondition verified BEFORE flipping, because `strict` against an invalid origin cert is a total outage (526): probed `76.76.21.21` directly with `--resolve` and got `ssl_verify_result=0`, i.e. Vercel presents a valid cert for this hostname. |
| `browser_cache_ttl` | `14400` | **`0`** | See the cache section above — this was the cause of the 2026-08-24 cached-503 incident. |

**HSTS is deliberately NOT set at Cloudflare** and should stay that way. The app already sends
`Strict-Transport-Security: max-age=63072000` from its own security headers
(`apps/web/src/lib/web-security/`), which is the right layer: it stays with the app across hosts
and is reviewable in the repo. Cloudflare's zone HSTS toggle reads `enabled: false`; that is not a
gap, and switching it on would create a second, invisible source of truth for the same header.

**Not changed, deliberately.** `geralddagher.com` and `bengalsreunion.com` are on the same account
and still carry `min_tls_version: 1.0` and `browser_cache_ttl: 14400` (and `bengalsreunion.com`
has `always_use_https: off`). They are separate properties with origins that have not been
verified here, and `ssl: strict` in particular is an outage if the origin cert does not validate.
Audit them on their own terms before copying this posture across.

## Platform spend backstop

The GCP billing budgets above do not cover Vercel or Supabase, which is where the Aug 2026 spend
actually landed. Two gaps remain **operator-only** (dashboard, not code):

| Gap | Control | Issue |
|-----|---------|-------|
| No hard cap on Vercel on-demand spend | Spend Management → amount + pause-on-threshold | `repo-n7jq` |
| Supabase compute billed on 3 active projects | Audit whether `theadministration-app` needs its own project vs. a schema | — |

The precedent for why a cap matters is recorded in
[`packages/ops-data/scripts/check-public-read-egress.ts`](../../packages/ops-data/scripts/check-public-read-egress.ts):
a catalog-read regression ran for 20 days and ~253GB of egress because nothing was watching, and
was found by hand after the bill.

## Package layout

| Path | Role |
|------|------|
| [`packages/security/src/resource-controls.ts`](../../packages/security/src/resource-controls.ts) | Policy matrices, evaluators, abusive-traffic simulation |
| [`packages/security/src/resource-controls.test.ts`](../../packages/security/src/resource-controls.test.ts) | Unit tests |
| [`infra/gcp/cost-controls/`](../../infra/gcp/cost-controls/) | Declarative GCP stubs + hard-stop runbook |

## References to other beads (not rewritten)

- **:** Admin App Hosting `maxInstances=2`, `concurrency=20`, `minInstances=0` in `apphosting.admin.yaml` — validated via `BB022_APP_HOSTING_LIMITS` mirror
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
