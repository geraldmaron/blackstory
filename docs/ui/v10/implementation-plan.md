# v10 implementation plan (P0–P3)

**Parent:** [`../design-direction-v10.md`](../design-direction-v10.md).

## P0 — Architecture contradictions and comprehension failures

### P0.1 Authoritative v10 contract

| Field | Value |
|---|---|
| Goal | One binding design contract; stop agents restoring Instrument on `/` |
| Why | v9 docs + cursor rule + door tip code contradicted |
| Affected | `docs/ui/*`, AGENTS.md, `.cursor/rules/ui-design-patterns.mdc` |
| Status | **Done** |
| Acceptance | README/AGENTS/cursor point at v10; v9 Atlas/surfaces marked superseded |
| Rollback | Revert doc commits |

### P0.2 Protected Experiences Register

| Field | Value |
|---|---|
| Goal | Lock Memorial + honesty laws |
| Status | **Done** (`PROTECTED-EXPERIENCES.md`) |

### P0.3 Unified DiscoveryState + map/list continuity

| Field | Value |
|---|---|
| Goal | Shared narrowing vocabulary; evidence floor survives Records→Atlas |
| Why | `floor=` was stripped by middleware; readers lost evidence narrowing |
| Affected routes | `/explore`, `/records`, `/search` redirects |
| Affected components | `url-state.ts`, `use-lens-filters.ts`, `discovery-state.ts` |
| Status | **Done** (module + allowlist fix + tests) |
| Remaining | Wire `mapListContinuityLabel` into Records off-ramp UI; Explore share URL should persist floor when Lens changes |
| Acceptance | `?floor=B` survives normalize; Lens seeds from `viewState.floor`; adapters round-trip |
| Rollback | Revert floor key + discovery module |

### P0.4 Schema/query cost blockers for Place anatomy

| Field | Value |
|---|---|
| Goal | Batch relationship projection; no N+1 on Place |
| Why | Constellation must not explode read cost |
| Status | **Partial** — Place uses release `related` + catalog hydrate (O(catalog) once). Search index now projects `confidenceTier` for Records slim. Batched public relationship read + live facet backfill still open |
| Dependencies | P0.1 |

---

## P1 — Core visual models and responsive primitives

| Package | Goal | Dependencies |
|---|---|---|
| P1.1 Place Record anatomy | Full 8-question Place page without v6 card filing cabinet | P0.4 |
| P1.2 Atlas progressive disclosure | Rest stays Door; Explore/Focus chrome after engagement | P0.1 |
| P1.3 Container capacity states | Compact/Comfortable/Expansive for PlaceMast, Evidence, Constellation, Spine | P1.1 |
| P1.4 Library Hub | Semantic groups, not settings menu | P0.1 |

---

## P2 — Relationship richness and Story synchronization

| Package | Goal |
|---|---|
| P2.1 RelationshipConstellation | Typed edges + a11y list; nearby labeled nearby |
| P2.2 Story Spine | Progress, era/geo when meaningful, optional Map Moment |
| P2.3 Discovery context on Place | Prev/next, return to map/list, preserved filters |
| P2.4 Reference Ledger enrichment | Law/Data figure anatomy consistency |

---

## P3 — Motion and polish

| Package | Goal |
|---|---|
| P3.1 View Transitions PE | Door↔Place↔Explore continuity; reduced-motion first |
| P3.2 Loading structures | Model-matched skeletons |
| P3.3 Analytics minimal events | Search, filter, map engage, record open, cite — privacy-conscious |

---

## Owner decisions (only irreversible / public-contract)

1. Confirm `/` remains Door (not Instrument) as permanent public contract — **recommended yes; already shipped on door tip**.
2. Confirm `/stories` (not `/chapters`) as permanent URL family — **recommended yes; already shipped**.
3. Whether `theme` URL key renames to `topic` on Explore (alias period required) — **defer; keep `theme` with DiscoveryState mapping**.
