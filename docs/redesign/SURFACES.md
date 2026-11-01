# BlackStory surface spec

**Status:** living inventory + redesign spec. No application code has been changed.
**Date:** 2026-10-31 · **Branch:** `redesign/ux-audit-2026-10`
**Companion:** [`README.md`](README.md) (the GROUND direction and prototype)

Every claim here was read out of the running app or the source. Six parallel read-only audits
covered the router, layouts, shared components and CSS; anything the auditors inferred rather
than observed is marked INFERRED, and the load-bearing ones were re-verified by hand.

---

## 1. What "consistency" means here, measured

The deliverable is consistency, so this is the baseline it has to move. Measured across 1,268
TS/TSX files and 75 CSS files in `apps/web`.

| Axis | Declarations | Tokenized | Distinct literals | Adherence |
|---|---|---|---|---|
| Color | 2,501 | 2,536 | 15 | **99.0%** |
| Spacing | 2,306 | 1,505 | 102 | 72.6% |
| Radius | 306 | 239 | 10 | 74.7% |
| Duration | 115 | 83 | 13 | 72.2% |
| z-index | 109 | 64 | 7 | 58.7% |
| **Typography** | 908 | 306 | **132 distinct sizes** | **36.6%** |
| **Easing** | 36 | 5 | 7 | **13.9%** |
| **Breakpoints** | 195 queries | 0 | **35 distinct widths** | **0%** |

Color is already solved. **Type, easing and breakpoints are the whole problem**, and they are
the three axes a human eye reads as "clunky and inconsistent" without being able to name why.

### Component adoption (the real cause)

`packages/ui` exports 22 components. Adoption in `apps/web`:

| Component | Files | | Component | Files |
|---|---|---|---|---|
| Notice | 23 | | DetailPanel, ThemeToggle, Timeline | 2 each |
| Button | 14 | | CommandPalette, Dialog, InlineEdit | 1 each |
| EmptyState | 9 | | MapFrame, ResultList, SelectionBar | 1 each |
| Pagination | 7 | | ShellWordmark | 1 |
| Citation, FacetRail | 5 each | | **Toolbar, ToolbarField, MapExplorer** | **0** |
| Card, Confidence, DataTable | 4 each | | | |

Against those numbers the app ships:

- **86 raw `<button>`** in 35 files, plus 39 hand-written `className="ds-button"` anchors.
- **30 raw `<table>`** in 29 files, plus a local `components/room/DataTable.tsx` that shadows
  the `packages/ui` export of the same name.
- **101 `role="status"`/`role="alert"` sites** and **9 separate notice/banner components**
  (AdvisoryNotice, OfflineNotice, BooksAffiliateNotice, LivesRegimeNotice, RecordGapNotice,
  LocationPrivacyNotice, SensitivityContextBanner, DisclaimerBanner, EntitySensitivityBanner)
  plus a Toast.
- **12 `role="dialog"` / 20 `aria-modal` / 3 native `<dialog>`** against 1 `Dialog` consumer.
- **3 pagination implementations** (`/records`, `/books`, `packages/ui`).
- **Admin: 17% adoption** (15 of 88 files), 3 table implementations, 5 toolbar patterns, and
  **baseui's Drawer as a third UI vocabulary**.

Redesigning 65 surfaces one at a time would re-create exactly this. The lever is the shared
layer.

### Broken token plumbing

- **57 tokens are referenced via `var()` and defined nowhere.** Top offenders: `--ds-font-ui`
  (15 uses), `--ds-copper-text` (13), `--ds-space-7` (12), `--ds-accent-text` (10),
  `--ds-muted` (8). Invalid `var()` fails silently, so those declarations do nothing.
- **21 tokens are defined and never used**, including the entire map label/line set and
  `--ds-duration-chapter` / `--ds-ease-standard`.
- **296 of 2,295 CSS classes (12.9%) appear dead.**

---

## 2. The system lock

Before any surface is touched, these are fixed and enforced. Everything downstream references
them and nothing re-invents them.

**Tokens** (from `packages/ui/src/styles/tokens.css`, extended where the audit proved a hole):

| Axis | Lock |
|---|---|
| Color | As shipped. 99% already. Fix `--ds-viz-4` (2.06:1) so it is never a text or meaningful-graphic color. |
| Type | **Not "add xs/sm/md".** 132 distinct sizes prove fragmentation, not that the ramp is too short. First test the existing ramp against four representative surfaces (long-form reading, dense reference, form, record), then define **semantic roles** carrying family, weight, line-height and responsive behaviour — adding steps only where an observed requirement genuinely cannot fit. Adding steps first would launder arbitrary sizes through a token name. |
| Space | The existing scale, plus the `--ds-space-7` hole. |
| Radius | `sm 8 / md 14 / lg 28 / full 999`. Nothing else. |
| Motion | `fast 160 / base 280 / slow 480 / cinematic 900 / chapter 1200`; easings `entrance / standard / exit / cinematic`. No bare `ease`. |
| Breakpoints | **A documented set of literal thresholds + a lint**, not tokens. CSS custom properties cannot be used in media-query conditions, and there is **no postcss/tailwind config in the repo** (verified), so `@custom-media` is unavailable without introducing a build step. "Breakpoint tokens" would have been a fiction that reported consistency without changing behavior. |
| Depth | `--ds-contact-hairline / overlap / plate`. Contact, not an elevation ramp. |
| Map | The plate roles, which `map-contrast.test.ts` already asserts as a contract. |

**Primitives** — ranked by how much duplication each removes:

| # | Primitive | Replaces |
|---|---|---|
| 1 | `Text` / type utilities | 529 literal font-sizes, 132 distinct values |
| 2 | Breakpoint tokens + shared media | 195 queries, 35 widths |
| 3 | `Notice` (absorbing banner + toast) | 9 local components, 101 ad-hoc live regions |
| 4 | `Table` / `DataTable` | 30 raw tables, 8+ local table components |
| 5 | `Dialog` + `Sheet` + `Drawer` | 79 dialog/sheet classes, 3 native dialogs, baseui Drawer |
| 6 | `Card` | 5 local card components, 42 classes |
| 7 | `Badge` / `Chip` | 60 classes in 21 files — **net new, no ui equivalent** |
| 8 | `Button` variants | 86 raw buttons, 39 hand-written CTA anchors |
| 9 | `FormField` (label + error + `aria-invalid` + focus) | every form hand-wires this differently |
| 10 | `EmptyState` + `Skeleton` | 2 EmptyStates, 16 files of ad-hoc empty copy |
| 11 | `MapUnavailable` | the same no-WebGL contract written 3 times with 3 different copies |
| 12 | `Pagination` | 3 implementations |

---

## 3. Surface inventory

66 `page.tsx` routes. Treatment column says which system patterns apply; **Blocked** marks
anything that needs an owner decision (§6).

### 3.1 Ground / map

| Route | Purpose | Key problems | Missing states | Treatment |
|---|---|---|---|---|
| `/` | Scroll journey over the shared plate | 1,246-line component; 2.54 MB HTML; map `aria-hidden` so SR users get no map story; instruction text replaces affordances; 3 breakpoint families in one file | chapter error/empty | Thread pattern; one gesture contract; `MapUnavailable`; affordances replace the pill row. **Blocked:** plate-behind-prose |
| `/explore` | Cold deep link to the armed door | Second route into the same code; 2.72 MB; 3 loading idioms (`loading.tsx`, `AtlasPending`, `AtlasLoader`); 41 dead `explore.css` classes | offline catalog state | One loading idiom; adopt `Skeleton`; delete dead CSS |
| Atlas instrument | Lens / rail / time / camera / legend | **Zoom+reset implemented 3×**; `MapControls` and `CameraConsole` both mount, so SR hears duplicate "Zoom in"; hard-coded widths in JS; two places to clear filters | empty-map, dense overflow | One camera control; `Toolbar` (currently 0 consumers); widths from tokens |
| `MapStage` | The one persistent MapLibre plate | 2,093 lines; plate `aria-hidden` with no live parity surface under JS | — | Keep. It is the best-engineered thing here |
| `EmbeddedMap` | Second live map, record rooms only | Third gesture contract (`cooperativeGestures`); duplicates mount guards | — | Retire onto the plate contract, or scope explicitly |
| Dead | `explore-map-underlay`, `NarrativeCard`, `LayerModelControl`, `DensityLayerToggle` | no importers | — | **Delete** |

### 3.2 Records and archive

There are **4 record templates** and **6 evidence vocabularies**. That is the single worst
consistency failure in the product.

| Section | Place | Record room (entity/invention) | Law | Book |
|---|---|---|---|---|
| Masthead | Map-led + "Confidence" tile | Photo/kind mast + 5 tiles | Fact strip | Title + chips + 4 stats |
| Breadcrumb | yes | yes | none | none |
| Claims + grade meter | yes | yes | **none** | **none** |
| Status / history | **omitted** | yes | strip only | no |
| Timeline | **omitted** | invention/event only | no | no |
| Record file | **omitted** | yes (leaks internals) | "Reviewed date" | no |
| On-this-page | **no** | yes | `RoomJump` | none |

| Route | Purpose | Key problems | Missing states | Treatment |
|---|---|---|---|---|
| `/records` | The 4,210-record index | **No sort control** (order fixed by grade then era); facet counts don't reflect other filters; name clipped with no `title`; kind conveyed only by an `aria-hidden` glyph; 0 `@repo/ui` imports | loading, error, sensitive-row marker | One `Table`/`ResultList`, `Pagination`, `FacetRail`, `FilterBar`; add sort; mark withheld rows |
| `/entity/[id]` | Person / non-standable record room | Duplicate "Visit" blocks; sensitivity banner buried inside "Why this is here"; leaks `rel_2026…`, "Maturity: Partial Enrichment", raw enums | error | One record anatomy; one evidence vocabulary; internals never public |
| `/place/[slug]` | Map-led record | No status, timeline or record file; a **statute** renders here and gets unrelated nearest-place neighbours | loading, error | Same anatomy; route statutes to the law template |
| `/invention/[slug]` | Record room + "What it changed" | Inherits the above | loading, error | Same anatomy |
| `/law`, `/law/[slug]` | Statute browse + detail | **No pagination** on browse; no grades; results `div` has `aria-labelledby` without a landmark role | loading, error | Shared browse pattern + `Pagination` |
| `/books`, `/books/[slug]` | Banned-books catalogue | **Third pager implementation** (12/page) | loading, error | Adopt `Pagination` |
| `/memorial` | Names wall | Letter `h2` accessible name merges letter+count ("A124") | empty, error | **P-01: names are never pins.** Keep non-spatial. Fix heading name |
| `/sources` | Pipeline explainer | Shows pipeline words ("Research run → Capture") as reader copy; lists no actual sources | — | Rewrite as reader-facing, or merge into `/methodology` |
| `/errata` | Correction log + RSS/JSON | No pagination or filter; fine at 3 entries, not at 300 | empty, error | Shared browse pattern |
| `/search` | — | 308 → `/records` | n/a | Keep redirect |

### 3.3 Reading and data

**7 distinct chart skins.** Only `DataChartFrame` has a full labelled table fallback.

| Route | Purpose | Key problems | Missing states | Treatment |
|---|---|---|---|---|
| `/stories` | Chapter index | Links zero records | loading, error | Shared browse pattern |
| `/stories/[slug]` | Long-form chapter | **the-count: 5,850 words, 3 in-prose entity links.** buying-a-home: 4,625 words, 0. No reading progress exists at all. Rail is static below 68rem so phones get no TOC before the text | loading, error | Thread pattern; `MapInsetMoment` as default (2 of 7 chapters use it); link density lint |
| `/data` | Census reference | 16 figures, 558 KB; **truncated y-axis undisclosed** (`BlackPopulationShareChart.tsx:51`); figure titles are `<span>` not headings so heading-nav skips all 16 | partial series, loading, error | One chart frame; disclose axis breaks on the chart |
| `/lives` | Guided census narrative | **Missing estimate coerced to 0** (`LivesMilestoneExperience.tsx:246`) and drawn as a 2px bar (`lives.css:1320`): missing data looks like near-zero data | per-decade no-data treatment | **Data-honesty fix, not styling.** Render absence as absence |
| `/lives/explorer` | Evidence appendix | 1.29 MB; probable duplicate render (INFERRED) | loading | Virtualize / paginate |
| `/lives/[region]` | — | 308 → `/lives/explorer` | n/a | Keep redirect |
| `/rooms` | Hub of hubs | 251 words, 14 headings, explains other destinations | — | **Retire** as a destination |
| `/history` | — | 308 → `/records` | n/a | Keep redirect |

Charts, cross-cutting: axis text is 11px inside a fixed viewBox, so it renders **~4–6px on a
phone**; no chart has a small-screen layout. `role="img"` and `aria-hidden="true"` appear on the
same node in 4 components. `--ds-viz-4` (#d8a178) is **2.06:1** on light canvas and is used as a
data series.

### 3.4 Global chrome, system states, trust, forms

| Surface | Purpose | Key problems | Missing states | Treatment |
|---|---|---|---|---|
| Global chrome | Bar, phone tabs, footer, skip link | "Map" tab points at `/` not the map; `Find` nav contains Rooms (mislabelled landmark); theme toggle has no `aria-pressed`; shell ignores the `ThemeToggle` in `packages/ui` | — | One nav taxonomy; adopt `ThemeToggle` |
| **Route change** | — | **No focus management anywhere.** Focus stays on the clicked link; keyboard users re-tab the bar every navigation | route announcement | App-wide focus + announce on navigation |
| System states | error / 404 / loading | **3 `loading.tsx` and 1 `error.tsx` for 66 routes.** No `global-error.tsx`, so an error in the root layout has no boundary. 404 shows "Press ⌘K" with no touch equivalent | per-route loading + error | `Skeleton` per route family; route-level error boundaries |
| `/about`, `/methodology`, `/faq` | Trust rooms | Conceptual overlap (sourcing, corrections, definitions told 3–4 times) | loading, error | Merge; answers beside the action |
| `/privacy`, `/terms`, `/support` | Policy | Long-form on phones with no mobile rules in their own CSS | — | Reading-room pattern |
| `/design-system` | Fixture gallery | Admin-gated, but the registry lists it as a public noindex route | — | Make it the real token+primitive gallery; un-gate |
| `/submit` | Lead intake | `noValidate`, no `aria-invalid` anywhere, no focus-on-error; success uses a **warning** tone; errors leak raw field names ("location must be…"); description-only leads pass the form then fail downstream on a rule the page copy invites | validation, focus, announce | `FormField`; fix the either-or rule or the copy |
| `/corrections` | Correction intake | Same; **the receipt code — the only credential — is not announced and focus never moves to it** | same | `FormField`; announce + focus the receipt |
| `/corrections/status[/code]` | Receipt lookup | Empty input silently returns; no pending state; unknown code returns 200 (soft-404) | pending, error | `FormField`; proper 404 |

### 3.5 Admin (30 routes)

One shared shell (`AdminShellChrome`, nav from `admin-nav.ts`) — the chrome is fine; the page
bodies are not.

| Cluster | Routes | Key problems |
|---|---|---|
| Triage (13) | `/admin`, `queue`, `submissions[/id]`, `graylist`, `discovery`, `inbox`, `cases[/id]`, `work[/id]`, `evidence`, `quick-add` | 3 table implementations; `CaseQueue` is 819 lines with its own table; j/k keys only on `/queue` |
| Catalog (4) | `catalog[/id|/merge]`, `footprint` | Only surface with bulk edit; `BulkEditPanel` is local |
| Sources (3) | `sources[/org]`, `citation-health` | Raw tables; filters are a bare `<form>` |
| Stories (6) | `stories[/slug][/preview]`, `review[/id]`, `contributors` | 1,245-line editor + 661-line rich-document |
| Publishing (1) | `releases` | Read-only, no publish action |
| System (3) | `audit`, `switches`, `login` | `switches` has no toggle UI |

Admin-wide: **no `error.tsx` anywhere**; one global skeleton; `EmptyState` used **0 times**
against ~10 hand-written "No … found"; `useOptimistic`/`useTransition` used **0 times**; **no
conflict UI** (0 matches for 409/conflict) on a surface with concurrent edits and merges; no
skip link; auth gating written 3 ways. Admin CSS holds **453 of the app's 1,327 literals** —
a third of the inconsistency, on a surface users never see.

> **Verified, not a vulnerability:** an earlier audit flagged `/admin/work` as ungated with no
> `middleware.ts`. I checked: it returns **307 → `/admin/login?next=%2Fadmin%2Fwork`**. The gate
> is `proxy.ts`, Next's single proxy entry point, which composes `adminAuthGate`. Access control
> is intact. Only `RequireAdminAuth`'s comment is imprecise in saying "middleware".

---

## 4. Defects that are not design problems

These were found by a design audit but must be routed elsewhere. Fixing them in a styling pass
would bury them.

| # | Defect | Owner |
|---|---|---|
| D1 | Missing census estimate rendered as a near-zero bar (`LivesMilestoneExperience.tsx:246` + `lives.css:1320`) | **Data honesty.** Contradicts "unknown is a legitimate, stated answer" |
| D2 | Truncated y-axis undisclosed on the headline share chart (`BlackPopulationShareChart.tsx:51`) | **Data honesty** |
| D3 | `/submit` accepts description-only leads that fail downstream (`lead-intake.ts:8-13`) | **Product rule or copy** |
| D4 | Correction receipt code not announced or focused | **Accessibility, high severity** — it is the only credential |
| D5 | Statutes rendering as places with unrelated neighbours | **Data model / routing** |
| D6 | Internal strings public (`rel_*`, "Partial Enrichment", raw enums, raw topic slugs) | **Content pipeline** |
| D7 | 2.54 MB / 2.72 MB HTML on `/` and `/explore` | **Performance** |
| D8 | `/corrections/status/<bad>` returns 200 | **SEO / correctness** |
| D9 | `COORDINATION.md` imported by `CLAUDE.md` but absent | **Repo hygiene** |

---

## 5. Execution plan

### 5.0 The first plan was rejected, and why

A horizontal plan — *Wave 0 plumbing, Wave 1 build all 12 primitives, Waves 3–4 adopt them* —
was put to an independent non-Claude critic (Codex CLI) with instructions to assume it was
wrong. Verdict: **rejected**, on grounds I accept.

| Objection | Why it lands | Change |
|---|---|---|
| **Building primitives first manufactures another vocabulary.** | `packages/ui` already exports 22 components and **Toolbar, ToolbarField and MapExplorer have zero consumers**. Availability has already demonstrably failed to produce adoption. A plan that adds twelve more and defers adoption repeats the experiment. | **Vertical migrations.** Every delivery takes one surface family end to end, extends a primitive only as that surface requires, and **deletes the superseded implementation in the same change**. A primitive may not land without a consumer. |
| **Raw counts are not defects.** "86 buttons and 30 tables do not prove 116 abstraction failures. Native tables may be correct." | True. A `<table>` for tabular data is correct HTML, and `Notice` and toast differ in persistence and announcement semantics — sharing paint does not justify merging contracts. | Counts become investigation targets, not a backlog. |
| **Known harm is queued behind infrastructure.** | Readers see missing census data as near-zero while the team builds Card and Chip. | **Track A below ships independently and first.** |
| **Record-template consolidation is the highest-risk change.** | Normalizing 4 templates and 6 evidence vocabularies risks dropping qualification, collapsing relationship types, losing fragment targets, or implying sharper precision than the source supports — P-02/P-03 territory. "All links return 200" is nowhere near sufficient. | Moved to **last**, gated on per-template rendered comparison across every evidence and precision state, with rollback per template. |
| **"Highest traffic first" is unsupported.** | Pageviews plus a 10% bot/human sample cannot establish task success or researcher dependence. Low traffic may mean low demand *or* an unusable entry point. | Order by **known harm and task criticality**, not traffic. |
| **No retirement or regression controls.** | Defining the orphan tokens *changes global rendering*; deleting "dead" CSS can break dynamically-built classes. | Every migration gated on both themes, realistic data, keyboard + SR behaviour, URL state, and removal of the old implementation. |

One correction to my own earlier wording: **Wave 0 was never visually neutral.** `--ds-space-7`
is defined zero times, so its 12 uses resolve to nothing *today*; defining it introduces spacing
in 12 places. Verified. Token repair is a visual change and needs diff gating like any other.

### Track A — known harm, ships now, independent of redesign

Not styling. Each needs an accountable owner outside the design work.

| Item | Why it cannot wait |
|---|---|
| D1 missing estimate drawn as a near-zero bar | Readers are being shown a false value |
| D2 undisclosed truncated axis on the headline chart | Same, on the most-seen chart |
| D4 correction receipt not announced or focused | It is the user's only credential |
| Duplicate mounted "Zoom in" controls | SR users hear two identical controls |
| `--ds-viz-4` at 2.06:1 used as a data series | Below the 3:1 non-text minimum |
| Chart axis text rendering at ~4–6px on phones | Unreadable; tokenizing the number will not fix it |

### Track B — vertical migrations, ordered by harm and criticality

Each slice: one surface family, end to end, old implementation deleted, both themes, keyboard
and SR checked, URL state preserved.

1. **Forms and correction flow** (`/corrections`, `/submit`, status lookup). Highest task
   criticality, worst accessibility, smallest blast radius. Establishes the migration method.
   Form *orchestration* owns submit-wide error focus and the receipt announcement — a field
   component cannot.
2. **System states**: route focus + announcement, and loading/error for the route families that
   actually need them. Not 66 generated boundaries.
3. **`/records` and the browse family** (`/law`, `/books`, `/errata`): one browse pattern, one
   pagination, add sort.
4. **Ground / map**: retire the duplicate camera control; one no-WebGL contract; delete proven
   dead code.
5. **Reading and data**: one chart frame, honest absence, mobile chart layout.
6. **Record templates — last.** Gated as above.
7. **Admin** — task defects only (conflict UI, bulk selection, empty states). Not a
   consolidation programme.

### Explicitly descoped

A CSS Modules conversion; a universal `Text`/`Card` framework; blanket per-route error
boundaries; replacing the chart implementation; unifying the two MapLibre instances
(`MapStage` and `EmbeddedMap` — two live maps do not prove one should replace the other);
and an admin-wide consolidation. None is established as necessary by these measurements.

Testing: targeted checks per slice; `scripts/ci-local.sh` (Node 22) at the end of a slice, not
per change.

---

## 6. Blocked on owner decisions

Not agent-decidable. Flagged, not violated.

1. **Plate-behind-prose.** `docs/ui/patterns-plate-posture.md`: "The plate is never behind body
   text outside the Instrument." A thread over a live ground is exactly that. Status *proposed*;
   the current `/` already violates it. Blocks the thread pattern outside the Instrument.
2. **Protected Experiences amendments.** P-01 and P-04 are touched (in the direction of *more*
   protection); the register requires an explicit owner decision by its own terms.
3. **Retiring `/rooms`** and merging the trust tier — an IA change with redirect consequences.
4. **`/sources` rewrite vs merge.**
5. **Record-URL changes: none proposed.** All 4,231 sitemap URLs, the 26 redirects and the
   `/entity → /place` contract stay exactly as they are.

---

## 7. Open risks

- **No usage telemetry.** Analytics is pageviews plus a 10%-sampled human/bot class. No
  per-surface or per-control data exists, so "retire this" is an argument, not evidence.
- **Half-migrated primitives** are the main failure mode, and the repo already proves it:
  three exports sit at zero consumers. Mitigation: a primitive may not land without a consumer,
  and the superseded implementation is deleted in the same change.
- **Token repair is a visual change.** 57 orphans currently resolve to nothing; defining them
  alters rendering wherever they are used. Needs diff gating, not a "plumbing" label.
- **Deleting "dead" CSS can break dynamic classes.** 296 classes look dead to a grep, but
  classes built by string concatenation would be false positives.
- **Record pages are citations.** Any change to them is gated on server-rendered output and the
  existing URL contract.
- **Mobile is unverified at scale.** Most responsive findings here are CSS-derived, not rendered.

---

## 8. Execution log

Shipped on `redesign/ux-audit-2026-10`. Nothing pushed.

| Commit | What | Verified |
|---|---|---|
| `eb919775` | Absent census data no longer drawn as a value; share chart zero-based; correction receipt focused | Regression test proven to fail on old source; ticks `0.0/10.5/21.0%`; `activeElement === receipt panel` |
| `ec16fff4` | `Field`/`ChoiceField` own errors; `CorrectionForm` migrated, hand-rolled wiring deleted | 0 → 5 controls `aria-invalid`; category error announced for the first time |
| `f79ab22c` | `/submit` off its third dialect; receipt lookup errors on empty; receipt code is its own element | 0 of the old dialect left; error styled from the kit on a route that never loads `corrections.css` |
| `b12dea27` | Route focus after client-side navigation | Lands on `main[tabindex=-1]`; no steal on first load; query-only change holds focus in the instrument |
| `fc9074dd` | Duplicate zoom controls removed | `MapControls` 0 zoom labels, console 2 |
| `ad870d40` | `/records` sort | Four orderings, four different first rows; facet+sort is `noindex` |
| `52b0a788` | Chart axis labels legible on a phone | 3.9–5.9px → 8.25–11px at 375px, no page-level sideways scroll |
| `59d90b8b` | Non-colour encoding on the free series | Hatch on 8 bars + legend; limit recorded in the commit |
| `69c01700` | Sort ported to the `apps/site` edge | 18 parity assertions pass |

**Totals:** 2,526 tests passing, 0 failing.

### Corrections made during execution

- Removed the duplicate zoom from the wrong component; `CameraConsole.test.ts` states the rule
  ("zoom lives in the console") and caught it.
- Broke `lives-surface-contract.test.tsx` with a code *comment*: the repo asserts on source text,
  so the missing-state phrases must not appear in that component.
- Mounted `RouteFocus` in the remounting template first, which reset its ref so the effect never
  fired. It belongs in the persistent layout.
- Put field-error styles in `corrections.css`, which `/corrections/status` never loads — the trap
  that route's own comment documents. Moved to the kit.
- `--ds-viz-4` remains 2.06:1. The hatch satisfies "colour is never the only signal" and fixes the
  legend, but the free segments are a few pixels tall at this data scale, so it does little in the
  plot area. Darkening the token is what would actually fix it, and that was declined in favour of
  encoding.

### Not started

Record-template consolidation (deliberately last, per the adversarial pass), reading/data chart
frame consolidation, admin task defects, dead-code removal. Dead-code removal was dropped on
purpose: low user value against real deletion risk on 296 grep-dead classes that may be built
dynamically.

---

## 9. Record templates: state after the owner decisions

Four decisions were taken: record-room anatomy wins and gains the hero; three evidence axes with
the grade letter only in citations; provenance reworded for readers; statutes routed by kind with
the URL kept.

**Done**

- Provenance reworded (`54dd56d9`). `Maturity: Partial Enrichment` → `How far researched`,
  `Coverage` → `Research coverage`, `Release` → `Published in` plus a line saying what a release
  id is. Nothing removed.
- Statutes stop posing as places (`54dd56d9`). No nearest-place neighbours, no "Place at a
  glance". Deny-list of non-spatial kinds, after an allow-list silently demoted a school.
- One confidence vocabulary (`dda516ea`). Both templates lead with plain words and the meter;
  the grade letter stays in the citation string, as support text, and in the contract the native
  app shares.

**Blocked, with the reason established**

- **Re-typing statutes into the legal catalog.** `/law` is backed by
  `published.release_legal_snapshots` with a seed fallback — a *separate dataset* from entities,
  not a `kind` column. The Civil Rights Act of 1866 appears in the legal seed only as prose
  inside another snapshot. The entity does carry the sourced facts (enactment date, the veto,
  U.S.C. §§1981/1982), so this is a data move rather than authoring, but it is a `published.*`
  mutation needing the operator republish and Cloudflare purge, not a UI change. The
  `/place → /law` redirect cannot land first: it would 308 into a 404.

**Attempted and reverted, deliberately**

- **Place pages gaining "Status and history".** The sections are already shared; a `firstPaint`
  flag suppressed status. Turning it on works, and two tests then fail by design: the place first
  paint must not match `Active|Current status|In effect from|Status and history`, because it is
  meant to be the record, not a schema card. Those guards are correct — the status section still
  renders raw enum chrome, which is the same leakage removed elsewhere in this slice. The right
  order is to give status a reader vocabulary first, then enable it on place. Reverted rather
  than overriding the guard.

**Not started**

The full place↔record-room anatomy merge beyond the above, and the hero for entity records.
