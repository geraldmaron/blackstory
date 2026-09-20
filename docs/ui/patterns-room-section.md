# Room section pattern

**Status:** reusable site pattern (2026-09-16).
**Scope:** chapter identity for standalone rooms (Methodology, About, FAQ, Sources, Rooms, Privacy, Terms, Errata, Support, Submit, Corrections). Not the memorial wall (P-01). Not record anatomy.

**Challenges:** v9 reading-room law that long rooms are “one hairline column, muted 0.72em kickers, MapMoment as the only life.” That made Methodology, About, FAQ and Sources scan as the same undifferentiated stack, and left source-library content with no visual weight.

---

## Intent

A reader of a standalone room should always know which chapter they are in, be able to jump to another, and see related rooms as destinations rather than as words inside a paragraph.

Measure stays. Cards stay for destinations. What changes is the chapter break: a 44px icon plate, a heading, an optional sunk band, and one sticky jump nav shared across rooms.

---

## Components

| Module | Role |
|---|---|
| `apps/web/src/components/room/RoomSection.tsx` | `RoomSection`, `RoomFactList`, `RoomHandoff`, `roomSectionTone` |
| `apps/web/src/components/room/RoomJump.tsx` | Sticky chip row; links work with JS off; hydration adds `aria-current` |
| `apps/web/src/components/room/room-kit.css` | `.ds-room-section*`, `.ds-room-jump*`, `.ds-room-fact*`, `.ds-room-handoff*` |

Import from `components/room`. CSS arrives with the kit.

---

## Rules

- Pair every plate with a visible heading. Color and shape never replace the word (WCAG 1.4.1).
- Alternate `sunk` / `canvas` from the first body chapter (`roomSectionTone(0)` is sunk). Do not invent a third band treatment per page.
- Copper stays on the plate stroke/glyph and the current jump chip. No copper fill, no radius lift.
- Jump targets are 44px tall. On viewports under 640px the row scrolls sideways instead of wrapping into a stack of chrome.
- Related rooms use `RoomHandoff`, not a sentence with a text link as the only signal.
- Memorial wall is out of scope. The accessible name list may use a letter jump and related-room handoffs; plates on that surface stay ink, not copper.
- Do not add a new `*-edition.css` to restyle these. Extend the kit.

---

## Ledger style (2026-09-20)

[`design-direction-v10-rooms.md`](./design-direction-v10-rooms.md) restyles these blocks for the standalone rooms. It is opt-in on `<Room ledger>` because Lives, the memorial wall and record pages share the kit; `room-kit.test.tsx` pins the sixteen routes that carry it. Under it the plate is 64px and inverse (ink ground, canvas glyph), the heading takes `--ds-text-display-2`, the jump nav is one scrolling row of 44px pills with the current chapter inverse, and handoffs are ruled with 2px ink instead of hairlines. "No copper fill, no radius lift" still holds.

New kit modules that ship with it:

| Module | Role |
|---|---|
| `RoomStats.tsx` | Numbers a room can state honestly, as display numerals under the masthead. Never a score, never on Memorial. |
| `DocumentPlate.tsx` | A typeset sheet in a reading-room masthead, set from words the page already quotes and cites. Not an image; scans go through `ArchiveFigure` at full frame. |
| `KeepGoing.tsx` | The closing handoff chapter, drawn from the destination registry so no room describes another room in its own words. |
| `FindBar.tsx` | The one find bar for filtering rooms. See the registry entry. |

## Type roles

Room stylesheets size type from `packages/ui/src/styles/tokens.css` only; a literal `font-size` fails `room-kit.test.tsx` (the memorial wall is exempt).

| Role | Token |
|---|---|
| Ledger masthead | `--ds-text-display-hero` |
| Masthead elsewhere, stat numerals | `--ds-text-display-1` |
| Chapter heading (ledger) | `--ds-text-display-2` |
| Chapter heading, group heading, year in a ledger row | `--ds-text-display-3` |
| Card, fact, handoff and ledger row titles | `--ds-text-title` |
| Glossed row title | `--ds-text-subtitle` |
| Room prose | `--ds-text-editorial` |
| One-line ledger row, inputs | `--ds-text-body` |
| Secondary prose, gloss, captions | `--ds-text-body-sm` |
| Chips, small UI | `--ds-text-caption` |
| Mono labels, kickers, counts | `--ds-text-micro` |

## Adopters

Methodology, Sources, About, FAQ, Rooms, Law, Privacy, Terms, Errata, Support, Submit, Corrections. Data keeps its own section rail (already a sticky running head) and uses the kit's chapter head for its acts. Memorial list uses `MemorialLetterJump` rather than `RoomJump` because the spine is letters, not destinations. `/books` uses the kit around the catalog (how to read, jump, handoffs); catalog rows stay `ds-room-idx` with a cover and gloss, not HairlineIndex, because a title is artwork rather than a 16px kind glyph.

---

## Accessibility

- Section `aria-labelledby` points at the `h2`.
- Jump glyphs are decorative (`aria-hidden`).
- Focus rings stay on the control.
- Light and dark both inherit canvas / sunk / ink from the kit tokens.
