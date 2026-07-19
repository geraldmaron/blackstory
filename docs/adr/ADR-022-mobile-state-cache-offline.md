# ADR-022: Mobile client state, SQLite cache policy, and offline-read contract

- **Status:** Proposed
- **Date:** 2026-07-19
- **Bead:** MOB-002 (architecture, threat model, contract boundary ADRs)
- **Depends on:** ADR-004, ADR-008, ADR-013, ADR-020, ADR-021
- **Blocks:** MOB-009, MOB-012

## Scaffold vs target

| Aspect | Today (this bead) | Target (MOB-009 / MOB-012) |
|--------|-------------------|----------------------------|
| State management | No `apps/mobile` app exists yet; decision only | TanStack Query (server cache) + Zustand (UI state) wired into the Expo app |
| Persistence | Engine chosen in ADR-020 (`expo-sqlite`); no schema | SQLite cache tables with the policy below, LRU eviction, release-stamp column |
| Offline behavior | None | Offline READ of previously-fetched content, with explicit staleness labelling and a degraded-mode indicator |
| Cache invalidation | None | Release-stamp comparison per ADR-021, per-artifact invalidation |

## Context

MOB-009 must give the native reader a typed API client, a SQLite cache, an offline mode, and a migration story. This ADR fixes the *policy* those pieces implement so the implementation bead does not re-litigate architecture mid-build. It sits under doctrine already set by sibling ADRs and must extend, not contradict, it:

- **ADR-004** (immutable publication snapshots): each publication is an immutable release with a signed manifest and an active-release pointer; rollback is a pointer switch, never a rebuild. The client cache is a *derivative* of these snapshots, never a system of record.
- **ADR-008** (bounded, static-first queries): approved query shapes only, no user-defined sort/field selection, cursor pagination, no persistent precise-location history. The mobile cache must not become a back door around any of these bounds.
- **ADR-013** (map stack): map artifacts are release-coupled static GeoJSON + aggregates that inherit ADR-004's snapshot/rollback for degraded mode ("there is no live map query in this design to disable"). Already-fetched viewport GeoJSON is exactly the kind of large, immutable-per-release artifact the cache must handle carefully on invalidation.
- **ADR-020** (mobile stack): storage engine is `expo-sqlite`. **This ADR does not re-decide the engine.**
- **ADR-021** (mobile data boundary): defines the release-stamp/version mechanism carried on API responses. This ADR consumes that stamp for cache invalidation and does not redefine it.

Program invariants that bind this decision (mobile-app-epic.md): invariant 4 (immutable releases, atomic activation, proven rollback), invariant 6 (client trust — a compromised client must gain no canonical write path), and **invariant 7 (privacy — no query text, correction content, precise location, or sensitive classifications in logs, crash reports, or persistent storage)**. The launch non-goal is explicit: no user accounts and no full offline basemap. "Offline mode" here therefore means **offline READ of previously-viewed content** (entities, evidence, search result sets, already-fetched map viewport data) — not an offline-first architecture and not a basemap download.

Operational reality: one maintainer, budget-capped, free-tier-first. The project's repeated posture (ADR-008→ADR-013) is narrow, reversible, low-ceremony choices deferred until measured need. State/cache tooling is judged on that axis, not on feature maximalism.

Package scope in this repo is **`@repo`** (brand-agnostic, never renamed — confirmed in `packages/config/src/identity.ts` and `docs/mobile/decisions/mobile-identity.md`), not `@black-book`.

## Decision

### 1. Client state management: TanStack Query (server state) + Zustand (UI-only state)

Two libraries, each with one job, and a hard line between them:

- **TanStack Query owns all server-derived state**: every read from `apps/api-public` (entities, evidence, timelines, search result sets, map artifacts) is a query with a stable key, a staleness policy, and a cache entry. Its persistence adapter is backed by SQLite (section 2). It already models exactly the concepts this product needs — `staleTime`/`gcTime`, background refetch, request de-duplication, `isStale`/`isFetching` flags that section 3's UX contract reads directly, and a persistence plug point — so we do not hand-roll a fetch/cache/invalidate loop.
- **Zustand owns UI-only client state**: current map viewport, active filters, sheet open/closed, theme-independent view toggles. This state is ephemeral by default and **never** the home for server data. Zustand is a ~1KB store with no provider ceremony and no boilerplate reducer layer.

**Rationale against the alternatives.** The project prefers narrow, reversible, low-ceremony choices operable by one maintainer:

- **vs. Redux Toolkit**: RTK Query would cover the server-state half, but Redux brings a store/slice/middleware ceremony and a mental model heavier than a one-maintainer reader app needs. TanStack Query is the better-fit server-cache primitive (it *is* a cache, not a general state container bolted into a cache role) and Zustand covers the small UI-state residue with far less code. Redux's main payoff — a single audited global store with time-travel/middleware — is value we are not buying.
- **vs. plain React Context**: Context has no caching, no staleness model, no background refetch, no de-duplication, and re-renders the whole subtree on every change. Rebuilding those on Context is precisely the hand-rolled fetch/cache loop TanStack Query exists to delete. Context remains fine for truly static injection (theme tokens, the API client instance) and we will use it there — but not as the data layer.

The boundary is the load-bearing decision: **server data lives only in TanStack Query (SQLite-backed); UI data lives only in Zustand (memory).** This keeps the privacy and invalidation rules (sections 2 and 4) enforceable in one place instead of scattered across a global store.

### 2. Cache policy over SQLite (engine fixed by ADR-020)

The SQLite database is a **derivative read cache**, never a system of record. The server (immutable releases per ADR-004) is always authoritative.

**What is cached (on disk):**

- Last-viewed **entities** and their **evidence**/timeline payloads.
- **Search result sets** — the ranked list of result references for an executed query, keyed as below (never the raw query text).
- **Already-fetched map viewport GeoJSON** and the release-scoped state/county aggregates (ADR-013 artifacts). These are immutable per release, which makes them ideal cache tenants and drives the per-artifact invalidation choice in section 4.

**TTL / staleness rules:**

- Every cache row stores `fetchedAt` and the response's **release stamp** (ADR-021).
- `staleTime` (when the client *prefers* a background refetch if online) is content-shaped, not one global number: entity/evidence ≈ 24h, search result sets ≈ 1h (results reorder more readily than entity facts), map artifacts ≈ release-lifetime (they are immutable per release, so the release stamp — not a clock — governs them; see section 4).
- Staleness is a **display and refetch** signal, not a delete signal. A stale row is still shown offline under the section 3 contract. Rows are removed only by eviction (below), by release-stamp invalidation (section 4), or by migration (section 5).
- `gcTime` for the in-memory TanStack layer is short (minutes); the durable tier is SQLite, sized below.

**Size ceiling and eviction:**

- **Hard ceiling: ~50 MB** of on-disk cache (excluding the app binary and any basemap assets, which are out of scope per the non-goal). Chosen to comfortably hold a heavy reading session — hundreds of entities plus several release-sized map artifacts — while staying a negligible fraction of device storage and cheap to drop wholesale.
- **Eviction: LRU by last access.** Each row carries a `lastAccessedAt` touched on read. When a write would exceed the ceiling, evict least-recently-accessed rows until back under it. Large map artifacts and small entity rows share one budget, so an active map session naturally ages out cold entity reads and vice versa — no per-type sub-quota to tune.
- Eviction is safe by construction because everything evictable is re-fetchable from the authoritative server; there is nothing to lose.

**NEVER cache to disk (invariant 7):**

- **Raw query text.** Search result sets are keyed by a **salted query-shape hash** — a hash of the *normalized, bounded query shape* (the approved fields/filters/radius/page per ADR-008), salted with a per-install random value, **never the literal query string**. The salt is stored in the OS keychain/keystore, not in the cache DB, so a lifted DB file cannot be dictionary-attacked back to queries. The human-readable query is held only in Zustand memory for the life of the search screen and is never written to SQLite.
- **Correction submission content.** Draft or submitted correction text/body is never persisted to the cache (it is also never queued offline — section 3). Only the opaque server receipt id/status (MOB-016) may be cached.
- **Precise location.** Device GPS coordinates, precise viewport centers used for a nearby query, and any raw coordinate are never written to disk. Cached map data holds only the already-server-redacted, release-coarsened coordinates that ADR-013's `redactLocationForPublic` boundary already produced — never a device-side precise fix.
- No sensitive entity classifications, logs, or crash-report payloads carry any of the above (invariant 7 restated for the persistence layer).

### 3. Offline-mode UX contract (behavioral, not visual)

This section fixes behavior; MOB-012/MOB-017 own the visual treatment.

1. **Explicit staleness labelling.** Any screen served wholly or partly from cache shows an explicit **"last updated <relative time>"** derived from the row's `fetchedAt`. Cached content is never rendered as if freshly fetched.
2. **Visible degraded-mode indicator.** When the app is offline (or the API is unreachable), a persistent, non-blocking degraded-mode indicator is shown app-wide. This mirrors ADR-013/ADR-004's degraded-mode posture: the reader keeps working from immutable snapshots, and the degraded state is announced, not hidden.
3. **Never present stale data as live.** The absence of a fresh fetch is always surfaced (via 1 and 2). Silent staleness is prohibited; if a background refetch fails, the stale label and indicator remain rather than the UI implying success.
4. **Correction submission is disabled, not silently queued.** While offline, the correction entry point (MOB-016) is disabled with a plain explanation ("connect to submit a correction"). We do **not** queue correction content for later send. This is deliberate: queuing would mean persisting correction content on-device (violating invariant 7 and section 2's never-cache list) and could silently submit stale or duplicate content later. Corrections require a live, attested round-trip.
5. Content the user never fetched while online is simply unavailable offline (empty/appropriate state) — this is an offline *read* cache, not a prefetch/sync engine.

### 4. Cache invalidation on release: per-artifact, keyed to the ADR-021 release stamp

Per program invariant 4 and ADR-004, each publication is a new immutable release; ADR-021 stamps API responses with the active release version. The client stores that stamp per cache row (section 2).

**Decision: invalidation is per-artifact, not global.**

- On any response (or a lightweight release-pointer check), the client compares the server's current release stamp against the stamp stored on the specific cache row it is about to use. If the row's stamp is behind the current release, that row is invalidated and refetched on next access; rows whose content is unchanged across the release keep serving.
- Where the server exposes it (ADR-021), an artifact-level or content-hash discriminator lets an unchanged artifact (e.g. a large map GeoJSON that did not move between releases) survive a release that only touched unrelated entities.

**Why per-artifact over global.** Global invalidation (one stamp governs the entire cache; any release advance drops everything) is simpler to implement and reason about. But BlackStory publishes immutable releases potentially often, and many releases will touch a small slice of content while leaving the large, release-coupled **map artifacts** (ADR-013 — up to the ~2 MB gzipped GeoJSON budget plus aggregates) byte-identical. Under global invalidation, every unrelated release would force a re-download of that unchanged map data on the next map open — the single worst refetch for a mobile user on cellular. Per-artifact invalidation avoids that avoidable cost while still guaranteeing correctness: a row is trusted only while its stamp matches, and rollback (an active-pointer switch to a prior release per ADR-004) is handled identically — the client simply sees a different current stamp and reconciles per row. The extra complexity is bounded (a stamp/hash comparison per row) and worth the avoided egress and battery.

Correctness guardrail: the client never *merges* releases within a single view. A screen renders from one release stamp; if constituent rows disagree, the newer-stamp fetch wins and the older row is refetched before display, so a user never sees a Frankenstein mix of two releases (consistent with ADR-004's atomic-activation guarantee).

### 5. Migrations: destructive drop-and-rebuild-from-network, not in-place ALTER

When the cache schema version changes (new columns, changed keying, new artifact types), the migration is: **drop the affected cache tables and rebuild from the network on demand.** No in-place `ALTER`/data-preserving migration is written.

**Rationale.** The SQLite store is a *derivative* cache, not a system of record — every row is re-fetchable from the authoritative server (ADR-004). Data-preserving migrations exist to protect irreplaceable local data; there is none here. Drop-and-rebuild is dramatically lower risk and complexity: no per-version ALTER ladder to author and test, no half-migrated corrupt-state class of bug, no risk of a migration bug silently poisoning cached content. The only cost is that the first post-upgrade session refetches, which is exactly the online, degradable path the app already handles. A cache-schema `userVersion` is stamped in SQLite; on mismatch the cache is rebuilt, not patched. (This is a cache decision only — it says nothing about the server's canonical data, which is never dropped.)

### 6. Reversal cost

- **Off Zustand → another UI-state store (or Context/Redux):** low. UI state is small, ephemeral, and touched by few components; the store is a thin module behind hooks. A swap is mechanical and local, with no persisted data to migrate.
- **Off TanStack Query → another server-cache layer:** moderate. Query keys, staleness config, and the SQLite persistence adapter are the surface area. Because the persistence format and privacy rules (sections 2, 4) are defined here independently of the library, a replacement re-implements the same policy against the same SQLite tables — the *contract* survives a library swap. It is more invasive than the Zustand swap because more of the app reads through it, but the disciplined server/UI boundary (section 1) keeps the blast radius to the data layer.
- **Changing the eviction policy (LRU) or the size ceiling later:** trivial and safe. Because the cache is derivative and fully re-fetchable, any eviction/ceiling change is at worst a one-time extra refetch — the same class of event as a migration (section 5). This is deliberately the lowest-cost knob in the design, so tuning it under real device/telemetry evidence (MOB-018) carries no lock-in.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Redux Toolkit (+ RTK Query) as the single store | Store/slice/middleware ceremony heavier than a one-maintainer reader needs; TanStack Query is a better-fit server cache and Zustand covers the small UI residue with less code. |
| Plain React Context as the data layer | No caching/staleness/de-duplication/background refetch; broad re-renders; would mean hand-rolling exactly what TanStack Query provides. Kept only for static injection (theme, client instance). |
| Cache raw query text keyed by the literal string | Violates invariant 7; a lifted DB file would leak user queries. Salted query-shape hash instead. |
| Queue correction submissions offline for later send | Requires persisting correction content on-device (invariant 7) and risks silent stale/duplicate submits; corrections need a live attested round-trip (section 3.4). |
| Global (whole-cache) release invalidation | Simpler, but forces re-download of unchanged large map artifacts on every unrelated release — the worst mobile refetch. Per-artifact chosen (section 4). |
| In-place ALTER cache migrations | Needless risk/complexity for a re-fetchable derivative cache; drop-and-rebuild is lower risk (section 5). |
| Full offline-first sync / offline basemap | Explicit launch non-goal (mobile-app-epic.md); this is an offline *read* cache of previously-viewed content only. |
| Unbounded cache | No size ceiling risks unbounded device-storage growth; ~50MB LRU ceiling instead. |

## Consequences

- MOB-009 implements against a fixed contract: TanStack Query + Zustand, a SQLite persistence adapter honoring the section 2 policy, the section 3 offline contract, per-artifact release-stamp invalidation, and drop-and-rebuild migrations.
- The salted query-shape hashing and keychain-stored salt become a testable privacy invariant (a regression test asserting no literal query/correction/precise-coordinate string ever reaches SQLite, analogous to ADR-013's `map-source.redaction.test.ts`).
- The size ceiling, per-content `staleTime` values, and LRU behavior are tuning knobs to validate against real device telemetry under MOB-018, not frozen numbers.
- This ADR consumes ADR-021's release-stamp contract; if ADR-021 lands a different stamp shape (e.g. content hashes vs. a monotonic version), section 4's comparison adapts to it without changing this ADR's per-artifact decision.

## Migration triggers

- Revisit per-artifact invalidation only if ADR-021's stamp granularity makes per-artifact comparison impossible or if telemetry shows the added complexity buys negligible egress savings (then fall back to global).
- Reconsider the ~50MB ceiling / LRU policy only under measured device-storage or hit-rate evidence (MOB-018) — a low-cost, reversible change by design.
- Reconsider "no offline queue for corrections" only if a future ADR explicitly changes the privacy posture on persisting correction content (it would have to supersede invariant 7).
- Reconsider adding an offline prefetch/sync or basemap download only through MOB-022's measured-upgrade gate, which governs the launch non-goals.

## Rollback considerations

- A release rollback (ADR-004 active-pointer switch) needs no cache-specific code: the client sees a different current release stamp and reconciles per row under section 4, identically to a forward release.
- Because the cache is derivative and fully re-fetchable, the ultimate client-side rollback is dropping the cache DB (section 5) — safe at any time, costing only refetches.
- Swapping the state libraries (section 6) does not touch server or release state; it is a client-only change behind the server/UI boundary.
