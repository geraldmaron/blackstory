# Design system (BB-007)

Shared package: `@black-book/ui` (`packages/ui`).

## What shipped

- **Palette:** black / white / neutral grays; light and dark themes via `data-theme`
- **Status colors:** warning, confidence, dispute, error only (with text/mono cues — never color-alone)
- **Typography:** Source Serif 4 (editorial) + Source Sans 3 + IBM Plex Mono (technical)
- **Tokens:** grid, spacing, elevation, border, icon, motion, focus, data-viz
- **Components:** Card, Citation, Confidence, Timeline, MapFrame, ResultList, FilterBar, Dialog, Notice, EmptyState, Button, ThemeToggle
- **Fixtures:** public route `/design-system` (Storybook equivalent) — not full BB-048 product shell

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

## Commands

```bash
pnpm --filter @black-book/ui test
pnpm --filter @black-book/web dev   # http://localhost:3000/design-system
```

## Remaining UI gaps (later beads)

- Full public shell / navigation (BB-048)
- Product pages and search UX (BB-049+)
- Dedicated Storybook/Chromatic if visual regression CI is required later
- Admin console theming (BB-056) should reuse these tokens
