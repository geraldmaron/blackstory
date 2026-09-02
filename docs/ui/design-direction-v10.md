# BlackStory design direction v10

**Status:** binding (2026-08-31) for product architecture, surface law, and modernization work.  
**Protected overrides:** [`PROTECTED-EXPERIENCES.md`](./PROTECTED-EXPERIENCES.md).  
**Brand (unchanged):** [`brand.md`](./brand.md).  
**Audit/implementation branch:** `cursor/v10-modernization` @ merge of door tip `f101724f` + `staging` launch-gate.

Companion packets live under [`v10/`](./v10/):

| Packet | File |
|---|---|
| Surface inventory | [`v10/surface-inventory.md`](./v10/surface-inventory.md) |
| Mobile inventory | [`v10/mobile-inventory.md`](./v10/mobile-inventory.md) |
| Research findings | [`v10/research-findings.md`](./v10/research-findings.md) |
| DiscoveryState / filters | [`v10/discovery-state.md`](./v10/discovery-state.md) |
| Place anatomy | [`v10/place-anatomy.md`](./v10/place-anatomy.md) |
| Element × data matrix | [`v10/element-data-matrix.md`](./v10/element-data-matrix.md) |
| Schema & cost | [`v10/schema-cost-audit.md`](./v10/schema-cost-audit.md) |
| Design-doc reconciliation | [`v10/design-doc-reconciliation.md`](./v10/design-doc-reconciliation.md) |
| Implementation plan | [`v10/implementation-plan.md`](./v10/implementation-plan.md) |

---

## 0. Branch truth (do not assume)

| Field | Value |
|---|---|
| Product tip (pre-merge) | `cursor/first-paint-door-6ba5` @ `f101724f` |
| Prior audited candidate | `cursor/map-home-first-paint-091c` @ `8f3dfc19` — **ancestor of door, not tip** |
| Ops line | `staging` @ `c1202e8d` — 17 launch-gate/security/perf commits |
| Working base | `cursor/v10-modernization` = door tip + staging merge |

Do not mix attractive components from sibling first-paint forks that diverged mid-line.

---

## 1. Product thesis

> **The relationships are the product. The map is the primary spatial way of navigating those relationships.**

This **amends** v9’s “The map is the product. Everything else floats over it.”

| Layer | Role |
|---|---|
| Relationship graph | Meaning: typed edges among place, person, event, institution, story, claim, evidence, source, law, data |
| Atlas / map | Spatial spine for discovering and situating those relationships |
| Evidence apparatus | Trust: what is known, how, and with what precision |
| Stories | Narrative traversal of selected edges and places |
| Records / Library | Non-spatial and reference traversal of the same archive |

A coordinate without a network is a pin. A network without honest evidence is fiction. BlackStory ships neither.

---

## 2. What the door tip already got right

Verified in source on this branch:

| Finding | Evidence |
|---|---|
| `/` is the **Door**, not the Atlas cockpit | `apps/web/src/app/page.tsx` — mounts `DoorHome`; comment: Atlas stays on `/explore` |
| `/` surface class is `reading` | `apps/web/src/lib/nav/surface-classes.ts` |
| `/explore` is the Instrument | same registry: `['/explore', 'instrument']` |
| Public place URLs are `/place/{slug}` | `apps/web/src/app/place/[slug]/page.tsx` |
| Legacy `/entity/{id}` 308s to place slug | `apps/web/src/app/entity/[id]/page.tsx` |
| Stories live at `/stories`, not `/chapters` | `apps/web/src/app/stories/page.tsx` + surface registry |
| Library hub exists | `/library` classified `reading` |
| Memorial remains wall-first | `apps/web/src/app/memorial/page.tsx` + `MemorialWallAtmosphere` |
| Explore URL state is already a typed shareable shape | `apps/web/src/lib/map-experience/url-state.ts` |
| Typed relationship vocabulary exists in DB | `bb_canonical.entity_relationships` + 20-type check |

v10 does **not** rewind the door tip back to a first-paint WebGL cockpit. Progressive disclosure (Rest → Explore → Focus → Journey) is the law.

---

## 3. What is broken (executive diagnosis)

1. **Design governance contradiction.** `docs/ui/README.md` and `design-direction-v9-atlas.md` still tell agents that `/` is the live Atlas instrument and that first paint is a full MapLibre mount. Code disagrees. `.cursor/rules/ui-design-patterns.mdc` still points at superseded v6 surface docs. Future agents will “fix” the product backward.

2. **Place anatomy was deliberately thinned for the walk.** `HomeFirstPaint` comments ban schema strip, confidence badge, and precision disclosure. That served first-paint calm; it fails the full Place job (what / where-when / what we know / how we know / who is connected / stories / continuation / trust).

3. **Relationship richness is under-expressed.** Canonical typed edges exist, but the public Place surface emphasizes walk-on neighbors and citing stories without a full Entity Constellation with type-honest labels and a11y list equivalents.

4. **Discovery semantics are split.** Explore has `ExploreViewState`; Records/history have parallel facet helpers; Books/Law have their own params. Overlapping concepts (era, kind, state, query) must converge on one `DiscoveryState` vocabulary without forcing every surface to expose every field.

5. **v9 “Instrument on `/`” docs are obsolete relative to shipped door behavior.** Keeping them “binding” manufactures churn.

---

## 4. Visual models (composable, not ten templates)

| Model | Surfaces | Job |
|---|---|---|
| **Atlas Door** | `/`, entry framing | “Show me where Black history is documented and let curiosity pull me deeper.” Rest state only. |
| **Atlas Instrument** | `/explore` (+ story map moments) | Progressive Explore / Focus / Journey over the live plate. |
| **Place Record** | `/place/[slug]` | Full identity → place/time → claims → evidence → constellation → stories → continuation → trust. |
| **Story Spine** | `/stories`, `/stories/[slug]` | Editorial archive + narrative with optional map moments. |
| **Archive Shelf** | `/books`, book detail | Challenged-titles ethics; covers as richness. |
| **Reference Ledger** | `/law`, `/data`, indexes | Dense, crawlable, figure anatomy where charts appear. |
| **Library Hub** | `/library` | “What kinds of knowledge exist beyond the map?” Semantic groups, not a settings menu. |
| **Memorial** | `/memorial` | Protected experience (P-01). |
| **Methodology / About** | `/methodology`, `/about` | Teach the Evidence Apparatus with production primitives. |
| **Utility Desk** | corrections, submit, support, privacy, locate | Task completion, not immersion. |

### Atlas progressive states

| State | User action | Show |
|---|---|---|
| **Rest** | First visit / Door | National pin plate or framed invitation, identity, search, sparse curated context, clear List/Library paths. No full cockpit. |
| **Explore** | Explicit map engagement | Pan/zoom, core Lens, results, essential filters, map↔list continuity. |
| **Focus** | Record/place selected | Identity, summary, place/time, evidence signal, relationships, save/cite/share, open full record, prev/next in context. Keep geography visible. |
| **Journey** | Authored spatial/time sequence | Camera, time, annotation, narrative; corridors only when historically supported. Obvious return to Explore. |

Mobile continues Rest/Engaged bottom-sheet philosophy; do not shrink desktop panels onto phones.

---

## 5. Surface class amendments (code-aligned)

Emitted by `apps/web/src/lib/nav/surface-classes.ts`. v10 locks this as the live contract:

| Class | Routes (current code) |
|---|---|
| `reading` | `/`, `/library`, `/records`, `/stories`, `/books`, `/law`, `/data`, `/memorial`, `/about`, `/methodology`, `/errata` |
| `instrument` | `/explore` |
| `record` | `/place/*`, `/entity/*` (redirect), `/books/*`, `/law/*` |
| `utility` | corrections, submit, support, privacy, design-system, locate, mosaic-credits |

`/` is **not** Instrument. Agents must not restore Instrument chrome to `/` under v9 authority.

---

## 6. KEEP AS IS (product)

- Memorial wall experience (P-01)
- Brand kit and dignity law (`brand.md`)
- Map entity encoding / precision honesty patterns
- `/entity/{id}` → `/place/{slug}` public addressing
- Explore typed URL state + edge allowlist generation from parser keys
- Release-coupled public projections and catalog publish path (measure before replacing)
- MapLibre not mounted on utility/reference pages that do not need it
- Records as crawlable non-spatial index

---

## 7. Authority order

When documents conflict:

1. [`PROTECTED-EXPERIENCES.md`](./PROTECTED-EXPERIENCES.md)
2. [`brand.md`](./brand.md)
3. **This document (v10)**
4. v10 companion packets under `docs/ui/v10/`
5. Still-valid pattern docs amended by v10 (`patterns-map-*`, `patterns-record-*`, Memorial implementation notes)
6. v9 docs — **amended or superseded** per [`v10/design-doc-reconciliation.md`](./v10/design-doc-reconciliation.md)
7. v6 and earlier — archival provenance only

Running code on `cursor/v10-modernization` that conflicts with a lower document wins until the document is updated in the same change.
