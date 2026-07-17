# Brand mark: the Pinned Page (BB-067 / BB-068)

The Black Book mark: a closed book cover forms an asymmetric "B," curved
page-edge bands are exposed at the spine, and a location pin is integrated
into the lower-left of the cover — **history, pinned to place.** Source of
truth is code, not artwork: every in-app rendering (header, admin console,
favicon, OG image) is generated from the same geometry in
`packages/ui/src/brand/BlackBookLogo.tsx`, so the mark cannot drift out of
sync with itself.

This document is the mark's usage contract, superseding the earlier
BB-067 blocky-letterform/Monk-Skin-Tone-Scale concept. If you're changing
the mark, read this first.

## Provenance

The mark, palette, and type system come from an owner-supplied brand
package (2026-07-17, `black-book-brand-package/`) — reference PNGs and the
original package README are archived at `docs/ui/brand-reference/` for
comparison. The geometry is original to that package (not a font glyph or
stock book/pin icon); it has not been run through a trademark clearance
search — do that before any public launch or partner-facing use beyond this
repo.

## Why this mark

The brief: equality, pride, soul, modern, black — never gimmicky, dated, or
side-projecty. A pinned page is a literal, legible metaphor for the
product's thesis (an archive of Black history anchored to place, not an
abstract classification device), which is why it replaces the earlier
diaspora-pigment-scale concept: that direction risked reading as a skin-tone
classification tool even with careful framing, where this one reads
immediately as "book + place" with no such adjacency. Three restraints keep
it from sliding into cliché:

1. **Flat matte fills only.** No bevels, no drop shadows, no glow, no
   gradients, no 3D, in any asset, ever.
2. **One loaded accent color** (Copper Pin) carried by the pin and, sparingly,
   by the page-edge bands — never scattered across unrelated chrome.
3. **The pin is integrated, not applied.** It sits inside the cover
   silhouette, not bolted on as a separate badge.

## The palette

| Role | Hex | Name | Use |
|---|---|---|---|
| Ink | `#0A0A0A` | Black Ink | Primary ink; near-black, not pure `#000` |
| Canvas | `#F4EFE5` | Archive Paper | Primary canvas; warm off-white, not pure `#FFF` |
| Accent (graphic) | `#B86B2A` | Copper Pin | The mark's pin; large-scale/graphic UI use (icons, borders, tags) — **3:1 contrast only, not body text** |
| Accent (text-safe) | `#7A4318` | Copper Ink | Darkened Copper Pin for links/text on the light theme's Archive Paper canvas (6.9:1) |
| Accent (muted) | `#D8A178` | Page Sand | Page-edge bands, decorative fills; text-safe as the **dark theme's** accent (8.8:1 on Black Ink) |

Fixed swatches live in `packages/ui/src/tokens/brand-palette.ts`
(`brandPalette`). Theme-reactive, contrast-safe applications (which swatch
is safe for text vs. graphics, per theme) live in
`packages/ui/src/tokens/colors.ts` as the `accent` / `accentGraphic` /
`accentMuted` roles — see that file's `criticalTextPairs` /
`criticalUiPairs` and `contrast.test.ts` for the enforced ratios. Never use
raw Copper Pin (`#B86B2A`) as small/body text color on the light theme's
Archive Paper canvas — it only clears the 3:1 UI/large-text bar (3.54:1),
not the 4.5:1 body-text bar. Page Sand (`#D8A178`) is a fill/graphic color
on light canvases only (1.97:1) — never foreground text there.

## Typography

Site type system (owner-supplied, all open-source / Google Fonts — no
licensing cost or budget gate):

| Role | Family | Token |
|---|---|---|
| Headlines / display | Sora (SemiBold 600) | `--bb-font-display` |
| UI / body (sans contexts) | Inter | `--bb-font-sans` |
| Editorial / longform body | Source Serif 4 | `--bb-font-editorial` |
| Data / citations / mono | IBM Plex Mono | `--bb-font-mono` |

Loaded via `next/font/google` in `apps/web/src/app/layout.tsx`. Longform
body copy stays serif (Source Serif 4); headlines, wordmark, section
titles, and story-rail titles use the Sora display family — see
`packages/ui/src/tokens/typography.ts` (`fontFamilies`, `typeScale`) and
`apps/web/src/app/shell.css` (`.bb-page__title`, `.bb-section__title`,
`.bb-story-link__title`, `.bb-shell-wordmark`, `.bb-hero__brand`).

## Variants

```tsx
import { BlackBookLogo, BlackBookMark } from '@black-book/ui';

<BlackBookLogo variant="horizontal" size={112} tagline="History, pinned to place." />
<BlackBookLogo variant="stacked" size={96} />
<BlackBookLogo variant="mark" size={40} />
<BlackBookLogo variant="app-icon" size={96} />
```

`variant`:

| Variant | Renders | Use |
|---|---|---|
| `horizontal` | Symbol + "BLACK BOOK" wordmark side by side | Default lockup; masthead, share cards |
| `stacked` | Symbol above wordmark | Square/social placements |
| `mark` | Symbol only | Small chrome, favicons, inline references |
| `app-icon` | Symbol on a rounded-square tile | App/PWA icon |

For bare-symbol placements that need to track surrounding theme color
automatically (site header, admin masthead), use the lower-level
`BlackBookMark` directly with explicit `ink`/`paper`/`accent` props tied to
CSS variables — see `apps/web/src/components/SiteHeader.tsx` and
`apps/admin/src/app/page.tsx` for the pattern (`ink="var(--bb-ink)"`,
`paper="var(--bb-canvas)"`, `accent="var(--bb-accent-graphic)"`).

`paper` fills the small punch-through circle at the pin's base — always set
it to whatever color the mark is sitting on, not a fixed brand color,
or the "hole" reads as a solid dot instead of a cutout.

Pass `decorative` (on `BlackBookLogo`) or wrap `BlackBookMark` in an
`aria-hidden` element when adjacent visible text already provides the
accessible name — don't announce "Black Book" twice.

## Committed static assets

`packages/ui/src/brand/assets/` holds authored SVG exports from the source
brand package, for contexts outside the app where the React component isn't
available (letterhead, print, partner press kits, social profile uploads,
README badges):

- `bb-logo-mark.svg` — full-color symbol
- `bb-logo-mark-compact.svg` — reduced-detail symbol for small placements
- `bb-logo-app-icon.svg` — rounded-square app icon
- `bb-logo-lockup-horizontal.svg` — symbol + wordmark lockup

These are **authored assets, not generated output** — there is no
`generate:brand` build step for this mark (unlike the superseded grid
system). If the geometry changes, re-export from the design source and
replace these files directly.

### In the Next.js app

The public web app does not use the static favicon/OG files — it generates
both at request time from the same shared `BlackBookMark` component, so
there is exactly one source of truth for the interactive contexts:

- `apps/web/src/app/icon.tsx` — 64x64 PNG via `next/og` `ImageResponse`.
  Black Ink tile with the mark in Archive Paper/Copper Pin, centered.
- `apps/web/src/app/opengraph-image.tsx` — 1200x630 PNG, same mechanism,
  Archive Paper canvas with the full mark, wordmark, and tagline.

## Clearspace and minimum sizes

- **Clearspace:** treat the mark's own bounding box as the minimum
  clearspace — don't crop tighter when placing it near other elements.
- **Minimum size, full detail:** 32px tall. Below that, switch `detail` to
  `"compact"` (2 page-edge bands instead of 4, thicker strokes) — used
  automatically by the header/admin/favicon integrations above 24-28px.
- **Minimum size, compact:** 16px. This is why favicons and small header
  marks pass `detail="compact"` rather than scaling the full mark down.

## Do / never

**Do:**

- Use the horizontal lockup as the default hero mark; use `mark`/`app-icon`
  for small/square chrome.
- Keep `paper` matched to the actual surface behind the mark so the pin's
  punch-through circle reads correctly.
- Use Copper Pin (`#B86B2A`) for graphic/large-scale accents; use Copper Ink
  (`#7A4318`) wherever the accent carries body text on a light canvas.
- Credit the source brand package when reusing these assets outside this
  repo (see `docs/ui/brand-reference/source-package-README.txt`).

**Never:**

- No bevels, 3D effects, drop shadows, glows, or gradients on the mark, in
  any variant, in any context.
- Never use raw Copper Pin as small/body text color on a light canvas — it
  fails the 4.5:1 text bar (see palette table above).
- Never stretch the mark to a non-square aspect ratio, or place it below its
  minimum size for the detail level in use.
- Never reintroduce the retired Monk Skin Tone Scale pigment mapping
  (superseded 2026-07-17) — if a future feature needs to discuss a real
  person's appearance, neither that retired system nor this brand palette is
  the right tool.

## Source map

| What | Where |
|---|---|
| Fixed brand palette | `packages/ui/src/tokens/brand-palette.ts` |
| Theme-safe accent roles + contrast enforcement | `packages/ui/src/tokens/colors.ts`, `contrast.test.ts` |
| Type system | `packages/ui/src/tokens/typography.ts` |
| Mark + logo component | `packages/ui/src/brand/BlackBookLogo.tsx` |
| Logo layout CSS | `packages/ui/src/styles/brand-logo.css` |
| Authored static assets | `packages/ui/src/brand/assets/` |
| Reference PNGs + source package README | `docs/ui/brand-reference/` |
| Web favicon (generated) | `apps/web/src/app/icon.tsx` |
| Web OG image (generated) | `apps/web/src/app/opengraph-image.tsx` |
| Header integration | `apps/web/src/components/SiteHeader.tsx` |
| Admin integration | `apps/admin/src/app/page.tsx` |

See also `docs/ui/README.md` for the broader design-system tokens and
components this mark sits alongside, and `docs/ui/story.md` (BB-069) for
brand voice and narrative.
