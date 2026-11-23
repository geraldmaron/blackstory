> **SUPERSEDED.** This document is superseded by design-direction-v9-surfaces.md. Route today: /memorial. It is kept as the provenance record; do not build from it. See the supersession table in docs/ui/README.md.

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
| Placement | Random scatter with collision packing; labels **never overlap**; capped subset (~220) placed at once for performance across the ~1,670-name pool, rotating periodically so the full set cycles |
| Type on wall | Handwriting faces only (Caveat, Patrick Hand, Shadows Into Light, Indie Flower, Architects Daughter, Homemade Apple) via CSS variables |
| Motion | Staggered fade in/out so a subset peaks at once; full set cycles; `prefers-reduced-motion` holds low static opacity |
| A11y | Wall is `aria-hidden`; the alphabetical list is the accessible record |

Do **not** mount `EditionAtmosphereMosaic` on this route. The wall replaces gutter mosaic atmosphere.

### "Held in the Wall" opening sequence

On load the page is a pure Archive Paper canvas: no header, CTA, or edition panel visible. After a ~1.5s beat, names begin fading in sparse and build to full (capped) density over the next ~12s. While the wall settles into its steady cycling rhythm, a 4-line message assembles from the same handwriting mechanic, one line at a time (roughly every 4s starting at 6s), and — unlike names — each line **holds permanently** once shown, so the full message ends up fixed and readable at the center of the field while names keep drifting behind/around it. Plays automatically once on load; not scroll-gated. `prefers-reduced-motion` resolves everything immediately: full density, all four lines shown, no fade choreography. Timing lives in `memorial-wall-reveal.ts`.

The full readable list is no longer an up-front panel: it is reached via one small quiet text link fixed near the bottom of the viewport ("Read every name held here"), not a card or button, so the opening screen still reads as blank-except-names. The alphabetical list itself is unchanged as the accessible record, just pushed below the first viewport.

---

## Edition stack

Opaque Surface panel (`--ds-surface-raised`) over the wall, same vocabulary as About / Methodology, reached by scrolling past the opening sequence or via the quiet list link:

1. **Accessible intro** — kicker/title/lede kept for screen readers and SEO, visually hidden (not an up-front CTA panel)
2. **01 Full list** — alphabetical names in a multi-column list + incomplete-list note with Submit / Methodology links

Flat matte only. Copper is navigational (kickers), not a wash.

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
