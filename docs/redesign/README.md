# GROUND: a ground-up reconception of the BlackStory experience

**Status:** proposal + working prototype. No production behavior is changed by this directory.
**Date:** 2026-10-31 · **Branch:** `redesign/ux-audit-2026-10`
**Prototype:** [`prototype/index.html`](prototype/index.html) — see [how to open it](#how-to-open-the-prototype)

This supersedes an earlier draft in this directory that proposed "One Field". That draft was a
reskin: it renamed Map/Stories/Records to Journey/Field/Reading, bolted a state object onto the
existing page structure, and led with a "stop the bleeding" patch list. It has been deleted
rather than kept, because the point of this document is not to proliferate the patterns that
made the product feel disjointed.

---

## 1. The diagnosis: three structural failures, not a styling problem

### Failure 1 — The taxonomy asks the reader to file their curiosity

Top-level navigation is Map / Stories / Records / Rooms. Those are four different *kinds of
thing*: Map and Records are **representations**, Stories is a **format**, Rooms is a **metaphor
for leftovers** holding 15 destinations. Law and Books are **content categories** one level
down; Data and Lives are **experiences** hidden behind Rooms.

Somebody investigating a neighborhood has to decide whether their question is a map question, a
records question, a story question or a census question *before* they are allowed to ask it.
The publishing system is the interface.

The nav does not even describe itself accurately: `CommandBar.tsx:211` points the "Map" tab at
`/`, a scroll-narrative door. The actual map is `/explore`, which appears nowhere in the nav.

### Failure 2 — State cannot travel, so nothing connects

This is the mechanical cause of "disjointed", and the codebase states it plainly at
`apps/web/src/app/stories/[slug]/page.tsx:124`:

> The design law calls this "handing a named collection to the Atlas", but
> `EXPLORE_URL_PARAM_KEYS` has no multi-id or collection param — `selected` carries one id — so
> a named collection is not representable in an Explore URL today.

A reader's investigation is a **set**: a place, a period, a question, several records, and where
they came from. The vocabulary can express exactly one id. So:

| Consequence | Evidence |
|---|---|
| A record's "back" goes to the homepage | `walk-back-place.ts` hard-codes `/` |
| The flagship 8,661-word chapter links 5 records | `/stories/the-count` rendered HTML |
| The stories index links zero records | `/stories` rendered HTML |
| `/data` and `/lives` never link to the map | both rendered HTML |
| The text query is dropped crossing to the map | `discovery-state.ts:116` |
| Era, filter and scroll die on every navigation | no `sessionStorage` in the shell |

`MapInsetMoment` — a map moment *inside* prose, the thing that would connect reading to the
ground — exists, works, and is summoned **zero** times in any sampled chapter.

### Failure 3 — Time is a filter, not an axis

For a product whose material is 230 years of census and record-keeping, time is expressed as
discrete slugs: `era=1950s`, `popDecade`. There is no time range, no continuous axis, and no way
to *watch* a place change. Census lives on its own pages (`/data`, `/lives`, `/lives/explorer`)
as a destination you visit, rather than as a property of wherever you are standing.

### Supporting damage (symptoms, not causes)

- Records are three templates (place / entity+invention / law) with different section names for
  the same facts.
- Two confidence vocabularies on one page: a "Grade A" tile and "Evidence grade: high" per claim.
- Internal strings leak publicly: `Maturity: Partial Enrichment`, `rel_20260918_..._001`.
- `/records` holds 4,210 records across 43 pages with four native selects and **no sort control**.
- 30 CSS tokens are referenced that do not exist, including `--ds-space-7` used 12 times, so
  those paddings silently resolve to zero. 134 font sizes, 350 spacing values, 39 breakpoints.
- On phones the map is explicitly decorative (`door-immersive.tsx:979`) and the scroll narrative
  does not run at all.

---

## 2. ABANDON vs REFINE

The brief was explicit that broken patterns must not be carried forward. This is the line.

### Abandon outright

| Pattern | Why it is broken, not rough |
|---|---|
| **Destinations as the navigation model** | Forces curiosity to be filed by publishing format. |
| **`/rooms`** | A destination whose job is explaining the other destinations. |
| **`/data`, `/lives`, `/lives/explorer` as places you go** | Census is a property of a place at a time, not a page. |
| **The door-as-intro** | Quarantines the best thing in the product in an entrance you leave once. |
| **Story-as-separate-format** | A story is a path across the material, not a different page type. |
| **`/search`, `/history` as routes** | Return bytes identical to `/records`. |
| **Three record templates** | Not a layout bug: a document was being treated as a screen. |
| **Grade letters in the interface** | Two vocabularies, neither legible to a non-researcher. |
| **The gesture pill row** | The UI explaining its own affordances, hidden on phones where it is most needed. |
| **`EmbeddedMap`'s separate gesture contract** | A third cartography on the same visual object. |
| **Dead code** | `explore-map-underlay`, `first-paint-pin-plate`, `.ds-door__walk-rail`. |

### Keep and elevate

- **The scroll-driven camera mechanic.** `use-chapter-observer.ts` (IntersectionObserver @0.42,
  140ms settle, winner-takes-all), chapters as data with camera specs, the single persistent
  MapLibre instance, and the in-place `pushState` morph in `startBrowse`. This is the best
  engineering in the app and the whole redesign is built on it.
- **Per-claim citation blocks** with "Source states" quotations. Excellent evidence design.
- **Honest discontinuity marks** already in the decade rail ("No census records", "Class
  measured differently").
- **The fixed citation format** (`lib/citation/format.ts`). Not re-punctuated.
- **Every record's server-rendered address.** Non-negotiable; see §5.

### Refine (symptoms that resolve once the structure is right)

Record anatomy, the token vocabulary, breakpoints, chart skins, the four overlapping trust pages.

---

## 3. The new spine: the COLLECTION

> **A collection is a reproducible query or an explicit named set. It has a durable, citable
> address. The Ground, the Register, the Chronology and a Thread are all VIEWS of one.**

An earlier version of this spine made **place × time the address itself** and treated the
Register as a lens over the camera. A cross-model adversarial pass rejected that, correctly, on
three counts (§4.2). The collection replaces it.

| Primitive | What it is | Replaces |
|---|---|---|
| **The Collection** | The state and the address. A query (kind, place, date range, evidence floor, sort) or a named set. Citable. | nothing — this object does not exist today |
| **The Ground** | A view: the persistent map, drawing the **drawable subset** and saying how much it could not draw. | `/`, `/explore`, `/map`, `/atlas` |
| **The Register** | A view: the authoritative, sortable, filterable index of the whole collection. | `/records`, `/search`, `/history` |
| **Conditions** | A *sourced reading* you ask for, with its own breaks. Never ambient. | `/data`, `/lives`, `/lives/explorer` |
| **Marks** | Records that have coordinates. Evidence visible *on* the mark. | map pins |
| **Documents** | Records, stories, census reference, methodology, sources, errata, memorial. Server-rendered, canonical, citable. Keep their own URLs and authority. | unchanged |
| **Threads** | An authored, ordered path *over* a collection. Scroll-driven. | `/stories` chapters, the door, `MapInsetMoment` |

**The mental model the brief asked for:**

- A **collection** is the question you are holding.
- The **ground** is where its records are, when they can be placed.
- The **register** is all of them, including the ones that cannot be placed.
- **Census** is a reading you ask for about a place and a period, with its definitions attached.
- A **story** is an argument over a collection, and stepping off it leaves you holding that exact
  collection.
- **Evidence** is how solid a mark is drawn, and it is never color alone.

**Entry is from any axis.** A person, an institution, a quotation, a source, a place or a date
range all form a collection. The interface never demands a place and a date before it will let
you ask a question. That was the deepest flaw in the place × time version.

### Why this is not the departments renamed

The fair charge against both the first draft and the place × time draft is that
Ground/Register/Record/Thread maps onto Map/Records/Record/Stories. The difference is not the
nouns, it is that **a new first-class object exists that the product has never had**: a
collection you can name, cite, hand to someone, hand to a story, and come back to. Today
`selected` carries one id and nothing else survives a navigation. The views are secondary; the
addressable set is the reconception.

---

## 4. The decision that changed under attack: scroll-as-time

The first version of this spine bound **vertical scroll to the decade axis**. It demos
beautifully. It was rejected before being built, for reasons that are not aesthetic:

1. **It breaks the browser contract.** Find-in-page, PageDown/Home/End, the scrollbar as a
   position indicator, and the screen-reader virtual cursor all assume scroll means "move
   through this document".
2. **It makes reading impossible.** Any readable content needs its own scroll context, which
   creates the nested-scroll trap — the exact defect the audit already found in
   `.ds-door__field` (`overflow-y:auto` + `overscroll-behavior:contain` on short viewports).
3. **It cannot be scanned.** This is a research archive. "Take me to 1920" must be one action,
   not a controlled-velocity gesture.
4. **230 years of continuous camera motion is a vestibular trigger**, and the project already
   forbids motion that dramatizes (P-04).
5. **Scroll position is not an address.** Deep-linking a continuous scroll axis means writing
   the URL constantly and still landing approximately.

**What replaced it — and why the loved effect got *bigger*, not smaller:**

What is actually loved is not "scroll moves a variable". It is **scroll-driven camera movement
synchronized with narrative** — scrollytelling, which `chapters.ts` already implements well.

- **Scroll drives THREADS.** The mechanic is preserved exactly, and promoted from a one-time
  entrance to the universal narrative primitive: the entry experience, a story chapter, a
  record's "this place over time", and a census explainer are all threads. The effect now
  appears everywhere in the product instead of once.
- **Time is the DECADE SPINE**, a real control: click, arrow keys, Home/End, URL-addressable at
  `?year=`. And it doubles as the honesty display — each decade's tick length shows how much the
  archive actually holds, so you can *see* that the archive is thin in 1830 before you form a
  belief about 1830.

This is the one place where the beloved thing and the correct thing diverged, and the resolution
gave more of the beloved thing, not less.

### 4.2 What the cross-model pass killed, and what replaced it

The place × time concept was submitted to an independent non-Claude critic (Codex CLI) with a
brief instructing it to destroy the idea. Verdict: **rejected**. Four findings were accepted
without argument, because they are right.

| Objection | Why it lands | What changed |
|---|---|---|
| **A viewport-plus-decade Register is fatal.** "All Alabama churches, 1900–1920, grade A or better, sorted by date" cannot be expressed by a camera rectangle. Worse, it silently drops records outside the camera and records with no coordinates, giving the researcher "an incomplete bibliography that looks complete." | For a citation surface, silent omission is the worst possible failure. | **The query became authoritative and the map became one projection of it.** The Register has independent filters. The ground draws the drawable subset and states the count it could not draw. Verified: moving the camera does not change the bibliography. |
| **"The record is the only document" misunderstands publication.** Stories already carry authorship, publication dates and `Article` JSON-LD. Census reference, methodology, sources and errata are citable too. | Demoting them to "threads" is a regression in publication identity. | **Documents are plural and keep their own URLs and authority.** A thread interprets a collection; it does not replace the published page. |
| **The composition can assert an argument nobody wrote.** A population wash beneath a violence-related mark, then a flight to a church, reads as causation even with no source. | This is the dignity risk, and the first draft only typed explicit record-to-record links. | **Census became an opt-in, sourced reading** with its comparability breaks stated, plus an explicit line: *"Population counts do not explain any individual record on this ground."* It is off by default and never a backdrop. |
| **"Nothing happened here" is unearnable.** Missing records establish neither inactivity nor missing documentation: material may exist elsewhere, be uncatalogued, or fall outside the current filter. | Collapsing four different silences into one is a false claim. | **Four absence states, never merged:** no record matches *this collection*; a documented coverage limit; not surveyed; and (in production) retrieval failure. |

Two further objections were **partly** accepted. The charge of "renamed departments" is answered
in §3 by making the collection a genuinely new object rather than by renaming anything. The
charge that phones cannot host map, timeline, register, evidence and reading at once is accepted
as an unresolved risk and is why §7 ends with a task-based validation gate rather than a claim.

One objection is **rejected**: that the scroll-map should remain only "an authored invitation."
Threads over a collection are more than an invitation — they are how an argument and its evidence
stay attached. The constraint that matters is the one already accepted: a thread must never be
the navigation.

---

## 5. Dignity as a mechanic, not a disclaimer

BlackStory already has binding design law. This proposal is an **amendment to it**, not a
greenfield invention. The relevant rules are in `docs/ui/PROTECTED-EXPERIENCES.md` (P-01…P-06),
`docs/ui/brand.md`, `docs/ui/story.md` and `docs/ui/design-direction-v10.md`.

### Where GROUND implements existing law in code

| Law | Quoted | How GROUND implements it |
|---|---|---|
| **P-04** | "Motion may explain geography, sequence, context, and scale. It **may not dramatize harm**." | A thread step or record flagged sensitive **cuts instead of flying**: camera transition duration is `0ms`, and the card says so in words. Verified: Greenwood step `transitionDuration === "0ms"` while ordinary steps use the 1150ms flight. |
| **P-02** | "Never visually imply a relationship the source material does not establish." | Connected records are typed `doc` or `adj`. Documented links are solid; proximity links are dotted and carry "the sources do not state a connection, and this archive will not imply one." |
| **P-03** | Coarsened points "must not render as an artificial street-level point… If visualization coarsens or approximates, say so in the UI." | Every record carries a precision tier and a "Where the point sits" section stating it. |
| **story.md** | "'unknown' is a legitimate, stated answer, not a gap papered over." | See *absence*, below. |
| **README.md** | "No em dashes and no en dashes on touched surfaces." | Applied throughout the prototype copy. |
| **README.md** | "WCAG 2.2 AA… 44px touch targets on controls." | Spine, register rows and thumb-zone actions are ≥44px on phones. |

### Absence, rendered — in four kinds, never one

The current site handles absence with a sentence of apology: *"A blank area does not establish
that nothing happened."* This design makes it a property of the display, and distinguishes
silences that are not the same thing:

1. **No record matches this collection** — a statement about the query and about what has been
   catalogued, not about the past.
2. **A documented coverage limit** — before 1870 the federal census counted most Black people as
   tallies without names. The ground goes **cold-hatched** when the whole range sits in that era,
   the spine ticks turn **blue rather than amber**, and the panel leads with it as a headline
   rather than hiding it in a drawer.
3. **Not surveyed** — the census did not observe this place at this time, and it does not
   interpolate between its own dates.
4. **Retrieval failure** — in production, a load error must never render as an empty map.

The most honest screen in the design: **1830 shows 2,328,642 Black people, 18.1% of the country,
and 3 records.** The archive's own failure is visible rather than excused, and "not recorded" is
never drawn in the colour of a record.

### Records that cannot be drawn

Two sample records exist specifically to exercise this: a Freedmen's Bureau teacher roll that
names people but no place, and an oral history whose address is **withheld at the family's
request**. They match collections, appear in the Register flagged "not on the ground", are
included in any citation of the collection, and state on their own page why no point is drawn.
Withholding is recorded rather than hidden. A map-shaped product must not make undrawable
evidence disappear.

### The anti-glide guarantee

The serious objection to a continuous immersive surface is that it turns an archive of Black
trauma into scenery you slide across. The specific defenses:

1. **Sensitive records stop the camera.** No flight, no flourish, stated plainly.
2. **No heat, no density ranking, no alarm hues.** `brand.md:144` forbids them; the palette has
   one accent and one cold, and confidence is never color-only (it is also size and fill).
3. **The Memorial is deliberately NOT a posture of the ground.** P-01 forbids "turning names
   into map pins". It stays a separate, still, non-spatial surface, linked but never absorbed.
4. **Threads lead with presence, not incident** (`story.md`: "Presence over incident"). The
   Greenwood step states destruction *and* rebuilding in the same breath.
5. **The camera is still not in the URL.** `url-state.ts:168-183` excludes lat/lng/zoom because
   "a tight zoom on one county reads as an editorial claim about that county". GROUND shares
   **named place + decade**, never raw coordinates. That decision is upheld, not reversed.

---

## 6. Hard constraints this design must not break

From a constraints audit of the live app. These are promises already made to the outside world.

1. **4,231 sitemap URLs stay server-rendered.** `/place/{slug}`, `/entity/{id}`,
   `/invention/{slug}` return real content in raw HTML today, verified by curl. **The Record is
   a page, not a panel.** The ground's record view is an enhancement layered over that page; it
   never replaces it. If JavaScript fails, the record still exists.
2. **`/entity/{id}` → `/place/{slug}` addressing is KEEP AS IS** (`design-direction-v10.md:150`).
3. **26 permanent redirects must keep resolving**, with no chains (`redirect-table.test.ts`).
4. **`/explore` must not become a redirect to `/`** — a documented rejection at
   `next-config-redirects.mjs:60-63`.
5. **The edge allowlist strips unknown params.** `?year=` must be added to the parser or it is
   308-stripped. It must be quantized to 24 decade values, not a free integer.
6. **Crawl-cost guard.** `/explore?` and `/records?q=` are disallowed in robots.txt because
   variants were 81k of 128k Cloudflare misses in one day. Any new param space needs the same
   canonicalization or it recreates that storm.
7. **No usage telemetry exists in-repo** (analytics is pageviews plus a 10%-sampled
   human/bot class). **Deleting destination pages cannot be justified or refuted from in-repo
   evidence.** That is a real gap, and it is why §7 starts with instrumentation.

### Two conflicts that need an explicit owner decision

- **Plate-behind-prose.** `docs/ui/patterns-plate-posture.md` states "The plate is never behind
  body text outside the Instrument… A full bleed plate says nothing and asserts everything." A
  thread scrolling over a live ground is exactly that. The doc's status is *proposed*, and the
  current `/` door already violates it. **GROUND requires either amending this rule or confining
  threads to a framed plate.** This cannot be decided by an agent.
- **Amending the Protected Experiences register** requires "an explicit owner decision" by its
  own terms. Items P-01 and P-04 are touched by this design, in the direction of *more*
  protection, but the amendment still has to be made deliberately.

---

## 7. Roadmap

Sequenced so the irreversible decisions come after the evidence, and each phase is independently
defensible.

### Phase 0 — Earn the right to delete things (2–3 weeks)

0.1 **Instrument the current product.** Per-surface and per-control usage events. Without this,
every deletion in §2 is an assertion. This is first for a reason.
0.2 Take the owner decisions in §6: plate posture, and the P-01/P-04 amendments.
0.3 Fix the 30 orphan tokens (`--ds-space-7` first) and add CI that fails on an undefined
`var(--ds-*)`. Un-gate `/design-system` and give it a real token ramp, or finding 0.3 recurs.

*Gate: if 0.2 does not get an owner decision, GROUND does not proceed. Stop here and ship 0.3.*

### Phase 1 — Make the collection exist (the load-bearing phase)

1.1 Define the **collection** as a first-class object: a reproducible query (kind, place, date
range, evidence floor, sort) or an explicit named set, with a durable address and a citation.
1.2 Extend the URL vocabulary to carry it, plus an origin and a return position. The
`EXPLORE_URL_PARAM_KEYS` collection param is the specific unblock, and `from`/`to` must be
quantized decades passed through the edge allowlist with 308 canonicalization.
1.3 Make the **query authoritative**: `matching()` is the bibliography, `mappable()` is only what
can be drawn, and the difference is always stated. Preserve the existing `DiscoveryState`
distinction between matching and mappable records rather than collapsing it.
1.4 Replace `walk-back-place.ts`'s hard-coded `/` with the real return position.

*Gate: if Phase 1 does not land, stop. Everything after it is cosmetic without it.*

### Phase 2 — The views

2.1 Promote the persistent plate to the ground view; retire `EmbeddedMap`'s gesture contract.
2.2 Build the decade spine as a **range** control with the density/honesty rendering, alongside
canonical select-based date controls for keyboard and assistive tech.
2.3 Rebuild `/records` as the Register view of a collection: independent filters, sorting, and an
explicit count of records that cannot be drawn.
2.4 Move census into an **opt-in sourced reading** with comparability breaks. Keep `/data` and
`/lives` as published reference documents; they stop being the only way in, not the only copy.
2.5 Implement the four absence states.

### Phase 3 — Threads everywhere

3.1 Generalize the chapter mechanic into a Thread primitive usable on any surface.
3.2 Re-author `/stories` chapters as threads; make `MapInsetMoment` the default, not the unused
exception. Lint the record-link density so "5 links in 8,661 words" fails review.
3.3 Ship the set handoff ("the nine records behind this chapter").

### Phase 4 — The record and the register

4.1 Unify the three record templates onto one anatomy; one confidence vocabulary in plain
language, with the grade letter surviving only inside the citation string.
4.2 Stop internal strings rendering publicly.
4.3 The Register: sortable, same state as the ground.

### Phase 5 — Parity and polish

5.1 **Make the ground real on mobile.** Largest uplift for the most users; currently a
deliberate non-feature.
5.2 One chart skin; zero-base the headline share chart or annotate its axis break on the chart.
5.3 Merge the four trust pages; move answers beside the actions they concern.

### Risks, stated plainly

- **Phase 1 is a data-model change.** It will take longer than it looks; that is where schedule
  risk lives.
- **Mobile ground performance is unproven at 4,202 pins.** The current degradation may be a
  considered response to a real device constraint. Measure before committing to 5.1.
- **A continuous surface can reduce agency.** Immersion is not intelligibility. Mode switching
  stays explicit and reversible, and keyboard/SR parity is designed in Phase 2, not retrofitted.
- **Deleting routes without usage data is a guess.** Phase 0.1 exists to remove that excuse.

---

## How to open the prototype

Self-contained single HTML file. No build, no network. Map geometry is the project's own
`apps/web/public/geo/us-conus-mercator.svg`, inlined.

```bash
open /Users/geralddagher/Developer/Projects/blackstory/docs/redesign/prototype/index.html
```

Or serve it, if your browser restricts `file://`:

```bash
cd /Users/geralddagher/Developer/Projects/blackstory/docs/redesign/prototype && python3 -m http.server 4199 --bind 127.0.0.1
```

Then open <http://127.0.0.1:4199/>.

### What to try

| Do this | It demonstrates |
|---|---|
| **Register** → set Kind `place`, From `1900`, To `1930`, Evidence `Partial` | A real research query. The URL becomes `?kind=place&from=1900&to=1930&floor=B` |
| …then pan the map far away | **The bibliography does not change.** The query is authoritative; the camera is a view |
| Set From `1860`, To `1980` and read the panel | "2 of these 11 have no coordinates precise enough to draw" — undrawable evidence is never silently dropped |
| Open **Oral history: a Hayti household** | A withheld location, recorded rather than hidden (P-03) |
| **Set the range entirely before 1870** (shift-click the spine to set the start) | Absence rendered: cold ground, blue ticks, the coverage limit as a headline |
| Arrow keys / Home / End on the spine | Time as a real control, not a hijacked scroll. Shift sets the range start |
| Watch the tick lengths | The control *is* the honesty display |
| **Show the census reading** | Opt-in, sourced, with both comparability breaks and "population counts do not explain any individual record" |
| **Follow a thread**, then scroll | The loved scroll-camera effect, now a view over a collection |
| Reach the **Greenwood** step | The camera cuts instead of flying. Dignity as a mechanic (P-04) |
| …then leave the thread | You are holding that step's collection: `?state=Oklahoma&from=1900&to=1920` |
| Click any mark | The record, with the project's exact citation format and a precision statement |
| Look at a record's dotted connection | Juxtaposition that refuses to imply causation (P-02) |
| Search a person, e.g. `McCoy` | Entry from a non-place axis. It never demands a place and a date first |
| Watch the address bar throughout | Named place, kind, decades and evidence floor. Never raw coordinates |
| Resize to phone width | A live ground, 44px targets, no dead band |
| **Show what changed** (or `?`) | Annotations tying each decision to its finding |

### What this prototype is not

A **design** prototype, not a technical spike. The ground is an SVG with a CSS-transform camera,
not MapLibre; the point is the interaction model, and that is real and clickable. Twelve
hand-written records, four census places, five thread steps. Nothing talks to Postgres.
Performance here says nothing about MapLibre at 4,202 pins.

---

## Verification performed

| Claim | Check | Result |
|---|---|---|
| **The camera cannot narrow a bibliography** | Ran `kind=place, 1900–1930, floor B`; captured rows; moved the camera to Boston; re-captured | identical rows. `bibliographyUnchangedByCamera: true` |
| A real research query is expressible and addressable | Set the filters, read the URL | `?kind=place&from=1900&to=1930&floor=B`, sub-line "places · 1900 to 1930 · partly evidenced or better · 4 records" |
| Undrawable records are never dropped | Range 1860–1980; read the counts and the register | 11 matched, 9 on the ground, notice naming the 2, both rows flagged "not on the ground" |
| A withheld location is stated, not hidden | Opened the oral-history record | "Not drawn on the ground. The location is documented but withheld at the family's request." |
| Absence rendering fires for a pre-1870 range | Set the range; read regime, hatch, ticks | `regime="unnamed"`, hatch opacity 1, 8 cold ticks, 2,328,642 people / 3 records |
| Census is opt-in and carries its breaks | Toggled the reading | hidden by default; 4 notes incl. both the 1870 and 2000 definition breaks and the no-explanation line |
| Dignity cut at sensitive records | Read `plate.style.transitionDuration` at the Greenwood step vs an ordinary step | `0ms` vs `var(--d-fly)` |
| A thread step hands you its collection | Read state + URL while stepping | `?state=Oklahoma&from=1900&to=1920&record=greenwood` |
| Citation uses the project's fixed format | Read the rendered citation | `"Mother Bethel A.M.E. Church." BlackStory Archive, Philadelphia, Pennsylvania, 1790s. Evidence grade A, 4 sources. Accessed 2026-10-31. https://blackstory.org/place/…` |
| Mobile is usable | 375px screenshot after layout fix | No collisions; 44px targets; live ground |
| No console errors | `read_console_messages` on a clean load | none |

**Not verified:** sustained *native* scrolling, and CSS transition end-states in situ. The
Browser pane in this session runs hidden, which throttles scroll events, CSS transitions and
IntersectionObserver delivery — observed directly as an opacity transition stuck at
`currentTime: 0` and a panel transform frozen at its start value. Thread behavior was therefore
exercised by driving the same function the scroll listener calls, and panel states were
confirmed by forcing the frozen animations to finish (`transform` settles to `none`, i.e. the
CSS is correct and the clock was the problem). On a normal desktop the native path runs; if
anything is off there, that is the first place to look.

**Also not verified, and it matters:** whether this interaction model survives a realistic
research task on a phone, where ground, time control, register, evidence qualifiers and reading
content all compete for one viewport. That is an accepted open risk, not a solved problem.

---

## Sources

- Five parallel read-only audits over `apps/web` and the dev server on `:3048`
- A constraints audit of the URL, SEO, citation, a11y and dignity contracts
- Independent adversarial passes: Codex CLI (`gpt-5.1-codex-max`), read-only sandbox — one on
  the current product, one attacking this concept
- Firsthand checks by the orchestrator at desktop and 375px

The `codex` **MCP server** failed to connect this session (`CONNECTION_CLOSED`); the cross-model
work went through the `codex` **CLI** via Bash. Worth fixing that config separately.
