# Brand: usage contract

> **Binding source (2026-07-18):** root `brand/` — BlackStory full polished kit
> (book-and-pin symbol + wordmark, light/dark transparent lockups and symbols,
> app icons, 4-page guide, token files). Served copies use **role-based** paths
> under `apps/web/public/brand/` (`lockup-*.png`, `symbol-*.png`,
> `open-graph-*-1200x630.png`, favicons, apple-touch). Call sites must use
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

1. **Radii.** Flat/zero-radius language is superseded by 8px / 16px / 28px
   (`--ds-radius-sm` / `-md` / `-lg`). No bevels, shadows, gradients, glows,
   3D, or ornamental motion.
2. **Canvas.** White `#FFFFFF` canvas is superseded by Archive Paper
   `#F4EFE5` + Surface `#FBF8F2`.
3. **Display type.** Kit headlines use Sora SemiBold; UI Inter; editorial
   Source Serif 4; data IBM Plex Mono (see `apps/web/src/app/layout.tsx`).
4. **Lockup rendering.** Official artwork PNGs at `apps/web/public/brand/` —
   never type the wordmark next to a bare symbol in React.
5. **Copper text.** Use `#8E4F2A` on light / `#D07A32` on dark
   (`--ds-copper-text`), not raw Copper Pin for body text on light canvas.

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

| Role | Hex |
|---|---|
| Black Ink (primary ink; dark canvas) | `#0A0A0A` |
| Charcoal (dark surface) | `#161616` |
| Archive Paper (light canvas) | `#F4EFE5` |
| Surface (raised light surface) | `#FBF8F2` |
| Copper Pin (graphic accent only) | `#B86B2A` |
| Copper text on light | `#8E4F2A` |
| Copper text on dark | `#D07A32` |
| Page Sand (decorative fill) | `#D8A178` |
| Stone (secondary text) | `#6D675F` |
| Rule (hairlines) | `#D7D0C4` |

Copper is a navigational signal (~10–15% of a composition): active locations,
selected filters, primary actions, evidence markers. Dark theme is first-class.

## Type

Sora SemiBold for headlines; Inter for UI/body; Source Serif 4 for
editorial/longform; IBM Plex Mono for data, citations, dates, confidence,
and technical labels. All open-source; no licensed fonts.

## Shape

Radii 8/16/28px (sm/md/lg). Flat matte fills only.

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

## Infra naming

- GCP / Firebase **project id** `black-book-efaaf` is immutable. Documented
  as legacy in `@repo/config` (`GCP_PROJECT_ID_PROD`). Display names and
  labels use BlackStory / `product=blackstory`.
- New GCP project ids use the stable `repo-` prefix (`repo-staging`,
  `repo-internal`).
- Local directory and GitHub repo: `blackstory` (HUMAN rename).

## File naming

Lowercase-kebab file names everywhere, including docs and asset packs —
no uppercase file names in new work. Public brand filenames are **role-based**
(`lockup-dark.png`), not product-prefixed.
