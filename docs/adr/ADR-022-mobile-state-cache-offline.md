# ADR-022: Mobile client state, local cache, and offline-read mode

- **Status:** Proposed — independent red-team complete, awaiting owner acceptance
- **Date:** 2026-07-19
- **Bead:** MOB-002 (`black-book-mobile-002`)
- **Depends on:** ADR-004 (public projection / immutable snapshots), ADR-008 (bounded static-first search and geocoding), ADR-013 (map stack), ADR-020 (mobile stack), ADR-021 (mobile data boundary)
- **Blocks:** MOB-009 (typed API client, SQLite cache, offline mode, migrations), MOB-012 (native Explore map, synchronized list, filters, narrative sheet)

## Scaffold vs target

| Aspect | Today | Target (MOB-009 and beyond) |
|--------|-------|------------------------------|
| Client state | No `apps/mobile` exists | TanStack Query (server-state/cache) + Zustand (UI-only client state) |
| Persistent cache | None | SQLite cache (engine per ADR-020) with the caching policy in this ADR layered on top |
| Offline behavior | None | Offline **read** of previously-viewed content, explicitly marked stale; no silent failures |
| Release awareness | None | Client compares a server release stamp against its cache stamp and invalidates entity data on mismatch |

This ADR is a decision record, not an implementation. MOB-009 wires it; MOB-012/013/014 consume it.

## Context

The mobile app (ADR-020 stack: Expo React Native, custom dev builds, MapLibre Native) is a **read client** over `apps/api-public` (program invariant 2; ADR-021 data boundary). It duplicates no canonical data, holds no write path to the system of record, and — per the program non-goals — ships **no user accounts and no full offline basemap** at launch. "Offline" in this ADR therefore means exactly one thing: **offline read of content the user already fetched while online** (last-viewed entities, their evidence, prior search results, and map-viewport GeoJSON already downloaded). It is not an offline-first sync engine and not a basemap download; either would be a scope change governed by MOB-022.

Three pieces of existing doctrine constrain this record and must be extended, not contradicted:

- **ADR-004** makes public content an **immutable, versioned release** with atomic activation and instant rollback, and generates **public JSON snapshots per release for degraded rendering** — "entity pages must remain serveable if live APIs are disabled." Its consequence "public API responses include release/revision metadata" is the hook this ADR uses for cache invalidation. The mobile cache is a *client-side extension of that same degraded-snapshot posture*, not a new source of truth.
- **ADR-008** is bounded/static-first: prefer bounded queries over released projections; do not build a new query/sync platform before measured need. A mobile cache must not become a shadow query engine.
- **ADR-013** already inherits ADR-004's snapshot/rollback rather than inventing map-specific degraded-mode code. Mobile's cached map viewport data follows the same rule: it is release-stamped release data, invalidated by the same release-stamp check as everything else.

The operational reality is **one maintainer** with a budget-capped, "runs itself within reason" posture. Every choice below is judged against the project's repeated preference (ADR-008, ADR-011, ADR-013) for **narrow, reversible, low-ceremony** decisions over powerful-but-heavy platforms adopted before measured need.

Program invariant 7 (privacy) is a hard constraint on this ADR: **no query text, correction-submission content, or precise location** may reach logs, crash reports — or, by extension here, the on-disk cache.

## Decision

### 1. Client state: TanStack Query for server-state, Zustand for UI-only state

Adopt **TanStack Query (React Query)** as the server-state and data-fetching layer, and **Zustand** as a lightweight store for UI-only client state. Reject Redux Toolkit and reject plain React Context as the primary mechanism.

Rationale:

- **The app is ~95% server-state.** Almost everything on screen is a projection fetched from `api-public`: an entity, its evidence, a search result page, a viewport's GeoJSON. That is precisely the problem TanStack Query exists to solve — fetching, caching, staleness, background refetch, request de-duplication, and retry — with a tiny declarative surface (`useQuery`/`queryKey`) rather than hand-rolled fetch-effect-reducer boilerplate. It fits the bounded/static-first grain of ADR-008: queries are keyed, bounded, and cache-addressable by construction.
- **Zustand covers the small remainder.** Genuine client-only UI state — active map filter chips, bottom-sheet expansion, in-flight (unsent) correction draft text, theme override — is a handful of small stores with almost no ceremony and no provider-tree wiring. Critically, this is where **ephemeral privacy-sensitive state lives in memory only** (see §2's never-cache list).
- **Against Redux Toolkit.** RTK (even with RTK Query) is more framework, more concepts (slices, thunks, store config, middleware), and more standing maintenance than a one-maintainer read client needs. Its main advantage — a single normalized global store with rich time-travel/middleware tooling — is exactly the ceremony this project routinely declines (ADR-008's "no separate platform before measured need"). RTK Query would overlap TanStack Query without being better at the read-cache job here.
- **Against plain Context.** Context is not a data-fetching or caching library; using it as one means re-implementing staleness, de-duplication, retry, and eviction by hand — more bespoke code for the maintainer to own, and the well-known re-render/perf pitfalls at scale. Context remains fine for a couple of truly static app-wide values (e.g. a theme token provider), and TanStack Query uses one provider internally; it is just not the state architecture.
- **Reversibility.** Both libraries are unopinionated about transport and storage: they sit *above* the typed API client (MOB-009) and *above* SQLite, touching neither the contract nor the persistence schema. Swapping either is a client-internal refactor with no contract, server, or on-disk-format consequence (see §6).

### 2. Local persistent cache policy (SQLite engine per ADR-020)

ADR-020 already selects **SQLite** as the mobile storage engine — this ADR does **not** re-decide that. It defines the **caching policy** layered on top. TanStack Query's in-memory cache is the hot tier; SQLite is the cold, cross-launch persistence tier that also backs offline read. A thin persistence adapter writes selected query results through to SQLite and rehydrates them on cold start.

**What is cached to disk (allowed):**

| Cached item | Keyed by | Why safe to persist |
|---|---|---|
| Last-viewed entity projections | `entityId` + release stamp | Immutable released public data (ADR-004) |
| Evidence / claims / timeline for viewed entities | `entityId` + release stamp | Same immutable released projection |
| Search **result sets** (the returned entity refs/cards) | normalized query-shape hash + release stamp | The *results* are released public projections; see the query-text exclusion below |
| Map viewport GeoJSON already fetched | tile/viewport key + release stamp | Release-coupled, already-redacted public map source (ADR-013) |
| Release/version stamp | singleton row | Drives invalidation (§4) |

**Never cached to disk (hard exclusions, program invariant 7):**

- **Query text / search input strings.** Search result *sets* may be cached keyed by a normalized, salted **hash** of the bounded query shape — never the raw human-entered text. The raw text stays in memory (Zustand/component state) and dies with the process. No search-history table exists on disk.
- **Correction-submission content.** Draft and submitted correction text, and any opaque receipt payload beyond a non-sensitive status token, are **in-memory only** and never written to SQLite. This mirrors MOB-016's opaque-receipt model and invariant 7.
- **Precise location.** No raw device coordinates, and no un-redacted entity coordinates, ever touch disk. Cached map GeoJSON is already the coarsened, `redactLocationForPublic`-processed public output (ADR-013's hard invariant) — the client caches only what the API already redacted, and performs no precise-location persistence of its own.

**Staleness / TTL:**

- Cached entries carry a `fetchedAt` timestamp and the release stamp they were fetched under.
- **Online + fresh:** served from cache immediately, revalidated in the background (TanStack Query `staleTime` on the order of minutes for entity/evidence, shorter for search).
- **Online + stale:** background refetch; UI updates on success.
- **Release-stamp mismatch:** treated as hard-invalidated regardless of TTL (§4) — the release stamp, not the clock, is the authoritative freshness signal for immutable content.
- TTL is a **soft** signal for background revalidation; the release stamp is the **hard** signal for correctness.

**Size ceiling and eviction:**

- **Hard byte ceiling** on the SQLite cache appropriate for a mobile device — target on the order of **~50 MB** (final number set and measured in MOB-009/MOB-018 against real device budgets; this is a documented target, not a measured value, matching ADR-013's honesty about unmeasured budgets).
- **Eviction policy: LRU by last-access.** Each read touches a `lastAccessedAt`; when the cache exceeds the ceiling, evict least-recently-accessed entries first until back under a low-water mark. Eviction is safe by construction because every cached row is reconstructable from the network — the cache is a convenience tier, never a system of record.
- Map GeoJSON blobs (the largest entries) are counted against the same single ceiling so viewport panning cannot starve entity/evidence caching.

### 3. Offline-mode UX contract (behavioral, not visual design)

This mirrors ADR-004's degraded-snapshot posture — "entity pages must remain serveable if live APIs are disabled" — and ADR-013's inheritance of it, extended to the client:

- **Cached content is readable offline**, and every cached surface is explicitly labeled **"last updated <relative time>"** using its `fetchedAt`. Stale content is never presented as live.
- **An explicit degraded-mode indicator** is shown while offline or while the API is unreachable (a persistent, non-modal banner/affordance). The app is honest that it is showing a snapshot.
- **No silent failures.** A request that cannot be served fresh either (a) serves clearly-labeled cached data, or (b) shows an explicit "offline / can't load" state — never a spinner that hangs, never an empty state that reads as "no results," never fabricated or optimistic data.
- **Write-shaped actions degrade honestly.** Correction submission (MOB-016) requires connectivity; offline it is disabled with a clear "needs connection" message. It is **not** queued to disk (invariant 7 forbids persisting its content) and never appears to have succeeded when it has not.
- **Search offline** may show previously-cached result sets, explicitly labeled as prior/last-known; it never presents them as a live query and never invents results.

### 4. Cache invalidation on new release

Per ADR-004, publication is immutable and each release has a manifest/version, and "public API responses include release/revision metadata." Mobile uses that directly:

- Every `api-public` response the client consumes carries the **active release stamp** (release id / version). The client stores the stamp it last saw alongside cached entity data.
- On each app foreground / first successful request, the client compares the **server's current release stamp** to its cached stamp. **On mismatch, release-coupled cached data (entities, evidence, search results, map GeoJSON) is treated as invalid** and refetched lazily on next access (or eagerly for the current screen). This is the client-side analogue of ADR-004's active-release pointer flip and ADR-013's automatic map rollback — one stamp governs all release-coupled cache, so there is no per-surface invalidation code.
- Because releases are immutable, a matching stamp is a *strong* freshness guarantee: identical stamp ⇒ identical content, so cached data can be served with confidence and TTL revalidation is merely a backstop.
- **Rollback is handled by the same mechanism:** if the server rolls back to a prior release (ADR-004 instant rollback), the stamp changes and the client invalidates exactly as it would for a roll-forward — no special-casing.

### 5. Cache schema migrations: destructive drop-and-rebuild, not in-place ALTER

The SQLite store here is a **cache, not a system of record.** Therefore:

- **Schema version is a single pragma/meta value.** On app launch, if the app's expected cache schema version differs from the on-disk version, the migration is **drop the cache tables and recreate them empty** — then repopulate lazily from the network as the user browses.
- **No in-place `ALTER TABLE` / data-preserving migration path is maintained.** Every row is reconstructable from `api-public`; there is nothing irreplaceable to preserve. Drop-and-rebuild is dramatically lower risk and lower complexity than hand-written forward migrations, and it eliminates an entire class of partial-migration corruption bugs — a meaningful saving for a one-maintainer program.
- This is explicitly the *opposite* of the policy a system-of-record database would take. It is safe **only because** ADR-004/ADR-021 keep the server authoritative and the client purely derivative. The one visible cost — a one-time empty cache and a fresh fetch after an app update that changes the cache schema — is acceptable and self-healing, and it degrades exactly like a first launch (which the offline contract in §3 already handles honestly).

### 6. Reversal cost

- **State library:** low. TanStack Query and Zustand sit above the API client and above SQLite; neither touches the public contract (MOB-003) or the on-disk schema. Replacing Zustand is a localized store rewrite. Replacing TanStack Query is a larger but still client-internal refactor of fetch/cache call sites, with zero server, contract, or persisted-format impact. No data migration is involved because the persisted format is owned by the §2 adapter, not by the state library.
- **Eviction policy / cache tuning:** very low. LRU-by-last-access, the byte ceiling, and TTLs are runtime policy over a disposable, network-reconstructable store. Changing the ceiling, switching eviction strategy, or even changing the on-disk cache schema all reduce to §5's drop-and-rebuild — the cache repopulates from the network with no user-visible loss beyond a transient refetch. This is the cheapest possible class of decision to reverse, which is *why* it is safe to decide now rather than defer.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Redux Toolkit (± RTK Query) as primary state | More framework/ceremony than a one-maintainer read client needs; its global-normalized-store strengths aren't the job here. Overlaps TanStack Query without beating it at read-caching. |
| Plain React Context as the state/data layer | Not a fetching/caching library; forces hand-rolled staleness, de-dup, retry, and eviction — more bespoke code to maintain, with known re-render pitfalls. Kept only for a couple of static providers. |
| Offline-first sync engine (WatermelonDB / Realm / PowerSync / replicated DB) | Violates program non-goals and ADR-008 bounded/static-first: a sync/query platform before measured need. The app has no write path and no account model to sync against. |
| Full offline basemap download | Explicit program non-goal; governed by MOB-022, not this bead. |
| Persisting query text / correction content / precise location for offline history | Violates program invariant 7. These stay in-memory only or are excluded entirely. |
| In-place ALTER-based cache migrations | Unjustified risk/complexity for a disposable, network-reconstructable cache; drop-and-rebuild is strictly simpler and safer here. |
| Client TTL as the primary freshness signal | Immutable releases make the release stamp a stronger, correct signal; TTL alone could serve superseded content as current. TTL is kept only as a background-revalidation backstop. |
| AsyncStorage/MMKV as the primary cache store | ADR-020 already selects SQLite; key-value stores don't fit release-stamped, LRU-evicted, size-capped structured cache and would fragment the storage story. |

## Consequences

- MOB-009 owns: the SQLite persistence adapter for TanStack Query, the release-stamp invalidation check, the LRU/byte-ceiling eviction, the drop-and-rebuild migration, and enforcement of the never-cache exclusions.
- The public contract (MOB-003 / ADR-021) must surface the **active release stamp** on responses the client caches — a small, already-implied extension of ADR-004's "responses include release/revision metadata."
- Privacy review (MOB-010/MOB-018) must include a check that no query text, correction content, or precise/unredacted location is ever written to SQLite — testable by asserting on the on-disk schema and inserted rows, analogous to ADR-013's redaction regression test.
- The offline contract adds explicit "last updated" and degraded-mode affordances to every content surface (MOB-012/014/015), and an honest disabled state to correction submission (MOB-016).
- The cache byte ceiling and TTLs are documented targets to be measured on real devices in MOB-009/MOB-018, not fabricated guarantees.

## Migration triggers

- Revisit offline scope (toward any form of offline-first or basemap download) **only** through MOB-022 with measured user need — never by drift.
- Reconsider the state-library split only if TanStack Query is measured insufficient for real usage patterns (it will not be for a bounded read client), or if a genuine offline-write requirement is ever accepted (it is a non-goal today).
- Raise/lower the byte ceiling or change eviction strategy on measured device-storage evidence (MOB-018) — a policy change, not an architecture change (§6).
- If cache-schema churn ever becomes frequent enough that repeated drop-and-rebuild degrades UX, reconsider selective preservation — but only on measured evidence, since immutable-release semantics make refetch cheap.

## Rollback considerations

- **Server-side release rollback** (ADR-004) requires no mobile-specific code: the release stamp changes and §4 invalidation handles it identically to a roll-forward.
- **Disabling the persistent cache** entirely degrades to online-only fetching via TanStack Query's in-memory cache — the app still works, just without offline read; this is a feature-flag-level fallback, not a rewrite.
- **A bad cache schema or corrupt store** self-heals via §5 drop-and-rebuild on next launch; there is never irreplaceable local data to recover.
- Because the cache is purely derivative of `api-public`, no rollback path here can ever affect canonical data, the release, or the server's authority.

## Red-team resolution: global vs. per-artifact invalidation

*Resolved: keep the single global release-stamp invalidation for launch; do not introduce per-entity/per-artifact
stamps now. Record one measured trigger to carve out a **coarse map-cache stamp** later if — and only if — evidence
demands it.* (MOB-002 requires recorded reviewer findings and dispositions.)

The reviewer pressure-tested the concern behind the finer grain (a new release cold-starting an otherwise-unchanged
large map-viewport cache on a constrained connection) and judged it real but premature:

- **Global matches the authoritative model and the maintainer reality.** One stamp mirrors ADR-004's single
  active-release pointer, needs zero extra contract surface, and adds no per-surface bookkeeping — the decisive
  factor for a one-maintainer program that has repeatedly chosen the narrow, reversible option (ADR-008/011/013).
- **The cost is bounded and self-healing.** Because every cached row is network-reconstructable (§2/§5), the worst
  case of a global invalidation is a transient refetch, not data loss, and the offline contract (§3) already labels
  that state honestly. At launch — a bounded U.S.-only corpus with an infrequent release cadence — the volume of
  avoidable map-blob refetch is expected to be small.
- **The reversal is cheap, so deciding global now is safe.** Per §6, cache tuning is the cheapest class of decision
  to reverse; adding a finer stamp later is additive, not a rewrite.

**Measured trigger for revisiting (MOB-018-gated):** if post-launch telemetry shows release cadence combined with
map-viewport blob size is causing materially costly refetches on constrained connections, split out a **second,
coarse stamp scoped to the map-tile/GeoJSON cache only** (so a content-only release no longer cold-starts the map
cache) — *not* full per-entity/per-artifact stamping, which the reviewer rejected as disproportionate contract and
client complexity for this read client. Global stands until that evidence exists.
