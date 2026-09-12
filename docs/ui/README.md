# Design system & UI patterns

**Start here** for any agent or human shipping public UI. This file is the living pattern index; keep it updated when patterns are added or superseded.

Shared kit: `@repo/ui` (`packages/ui`). Binding brand source: root `brand/`. Token contract: [`brand.md`](./brand.md).

## Read these first

v10 is the authoritative product architecture. It amends the door-tip implementation
(`/` is the Door; `/explore` is the Explore instrument) and supersedes v9’s
“Instrument on `/`” product shape.

| Document | Governs | Status |
|---|---|---|
| [`PROTECTED-EXPERIENCES.md`](./PROTECTED-EXPERIENCES.md) | Memorial, evidence honesty, precision, dignity, public access, brand integrity. Overrides aesthetics. | Binding (2026-08-31) |
| [`design-direction-v10.md`](./design-direction-v10.md) | Product thesis, visual models, surface law, KEEP AS IS, authority order. | Binding (2026-08-31) |
| [`brand.md`](./brand.md) | Signature, palette, type, dignity law. Where this doc and the brand pack disagree, the pack wins. | Binding |
| [`story.md`](./story.md) | Voice and microcopy, all user-facing copy. | Binding |
| [`v10/`](./v10/) | Inventory, research, DiscoveryState, Place anatomy, schema/cost, reconciliation, plan. | Binding companions |

**Do not** rebuild first paint as a live WebGL cockpit on `/` because a v9 doc says so.
Live instrument chrome belongs on `/explore`. See [`v10/design-doc-reconciliation.md`](./v10/design-doc-reconciliation.md).

## Pattern index

### v9 surface law

| Pattern | Binding doc | Code | Status |
|---|---|---|---|
| **Surface classes** (`data-surface`) | [`patterns-surface-classes.md`](./patterns-surface-classes.md) | `app/layout.tsx`, `app/shell.css` | Binding. Pending in code (SP-07) |
| **Plate posture** (Live / Framed / Parked) | [`patterns-plate-posture.md`](./patterns-plate-posture.md) | `components/map-stage/MapStage.tsx`, `components/theme-spine/MapInsetMoment.tsx`, `lib/map-experience/*` | Binding. Pending in code (SP-07, SP-08) |
| **Atlas instrument** | [`patterns-atlas-instrument.md`](./patterns-atlas-instrument.md) | `components/shell/CommandBar.tsx`, `map-experience/{TimePanel,LensPanel,ResultsRail,CameraConsole,RecordSheet}.tsx`, `lib/map-experience/{camera-moves,camera-dignity,chrome-padding,decade-density}.ts`, `lib/{citation,share}/*` | In build (v9). Mutually exclusive with the cinematic backdrop |
| **Reading room** | [`patterns-reading-room.md`](./patterns-reading-room.md) | `app/reading-room.css`, `components/article/*` | Binding. Pending in code (SP-09, SP-11) |
| **Record page** | [`patterns-record-page.md`](./patterns-record-page.md) | `components/patterns/{RecordAnatomyPanel,RecordPlacePreview}.tsx`, `lib/citation/format.ts` | Binding. Pending in code (SP-12) |
| **Lens handoff** | [`patterns-lens-handoff.md`](./patterns-lens-handoff.md) | `lib/map-experience/url-state.ts`, `lib/share/deep-link.ts`, `lib/runtime-hardening/*` | Binding. Typed builder pending (SP-15, SP-16) |

### Surface direction docs

| Surface | Binding doc | Code | Status |
|---|---|---|---|
| **Door** (`/`) and **Explore** (`/explore`) | [`design-direction-v10.md`](./design-direction-v10.md) | `app/page.tsx`, `app/explore/*` | Binding. v9's "Atlas on `/`" is superseded: `/` is the Door, `/explore` is the instrument |
| **Stories** (`/stories`, `/stories/[slug]`) | [`design-direction-v9-chapters.md`](./design-direction-v9-chapters.md) | `app/stories/*`, `components/article/*`, `lib/articles/*` | Binding for the reading treatment ONLY. Its route names (`/chapters`) and its "chapters are the index" premise are retired: `/stories` is the one publication surface and a chapter is one editorial kind within it |
| **Every other public route** | [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) | see its section 4 resolution map | Proposed, binding on owner approval |
| **Mobile shell** (`@repo/mobile`) | [`design-direction-v6-mobile.md`](./design-direction-v6-mobile.md) | `apps/mobile/src/app/(tabs)/*`, `apps/mobile/src/shell/*`, `apps/mobile/src/ui/*` | Binding for **Ledger Line** treatment (see [`mobile-polish-mockups.html`](./mobile-polish-mockups.html)). Its IA is retired: the tabs are Explore / Stories / Records / More, composed from the destination catalog, not History / Stories(`/learn`) / More |

### Reusable component patterns

| Pattern | Binding doc | Code | Status |
|---|---|---|---|
| **Record anatomy layout** | [`patterns-record-anatomy.md`](./patterns-record-anatomy.md) | `RecordAnatomyPanel`, `record-anatomy.css`, mobile `AnatomySection` | Reusable |
| **Map entity encoding** | [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md) | `kind-encoding.ts`, `MapExperienceLegend.tsx`, `explore-style.ts` | Binding (map surfaces) |
| **Map canvas lifecycle** | [`patterns-map-canvas.md`](./patterns-map-canvas.md) | `map-libre-lifecycle.ts`, `MapStage.tsx`, `EntityLocationMap.tsx` | Binding (cross-browser WebGL) |
| **Edition fact icon** | [`patterns-edition-fact-icon.md`](./patterns-edition-fact-icon.md) | [`patterns-registry.md`](./patterns-registry.md) | Reusable |
| **Browse mode** | [`patterns-browse-mode.md`](./patterns-browse-mode.md) | [`patterns-registry.md`](./patterns-registry.md) | Reusable |
| **Relationship constellation** | [`patterns-relationship-constellation.md`](./patterns-relationship-constellation.md) | `RelationshipConstellation.tsx` | Reusable (Place typed edges) |
| **Footer** | [`patterns-site-footer.md`](./patterns-site-footer.md) | `SiteFooter.tsx`, `shell.css` `.ds-shell-footer*` | Reusable. Rewritten from the destination registry in SP-15 |
| **Utility edition** | [`patterns-utility-edition.md`](./patterns-utility-edition.md) | `components/patterns/utility-edition/*` | Reusable. Folded into the Utility surface class by v9 surfaces section 2.4 |
| **Cinematic map backdrop** | [`patterns-cinematic-map.md`](./patterns-cinematic-map.md) | `components/patterns/cinematic-map/*`, `MapStage.tsx`, `camera-presets.ts`, mobile `AppBottomSheet.tsx` + `mapCamera.ts` | Binding on mobile. On web, replaced by the Framed plate posture |
| **Voice & microcopy** | [`story.md`](./story.md), [`neo-voice.md`](../content/neo-voice.md) | All user-facing copy | Binding |
| **Learning index entity** | [`learning-index-entity.md`](./learning-index-entity.md) | Entity detail / index cards | Contract |
| **Add to Home Screen** | [`brand.md`](./brand.md) § Add to Home Screen / install icons | `public/manifest.webmanifest`, `layout.tsx` metadata | Installability (online-first; no service worker). The former `docs/notes/add-to-home-screen.md` was removed on 2026-07-24 and the link to it was left dangling; brand.md is the surviving source |

### Superseded, kept as the provenance record

None of these is deleted. They record why v9 exists and what was rejected. Do not build from them.

The WP-series work package epic (repo-dbtn) is itself superseded by the SP-series epic
(repo-92n2); WP-21/22 landed as code before SP-10 took over the route. SP-series beads are
the live, actively-tracked implementation wave referenced throughout this file.

| Doc | Superseded by | Route today |
|---|---|---|
| [`design-direction-v5.md`](./design-direction-v5.md) | v6, then v9 | Historical |
| [`blap-design-direction-v4.md`](./blap-design-direction-v4.md) | v5 | Historical |
| [`design-direction-v6-home.md`](./design-direction-v6-home.md) | **v10** | `/` is the Door, not a live cockpit |
| [`design-direction-v6-explore.md`](./design-direction-v6-explore.md) | v9 Explore → **v10** | `/explore` is the live Instrument (not a 308 to `/`) |
| [`design-direction-v6-search.md`](./design-direction-v6-search.md) | v10 Records | `/search` resolves to `/records`; search is a capability of the archive, not a surface |
| [`design-direction-v6-history.md`](./design-direction-v6-history.md) | v10 Records | `/history` resolves to `/records`; chronology is an era facet, not a destination |
| [`design-direction-v6-stories.md`](./design-direction-v6-stories.md) | v10 Stories | `/stories` is the one publication surface; `/chapters` is the 308 now, not the destination |
| [`design-direction-v6-themes.md`](./design-direction-v6-themes.md) | v10 Stories | `/themes` 308s to `/stories`; a theme is a Story tag and collection, not a surface |
| [`design-direction-v6-about.md`](./design-direction-v6-about.md) | v9 surfaces | `/about` |
| [`design-direction-v6-books.md`](./design-direction-v6-books.md) | v9 surfaces | `/books`, `/books/[slug]` |
| [`design-direction-v6-data.md`](./design-direction-v6-data.md) | v9 surfaces | `/data` |
| [`design-direction-v6-law.md`](./design-direction-v6-law.md) | v9 surfaces | `/law`, `/law/[slug]` |
| [`design-direction-v6-memorial.md`](./design-direction-v6-memorial.md) | v9 surfaces | `/memorial` |
| [`design-direction-v6-methodology.md`](./design-direction-v6-methodology.md) | v9 surfaces | `/methodology` |
| [`design-direction-v6-entity.md`](./design-direction-v6-entity.md) | v9 surfaces, v9 record page | `/entity/[id]` |

The v6 supersessions listed against `design-direction-v9-surfaces.md` take effect on that document's approval. The three listed against v9 Explore are in effect now.

**Component registry:** [`patterns-registry.md`](./patterns-registry.md) for import paths and adopters of `components/patterns/*`.

**Agent guardrails:** root [`AGENTS.md`](../../AGENTS.md) § UI Design Patterns; Cursor rule [`.cursor/rules/ui-design-patterns.mdc`](../../.cursor/rules/ui-design-patterns.mdc). Both paths were wrong in the previous index and resolved to `docs/`.

---

## How to add a pattern

1. **Check** this index and [`patterns-registry.md`](./patterns-registry.md). Extend an existing pattern before creating a parallel one.
2. **Codify** behavior in `docs/ui/patterns-<name>.md` (or the surface direction doc if layout-level only).
3. **Implement** under `apps/web/src/components/patterns/` when reusable across routes; otherwise in the surface folder with a doc citation.
4. **Register** a row in [`patterns-registry.md`](./patterns-registry.md) and the table above.
5. **Styles.** Flat matte, `--ds-*` tokens, light and dark, copper discipline per [`brand.md`](./brand.md). No raw hex in component CSS; new tokens go in `packages/ui/src/styles/tokens.css` and are mirrored in `packages/ui/src/tokens/colors.ts`.
6. **A11y.** WCAG 2.2 AA, `:focus-visible`, no color-alone signals, 44px touch targets on controls.
7. **Copy.** No em dashes and no en dashes on touched surfaces; evidence-before-assertion tone per [`story.md`](./story.md).
8. **Tests.** Pure helpers and non-trivial interaction (see `browse-mode.test.tsx`). New test files under `apps/web` must be registered in `apps/web/package.json`'s `test` script: it is a hand-maintained file list, not a glob, and an unregistered test silently never runs.
9. **Same change.** Never merge UI without updating the binding doc when the pattern changes.

---

## Kit overview

Where this doc and `@repo/ui` disagree on tokens, **the kit wins**. Where a pattern doc specifies layout or behavior, **the pattern doc wins**. Where a design doc and [`brand.md`](./brand.md) disagree on the signature, palette or type, **brand.md wins**: it is the usage contract.

### What shipped

- **Palette (v3):** Archive Paper `#F4EFE5` canvas + Surface `#FBF8F2` / Black Ink primary; Copper Pin accent with copper text pairs `#8E4F2A` (light) and `#D07A32` (dark); light and dark themes via `data-theme`; radii 8/16/28px (sm/md/lg). Bevels, shadows, gradients and glows stay banned, with one v9 carve-out: a single soft tinted shadow on panels that float over the map plate, for z-order only.
- **Map plate roles (v9):** `--ds-map-*` land, water, green, line, line-2, road, label, label-hi, halo, contract-tested for CIE L\* separation in both themes.
- **Status colors:** warning, confidence, dispute, error only, re-derived to harmonize with the accent palette, always with a text or mono cue and never color-alone.
- **Typography (v3):** Sora + Inter + Source Serif 4 + IBM Plex Mono, all free and open source.
- **Tokens:** grid, spacing, elevation, border, icon, motion, focus, pigment-anchored data-viz.
- **Components:** Card, Citation, Confidence, Timeline, MapFrame, ResultList, FilterBar, Dialog, Notice, EmptyState, Button, ThemeToggle, Toast, skeletons.
- **Fixtures:** public route `/design-system`.

### Usage

```tsx
import '@repo/ui/styles.css';
import { Card, Confidence, Notice } from '@repo/ui';
```

In Next apps, add `@repo/ui` to `transpilePackages` and prefer `next/font` variables mapped to `--ds-font-display`, `--ds-font-editorial`, `--ds-font-sans`, and `--ds-font-mono`.

### Accessibility

- WCAG 2.2 AA contrast validated in `packages/ui` token tests (AAA for primary ink on canvas)
- Visible `:focus-visible` rings; skip link becomes visible on focus
- `prefers-reduced-motion` collapses animation and transition durations
- Dialog uses native `<dialog>` (modal focus + Escape)
- Filters use labeled native controls inside a `<fieldset>`
- Public shell: landmarks (`header` / `main` / `footer` / `nav`), skip link, responsive menu via `<details>`

### Commands

```bash
pnpm --filter @repo/ui test
pnpm --filter @repo/web exec next dev --port 3048
# → http://localhost:3048/
# → http://localhost:3048/design-system
```

---

## Public routes

**There is no route table here any more.** There was one, verified against `apps/web/src/app/` on
2026-07-30, and by 2026-09-07 it said `/` was the Atlas instrument, `/explore` folded into `/`,
`/chapters` was the publication index, `/stories` did not exist, and `/records`, `/rooms` and
`/faq` were absent entirely. Every one of those was wrong, and a doc marked binding that describes
the previous generation of the product is worse than no doc: an agent can read it and confidently
rebuild what was removed.

The routes are data, not prose. Read them from the source that the site itself renders from:

| Question | Source of truth |
|---|---|
| What destinations exist, and what is each one for? | `@repo/public-contracts/destinations` — id, label, canonical path, parent, family, icon |
| Which surface class does a route render as? | `apps/web/src/lib/nav/surface-classes.ts` |
| What does the card, the crumb, the menu and the sitemap say? | `apps/web/src/lib/nav/destination-registry.ts` |
| Which old addresses still resolve, and why? | `LEGACY_ALIASES` in the destinations catalog, honored by `apps/web/src/lib/redirects/next-config-redirects.mjs` |
| Which tabs and More rows does the phone render? | `apps/mobile/src/shell/mobile-nav.ts`, composed from the same catalog |

Those files are covered by tests that fail when they disagree with each other: no shell destination
may be a legacy alias, no canonical path may be aliased, every redirect must resolve in one hop,
and every classified route must have a registry entry.


## Known gaps

| Gap | Where | Owner |
|---|---|---|
| `/chapters` and `/chapters/[slug]` have no page chrome tests | `apps/web/package.json` test list carries `ArticleProse.test.ts` only | SP-11 |
| `/chapters/mosaic-credits` still renders v6 stories chrome under a `/chapters` path | `app/chapters/mosaic-credits/stories-edition.css`, `stories-panel-chrome.ts` | SP-13 |
| `/errata`, `/support`, `/privacy`, `/design-system` still on the v5 mast (`ds-page__eyebrow`) | those page files | SP-11, SP-13 |
| Chapter slugs are absent from the sitemap; `/history` appears in it twice | `lib/seo/sitemap-builders.ts` | SP-19 |
| `MapInsetMoment` and `EntityLocationMap` each mount a second MapLibre instance | `components/theme-spine/`, `components/entity/` | SP-08 |
| The chapter-cites-record edge does not exist, so no record links back to editorial | release build | SP-20 |
| Live public projections, search API, geocoding and nearby discovery | backend | Backend |
| Dedicated Storybook or Chromatic visual regression CI | none | If required later |
