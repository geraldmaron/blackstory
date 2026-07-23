# BlackStory design direction v6 — explore edition

**Status:** binding layout pattern for `/explore` only (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary).  
**Supersedes:** `design-direction-v5.md` §6 `/explore` cockpit (ink-fixed instruments, blur panels).  
**Unchanged:** MapLibre plate contract (ADR-017), map dignity rules, shareable URL state, zoom safe-zones.

---

## 1. Intent

Explore is the **full atlas**: map-first, evidence-dense, instrument-led. Readers arrive from home hero hand-off or direct link and should feel they are still inside the same **archive edition** as `/`, not a separate cinematic cockpit.

Design goals:

- **Orient** through a live MapLibre plate (full viewport) with floating Surface instrument panels.
- **Filter** through compact facet rows and place search in one left chassis (Filters | Color key).
- **Browse** records in a hairline-list rail scoped to the camera (or place radius).
- **Preview** one record at a time in a Surface spotlight card with labeled anatomy.
- **Trust** through attribution, legend disclosure, and precision-safe map rendering.

Chrome is **opaque Surface**, theme-aware, flat matte. The map stays visible between panels; panels never use blur, glass, or fixed-ink overrides that break light/dark parity with home.

---

## 2. Canvas law — map plate + edition panels

| Layer | Rule |
|---|---|
| Map plate | Fixed full-viewport MapLibre (`MapStage`); persists from home via ADR-017 handoff |
| Reader theme | Follows site `data-theme` (light Archive Paper / dark Black Ink canvas flash) |
| Floating panels | Opaque `--ds-surface` fill, 1px `--ds-rule` hairline, `--ds-radius-md` |
| Panel padding | `1.25rem` (`--ds-space-5`) default; compact controls at `44px` min height |
| Atmosphere | **None on explore** — no gutter mosaic, no crumpled map, no decorative basemap under chrome |
| Copper | Orientation only: active tab, selected list row, primary CTA in spotlight, accent hairline on preview panel |

**Banned on explore (carried from brand + v6 home):** shadows, gradients, glows, bevels, `backdrop-filter` blur, fixed-ink panel stamps (`--ds-fixed-*`) on instrument/results/restore surfaces.

**Cross-browser:** Explore clears hero inset on mount and calls `MapStage.resize()` for full-bleed geometry. The persistent plate uses shared lifecycle hooks (`orientationchange`, `visibilitychange`, `ResizeObserver`) and degrades to the accessible list when WebGL fails. See [`patterns-map-canvas.md`](./patterns-map-canvas.md).

---

## 3. Page scaffold

```
┌─ ds-shell (100dvh, footer omitted) ─────────────────────────────┐
│  [ SiteHeader — theme-aware Surface bar, shared with home ]      │
│  ┌─ ds-map-surface (flex 1) ─────────────────────────────────┐  │
│  │  MapStage (fixed plate, z-index 0)                         │  │
│  │  ┌─ ds-explore-stage (floating chrome, z-index 1+) ─────┐  │  │
│  │  │  Left: instruments chassis (Filters | Color key)      │  │  │
│  │  │  Right: records rail (hairline rows)                   │  │  │
│  │  │  Center/bottom: spotlight dialog (selected record)     │  │  │
│  │  │  Restore dock: collapsed panel chips                   │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  MapLibre zoom (bottom-right safe zone) · attribution       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Regions (beat map):**

| Region | Job | v6 pattern |
|---|---|---|
| Shell header | Global nav + theme toggle | Same Surface header as home (not explore-only strip) |
| Map plate | Geographic truth | Full bleed; hero `engage()` clears inset geometry on arrival |
| Instruments chassis | Filter + layer + settings | Surface card, tabbed Filters / Color key |
| Place search mast | Geography entry | Lean search + radius chips inside Filters tab |
| Facet rows | Narrow the catalog | Mono label + native select, auto-apply (no Apply button) |
| Layer toolbar | Presence / population / grouping | Hairline-separated stack below facets |
| Records rail | Accessible list peer | Surface card; oldest-first hairline rows |
| Spotlight | Record preview | Surface card, copper left rule, one copper CTA |
| Legend | Encoding reference | Embedded in Color key tab (not a floating blur box) |
| Zoom + attribution | Map controls | Theme Surface islands; safe-zones from panel data attrs |

---

## 4. Instruments chassis (left panel)

### 4.1 Panel anatomy

| Part | Spec |
|---|---|
| Container | Fixed top-left; width `min(19rem, 88%)`; max-height below shell clearance |
| Surface | `--ds-surface`, `--ds-rule` border, radius-md, padding `--ds-space-5` |
| Header | Sticky: segmented tabs (Filters · Color key) + quiet Hide |
| Tabs | Reuse browse-mode segmented vocabulary (`ds-browse-mode-toggle` pattern): mono caps, copper active segment |
| Body | Tab panel grid; hairline separators between mast blocks |

### 4.2 Filters tab stack (top to bottom)

1. **Edition kicker** — mono uppercase copper slug: `Map instruments` (visible label; tabs remain primary).
2. **Place search** — address/entity finder + radius chips (44px targets).
3. **Place focus status** — live region when a radius search is active.
4. **Facet rows** — Kind group · Tone · Era · Theme · Status · Confidence · Where; label + select per row. Kind options use five families (see [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md)), not twelve micro-kinds.
5. **Clear filters** — quiet secondary when any facet differs from default.
6. **Layer model** — presence / Black share / share change + geography/decade controls.
7. **Map settings disclosure** — relationship lines + decade scrubber (timeline instrument).
8. **Context actions** — clear state / clear map focus when applicable.

### 4.3 Color key tab

- Embedded `MapExperienceLegend` (no separate floating legend box).
- Lists **five kind families**, three historical tones, single-record size scale, cluster size steps, and confidence tiers — same vocabulary as map paint ([`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md)).
- Mono subheads; family glyphs match explore pins; population tiers cite source notes.

---

## 5. Records rail (right panel)

| Element | Spec |
|---|---|
| Surface | Same opaque Surface card as instruments |
| Header | Mono count line (records in view · connections · sort hint) + Hide records |
| List | Hairline rows, copper left rule on selected row; kind/confidence glyphs from shared encoding |
| Dimmed state | When spotlight open, rail fades but header stays interactive |
| Mobile | Bottom sheet (`max-height ~42vh`); exclusive with instruments on narrow viewports |

Reuse **edition fact icon** vocabulary in spotlight preview facts (Kind / Where / Era / Evidence).

Spotlight session nav uses `RecordBrowseControls` + `BrowseModeToggle` with index-based prev/next over the records-in-view catalog.

---

## 6. Spotlight preview card

| Element | Spec |
|---|---|
| Shell | Native `<dialog>`; transparent outer shell |
| Scrim | Theme-aware canvas wash (flat matte, no fixed-ink-only scrim) |
| Panel | Surface fill, radius-lg, 3px copper left rule, generous padding |
| Anatomy | v5.1 record card (`NarrativeCard`): kicker → kind → name → story → labeled facts → CTA |
| Copper budget | One copper CTA (`Open full record`) per open preview |

---

## 7. Map dignity + ADR-017 (non-negotiable)

- Hero → explore: `sessionStorage` transition flag; camera descent not interrupted by reconcile on mount.
- Shareable URL carries filters/selection, not live pan/zoom (`history.replaceState`).
- No alarm hues for violence-adjacent records; no crime-heat rendering.
- Points render at stored precision; coarsened points never labeled as exact addresses.
- Attribution and zoom remain in computed safe zones (`data-instruments`, `data-results` on stage).

---

## 8. Home pattern reuse

| Home v6 pattern | Explore adoption |
|---|---|
| Surface panel cards | Instruments + records + spotlight |
| Edition mono kickers | Instruments header slug |
| Hairline Rule separators | Facet rows, list rows, toolbar sections |
| `EditionFactIcon` | Spotlight fact strip (Kind / Where / Era / Evidence) |
| `BrowseModeToggle` / `RecordBrowseControls` | Spotlight browse toolbar |
| Theme-aware canvas | Panels follow reader theme; no fixed-ink cockpit |
| Copper discipline | Tabs, selection, one preview CTA |

---

## 9. Rip list — v6 explore vs v5 explore

| Topic | v5 explore (superseded for `/explore`) | v6 explore (binding) |
|---|---|---|
| Instrument panel fill | Fixed charcoal ink-glass (`--ds-fixed-*`) | Theme-aware opaque Surface |
| Results / restore chips | Semi-transparent + `backdrop-filter` blur | Opaque Surface, no blur |
| Theme | Cockpit forced dark on instruments | Follows reader light/dark everywhere |
| Visual kinship with home | Separate cinema cockpit | Same edition Surface vocabulary |
| Legend | Could float as blur island | Lives in Color key tab panel |
| Place chip selected | Fixed ink fill | Accent / surface-raised selection |
| Scrim | Fixed-ink wash | Theme-aware canvas mix |

**Carried forward:** panel widths, zoom safe-zone data attrs, facet auto-apply, URL state machine, MapStage single mount, narrow exclusive panel rule, spotlight dialog a11y, hairline result list anatomy.

---

## 10. Implementation pointers

- CSS: `apps/web/src/app/(map)/map-surfaces.css` (stage layout + panel surfaces), `apps/web/src/app/(map)/explore/explore-edition.css` (edition kicker + tokens), `explore.css` (facets, narrative card, legend internals).
- Chrome helpers: `explore-panel-chrome.ts` (+ tests).
- Client orchestrator: `ExploreMapExperience.tsx` (preserve behavior; class hooks only in v6 pass).
- Patterns: import `browse-mode.css` and `edition-fact-icon.css` on `/explore` (`page.tsx`); spotlight uses `RecordBrowseControls` + `EditionFactIcon`.

---

## 11. Acceptance checklist

- [x] `/explore` instruments and records use opaque Surface panels in light and dark theme
- [x] No `backdrop-filter` on explore panel chrome
- [x] No `--ds-fixed-*` fills on instruments, results, or restore dock
- [x] Shell header matches home theme-aware Surface bar
- [x] Hero hand-off still clears inset and respects ADR-017 camera latch
- [x] Zoom + attribution safe-zones unchanged (data attrs + CSS contracts)
- [x] Spotlight preview uses Surface card + copper left rule
- [x] Facet rows auto-apply; place search mast intact
- [x] No em dashes in touched explore copy
- [ ] Responsive verified at 375 / 768 / 1280; touch targets ≥44px (manual QA)
- [ ] `prefers-reduced-motion`: panel enter animation respects reduced motion (manual QA)
- [x] Tests cover v6 surface class contracts

---

## 12. Follow-up beads (remaining gaps)

- Relationship lines on/off as edition segment strip (still a pressed button in Map settings)
- Explore-specific footer hand-off or edition index mast (optional)
- Population layer comparability copy audit
- Layer model vertical segment strip: verify narrow-instrument overflow on long labels (375px QA)

---

## 13. Supersession

For **`/explore` only**, this document supersedes:

- `design-direction-v5.md` §6 `/explore` instrument/cockpit bullets
- v5 "cockpit is brand-fixed" / `data-theme="dark"` instrument stamp

Home v6 (`design-direction-v6-home.md`) and brand tokens remain binding for shared vocabulary.
