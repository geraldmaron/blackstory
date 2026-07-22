---
title: Brand language
description: Signature, palette, type, and map dignity rules for anything users see.
nav: concepts
order: 2
---

# Brand language

**Product name:** BlackStory.

**Core line:** History, pinned to place.

**Support:** People. Places. Evidence. Context.

Copy is specific over sweeping, evidence before assertion, pride without
spectacle. Invite; do not lecture. Never sensational framings or completeness
overclaims.

The binding brand masters live in the repository `brand/` directory. Served
copies use role-based paths under `apps/web/public/brand/` (`lockup-*.png`,
`symbol-*.png`, open-graph assets, favicons). Call sites use those role names
or identity helpers, never product-prefixed filenames reconstructed by hand.

## Color

Black and paper lead; copper points.

| Role | Hex |
|------|-----|
| Black Ink | `#0A0A0A` |
| Charcoal | `#161616` |
| Archive Paper | `#F4EFE5` |
| Surface | `#FBF8F2` |
| Copper Pin (graphic accent) | `#B86B2A` |
| Copper text on light | `#8E4F2A` |
| Copper text on dark | `#D07A32` |
| Stone | `#6D675F` |
| Rule | `#D7D0C4` |

Copper is a navigational signal (about 10 to 15 percent of a composition):
active locations, selected filters, primary actions, evidence markers. Raw
Copper Pin never carries body-size text on light canvas. Dark theme is
first-class.

Flat matte fills only. No bevels, shadows, glows, or gradients.

## Type

- **Sora SemiBold**: headlines
- **Inter**: UI / body
- **Source Serif 4**: editorial / longform
- **IBM Plex Mono**: data, citations, dates, confidence

All open-source. No licensed fonts.

## Shape

Radii 8 / 16 / 28px (sm / md / lg). Flat matte fills. No ornamental motion.

## The mark

Official lockup and book-and-pin symbol are artwork. Never reconstruct either by
typing the wordmark beside a bare symbol render.

## Imagery and people

Place first. Evidence visible. When people appear, they are identified (person /
role / place / year), never anonymous decoration. Avoid generic "Black history"
stock imagery, automatic sepia filters, AI images presented as documentary
material, and maps without source or precision context.

## Map dignity

No red or alarm hues for violence-adjacent records. No crime-heat rendering.
Color is never the only signal; confidence stays glyph-encoded. Points render no
sharper than stored precision. A coarsened point is never labeled as an exact
address.

## Stable code prefixes

| Layer | Value |
|-------|-------|
| npm packages | `@repo/*` |
| CSS / tokens | `ds-*` / `--ds-*` |
| Env break-glass | `APP_*` |

Full usage contract: `docs/ui/brand.md` in the repository.
