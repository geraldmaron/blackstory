# Lens handoff

**Status: proposed (2026-07-30), binding when [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) is.** Law extracted from [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) sections 5.2, 5.3, 5.5 and 5.6. Demonstrated in [`.design-mocks/blackstory-atlas-v9.html`](../../.design-mocks/blackstory-atlas-v9.html) (`applyLensRef`, `openRecord`, `citedIn`).

Builds on ADR-017 (no viewport in a shareable URL) and [`patterns-atlas-instrument.md`](./patterns-atlas-instrument.md) (the Lens and the Results rail that receive the handoff).

---

## 1. The rule

**A typed builder turns any surface's subject into an Explore deep link plus a mandatory human readable reason string that the map renders in its results header. No surface hand writes an Explore URL.**

Two things break without it.

A hand written Explore URL drifts from the parser. That has already happened: `buildExploreSearchParams` emits `tone`, `panels`, `radius` and `near`, none of which is in the allowlist, in violation of the comment in that file saying the two must stay aligned. The middleware strips them, and the reader lands on a filter they did not ask for.

A filter with no stated reason is an unattributed claim. If `/law/[slug]` links to "records in this jurisdiction and era" without saying what that link is built from, the reader reads cause and effect. The archive did not document cause and effect; it documented a jurisdiction and a decade. **A reason string that implies causation the archive has not documented fails the type.**

---

## 2. The handoff, out

A reading room hands a filter to the map by calling the builder with a subject and a reason. The builder returns a URL, the map parses it, applies the lens, and renders the reason in the results header where the reader can see what narrowed the set and clear it.

Named handoffs in this release:

| Surface | Control | Reason string names |
|---|---|---|
| `/chapters/[slug]` | "The records behind this chapter" | the chapter, as a named collection |
| `/chapters` | "See every place these chapters touch" | the published chapter set |
| `/records` | "See these on the map" | the exact filter currently applied |
| `/books` right rail | "Where books are challenged" | the state |
| `/law` right rail | "By jurisdiction" | the jurisdiction |
| `/law/[slug]` | "Records in this jurisdiction and era" | jurisdiction and era, explicitly not causation |
| `/entity/[id]` topic tags | the topic name | the topic |
| `/methodology` | `A` | the evidence floor set to A only |
| `/data` | "See this on the map" | the population layer at the matching decade |
| Record pages | **Explore this place** | the record, selected |

`/data`'s handoff ships only once the Lens exposes the population layer with its comparability note. Until then `/data` stays self contained, rather than dropping a reader on an unlabelled choropleth with no way back to pins.

---

## 3. The active constraint chip law

**Every param that narrows the result set renders as a visible, clearable chip with its reason string, wherever it lands.** Including `status`.

The Results rail header carries the chip row. A reader who arrives from a chapter sees what the chapter asked for, in words, and can clear any one of it without editing a URL.

Params that do not narrow the set are **named exclusions, not oversights**:

| Param | Why it is not a chip |
|---|---|
| `selected` | It is the record sheet |
| `collection` | It is the collections drawer |
| `find` | It is a focus instruction |

An earlier draft of this rule read "every accepted param must have a Lens control", which is right in spirit and wrong at the edges: shipping it as written produces absurd controls for those three.

Viewport keys are never in the URL at all. `lat`, `lng` and `zoom` are dropped by ADR-017 policy, and `panels` is dropped because which panels a reader has open is chrome state, not shareable meaning. `radius` and `near` do carry meaning and stay.

---

## 4. The named collection handoff

`?collection={slug}` loads an authored record set into the global collections drawer and fits the camera. **This is how a chapter hands its evidence to the instrument.**

The collections store is global and localStorage backed, and Saved sits in the command bar on every surface. So a record saved on the map is still saved on a chapter, and a citation copied from a book uses the same formatter as one copied from a pin.

---

## 5. The handoff, back

The edge runs both ways, and the return half is the half with no implementation today.

**Prose cites records.** A chapter's inline citation chips are the source of truth. The chapter-cites-record edge is emitted as a release build artifact from the citations chapters already carry. In the reading column an entity mention opens the record sheet in its in-document posture; `ESC` closes it and returns focus to the chip. Citation chips jump to the numbered reference, and each reference has a return control back to the sentence.

**Records link back.** The same edge is rendered in reverse as "Chapters that cite this record", in both sheet postures and on `/entity/[id]`. Today `AtlasExperience` hardcodes `sources: []` and `connections: []`, so the sheet always shows its no-sources fallback and never shows a connection, and from the homepage there is no route to any chapter at all.

**Emitting the edge is a prerequisite for folding `/history`**, because the fold removes the other browse path from a record to editorial.

Beyond the cites edge, every record page links to its law, its jurisdiction records and its documented connections, and every law detail links back from the records that cite it. The path is bidirectional in both directions rather than asserted in one.

---

## 6. Returning to the room

A handoff that cannot be walked back is a trapdoor.

- Browser back returns to the referring surface with scroll restored.
- The map results header names the surface the constraint came from, so "clear" has a subject.
- A record opened from a room and then closed returns focus to the row or chip that opened it.
- `ESC` unwinds palette, then overlay, then spotlight, then sheet, and **never navigates**.

---

## 7. Do / Don't

**Do**

- Build every Explore URL through the typed builder
- Write a reason string that names what narrowed the set
- Render every narrowing param as a clearable chip
- Generate the allowlist from the parser's key set, with a two-way drift test
- Keep deep anchors as URL fragments

**Don't**

- Hand write an Explore href anywhere in `src`
- Write a reason string that implies causation the archive has not documented
- Put a viewport, or `panels`, in a shareable URL
- Emit a param the allowlist does not carry, or parse one the builder cannot emit
- Point an internal link at a redirect

---

## 8. Modules

| Concern | Module | Status |
|---|---|---|
| URL state | `lib/map-experience/url-state.ts` (`buildExploreHref`, `buildExploreSearchParams`, `parseExploreSearchParams`) | Built, and drifted from the allowlist; SP-05 generates one from the other |
| Query allowlist | `lib/runtime-hardening/constants.ts`, `query-normalization.ts`, `edge-query-normalization.ts`, `middleware.ts` | Built, with three live stripping defects; SP-05 |
| Share deep link | `lib/share/deep-link.ts` | Built, with a test that no viewport key can be emitted |
| Typed handoff builder | reason-string type, consumed by every room | Pending (SP-15, SP-16) |
| Active constraint chips | `components/map-experience/ResultsRail.tsx` | Pending (SP-16) |
| Collections store | `lib/collections/store.ts` | Pending (SP-17) |
| Cites edge | `lib/release/build-cites-edge.ts` | Pending (SP-20) |

Existing call sites to extend rather than duplicate: `MapInsetMoment` already builds an Explore href through `buildExploreHref` with `selected=<entityId>`, which is the convention entity and story "View on map" controls use. Extend that path; do not add a second builder beside it.

---

## 9. Tests

| Contract | Assertion |
|---|---|
| Allowlist drift | A test fails if the parser reads a key the allowlist lacks, or the builder emits one it lacks |
| No viewport | No viewport key can be emitted into a shareable URL |
| Reason string type | A reason string implying undocumented causation fails to typecheck |
| Chips | A topic or status deep link shows an active clearable chip naming the constraint |
| Reverse edge | Opening a cited record on the map shows its sources, its connections with relations in words, and the chapters that cite it |
| No redirect links | No internal link points at a redirect |
| Palette coverage | Redlining, sundown town, restrictive covenant and Great Migration each return at least one record or chapter |
