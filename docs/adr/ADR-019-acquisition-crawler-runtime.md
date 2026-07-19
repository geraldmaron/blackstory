# ADR-019: Acquisition crawler runtime

- **Status:** Accepted
- **Date:** 2026-07-19
- **Depends on:** ADR-007 (background workflow), ADR-009 (research isolation), ADR-018 (scheduled discovery triggers)
- **Does not supersede:** ADR-009 §4 (adapters remain libraries/jobs under `workers/research`, not a microservice fleet); ADR-010 (untrusted URL handling); selective snapshot policy in `packages/domain/src/provenance/capture.ts`

## Context

BlackStory acquires evidence through a layered model that already exists in the monorepo:

1. **Canonical contracts and schemas** — TypeScript types in `packages/domain/src/adapters/` and JSON Schemas in `packages/schemas/` (e.g. `adapters/candidate-record.v1.schema.json`, `discovery/discovery-candidate.v1.schema.json`).
2. **Direct source adapters** — curated API, bulk-export, RSS/Atom, and search adapters under `packages/domain/src/adapters/{rss,wikimedia,federal,dpla,web-search,...}` with registry gates in `packages/domain/src/adapters/registry.ts` and `gates.ts`.
3. **Safe outbound HTTP** — SSRF-hardened, bounded single-URL fetch via `executeSafeFetch` (`packages/security/src/url-safety/fetch.ts`), wired for operator intake in `packages/operator-cli/src/fetch.ts`, and mirrored in Python at `workers/security/src/black_book_security/url_fetch/worker.py`.
4. **Adapter HTTP port** — dependency-injected `SafeHttpClient` with retry/backoff in `packages/domain/src/adapters/internet-archive/shared/http-port.ts`; consumed by RSS (`packages/domain/src/adapters/rss/fetch-feed.ts`), Internet Archive, and Wayback SPN (`packages/domain/src/adapters/internet-archive/wayback/capture-gate.ts`).
5. **Research orchestration** — Python discovery pipeline in `workers/research/src/black_book_research/discovery/pipeline.py`, with dedup/hashing paralleling TS (`workers/research/.../deduplication.py`, `packages/domain/src/discovery/hashing.ts`).

Today there is **no general HTML crawl orchestrator**: no robots.txt parser, no sitemap walker, no per-domain scheduler, no conditional GET cache, and no pause/resume checkpoint store. `executeSafeFetch`'s sandbox parser (`parseContentInSandbox` in `packages/security/src/url-safety/fetch.ts`) strips tags with regex — adequate for citation prefill, not for claim extraction. Scheduled discovery (ADR-018) dispatches **adapter campaigns** (RSS, Wikimedia, federal exports, web search), not open-web recursion.

We must choose a runtime for **recurring, bounded HTML acquisition** (institutional sites, historical society pages, program briefs that name HTML crawl as an access method — see `docs/research/black-women-in-stem-source-identification.md`) without duplicating domain contracts or violating research isolation.

## Research summary (2026-07-19)

Evaluated against repo evidence and one-developer maintenance on branch `redesign/brand-map-beads`.

| Criterion | Current TS safe-fetch + adapters | Python Scrapy + Trafilatura | TypeScript Crawlee | Minimal internal crawler on existing primitives |
|-----------|----------------------------------|----------------------------|--------------------|------------------------------------------------|
| **robots.txt / crawl-delay** | Not implemented; URL policy only (`packages/security/src/url-safety/policy.ts`) | Built-in `ROBOTSTXT_OBEY`, per-spider rules | Playwright/Cheerio paths vary; robots not first-class in repo | Must build from scratch on every adapter |
| **sitemap / feed discovery** | RSS/Atom adapter + feed registry (`packages/domain/src/adapters/rss/`); no sitemap consumer | Sitemap spider + feed extensions | Manual; no repo precedent | Manual per source |
| **per-domain scheduling / throttling** | Contract `rateLimits` on `SourceAdapterContract` (`packages/domain/src/adapters/types.ts`); enforced at adapter call sites, not crawl frontier | AutoThrottle, per-domain delays, concurrent requests | RequestQueue + concurrency options; new dependency tree | Reinvent scheduler + domain buckets |
| **backpressure / pause-resume** | Campaign budgets in discovery config (`workers/research/.../pipeline.py`); kill switches (`packages/domain/src/adapters/federal/shared/kill-switch.ts`); no crawl checkpoint | Persistent job dir, pause/resume via scheduler state | Dataset storage; ops heavier than Scrapy for batch | Fragile without durable frontier store |
| **conditional requests (ETag/Last-Modified)** | Not in `SafeHttpClient` or `executeSafeFetch` | Downloader middleware + HTTP cache | Possible via hooks; not shipped | Manual header plumbing per fetch |
| **retry / dedup** | `withRetry` on `SafeHttpClient` (`http-port.ts`); content/run fingerprints (`packages/domain/src/discovery/hashing.ts`, `packages/domain/src/provenance/capture.ts`) | Retry middleware + dupefilter | Built-in retry; separate from domain dedup | Partial reuse of `withRetry` only |
| **capture replay / provenance** | `SourceCapture`, `buildCaptureAfterDedup` (`packages/domain/src/provenance/capture.ts`); Wayback SPN gate for selective archival (`wayback/capture-gate.ts`) | Store raw response + hash; map to existing capture chain in worker | Same mapping work; Crawlee storage format ≠ domain schema | Same mapping work |
| **HTML extraction quality** | Regex strip in safe-fetch sandbox; claim extraction is separate, deterministic Python (`workers/research/src/black_book_research/extraction/`) | **Trafilatura** (main-text, metadata, JSON-LD) | Cheerio/Playwright parsing; maintain selectors | Regex-level quality persists |
| **JS-rendered pages** | Explicitly rejected in sandbox (`active_content` malware indicator) | Static HTTP by default; Playwright optional | Playwright-first option | Would require headless browser |
| **ops footprint** | Already deployed paths: Functions/Jobs (ADR-007/018), `@repo/security` | Add Scrapy+Trafilatura to `workers/research` uv workspace; one container | New Node crawl fleet + browser images if Playwright | Hidden cost in bespoke scheduler bugs |
| **Python research worker compatibility** | Adapters produce TS-validated records; Python pipeline already ingests `AdapterCandidateRecord` shapes | Natural fit: spider emits JSON validated against `packages/schemas/` via `black-book-constitution` | Parallel Node runtime; duplicate orchestration | Python-only glue still needed |
| **TS schema compatibility** | **Canonical** — `@repo/domain` + `packages/schemas/`; Python loads same files (`packages/constitution/src/black_book_constitution/load.py`) | Spiders output schema-validated payloads before TS promotion | Crawlee-native storage ≠ domain contracts without adapter layer | Same |
| **one-developer maintenance** | Low for API/RSS paths (proven) | Low for crawl mechanics (battle-tested libs) | Medium–high (browser ops, dual runtime) | High (permanent custom queue/robots/sitemap work) |

### What the repo already proves

- **Keep TS adapters for structured sources.** Federal exports, Wikimedia API, DPLA, RSS, web search, and census/geo clients live in `packages/domain/src/adapters/` with matching Python mirrors under `workers/research/src/black_book_research/adapters/`. These are not replaced by a crawler.
- **Safe fetch is for untrusted single URLs, not crawl graphs.** `executeSafeFetch` and the Python fetch worker enforce pinned DNS, redirect re-validation, size/time limits, and quarantine — correct for operator quick-add (`packages/operator-cli/src/fetch.ts`) and security jobs, insufficient alone for institutional crawl campaigns.
- **No Crawlee or Scrapy in tree today.** `workers/research/pyproject.toml` depends only on `black-book-constitution`; `pnpm-lock.yaml` references Playwright only under `@repo/testing` a11y tooling — not acquisition.
- **Headless browser bypass is out of scope.** ADR-009 and `parseContentInSandbox` treat script-bearing HTML as unsafe for automatic ingestion; using Playwright to evade robots, paywalls, or bot checks violates product posture (`docs/runbooks/pre-launch-operator-protection.md` treats robots as courtesy + real controls, not something to defeat).

## Decision

1. **Canonical contracts stay TypeScript-first:** `packages/domain` types and `packages/schemas/*.schema.json` remain the source of truth; Python workers validate outputs against those schemas via `black-book-constitution` before writing research staging.
2. **Direct TypeScript adapters** (API, bulk export, RSS/Atom, search, curated feeds) remain the default for structured sources — implemented through `SafeHttpClient` / campaign dispatch, not Scrapy.
3. **Recurring HTML crawl orchestration runs in the Python research worker** (`workers/research`), scheduled via ADR-018 Functions or ADR-007 Cloud Run Jobs, under the research service account (ADR-009).
4. **Scrapy** is the standard engine for HTML crawl campaigns: robots.txt, sitemap/seed URL discovery, per-domain concurrency, retries, throttling, and durable crawl state.
5. **Trafilatura** is the standard main-text/metadata extractor for HTML captures; extracted text feeds existing Python extraction/claim helpers (`workers/research/src/black_book_research/extraction/`) and is hashed for dedup consistent with `hashCandidateContent` (`packages/domain/src/discovery/hashing.ts`).
6. **Bridge pattern:** each Scrapy spider emits **`AdapterCandidateRecord`-compatible JSON** (validated against `packages/schemas/adapters/candidate-record.v1.schema.json`) plus optional raw HTML stored in quarantine object storage with `contentHash` wired into `SourceCapture` / `buildCaptureAfterDedup` — never auto-publish.
7. **Untrusted URL fetches inside crawl jobs** that leave the Scrapy downloader (e.g., one-off security re-check) continue to use the **Python safe-fetch worker** (`workers/security/.../url_fetch/worker.py`) or TS `executeSafeFetch` in operator tooling — not raw `requests`/`fetch`.
8. **Playwright / headless browsers are forbidden** for acquisition unless a **named, approved, high-value source** documents a JS requirement in its adapter contract and passes rights review; never to bypass access restrictions, robots, or rate limits.
9. **Conditional GET and crawl checkpointing** are implemented as Scrapy downloader middleware backed by Firestore or object-store frontier state (implementation bead), not by extending `executeSafeFetch`.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| **TypeScript Crawlee as primary HTML crawl runtime** | Adds a second Node crawl fleet beside existing Python research workers; Playwright temptation; duplicates scheduling already solved by Scrapy; no repo scaffold; higher ops burden for one developer. |
| **Minimal internal crawler on `SafeHttpClient` + queues** | Reimplements robots, sitemap parsing, AutoThrottle, dupefilter, and pause/resume that Scrapy ships; high maintenance, easy to get SSRF or rate-limit bugs wrong despite `http-port.ts` primitives. |
| **Extend `executeSafeFetch` into a recursive crawler in TS** | Wrong layer — single-URL quarantine fetch (`packages/security/src/url-safety/fetch.ts`) lacks frontier state; would bloat `@repo/security` with crawl policy unrelated to SSRF defense. |
| **Playwright-by-default for HTML sources** | Violates sandbox/active-content policy; browser fleet cost; encourages bypassing institutional access controls — explicitly forbidden above. |
| **Scrapy-only world (retire TS adapters)** | Repo already invested in typed adapters, JSON Schemas, and RSS/API paths (`packages/domain/src/adapters/`); APIs and feeds are simpler and safer without a crawl engine. |
| **Python `requests`/`httpx` spider without Scrapy** | Loses robots/sitemap/throttle/dedup middleware; repeats Scrapy’s feature set poorly. |
| **Headless browser to bypass robots or blocks** | Violates research ethics, ADR-009 isolation intent, and operator runbook posture; never approved. |

## Consequences

- Add `scrapy` and `trafilatura` to `workers/research/pyproject.toml` when the first HTML-crawl adapter bead lands; pin versions in the uv workspace lockfile.
- New HTML sources require: adapter contract in registry (`packages/domain/src/adapters/registry.ts`), rights entry in `external-data-sources.ts` or source brief, Scrapy spider + Trafilatura pipeline module under `workers/research/src/black_book_research/crawl/`, schema validation before ingestion.
- TS operator CLI and admin quick-add continue using `packages/operator-cli/src/fetch.ts` → `executeSafeFetch` for **manual** URL intake; they do not embed Scrapy.
- Conditional GET and crawl resume become explicit middleware work items; until shipped, campaigns rely on full re-fetch bounded by adapter `rateLimits` and campaign budgets.
- Observability: Scrapy stats + existing discovery run fingerprints (`stampDiscoveryReproducibility`) must align for audit replay.
- Testing: spider contract tests with fixtures (pattern: `packages/domain/src/adapters/rss/fixtures/`, `workers/research/.../adapters/federal/*/fixtures/`); no live network in CI.

## Migration triggers

- Introduce Scrapy when a approved source brief lists **HTML crawl** or sitemap walk as the access method and no stable API/feed exists.
- Revisit Playwright only with written custodian approval, JS requirement evidence, and a dedicated security review bead — not for general crawl.
- Move a crawl campaign from Functions to Cloud Run Jobs when runtime exceeds ADR-018 scheduled limits or frontier storage exceeds Function memory (same escalation pattern as ADR-018).

## Rollback considerations

- Disable spider via adapter kill switch (`adapter:<adapterId>` — `packages/domain/src/adapters/federal/shared/kill-switch.ts`) and research campaign kill switch without touching public surfaces.
- Fall back to manual operator fetch + curated RSS/API adapters only; quarantine already-ingested captures remain deduped by hash.
- Removing Scrapy does not affect existing API/RSS/federal adapter paths.
