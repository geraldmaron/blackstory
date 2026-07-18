# Endpoint rate limits and abuse quotas (BB-025)

**Status:** Policy matrix + in-memory evaluator in-repo. Shared distributed store and live
middleware wiring are follow-on work (BB-034, BB-059).  
**Depends on:** [BB-023 ingress / Cloud Armor](./ingress-armor.md), [BB-024 App Check](../packages/firebase)  
**Threats:** [T-01](./threat-model.md#t-01-volumetric-and-application-layer-denial-of-service), [T-02](./threat-model.md#t-02-cost-exhaustion-via-search-and-geocoding), [T-05](./threat-model.md#t-05-coordinated-correction-brigading)

## Objective

Layer application quotas beneath Cloud Armor so expensive endpoints are throttled per subject,
device/session risk, and endpoint class — without exposing exact thresholds to callers.

## Control layers

| Layer | Scope | Implementation |
|-------|-------|----------------|
| Cloud Armor | Per-IP edge throttles, WAF, emergency deny | [`infra/gcp/armor/`](../../infra/gcp/armor/) (BB-023) |
| App Check | Client attestation for expensive/mutation paths | `@blap/firebase` guards (BB-024) |
| Subject quotas | anonymous < authenticated < admin < service | `@blap/security` policy matrix |
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

Production should swap the store interface for Redis/Memorystore (BB-033) without changing policy math.

## Validation

```bash
pnpm --filter @blap/security test
pnpm --filter @blap/api-public test
pnpm --filter @blap/api-submissions test
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

1. Wire guards into Cloud Run request middleware (after App Check).
2. Shared Redis/Memorystore backend implementing `RateLimitStore`.
3. Export quota metrics to BB-034 telemetry (`rate_limit_denied`, `risk_score_exceeded`).
4. Load/abuse validation under BB-059 against staging Armor + app quotas.
5. Tune matrix from production traffic (no secrets in repo).

## Related

- [Ingress / Cloud Armor](./ingress-armor.md)
- [Abuse cases AC-01, AC-02, AC-05](./abuse-cases.md)
- [Service surfaces](./service-surfaces.md)
