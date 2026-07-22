<!--
  Supabase Pro cost envelope for the data-landscape capitalization epic (repo-2ztn,
  WS1 / repo-2ztn.2). Records org-level Pro pricing for up to three Micro projects,
  disk and egress headroom against the live corpus, hard spend defaults, soft-shutdown
  tier ordering tied to resource-controls policy, and PostgREST egress guidance for
  published-read surfaces. Does not authorize live Supabase changes, PITR, or branching.
-->

# Supabase Pro cost envelope (× three Micro projects)

**Purpose:** Durable cost and traffic envelope for Supabase under the data-landscape capitalization program. Supersedes the summary table in [black-history-data-landscape-intake.md §5](./black-history-data-landscape-intake.md#5-cost-envelope-supabase-pro--three-projects) with pricing math, egress modeling, and operational defaults.

**Date:** 2026-07-21  
**Branch:** `research/data-landscape-capitalization`  
**Epic:** `repo-2ztn` · **Workstream:** WS1 (`repo-2ztn.2`)  
**Live project (today):** `blackstory-app` (`twykhihqkcldpreuovay`, `us-west-2`) — see [`supabase/README.md`](../../supabase/README.md)

---

## 1. Org pricing: Pro base + Micro compute

Supabase **Pro** is billed at the **organization** level. Compute is priced per project; the org includes a compute credit that fully covers **one** Micro instance. Additional Micro projects are incremental.

| Line item | Monthly cost | Notes |
|---|---|---|
| Pro org base | **$25** | Platform fee; includes Pro features (daily backups, 8 GB disk/project, 250 GB egress/project, etc.) |
| Compute credit | **−$10** (included) | Offsets one Micro instance |
| **First Micro project** | **≈ $0 incremental compute** | Credit covers one Micro |
| **Each additional Micro** | **≈ +$10** | Second and third projects on Micro only |
| **Three Micro projects (typical ceiling)** | **≈ $35/mo total** | $25 base + ~$10 for two extra Micros after credit — **not** $25 flat |

**Interpretation:** Treat **$35/mo** as the planning figure when running production + staging + one optional preview/internal Supabase project, each on **Micro** only. A single live project (`blackstory-app`) sits at **~$25/mo** until a second or third Micro is provisioned.

**Not in envelope:** Team/Enterprise tiers, Large compute, read replicas, IPv4 add-ons, overage charges beyond included disk/egress, or paid Supabase branching/PITR.

---

## 2. Disk and egress headroom (live corpus)

Verified against `blackstory-app` on 2026-07-21 (see intake §1):

| Resource | Pro included (per project) | Current usage | Headroom |
|---|---|---|---|
| Database disk | **8 GB** | **~260 MB** | ~97% free — ample for embeddings, captures, and reference loads in the near term |
| Egress | **250 GB / month** | Not yet traffic-bound at current scale | **Primary cost risk** once PostgREST published-read is marketed |

**Corpus context:** ~1,103 rows in `bb_public.release_entities` / `bb_public.search_index`; private schemas (`bb_canonical`, `bb_evidence`, etc.) remain closed to `anon`. Disk growth from pgvector embeddings and capture metadata is manageable within 8 GB for this program phase; **egress**, not disk, is the constraint that binds at 1k–10k active API consumers.

---

## 3. Hard defaults (this program)

These defaults apply to **all** Supabase projects under this epic unless the owner explicitly approves an exception in writing.

| Default | Setting | Rationale |
|---|---|---|
| **Spend caps** | **ON** | Org/project spend limits and billing alerts before overage |
| **Compute size** | **Micro only** | Matches $35/mo three-project envelope; no Large/16XL scale-up |
| **PITR** | **OFF** | Point-in-time recovery is a paid add-on; daily backups suffice for this phase |
| **Branching** | **OFF** | Supabase branching adds compute cost and ops surface; use migrations + staging project instead |
| **Research LLM** | Free/local/hybrid only | No paid model APIs in the acquisition loop by default |
| **Adapters** | Fixture-first, disabled until approved | Avoids surprise fetch/OCR spend |
| **Bulk OCR** | **No campaigns** | NRHP MPL and similar sources stay fixtures-first |

**Explicit non-goals:** Enabling PITR, provisioning branching previews, or upgrading compute without a new cost envelope and ADR amendment.

---

## 4. Soft shutdown: `optional_research` before `public_serving`

Under budget or abuse pressure, **optional research workloads stop before public historical serving**. Public corpus auto-disable is forbidden unless an operator explicitly chooses it.

### Policy source

| Document / code | What it defines |
|---|---|
| [`docs/security/cost-resource-controls.md`](../security/cost-resource-controls.md) | Workload tiers, shutdown priority table, acceptance mapping |
| [`packages/security/src/resource-controls.ts`](../../packages/security/src/resource-controls.ts) | `DEFAULT_SOFT_SHUTDOWN_POLICY`, `evaluateSoftShutdown`, `assertShutdownOrdering` |

### Tier ordering (from policy)

| Tier | Examples | Under pressure |
|---|---|---|
| `optional_research` | Research campaigns, URL fetch, discovery runs | **Shutdown first** |
| `essential_ops` | Submissions, internal jobs, publication pipeline | Second (throttled at high budget %) |
| `public_serving` | Web, `api-public`, PostgREST published reads | **Preserved** — never auto-disabled |

`DEFAULT_SOFT_SHUTDOWN_POLICY` in code:

```typescript
{
  autoDisablePublicCorpus: false,
  shutdownOrder: ['optional_research', 'essential_ops'],
  preserveTiers: ['public_serving'],
}
```

`evaluateSoftShutdown` denies `optional_research` dispatch when daily budget crosses the research soft threshold; `public_serving` tiers continue unless a separate hard-stop explicitly targets non-preserved tiers. `assertShutdownOrdering` enforces that `optional_research` appears before `essential_ops` in `shutdownOrder` and that `public_serving` remains in `preserveTiers`.

**Cross-environment note:** Per [`docs/security/environment-isolation.md`](../security/environment-isolation.md), automated billing kill-switch is acceptable on internal/staging GCP projects only — **never** on production public serving. Supabase spend caps complement but do not replace GCP soft-shutdown evaluators.

---

## 5. Egress model: published-view PostgREST

**Chosen read surface:** PostgREST (Supabase Data API) over narrow **published** views — active-release entities and search rows only; RLS grants `anon` **SELECT** on those views, not on `bb_canonical`, `bb_research`, or draft tables. See intake §4 and future superseding ADR (WS10).

### 5.1 What counts as egress

Supabase meters **bytes leaving the project** toward clients. Every PostgREST response body, GraphQL-equivalent REST payload, and Realtime push counts. Internal server-side reads via `DATABASE_URL` from App Hosting / Cloud Run **do not** traverse the Supabase egress meter the same way as anon Data API calls from the public internet.

### 5.2 Order-of-magnitude traffic math

Planning assumptions (conservative for API integrators, not for CDN-cached static artifacts):

| Variable | Planning value |
|---|---|
| Published entity count | ~1.1k today; model to **10k** for stress |
| Typical list/search response (JSON, compressed on wire) | **20–80 KB** per page (50 rows, selective columns) |
| Typical entity detail response | **2–15 KB** |
| “Chatty” integrator session | **50–200** API calls per user per day (pagination + detail fan-out) |

**Scenario A — 1,000 daily active API integrators (chatty):**

- 1,000 × 100 calls/day × 40 KB avg ≈ **4 GB/day** ≈ **120 GB/month** — within 250 GB if average payload stays small and compression holds.

**Scenario B — 10,000 daily active integrators (chatty, uncached):**

- 10× Scenario A ≈ **1.2 TB/month** — **exceeds included 250 GB by ~5×**; overage or architectural change required.

**Scenario C — 10,000 users via CDN-cached release artifacts (preferred):**

- Immutable release JSON/GeoJSON under versioned paths (ADR-004 pattern) served from Firebase Hosting/CDN with `Cache-Control: public, max-age=31536000, immutable` — **Supabase egress ≈ build/publish pipeline only**, not per-user fan-out. See ADR-013 / ADR-025 egress models for map/search static assets.

The envelope **assumes Scenario C for product-scale traffic** and treats Scenario B as a **failure mode** to detect via spend alerts and rate limits.

### 5.3 Anti-patterns (discourage chatty anon fan-out)

| Anti-pattern | Why it burns egress |
|---|---|
| Unbounded `limit=1000` pagination loops over `release_entities` | Full corpus download repeated per client |
| N+1 detail fetch (list IDs, then one GET per entity) | Multiplies requests and headers |
| Polling search every few seconds | No cache benefit; hits PostgREST continuously |
| Embedding full claim/citation graphs in public views | Inflates payload size beyond published projection |
| Client-side “sync entire database” scripts | Treat as bulk export abuse; offer release artifact instead |

### 5.4 Preferred patterns (CDN + cache discipline)

| Pattern | Guidance |
|---|---|
| **Release-versioned static exports** | Publish immutable JSON/NDJSON/GeoJSON to GCS/Firebase Hosting; integrators fetch `{releaseId}` paths, not live DB pagination |
| **HTTP caching on read-only views** | Where PostgREST must be used, front with a cache (CDN or `api-public` BFF) and short TTL + ETag for list endpoints |
| **Narrow views + column selection** | `select=id,display_name,kind,precision,…` — never `select=*` on wide rows |
| **Cursor/range pagination with caps** | Enforce max page size in RLS-adjacent docs and rate limits ([`docs/security/rate-limits.md`](../security/rate-limits.md)) |
| **Dual surface** | Mobile/App Check → `apps/api-public`; open developers → PostgREST or cached artifacts — collapse only if measured cheaper |
| **Bulk export endpoint (future)** | One signed URL per release, not 10k row GETs |

**Operator bar:** Do not market the “Black history API” (PostgREST or MCP) until geo + capture quality gates pass (intake §3, WS10). Marketing before cache/export discipline is in place invites Scenario B.

---

## 6. Three-project topology (planning map)

Today only **`blackstory-app`** is live. The **$35/mo** envelope reserves room for:

| # | Planned role | Compute | Notes |
|---|---|---|---|
| 1 | **Production** (`blackstory-app`) | Micro | SoR; published views; App Hosting `DATABASE_URL` reads |
| 2 | **Staging** (future Supabase project) | Micro | Synthetic/mirror data; `minInstances: 0` consumers where possible |
| 3 | **Preview / internal** (optional) | Micro | Migration dry-runs, operator experiments — **no** PITR/branching |

Aligns with GCP three-project isolation ([ADR-012](../adr/ADR-012-production-environment-resplit.md), [`environment-isolation.md`](../security/environment-isolation.md)) but **Supabase billing is separate** — each Postgres project consumes one Micro slot toward the $35 figure.

---

## 7. Monitoring and acceptance hooks

| Signal | Action |
|---|---|
| Supabase dashboard egress trending > **60%** of 250 GB mid-month | Review integrator traffic; enable/cache static release exports |
| Egress > **80%** | Throttle anon PostgREST rate limits; pause research (`pause_research` automated response) |
| Compute sustained > Micro CPU limits | **Do not** auto-upgrade — optimize queries/views first |
| New Supabase project requested | Confirm it fits three-Micro/$35 envelope or revise this doc |

**Validation (GCP side, already in-repo):**

```bash
pnpm --filter @repo/security test   # assertShutdownOrdering, evaluateSoftShutdown
```

---

## 8. References

- [Black history data landscape intake §5](./black-history-data-landscape-intake.md#5-cost-envelope-supabase-pro--three-projects)
- [Cost and resource exhaustion controls](../security/cost-resource-controls.md)
- [`packages/security/src/resource-controls.ts`](../../packages/security/src/resource-controls.ts)
- [ADR-020 Supabase Postgres SoR](../adr/ADR-020-supabase-postgres-system-of-record.md)
- [Postgres schema](../data/postgres-schema.md)
- [Rate limits](../security/rate-limits.md)
