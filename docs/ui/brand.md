# Brand: usage contract

> **SUPERSESSION (2026-07-18, owner-supplied `brand/` kit):** the binding
> brand source is now the root **`brand/`** directory ("BLAP full brand kit —
> current approved version"): a **standalone book-and-pin symbol (not a B)**
> beside a **lowercase `blap` wordmark**, light/dark transparent lockups and
> symbols, app icons, 4-page guide (`brand/guide/`), and token files
> (`brand/tokens/` — palette and type families unchanged from v3). The
> "symbol IS the first B" rule and every "no typed second B" clause below are
> **retired**; the kit's implementation note is "the icon and wordmark should
> always be used as provided." Served copies live at `apps/web/public/brand/`
> (`blap-lockup-*.png`, `blap-symbol-*.png`, `blap-app-icon-*.png`).
> Palette, copper discipline, type system, radii, and imagery/voice rules in
> this document remain in force. Favicon/OG/social renders from the new kit
> are an open asset task.

The Blap signature: a standalone book-and-pin symbol (not a letterform)
beside a lowercase `blap` wordmark — **history, pinned to place.** Per the
SUPERSESSION block above, the symbol is NOT a stylized "B"; do not recreate
that reading. The official lockup and symbol are artwork, used as provided.

This document is the usage contract for the signature, palette, and type
system. The **binding source is the root `brand/` directory** (masters,
4-page guide, token files). Where this doc and the pack disagree, **the
pack wins**. The agent-facing summary lives in `AGENTS.md` §Brand Language.

## Provenance

The mark's lineage: BB-067 proposed a blocky-letterform /
Monk-Skin-Tone-Scale concept (retired — see Supersessions). BB-068 replaced
it with an owner-supplied Pinned Page package (2026-07-17), later superseded
by a v3 "Blap Brand Identity System" pack (BB-096, same day) that first
introduced the "symbol IS the first B" reading. Both prior packages are
gone from the repo — **the 2026-07-18 `brand/` kit is the sole current
master**, and it explicitly retires the "symbol IS the first B" framing in
favor of a standalone symbol beside a typed lowercase wordmark. The
geometry is original art (not a font glyph or stock book/pin icon); it has
not been run through a trademark clearance search — do that before any
public launch or partner-facing use beyond this repo.

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
4. **Lockup rendering.** Any code-generated lockup with a typed wordmark is
   superseded by the official artwork PNGs at `apps/web/public/brand/` —
   those files are the rendered source of truth for the header, masthead,
   favicon, and OG image. Site code never types the wordmark next to the
   symbol; there is no `BlapLogo`/`BlackBookLogo` React component (removed
   as dead code 2026-07-18 — it had zero consumers once the kit landed).
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
| Symbol (book-and-pin, no wordmark) | Avatar, map chrome, watermark, small UI |
| Lockup (symbol + lowercase `blap` wordmark) | Default signature; headers |
| App icon | App launchers and tiles |

Each ships as a light and dark transparent PNG pair — see Asset selection
below. There is no separate "compact mark" or monochrome family in the
current kit; use the symbol alone at small sizes instead.

### Clear space and minimum sizes

- **Clear space:** X = the visible width of the copper pin. Keep at least
  1X on every side of any mark or lockup.
- **Minimums:** primary lockup 168px digital / 36mm print; primary mark
  32px; compact mark 20px.
- Never squeeze the clear space to fit navigation — reduce the adjacent UI
  or switch to the compact mark instead.

### Misuse (never)

- No typed wordmark reconstruction — the lockup is artwork, used as
  provided. Never type the wordmark beside a standalone symbol render.
- No stretching to a non-square (symbol) or off-ratio (lockup) aspect.
- No random recoloring — approved light / dark variants only.
- No effects: rotation, bevel, glow, texture, ornamental motion.
- Never remove the pin.
- Never crowd the clear space.

### Asset selection

| Context | Asset |
|---|---|
| Website header | `blap-lockup-{light,dark}.png` |
| App launcher / touch icon | `blap-app-icon-{light,dark}.png`, `apple-touch-icon-{light,dark}-180.png` |
| Favicon | `favicon-{light,dark}-{16,32,48}.png` (symbol only, not the full lockup) |
| OG / link preview | `blap-open-graph-{light,dark}-1200x630.png` |
| Social banner | `blap-social-banner-{light,dark}-1500x500.png` |
| Social avatar | `social-avatar-{light,dark}-512.png` (keep the safe area; do not crop the symbol) |

All served copies are PNG (the kit ships no vector source) and live at
`apps/web/public/brand/` (referenced as `/brand/...`); the checksummed
masters live at the root `brand/` directory alongside the guide and token
files.

## Palette

Full palette (binding values in `brand/tokens/brand.css` and
`brand/tokens/colors.json`, mirrored into `packages/ui/src/styles/tokens.css`;
dark theme swaps are in that file's `[data-theme="dark"]` block):

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

The in-app tokens live in `packages/ui/src/styles/tokens.css` as
`--bb-font-sans` (UI) and `--bb-font-mono` (data), with
`--bb-font-display` / `--bb-font-editorial` shared; the kit's own family
names are recorded in `brand/tokens/fonts.json`.

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
| Binding brand kit (masters, guide, tokens) | root `brand/` (`logos/`, `symbols/`, `app-icons/`, `guide/`, `source-images/`, `tokens/`) |
| Kit tokens (CSS / JSON) | `brand/tokens/brand.css`, `brand/tokens/colors.json`, `brand/tokens/fonts.json` |
| In-app tokens | `packages/ui/src/tokens/` (`brand-palette.ts`, `colors.ts`, `typography.ts`), `packages/ui/src/styles/tokens.css` |
| Contrast enforcement | `packages/ui/src/tokens/contrast.test.ts` |
| Served brand assets (header, favicon, touch icon, OG, social) | `apps/web/public/brand/` — PNG only, no runtime generation |
| Header integration | `apps/web/src/components/SiteHeader.tsx` |
| Agent-facing brand summary | `AGENTS.md` §Brand Language |

There is no logo React component (`BlapLogo`/`BlackBookLogo` — removed
2026-07-18, zero consumers) and no separate "asset-usage implementation"
doc; every rendered lockup/symbol on screen is kit artwork loaded directly
as an `<img>`, never typed or code-generated. When a master in `brand/`
changes, re-copy the derived render (favicon/OG/social/etc.) to
`apps/web/public/brand/` by hand — there is no asset-manifest or checksum
pipeline for the current kit.

See also `docs/ui/README.md` for the broader design-system tokens and
components this brand sits alongside.
