# Brand: the Pinned Page, v3 usage contract (BB-096)

The Blap signature: a closed book cover forms a custom "B" silhouette,
curved page-edge bands are exposed at the spine, and a copper place pin is
integrated into the lower-left of the cover — **history, pinned to place.**
The symbol IS the first B in "Blap"; the visible wordmark text begins
"lack Book". From the guide:

> The mark is the first B. The official lockup is artwork. Do not recreate
> it by typing the full name beside the symbol.

This document is the usage contract for the signature, palette, and type
system. The **binding source is `brand-system/`** ("Blap Brand
Identity System 3.0.0-final"): `brand-system/tokens/black-book-brand.css`,
`brand-system/tokens/black-book-brand-tokens.json`, and
`brand-system/guide/black-book-brand-guide-final.pdf`. Where this doc (or
any older doc or code) and the pack disagree, **the pack wins**. The
agent-facing summary lives in `AGENTS.md` §Brand Language.

## Provenance

The mark's lineage: BB-067 proposed a blocky-letterform /
Monk-Skin-Tone-Scale concept (retired — see Supersessions). BB-068 replaced
it with the owner-supplied Pinned Page package (2026-07-17); its reference
PNGs are archived at `docs/ui/brand-reference/`. That v2 package was in
turn **superseded by `brand-system/` 3.0.0-final on 2026-07-17 (BB-096)**,
which delivers the finished artwork, tokens, and standards guide. The
geometry is original to the owner-supplied package (not a font glyph or
stock book/pin icon); it has not been run through a trademark clearance
search — do that before any public launch or partner-facing use beyond this
repo.

## Supersessions

BB-096 reconciles older docs and code against the v3 pack. Recorded here so
nobody "fixes" the codebase back to a retired rule:

1. **Radii.** BB-007's flat/zero-radius language is superseded by the pack's
   radius tokens: 8px / 16px / 28px (`--bb-radius-sm` / `-md` / `-lg`).
   Bevels, drop shadows, gradients, glows, 3D, and ornamental motion remain
   banned everywhere — the flat-matte rule survives; only the corner radii
   changed.
2. **Canvas.** White `#FFFFFF` canvas is superseded by Archive Paper
   `#F4EFE5` (light canvas) + Surface `#FBF8F2` (raised light surface).
3. **Display type.** Sora is superseded by Inter Display. In-app it is
   delivered via the Inter v4 variable font's `opsz` axis — the axis's
   upper master IS Inter Display (same glyph masters), so one loaded family
   covers both display and UI registers (see
   `apps/web/src/app/layout.tsx`).
4. **Lockup rendering.** The code-generated lockup with a typed wordmark
   (`BlackBookLogo` `horizontal` / `stacked` variants) is superseded by the
   official artwork SVGs at `apps/web/public/brand/` — those files are the
   rendered source of truth for the header, masthead, favicon, and OG
   image. The wordmark is outlined artwork; site code never types it next
   to the symbol.
5. **Copper text accent.** Copper Ink `#7A4318` as the text-safe accent is
   superseded by the pack's copper text pair: `#8E4F2A` on light
   (`--bb-copper-text`, light theme) / `#D07A32` on dark.

**Still retired:** the BB-067 Monk Skin Tone Scale pigment mapping
(superseded 2026-07-17) stays retired. If a future feature needs to discuss
a real person's appearance, neither that retired system nor this brand
palette is the right tool.

## The signature

Anatomy: book cover, page bands, place pin, and the custom B silhouette.
Recognition order is **B → book → place**. At small sizes, preserve the B
and the pin before every page band — that is what the compact mark does.

### Logo family

| Asset | Use |
|---|---|
| Primary mark (symbol only) | Avatar, map chrome, watermark |
| Primary lockup (symbol + outlined wordmark) | Default signature; headers |
| Compact mark | Small UI, favicon, dense controls |
| Monochrome (black / cream) | Constrained production (print, engraving, single-color) |
| Application icons | App launchers and tiles |

### Clear space and minimum sizes

- **Clear space:** X = the visible width of the copper pin. Keep at least
  1X on every side of any mark or lockup.
- **Minimums:** primary lockup 168px digital / 36mm print; primary mark
  32px; compact mark 20px.
- Never squeeze the clear space to fit navigation — reduce the adjacent UI
  or switch to the compact mark instead.

### Misuse (never)

- No typed second B — the symbol supplies it. Never type the full name
  beside the symbol.
- No stretching to a non-square (mark) or off-ratio (lockup) aspect.
- No random recoloring — approved light / dark / monochrome variants only.
- No effects: rotation, bevel, glow, texture, ornamental motion.
- Never remove the pin.
- Never crowd the clear space.

### Asset selection

| Context | Asset |
|---|---|
| Website header | `black-book-primary-{light,dark}.svg` |
| App launcher | `black-book-app-icon-*-1024.png` |
| Favicon | `favicon-*-16/32/48.png` (compact mark — not the full lockup) |
| Social avatar | `social-avatar-*-512.png` (keep the safe area; do not crop the B) |
| Print | `primary-monochrome-*.svg` |
| Presentations | `primary-*-transparent.png` |

Web-served copies live at `apps/web/public/brand/` (referenced as
`/brand/...`); checksummed masters at `brand-system/assets/`. Prefer SVG in
product UI; transparent PNG only where SVG can't render (see
`brand-system/implementation/asset-usage.md`).

## Palette

Full v3 palette (binding values in
`brand-system/tokens/black-book-brand.css` and
`black-book-brand-tokens.json`; dark theme swaps are in the CSS
`[data-theme="dark"]` block):

| Role | Hex | Name |
|---|---|---|
| Primary ink; dark canvas | `#0A0A0A` | Black Ink |
| Dark surface | `#161616` | Charcoal |
| Light canvas | `#F4EFE5` | Archive Paper |
| Raised light surface | `#FBF8F2` | Surface |
| Graphic accent (the pin) | `#B86B2A` | Copper Pin |
| Copper text on light | `#8E4F2A` | Copper text (light) |
| Copper text on dark | `#D07A32` | Copper text (dark) |
| Decorative fill; page bands | `#D8A178` | Page Sand |
| Secondary text | `#6D675F` | Stone |
| Hairlines | `#D7D0C4` | Rule |

Accessible pairs (guide p.7):

| Foreground / background | Ratio | Use |
|---|---|---|
| Black Ink `#0A0A0A` / Archive Paper `#F4EFE5` | 17.3:1 | Primary text |
| `#8E4F2A` / Archive Paper `#F4EFE5` | 5.5:1 | Copper text on light |
| `#D07A32` / Black Ink `#0A0A0A` | 6.1:1 | Copper text on dark |
| Stone `#6D675F` / Archive Paper `#F4EFE5` | 4.9:1 | Secondary text |

Raw Copper Pin `#B86B2A` never carries body-size text on a light canvas —
use the copper text pair above. Page Sand is a fill/graphic color, not
foreground text on light canvases.

## Copper discipline (review checklist item)

> Black and paper lead. Copper points.

Copper is a **navigational signal, not a decorative wash or default text
color**. Treat this as a review gate on any composition (page, screen,
asset, chart):

- Copper occupies roughly **10–15%** of the composition.
- It is reserved for the **moment of orientation**: active locations,
  selected filters, primary actions, evidence markers.
- If copper appears anywhere else — backgrounds, body text, borders on
  unrelated chrome, "warming up" a neutral layout — remove it.

## Type system

| Role | Family | Weights | Token |
|---|---|---|---|
| Display / headlines | Inter Display (+ Inter fallback) | 600–700 | `--bb-font-display` |
| UI / body (sans) | Inter | 400–600 | `--bb-font-ui` |
| Editorial / longform | Source Serif 4 | 400–600 | `--bb-font-editorial` |
| Data / citations / mono | IBM Plex Mono | 400–500 | `--bb-font-data` |

Tokens above are the pack's names
(`brand-system/tokens/black-book-brand.css`); the in-app equivalents in
`packages/ui/src/styles/tokens.css` are `--bb-font-sans` (UI) and
`--bb-font-mono` (data), with `--bb-font-display` / `--bb-font-editorial`
shared.

All open-source — no licensing cost or budget gate. Responsive scale, fluid
between mobile and desktop: display 48–72px, H1 36–48px, H2 24–32px, body
16–18px. Tighter tracking only at display sizes. From the guide:

> The logo wordmark remains outlined artwork. Site typography supports it;
> it does not reconstruct it.

In-app, Inter Display comes from the Inter v4 variable font's `opsz` axis
(same glyph masters as Inter Display) loaded once in
`apps/web/src/app/layout.tsx` — do not load a second "Inter Display"
family.

## Product expression

The signature, map language, story rails, typography, and evidence metadata
work as **one system**, not separate treatments. Reference composition
(guide p.9): light header with the lockup; dark hero band (copper mono
kicker, display headline, support copy, copper CTA) beside a sand-toned map
panel with copper pins; story rail beneath with mono-caps KIND / STATE
slugs, a bold one-line story, and hairline rules.

## Imagery

Three registers, all metadata-forward:

- **Place first** — labeled LOCATION / DATE / SOURCE.
- **Evidence visible** — labeled COLLECTION / RIGHTS / CITATION.
- **People with context** — labeled PERSON / ROLE / PLACE / YEAR. A person
  is always identified, never anonymous decoration.

Avoid: generic "Black history" stock imagery; automatic sepia filters; AI
images presented as documentary material; sensational imagery; anonymous
portraits; maps without source and precision context.

## Voice

Specific over sweeping; evidence before assertion; pride without spectacle;
invite, do not lecture.

- Core line: **History, pinned to place.**
- Support line: **People. Places. Evidence. Context.**
- Prefer: "See what happened here." / "Every record should show why it
  belongs."
- Avoid: "The untold truth they hid from you." / "Everything you need to
  know."

See `docs/ui/story.md` (BB-069) for the full voice and narrative doc.

## Launch checklist

From the guide (p.13) — run before any surface ships:

- [ ] Correct light/dark asset for the surface
- [ ] Transparent background verified
- [ ] Alt text names the product
- [ ] Compact mark used below 32px
- [ ] No typed second B
- [ ] Clear space preserved
- [ ] Copper not used for body text
- [ ] Source and rights labels visible

## Source map

| What | Where |
|---|---|
| Binding brand pack (masters, guide, tokens, checksums) | `brand-system/` (`assets/`, `guide/`, `tokens/`, `asset-manifest.json`, `sha256sums.txt`) |
| Pack tokens (CSS / JSON) | `brand-system/tokens/black-book-brand.css`, `black-book-brand-tokens.json` |
| In-app tokens | `packages/ui/src/tokens/` (`brand-palette.ts`, `colors.ts`, `typography.ts`), `packages/ui/src/styles/tokens.css` |
| Contrast enforcement | `packages/ui/src/tokens/contrast.test.ts` |
| Served brand assets (header, favicon, touch icon, OG, social) | `apps/web/public/brand/` |
| Symbol-only React component | `BlackBookMark` in `packages/ui/src/brand/BlackBookLogo.tsx` |
| Header integration | `apps/web/src/components/SiteHeader.tsx` |
| Asset-usage rules and examples | `brand-system/implementation/` |
| Superseded v2 reference PNGs | `docs/ui/brand-reference/` (historical; see its `readme.md`) |
| Agent-facing brand summary | `AGENTS.md` §Brand Language |

Notes on what changed in the source map under BB-096:

- The favicon and OG image are **pack assets served from
  `apps/web/public/brand/`** — there is no runtime generation of either
  anymore.
- `BlackBookMark` (symbol-only) remains for decorative inline and
  map-chrome use — it tracks surrounding theme color via explicit
  `ink`/`paper`/`accent` props (set `paper` to the actual surface color so
  the pin's punch-through circle reads as a cutout, and wrap in
  `aria-hidden` when adjacent text already names the product). The
  wordmark-rendering variants are removed — any lockup on screen is pack
  artwork, never typed.
- The old authored SVGs at `packages/ui/src/brand/assets/bb-logo-*.svg`
  are deleted; use `apps/web/public/brand/` (serving) or
  `brand-system/assets/` (masters) instead.
- When a master in `brand-system/` changes, re-copy it to
  `apps/web/public/brand/` and refresh `asset-manifest.json` +
  `sha256sums.txt`.

See also `docs/ui/README.md` for the broader design-system tokens and
components this brand sits alongside.
