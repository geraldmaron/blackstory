# Endpoint rate limits and abuse quotas

**Status:** Policy matrix + in-memory evaluator in-repo; the in-process store is per function
instance, so on Vercel Fluid it bounds one instance, not a caller. The edge limit that actually
holds across instances is the Cloudflare rule below (2026-09-22). Shared distributed store and
live middleware wiring remain follow-on work.

## Edge rate limit (Cloudflare, live 2026-09-22)

Zone `blackstory.app`, Security rules → Rate limiting rules, "Expensive web endpoints - per-IP
burst limit (2026-09-22)" (the one rule the Free plan allows): expression
`starts_with(path, "/search/api") or "/explore/api" or "/locate/api" or "/submit/api" or path eq
"/api/request-integrity" or (starts_with(path, "/corrections/") and ends_with(path, "/api"))`,
counted per IP, **60 requests per 10 s**, action Block for 10 s (the Free plan's only period and
mitigation timeout). Verified live: 80 parallel requests to `/api/request-integrity` were served,
the next request answered `429` with `retry-after: 10`, service resumed 12 s later, and `/about`
was untouched throughout. The threshold is deliberately generous because carrier-grade NAT puts
many phones behind one address; it stops scripts, not people. Vercel WAF rate limiting is NOT
used on the web project: Vercel sees Cloudflare's addresses as the client, so a per-IP rule
there would throttle every visitor together. `api.blackstory.app` is not behind Cloudflare, so
a Vercel WAF rule (Log first, then Deny) is the right control there; it is not yet configured
(`repo-ogo3j.7`).
**Depends on:** [ ingress / Cloud Armor](./ingress-armor.md), [API protocol](../../apps/api-public/src/http/README.md)
**Threats:** [T-01](./threat-model.md#t-01-volumetric-and-application-layer-denial-of-service), [T-02](./threat-model.md#t-02-cost-exhaustion-via-search-and-geocoding), [T-05](./threat-model.md#t-05-coordinated-correction-brigading)

## Objective

Layer application quotas beneath Cloud Armor so expensive endpoints are throttled per subject,
device/session risk, and endpoint class — without exposing exact thresholds to callers.

## Control layers

| Layer | Scope | Implementation |
|-------|-------|----------------|
| Cloud Armor | Per-IP edge throttles, WAF, emergency deny | [`infra/gcp/armor/`](../../infra/gcp/armor/) |
| Client header | Platform/version format signal, not authorization | `packages/security/src/client-attestation.ts` |
| Subject quotas | anonymous < authenticated < admin < service | `@repo/security` policy matrix |
| Endpoint buckets | search, geocode, nearby, entity, source, … | Token bucket + rolling/daily windows |
| Risk aggregation | Cross-IP device/session/account signals | `RiskSignal` + `aggregateDistributedRisk` |
| Concurrency | In-flight cap per key | `maxConcurrency` per policy row |

## Endpoint classes

| Class | Examples | Cost tier |
|-------|----------|-----------|
| `entityRetrieval`, `sourceInspection` | `GET /v1/entities/*` | static read |
| `search`, `geocoding`, `nearbyDiscovery` | `GET /v1/search`, `/locations/*` | expensive read |
| `corrections` | `POST /v1/corrections` | mutation |
| `authentication`, `passwordReset` | `/v1/auth/*` | auth |
| `adminExport`, `researchStart`, `publicationPreview` | admin-only paths | admin |

Anonymous callers receive the **smallest** quota for every class. Admin-only classes (`capacity: 0`
for anonymous) deny by default.

## Package layout

| Path | Role |
|------|------|
| [`packages/security/src/rate-limits.ts`](../../packages/security/src/rate-limits.ts) | Policy matrix, token bucket, store, risk aggregation |
| [`apps/api-public/src/rate-limits.ts`](../../apps/api-public/src/rate-limits.ts) | `createPublicRateLimitGuard` |
| [`apps/api-submissions/src/rate-limits.ts`](../../apps/api-submissions/src/rate-limits.ts) | `createSubmissionsRateLimitGuard` |

## Safe retry guidance

Denied responses use `formatRateLimitResponse`:

- HTTP `429` with `Retry-After` (coarse seconds, minimum 5)
- Body `{ error: "rate_limit_exceeded", retryAfterSec }` — **no** `X-RateLimit-Limit` or exact caps

Callers should honor `Retry-After` with exponential backoff and jitter.

## Bounded state

`createInMemoryRateLimitStore` enforces:

- Default TTL (1 h) per key
- `maxKeys` (10 000) with LRU eviction
- Keys scoped as `subject:endpointClass:identity`

Production should swap the store interface for Redis/Memorystore without changing policy math.

## Validation

```bash
pnpm --filter @repo/security test
pnpm --filter @repo/api-public test
pnpm --filter @repo/api-submissions test
```

## Acceptance mapping

| Criterion | Evidence |
|-----------|----------|
| Expensive > static read strictness | `isExpensiveEndpointStricter` tests |
| Anonymous smallest quota | `assertSubjectQuotaOrdering` |
| Distributed abuse beyond IP | `RiskSignal` kinds + `aggregateDistributedRisk` |
| Bounded state | TTL + `maxKeys` store tests |
| Safe retry without threshold leak | `safeRetryAfter`, `formatRateLimitResponse` tests |

## Remaining live work

1. Wire guards into Cloud Run request middleware (after the client-header protocol check).
2. Shared Redis/Memorystore backend implementing `RateLimitStore`.
3. Export quota metrics to  telemetry (`rate_limit_denied`, `risk_score_exceeded`).
4. Load/abuse validation under  against staging Armor + app quotas.
5. Tune matrix from production traffic (no secrets in repo).

## Related

- [Ingress / Cloud Armor](./ingress-armor.md)
- [Abuse cases AC-01, AC-02, AC-05](./abuse-cases.md)
- [Service surfaces](./service-surfaces.md)
