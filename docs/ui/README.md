# Design system

Shared package: `@repo/ui` (`packages/ui`). The binding brand source is the
root `brand/` directory; where this doc and the kit disagree, the kit wins.

See also [`brand.md`](./brand.md) for the full usage
contract: signature, palette, typography, and usage rules; [`story.md`](./story.md)
(BB-069) for brand voice, narrative arc, and microcopy standards; and
[`learning-index-entity.md`](./learning-index-entity.md) for the learning-index
entity contract (summary, tags, related hops, enrichable prose, photo).

## What shipped

- **Palette (v3, BB-096):** Archive Paper `#F4EFE5` canvas + Surface
  `#FBF8F2` / Black Ink primary; Copper Pin accent with copper text pairs
  `#8E4F2A` (light) / `#D07A32` (dark); light and dark themes via
  `data-theme` (dark is first-class, not an afterthought); radii 8/16/28px
  (sm/md/lg) — the earlier zero-radius rule is superseded, but bevels,
  shadows, gradients, and glows stay banned
- **Status colors:** warning, confidence, dispute, error only, re-derived
  to harmonize with the accent palette (with text/mono cues — never
  color-alone)
- **Typography (v3, BB-096):** Inter Display (display/headlines, served
  via the Inter v4 variable font's `opsz` axis) + Inter (UI/body) + Source
  Serif 4 (editorial/longform) + IBM Plex Mono (data/citations) — all
  free/open-source, no licensing budget gate
- **Tokens:** grid, spacing, elevation, border, icon, motion, focus,
  pigment-anchored data-viz
- **Components:** Card, Citation, Confidence, Timeline, MapFrame, ResultList, FilterBar, Dialog, Notice, EmptyState, Button, ThemeToggle
- **Fixtures:** public route `/design-system` (Storybook equivalent)
- **Public shell (BB-048 + map-led home):** news shell — paper/ink primary,
  map-led homepage hero, story rails, sticky masthead


## Usage

```tsx
import '@repo/ui/styles.css';
import { Card, Confidence, Notice } from '@repo/ui';
```

In Next apps, add `@repo/ui` to `transpilePackages` and prefer `next/font` variables mapped to `--ds-font-display`, `--ds-font-editorial`, `--ds-font-sans`, and `--ds-font-mono`.

## Accessibility

- WCAG 2.2 AA contrast validated in `packages/ui` token tests (AAA for primary ink/canvas)
- Visible `:focus-visible` rings; skip link becomes visible on focus
- `prefers-reduced-motion` collapses animation/transition durations
- Dialog uses native `<dialog>` (modal focus + Escape)
- Filters use labelled native controls inside a `<fieldset>`
- Public shell: landmarks (`header` / `main` / `footer` / `nav`), skip link, responsive menu via `<details>`

## Commands

```bash
pnpm --filter @repo/ui test
pnpm --filter @repo/web exec next dev --port 3048
# or: pnpm --filter @repo/web dev
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
- Admin now consumes `@repo/ui` (transpiled + `.js`->`.ts` webpack
  resolution, matching web's config) and renders the brand mark on its
  home page; admin doesn't yet load the display/sans font families via
  `next/font` (falls back to the CSS `font-family` string literals) — low
  priority since the console isn't public-facing
- Map-led homepage arc (`docs/ui/story.md`) is blocked on BB-070 (map data
  platform) and BB-051 (national map experience) — the current hero is an
  intentional text-led interim, not the target design
