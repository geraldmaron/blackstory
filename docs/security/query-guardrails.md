# Search and query resource guardrails

**Status:** Pure validation + cursor/cache helpers in-repo. Middleware wiring and live load
tests are follow-on work (, ).
**Depends on:** [ rate limits](./rate-limits.md), the search-and-geocoding decision (ADR-008, removed 2026-07-24, recovered in [`../decisions-carryover.md`](../decisions-carryover.md), "Search and geocoding")
**Threats:** [T-02](./threat-model.md#t-02-cost-exhaustion-via-search-and-geocoding), [T-13](./threat-model.md#t-13-database-exhaustion-and-connection-starvation)

## Objective

Bound search cost before database reads: approved query shapes only, no user SQL/sort/field
selection, normalized Unicode, capped filters/radius/date/page depth, opaque cursors, cache keys,
and fail-closed timeouts.

## Package layout

| Path | Role |
|------|------|
| [`packages/security/src/query-guardrails.ts`](../../packages/security/src/query-guardrails.ts) | Policy limits, canonicalization, cursor, cache key, cost estimate |
| [`apps/api-public/src/search-guardrails.ts`](../../apps/api-public/src/search-guardrails.ts) | HTTP query parsing + `createPublicSearchGuard` |

## Limits (default)

| Control | Value |
|---------|-------|
| Query length | 2–120 chars (NFKC, trimmed, collapsed whitespace) |
| Filters | ≤ 5; allowlist: `kind`, `state`, `precision`, `releaseId` |
| Radius | 100 m – 50 km |
| Date range | ≤ 36 500 days |
| Page size | ≤ 50 (default 20) |
| Pagination depth | ≤ 20 pages (cursor-bound) |
| Export results | ≤ 500 per request |
| Query timeout | 5 s (fail-closed) |
| Database statement budget | 4 s |
| Estimated cost ceiling | 2 500 units |

## Approved query shapes

- `text`, `text_filters`, `text_geo`, `text_geo_filters`, `filters_only`, `geo_only`

Sort keys are allowlisted (`relevance`, `name_*`, `date_*`, `distance`). Distance sort requires
geo parameters.

## Prohibited inputs

- User SQL, `orderBy` expressions, arbitrary `fields` / `select`
- Regex / `pattern` parameters and slash-delimited regex literals
- Wildcard-only queries (`*`, `?`, `%`, `_`)

## Cursor pagination

Opaque base64url JSON: `{ v: 1, depth, queryHash, position }`. Depth and query-hash binding are
validated on decode.

## Caching

`buildSearchCacheKey` hashes a canonical payload with lowercase normalized text. Use for CDN /
edge cache keys (see [`infra/gcp/armor/cdn-design.md`](../../infra/gcp/armor/cdn-design.md)).

## Timeouts

`getQueryTimeoutPolicy()` returns fail-closed budgets. On timeout, abort the in-flight read and
emit `createSlowQueryLogEvent` / `createTimeoutFailure` — do not hold pool slots.

Database adapters must apply the statement timeout on the actual query connection. Pure query
validation tests do not prove cancellation or pool recovery under live load.

##  integration

`searchQueryEndpointMetadata` exports `endpointClass: 'search'` and `costTier: 'expensive_read'`
for rate-limit guards without modifying the  evaluator.

## Validation

```bash
pnpm --filter @repo/security test
pnpm --filter @repo/api-public test
pnpm --filter @repo/security typecheck
pnpm --filter @repo/api-public typecheck
```

## Runtime verification

Exercise the deployed HTTP search path with bounded hostile and expensive inputs. Inspect query
plans, cancellation, connection release and cache behavior on representative Postgres data.
A simulated cost unit is not a provider charge; retain measured latency and resource evidence.
