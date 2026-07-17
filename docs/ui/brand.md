# Brand mark (BB-067)

The Black Book brand mark: two blocky "B" letterforms on a shared construction
grid. The first letter carries a pigment scale spanning the diaspora's range
of skin tones; the second letter is fixed brand ink. Source of truth is code,
not artwork — every rendering (in-app component, favicon, OG image, static
asset) is generated from the same construction grid in
`packages/ui/src/brand/`, so the mark cannot drift out of sync with itself.

This document is the mark's usage contract. If you're changing the mark, read
it first; if you're placing the mark somewhere new, the rules below are not
optional — they're what keeps "proud, modern, black" from sliding into
gimmick.

## Why this mark

The brief: equality, pride, soul, modern, black — never gimmicky, dated, or
side-projecty. "Minecraft blocky with a modern feel" was the internal
direction for concepting; it is not public-facing language, and the
execution deliberately steers away from it. Blocky construction reads as
*deliberate and constructed* — closer to a quilt block or a woodblock print
than a game sprite — because of three restraints applied everywhere:

1. **Generous, visible gutters** between blocks (not touching pixels). This
   is the single biggest lever separating "quilt" from "sprite."
2. **Flat matte fills only.** No bevels, no drop shadows, no glow, no
   gradients, no 3D, in any asset, ever.
3. **Large, confident blocks** (20 per letterform on a 5x7 grid) — not fine
   pixel detail.

Design precedent: Studio Museum in Harlem's identity proves 100%-black can
be a premium primary, not an absence of color. Gee's Bend quilts anchor the
block-composition idea in Black art history — a mosaic of large, deliberate
pieces, not a sprite. The pigment scale is what makes the grid *mean*
something rather than being decoration.

## Construction grid

Each letterform is a 5-column x 7-row grid of square blocks (a hand-drawn
bitmap "B," not a rendered font):

```
X X X X .
X . . . X
X . . . X
X X X X .
X . . . X
X . . . X
X X X X .
```

20 filled blocks per letter, 40 total for the "BB" lockup. Default geometry:
28px cell, 4px gutter, 48px gap between the two letters, 16px padding —
tunable via `MarkGeometryOptions`, but the 5x7 grid itself is fixed. Changing
cell/gutter/gap ratios is fine; changing the letterform grid is a brand
decision, not a styling one.

Source: `packages/ui/src/brand/glyph.ts` (grid data) and
`packages/ui/src/brand/geometry.ts` (pure layout math — shared by the React
component, the static-asset generator, and the Next.js icon/OG routes).

## The pigment scale

The first letter's 20 blocks are filled from a seven-tone pigment scale,
**scattered, not gradiented** — no two blocks adjacent in reading order, or
stacked in the same column, repeat a tone. This is deliberate: a top-to-
bottom gradient reads as a color ramp; a scatter reads as gathered pigments.
The arrangement is hand-curated and pinned by
`packages/ui/src/brand/scatter-map.test.ts`, so it can't quietly collapse
into a ramp during a future edit.

| Monk level | Hex | Name |
|---|---|---|
| 4 | `#EADABA` | Sand |
| 5 | `#D7BD96` | Wheat |
| 6 | `#A07E56` | Copper |
| 7 | `#825C43` | Clay |
| 8 | `#604134` | Umber |
| 9 | `#3A312A` | Walnut |
| 10 | `#292420` | Ebony |

(Rendered swatches: see `/design-system` in the running app, or open any of
the generated SVGs in `packages/ui/src/brand/assets/`.)

**Attribution (required wherever the scale is reused):** swatch values are
derived from the **Monk Skin Tone Scale**, © Google / Dr. Ellis Monk,
licensed **CC BY 4.0** (<https://skintone.google>,
<https://creativecommons.org/licenses/by/4.0/>). The code constant
`MONK_SCALE_ATTRIBUTION` in `packages/ui/src/tokens/pigment.ts` carries this
same line — keep the two in sync.

**Framing — read this before touching the pigment tokens:**

- This is a **pigment / material reference**, named for paint and wood
  pigments (Sand, Wheat, Copper, Clay, Umber, Walnut, Ebony) — deliberately
  *not* food words (no "caramel," "chocolate," etc.), which reduce people to
  consumables.
- It represents the **diaspora's range** in the abstract brand mark. It is
  **never** a classification system, and it is **never** applied to depict,
  tag, sort, or describe an individual person, photo, or dataset record. If
  a future feature wants to talk about a real person's appearance, this
  scale is the wrong tool — don't reach for it.
- It is not a Fitzpatrick scale, not an emoji skin-tone picker, and should
  never be presented as either.

## Variants

Three variants, each with a distinct, non-interchangeable purpose:

| Variant | First letter | Second letter | Use |
|---|---|---|---|
| `full-pigment` | Pigment scatter | Fixed solid black (`#000000`) | Light canvas — the hero mark |
| `reversed` | Pigment scatter (unchanged) | Fixed solid white (`#FFFFFF`) | Dark canvas — solid black would vanish |
| `mono` | `currentColor` | `currentColor` | Single-color contexts: header lockups, small/stamped placements, anywhere the mark must inherit the surrounding theme's ink color automatically |

`full-pigment` and `reversed` use **fixed** colors independent of the app's
light/dark theme tokens — the mark's identity doesn't shift with UI theme,
only with which canvas it sits on. `mono` is the one variant that's
theme-reactive (via CSS `currentColor`), which is why it's the correct
choice for in-app chrome like the site header, where the mark should track
`--bb-ink` automatically.

```tsx
import { BrandMark } from '@black-book/ui';

<BrandMark variant="full-pigment" size={40} />
<BrandMark variant="reversed" size={40} />
<BrandMark variant="mono" size={24} decorative />
```

Pass `decorative` when adjacent visible text already provides the accessible
name (e.g. a "Black Book" wordmark next to the mark) — it sets
`aria-hidden="true"` instead of `role="img"` + `aria-label`, so the name
isn't announced twice. Omit it when the mark stands alone.

## Committed static assets

`packages/ui/src/brand/assets/` holds generated SVG files for contexts
outside the app where CSS `currentColor` isn't available (letterhead, print,
partner press kits, social profile uploads, README badges):

- `bb-mark-full-pigment.svg`
- `bb-mark-mono.svg` (fixed black, not `currentColor` — static files can't
  inherit CSS)
- `bb-mark-reversed.svg` (on a black canvas rect)
- `bb-mark-favicon.svg` — single letterform only (see below), gutter
  collapsed to 0, solid ink
- `bb-mark-social-og.svg` — 1200x630 composed lockup + wordmark, for
  contexts that need a literal file rather than the generated route

Regenerate after any change to the geometry/pigment/scatter-map source:

```bash
pnpm --filter @black-book/ui generate:brand
```

**Never hand-edit files in `assets/`** — they're build output. Edit the
source modules and regenerate.

### In the Next.js app

The public web app does **not** use the static favicon/OG files — it
generates both at request time from the same shared geometry, so there is
exactly one source of truth and no static asset to forget to update:

- `apps/web/src/app/icon.tsx` — 64x64 PNG via `next/og` `ImageResponse`.
  Solid black tile with the single-letterform glyph in white, centered with
  aspect-correct fitting (the glyph is 5:7, not square — this must scale
  both axes and center, not stretch to fill).
- `apps/web/src/app/opengraph-image.tsx` — 1200x630 PNG, same mechanism,
  reusing `buildSocialLayout` from the brand barrel.

If the letterform grid or pigment scale ever changes, these two routes and
the static assets all pick it up from the same edit — nothing to keep in
sync by hand except running `generate:brand` for the static files.

## Clearspace and minimum sizes

- **Clearspace:** the mark's own padding (16px at default 28px cell size, or
  proportionally at any scale) is the minimum clearspace — don't crop
  tighter than the mark's own bounding box when placing it near other
  elements.
- **Minimum size, two-letter lockup (`full-pigment` / `reversed` / `mono`):**
  24px tall. Below that, the pigment scatter stops reading as distinct
  tones — drop to the single-letter favicon treatment instead.
- **Minimum size, single letterform (favicon-style):** 16px, gutter
  collapsed to 0 so blocks touch and the silhouette survives anti-aliasing
  at tab-icon scale. This is why the favicon is a *separate* asset, not the
  two-letter mark scaled down.

## Do / never

**Do:**

- Use `full-pigment` on light/neutral surfaces, `reversed` on dark/near-black
  surfaces, `mono` wherever the mark must inherit theme ink automatically.
- Keep the pigment scatter arrangement exactly as generated — it's
  test-enforced, not decorative choice.
- Regenerate static assets from source after any geometry/pigment change.
- Credit the Monk Skin Tone Scale (CC BY 4.0) wherever the pigment values
  are reused, in code or in written material.

**Never:**

- No bevels, 3D effects, drop shadows, glows, or gradients on the mark, in
  any variant, in any context — this is the line between "constructed" and
  "gamer," and it is absolute.
- Never use "Minecraft" or "video game" language in public-facing copy about
  the mark. The internal concepting reference is not brand voice.
- Never recolor the pigment blocks to anything outside the seven-tone scale,
  and never reorder them into a gradient ramp.
- Never apply the pigment scale to a real person, photo, or dataset record —
  it is a brand asset, not a classification tool (see Framing, above).
- Never use Fitzpatrick-scale language, emoji skin-tone iconography, or
  kente-cloth / other appropriated-pattern clip art anywhere near the mark.
- Never crop a letterform mid-block, stretch the mark to a non-native aspect
  ratio, or place it below its minimum size for the variant in use.
- Never hand-edit the generated files in `packages/ui/src/brand/assets/`.

## Source map

| What | Where |
|---|---|
| Grid data | `packages/ui/src/brand/glyph.ts` |
| Pigment scale + attribution | `packages/ui/src/tokens/pigment.ts` |
| Scatter arrangement | `packages/ui/src/brand/scatter-map.ts` (+ `.test.ts`) |
| Layout math | `packages/ui/src/brand/geometry.ts` (+ `.test.ts`) |
| React component | `packages/ui/src/brand/BrandMark.tsx` |
| Static-asset generator | `packages/ui/scripts/generate-brand-marks.ts` |
| Committed static assets | `packages/ui/src/brand/assets/` |
| Web favicon (generated) | `apps/web/src/app/icon.tsx` |
| Web OG image (generated) | `apps/web/src/app/opengraph-image.tsx` |
| Header integration | `apps/web/src/components/SiteHeader.tsx` |
| Admin integration | `apps/admin/src/app/page.tsx` |

See also `docs/ui/README.md` for the broader design-system tokens and
components this mark sits alongside, and `docs/ui/story.md` (BB-069) for
brand voice and narrative.
