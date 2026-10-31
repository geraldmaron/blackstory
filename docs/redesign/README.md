# BlackStory redesign: One Field

**Status:** proposal + working prototype. Nothing in the production app is changed by this directory.
**Date:** 2026-10-31
**Branch:** `redesign/ux-audit-2026-10`

- Audit and plan: this file
- Working prototype: [`prototype/index.html`](prototype/index.html) — see [How to open the prototype](#how-to-open-the-prototype)

---

## The short version

The owner's complaint was "I love the map effect when scrolling but much more of the site
feels clunky and disjointed." The audit found that the disjointedness is not a styling
problem. It is a **data-model problem with a visible surface**.

The codebase states the root cause itself, in a comment at
`apps/web/src/app/stories/[slug]/page.tsx:124`:

> The design law calls this "handing a named collection to the Atlas", but
> `EXPLORE_URL_PARAM_KEYS` has no multi-id or collection param — `selected` carries one
> id — so a named collection is not representable in an Explore URL today.

A reader's investigation is a **set**: a place, a period, a question, several records, and
the thing they came from. The only vocabulary the site has for carrying state between
surfaces is a URL that holds **one** id. So every handoff degrades to a single link, and
every page starts cold. `exploreViewFromDiscovery()` in
`apps/web/src/lib/discovery/discovery-state.ts:116` even drops the text query on the way
across, because Explore has no text pin filter.

That is why stories link 5 records out of 8,661 words, why `/data` never links to the map,
and why a record's back button goes to the homepage. You cannot fix that with transitions.

**The proposal:** make the investigation the persistent object, and make map, list, record
and narrative into *postures of one surface* rather than separate destinations. Keep the
scroll-driven map exactly as it is architecturally — it is already the best thing in the
codebase — and extend its continuity model to everything else.

---

## How the audit was run

Five parallel read-only audits (Sonnet) over the live dev server and source, plus an
independent adversarial pass from a **non-Claude model** (Codex CLI, `gpt-5.1-codex-max`)
so the critique was not one model grading its own homework. Verified findings carry
`file:line`. Claims marked INFERRED in the source reports were either verified by the
orchestrator before use here, or are labelled below.

The Codex pass corrected two of the Claude agents' findings, and those corrections are
reflected below rather than quietly dropped:

- "Five competing map implementations" was overstated. `MapInsetMoment` wraps `MapMoment`;
  `explore-map-underlay` is first-paint markup. There are **three** real map instances, and
  the problem is competing *interaction contracts*, not file count.
- The route-sprawl count was inflated by redirects. `/map`, `/how-it-works` and `/apparatus`
  are already 308s. The surviving overlap is real but smaller than 34.

One earlier orchestrator claim is also corrected here: the "nine rival `:root` palettes"
reading was wrong. The real token source is `packages/ui/src/styles/tokens.css` (472 lines),
imported once from `app/layout.tsx:23`. The nine blocks are small local layout vars. The
palette is sound; the *vocabulary* around it is not (see Area 5).

---

## The five areas

### Area 1 — Navigation, IA, and cross-site continuity

**Sharpest finding: the nav lies about where it goes.** `CommandBar.tsx:211` points the
"Map" tab at `/` (the scroll door), not at the map. `/explore` — the actual map — is never
in the nav at all; it is reachable from the footer and from "See it on the map" links.

**Continuity is one-directional.** `/place/[slug]` hands off correctly, with
`?lat=&lng=&zoom=&selected=`. Nothing comes back: `walk-back-place.ts` hard-codes a
record's back target to `/`. So the map hands you to a record, and the record hands you to
the homepage.

| Symptom | Evidence |
|---|---|
| Stories index links to zero records | `/stories` rendered HTML |
| `/data` and `/lives` never link to the map | rendered HTML, both routes |
| No session state at all | no `sessionStorage` use in the shell |
| Era, filter, scroll lost on every route change | no persistence layer found |

**"Rooms" is a junk drawer.** Fifteen destinations behind one menu, four of them policy
pages, and it hides Lives and Data — the content that makes this more than a map. Codex's
verdict: "a top-level destination whose job is explaining the other destinations. That is
navigation debt presented as architecture."

**Taxonomy mixes three kinds of thing.** Map and Records are *representations*. Stories is
a *format*. Law and Books are *content categories*. Rooms is a *metaphor for leftovers*.
A reader must classify their curiosity according to the publishing system before they can
pursue it.

---

### Area 2 — The map and scroll experience (the part to keep)

This is the best-engineered thing in the app and the redesign is built on it, not over it.

**How the loved effect actually works — the preservation spec:**

| Mechanism | Where |
|---|---|
| IntersectionObserver, 0.42 threshold, most-visible-wins | `lib/story/use-chapter-observer.ts`, `lib/story/chapters.ts` |
| 140 ms settle timer that collapses fast scrolls into one destination | `CHAPTER_SETTLE_MS` |
| Chapters as **data** (center, zoom, pitch, bearing + flags) | `STORY_CHAPTERS`, `chapters.ts:105-160` |
| Camera flight: 1600 ms, fixed curve, `essential:false` | `door-immersive.tsx` `applyCamera` |
| Camera framed against the window box, not the canvas | `door-field-frame.ts` |
| **One** persistent MapLibre instance in the root shell | `MapStage.tsx` `MapStageProvider` |
| Pointer-events pass-through so the wheel still scrolls the document | `door-home.css:~1090` |
| Browse is an **in-place `pushState` morph**, not a navigation | `startBrowse`, `door-immersive.tsx:~360` |

That last row matters enormously: **the continuity architecture already exists.** The app
already knows how to change surface without destroying the map.

**Sharpest finding: it is persistent except when you click the thing it exists for.**
"Open record" is a plain `<a href>` (`RecordSheet.tsx:387`, `:428`). That is a full document
load. It destroys the WebGL context, the tiles and the camera, and the record page then
builds a *second* MapLibre instance (`EmbeddedMap.tsx:288`). The comment at
`MapStage.tsx:1-12` claims the canvas survives "by construction" — true only for
`next/link` navigation, which this is not.

**Instruction debt.** A permanent pill row reads "click a pin · walk · shift + drag or
swipe to turn the map". "walk" is a copper dot that is never defined anywhere in the UI.
`.ds-door__walk-rail` CSS exists with no TSX consumer — orphaned from a removed feature.
The row is hidden below 899px, i.e. hidden exactly where gestures are least discoverable.
The code comment beside the rotation hint says "Naming the modifier is the whole fix",
which is the design failure in one sentence.

**Three gesture contracts on one visual object.** Ambient plate (drag on fine pointer, off
on touch), Live (full), EmbeddedMap (`cooperativeGestures:true`), framed moments (locked).
The reader must discover whether *this particular* map is scenery, navigation, an
illustration, or an instrument.

**Mobile: the signature experience does not exist.** Verified firsthand at 375px: the map
is a decorative band with a "Tap to explore the map" hint, and the scroll narrative does
not run. `door-immersive.tsx:979` says so outright — "Decorative". The headline copy also
changes between breakpoints ("BlackStory happened here" → "History happened here").

**Chapters hard-cut.** Cards are fully opaque rectangles with no enter/exit animation and
no blur, shadow or edge treatment, occluding up to 28rem of the map. All smoothness comes
from the camera lagging the scroll.

---

### Area 3 — Record and archive surfaces

**A record is three templates wearing one name.**

| Type | Renders via | Has breadcrumb / TOC |
|---|---|---|
| Place | `HomeFirstPaint.tsx` | No |
| Entity, Invention | `EntityRecordRoom.tsx` | Yes |
| Law | bespoke `ds-entry__title` | No, and no confidence block, no map |

The same fact lives in different places under different names — "Can I trust this" on a
place, "About this record" on an entity.

**Two confidence vocabularies on one page.** The tile says "Grade A". Each claim says
"Evidence grade: high" with ●●● dots. The explainer is in a collapsed drawer and reads
"not a calibrated probability". A lay reader cannot tell whether A equals high.

**Internal vocabulary leaks to the public.** Public record pages print
`Maturity: Partial Enrichment` and release IDs like
`rel_20260918_dunbar_media_correction_001`. This is the database-dump feel named in the
complaint, on a product whose premise is dignity.

**The archive index is weak at its own scale.** 4,210 records, 43 pages, four native
`<select>`s — one with ~250 topics — and **no sort control at all**.

**What already works and must be kept:** the per-claim citation block with "Source states"
quotations is genuinely excellent evidence design. The place hero (map or photo + three
evidence numbers) is the best template in the app; it just only exists for one record type.

---

### Area 4 — Reading and data surfaces

**Sharpest finding, and the one closest to the owner's complaint: the map effect stops at
the chapter door.** `MapInsetMoment` exists and works — it borrows the persistent plate
when a `mapInset` block scrolls into view, handled at `StoryBody.tsx:215`. Sampled
chapters summon it **zero times**.

**Prose barely links to the archive:**

| Chapter | Words | Record links | Citations |
|---|---|---|---|
| `/stories/the-count` | 8,661 | **5** | 126 |
| `/stories/buying-a-home` | 7,305 | **1** | — |
| `/stories/george-washington` | 1,250 | **0** | — |

**Three chart skins** (`data-charts.css`, the lives figure, `ds-theme-impact-chart`) share
`chart-utils` underneath but have different frames and caption conventions, so charts look
*related* rather than identical.

**The headline share chart is not zero-based** (`BlackPopulationShareChart.tsx:51`,
`domainMin = floor(min-1)`), which exaggerates swings on a 1790–2020 series. Mitigated by
tick labels and a numbers table, but it is the most-seen chart on the site.

**Credit where due:** chart accessibility is above average — every chart ships a `<details>`
numbers table with a caption, and the decade rail marks real discontinuities ("No census
records", "Class measured differently"). The honesty work is already done; the presentation
is inconsistent.

**The trust story is told four times** — `/about`, `/methodology`, `/rooms`, `/data` —
with headings duplicated verbatim ("How a record gets in" appears on two pages).

---

### Area 5 — Visual system and CSS architecture

The palette is fine. The **vocabulary** is the problem.

| Axis | Real number |
|---|---|
| Tokens defined | 271 (105 web + 172 ui) |
| **Tokens referenced but defined nowhere** | **30, with 113 uses** |
| `font-size` declarations / distinct values | 968 / **134** |
| Spacing declarations / distinct values | 2,442 / **350** |
| Distinct media-query widths | **39** |
| Distinct literal colors | 74 |
| Mono vs sans declarations | 259 vs 137 |

**The most damaging single finding: `--ds-space-7` does not exist and is used 12 times**
(`reading-room.css:791`, `record-room.css:556/855/906/987/1008`, `home-first-paint.css:106`).
The scale in `tokens.css:210-229` skips 7. Invalid `var()` fails silently, so those
paddings and margins resolve to zero and section rhythm collapses. Also undefined:
`--ds-font-ui` (14 uses), `--ds-accent-text` (10), `--ds-radius-pill` (3 — so the Door's
pills are square).

Nothing caught this because `/design-system` is **login-gated** (`page.tsx:40`) and shows
components, not a token ramp.

**Near-off-by-one breakpoints** (`48rem` *and* `47.9375rem` *and* `47.99rem`; `560px` *and*
`559px`) mean layouts flip at slightly different widths per surface. That is, mechanically,
what "disjointed between screens" feels like.

**Contrast.** Tokenized pairs pass AA. The risks are `--ds-accent-muted` at **2.06:1**
(must never carry text) and borders at **1.29–1.40:1**, so panel edges nearly vanish in
dark — half the interface is 10–11px mono labels sitting on hairlines that barely render.

---

## The redesign direction: One Field

### The one idea

> **The investigation is the persistent object. Map, list, record and story are postures of
> one surface, not four destinations.**

Everything below follows from that sentence.

### What carries across every surface — "the Thread"

Extend the existing `DiscoveryState` into a first-class object that survives every handoff:

```
Thread {
  place          where you are looking
  period         the decade range in play
  question       the text query (which must survive, unlike today)
  selected       the record in focus
  collected[]    the SET — the capability the current URL vocabulary lacks
  origin         the story or list you came from
  returnTo       camera + scroll position, so "back" means back
}
```

This requires a URL/state vocabulary that can carry a **set** plus an origin plus a return
position. That is the single highest-leverage change in this document, and nothing else in
the redesign works without it.

**One guardrail, non-negotiable:** persistence must never manufacture historical
relationships. Proximity and shared dates stay visibly distinct from documented connections.
A thread is a reader's path, not a claim.

### Design language

**Motion.** Three durations, two curves, and nothing else: `160ms` (state), `480ms`
(surface change), `1200ms` (camera flight). Chapters gain real enter/exit transitions
instead of hard cuts. Reduced-motion cuts camera moves and disables snap.

**Depth.** Cards get a genuine edge: layered gradient, `blur(22px)`, hairline at ~0.12
alpha, and a deep ambient shadow. The current "flat matte only: no shadow, glow, or glass"
rule in `door-home.css` is what makes the narrative card read as an occluding rectangle
rather than something resting on the field.

**Type.** Six sizes, one ladder, **12px floor**. Three faces with three jobs: display
serif for narrative, sans for interface, and **mono reserved for evidence only** — source
strings, citations, counts, coordinates. Today mono is the dominant face (259 declarations),
which is why everything reads as a label and nothing reads as important.

**Color.** Four canvas steps, three ink steps, one accent in three steps. Borders raised
from 1.3:1 to a visible ~0.12–0.22 alpha.

**Space.** Six steps on a 4pt grid. **One** breakpoint at 820px.

**Cartography.** One map contract, one gesture model, one pin language. Pins get a dark
keyline rather than a glow; the single selected pin gets a concentric beacon ring.

### What goes away

| Cut | Why |
|---|---|
| The gesture pill row | Affordances replace instructions. "walk" was never defined. |
| Duplicate "Browse the map" CTAs (4 places) | One primary action per screen. |
| `/rooms` as a destination | A destination explaining other destinations. |
| `EmbeddedMap`'s separate interaction model | One map contract after migrating consumers. |
| Generic `KeepGoing` | Replaced by context-preserving continuations. |
| `/search`, `/history` as separate routes | They return bytes identical to `/records`. |
| Dead code: `explore-map-underlay`, `first-paint-pin-plate`, `.ds-door__walk-rail` | No consumers. |

Retained deliberately: redirect compatibility, citations, source access, precision
disclosures, and the Memorial's distinct treatment.

---

## Phased roadmap

Ordered so that each phase is shippable alone and the risky work comes after the cheap work
has de-risked it.

### Phase 0 — Stop the bleeding (days, no redesign required)

These are standalone bugs. Ship them regardless of whether the rest proceeds.

1. Define the 30 orphan tokens, starting with `--ds-space-7`, `--ds-font-ui`,
   `--ds-radius-pill`. Add a CI check that fails on a `var(--ds-*)` with no definition.
2. Un-gate `/design-system` and give it a real token ramp (color, type, space, motion).
   Without this, finding 1 recurs.
3. Point the "Map" nav tab at the map.
4. Stop `Maturity:` and `rel_*` IDs rendering on public pages.
5. Add a sort control to `/records`.
6. Fix the breakpoint off-by-ones to a single 820px.

### Phase 1 — The Thread (the load-bearing phase)

7. Extend `DiscoveryState` into the Thread object above; persist it across navigations.
8. Extend the URL vocabulary to carry a **set**, an origin, and a return position.
   `EXPLORE_URL_PARAM_KEYS` gaining a collection param is the specific unblock.
9. Replace `walk-back-place.ts`'s hard-coded `/` with the real return position.

*Checkpoint: if Phase 1 does not land, stop. Phases 2–4 are cosmetic without it.*

### Phase 2 — One surface

10. Make "Open record" an in-place morph over the live plate, reusing the `startBrowse`
    `pushState` pattern that already works. Retire `EmbeddedMap` for consumers it covers.
11. Unify the three record templates onto the place template's anatomy (hero, three
    evidence numbers, one confidence vocabulary).
12. Collapse the two confidence vocabularies into one, stated in plain language, with the
    source visible without a click.

### Phase 3 — The story connects

13. Author `mapInset` moments into chapters — the component already works.
14. Link entities in prose by default; make the 5-links-in-8,661-words number a lint.
15. Ship "the N records behind this chapter" as a set handoff to the field.

### Phase 4 — Polish and parity

16. The design language above: motion scale, card depth, type ladder, mono-for-evidence.
17. **Make the map real on mobile.** This is the largest single uplift for the most users
    and it is currently a deliberate non-feature.
18. One chart skin across `/data`, `/lives` and stories; zero-base the share chart or
    annotate the axis break on the chart itself.
19. Merge the four trust pages into one, and move answers beside the actions they concern.

### Risks, stated plainly

- **Phase 1 is a data-model change, not a UI change.** It will take longer than it looks and
  it is where the schedule risk lives.
- **An in-place record morph changes URL and SEO behavior.** Record pages must remain
  server-rendered and directly linkable; the morph is an enhancement over that, never a
  replacement.
- **Mobile map performance is unproven.** The current mobile degradation may be a
  deliberate response to a real device constraint. Measure before committing to Phase 4.17.
- **"One field" can reduce agency.** Immersion is not the same as intelligibility. The
  posture switcher must stay explicit and reversible, and keyboard/screen-reader parity has
  to be designed in Phase 2, not retrofitted in Phase 4.

---

## How to open the prototype

The prototype is a single self-contained HTML file with no build step and no network
dependency. The map geometry is the project's own `public/geo/us-conus-mercator.svg`,
inlined.

**Easiest — open the file directly:**

```bash
open /Users/geralddagher/Developer/Projects/blackstory/docs/redesign/prototype/index.html
```

**Or serve it** (useful if your browser restricts `file://`):

```bash
cd /Users/geralddagher/Developer/Projects/blackstory/docs/redesign/prototype && python3 -m http.server 4199 --bind 127.0.0.1
```

Then open <http://127.0.0.1:4199/>.

### What to try

| Do this | It demonstrates |
|---|---|
| Scroll the opening | The loved effect, with real card enter/exit and a lagging camera |
| Click **Open the field** | Posture change with no page load |
| Click any pin, or a row in the left rail | A record opens **over the live map** — same map node, camera flies to the pin |
| Click **Back to the walk** | Scroll position *and* camera restored exactly |
| **+ Add to thread**, then the Thread bar | The investigation persisting across surfaces |
| **Reading** → scroll to the map moment | The map effect *inside* prose |
| **Show all nine on the field** | The set handoff today's URL vocabulary cannot express |
| Drag the Era scrubber, or **Play the decades** | Honest absence: thin decades are thin records |
| Resize to phone width | A live, full-screen map — not a dead band |
| **Show what changed** (or press `?`) | Annotations tying each fix to its audit finding |

### What the prototype is not

It is a **design prototype**, not a technical spike. The field is an SVG with a CSS
transform camera, not MapLibre — the point is the interaction model and the continuity, and
those are real and clickable. Record content is twelve hand-written samples. Nothing talks
to Postgres. Performance here says nothing about MapLibre performance at 4,202 pins.

---

## Verification performed

Checked in the browser against the running prototype:

| Claim | How it was checked | Result |
|---|---|---|
| Record opens without destroying the map | Compared the `#plate svg` DOM node identity across the transition | `sameMapNodeStillInDOM: true` |
| Camera flies to the record | Read `plate.style.transform` before/after | `scale(1.25)` → `scale(6.75)` |
| Back restores exactly | Compared scroll offset and transform | both byte-identical |
| Map moment fires in prose | Scrolled the moment to center, read transform | `scale(1.3)` → `scale(8.16)` on Philadelphia |
| Set handoff frames nine records | Counted `.pin.is-lit`, read the Thread | 9 lit, thread shows 9 / "The Count" |
| Mobile keeps a live map | 375px viewport screenshot | live field + tab bar, no dead band |
| No console errors | `read_console_messages` | none |

**Not verified:** sustained native scroll behavior end-to-end. The Browser pane in this
session runs hidden, which throttles scroll events, CSS transitions and
IntersectionObserver delivery. Scroll-driven behavior was therefore verified by driving the
same functions the listeners call, with real geometry. Anyone opening the file on a normal
desktop will exercise the native path; if something is off there, that is the first place
to look.

---

## Sources

- Five parallel read-only audits over `apps/web` and the dev server on `:3048`
- Independent adversarial pass: Codex CLI (`gpt-5.1-codex-max`), read-only sandbox
- Orchestrator's own firsthand checks: homepage at desktop and 375px, mobile map gate at
  `door-immersive.tsx:979`, `discovery-state.ts:116`, `stories/[slug]/page.tsx:124`

Note: the `codex` **MCP server** failed to connect this session (`CONNECTION_CLOSED`). The
cross-model pass went through the `codex` **CLI** via Bash instead. The MCP config is worth
fixing separately.
