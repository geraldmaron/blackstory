# Design system & UI patterns

**Start here** for any agent or human shipping public UI. This file is the living pattern index; keep it updated when patterns are added or superseded.

Shared kit: `@repo/ui` (`packages/ui`). Binding brand source: root `brand/`. Token contract: [`brand.md`](./brand.md).

## Read these first

v10 is the authoritative product architecture. It amends the door-tip implementation
(`/` is the Door; `/explore` is the Atlas instrument) and supersedes v9’s
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
| **Atlas** (`/`, `/story`) | [`design-direction-v9-atlas.md`](./design-direction-v9-atlas.md) | `app/page.tsx`, `app/explore/*`, `components/story/*` | Binding (supersedes v6 home, explore, search) |
| **Chapters** (`/chapters`, `/chapters/[slug]`) | [`design-direction-v9-chapters.md`](./design-direction-v9-chapters.md) | `app/chapters/*`, `components/article/*`, `lib/articles/*` | Binding (v9). Chrome still v6 |
| **Every other public route** | [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) | see its section 4 resolution map | Proposed, binding on owner approval |
| **Mobile shell** (`@repo/mobile`) | [`design-direction-v6-mobile.md`](./design-direction-v6-mobile.md) | `apps/mobile/src/app/(tabs)/*`, `apps/mobile/src/shell/*`, `apps/mobile/src/ui/*` | Binding. **Ledger Line** polish (see [`mobile-polish-mockups.html`](./mobile-polish-mockups.html)) |

### Reusable component patterns

| Pattern | Binding doc | Code | Status |
|---|---|---|---|
| **Record anatomy layout** | [`patterns-record-anatomy.md`](./patterns-record-anatomy.md) | `RecordAnatomyPanel`, `record-anatomy.css`, mobile `AnatomySection` | Reusable |
| **Map entity encoding** | [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md) | `kind-encoding.ts`, `MapExperienceLegend.tsx`, `explore-style.ts` | Binding (map surfaces) |
| **Map canvas lifecycle** | [`patterns-map-canvas.md`](./patterns-map-canvas.md) | `map-libre-lifecycle.ts`, `MapStage.tsx`, `EntityLocationMap.tsx` | Binding (cross-browser WebGL) |
| **Edition fact icon** | [`patterns-edition-fact-icon.md`](./patterns-edition-fact-icon.md) | [`patterns-registry.md`](./patterns-registry.md) | Reusable |
| **Browse mode** | [`patterns-browse-mode.md`](./patterns-browse-mode.md) | [`patterns-registry.md`](./patterns-registry.md) | Reusable |
| **Footer** | [`patterns-site-footer.md`](./patterns-site-footer.md) | `SiteFooter.tsx`, `shell.css` `.ds-shell-footer*` | Reusable. Rewritten from the destination registry in SP-15 |
| **Utility edition** | [`patterns-utility-edition.md`](./patterns-utility-edition.md) | `components/patterns/utility-edition/*` | Reusable. Folded into the Utility surface class by v9 surfaces section 2.4 |
| **Cinematic map backdrop** | [`patterns-cinematic-map.md`](./patterns-cinematic-map.md) | `components/patterns/cinematic-map/*`, `MapStage.tsx`, `camera-presets.ts`, mobile `AppBottomSheet.tsx` + `mapCamera.ts` | Binding on mobile. On web, replaced by the Framed plate posture |
| **Voice & microcopy** | [`story.md`](./story.md), [`neo-voice.md`](../content/neo-voice.md) | All user-facing copy | Binding |
| **Learning index entity** | [`learning-index-entity.md`](./learning-index-entity.md) | Entity detail / index cards | Contract |
| **Add to Home Screen** | [`brand.md`](./brand.md) § Add to Home Screen / install icons | `public/manifest.webmanifest`, `layout.tsx` metadata | Installability (online-first; no service worker). The former `docs/notes/add-to-home-screen.md` was removed on 2026-07-24 and the link to it was left dangling; brand.md is the surviving source |

### Superseded, kept as the provenance record

None of these is deleted. They record why v9 exists and what was rejected. Do not build from them.

| Doc | Superseded by | Route today |
|---|---|---|
| [`design-direction-v5.md`](./design-direction-v5.md) | v6, then v9 | Historical |
| [`blap-design-direction-v4.md`](./blap-design-direction-v4.md) | v5 | Historical |
| [`design-direction-v6-home.md`](./design-direction-v6-home.md) | v9 Atlas | `/` |
| [`design-direction-v6-explore.md`](./design-direction-v6-explore.md) | v9 Atlas → **v10** | `/explore` is the live Instrument (not a 308 to `/`) |
| [`design-direction-v6-search.md`](./design-direction-v6-search.md) | v9 Atlas | `/search`, redirect |
| [`design-direction-v6-history.md`](./design-direction-v6-history.md) | v9 surfaces | `/history`, resolves to `/records` |
| [`design-direction-v6-stories.md`](./design-direction-v6-stories.md) | v9 chapters | `/stories`, 308 to `/chapters`. `app/stories` does not exist |
| [`design-direction-v6-themes.md`](./design-direction-v6-themes.md) | v9 chapters | `/themes`, 308 to `/chapters`. `app/themes` does not exist |
| [`design-direction-v6-about.md`](./design-direction-v6-about.md) | v9 surfaces | `/about` |
| [`design-direction-v6-books.md`](./design-direction-v6-books.md) | v9 surfaces | `/books`, `/books/[slug]` |
| [`design-direction-v6-data.md`](./design-direction-v6-data.md) | v9 surfaces | `/data` |
| [`design-direction-v6-law.md`](./design-direction-v6-law.md) | v9 surfaces | `/law`, `/law/[slug]` |
| [`design-direction-v6-memorial.md`](./design-direction-v6-memorial.md) | v9 surfaces | `/memorial` |
| [`design-direction-v6-methodology.md`](./design-direction-v6-methodology.md) | v9 surfaces | `/methodology` |
| [`design-direction-v6-entity.md`](./design-direction-v6-entity.md) | v9 surfaces, v9 record page | `/entity/[id]` |

The v6 supersessions listed against `design-direction-v9-surfaces.md` take effect on that document's approval. The three listed against v9 Atlas are in effect now.

**Component registry:** [`patterns-registry.md`](./patterns-registry.md) for import paths and adopters of `components/patterns/*`.

**Agent guardrails:** root [`AGENTS.md`](../../AGENTS.md) § UI Design Patterns; Cursor rule [`.cursor/rules/ui-design-patterns.mdc`](../../.cursor/rules/ui-design-patterns.mdc). Both paths were wrong in the previous index and resolved to `docs/`.

---

## How to add a pattern

1. **Check** this index and [`patterns-registry.md`](./patterns-registry.md). Extend an existing pattern before creating a parallel one.
2. **Codify** behavior in `docs/ui/patterns-<name>.md` (or the surface direction doc if layout-level only).
3. **Implement** under `apps/web/src/components/patterns/` when reusable across routes; otherwise in the surface folder with a doc citation.
4. **Register** a row in [`patterns-registry.md`](./patterns-registry.md) and the table above.
5. **Styles.** Flat matte, `--ds-*` tokens, light and dark, copper discipline per [`brand.md`](./brand.md). No raw hex in component CSS; new tokens go in `packages/ui/src/styles/tokens.css` and are mirrored in `packages/ui/src/tokens/colors.ts`.
6. **A11y.** WCAG 2.2 AA, `:focus-visible`, no colour-alone signals, 44px touch targets on controls.
7. **Copy.** No em dashes and no en dashes on touched surfaces; evidence-before-assertion tone per [`story.md`](./story.md).
8. **Tests.** Pure helpers and non-trivial interaction (see `browse-mode.test.tsx`). New test files under `apps/web` must be registered in `apps/web/package.json`'s `test` script: it is a hand-maintained file list, not a glob, and an unregistered test silently never runs.
9. **Same change.** Never merge UI without updating the binding doc when the pattern changes.

---

## Kit overview

Where this doc and `@repo/ui` disagree on tokens, **the kit wins**. Where a pattern doc specifies layout or behavior, **the pattern doc wins**. Where a design doc and [`brand.md`](./brand.md) disagree on the signature, palette or type, **brand.md wins**: it is the usage contract.

### What shipped

- **Palette (v3):** Archive Paper `#F4EFE5` canvas + Surface `#FBF8F2` / Black Ink primary; Copper Pin accent with copper text pairs `#8E4F2A` (light) and `#D07A32` (dark); light and dark themes via `data-theme`; radii 8/16/28px (sm/md/lg). Bevels, shadows, gradients and glows stay banned, with one v9 carve-out: a single soft tinted shadow on panels that float over the map plate, for z-order only.
- **Map plate roles (v9):** `--ds-map-*` land, water, green, line, line-2, road, label, label-hi, halo, contract-tested for CIE L\* separation in both themes.
- **Status colors:** warning, confidence, dispute, error only, re-derived to harmonize with the accent palette, always with a text or mono cue and never colour-alone.
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
- Filters use labelled native controls inside a `<fieldset>`
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

Verified against `apps/web/src/app/` on 2026-07-30. Surface classes are from [`patterns-surface-classes.md`](./patterns-surface-classes.md); a class in parentheses is the v9 resolution, not what ships today.

### Rendered pages

| Route | File | Class | Purpose |
|---|---|---|---|
| `/` | `app/page.tsx` | Instrument | The Atlas. Live map, records already on it |
| `/explore` | `app/explore/page.tsx` | Instrument | Folds into `/`; becomes a 308 |
| `/chapters` | `app/chapters/page.tsx` | Reading room | Long-form publication index. Destination for the articles, stories, themes and topics redirect families |
| `/chapters/[slug]` | `app/chapters/[slug]/page.tsx` | Reading room | Chapter detail with inline citations and numbered references |
| `/chapters/mosaic-credits` | `app/chapters/mosaic-credits/page.tsx` | Utility | Rights clearance for the atmosphere tiles |
| `/books` | `app/books/page.tsx` | Reading room | Banned and challenged books catalogue |
| `/books/[slug]` | `app/books/[slug]/page.tsx` | Record page | One title, its challenges and jurisdictions |
| `/law` | `app/law/page.tsx` | Reading room | Plain-language law reference |
| `/law/[slug]` | `app/law/[slug]/page.tsx` | Record page | One statute or ruling |
| `/entity/[id]` | `app/entity/[id]/page.tsx` | Record page | Record detail. `force-dynamic` |
| `/data` | `app/data/page.tsx` | Reading room | National Census and Phase 1 indicators |
| `/memorial` | `app/memorial/page.tsx` | Reading room | The names wall and the full list |
| `/about` | `app/about/page.tsx` | Reading room | Product thesis and the destinations block |
| `/methodology` | `app/methodology/page.tsx` | Reading room | Evidence pipeline, definitions, confidence, dignity |
| `/errata` | `app/errata/page.tsx` | Reading room | Corrections log, plus two feeds |
| `/history` | `app/history/page.tsx` | Reading room | Temporal browse. Resolves to `/records` under v9; the route file can never be deleted |
| `/locate` | `app/locate/page.tsx` | Instrument | Find your jurisdiction. Folds into the Lens Where group |
| `/corrections` | `app/corrections/page.tsx` | Utility | Correction intake, appeal and abuse report |
| `/corrections/status/[receiptCode]` | `app/corrections/status/[receiptCode]/page.tsx` | Utility | Public phase of one submission. Out of the sitemap |
| `/submit` | `app/submit/page.tsx` | Utility | Submit a lead |
| `/support` | `app/support/page.tsx` | Utility | Three named paths and a role mailbox |
| `/privacy` | `app/privacy/page.tsx` | Utility | Privacy policy in the methodology voice |
| `/design-system` | `app/design-system/page.tsx` | Utility | Component fixtures. Publicly linked, so it must not 404 |
| `/map` | `app/map/page.tsx` | Endpoint | Page-level redirect to `/explore`. Becomes a permanent config rule to `/` |
| `/search` | `app/search/page.tsx` | Endpoint | Filesystem redirect, currently shadowed by the config rule below |
| 404 | `app/not-found.tsx` | Utility | Genuinely unknown paths only |
| error boundary | `app/error.tsx` | Utility | Renders in place of whatever threw, URL preserved |
| entity loading | `app/entity/[id]/loading.tsx` | Record page | Streams at `/entity/[id]` while the record loads |

New under v9 and not built yet: `/records` (Reading room, the crawlable non-spatial index) and `/story` (Instrument, the six-chapter narrative). Both are in [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) section 4.

Routes that **do not exist**: `app/stories`, `app/themes`, `app/topics`, `app/articles`, `app/records`, `app/story`, `app/facts`, `app/myths`, `app/legal`. Every one of them is a redirect source only.

### Endpoints

| Route | File |
|---|---|
| `/explore/api` | `app/explore/api/route.ts` |
| `/history/api` | `app/history/api/route.ts` |
| `/search/api` | `app/search/api/route.ts` |
| `/locate/api` | `app/locate/api/route.ts` |
| `/submit/api` | `app/submit/api/route.ts` |
| `/corrections/api` | `app/corrections/api/route.ts` |
| `/corrections/abuse/api` | `app/corrections/abuse/api/route.ts` |
| `/corrections/appeal/api` | `app/corrections/appeal/api/route.ts` |
| `/corrections/status/api` | `app/corrections/status/api/route.ts` |
| `/api/request-integrity` | `app/api/request-integrity/route.ts` |
| `/errata/feed.json` | `app/errata/feed.json/route.ts` |
| `/errata/feed.xml` | `app/errata/feed.xml/route.ts` |
| `/ai.txt` | `app/ai.txt/route.ts` |
| `/.well-known/security.txt` | `app/.well-known/security.txt/route.ts` |
| `/robots.txt` | `app/robots.ts` |
| `/sitemap.xml` | `app/sitemap.ts` |

Sample entity ids: `ent_seed_place_001`, `ent_seed_school_001`. Data is labeled as seed/sample, not live projections.

### Redirects

**Source of truth: `apps/web/next.config.mjs`.** Every rule below is `permanent: true`, which emits 308. Order matters where a specific rule precedes a catch-all, and the file's comments say so.

| Source | Destination |
|---|---|
| `/articles/:slug` | `/chapters/:slug` |
| `/articles` | `/chapters` |
| `/stories` | `/chapters` |
| `/stories/mosaic-credits` | `/chapters/mosaic-credits` (must precede the `/stories/:path*` catch-all) |
| `/stories/:path*` | `/chapters` |
| `/themes` | `/chapters` |
| `/themes/redlining`, `/themes/redlining/:path*` | `/chapters/buying-a-home` (must precede the `/themes/:path*` catch-all) |
| `/themes/wealth_gap`, `/themes/wealth_gap/:path*` | `/chapters/the-gap-that-never-closed` (same) |
| `/themes/:path*` | `/chapters` |
| `/topics`, `/topics/:path*` | `/chapters` |
| `/facts`, `/facts/:path*` | `/history` |
| `/search` | `/history` |
| `/myths`, `/myths/:path*` | `/methodology` |
| `/legal` | `/law` |
| `/legal/:path*` | `/law/:path*` |

Outside the config, two filesystem routes redirect at page level: `app/map/page.tsx` calls `redirect('/explore')`, and `app/search/page.tsx` maps its query through `mapSearchQueryToHistoryHref` (unreachable today, because the config rule for `/search` runs first).

Under v9, `/facts` and `/facts/:path*` repoint straight to `/records` so they do not become a chain through `/history`; `/search`'s config rule is removed so the filesystem route runs and emits `/records` in one hop; `/map` becomes a permanent config rule to `/`; `/explore` gains a 308 to `/` with its query string; and the theme alias pairs are replaced by a generated table. See [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) section 4.

---

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
