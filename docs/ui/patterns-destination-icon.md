# Destination icon pattern

**Status:** reusable site pattern (2026-09-15).
**Scope:** wayfinding labels for catalog destinations (command bar, Rooms, footer, room chapter plates, jump nav, palette Go rows, room cards). Not record anatomy facts.

---

## Intent

Mobile already draws a glyph for each `DestinationIconId` in `@repo/public-contracts/destinations`. Web was leaving those same labels as bare words, so About / Methodology / Data / Law / Banned books (and the same lists elsewhere) did not read as typed destinations. One web adapter maps the semantic ids to Font Awesome; surfaces never name a glyph.

---

## Components

| Module | Role |
|---|---|
| `apps/web/src/lib/nav/destination-icons.ts` | The only web file allowed to name a Font Awesome glyph for a destination id |
| `apps/web/src/components/patterns/DestinationIcon.tsx` | Presentational glyph (`aria-hidden`; label text stays visible) |
| `apps/web/src/components/patterns/destination-icon.css` | `ds-destination-icon*` sizing; `:has()` layout for headings and cards |

Import happens from `DestinationIcon.tsx`. The command bar mounts it on every route.

---

## Rules

- Pair every glyph with a visible label. Color and shape never replace the word (WCAG 1.4.1).
- Icons inherit `currentColor` so hover, current-page copper, and muted idle stay on the label.
- Sizes: `sm` (default, inline labels), `md` (cards and headings), `lg` (chapter plates and handoffs). Do not invent a fourth size in a page stylesheet.
- Do not icon inline prose links or OffRamp place names. This pattern is for destination lists, destination CTAs, and chapter plates.
- Entity-kind ids (`person`, `law`, `place`, …) reuse the same glyphs as `kind-icons.ts` so a law destination and a law record do not disagree.
- Native maps the same ids in `apps/mobile/src/ui/NavIcon.tsx`. Changing meaning requires both adapters.

---

## Adopters

Command bar Find axes, Rooms menu, site footer, `/rooms` cards, About destination cards, standalone-room jump nav and chapter plates (`RoomSection`, `RoomJump`, `RoomHandoff`), Door archive chips, command palette Go rows, Data reading CTAs.

---

## Accessibility

- Glyphs are decorative (`aria-hidden="true"`).
- Focus rings stay on the control, not the svg.
- Light and dark both inherit ink/muted/accent from the parent label.
