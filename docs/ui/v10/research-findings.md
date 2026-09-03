# v10 research findings

**Status:** binding decisions for modernization.  
**Parent:** [`../design-direction-v10.md`](../design-direction-v10.md).  
**Method:** authoritative accessibility/archive sources and real implementations; trend articles deprioritized.

| Pattern | Source/example | User problem | Applicable to Blackstory? | Why | Risks | Adopt / reject |
|---|---|---|---|---|---|---|
| Map + list as dual views; list is source of truth for a11y | [Accessible Maps (Accessibility.build)](https://accessibility.build/guides/accessible-maps); WCAG 2.2 | Task achievable without pixels | Yes | The map already has Results rail + `/records`; Rest must not hide non-map path | Treating map as only discovery surface | **Adopt** — strengthen map↔list continuity and live-region count announcements |
| Relationships as typed digraph; edges are the non-visual map | [a11ybob: How an accessible map is built](https://a11ybob.com/maps/how-its-built); Data Navigator (VIS 2023) | Sighted users infer edges; AT users need them explicit | Yes | Thesis: relationships are the product; DB already has 20 relationship types | Drawing proximity lines as evidence | **Adopt** — constellation + semantic list; never proximity-as-related |
| Viewport alt/summary for geovis | AltGeoViz (arXiv 2406.13853) | Screen-reader spatial pattern literacy | Partial | Useful for Explore Focus summaries | Over-claiming spatial stats from sparse pins | **Adopt lightly** — announce filtered count + selected place; skip dense auto-pattern claims unless measured |
| Progressive disclosure / Rest→Engage | Existing mobile Rest/Engaged; door tip `/` vs `/explore` | First-time users crushed by cockpit | Yes | Door tip already separated Door from Instrument | Re-merging Instrument onto `/` under v9 docs | **Adopt** — formalize Rest/Explore/Focus/Journey |
| Editorial archive shelves (not card grids) | NYT longform / Storybench reporting practice; existing `/stories` room | “What should I read?” needs editorial hierarchy | Yes | Avoid generic related carousels | Fake decorative covers | **Adopt** — Archive Shelf; authentic media only |
| Scrolly map moments only when geography carries meaning | NYT graphics practice (Storybench); existing MapInsetMoment | Narrative ↔ place continuity | Yes | Story Spine optional map moment | Forced map on every story; dignity violations | **Adopt with dignity gate** — Parked unless authored moment |
| View Transitions as progressive enhancement | MDN View Transition API; Web Directions 2025 commentary | Continuity Door→Place→Explore | Yes | Shared-element-like continuity without SPA rewrite | Motion sickness; reduced-motion ignore | **Adopt as PE** — respect `prefers-reduced-motion` |
| Container queries for module capacity | CSS CQ; existing Room patterns | Same module in Door mast, Place column, rail | Yes | Compact/Comfortable/Expansive capacity states | Global `100vw` coupling | **Adopt** for PlaceMast, Evidence, Constellation, StorySpine, Results |
| Release-cacheable map catalog over viewport DB queries | Existing publish-release-catalog path + cost docs | Cheap pan/filter at archive scale | Yes | ~4k records; one CDN hit beats many spatial queries | Payload/parse cost on mobile | **Keep & measure** — do not replace with ideology |
| Full WebGL on every public page | Anti-pattern vs current MapStage lifecycle | Avoid startup cost on utility pages | No | Utility Desk must stay cheap | Reintroducing cinematic backdrop everywhere | **Reject** |
| Glassmorphism / glow / game-like map UX | Common 2024–26 SaaS map products | “Modern” feel | No | Brand forbids; historically unserious | Dignity + brand breach | **Reject** |
| Infinite scroll replacing Records pagination | Common archive UIs | Dense browsing | Conditional | Crawlability + no-JS matter for `/records` | SEO loss; focus traps | **Reject by default** — keep pagination unless measured otherwise |
| Auth-gated discovery | SaaS archives | Engagement metrics | No | P-05 public access | Trust erosion | **Reject** |
| Crime-heat / density spectacle | Municipal crime maps | “Where bad things happened” | No | P-04 dignity | Harm dramatization | **Reject** |
| Algorithmic “related” without typed edges | Recommendation carousels | Continuation | No | P-02 evidence honesty | False history | **Reject** — nearby ≠ related |

## Decision summary

1. Dual map/list with list parity is mandatory.
2. Typed relationship graph is a first-class UX surface, not decoration.
3. Progressive map states replace “Instrument on first paint.”
4. Motion and View Transitions are explanatory PE only.
5. Release catalog architecture stays until measurement says otherwise.
6. Trendy chrome and implied relationships are out.
