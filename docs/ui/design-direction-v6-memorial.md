# Design direction v6: Memorial (`/memorial`)

**Status:** Binding for `/memorial`.  
**Supersedes:** HTML mockup at `public/mockups/memorial-wall.html` (removed).

---

## Intent

A dedicated remembrance surface: a full-canvas **handwritten memorial wall** of names that fade in and out, with an opaque Surface edition column carrying the **complete readable list**. Not a photo collage. Not a crime-heat map. Dignity first. Incomplete by design.

---

## Atmosphere

| Layer | Spec |
|---|---|
| Canvas | Archive Paper / Black Ink (`--ds-canvas`) |
| Wall | Full viewport + scroll height; **names only**; no polaroids, no collage tiles |
| Placement | Random scatter with collision packing; labels **never overlap** |
| Type on wall | Handwriting faces only (Caveat, Patrick Hand, Shadows Into Light, Indie Flower, Architects Daughter, Homemade Apple) via CSS variables |
| Motion | Staggered fade in/out so a subset peaks at once; full set cycles; `prefers-reduced-motion` holds low static opacity |
| A11y | Wall is `aria-hidden`; the alphabetical list is the accessible record |

Do **not** mount `EditionAtmosphereMosaic` on this route. The wall replaces gutter mosaic atmosphere.

---

## Edition stack

Opaque Surface panels (`--ds-surface-raised`) over the wall, same vocabulary as About / Methodology:

1. **00 Intro** — kicker, display title, lede, CTAs (full list + Explore)
2. **01 Full list** — alphabetical names in a multi-column list + incomplete-list note with Submit / Methodology links

Flat matte only. Copper is navigational (CTAs / kickers), not a wash.

---

## Copy guardrails

- No em dashes on touched copy.
- No completeness overclaims.
- Spell names carefully (e.g. Trayvon Martin).
- Invite contribution via Submit; do not lecture.

---

## Code map

| Piece | Path |
|---|---|
| Page | `apps/web/src/app/memorial/page.tsx` |
| Hand fonts layout | `apps/web/src/app/memorial/layout.tsx` |
| Sections / copy / chrome | `memorial/*.tsx`, `memorial-copy.ts`, `memorial-panel-chrome.ts`, `memorial-edition.css` |
| Wall pattern | `apps/web/src/components/patterns/memorial-wall/*` |

---

## Nav & SEO

- Overflow + footer Trust column: Memorial
- Sitemap static route: `/memorial`
