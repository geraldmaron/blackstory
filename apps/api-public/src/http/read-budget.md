# Read budget — `@repo/api-public` `/v1` (historical)

This report documented deterministic Firestore doc-read budgets for the legacy Firestore read path
(`firestore-data-access.ts`, `firestore-read-budget.ts`). That path was removed in repo-348e.3 —
Postgres (`./postgres-data-access.ts`) is now the only live data-access adapter, and "billed
document reads" is not the right cost model for it (it issues bounded SQL queries against
`bb_public.*` instead of per-document Firestore reads).

The bounded-scan caps that still apply carry over unchanged and now live in
`./projection-mapping.ts`:

| Constant | Value | Effect |
|----------|------:|--------|
| `MAX_LIVE_SEARCH_SCAN` | 500 | Entity fallback scan reads at most 500 projections per search request when no `publicSearchIndex` rows exist for the release |

HTTP-level pagination guardrails (`@repo/security` `DEFAULT_QUERY_GUARDRAIL_LIMITS`) are unchanged:

| Constant | Value | Effect |
|----------|------:|--------|
| `maxPageSize` | 50 | Max HTTP `pageSize`; bounds in-memory slice only |
| `maxPaginationDepth` | 20 | Max cursor depth; bounds in-memory slice only |
| `maxEstimatedCost` | 2,500 | Guardrail cost ceiling (policy metadata, not a storage cost) |

A follow-up Postgres-native query-cost budget (row counts / query plan cost per endpoint) is tracked
as future work, not reconstructed here from stale Firestore numbers.
