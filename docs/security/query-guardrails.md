# Search and query resource guardrails (BB-026)

**Status:** Pure validation + cursor/cache helpers in-repo. Middleware wiring and live load
tests are follow-on work (BB-049, BB-059).  
**Depends on:** [BB-025 rate limits](./rate-limits.md), [ADR-008 search](../adr/ADR-008-search-and-geocoding.md)  
**Threats:** [T-02](./threat-model.md#t-02-cost-exhaustion-via-search-and-geocoding), [T-13](./threat-model.md#t-13-database-exhaustion-and-connection-starvation)

## Objective

Bound search cost before Firestore reads: approved query shapes only, no user SQL/sort/field
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
| Firestore statement budget | 4 s |
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

Cloud SQL `statement_timeout` remains **deferred** (ADR-011); document only until SQL search paths exist.

## BB-025 integration

`searchQueryEndpointMetadata` exports `endpointClass: 'search'` and `costTier: 'expensive_read'`
for rate-limit guards without modifying the BB-025 evaluator.

## Validation

```bash
pnpm --filter @black-book/security test
pnpm --filter @black-book/api-public test
pnpm --filter @black-book/security typecheck
pnpm --filter @black-book/api-public typecheck
```

## Remaining live work

1. Wire `createPublicSearchGuard` into Cloud Run middleware (after App Check + rate limits).
2. Firestore query builder consuming `CanonicalSearchQuery` only (BB-049).
3. Slow-query telemetry export to BB-034.
4. Live load / fuzz under BB-059 against staging.
