# Reading room

**Status: proposed (2026-07-30), binding when [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) is.** Law extracted from [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) sections 2.2, 4.2 and 5. Demonstrated in [`.design-mocks/blackstory-atlas-v9.html`](../../.design-mocks/blackstory-atlas-v9.html) (`#doc`, `#docprog`, `.docwrap`, `.mapmoment`).

The class covers the 11 routes listed in [`patterns-surface-classes.md`](./patterns-surface-classes.md): `/records`, `/history`, `/chapters`, `/chapters/[slug]`, `/books`, `/law`, `/data`, `/memorial`, `/about`, `/methodology`, `/errata`.

---

## 1. What it is

Long form, catalogue and index editorial on paper. One scrolling, measure limited column. **The plate is never behind body text.** Geography appears only as bounded, in-flow map moments the reader scrolls to.

The class also carries the record index, because a browsable list of what the archive contains is editorial, not instrumentation. The map answers "what happened near here" well and "what is documented about X" badly. Routing both through the instrument leaves the archive with no browsable, crawlable, non-spatial index at all, which is the defect `/records` exists to fix.

---

## 2. Anatomy

Top to bottom, in one column:

1. **Command bar**, slim. Mounted above the route, never unmounted.
2. **Reading progress rule.** A 2px copper hairline pinned under the bar, filling as the column scrolls. Present on every Reading room; absent everywhere else.
3. **Crumb.** Explore / parent chain / here. Every step is a live control, so up is always one click. The parent is where a reader would expect "up" to go, which is not always the index.
4. **Surface header.** Mono kicker, Sora title, serif lede, then a mono meta line carrying the route path and any as-of stamp.
5. **The column.** `min(720px, 100% - gutters)`. Source Serif 4 body at roughly a 66 character measure. Hairline section rules rather than a stack of identical cards. Exactly one `h1`.
6. **Right rail**, on wide viewports only. Grouped links that stay inside the room. It never sends a reader who wanted a different chapter out to the map.
7. **Records off ramp.** Mandatory. Every instance ends with a named handoff into the map or `/records`.
8. **Site footer.**

Column width is the only thing the class varies: 720px default, and the record and utility classes narrow it. A catalogue index widens its rows, not its measure.

---

## 3. Chrome

**Present:** command bar (slim), reading progress rule, record sheet in its in-document posture, palette, collections drawer, toasts, site footer.

**Absent:** Lens, Results rail, Time panel, Camera console, dock, readout, legend overlay.

The record sheet is the same component the map renders, in its second posture: anchored in the reading column rather than floating over the plate, with "Fly to place" swapping to "Open on the map". No surface forks the preview.

---

## 4. Map behavior

Parked by default. One Framed slot at a time. Full law in [`patterns-plate-posture.md`](./patterns-plate-posture.md); the parts a Reading room author needs:

- A map moment scrolled into view borrows the persistent plate, flies to its subject at stored precision, and releases it on exit.
- Reduced motion cuts instead of flying.
- No spotlight, no orbit, no sweep, no push in. Those belong to the Instrument.
- A map moment never intercepts the scroll gesture, and is never full bleed behind text.
- Author several moments far enough apart that the plate is not thrashed. Inactive moments show a static seeded placeholder.
- A moment whose plate is unavailable states that in words and keeps its caption. It is never a blank rectangle.

Every map moment carries a caption that stands alone. If the caption needs the map to make sense, the passage is asserting something the plate cannot prove.

---

## 5. Entry and exit

**Enter** from the palette, the footer, a map record's related links, or a catalogue card.

**Exit** is never optional:

- Every Reading room closes with a records off ramp into the map or `/records`.
- `A` opens the page's subject on the map, through the lens handoff builder with its reason string (see [`patterns-lens-handoff.md`](./patterns-lens-handoff.md)).
- `ESC` closes an open record sheet and returns focus to the chip that opened it.
- Browser back returns to the referring surface with scroll restored.

Only chorded bindings are live on this class. `A` and `ESC` are the exceptions the class owns, and `A` is disabled where the surface has no subject.

---

## 6. Content law

- **Cards are real links in document order**, never divs with click handlers.
- **Any index that can reach fifty rows adopts the Results rail windowing law.** `/history` currently renders 4,078 anchors in one document. Do not repeat that.
- **Filters are GET links.** On `/records`, every filter is a link, every row is a link, every page step is an anchor: nothing on that surface requires JS.
- **Distinct notices for distinct states.** "Temporarily unavailable" and "none published yet" are different facts and get different sentences.
- **Nothing that proves the archive corrects itself hides behind a click.** `/errata` is a plain list, not a set of disclosures.
- **A number gets a plain language reading of what it does and does not say.** On `/data`, each chart carries a mono source label, a mono as-of line, that reading, and a "Show the numbers" disclosure, so no value is hover only or color only.
- **Copy law holds:** no em dashes, sentence case body, mono uppercase for slugs only, people named with role and place.

---

## 7. Accessibility

- One `h1`, then a heading order with no skipped levels.
- Every tappable control at least 44px; chips may be 30px tall inside a 44px row target.
- `:focus-visible`, 2px `--copper` at 2px offset, everywhere.
- Cover art and decorative media are `aria-hidden`; the title carries the accessible name.
- A typeahead uses the same keyboard contract as the palette.
- No color-alone signal. A linked name and a plain-text name differ in words, not only in color.
- Anchored sections carry `scroll-margin` under the fixed bar.
- Any surface that auto-plays for more than five seconds carries a persistent in-page stop, whether or not an OS motion preference is set. `prefers-reduced-motion` sets the initial state; it never removes the control.

---

## 8. Do / Don't

**Do**

- Keep one measure limited column and hairline rules
- Give every instance a records off ramp
- Frame geography in a bounded slot the reader scrolls to
- Window any list that can reach fifty rows
- State what a chart does not say, next to the chart

**Don't**

- Put a Live plate behind the column, on any Reading room, for any reason
- Ship six identical cards where six hairline sections carry the same content with hierarchy
- Send a reader who wanted a different chapter out to the map
- Hide corrections, references or legally relevant text behind a disclosure
- Let an unmodified key fire while the reader is in the column

---

## 9. Modules

| Concern | Module | Status |
|---|---|---|
| Reading room stylesheet | `apps/web/src/app/reading-room.css` | Pending (SP-11) |
| Records index | `app/records/page.tsx`, `RecordsIndex.tsx`, `lib/records/build-records-index.ts` | Pending (SP-09) |
| Chapter prose blocks | `components/article/ArticleBody.tsx`, `ArticleProse.tsx`, `ArticleReferences.tsx` | Built |
| Map moment | `components/theme-spine/MapInsetMoment.tsx` | Built, converted to the Framed posture in SP-08 |
| Record sheet, in-document posture | `components/map-experience/RecordSheet.tsx` | Pending (SP-12, SP-20) |
| Site footer | `components/SiteFooter.tsx` | Built. Moves to `components/shell/SiteFooter.tsx` and is rewritten from the destination registry in SP-15 |

---

## 10. Tests

| Contract | Assertion |
|---|---|
| No plate behind prose | A CSS test asserts no Live plate can sit behind a `.prose` column |
| Off ramp | Every Reading room ends in a records off ramp |
| No-JS `/records` | Filtering, paging and opening a record all work with JavaScript disabled |
| Windowing | An index over fifty rows does not emit one anchor per record |
| Sheet focus return | `ESC` on an in-document sheet returns focus to the chip that opened it |
| Filter vocabulary | `/records` filter vocabulary is generated from the same source as the Lens, with a drift test |
