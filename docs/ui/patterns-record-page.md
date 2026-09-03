# Record page

**Status: proposed (2026-07-30), binding when [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) is.** Law extracted from [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) sections 2.3 and 4.3. Demonstrated in [`.design-mocks/blackstory-atlas-v9.html`](../../.design-mocks/blackstory-atlas-v9.html) (`ROOMS.record`, `citedIn`).

The class covers four surfaces: `/entity/[id]`, `/books/[slug]`, `/law/[slug]`, and the entity loading state.

Builds on, and does not replace: [`patterns-record-anatomy.md`](./patterns-record-anatomy.md) (the fact grid), [`patterns-plate-posture.md`](./patterns-plate-posture.md) (the Framed plate), [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md) (glyph and colour).

---

## 1. What it is

One catalogued thing with a place, an era and evidence: an entity, a banned book, a law. **The map record sheet, unfolded into a durable, crawlable, citable page.**

**Same anatomy component as the sheet, never a fork.** The sheet and the page render one `RecordAnatomyPanel`, and their citation strings are byte identical because both call `lib/citation/format`. A citation a reader copies from a pin and a citation they copy from the page must be the same string, or the archive has two answers to the same question.

---

## 2. Anatomy

1. **Command bar.**
2. **Framed place or jurisdiction plate**, flown at stored precision, never sharper, with the coarsening stated.
3. **Kicker.** Kind glyph, Kind, place, era. Mono.
4. **Name.** Sora.
5. **Summary.** Source Serif 4, with linked prose.
6. **Topic tags** as lens handoff links.
7. **Record anatomy panel** in inline rows, with its precision footnote.
8. **Trust block**, and the sensitivity banner where it applies.
9. **"Why this appears"**, naming the specific match reason. Never a generic relevance claim.
10. **Numbered sources**, as hairline rows.
11. **Documented connections.** Each states its relation in words, never a bare arrow.
12. **"Chapters that cite this record."** The reverse of the chapter-cites-record edge.
13. **"How to read this record."**
14. **Session prev and next.**
15. **Site footer.**

Column width narrows to 680px. Body prose keeps its measure; the anatomy rows and source rows run the full column.

---

## 3. Map behaviour

Framed, always. The persistent plate insets into the record's place frame and flies there at stored precision, never sharper, with the coarsening stated in the frame.

- **Gestures are locked** until the reader presses **Explore this place**, which hands the plate to the map through the lens handoff builder.
- **Violence adjacent records get a plain `flyTo` and nothing else.** The dramatising moves render disabled with the reason in visible text, not in a `title` attribute.
- **Person records never get spotlight.** A spotlight may isolate a region; it may never isolate an individual person record.
- A jurisdiction is not a location. See section 5.

---

## 4. The three surfaces

**`/entity/[id]`** is the reference implementation. Stays `force-dynamic`. Keeps its absolute canonical, Article JSON-LD and explicit robots block. Deep anchors are URL fragments, never query params, so the `/entity/*` query allowlist stays empty and the anchor survives middleware, stays out of the CDN cache key and cannot fragment the canonical.

**`/books/[slug]`** leads with a framed jurisdiction plate showing the challenging jurisdiction as an outline at stored precision, **never a school address**, with cover art beside it. Then mono `BOOK` kicker, Sora title, author, serif summary, the anatomy panel, the challenge list as hairline rows, the Bookshop affiliate call to action, then sources, then "Records in this jurisdiction", then prev and next.

> **The affiliate block is the only commercial element on the site and it must never read as evidence.** It is marked as affiliate in plain words and visually separated from the sources block.

**`/law/[slug]`** leads with a framed jurisdiction plate showing the state or federal outline the law governs, **never a point**, with a precision note that reads that a law has a jurisdiction rather than a location. Then mono `LAW` kicker, Sora title, official citation in mono, serif plain language explainer, the anatomy panel, official source links as numbered rows, then "Records in this jurisdiction and era" labelled exactly that, then prev and next.

> **No push in and no orbit on a law.** The dignity gate's spirit applies to abstractions too.

> **The link from a law to records is constructed from jurisdiction and era, not from a documented edge.** The label must never imply causation, and the lens handoff builder refuses a reason string that does.

Laws have no geo anchor in the catalogue today. If the state code to polygon join is not ready, this route ships **without the plate** rather than with a fabricated one.

**The entity loading state** is the record page's own skeleton, not a different page. The framed plate renders its parked state, and the kicker, name, summary and anatomy rows render as shimmer blocks at the exact geometry they will occupy, so nothing reflows when the record arrives. Nothing is interactive except the command bar, which stays fully live during the wait. `aria-busy` on the region with a single polite "Opening record" announcement, not one per shimmer block. Reduced motion renders the blocks static, read from the live media query rather than a one-shot boot value. **Never a spinner.**

---

## 5. The jurisdiction plate

For records whose Where is a jurisdiction rather than a point, render the outline rather than a pin, with a precision note that says a jurisdiction is not a location.

A pin on a jurisdiction record is a false claim with a coordinate attached. A book challenged in a county was not challenged at the county's centroid, and a state statute does not happen at the state capitol. The outline is the honest shape of what the archive knows.

---

## 6. Entry and exit

**Enter** from a map row or sheet, a palette record hit, a `/records` row, a catalogue card, a chapter citation, or an external link.

**Exit:**

- `J` and `K` step the result set the reader arrived with, chorded on this class.
- `A` returns to the map with this record selected.
- **Explore this place** hands the Framed plate to the map and unlocks it.
- Browser back returns to the referring surface with scroll restored.
- Session prev and next, a map return and a correction path are all mandatory.

---

## 7. Accessibility and dignity

- Every record page carries a correction path. A record with no way to dispute it is an assertion, not evidence.
- Colour is never the only signal; confidence stays glyph encoded.
- A coarsened point is never labelled as an exact address.
- A refused camera move states its reason in visible text.
- No red or alarm hues for violence-adjacent records, and no crime-heat rendering.
- A person is always identified with role, place and year, never anonymous decoration.

---

## 8. Do / Don't

**Do**

- Render one anatomy component, shared with the sheet
- Format every citation through `lib/citation/format`
- Frame the plate at stored precision and state the coarsening
- State a connection's relation in words
- Ship without a plate rather than with a fabricated geometry

**Don't**

- Fork the record preview for a page posture
- Pin a jurisdiction record at a point
- Put push in, orbit, spotlight or trace on a violence-adjacent record, or spotlight on any person record
- Let the affiliate block sit next to, or look like, the evidence
- Show a spinner instead of the record's own geometry while it loads
- Put a deep anchor in a query param

---

## 9. Modules

| Concern | Module | Status |
|---|---|---|
| Anatomy panel | `components/patterns/RecordAnatomyPanel.tsx`, `record-anatomy.css` | Built |
| Place frame | `components/patterns/RecordPlacePreview.tsx` | Built |
| Citation | `lib/citation/format.ts` | Built |
| Record page stylesheet | `apps/web/src/app/record-page.css` | Pending (SP-12) |
| Record sheet, shared component | `components/map-experience/RecordSheet.tsx` | Pending (SP-12, SP-20) |
| Cites edge | `lib/release/build-cites-edge.ts` | Pending (SP-20) |
| Inline place map | `components/entity/EntityLocationMap.tsx` | Built, but a second MapLibre instance; replaced by the Framed posture in SP-08 |

---

## 10. Tests

| Contract | Assertion |
|---|---|
| No fork | The sheet and the page render the same anatomy component |
| Citation parity | Citation strings from the sheet and the page are byte identical |
| Skeleton geometry | The skeleton's geometry matches the record, so there is no layout jump |
| Dignity | A violence-adjacent record shows the dramatising moves disabled with the reason in visible text |
| One context | Exactly one WebGL context exists on a record page, verified in the browser |
| Reverse edge | "Chapters that cite this record" renders in both sheet postures and on `/entity/[id]` |
| Anchors | No deep anchor is emitted as a query param |
