# Design system (BB-007 / BB-068 v2)

Shared package: `@black-book/ui` (`packages/ui`).

See also [`brand.md`](./brand.md) (BB-067/BB-068) for the "Pinned Page" mark:
geometry, palette, typography, and usage rules; and [`story.md`](./story.md)
(BB-069) for brand voice, narrative arc, and microcopy standards.

## What shipped

- **Palette (v2):** White canvas / Black Ink primary; Copper Pin +
  Page Sand brand accent; light and dark themes via `data-theme` (dark is
  first-class, not an afterthought)
- **Status colors:** warning, confidence, dispute, error only, re-derived
  to harmonize with the accent palette (with text/mono cues — never
  color-alone)
- **Typography (v2):** Sora (display/headlines) + Inter (UI/body) + Source
  Serif 4 (editorial/longform) + IBM Plex Mono (data/citations) — all
  free/open-source, no licensing budget gate
- **Tokens:** grid, spacing, elevation, border, icon, motion, focus,
  pigment-anchored data-viz
- **Components:** Card, Citation, Confidence, Timeline, MapFrame, ResultList, FilterBar, Dialog, Notice, EmptyState, Button, ThemeToggle
- **Fixtures:** public route `/design-system` (Storybook equivalent)
- **Public shell (BB-048 + map-led home):** news shell — white/black primary,
  map-led homepage hero, story rails, sticky masthead


## Usage

```tsx
import '@black-book/ui/styles.css';
import { Card, Confidence, Notice } from '@black-book/ui';
```

In Next apps, add `@black-book/ui` to `transpilePackages` and prefer `next/font` variables mapped to `--bb-font-display`, `--bb-font-editorial`, `--bb-font-sans`, and `--bb-font-mono`.

## Accessibility

- WCAG 2.2 AA contrast validated in `packages/ui` token tests (AAA for primary ink/canvas)
- Visible `:focus-visible` rings; skip link becomes visible on focus
- `prefers-reduced-motion` collapses animation/transition durations
- Dialog uses native `<dialog>` (modal focus + Escape)
- Filters use labelled native controls inside a `<fieldset>`
- Public shell: landmarks (`header` / `main` / `footer` / `nav`), skip link, responsive menu via `<details>`

## Commands

```bash
pnpm --filter @black-book/ui test
pnpm --filter @black-book/web exec next dev --port 3048
# or: pnpm --filter @black-book/web dev
# → http://localhost:3048/
# → http://localhost:3048/design-system
```

## Public routes (BB-048)

| Route | Purpose |
|-------|---------|
| `/` | Home / product framing + featured seed records |
| `/search` | Seed-backed browse with FilterBar + ResultList |
| `/explore` | Location discovery scaffold (BB-050 later) |
| `/topics` | Thematic entry points |
| `/methodology` | Inclusion, confidence, precision |
| `/about` | Product framing |
| `/corrections` | Correction intake scaffold (BB-055 later) |
| `/entity/[id]` | Entity detail scaffold (seed ids) |
| `/design-system` | BB-007 component fixtures |

Sample entity ids: `ent_seed_place_001`, `ent_seed_school_001`. Data is labeled as seed/sample — not live projections (BB-019).

## Remaining UI gaps (later beads)

- Live public projections (BB-019) and search API (BB-049)
- Geocoding / nearby discovery (BB-050)
- Full entity depth + evidence UI (BB-052 / BB-053)
- Dedicated Storybook/Chromatic if visual regression CI is required later
- Admin now consumes `@black-book/ui` (transpiled + `.js`->`.ts` webpack
  resolution, matching web's config) and renders the brand mark on its
  home page; admin doesn't yet load the display/sans font families via
  `next/font` (falls back to the CSS `font-family` string literals) — low
  priority since the console isn't public-facing
- Map-led homepage arc (`docs/ui/story.md`) is blocked on BB-070 (map data
  platform) and BB-051 (national map experience) — the current hero is an
  intentional text-led interim, not the target design
