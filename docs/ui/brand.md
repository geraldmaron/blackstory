# Brand: usage contract

> **Binding source (2026-07-18):** root `brand/` — BlackStory full polished kit
> (book-and-pin symbol + wordmark, light/dark transparent lockups and symbols,
> app icons, 4-page guide, token files). Served copies use **role-based** paths
> under `apps/web/public/brand/` (`lockup-*.png`, `symbol-*.png`,
> `open-graph-*-1200x630.png`, favicons, apple-touch, install icons). Call sites must use
> those role names (or `@repo/config` `BRAND_ASSETS` helpers), never
> product-prefixed filenames.

**Product name:** BlackStory. Core line: *History, pinned to place.* Support:
*People. Places. Evidence. Context.*

**Code prefixes are brand-agnostic** (do not rename for a product rebrand):

| Layer | Stable value |
|---|---|
| npm packages | `@repo/*` |
| CSS classes / tokens | `ds-*` / `--ds-*` |
| Env break-glass | `APP_*` |

Product rename = identity module + `brand/` + display names. Not a monorepo rewrite.

**Beads / issue tracker:** internal ops only. Never put bead ids (`repo-…`,
legacy `BB-…`, etc.) in user-facing copy, admin chrome, error strings, or
source comments that ship with the product. Cite ADRs or capability names.

This document is the usage contract for the signature, palette, and type
system. Where this doc and the pack disagree, **the pack wins**. The
agent-facing summary lives in `AGENTS.md` §Brand Language.

## Provenance

Earlier packs (letterform experiments, “symbol is a B” framing, Blap /
Black Book interim names) are retired. The current `brand/` kit is the sole
master. Geometry is original art; run trademark clearance before public
launch or partner-facing use beyond this repo.

## Supersessions

Recorded so nobody “fixes” the codebase back to a retired rule:

1. **Radii.** Flat/zero-radius language is superseded by 8px / 14px / 28px
   (`--ds-radius-sm` / `-md` / `-lg`), the same on web and mobile. The middle
   step was 16px in the pack and moved to 14px with the Ink direction. No
   bevels, gradients, glows, 3D, or ornamental motion; shadows only as the
   contact shadow under Shape.
2. **Canvas.** White `#FFFFFF` canvas is superseded by the paper family. The
   Archive Paper swatch `#F4EFE5` is the brand color; the web theme canvas is
   one value step lighter so a sunken well and a raised plate both have room
   (see Theme roles).
3. **Display type.** Kit headlines use Schibsted Grotesk SemiBold; UI Geist; editorial
   Newsreader; data Geist Mono (see `apps/web/src/app/layout.tsx`).
4. **Lockup rendering.** Official artwork PNGs at `apps/web/public/brand/` —
   never type the wordmark next to a bare symbol in React.
5. **Copper text.** Use `#8E4F2A` on light / `#D07A32` on dark
   (`--ds-accent`), not raw Copper Pin for body text on light canvas.
   Inline links in operational notices use that theme-aware token, an underline, and a
   visible focus outline; browser-default blue does not provide dark-theme contrast.
6. **Home layout.** The `/` surface follows
   [design direction v10](./design-direction-v10.md) and its
   [reconciliation](./v10/design-doc-reconciliation.md); tokens and palette rules in this file
   govern the shared brand.

## The signature

Anatomy: book cover, page bands, place pin, wordmark. The symbol is a
standalone book-and-pin mark (not a letterform). Official lockup and symbol
are artwork, used as provided.

### Logo family

| Asset | Use |
|---|---|
| Symbol (book-and-pin, no wordmark) | Avatar, map chrome, watermark, small UI |
| Lockup (symbol + wordmark) | Default signature; headers |
| App icon | App launchers and tiles |

Each ships as a light and dark transparent PNG pair.

### Clear space and minimum sizes

- **Clear space:** X = the visible width of the copper pin. Keep at least
  1X on every side of any mark or lockup.
- **Minimums:** primary lockup 168px digital / 36mm print; primary mark
  32px; compact mark 20px.
- Never squeeze the clear space to fit navigation — reduce the adjacent UI
  or switch to the symbol alone instead.

### Misuse (never)

- Stretch, recolor beyond approved light/dark variants, remove the pin,
  add effects, or crowd clear space.
- Reconstruct the lockup by typing the wordmark beside a symbol render.
- Put product-prefixed names into npm scopes, CSS prefixes, or env prefixes.

## Color

Black and paper lead; copper points.

### Brand swatches

These are the pack's colors (`brand/tokens/colors.json`). They do not change
with the theme, the way a printed logo does not change when the lights dim.

| Swatch | Hex |
|---|---|
| Black Ink | `#0A0A0A` |
| Charcoal | `#161616` |
| Archive Paper | `#F4EFE5` |
| Surface | `#FBF8F2` |
| Copper Pin (graphic accent only) | `#B86B2A` |
| Copper text on light | `#8E4F2A` |
| Copper text on dark | `#D07A32` |
| Page Sand (decorative fill) | `#D8A178` |
| Stone (secondary text) | `#6D675F` |
| Rule (hairlines) | `#D7D0C4` |

### Theme roles

UI is built from roles, never from swatches. The values live in one place,
`packages/ui/src/styles/tokens.css`, mirrored in `packages/ui/src/tokens/colors.ts`
and held together by `css-parity.test.ts`. This table names the roles; read the
hex from the token file, because a copy here is how this document drifted before.

| Role | Token | Notes |
|---|---|---|
| Surface steps, low to high | `--ds-surface-sunken`, `--ds-canvas`, `--ds-surface`, `--ds-surface-raised` | Four value steps per theme. Dark is the warmer Ink ground, not raw Black Ink / Charcoal |
| Text | `--ds-ink`, `--ds-ink-muted` | `--ds-ink-subtle` currently holds the same value as muted on web |
| Divider | `--ds-border` / `--ds-rule` | Hairlines between things. About 1.4:1, so never the only edge of a control |
| Control edge | `--ds-border-control` | Inputs, selects, textareas. 3:1 on every surface step |
| Emphasis edge, focus | `--ds-border-strong`, `--ds-focus-ring` | Ink on light, paper on dark |
| Accent | `--ds-accent` (text and links), `--ds-accent-graphic` (pins, fills, large marks), `--ds-accent-muted` (decorative only) | Raw Copper Pin never carries body text on light |
| Status | `--ds-warning-*`, `--ds-dispute-*`, `--ds-error-*`, `--ds-confidence-{high,medium,low}-*` | Each is an fg / bg / border trio and always ships with a text or glyph cue |

Mobile generates its own palette from the same pack
(`apps/mobile/scripts/tokens/brand-source.ts`). It adds `surfacePressed` for
press feedback and a softer `inkSubtle`, and its hexes are not the web's.

Copper is a navigational signal (~10–15% of a composition): active locations,
selected filters, primary actions, evidence markers. Dark theme is first-class.

## Accessibility floor

The target is WCAG 2.2 AA. These are measured on the shipped tokens and
asserted in `packages/ui/src/tokens/contrast.test.ts`, on all four surface steps.

| Pair | Lowest ratio, light | Lowest ratio, dark | Needs |
|---|---|---|---|
| Ink on any surface | 16.1 | 14.2 | 4.5 (clears AAA) |
| Muted ink on any surface | 4.54 (on sunken) | 8.0 | 4.5 |
| Accent text on any surface | 5.2 | 5.0 | 4.5 |
| Accent graphic on any surface | 3.3 | 5.0 | 3 |
| Control edge on any surface | 3.2 | 3.2 | 3 |
| Ink on the copper primary button | 4.9 | 6.1 | 4.5 |

Rules that follow from the numbers:

- **Muted ink on the sunken surface has no headroom on light.** Do not tint a
  sunken well darker or soften muted ink without rerunning the tests.
- **Rule is a divider.** A field whose only boundary is its border uses
  `--ds-border-control`.
- **Page Sand is a fill, never a mark that carries meaning by itself.** It is
  2.1:1 on the light canvas. In charts it needs an ink outline or a label.
- **Color is never the only signal.** Confidence, dispute and status pair color
  with text and a glyph.
- **Focus** is one `:focus-visible` outline, 3px with a 2px offset, in
  `--ds-focus-ring`. Do not remove it or replace it with a color change.
- **Targets** are at least 44px (2.75rem) on anything a finger can hit.
- **Text floor** is `--ds-text-micro` (11px), for uppercase mono labels only.
  Sentences start at `--ds-text-caption`.
- **Motion** runs on the duration tokens, which collapse under
  `prefers-reduced-motion`. A hand-written duration skips that.
- **Forced colors.** A meaning-bearing fill (a meter, a swatch) needs a
  `forced-colors` rule, as `evidence-grade.css` does, or it disappears in
  Windows high contrast.

## Type

Schibsted Grotesk SemiBold for headlines; Geist for UI/body; Newsreader for
editorial/longform; Geist Mono for data, citations, dates, confidence,
and technical labels. All open-source; no licensed fonts.

Sizes come from the scale in `tokens.css`, not from a pixel value chosen per
surface. A surface picks which step a thing is, not what the step measures.

| Step | Token | Use |
|---|---|---|
| Display | `--ds-text-display-hero`, `-display-1`, `-display-2`, `-display-3` | Headlines. One `display-1` (or one hero) per surface |
| Title, subtitle | `--ds-text-title`, `--ds-text-subtitle` | Section and card heads |
| Body | `--ds-text-body`, `--ds-text-body-sm` | UI and running text |
| Editorial | `--ds-text-editorial-lede`, `--ds-text-editorial` | Newsreader longform |
| Caption, micro | `--ds-text-caption`, `--ds-text-micro` | Meta and mono labels |

Line height and tracking have their own tokens (`--ds-leading-*`,
`--ds-tracking-*`). Longform measure is `--ds-content-max` (38rem, about 65
characters); the page grid caps at `--ds-grid-max` (72rem).

## Space, layout and motion

- **Space** is a 4px rhythm, `--ds-space-1` to `--ds-space-16` inside
  components, and the fluid `--ds-section-sm` / `-md` / `-lg` between sections.
- **Breakpoints** are 40 / 48 / 64 / 80rem. CSS cannot read a custom property
  in a media query, so they live in `grid.breakpoints` in
  `packages/ui/src/tokens/spacing.ts`.
- **Motion** explains a change of state and nothing else. Durations are
  `--ds-duration-fast` (160ms, hover and press), `-base` (280ms, panels) and
  `-slow` (480ms, surface changes). Things arrive on `--ds-ease-entrance` and
  leave on `--ds-ease-exit`. The cinematic and chapter tokens belong to
  sequenced surfaces such as the Door.
- **Stacking** uses the `--ds-z-*` ladder. A raw `z-index` is a bug waiting for
  the next overlay.

`pnpm lint:tokens` holds this in place: a raw hex, an off-scale spacing value,
a literal font size or an off-grid breakpoint in a stylesheet fails the check
unless the file already carried it.

## Controls and states

Every interactive element has all of these, in both themes:

| State | Treatment |
|---|---|
| Rest | Field edge in `--ds-border-control`; buttons per `.ds-button` |
| Hover | A value step (`--ds-surface-raised`) or the button's own hover. Never the only cue, because touch has no hover |
| Focus | The shared `:focus-visible` outline |
| Pressed, selected | Copper or ink fill, plus `aria-pressed` / `aria-selected` and a non-color cue |
| Disabled | Reduced opacity and `not-allowed`, on a real `disabled` attribute. Say why nearby when it is not obvious |
| Loading, empty, error | Skeleton, `EmptyState`, `Notice` from `@repo/ui`. Wording in [`story.md`](./story.md) |

## Shape

Radii 8/14/28px (sm/md/lg). The archive is material, not glass: depth comes from
stacking, occlusion, crop and value (four surface steps per theme), never from
synthetic light. Decorative gradients, glows, neon, bevels, glass and 3D stay
banned. One low-opacity contact shadow (`--ds-contact-*`) is allowed only where
a layer genuinely overlaps another.

## Imagery and people

Place first; evidence visible; people with context — a person is always
identified (PERSON / ROLE / PLACE / YEAR), never anonymous decoration.
Avoid generic “Black history” stock imagery, automatic sepia filters, AI
images presented as documentary material, and maps without source/precision
context.

## Map dignity

No red or alarm hues for violence-adjacent records; no crime-heat rendering;
color is never the only signal (confidence stays glyph-encoded); points
render no sharper than stored precision and a coarsened point is never
labeled as an exact address.

## Add to Home Screen and install icons

`apps/web/public/manifest.webmanifest` declares the install surface: standalone
display, Archive Paper for background and theme color, and three icons under
`/brand/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`). The site is
online-first and has no service worker. Apple touch icons and favicons ship as
light and dark pairs beside them.

## Infrastructure naming

Infrastructure identifiers are configuration, not product copy. Package names use `@repo/*`,
CSS uses `ds-*` / `--ds-*`, and break-glass environment controls use `APP_*`.
