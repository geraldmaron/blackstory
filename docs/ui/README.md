# Design system & UI patterns

**Start here** for any agent or human shipping public UI. This file is the living pattern index; keep it updated when patterns are added or superseded.

Shared kit: `@repo/ui` (`packages/ui`). Binding brand source: root `brand/`. Token contract: [`brand.md`](./brand.md).

## Pattern index

| Pattern | Binding doc | Code | Status |
|---|---|---|---|
| **Home edition** (`/`) | [`design-direction-v6-home.md`](./design-direction-v6-home.md) | `apps/web/src/components/home/*`, `app/(map)/` | Binding (supersedes v5 home beats) |
| **Explore** (`/explore`) | [`design-direction-v6-explore.md`](./design-direction-v6-explore.md) | `app/(map)/explore/*`, map-surfaces.css | Binding (supersedes v5 explore cockpit) |
| **History** (`/history`) | [`design-direction-v6-history.md`](./design-direction-v6-history.md) | `app/history/*`, `components/history/*` | Binding — unified find-in-time (search merged) |
| **About** (`/about`) | [`design-direction-v6-about.md`](./design-direction-v6-about.md) | `app/about/*`, `edition-atmosphere` pattern | Binding (supersedes v5 about mast) |
| **Memorial** (`/memorial`) | [`design-direction-v6-memorial.md`](./design-direction-v6-memorial.md) | `app/memorial/*`, `patterns/memorial-wall/*` | Binding (names-only wall + full list) |
| **Stories** (`/stories`) | [`design-direction-v6-stories.md`](./design-direction-v6-stories.md) | `app/stories/*`, `edition-atmosphere/*` | Binding (supersedes v5 story mast) |
| **Methodology** (`/methodology`) | [`design-direction-v6-methodology.md`](./design-direction-v6-methodology.md) | `app/methodology/*`, `edition-atmosphere/*` | Binding (supersedes v5 page mast) |
| **Books** (`/books`) | [`design-direction-v6-books.md`](./design-direction-v6-books.md) | `app/books/*`, `edition-atmosphere/*` | Binding (supersedes v5 books browse + entity detail) |
| **Data** (`/data`) | [`design-direction-v6-data.md`](./design-direction-v6-data.md) | `app/data/*`, `components/data/*` | Binding (supersedes v5 data mast) |
| **Law** (`/law`) | [`design-direction-v6-law.md`](./design-direction-v6-law.md) | `app/law/*`, `edition-atmosphere/*` | Binding (supersedes v5 law browse mast) |
| **Themes** (`/themes`) | [`design-direction-v6-themes.md`](./design-direction-v6-themes.md) | `app/themes/*`, `theme-impact/*`, `edition-atmosphere/*` | Binding (supersedes v5 themes mast) |
| **Utility edition** (locate, submit, corrections, status, 404, error) | [`patterns-utility-edition.md`](./patterns-utility-edition.md) | `components/patterns/utility-edition/*` | Reusable (compact v6 Surface stack) |
| **Footer** | [`patterns-site-footer.md`](./patterns-site-footer.md) | `SiteFooter.tsx`, `shell.css` `.ds-shell-footer*` | Reusable (Surface card sitewide) |
| **Browse mode** | [`patterns-browse-mode.md`](./patterns-browse-mode.md) | [`patterns-registry.md`](./patterns-registry.md) | Reusable |
| **Edition fact icon** | [`patterns-edition-fact-icon.md`](./patterns-edition-fact-icon.md) | [`patterns-registry.md`](./patterns-registry.md) | Reusable |
| **Map entity encoding** | [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md) | `kind-encoding.ts`, `MapExperienceLegend.tsx`, `explore-style.ts` | Binding (Explore map) |
| **Map canvas lifecycle** | [`patterns-map-canvas.md`](./patterns-map-canvas.md) | `map-libre-lifecycle.ts`, `MapStage.tsx`, `EntityLocationMap.tsx` | Binding (cross-browser WebGL) |
| **Search redirect** | [`design-direction-v6-search.md`](./design-direction-v6-search.md) (superseded) | `app/search/page.tsx` | Redirect → `/history` |
| **Entity** (`/entity/[id]`) | [`design-direction-v6-entity.md`](./design-direction-v6-entity.md) | `app/entity/[id]/*`, `components/entity/*`, `edition-atmosphere/*` | Binding (supersedes v5 entity mast + aside) |
| **Mobile shell** (`@repo/mobile`) | [`design-direction-v6-mobile.md`](./design-direction-v6-mobile.md) | `apps/mobile/src/app/(tabs)/*`, `apps/mobile/src/shell/*` | Binding (tab IA + More menu aligned with web v6) |
| **Voice & microcopy** | [`story.md`](./story.md) | All user-facing copy | Binding |
| **Learning index entity** | [`learning-index-entity.md`](./learning-index-entity.md) | Entity detail / index cards | Contract |

**Component registry:** [`patterns-registry.md`](./patterns-registry.md) — import paths and adopters for `components/patterns/*`.

**Agent guardrails:** root [`AGENTS.md`](../AGENTS.md) § UI Design Patterns; Cursor rule [`.cursor/rules/ui-design-patterns.mdc`](../.cursor/rules/ui-design-patterns.mdc).

---

## How to add a pattern

1. **Check** this index and [`patterns-registry.md`](./patterns-registry.md) — extend an existing pattern before creating a parallel one.
2. **Codify** behavior in `docs/ui/patterns-<name>.md` (or the surface direction doc if layout-level only).
3. **Implement** under `apps/web/src/components/patterns/` when reusable across routes; otherwise in the surface folder with a doc citation.
4. **Register** a row in [`patterns-registry.md`](./patterns-registry.md) and the table above.
5. **Styles** — flat matte, `--ds-*` tokens, light + dark, copper discipline per [`brand.md`](./brand.md).
6. **A11y** — WCAG 2.2 AA, `:focus-visible`, no color-alone signals; 44px touch targets on controls.
7. **Copy** — no em dashes on touched surfaces; evidence-before-assertion tone per [`story.md`](./story.md).
8. **Tests** — pure helpers and non-trivial interaction (see `browse-mode.test.tsx`).
9. **Same change** — never merge UI without updating the binding doc when the pattern changes.

---

## Kit overview

Where this doc and `@repo/ui` disagree on tokens, **the kit wins**. Where a pattern doc specifies layout or behavior, **the pattern doc wins**.

See also [`brand.md`](./brand.md) for signature, palette, typography, and usage rules; [`design-direction-v5.md`](./design-direction-v5.md) for non-home surface layout and chrome law; [`design-direction-v6-home.md`](./design-direction-v6-home.md) as the **binding layout pattern for `/`** (supersedes v5 home beats only); [`design-direction-v6-explore.md`](./design-direction-v6-explore.md) as the **binding layout pattern for `/explore`** (supersedes v5 explore cockpit); [`design-direction-v6-about.md`](./design-direction-v6-about.md) as the **binding layout pattern for `/about`** (supersedes v5 about mast); [`design-direction-v6-methodology.md`](./design-direction-v6-methodology.md) as the **binding layout pattern for `/methodology`** (supersedes v5 page mast); [`design-direction-v6-law.md`](./design-direction-v6-law.md) as the **binding layout pattern for `/law`** (supersedes v5 law browse mast); [`design-direction-v6-data.md`](./design-direction-v6-data.md) as the **binding layout pattern for `/data`** (supersedes v5 data mast); [`design-direction-v6-search.md`](./design-direction-v6-search.md) as the **binding layout pattern for `/search`** (superseded); [`patterns-site-footer.md`](./patterns-site-footer.md) for the theme-aware Surface footer card.

### What shipped

- **Palette (v3):** Archive Paper `#F4EFE5` canvas + Surface `#FBF8F2` / Black Ink primary; Copper Pin accent with copper text pairs `#8E4F2A` (light) / `#D07A32` (dark); light and dark themes via `data-theme`; radii 8/16/28px (sm/md/lg) — bevels, shadows, gradients, and glows stay banned
- **Status colors:** warning, confidence, dispute, error only, re-derived to harmonize with the accent palette (with text/mono cues — never color-alone)
- **Typography (v3):** Inter Display + Inter + Source Serif 4 + IBM Plex Mono — all free/open-source
- **Tokens:** grid, spacing, elevation, border, icon, motion, focus, pigment-anchored data-viz
- **Components:** Card, Citation, Confidence, Timeline, MapFrame, ResultList, FilterBar, Dialog, Notice, EmptyState, Button, ThemeToggle
- **Fixtures:** public route `/design-system`
- **Public shell:** paper/ink primary, map-led homepage hero, story rails, sticky masthead

### Usage

```tsx
import '@repo/ui/styles.css';
import { Card, Confidence, Notice } from '@repo/ui';
```

In Next apps, add `@repo/ui` to `transpilePackages` and prefer `next/font` variables mapped to `--ds-font-display`, `--ds-font-editorial`, `--ds-font-sans`, and `--ds-font-mono`.

### Accessibility

- WCAG 2.2 AA contrast validated in `packages/ui` token tests (AAA for primary ink/canvas)
- Visible `:focus-visible` rings; skip link becomes visible on focus
- `prefers-reduced-motion` collapses animation/transition durations
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

### Public routes

| Route | Purpose |
|-------|---------|
| `/` | Home / product framing + featured seed records |
| `/search` | Legacy redirect to `/history` (query params preserved) |
| `/explore` | Full atlas map-first surface (`design-direction-v6-explore.md`) |
| `/history` | Temporal browse by decade (`design-direction-v6-history.md`) |
| `/stories` | History articles from the archive (`design-direction-v6-stories.md`) |
| `/data` | National Census and Phase 1 indicators (`design-direction-v6-data.md`) |
| `/themes` | Policy-impact theme packets (`design-direction-v6-themes.md`) |
| `/methodology` | Transparency receipt: evidence pipeline, definitions, confidence, dignity (`design-direction-v6-methodology.md`) |
| `/law` | Plain-language law reference |
| `/about` | Product framing |
| `/corrections` | Correction intake (v6 utility edition) |
| `/locate` | Find your jurisdiction (v6 utility edition) |
| `/submit` | Submit a lead (v6 utility edition) |
| `/errata` | Errata log |
| `/entity/[id]` | Entity detail scaffold |
| `/design-system` | Component fixtures |

Sample entity ids: `ent_seed_place_001`, `ent_seed_school_001`. Data is labeled as seed/sample — not live projections.

### Remaining UI gaps (later beads)

**v6 utility edition — still on v5 mast (`ds-page__eyebrow`):**

| Route | Path | Bead / owner |
|---|---|---|
| Errata log | `app/errata/page.tsx` | `repo-49wc` |
| Support | `app/support/page.tsx` | `repo-49wc` |
| Privacy policy | `app/privacy/page.tsx` | `repo-49wc` |
| Design-system fixtures | `app/design-system/page.tsx` | `repo-szam` (intentionally v5-labelled until refresh) |

**Other deferred:**

| Route | Notes |
|---|---|
| `/entity/[id]` | v6 edition in progress (`entity-edition.css`, sibling session) |
| `/entity/[id]/loading` | Still v5 eyebrow; align when entity detail lands |
| Entity detail depth + evidence UI | Full record spine |
| Live public projections and search API | Backend |
| Geocoding / nearby discovery | Backend |
| Dedicated Storybook/Chromatic | Visual regression CI if required later |

**Shipped this wave (utility edition):** `/locate`, `/submit`, `/corrections`, `/corrections/status/[receiptCode]`, global `not-found`, segment `error`.

**Already v6 (no action):** home, explore, history (+search redirect), stories, about, methodology, books, data, law, themes browse + detail + question pages, mosaic-credits, footer.

**Redirects (no chrome):** `/search` → `/history`, `/topics` → `/stories`, `/map` → `/explore`.
