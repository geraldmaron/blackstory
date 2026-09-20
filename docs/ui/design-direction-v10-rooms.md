# BlackStory design direction v10: rooms

**Status:** binding for standalone rooms (2026-09-20). Companion to [`design-direction-v10.md`](./design-direction-v10.md); sits at authority level 4 in its order.
**Decided by:** Gerald, 2026-09-20, from the review page at [`prototypes/rooms-directions.html`](./prototypes/rooms-directions.html): Direction A (Ledger, louder) plus Direction B's document plate. Headline copy approved the same day.
**Tracked in:** repo-vac3x.1.14.
**Amends:** [`patterns-room-section.md`](./patterns-room-section.md) (scale and plate weight). Does not amend `brand.md` or `PROTECTED-EXPERIENCES.md`.

---

## Why this exists

An audit of 17 routes on 2026-09-20 found the rooms read as several generations of one template. Three causes: the 2026-09-16 chapter pattern was adopted by some rooms and not others (Law had no jump nav, plated chapters, handoffs or figures), 172 of 182 font sizes in the room stylesheets were literals in about 25 values, and five filtering routes ran five control systems. The first two are fixed and guarded. This document sets the look the rooms converge on.

## Scope

Every room on the Rooms hub except Lives and Memorial, plus the Stories and Records landings. Not the Door, Explore, Lives, Memorial (P-01), or place and record detail pages.

## The direction: a ledger, louder

Same material law as the rest of the product (flat matte, value steps, copper on strokes and glyphs). What changes is scale contrast and how much of the page's honest structure is set in type.

| Element | Rule |
|---|---|
| Masthead | Sentence headline with one `<em>` accent word, set larger than `--ds-text-display-1` allows today (target ceiling about 108px at 1440). Lede sits under the headline on its left edge, takes ink rather than muted ink, and shares the row with the document plate where a room has one. A 2px ink rule closes the masthead. |
| Noun | Lives in the `Rooms / X` crumb, the document title and the nav. Never repeated as a kicker over the headline. |
| Stats | Numbers a room can state honestly are set as display numerals in a ruled row under the masthead (`RoomStats`, promoted out of Data's headline figures). Text-only facts stay in `DocumentColophon`. Never on Memorial. No number that is not already true on the page. |
| Jump nav | 44px pills, sans, current chapter inverse. Scrolls sideways on phones. |
| Chapters | Full-bleed value bands alternating sunken and canvas, not rounded cards. 64px inverse plate (ink ground, canvas glyph). Chapter heading at `--ds-text-display-2`. |
| Ledger rows | Where a row has a year, the year is the typographic anchor: display numerals in the left column, title beside it, kind as a copper mono tag, citation and gloss under. One-line ledgers (Records) keep the compact row. |
| Handoffs | Ruled, not boxed: a 2px ink top rule, title, one sentence. |
| Right rail | Reading rooms with a catalog get a real orientation rail at 1000px and wider. |
| Utility rooms | Same grammar in the same frame. What stays narrow is the form, not the page. They do not get the document plate. |

## Frame and measure

The frame is not the measure. Three rules, all in `room-kit.css` under `.ds-room--ledger`:

| Rule | Value | Why |
|---|---|---|
| One frame | `--room-doc-w: 900px` for every ledger room, reading or utility, plus a 300px rail where a room has one | On 2026-09-20 the utility rooms were still in a 560px column, so a hero headline wrapped to five lines and Support read as a phone layout on a desktop. Mastheads, stat rows and chapter bands now line up from room to room at every width. |
| Text keeps a measure | `--room-measure: 62ch` on prose, section paragraphs, fact lists and off-ramp text | The full column ran about 115 characters a line. In `ch` the measure follows the face and size of the text it holds. |
| Forms keep a measure | `--room-form-measure: 36rem` on forms and notices | A long input is hard to scan. Find bars (`role="search"`) are exempt and use the frame. |

Grids, tables, figures, the find bar and ledger rows use the whole frame. Gutters come from `--room-doc-pad`, which already narrows under 560px.

Left edge: every room's column is centered at every width, so every masthead starts at the same x. A railed room (Law, Stories, Records) puts its rail in the right margin from 98rem, where a 300px rail fits beside a centered 900px column. Below that the rail stacks under the content, the same place it goes on a tablet. The kit's default for other surfaces, centering the column-plus-rail pair, is not used by ledger rooms: it put a railed room's masthead 166px left of its siblings on a laptop.

Touch targets are 44px wherever the pointer is coarse or the viewport is 64rem or less, not only on phones.

Copper stays an accent: the accent word, the first stat, kind tags, the current filter chip. No copper fills.

## The document plate

A sheet set into the right of a reading-room masthead, rotated about two degrees, on the raised surface value, with a contact shadow because it overlaps the stat band.

**Reconciled with existing law.** `ArchiveFigure` already states that documentary images keep their complete frame and provenance and are never cropped for decoration. The mockup described the plate as "cropped". That wording is withdrawn. The rules are:

1. **Version one is typeset, not photographic.** The plate sets words the page already quotes and cites (the operative text of a law on Law, from the earliest entry whose explainer quotes it), or one of the page's own instruments drawn with the production component a reader meets on records: the evidence grade key on Methodology, the four-step citation chain on Source library. It carries a one-line caption and a link to where the page explains it. Never an invented example, so it needs no media rights and no change to `brand.md`.
2. **A scan, when one is cleared, goes through `ArchiveFigure`** with image, alt, credit, rights and a link to the original. The complete frame is shown. The stat band may overlap only the sheet's blank margin, never the document.
3. **No cleared content, no plate.** The slot renders nothing. There is no placeholder frame, initials tile or "coming soon" state.
4. People are never plate material unless identified per `brand.md` (person, role, place, year).
5. The highlighted phrase on a typeset plate is the phrase the room's own copy discusses. It is not emphasis added to change a law's meaning (P-02).

## What stays out

Direction C's family tints, count-up figures, reading-progress line and hover previews were not chosen. "No ornamental motion" stands as written.

## Build order

Kit primitives first, routes second, one commit per step. `ReadingEntry`, `RoomStats`, `RoomJump`, `RoomSection`, `RoomHandoff`, ledger rows, shown on `/design-system`. Then Law to the full grammar, the thin rooms, Data's act headers, Stories and Records. The shared find bar (repo-vac3x.1.14.4) lands beside it and is not restyled per route.

## Acceptance

Before and after screenshots at 375, 768 and 1440 in both themes for every in-scope route. Every room with three or more chapters has a jump nav; every room ends in at least one handoff. No horizontal overflow at 320. Targets 44px on phones. Rows above the fold on Records compared before and after. Web tests, typecheck, lint and the a11y lane green.
