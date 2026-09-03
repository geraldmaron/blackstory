# v10 design-doc reconciliation

**Status:** binding governance map.  
**Parent:** [`../design-direction-v10.md`](../design-direction-v10.md).  
**Verified against:** code on `cursor/v10-modernization` (2026-08-31).

Goal: one authoritative current design contract. Stale docs must not instruct agents to “fix” the app toward an obsolete architecture.

---

## Legend

| Status | Meaning |
|---|---|
| **Binding** | Follow for new work |
| **Amended** | Still useful; specific clauses overridden by v10 |
| **Superseded** | Do not build from; keep as provenance |
| **Archival** | Historical only |

---

## Reconciliation table

| Document | Prior claim | Code truth today | New status |
|---|---|---|---|
| [`PROTECTED-EXPERIENCES.md`](../PROTECTED-EXPERIENCES.md) | (new) | Memorial/evidence/precision/dignity/public/brand | **Binding** |
| [`design-direction-v10.md`](../design-direction-v10.md) | (new) | Door ≠ Instrument; relationships thesis | **Binding** |
| [`brand.md`](../brand.md) | Palette, type, dignity | Unchanged | **Binding** |
| [`story.md`](../story.md) | Voice/microcopy | Unchanged | **Binding** |
| [`design-direction-v9-atlas.md`](../design-direction-v9-atlas.md) | `/` is Explore; “map is the product”; first paint live MapLibre | `/` is Door (`DoorHome`); Explore on `/explore`; `/` surface class `reading` | **Superseded** by v10 for product shape; map plate tokens / dignity / instrument chrome details **Amended** into Explore Instrument on `/explore` only |
| [`design-direction-v9-surfaces.md`](../design-direction-v9-surfaces.md) | Proposed; `/story`, `/chapters`, Instrument includes `/` | Code: `/stories`, `/library`, `/place`, `/` reading | **Superseded** — surface class membership follows `surface-classes.ts` + v10 |
| [`patterns-surface-classes.md`](../patterns-surface-classes.md) | Instrument includes `/` and `/story` | Code registry differs | **Amended** — align membership to code; keep class semantics |
| [`patterns-atlas-instrument.md`](../patterns-atlas-instrument.md) | Instruments on Atlas | Valid for `/explore` | **Amended** — scope = `/explore` (+ framed story moments), not `/` |
| [`patterns-plate-posture.md`](../patterns-plate-posture.md) | Live/Framed/Parked | Still useful | **Amended** — Door Rest may use pin plate without Live WebGL |
| [`patterns-cinematic-map.md`](../patterns-cinematic-map.md) | Rest→Invite→Engaged | Mobile still uses; web Door differs | **Amended** — mobile binding; web Rest is Door/pin plate |
| [`patterns-record-page.md`](../patterns-record-page.md) / [`patterns-record-anatomy.md`](../patterns-record-anatomy.md) | Record anatomy | Place thinned in `HomeFirstPaint` | **Amended** — full anatomy required on Place; first-paint thinning is not the end state |
| [`design-direction-v9-chapters.md`](../design-direction-v9-chapters.md) | `/chapters` | `/stories` in app | **Superseded** by Story Spine under v10; route name is `/stories` |
| [`design-direction-v6-*.md`](../README.md) | Per-route v6 | Mostly superseded already | **Archival** |
| [`design-direction-v5.md`](../design-direction-v5.md) / v4 | Historical | — | **Archival** |
| [`v9-atlas-implementation-plan.md`](../v9-atlas-implementation-plan.md) | SP work plan | Partial; door tip diverged | **Archival** planning record — do not execute remaining “Instrument on `/`” items |
| `.cursor/rules/ui-design-patterns.mdc` | Points agents at v6 surface docs | Contradicts v9 and v10 and code | **Must amend** to v10 + brand + protected |
| `AGENTS.md` UI Design Patterns | Mix of v6 path table + brand | Drift | **Must amend** to v10 index |

---

## Top contradictions that cause thrash

1. **”First paint is the live Explore instrument on `/`.”**  
   Docs: v9 Explore. Code: Door + HTML pin plate; WebGL map on `/explore`.  
   **Resolution:** v10 Rest on Door; Instrument only after Explore engagement.

2. **“`/stories` is a redirect to `/chapters`.”**  
   Docs: README supersession table. Code: `app/stories` is the real surface.  
   **Resolution:** `/stories` is canonical.

3. **“v9 surfaces is binding pending approval” while agents treat it as law.**  
   **Resolution:** superseded by v10 + `surface-classes.ts`.

4. **Cursor rule still mandates v6 home/explore/history docs.**  
   **Resolution:** point at v10 + protected + brand.

5. **Place first-paint intentionally hides confidence/precision.**  
   Walk calm ≠ complete Place anatomy.  
   **Resolution:** Door may stay calm; `/place/[slug]` must grow full anatomy without restoring v6 card filing cabinet.

---

## Required follow-through in same modernization

- Update `docs/ui/README.md` “Read these first” to v10.
- Update `.cursor/rules/ui-design-patterns.mdc`.
- Update `AGENTS.md` UI section to cite v10.
- Mark v9 Explore/surfaces headers as superseded (leave files for provenance).
