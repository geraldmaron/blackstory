# Firestore read budget — `@repo/api-public` `/v1` (MOB-004)

Deterministic worst-case Firestore read counts for the live public read API. Counts are enforced by
`firestore-read-budget.test.ts` using an injectable recording Firestore fake — not live load tests.

## Summary table

| Endpoint | Path | Worst-case Firestore doc reads | Query operations | Notes |
|----------|------|-------------------------------:|-----------------:|-------|
| Bootstrap | `GET /v1/bootstrap` | **1** | 0 | `publicMeta/activeRelease` only |
| Entity | `GET /v1/entity/:id` | **2** | 0 | Active release pointer + one entity projection |
| Search (artifact) | `GET /v1/search` | **1** | 0 | Index from release `search-index.json` (HTTPS); no Firestore index query |
| Search (index-backed) | `GET /v1/search` | **1 + N** | **⌈N / 400⌉** | Loads **entire** release index into memory before in-memory pagination |
| Search (fallback scan) | `GET /v1/search` | **1 + min(E, 500)** | **2** | Empty index probe + bounded entity collection scan |

**Legend:** N = release-scoped `publicSearchIndex` row count; E = entity projection count in the
active release.

Measured max reads from tests (deterministic fixtures):

| Scenario | `docGets` | `queryGets` | `documentsRead` | Test |
|----------|----------:|------------:|----------------:|------|
| Bootstrap | 1 | 0 | 1 | `read budget: GET /v1/bootstrap reads exactly one Firestore doc` |
| Entity | 2 | 0 | 2 | `read budget: GET /v1/entity/:id reads release pointer + one entity doc` |
| Search artifact | 1 | 0 | 1 | `read budget: search with artifact uses zero Firestore index queries` |
| Search index (817 docs) | 1 | 3 | 818 | `read budget: index-backed search loads full release index with paginated queries` |
| Search fallback (600 entities) | 1 | 2 | 501 | `read budget: entity-scan fallback probes index then scans MAX_LIVE_SEARCH_SCAN entities` |

Run: `pnpm --filter @repo/api-public test` (includes `firestore-read-budget.test.ts`).

## Documented caps

| Constant | Value | Source | Effect |
|----------|------:|--------|--------|
| `MAX_LIVE_SEARCH_SCAN` | 500 | `firestore-data-access.ts` | Entity-collection fallback reads at most 500 projections per search request |
| `SEARCH_INDEX_PAGE_SIZE` | 400 | `firestore-data-access.ts` | Firestore `publicSearchIndex` pagination page size (matches web readers) |
| `maxPageSize` | 50 | `@repo/security` `DEFAULT_QUERY_GUARDRAIL_LIMITS` | Max HTTP `pageSize`; bounds in-memory slice only |
| `maxPaginationDepth` | 20 | `@repo/security` | Max cursor depth; bounds in-memory slice only |
| `maxEstimatedCost` | 2,500 | `@repo/security` | Guardrail cost ceiling (policy metadata, not Firestore billing) |

**Important:** HTTP pagination (`pageSize` × `depth`, max window 1,000) does **not** reduce
Firestore index fetches. Index-backed search always loads the full release index (paginated at 400
docs/query) before `@repo/domain`'s `runPublicSearch` slices results in memory.

## Per-endpoint detail

### `GET /v1/bootstrap`

1. `firestore.doc(publicMeta/activeRelease).get()` → **1 read**

No entity or index access. Cached (`max-age=30, swr=120`).

### `GET /v1/entity/:id`

1. `getReleasePointer()` → **1 read** (active release)
2. `getEntity(releaseId, id)` → **1 read** (entity projection)

No related-entity hydration (N+1 explicitly avoided in `firestore-data-access.ts`).

### `GET /v1/search`

Handler sequence:

1. `getReleasePointer()` → **1 read**
2. `loadReleaseSearchIndexForSearch()` — artifact-first, then Firestore index:

**Artifact path (preferred):** `fetchReleaseSearchIndexArtifact(releaseId)` over HTTPS/GCS.
**0 Firestore index queries.** Total: **1 doc read**.

**Index path:** Paginated `publicSearchIndex` query (`releaseId == active`, `orderBy __name__`,
`limit 400`). Worst case: **⌈N / 400⌉** query pages, **N** index document reads, plus **1** release
pointer doc → **1 + N** total billed reads.

**Fallback path** (no artifact rows and no index rows):

1. Index probe (empty) → **1 query**, 0 docs
2. `publicReleases/{releaseId}/entities` with `.limit(500).get()` → **1 query**, up to **500** docs

Total: **1 + min(E, 500)** document reads, **2** query operations.

Fallback search is free-text only with empty facets (`searchOverEntities`).

## Kill-switch and degraded modes

| Signal | Effect on reads |
|--------|-----------------|
| `PUBLIC_READ_API_DISABLED=1` | Empty in-memory adapter — **0 Firestore reads** (503/empty responses) |
| `PUBLIC_DATA_SOURCE=fixtures\|seed` | In-memory adapter — **0 Firestore reads** |
| Live gate false (no break-glass) | Same as fixtures — **0 Firestore reads** |
| `APP_CHECK_OUTAGE_OVERRIDE=outage` | Search rate quota degrades (~¼ caps); **read counts unchanged** |
| App Check `app_check_required` (429) | Request denied before data access — **0 Firestore reads** |
| Search guardrail deny (400) | Request denied before data access — **0 Firestore reads** |

## Instrumentation

- **`firestore-read-budget.ts`** — caps, budget helpers, `createRecordingFirestoreClient`
- **`firestore-read-budget.test.ts`** — handler-level assertions against documented budgets
- **`firestore-data-access.integration.test.ts`** — emulator-backed fallback cap (when emulator up)

## Open items (repo-rw1p)

Independent reviewer sign-off on authorization, redaction, and cost paths remains open. This report
closes the **deterministic read-budget evidence** gap only.
