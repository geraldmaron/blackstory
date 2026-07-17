# Design system (BB-007)

Shared package: `@black-book/ui` (`packages/ui`).

## What shipped

- **Palette:** black / white / neutral grays; light and dark themes via `data-theme`
- **Status colors:** warning, confidence, dispute, error only (with text/mono cues — never color-alone)
- **Typography:** Source Serif 4 (editorial) + Source Sans 3 + IBM Plex Mono (technical)
- **Tokens:** grid, spacing, elevation, border, icon, motion, focus, data-viz
- **Components:** Card, Citation, Confidence, Timeline, MapFrame, ResultList, FilterBar, Dialog, Notice, EmptyState, Button, ThemeToggle
- **Fixtures:** public route `/design-system` (Storybook equivalent)
- **Public shell (BB-048):** modern Gen Z news shell on port **3048** — black/white primary, full-bleed hero, story rails, sticky masthead


## Usage

```tsx
import '@black-book/ui/styles.css';
import { Card, Confidence, Notice } from '@black-book/ui';
```

In Next apps, add `@black-book/ui` to `transpilePackages` and prefer `next/font` variables mapped to `--bb-font-editorial`, `--bb-font-sans`, and `--bb-font-mono`.

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
- Admin console theming (BB-056) should reuse these tokens
