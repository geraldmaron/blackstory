# BlackStory design system: The Exhibit (v13)

**Status:** binding (owner go-ahead 2026-11-23, phase 0 landed the same day). This is the one
design system. Phases 0, 1, 2a, 2b, 3a, 3b, 4a, 5, 6a and 7 are done (3b, 4a, 5, 6a and 7 are not signed off); every later phase
is specified, not yet built, and those surfaces still render the earlier looks until their phase
lands. Section 13 is the plan of record: each row says what was done, what was deferred and what
was not checked, and a new session starts from the first row not marked done. What waits on the
owner is section 15.
**Supersedes:** every design direction in [`archive/`](./archive/) and the visual half of
`brand.md`. Ten owner decisions are in section 2; Codex's adversarial review is section 16;
findings carried from earlier directions are section 17.
**Still binding, unchanged:** `PROTECTED-EXPERIENCES.md` (memorial, evidence honesty, precision,
dignity), `story.md` (copy), the accessibility floor in `brand.md`, the brand marks and the brand
colors, American English, real photographs only, no sound.

Comps (Codex image model, 2026-11-23, direction only, not specs): [`v13/comps/`](./v13/comps).

## 1. Recommendation

Stop redesigning pages and build one unit. Every thing the site shows (a photograph, a
document, a map frame, a chart, a name) becomes an **exhibit**: the object, a label that says
what and when, and a receipt that says where it came from and how well it is evidenced, with a
stable address and a citation. Pages are arrangements of exhibits on two grounds, ink for the
map and paper for reading. The areas differ by which kind of exhibit leads (places in the
Archive, documents in Stories, figures in Data, names in the Memorial), so they look related
and still fit their material.

Build order is system first, then anchors, with the front page and the History to BlackStory
retelling last because they draw on every other part.

Top risks: this is the thirteenth direction in four months and will fail the same way unless
old code is deleted as new code lands (section 4 rule 1); the retelling makes editorial picks the
data cannot make by rule (section 9.7); merging Map, Records and Search changes URLs and state
(section 9.2).

## 2. Decisions on record (owner, 2026-11-23)

| # | Question | Decision |
| - | -------- | -------- |
| 1 | Which web app | `apps/web` (Next.js). Tokens and specs written so `apps/site` and mobile can consume them |
| 2 | Ground | Ink world, paper pages. Copper is the only saturated color. Both themes remain |
| 3 | Generated imagery | Abstract textures may ship. Nothing depicting a person, place, document or event. `brand.md` and `/about` get reworded to say exactly that |
| 4 | History to BlackStory | Scroll scenes with real records, skippable, no timer, static under reduced motion |
| 5 | Site shape | One Archive with Map, List and Timeline views; Law, Books, Presidents and Inventions become lenses. Old URLs redirect |
| 6 | Data language | W.E.B. Du Bois lineage in the brand palette, credited. Every figure also has a plain chart and a numbers table |
| 7 | Classroom | Cite, print, share-exact-view and content notes are required parts of the system |
| 8 | Motion | One motion library may be added |
| 9 | Build order | System, then anchors: Record, Archive, Story, Data, Front last |
| 10 | Mobile | One token source for web and app in the first phase; app screens follow each signed-off web anchor |

## 3. What was reviewed

| Input | How | Where |
| ----- | --- | ----- |
| 6 project reference sites, 10 Awwwards winners | Headless Chromium on a real GPU, 1440 by 900 and 390 by 844, several scroll depths, DOM probes; screenshots read | Scratchpad `refs/` (session-local), summary in section 5 |
| Current site | 14 routes captured from the dev server at both widths, plus the existing v12 home and Explore captures | Section 4 |
| Direction history | v4 to v12, critiques, `git log` on `apps/web/src`, `docs/ui`, `packages/ui` | Section 4 |
| Code | Tokens, kit, CSS footprint, lint baseline, routes, mobile app | Section 6 |

Not verified: interiors of four award sites that never passed their entry gate; real Chromebook
performance; any site's screen-reader behavior. Awwwards blocked headless browsing, so award
labels come from its listing pages read as text.

## 4. What the history says

Twelve directions between 2026-07-17 and 2026-11-23. The same things were added and reversed:

| Tried and reversed | Times | Lesson |
| ------------------ | ----- | ------ |
| A count numeral as the hero ("4,403", "41.3M", "6") | about 4 | A count is not a subject. Display type carries names, places and years |
| Copper and sand bands as decoration | 3 | A colored field has to mean something or it goes |
| The globe | shipped 11-20, removed 11-23 | The archive is the United States; WebGL cost blocking time +65 to 70% on a phone |
| Sepia or toned photographs | 2 | False aging. Photographs stay in their own color with their date stated |
| Glass, glow, grain | banned, lifted, narrowed, re-added | Texture is allowed only as a named material on a named ground |
| Metaphor names (Door, Rooms, Ledger, Atlas, Orbit, reels) | 6 | Readers never saw the metaphor; the code kept every one |
| Headline morph (five words, one, five, removed) | 4 | It was treated as a headline effect. It is the brand's argument and needs its own scene |
| Flagship home first, rollout after | every time | The rest never caught up. Five looks were live at once on 11-22 |

Root cause: each direction was a new look for the home page laid over the last one. None
replaced code. Today `apps/web/src` holds 80 stylesheets and 31,716 lines, the retired Door still
renders `/explore`, three button families coexist (`.ds-button`, `.ds-cta`, room chips), the token
lint grandfathers 523 violations, and `docs/ui/README.md` still names v10 as binding.

Kept because it survived every version or the owner said so: the scroll dive to a pin and the
traverse between places (owner, 11-22: "loved and stays"); ink, paper and copper; Schibsted
Grotesk, Geist, Newsreader and Geist Mono; the evidence grade in words; the memorial's
handwritten names; "happened here"; the `/law` time rail and the `/books` state tile map (signed
off 11-21); color photographs with a visible credit.

**Rules that follow, binding on every phase:**

1. **One in, one out.** A phase that adds a component or stylesheet deletes what it replaces in
   the same phase. Every phase ends with fewer CSS lines in `apps/web/src` than it started with,
   or says why not.
2. **No metaphor names** in code, docs or UI. Things are named for what they are (Archive, Record,
   Figure, Receipt).
3. **System before surface.** A page may not introduce a color, radius, shadow, type size or
   button the kit does not have. The token lint baseline only falls.
4. **Display type is a name, a place or a year.** Never a count.
5. **A field of color states a ground** (section 7.1). No bands.
6. **Sign-off is per anchor, at nine window shapes, on live data**, before the next anchor starts.

## 5. What the references do, and what is taken

| Pattern | Seen on | Taken as |
| ------- | ------- | -------- |
| One numbered figure with label, sentence, citation and footnote in a single composition | Plastic Human | The exhibit frame and receipt (7.3) |
| Every object carries title, maker, credit and rights; a year scrubber is the control | Getty Tracing Art | Credit rule, `YearScrubber` (7.6) |
| Photographs in crop marks with place and date | The Other Side of Truth | Crop marks as the frame's edge |
| Table of contents inside the hero, chapter rail that persists | Shopify Editions, Corn Revolutionized | Front page contents, `ChapterRail` |
| The collection is the first screen, with a view switch | 197 Historias | Archive with Map, List, Timeline |
| Grotesque and serif italic inside one statement | Lando Norris, Shopify | The accent rule (7.2) |
| Two flat colors that invert by chapter | Plastic Human, Lando Norris | Ink and paper grounds |
| Same story in one column on a phone, subject above text | 7 of 16 | Mobile rule (section 11) |

Rejected, each seen on most award sites: a loader (15 of 16), an entry gate (6), scroll used as
a camera so the page never scrolls (8), text drawn in canvas (Igloo exposes no text at all), no
navigation or a hamburger only (9), sound prompts, labels dropped on phones. They cost 4 to 16
seconds to settle on a fast Mac, break find-in-page, deep links, translation and the back
button, and none of the 3D references ships a reduced-motion rule. An archive students have to
cite cannot pay those costs.

## 6. Where the code stands

| Fact | Consequence |
| ---- | ----------- |
| Tokens live in `packages/ui/src/styles/tokens.css` (378 declarations), mirrored in `tokens/colors.ts`, held by `css-parity.test.ts` and contrast tests | This stays the source. Phase 1 prunes it |
| A second always-night "world" palette and a "night atlas" map palette sit beside the theme palette | Folded into the ink ground |
| Mobile generates its tokens from the brand pack files (`brand/tokens/colors.json`, `typography.json`, `brand.css`) through `apps/mobile/scripts/tokens/brand-source.ts`, plus its own supplementary radius, motion and easing values; web reads `tokens.css`. Two derivations of one pack, with different easing and stray radii | Phase 1 makes both derive roles, radius and motion from one module in `packages/ui/src/tokens` |
| Citation formatting already exists (`apps/web/src/lib/citation/format.ts`, one fixed house format with an injected access date) | `Cite` extends it with MLA, APA and Chicago; it is not new |
| Explore keeps the map camera out of the URL on purpose (`use-explore-url-sync.ts`, `docs/decisions-carryover.md`); Records has its own canonicals, crawl exclusions and pagination; `/search` already redirects | Share-exact-view excludes camera (9.2). The Archive merge is a migration, not a view switch |
| No chart library and no animation library; charts are hand-drawn SVG in `components/data/chart-kit.tsx` | Keep hand-drawn SVG. Add one motion library (decision 8) |
| `/design-system` is hand-written JSX behind the staff gate | Regenerated from the kit in phase 2 |
| `/history`, `/apparatus`, `/how-it-works` are redirects already | Removed from the route table, redirects kept |
| The catalog has no gender field | The retelling's picks are a reviewed list, not a query (9.7) |
| `apps/site` (Expo web) is documented as the replacement for `apps/web` | Out of scope by decision 1. Its README needs a line saying so |

## 7. The design system

One document (`docs/ui/DESIGN.md`), one token source (`packages/ui`), one gallery
(`/design-system`, generated from the kit so it cannot drift).

### 7.1 Grounds

A ground is a full surface with a meaning. There are four, and a page states which it is on.

| Ground | Color | Means | Used by |
| ------ | ----- | ----- | ------- |
| Ink | Black Ink, Charcoal for raised parts | The map: where | Archive map, map frames inside exhibits, the retelling |
| Paper | Archive Paper, Surface for raised parts | The page: what is known | Records, stories, data, method pages, lists |
| Copper | Copper, ink type | A turning point | At most once per page, and only in stories and the retelling's last scene |
| Sand | Page Sand, ink type and an ink outline | A measured quantity | Fills inside figures only, never a page section |

Dark theme: paper pages become charcoal sheets with paper type; the ink ground does not change.
Light is the default for paper pages because projectors and printers need it; the theme toggle
and the stored choice keep working. Print always uses paper.

Materials (decision 3): `paper` (fine rag fiber, on the paper ground only) and `halftone` (dot
screen, as a fill for sand and copper fields in figures and for year numerals). Both are
abstract generated textures recorded in a manifest with their prompts. `grain`, `dust`,
`ember-haze` and `deckle` are deleted: none carries a meaning. No texture ever sits over a
photograph, a document or body text.

### 7.2 Type

The four families and seven roles in `brand.md` stay. Changes:

- **The accent rule.** A display or headline line may set one word in Newsreader italic, in
  copper on ink or ink on paper. It marks the word the sentence turns on ("*here.*", "*Her*
  story"). One per line, one line per screen.
- **Numeral role is for years and decades only** (rule 4). Counts are set in body or meta.
- The alias tokens (`--ds-text-display-title`, `-display-hero`, `-display-1`,
  `-display-numeral`) are removed with their last users.
- Compact scale: display tops out at 88px, headline at 44px. The page earns size from the
  exhibit, which is large, and keeps type tight around it.

### 7.3 The exhibit frame

The one new idea, and the thing every area shares.

```
FIG. 03 · PLACE · 1904 · FIRST DOCUMENTED        label: kind, year basis, in mono caps
⌜                                      ⌝
   the object: photograph, document,             crop marks, square corners,
   map frame, chart or name                      no shadow, no radius
⌞                                      ⌟
Credit · license · source page        [Cite]     receipt line, always visible
```

- **Object kinds:** photograph, document, map, figure (chart), name. Each has one renderer.
- **Label** states the kind and what the year means ("first documented", "date not on record",
  "ratified"). It never implies a photograph is from the period.
- **Receipt** carries the credit and license for an image, or the source and the evidence grade
  in words with its glyph for a claim. The grade is never a letter (owner, 11-15).
- **Address:** every exhibit is linkable by a persistent identifier built from the record id
  and the claim, image or figure id, so a citation made this semester resolves next semester.
  The "FIG. 03" number is a reading aid for the page and is never the address.
- **Dates are kept apart.** The label's year is the subject's date and says what it means. A
  citation's date is the page's publication or revision date. The two never share a field.
- **A receipt belongs to one claim.** A document image beside three claims is not proof of all
  three; each claim names its own source, and a disputed value shows both values and both
  sources instead of one grade.
- **Cite** (decision 7) extends the existing `lib/citation/format.ts`: a small popover with MLA,
  APA and Chicago strings built from the record's own fields plus the injected access date, and
  a copy button. No citation is offered for a field the record does not have; the string says
  "n.d." when the date is not on record.
- Crop marks are the only ornament. They are drawn in CSS, not an image.
- A harm-adjacent exhibit uses the quiet variant: no crop marks, no motion, no enlargement.
- **The memorial wall is not an exhibit** and is exempt from this section. Its handwritten
  names, their fading and its press behavior are protected as they are (P-01).

### 7.4 Shape, depth, space

- **Radius:** 0 for exhibits, sheets and fields; 8px for controls; full for chips. The 14px and
  28px steps are retired with their users.
- **Depth:** none on the page. A shadow exists only where something floats over the map (the
  record panel, a dialog, a phone sheet). Glass and backdrop blur are removed.
- **Rules:** a 1px hairline separates; a 2px ink rule opens a section.
- **Space:** the 4px rhythm stays. Section spacing drops one step everywhere (compact), and a
  12-column grid capped at 72rem replaces per-page grids. Dense is allowed where rows are rows;
  an exhibit always gets air.

### 7.5 Motion

- **Library:** none. The phase 7 spike (2026-11-23) built the History to His story scene twice,
  with the same camera code under both: (a) CSS view timelines for the word, (b) `motion`
  14.14.0 (`useScroll`, `useTransform`; its package data lists React 18 and 19 as peers and its
  docs give `motion/react` in a client component, which is how it ran under Next 16.4 and React
  19.3). Measured on a production build, 4x CPU, a steady wheel from scene 1 into scene 2 and
  back, two runs each on a 1280 by 800 window and a 390 by 844 phone profile: long tasks over
  50ms 67 to 90 for (a) and 66 to 90 for (b); over 200ms one each, 723 to 756ms, the same task in
  both; the word within one frame of the scroll in both (largest gap 0.19 of the fade for (a),
  0.18 for (b)); the camera identical, since it is the same code. `motion` adds 51.1 kB gzipped
  (148 kB minified) for these three imports, 35.7 kB with its lazy `m` component; (a) adds no
  JavaScript. **Chosen: (a).** `motion` bought nothing measurable and costs 36 to 51 kB, so
  nothing was installed, and decision 8's library stays unspent. Where a browser has no view
  timelines (Firefox today) the same states follow the `data-scene` attribute the camera's
  scroll listener already sets, with one short transition.
- **The long task was the map, not the word.** Both variants failed section 12's budget on one
  task of about 740ms. A CPU profile traced it to the shared map stage: the first time the
  camera dives past the county zoom, it fetched a 4 MB county outline file, handed it to the
  map, and regrouped every record into places, all in one task. Two changes cleared it. The
  front page draws every record as its own light (`clusteringEnabled: false`), which removes
  the regrouping and took long tasks over 50ms from about 85 to 2. And the county outline load
  (`geo-source-loaders.ts`) now ends its task between parsing, handing over and hatching, which
  helps every page that zooms. The finished retelling, scrolled end to end and back on a
  production build at 4x CPU, twice per profile: laptop 2 long tasks over 50ms, longest 134 and
  139ms, none over 200ms; phone profile none over 50ms.
- **Rules:** native scroll only; nothing captures the wheel; no smoothing; no loader; a pinned
  scene holds for at most one and a half screens; everything a scene shows is in the HTML
  before script runs. Reduced motion and "hold still" replace every scene with its settled
  frame.
- **Three verbs only.** *Land* (the map camera arrives at a pin; existing code), *turn* (a
  ground changes between ink and paper, or a word changes in the retelling), *open* (an exhibit
  grows into its own page, via the View Transitions API, with a plain navigation where
  unsupported).
- Duration and easing tokens are cut to the three in `brand.md`. The cinematic, chapter and
  draw tokens go with the Door.

### 7.6 Components, each challenged

| Component | Replaces | Strongest objection | Verdict |
| --------- | -------- | ------------------- | ------- |
| `Button` (primary, secondary, quiet; two sizes) | `.ds-button` four variants, `.ds-cta` family, studio and room buttons | Admin has its own needs | Accepted with controls: admin moves to the same three in a later pass; public pages first. One primary per view |
| `ExhibitFrame` | `.ds-plate`, Polaroid cards on home, photo tiles, `DataChartFrame`, map embeds | A frame around everything becomes wallpaper | Accepted with controls: rows and thumbnails use the compact frame (marks only, no label); the full frame appears once per screen at most on phones |
| `Receipt` | Record claim rows, source lists, figure feet | Students skip fine print | Accepted: the grade is words and a glyph at body size, the source is a link, and it sits directly under the claim |
| `Cite` | The one-format citation in `lib/citation/format.ts` (extended, not replaced) | Wrong citations are worse than none | Needs validation: formats tested against 12 real records of each kind, reviewed by the owner before it ships |
| `Segmented` | List/Timeline toggle, theme toggle shape, Portrait/Plain/Numbers | None material | Accepted |
| `Chip` and `FilterBar` | Six dropdown buttons on Records, Explore filters, room chips | Filter state can't travel between views | Accepted: one filter model in the URL (decision 7) |
| `YearScrubber` | Explore decade dock, home time rail, `/law` rail, Lives timeline control | One control for four jobs gets vague | Accepted with controls: one component, two modes (range select, position readout); keyboard arrows move by decade |
| `ChapterRail` | Story progress bar, Data's side nav, tour dots | Rails eat width on tablets | Accepted: a rail at 64rem and wider, a single progress line with the chapter name under the bar below that |
| `Figure` | Each hand-built chart's wrapper | See 9.5 | Accepted with controls |
| `Sheet` | Record inspector, phone sheets, dialogs over the map | None material | Accepted; the only place a shadow exists |
| `ContentNote` (the kit's `Notice`, `note` tone) | Scattered disclaimers (`packages/domain/src/disclaimers.ts` supplies the text) | A warning before every hard fact is condescending to college readers and teaches younger ones to click through | Accepted with controls: one inline note at the top of a page or section, never a gate, never a blur, dismissed state is not stored |
| `Term` | Nothing (new) | Glossary definitions are historical claims | Needs validation: definitions go through the same review as record copy; ship with a short reviewed list or not at all |
| `Nav` | Header, phone tab bar | Four items hide the lenses and method pages | Accepted: Archive, Stories, Data, Memorial, search; lenses live in the Archive; method pages in the footer and in every receipt |

Removed outright: `DisplayNumeral` as a hero, `.ds-band`, `.ds-float`, room kit, atmosphere
mosaic, edition atmosphere, the Door and its 24 files.

## 8. Anchor pages and routes

Eight anchors. Everything else is a redirect or an arrangement of these.

| Anchor | Route | Ground | Leads with | Absorbs |
| ------ | ----- | ------ | ---------- | ------- |
| Front | `/` | Ink, then paper | The retelling, then contents | Home film, collections index |
| Archive | `/archive` with `?view=map\|list\|timeline` | Ink map beside a paper column | Places | `/explore`, `/records`, `/search`, `/collections`, and as lenses `/law`, `/books`, `/presidents`, inventions |
| Record | `/place/[slug]`, `/entity/[id]`, `/law/[slug]`, `/books/[slug]`, `/invention/[slug]` | Paper | One exhibit and its claims | Five page designs become one anatomy |
| Story | `/stories`, `/stories/[slug]`, `/presidents/[slug]` | Paper, one copper turn | Documents | Stories index, chapters |
| Data | `/data`, `/data/[figure]`, `/lives` and its children | Paper | Figures | Data, Lives, Lives explorer |
| Memorial | `/memorial` | Follows the theme: paper by default, ink in dark (owner, 2026-11-23). Quiet | Names | Unchanged in substance |
| Method | `/about`, `/methodology`, `/sources`, `/errata`, `/faq`, corrections, legal | Paper | Text | One document layout for all |
| System | `/design-system`, 404, error | Paper | The kit | Generated |

Redirects are permanent and keep query state: `/explore` to `/archive?view=map`, `/records` to
`/archive?view=list`, `/search?q=` to `/archive?view=list&q=`, `/law` to `/archive?lens=law`, and
so on. Lens index URLs (`/law`, `/books`) may instead stay as thin aliases that render the
Archive with the lens set; phase 4 decides after checking search traffic, because those two
were just signed off and have inbound links.

## 9. Each anchor, built and challenged

Every anchor lists what it is, its phone variant, the strongest objection, the alternative not
taken, and a verdict.

### 9.1 Record

**Is:** label line, name in display type, a summary, then two columns: claims as numbered
statements each with its receipt, beside the lead exhibit (photograph or document) and a map
exhibit on ink. Below: related records as compact rows, any figure whose data covers this
place (9.5), the corrections link. Cite and print work on the whole page and on each claim.
**Phone:** exhibit, name, summary, claims, map, related, in that order.
**Objection:** 74 percent of records have no photograph, so most pages lead with a map of a
dot, and the anatomy looks broken on the majority. **Alternative:** lead with the document or
source excerpt when there is no photograph, and with the map only when there is neither.
**Verdict:** accepted with controls. The lead exhibit falls back photograph, then source
document image, then map; the layout is designed for the no-photograph case first and tested on
ten records of each case.

### 9.2 Archive

**Is:** one page, one filter model, three views. Map: the flat ink map with the paper list
beside it (today's Explore, kept). List: full-width rows with thumbnails. Timeline: the decade
histogram as a figure with rows under the selected range. A lens (`law`, `books`, `presidents`,
`inventions`) sets filters and swaps in its signature exhibit above the list: the law time
rail, the books state tile map. Search is the same page with a query. The URL holds view,
filters, lens, query, sort, page and the selected record or place. It never holds the map
camera or anything derived from the device's location: a shared link must not reveal where a
student was standing, and Explore already keeps the viewport out of the address for that
reason. A shared link reopens the selected place, which frames the map by its own rule.
Every view says how many of the filtered records it can show and why the rest are absent
("312 of 480 have a point on the map", "41 have no date"), so a record missing from the map
reads as unmapped, not deleted, and the mapped set is never mistaken for the whole.
**Phone:** list first with a Map button that takes the full screen; the filter bar collapses to
one row; the record opens as a sheet.
**Objection:** this is the largest change in the plan, to the part that works best. Explore was
rebuilt two days ago and Codex found it sound. Merging three routes risks state bugs, SEO loss
on `/records`, and a lowest-common-denominator page. **Alternative:** keep three routes and make
them share the filter bar and URL model only. **Verdict:** accepted with controls. The map view
is today's Explore with its chrome swapped for kit parts, not a rewrite; the merge is the URL
model and the view switch. Phase 4a ships the shared filter model, the membership counts and
the kit chrome behind the three existing routes, with a written parameter and SEO contract
(canonicals, crawl exclusions, pagination, sort stability) carried over from Records and
Explore: [`archive-url-contract.md`](./archive-url-contract.md), which 4b is tested against. Phase 4b collapses the routes with temporary redirects, watches production search
and traffic, and makes them permanent only after that. If 4b hurts, 4a is the finished
alternative and is already running.

### 9.3 Story

**Is:** a paper reading column at 38rem with exhibits breaking the measure: documents and
photographs in full frames, figures from Data embedded live, map exhibits that land on the
place a paragraph names. A chapter rail shows position. One copper turn per story, at the point
the author marks. Paragraph anchors allow citing a passage. The index is covers for stories
whose cover is safe (v12's open blocker: a data flag on the story, not a code comment) and text
rows for the rest.
**Phone:** one column; exhibits full width; the rail becomes a line.
**Objection:** stories are written by Neo, an AI persona, and the byline says "By Neo". College
readers will challenge authorship before they read a word. **Alternative:** none in design; it
is a disclosure question. **Verdict:** needs validation. The plan adds an authorship line to the
story header that links to how stories are written and checked; the wording is the owner's.
A second control from review: a published story pins each embedded figure to the data version
it was written against and says so in the figure's receipt, with a link to the current figure,
so a cited passage and the chart beside it do not drift apart. Paragraph identifiers are stored
with the story, not derived from position.

### 9.4 Memorial

**Is:** unchanged. The wall, its fading names, its press behavior and its accessible list stay
exactly as built. The page follows the reader's theme as it always has, so it opens on paper by default
since phase 1 and on ink in dark (owner decision 2026-11-23). It picks up the kit's color
tokens and type roles where the values are already equal, and nothing else. No exhibit frame, no crop marks, no figure numbers, no
cite popover on a name (a name is not a source); the page itself is citable from its footer,
and the print view is the accessible list with its provenance line.
**Objection:** touching a protected surface for consistency is how it gets damaged, and a
content note stacked above the wall breaks P-01's "quiet opening composition".
**Verdict:** accepted with controls. No content note on the opening; the note sits on the
links that lead to the memorial and above the names list below the wall. Every change is
checked against `PROTECTED-EXPERIENCES.md` P-01 line by line with before and after captures,
last among the web phases. If a token swap changes a painted pixel on the wall, it is reverted.

### 9.5 Data

**Is:** figures in the Du Bois lineage. Each figure has an id (`D-02`), a headline that states
the finding, a serif paragraph, and three views behind one switch: **Portrait** (the Du Bois
form), **Plain** (a conventional chart), **Numbers** (the table, downloadable as CSV). Forms
taken from the 1900 Paris Exposition plates: the bar that runs and coils for one long series,
stacked proportional fields, the fan, the folded bar for an outlier, and small-multiple state
tiles. Fills are ink, copper and sand with an ink outline and halftone; values are labeled on
the mark. The lineage is credited on the page and in Method.
**Referenceable elsewhere:** figures live in a registry (`id`, data loader, three renderers).
`<Figure id="D-02" />` embeds in a story; a record page shows any figure whose data covers its
county or state; the Archive's timeline is itself a figure. `/data/[figure]` is a figure's own
citable page.
**Phone:** Plain is the default below 40rem where a Portrait cannot label its values legibly;
Portrait is one tap away.
**Objection, the strongest in the plan:** a spiral encodes length along a curve, which people
read worse than a straight bar. A beautiful chart that students misread is a failure for an
evidence-first archive, and a period style on Black history can read as costume (v12 said the
same of sepia). The Codex comp shows the problem: its spiral is decorative and its values do not
match its geometry. **Alternative:** newsroom scrollytelling with standard charts.
**Verdict:** accepted with controls. (a) Every Portrait is generated from the data by code,
with a test written for its own encoding: length for the coiled and folded bars, angle for the
fan, area for stacked fields. A form whose encoding cannot be tested is not built. (b) Every
value in a Portrait is printed on the mark, as Du Bois did. (c) **Plain is the default view
everywhere until the read test passes**; Portrait is one tap away and leads only on figures
where five students read it as accurately as the Plain. Plain and Numbers are always the print
and phone default. (d) No aging, no paper stains, no period lettering; the forms are borrowed,
the finish is new. (e) Missing data is drawn as a gap with the word "no data", never as zero; a
change of definition or denominator (the 2000 "Black alone" change) is marked on the figure in
all three views. (f) A figure embedded on a record page is labeled with its real scope
("Statewide context: Indiana"), never implied to describe the place itself.

### 9.6 Method

**Is:** one document layout: title, a contents list, text at reading measure, tables as tables.
The count numeral heroes go. `/sources` and `/errata` are lists built from `Receipt` rows.
The existing semantic sections of each page are kept.
**Objection:** a tidy text layout can pass review while a reader still cannot get from a claim
to its source. **Verdict:** accepted with controls. Method's gate is a task, not a look: starting
from one claim on a record, a reader reaches the source, its capture and any dispute, and the
definition of the grade, in three clicks or fewer. This is the proving page for phase 2 because
it is small and real.

### 9.7 Front and the retelling

**Is:** six scenes on ink, one per word, each at most a screen and a half of scroll, with a
chapter rail naming all six and "Skip to the archive" on screen throughout.

| Scene | Word | Shows | Ground action |
| ----- | ---- | ----- | ------------- |
| 1 | History | The word and one sentence. No document by default (see the verdict) | Map dark |
| 2 | *His* story | One sourced record of a man | Camera lands on his place |
| 3 | *Her* story | One sourced record of a woman | Traverse, land |
| 4 | *Your* story | A field: "Type a town." It answers with the nearest records and the distance, or says plainly that nothing near there is researched yet | Traverse to the town |
| 5 | *Their* story | A place many people made: a church, a school, a district | Traverse, land |
| 6 | BlackStory | The wordmark, "History, pinned to place.", every light on, then the contents: Archive, Stories, Data, Memorial with one true line each, and search | Rise to the country; ground turns to paper below |

The word changes with the *turn* verb: the italic prefix swaps while "story" holds still, and
the final step closes the gap and hands off to the official wordmark artwork. The existing
`hero-headline-morph.ts` supplies the phase model and timing; it renders the last word as text
in the display face, so the artwork handoff is new work. Without JavaScript and under reduced motion the page is
six stacked sections with the same content, and the heading reads "BlackStory".
**Phone:** each scene is word, exhibit, slip in one column; the map is the ground behind the
word only; scene 4's field is the phone's first input.
**Objection:** (a) the catalog has no gender field, so scenes 2 and 3 are editorial picks, and
"records of women the official history left in the margins" (the comp's line) is an authored
historical claim the site has no source for. (b) Reducing a person to the example of a pronoun
is a dignity risk. (c) The owner called a five-word change "a slot machine" on 11-15 and
restored it on 11-16; six scenes may be too long for a front door, and a returning student
wants the archive, not the film. (d) Scene 4 asks for a location from minors.
**Alternative:** the wordmark sequence as a short timed title over a contents page, with the
six scenes living at `/story` as the About page's opening.
**Verdict:** accepted with controls. (a) and (b): scenes 2, 3 and 5 each show one
record from a reviewed list, well evidenced, photographed, not harm-adjacent and not a living
person. The pick is fixed per release, not rotated daily, so the opening is the same for a
whole class and can be cited. Scene copy states only what the word means, never a claim about
history, and goes through `story.md` review. The traverse between scenes says only distance
and direction; no scene implies its record is connected to the last (v12's open finding).
Scene 1 does not open on the apportionment clause by default: a document that counts people as
fractions is a dehumanizing first image for a twelve-year-old. Scene 1 is the word and one
sentence on the dark map; the choice of any document there is the owner's and gets a content
review. (c): a returning visitor (a first-party flag in
local storage, no tracking) lands on scene 6 with "Watch the opening" as a link; total scroll
is capped at eight screens; the read test in section 12 times it. (d): the field takes typed
text only and calls the existing place search; "Use my location" is a separate explicit button
that reuses the existing client-only locate flow. Neither the typed town nor a device position
enters the URL, local storage or analytics, and the phase's gate includes reading the network
log and the server's request logging to confirm it. (e) The retelling is built as a component
and first shipped at `/story` and as the Front's opening behind a flag. The read test compares
it with a Front that opens directly on scene 6. It becomes the entrance, and the app's
onboarding, only if students complete or skip it without losing their way to the archive.
Otherwise it stays at `/story`, linked from the Front.

## 10. Who will try to break it

| Reader | What they do | What the design must do |
| ------ | ------------ | ----------------------- |
| Middle school, phone or Chromebook | Scrolls fast, taps everything, searches their own town and misspells it, hits Back, screenshots | No loader or gate; every scene skippable; search tolerates misspelling and says plainly when a place has nothing yet; Back restores view and scroll; a screenshot of any exhibit includes its label and credit |
| Middle school, sensitive material | Lands on lynching records from a search | Content note at the top of the result set and the record; quiet exhibit variant; nothing harm-adjacent on the front page |
| High school, assignment | Needs a citation and a link that still works next week; prints; asks "is this true?" and "why is my county empty?" | Cite on every exhibit and claim; URLs hold state; print stylesheet; grade in words beside every claim; the coverage sentence wherever the map is dark |
| High school, skeptic | Finds a Wikipedia-sourced record; compares two pages for contradictions | Source is named on the receipt, not hidden; "thinly evidenced" is said in words; the corrections link is on every record |
| College | Wants the table, the denominator, the definition change in 2000, the license, the method; checks the axis starts at zero; wants CSV; asks who wrote the story | Numbers view and CSV on every figure; limits listed with the figure; plain chart available; licenses on receipts; authorship line on stories; Method reachable from every receipt |
| Teacher | Projects it in a lit room; shares one link with 30 students; needs it to load on a locked-down Chromebook | Paper default; share-exact-view; no WebGL requirement to read anything; no third-party script beyond what ships today |
| Anyone trying to break it | 200 percent zoom, 320px width, keyboard only, JavaScript off, slow 3G, resize mid-scene, 50 filter chips, a 90-character place name, a record with no photograph, no date and no place | Each is a named test in section 12 |

## 11. Mobile app

The app stays four tabs and becomes Archive, Stories, Data, More. It uses the same grounds
(map tab on ink, everything else on paper), the same exhibit frame with crop marks, receipts
and cite (through the share sheet), and the same three motion verbs through the platform's own
transitions. Phase 1 makes `apps/mobile/scripts/generate-brand-tokens.ts` read the kit's token
modules, so color, type scale, radius (0, 8, full), durations and easing match the web by
construction, and removes the hard-coded radii. App screens are rebuilt after each web anchor is
signed off, with the web's phone variant as the spec, and checked with
`pnpm mobile:ios:verify`. The retelling ships in the app as first-run onboarding (six swipeable
scenes) and is reachable later from More.

## 12. Acceptance gates

Every anchor passes all of these before sign-off. "Checked" means run and observed.

| Gate | Measure |
| ---- | ------- |
| Shapes | Nine windows from 375 by 667 to 2560 by 1440, including 768 by 1024 and a tall mid-width; no sideways overflow; primary action on screen |
| Data cases | Ten real records per case: with and without photograph, date, exact place; longest names; harm-adjacent |
| No JavaScript, reduced motion, no WebGL | All content present in order; map absent by design |
| Keyboard and zoom | Full task by keyboard; 200 percent zoom; 320px width; resize mid-scene |
| Assistive technology and touch | The anchor's main task with VoiceOver on macOS and iOS; touch on a real phone or the simulator; the app with the system's largest text size |
| Slow network | Throttled slow 3G: content readable before images and map arrive; no layout jump when they do |
| Privacy | Network log and URL checked: no device location, typed town or camera in any address, storage key or analytics call |
| Search engines | Canonical, robots and sitemap output diffed against the contract for the routes the anchor touches; redirect chains tested |
| Contrast | AA on painted pixels, both themes; existing contrast tests extended to the paper-first pairs |
| Print | One page printed to PDF per anchor: credits and sources present, figures static |
| Citation | Cite output checked against 12 records per kind |
| Performance | Production build, phone profile at 4x CPU: LCP under 2.5s, INP under 200ms, no long task over 200ms during the retelling; JavaScript added by the motion library reported |
| Read test | Five students across middle school, high school and college (the owner recruits; the phase lead writes the script and records results): find a record near a named town, cite it, trace one claim to its source, read one figure's value in Portrait and in Plain, say what the front page is for. Pass criteria are written before the test |
| Code | Web tests, typecheck, lint, token lint with a lower baseline than the phase started with, `scripts/ci-local.sh` on Node 22 before any staging to main PR |
| Deletion | A file is deleted in the phase that removes its last caller, proven by a search for importers. CSS and component line counts are reported for `apps/web/src` and `packages/ui` together, so cost moved into the kit is counted |

## 13. Phases

Each phase is one bounded session led by Opus, with cheaper subagents for mechanical work.
Subagents that edit files follow `CLAUDE.md`: one worktree each, `git reset --hard` to the
working tip first, no git writes, diff reviewed by the lead. Work lands on a new branch
`redesign/v13-exhibit` cut from the current tip. Nothing is pushed until the owner says so.

| Phase | Scope | Lead / helpers | Done when |
| ----- | ----- | -------------- | --------- |
| 0. Canon (done 2026-11-23) | This file became `docs/ui/DESIGN.md`. v4 to v12 and living-archive moved to `archive/`; `docs/ui/README.md` rewritten as a one-screen index; `brand.md`, `/about` copy, `apps/web/PRODUCT.md`, `AGENTS.md` and `apps/site/README.md` amended. Left in place on purpose: `docs/redesign/` (marked as history), `design-direction-v6-mobile.md` (the app's shell until phase 9), and pattern docs whose code is still live (they move with that code) | Opus | One binding design doc; relative links no worse than before (20 broken before, 19 after, none new) |
| 1. Tokens (done 2026-11-23) | Done: 31 unused tokens and the four alias type tokens removed with their users; the always-night map palette set to brand swatches (Black Ink, Copper Pin, copper-on-dark, Archive Paper), which removes the blue rim and blue-black; the six fixed ink tokens moved from `base.css` into `tokens.css`; mobile spacing, radius and motion read from the kit's modules; light is the default theme; token lint baseline 523 to 517. Deferred to the phase that removes the last caller: the 14px and 28px radius steps (phases 3 to 8), the four home textures (phase 7), the `--ds-world-*` names themselves (4b). Ground tokens for the exhibit system are added in 2a with their first user. The memorial opens on paper for readers with no stored theme; the owner chose to let it follow the theme (section 9.4) | Opus | Kit 101, web 2,832, mobile 186 tests pass; site app sees no new failures; no production build was run |
| 2a. Kit core (done 2026-11-23) | Done: `ExhibitFrame`, `Receipt` and `Cite` in `packages/ui` with tests; MLA, APA and Chicago formats added to `lib/citation/format.ts` beside the house format; print rules for exhibits and receipts; chips are fully round; the unused `compact` button variant is deleted; the three are on the staff gallery page. Already in the kit and left as they are: `Button` (already three variants at 8px), `Segmented`, `Chip`, `Sheet`. A content note is `Notice` with the `note` tone, not a new component. Not done: a second button size (nothing uses one); forcing paper when a dark-theme reader prints, and hiding the site chrome in print (2b, with the shell); the motion spike (moved to 6a, the first phase with a scroll scene to measure, so no dependency is installed before it has a user) | Opus | Kit 109 tests, citation 14 tests pass; components rendered from the real CSS in both themes at 1440, 390 and 320 wide with no sideways overflow. The gallery page is staff-gated and was not opened in a browser |
| 2b. Method (done 2026-11-23) | Done: the frame the method, utility and data pages share (`TrustFrame`, 25 pages) is one paper document: no night mast, no horizon glow, no band art, no color bands, no section numerals; a count is a sentence under the title. The header and phone tab bar follow the page instead of holding night there; only `/law` and `/books` still stand on night. Print is always paper (the theme bootstrap turns a dark page light for the print and back) and drops navigation, tab bar, map controls and contents list. Not done: `/design-system` is still hand-written, with the kit's new components added by hand in 2a; generating it waits until more of the kit exists (phase 8). `/sources` and `/errata` keep their table and dated list, which already read as lists; `Receipt` rows arrive with the record page in phase 3. `.ds-band`, `.ds-cta` and the room kit still have callers on Data, Lives, records and stories and go with them. The trace task cannot be run until phase 3 puts receipts on records | Opus | Ten method pages at nine window shapes in light and two in dark: no sideways overflow, no page errors. Print checked on a dark page. Web 2,839 and kit 110 tests pass |
| 3a. Record shell (done 2026-11-23) | Done on the page all five record routes share (`RecordPage`): the sheet is square paper with no bands or shadow; the facts card is a ruled list instead of a gradient card on a fixed ink ground; the record file is ruled off instead of a sand block; the contour band art is gone; a record's photograph outside the plate is an `ExhibitFrame` labeled "date not on record" with its credit as the receipt. Year numerals stay (a year is allowed display type) | Opus | Six real records (a church, a Green Book listing, a person, a law, a book, an invention) at nine window shapes in light and two in dark: no sideways overflow, no page errors. Web tests pass |
| 3b. Record evidence (done 2026-11-23, not signed off) | Done on the shared record page. **Layout:** one square paper sheet; the side column (the record at a glance, the actions, the lead exhibit, the map exhibit) starts beside the name on a desktop, so the exhibits stand beside the claims; phone and tablet read exhibit, name, summary, facts, the first beat, map, the rest. **Map:** the full-bleed ground is gone from place and entity records; the map is `ExhibitFrame kind="map" ground="ink"` holding the existing `RecordMap`, labeled with its precision in words, and a county or state record is framed as its whole outline. **Lead:** the photograph, else the map. No record carries a source document image (the catalog has one image field and no kind on it), so that step of the fallback has nothing to show yet. **Claims:** `EvidenceList` renders each claim as a numbered statement with its own `Receipt` (source link, publisher, grade as glyph and words, linked to its definition in Method); an entity's claims are now its first beat. A disputed value prints both values, each with its own source, and says so when an alternate has none on file. **Addresses:** a claim's anchor is its stored claim id (it already names the record); images and maps are `#{recordId}-photograph` and `#{recordId}-map`. No figure numbers are printed. **Cite:** one control in the page's actions on all five routes (MLA, APA, Chicago, canonical URL, access date injected by the server and refreshed to the reader's day). **Carried findings:** a law is drawn at its jurisdiction (a state's law as its state outline, any other law no sharper than its city) and loses "Open in maps"; a quiet record gets the quiet exhibit variant and a still map (no fade, no zoom or pan), and a record titled a massacre or plantation is now quiet even when its topics do not say so. **Retired looks removed:** the copper tab and 01 counters on section headings, the sunken gradient well around the claims, the display-size claim numerals, the plate, the backdrop blur on the meta pills. **Deferred:** `Cite` on each claim (the owner has not reviewed the three citation formats; section 7.6 gates it); the source-document lead (needs a data field); persistent ids for a law's or book's source list (still `source-N`, they are sources, not claims); a book's cover is not yet an exhibit; a document scan stored as a record's image is still labeled a photograph; `ground-frame.ts` (the camera rule the Door and the home film still call) and `RecordImage`'s `plate` branch (the Door) go with those callers in 4b and 7; Explore still draws a law as a site dot (4a). | Opus | Run on live data, light theme unless said: 121 real pages at 1440 by 900 and 390 by 844 (10 each with a photograph, without one, undated, a law, an invention, harm-adjacent and the longest names up to 110 characters; 15 at city, county, campus, neighborhood or state precision; 4 with no public point; 12 `/law` and 10 `/books` pages) and 11 records at nine window shapes plus 320 and a 200 percent zoom, with 390 and 1440 in dark: no sideways overflow, no page errors, name and actions on the first screen, every claim with one receipt, no duplicate ids. Reduced motion on 4 records. **JavaScript off:** all five record routes now read without script, in order, with receipts, the Cite control and the place in words where the map would be, and a missing record answers a real 404 (it answered 200 before). This took deleting the five record `loading.tsx` files and moving the `/law` and `/books` index pages into `(index)` route groups, because an index's `loading.tsx` also wrapped its record pages; the cost is no instant skeleton when navigating to a record. The index pages themselves still need script. Keyboard: every control reached with a visible ring, a citation copied. Print to PDF: credits and source addresses present, a dark page prints on paper. Web tests (2,842; 2,834 pass, 8 skipped as before), typecheck, lint, format and token lint pass; token baseline unchanged at 516. `record-page.css` 1,671 to 1,201 lines; `apps/web/src` CSS 31,581 to 31,099; kit unchanged. Ground and plate code deleted from the record page. **Not checked:** a disputed claim on a real record (none is published; covered by a unit test only); a screen reader; a real phone; slow network; a production build's web vitals; contrast on painted pixels; the read test and the Method trace task with readers (by link count a claim reaches its source and the grade's definition in one click each; no published claim carries an archived capture). **Found, not fixed:** `/entity/gap_1994_reparations_bill_florida` redirects to a `/place/` address that returns "Place not found" on the dev server |
| 4a. Archive model (done 2026-11-23, not signed off) | Behind `/explore` and `/records`; no public URL changed. **Contract:** [`archive-url-contract.md`](./archive-url-contract.md), written first from the code and the dev server's own output: every parameter, which are shared, sort stability, pagination, canonicals, robots, redirects, sitemap, and the lens pages' own keys. **Model:** the shared filter model is the list's `RecordsQuery`. Explore's parser now reads every shared field through the list's parser, so the two views accept, lowercase and drop the same values; one pair of functions (`recordsQueryFromExplore`, `exploreViewFromRecordsQuery`) is the only translation, and the list's hand-off and the record page's return links go through it (two hand-written copies deleted). The list now carries the record and the place selected on the map as return context (`selected`, `place`): they never filter the list, never enter its canonical, and make the page `noindex, nofollow`. An unknown `kind` used to match nothing on the list and silently everything on the map; it now matches nothing on both and shows as a removable chip. **Membership:** one sentence in body type in every view (`membershipSentence`): how many of the filtered records have a point on the map, how many are in the list only, how many have no recorded decade (under Undated on the timeline, or left out of a decade range). On Explore this sentence had been written and then hidden by a stray `display: none`. **Counts are sentences:** the Records page's giant copper count numeral is gone, and Explore's count is body type. **Cross-view links:** a Map, List, Timeline switch of plain anchors on both routes, over the list and over an open record on Explore; the list's "Show these on the map" link is replaced by it. **Chrome:** Explore's column, decade dock and map controls are square solid sheets with the float shadow (glass, backdrop blur and the 14px and 28px radii removed); the Records list sheet is square with no bands and no shadow. Both routes already used the kit's `FilterButton`, `Chip` and `Segmented`. **Carried findings:** the place field is a real combobox (arrow keys move a highlight the field points at, Enter chooses, Escape closes, focus stays in the field). The far zoom-out did not reproduce at 2560 or 3440 wide: one world, no repeat. **Deferred:** the kit's `FilterBar` (a form with an Apply button) does not fit either route without losing one-click filtering with counts, and `RecordsToolbar` is shared with the signed-off `/law` and `/books`, so the Records menus and Explore's three quick selects (`.ds-pill-select`) stay until 4b; the lens pages keep their own parameter names (contract section 7); the list does not narrow to a place selected on the map, and says so; `page` and the shuffle seed do not survive a visit to the map; Explore still draws a law as a site dot and place lines still truncate (section 17); the `/archive` route, redirects and Timeline-as-figure are 4b. **Room kit not deleted:** 58 files still import it, among them the method pages' frame, `/law`, `/books`, Data, Lives, Stories, Collections, the memorial, `record-page.css` and Records itself (`Room`). The Door is untouched. | Opus alone; the `verify` agent this row planned was not run | Run on live data: nine filter sets (a misspelled query, a decade range, a state plus a kind, an empty result, topic with evidence and sort, an era bucket with a status, an exact kind with an open range, a place, a selected record) through map, list, map, Back, Back, Forward, Forward and reload, with the address and the membership sentence equal at every step. Canonical, robots, redirect and sitemap output for 39 URLs plus `robots.txt`, fetched before and after: identical. 52 captures: four pages at ten window shapes from 375 by 667 to 2560 by 1440 (with 768 by 1024 and 1024 by 1366) in light, 390 and 1440 in dark, and 320 wide: no sideways overflow, no page errors of the page's own (four captures drew the dev server's rate limit). Keyboard: the place field's arrows, wrap, Enter and Escape; Tab from the field through the three selects, the view links and the list, each with a visible ring; a Records filter opened and chosen with Enter. Privacy: with a fake device position granted and the locate control pressed, no address, list link, storage key or any of 1,234 requests carried a coordinate or a camera key. Web tests 2,860 (2,852 pass, 8 skipped as before, 18 new for the shared model and the sentence), typecheck, lint on the changed files and format pass; token baseline 516 to 515; `apps/web/src` CSS 31,099 to 31,015 lines, kit unchanged at 3,403. **JavaScript off:** `/explore` and `/records` show only their loading shapes, as before this phase and as the owner's 3b decision left the index pages; the rows and the view links are in the HTML. **Not checked:** a screen reader; touch or a real phone; 200 percent zoom; slow network; print; contrast on painted pixels; a production build's web vitals; the read test; a typed place staying out of the address (read in code only); changing a native select by keyboard in the headless browser. **Found, not fixed:** a misspelled query ("churhc") returns nothing on either view, and section 10 asks for tolerance; `apps/site`'s edge port of the list parser had to gain `selected` and `place` to keep the parity test |
| 4b. Archive routes | View switch at `/archive`, lenses, temporary redirects, production observation, then permanent. Delete the Door and `atlas.css` | Opus / Sonnet | Redirect chains tested; search and traffic checked after one release; rollback is reverting the redirects |
| 5. Story (done 2026-11-23, not signed off) | Done on `/stories`, `/stories/[slug]`, `/presidents`, `/presidents/[slug]`; presentation only, no story prose and no data changed. **Page:** one paper ground with no sheet, stripes, shadow or rounded corner; prose on `--ds-content-max`, exhibits on the wide track. **Exhibits:** every story image is an `ExhibitFrame` shown whole and in its own color, with its credit and rights as the `Receipt` (the duotone plate on covers, portraits and thumbnails is gone); a primary-document excerpt is a document exhibit dated by its artifact; a map moment is a map exhibit on ink labeled with its precision, still and quiet for a massacre or plantation site; an image whose own words name a massacre, plantation or lynching is quiet. A story image stores no kind, date or sensitivity, so `story-exhibit.ts` reads them from its alt text and credit and says no more than they do: "date in the credit" or "date not on record", and a painting gets the compact frame with no kind printed instead of being called a photograph (all 45 president portraits checked: 36 photographs, 9 paintings). **Addresses:** the image file's name, the artifact's stored id, the entity id; never position, no figure numbers. **Position:** the existing section list is the chapter rail from 64rem (it was 80rem); below that the shell's progress line is the gauge and a bar under it names the section, with the contents list as a popover. No second progress code. **Cite:** the record page's control in the header strip, dated by the page's last revision. **Authorship:** the byline keeps "By Neo" and gains a link to `/about#neo`; the wording is open (section 15). **Index:** chapters are ruled entries, the cover a compact exhibit only when `lib/stories/cover-safety.ts` lists the story as safe; that hides the Tulsa postcard that covers "The Gap That Never Closed" on `/stories`, on the home page and in other stories' read-next block, and any future story until it is listed. The same reader gates row thumbnails; the presidents collection is listed as a whole. **Retired looks removed:** copper bands with count numerals for a chapter's figures (now a ruled list at body size), sand bands for documents, the copper end band, the drawn streetscape under the dek, the lead cover's shadowed panel and edge-to-edge crop, the count numeral on the list head, display-size source numbers, the copper bar on pull quotes. Year numerals stay. No story marks a copper turn, so none is drawn. **No script:** the two story `loading.tsx` files are deleted and the two index pages moved into `(index)` route groups, as on records, so a story reads without JavaScript and a missing one answers 404; the cost is no skeleton when navigating to a story. **Deferred:** paragraph anchors (story blocks store no ids; position must not supply one, section 9.3); the copper turn (no field marks one); figure embeds and version pinning (phase 6c; the seam is the `figure` case in `StoryBody.tsx`); `Cite` on each exhibit (owner review of the three formats, 7.6); the kit `ChapterRail` (6a replaces `StorySpine`); a row thumbnail is still a cropped head, not a framed exhibit; the home page and the old Explore front still print a cover's credit when the cover is hidden (phases 7 and 4b). Data fields this needs, none written: `kind`, `date`, `dateBasis` and `sensitivity` on a story image, `frontSafe` on the cover, an `id` on each body block, a turn marker on a block | Opus | Run on live data from the worktree's own server: the three published stories, three presidents and both indexes at nine window shapes from 375 by 667 to 2560 by 1440 (768 by 1024 and 1024 by 1366 among them) plus 320 wide, light, and 390 and 1440 in dark: 96 renders, no sideways overflow, no page errors, no duplicate ids. JavaScript off on three stories and one president: title, every section, paragraph, exhibit with its receipt, the sources and Cite, in order. Reduced motion: same content and order. Keyboard: header strip, Cite (opened, MLA copied) and the rail (a section reached and marked current) each with a visible ring; at 768 the contents popover opens, holds focus and returns it. Print to PDF of one story from a dark-theme reader: paper, credits, 29 source addresses. Web tests (2,846; 2,838 pass, 8 skipped as before), typecheck, lint, format; token baseline 516 to 515. `story.css` 1,481 to 1,242 lines, `stories.css` 762 to 465; `apps/web/src` CSS 31,099 to 30,563; kit unchanged. **Not checked:** a screen reader; a real phone or touch; slow network; a production build's web vitals; contrast on painted pixels; 200 percent zoom; the read test; `table`, `video`, `list`, `dispute` blocks standing alone and an image with no stored size (no published story has one outside a packet, they are covered by unit tests only); `/lives` and the admin preview, which reuse `StoryBody` and inherit the new look; the index pages without script (they still need it) |
| 6a. Figures (done 2026-11-23, not signed off; read test not run) | On `/data`; no dataset, value, source or database touched. **Read test first:** [`read-test-figures.md`](./read-test-figures.md) was written before the figures: the questions for each figure in Portrait and in Plain, what counts as correct, and five pass criteria. It has not been run (it needs five students, section 15). **Registry:** `components/data/figures/registry.tsx`: a figure is an id, a headline built from its rows, a loader, sources, limits, a definition-change sentence, one column list (the Numbers table and the CSV are both built from it) and its Plain and Portrait drawings. **`Figure`:** the finding as the heading, the view switch (`Segmented` as three links), the drawing in `ExhibitFrame kind="figure"` with the figure id as its address (`/data#D-01`), then the receipt: each source, Cite, and the limits in full, always visible. The view is one `view` URL parameter for the page (`?view=portrait#D-01`); Plain is the default and carries no parameter. **D-01**, Black share of the U.S. population by census, 1790 to 2020: Portrait is one bar that runs and then coils, each census a stretch whose length is its share; Plain is the existing share line (now with the peak, the low and the latest named on it); Numbers has the counts, the share and the census category. **D-02**, free and enslaved shares of the Black population, 1790 to 1860: chosen because the two parts make a whole by definition, all eight censuses have both, every part is large enough to print its value, and the series ends by definition instead of trailing into missing years; Portrait is eight equal columns divided by area, Plain is a 100 percent stacked bar built from the chart kit. Both Portraits are drawn twice (a narrow and a wide drawing, chosen by a container query) so a phone does not shrink the labels; every value is printed on its mark; fills are ink, copper and sand with an ink outline, and the ink field turns with the theme. In D-01 the fill has a meaning (sand: the share fell from the census before; copper: it rose; ink: no comparable census before it). The 2000 change to “Black alone” is a break in the bar, a labeled band in Plain, the category column in Numbers, and one sentence under the drawing in all three. A missing value is a dashed gap that says “no data” in both Portraits and a broken line in Plain (unit tests only; the live series has none). The Du Bois lineage is credited under each Portrait. **Encoding tests** (`figures.test.tsx`, on the geometry and again on the rendered SVG): coiled bar, drawn length over value is one constant within 0.5 percent; stacked fields, area over count is one constant per column within 0.5 percent and every column is one area; a gap has its own fixed length and no fill. **Replaced and deleted:** the share spine and the share line became D-01 (`PopulationDecadeSpine.tsx`, the share chart's frame, `shareRiseReading`, the display-size share numeral, the line chart's unused area fill and small size). The share line's own finding (“the share rose at 8 of the 9 censuses since 1930”) is no longer printed. `app/data/loading.tsx` is deleted so the page reads without script, as on records and stories; the cost is no skeleton on the way to `/data`. The figure count on `/data` stays sixteen. **Kit:** one rule keeps the Cite control's outline inside a receipt. **Not built, with reasons:** `YearScrubber` (neither figure scrubs: every value is on the mark, so it would have no honest caller); `ChapterRail` (the Data contents list is two levels with no narrow form, the story rail is one level with a progress bar and a popover; a kit rail made from the Data list alone would be a second variant the story could not adopt, and moving `StorySpine` changes the unsigned Story anchor, so both wait for 6b and `DataContents` and `StorySpine` stay); the motion spike (no figure in this phase moves or is scroll-linked, nothing was installed, the spike moves to phase 7 with the first scroll scene). **Deferred:** halftone fills (not legible under 11px labels); the lineage credit in Method; the other fourteen figures, which still use `DataChartFrame` and `FigureFoot`; a per-figure view parameter (one `view` switches every figure on the page); sources that share a publisher name collapse to the first link, as on the older figures; the copper and sand section bands and the count numerals still on `/data` (6b) | Opus alone | Run on live data: `/data` in each of the three views at nine window shapes from 375 by 667 to 2560 by 1440 (768 by 1024 and 1024 by 1366 among them) plus 320 wide in light, and 390 and 1440 in dark: 36 loads, no sideways overflow, no page errors, nothing outside its figure, every Portrait label inside its mark. Smallest rendered label: Portrait 10.9px at 375 wide (9px at 320), Plain 11px (axis ticks), Numbers 13px. Painted geometry read back from the browser: D-01 length over value 6.9993 to 7.0007 (narrow) and 7.9992 to 8.0007 (wide) across 24 stretches; D-02 area over count agrees within 0.02 percent in every column. JavaScript off: both figures, their findings, limits and switch links in all three views (nothing was visible before the loading file was removed). Keyboard: the three view links, the table region (it scrolls by arrow key at 375), Download CSV, the sources and Cite, each with a visible ring; Enter on Numbers changes the address and keeps the scroll position. Reduced motion: same text in each view. Print to PDF from a dark-theme reader on the Portrait view: Plain on paper, source addresses and limits printed, switch hidden. CSV for both figures parsed and compared cell by cell to the table: no difference. Each Portrait screenshot read against its Plain: same peak, low, latest value and break (D-01), same shares and order (D-02). Web tests 2,873 (2,865 pass, 8 skipped as before), kit 110, typecheck, lint, format; token baseline unchanged at 514. **CSS rose:** `apps/web/src` 30,498 to 30,728 lines, kit 3,403 to 3,408. The new figure sheet is 234 lines and what it replaces (the old figure foot and frame) is still used by fourteen figures until 6b. **Not checked:** the read test; a screen reader; a real phone or touch; 200 percent zoom; slow network; a production build's web vitals; contrast on painted pixels; a missing value or a figure with no Portrait on live data; a printed Numbers table wider than the page. **Lead's judgment:** D-02's Portrait reads as well as its Plain or better, since it prints every share. D-01's Portrait is weaker than its Plain: the fall and rise that the line shows at a glance has to be read from 24 printed numbers and the fill colors, labels on the left of the coil run sideways, and the bar's whole length means nothing though it looks like a total. It should not lead unless the read test says otherwise |
| 6b. Data pages (done 2026-11-23, not signed off; read test not run) | On `/data`, `/data/[figure]`, `/lives`, `/lives/explorer`, `/lives/[region]` and one sentence on Method; no dataset, value, source or database touched. **Registry:** all sixteen `/data` figures are registry figures, `D-01` to `D-16` in page order (`components/data/figures`: `figure-spec.ts` is what a figure is, `census.tsx` and `indicators.tsx` hold the specs, `registry.tsx` the map by id, `FigureBody.tsx` the one anatomy, `Figure.tsx` the by-id loader). Each keeps its existing finding sentence as its heading, its existing caption as its limits, its existing chart as Plain (the chart components lost their frame and were not redrawn), and gains a Numbers table and CSV from one column list. A missing value says “no data” in Numbers; the old tables said N/A. The fourteen old anchors (`#wealth-gap`, `#justice-imprisonment`, which a published Lives beat links to) still land on their figures. **The finding 6a dropped is not restored:** “the share rose at 8 of the 9 censuses since 1930” counts the 1990 to 2000 step as a rise, and that step crosses the change to “Black alone” that D-01 itself says is not comparable. A version that stopped at 1990 would be a new published sentence, which is the owner's to write. **Portraits, figure by figure:** D-03 count by census, none (24 values across a 54-fold range read well as columns; a coil would repeat D-01's weakness). D-04 recent change, none (three values). D-05 state gains and losses, none: the figure holds the sixteen largest movers, not every state, so state tiles would show thirty-six empty tiles that read as no change. D-06 and D-14 ratios, D-07, D-13 and D-15 pairs, none (two values; a bar already is the Du Bois form). D-08 net worth, D-10 and D-11 Cook County, D-12 homeownership, D-16 sentences, none (two series across periods; no fan or field fits a comparison over time). **D-09 wealth ratio since 1860, built:** one series whose first value (56.3) is more than twice the next and nine times the latest, so the plain line presses everything after 1900 into the bottom fifth of the plot. The Portrait is folded bars: one bar a measured year from a common edge, length the ratio, every value printed at the bar's end and its year at the start, the 1860 bar turning back twice at full length, sand fill with an ink outline, two drawings (narrow and wide). It is built only for a single series. The Lives figures get none (a class band can be three percent wide, too small to print its value on). **Encoding test for D-09** (`figures.test.tsx`, on the geometry and on the rendered SVG): length along each bar, turns included, over value is one constant within 0.5 percent; every bar starts at the one left edge; only a bar longer than the run turns; no run leaves the plot; bars never share a row; a missing year is a dashed gap of fixed length that says “no data”. **View per figure:** done with plain links and no script. One `view` parameter lists figures by id (`?view=D-01:portrait,D-09:numbers`); each switch link changes its own figure and keeps the rest; a bare `?view=numbers` (6a's form) still sets every figure not named; Plain everywhere carries no parameter. **`/data/[figure]`:** one figure on its own page: finding, views, sources, limits, Cite, a link back to its place on `/data`; canonical and metadata through the same builder as the static pages; listed in the sitemap only when it has rows; `d-09` resolves to `D-09` with the canonical on the upper-case address; an unknown id is a real 404 with `noindex`. Cite on every figure now gives the figure's own page. **Retired looks removed from `/data`:** the copper and sand section bands and their band art (the page is one paper sheet with the contents list beside all four sections), the display numeral above nine findings, the ratio and the census-change values set in display type (now body type), the two-up half-width pairs. **Deleted with their last callers (searched for importers):** `DataChartFrame`, `FigureFoot` and their styles; `HateCrimeCompositionChart`, `HateCrimeYearSeriesChart`, `OpportunityAtlasCoverageChart` and `StatePopulationShift` (no page imported them, only tests); `LivesClassSharesTable`, `LivesConditionsTable`, `LivesCellValue`; `app/lives/loading.tsx`. **Lives:** the appendix's three charts are figures `L-01` (middle class band by decade), `L-02` (class bands, one decade) and `L-03` (conditions, one decade) on the same anatomy, Plain and Numbers with CSV. They are built from the figure spec but are not in the by-id registry and have no `/data/[figure]` page, because each depends on area, decade and emphasized group; their address is the appendix URL with the id as anchor. L-01's table gained a column naming what was measured each decade, so the change of measure is marked in Numbers as the chart's rule marks it. The milestone reader, the era strip, the scrubber and the dignity rules are untouched (`lives-dignity.test.ts` passes unchanged). Lives carried no bands, glass, rounded sheets or count numerals to remove: its display type is names, titles and decades, and its count is already a sentence under the title. With the loading file gone, `/lives` and the appendix read without script, a region address answers a real 308 and an unknown region a real 404 (an unknown region answered 200 before). The appendix's no-script fallback used to show the default decade whatever the address said; it now shows the decade and group the address asks for, so its decade links and view links work without script. **`ChapterRail`: not built.** The Data list is two levels, marks the figure nearest a band of the viewport, has no narrow form and carries the as-of dates; the story rail is one level, splits a year from a title, marks sections already read by scroll position, and below 64rem becomes a bar with a focus-trapped popover. One component would be both behind a mode flag, which is two components in one file. `DataContents` and `StorySpine` stay. **Method:** one sentence under the Data link in “Lives across the decades” credits the Portrait forms to Du Bois's data portraits for the 1900 Paris Exposition. **Deferred:** Lives figures by id and on their own pages; the selected row is no longer highlighted in a Lives table, and a missing Lives cell prints its reason in the cell instead of linking to the count note; a Lives CSV writes the raw estimate without its margin; halftone fills; sources that share a publisher still collapse to the first link; `DataStatStrip` has no page caller and was left because it never used the old frame; figures in stories and records (6c) | Opus alone | Run on live data: twelve addresses (`/data` in Plain, Portrait and Numbers; `/data/D-09` in its three views; `/data/D-05` in two; `/lives`; the appendix in Plain and Numbers; `/lives/deep-south?decade=1970`) at nine window shapes from 375 by 667 to 2560 by 1440 (768 by 1024, 1024 by 1366 and 820 by 1400 among them) in light, 390 and 1440 in dark, and 320 wide: 144 loads, no sideways overflow, no page errors, no duplicate ids, nothing outside its figure at the nine shapes. Smallest rendered label per figure at 375 wide: Plain 11px on D-01, D-02, D-03, D-05, D-08 to D-12, D-16, L-01 and L-02 (axis ticks and bar values) and 13px on D-04, D-06, D-07, D-13 to D-15 and L-03; Numbers 13px on all nineteen; Portrait 11.0px D-01, 10.9px D-02, 12.5px D-09 (9.1, 9.0 and 10.3 at 320). JavaScript off: `/data` with a mixed `view`, two figure pages, `/lives`, the appendix at a chosen decade and group, a region redirect: every figure, finding, limits, source and switch link present. Reduced motion: same text on three pages. Keyboard on a figure page at 375 wide: the view links, Enter on Numbers, the table region (it scrolls by arrow key), Download CSV, each with a visible ring. Print to PDF from a dark-theme reader on the Portrait view, `/data` (17 pages) and `/data/D-09`: paper, Plain printed, switch hidden, limits on all sixteen, source addresses printed. CSV for D-05, D-09 and D-12 parsed and compared cell by cell to the table: no difference; L-03's CSV holds the unrounded estimates behind the table's rounded cells. D-09's Portrait read against its Plain: same high, low, latest value and order. Web tests 2,872 (2,864 pass, 8 skipped as before), kit 110, typecheck, lint on the changed folders, format; token baseline 514 to 513. `data-page.css` 350 to 293 lines, `data-charts.css` 1,198 to 1,047, `lives.css` 1,800 to 1,715, `figure.css` 234 to 239; `apps/web/src` CSS 30,728 to 30,440; kit unchanged at 3,408. **Not checked:** the read test; a screen reader; a real phone or touch; 200 percent zoom; slow network; a production build or its web vitals (the appendix's fallback was seen only in the dev server's streamed HTML); contrast on painted pixels; a missing value on live data (unit tests only); search-engine output beyond the figure page's canonical, robots and sitemap entries; the Lives milestone reader beyond load, overflow and no-script text; changing the appendix's decade select by keyboard. **Found, not fixed:** at 320 wide D-05's largest value (“+573,399”) runs 11px past its figure's edge (the chart was not redrawn; whether it did so before this phase was not measured); a figure page prints its title alone on the first sheet and the figure on the second; a wrong test in this phase briefly broke the print rules and was caught only by reading the PDF, so print is worth a unit test. **Lead's judgment:** D-09's Portrait is at least as readable as its Plain and better for values: every year's ratio can be read and the years since 1950 can be told apart, which the line cannot do under a 60-fold axis, and the fall is still visible as bars shortening down the page. It loses the true distance between years, which the line keeps, and says so in its key. Its labels are straight and 12.5px on a phone, which D-01's are not. It is the only figure of the fourteen where a Du Bois form does a job the plain chart does badly |
| 6c. Embeds | Figures in stories and on record pages with scope labels. Record and Story are re-run through section 12 because their signed-off pages change | Opus / Sonnet | Both anchors re-signed |
| 7. Front (done 2026-11-23, not signed off; read test not run; entrance not decided) | **Where:** the retelling and the new front page are `apps/web/src/app/front/`. They render at `/story`, and at `/` only with `?opening=1`. The default at `/` is still the v12 home page, so nothing a reader sees today changed. `/story` is `noindex` and is not in the destination catalog, the footer or the sitemap while it is on trial. **The retelling:** six real sections with real headings (History, His story, Her story, Your story, Their story, BlackStory) under one `h1` that reads "BlackStory". Two layouts of the same HTML. *Pinned* (a window at least 64rem wide and 40rem tall, script on, motion allowed): each section holds for a quarter to four tenths of a screen and crosses in one, 7.85 screens in all; one persistent word sits over the map and its italic copper prefix changes while "tory" does not move (an invisible sizer holds the widest word's width; the space and the "s" open from a zero-width grid track, so no letter's width is written down); the last scene closes the gap, takes its capital, and fades as the official lockup artwork arrives by native scroll in the same place. *Stacked* (a phone, a narrow or short window, 200 percent zoom, no script, reduced motion, "Hold still"): each section is its heading in a window onto the map, then the record's name, its exhibit and its slip on ink. The rail names all six with the current one marked, and "Skip to the archive" is beside it, sticky under the header in both layouts. Scenes 2, 3 and 5 show one record: its photograph in `ExhibitFrame` in its own color with its credit, its name as the link to the record, its place and precision in words, and one claim with its source and grade in words on a paper slip. The camera is the tour's own dive and traverse (`door-tour-scrub.ts`), driven by a small pure scene model (`retelling-scenes.ts`). Between scenes one line says where the camera is going: "Down to Tallahassee, Florida", "About 960 miles northeast to Auburn, New York", "Up to the whole country". Scene 1 is the word and one sentence on the dimmed map, with no document. Scene 6 is the lockup, "History, pinned to place.", one sentence with the record count in it and what a dark place means, then the contents on paper. **Scene 4:** Explore's own `PlaceControl` on a paper slip, with "Use my location" as a separate button (`useLocateMe`). The answer is worked out in the browser from the pins already on the page: the three nearest records with distances, or "Nothing within 50 miles of (town) is researched yet" and the nearest one. The camera goes to the town at a regional zoom. **Privacy change in shared code:** the existing place search sent the typed text as `GET /locate/api?address=`, so a typed town was in a request address and in access logs. `/locate/api` now also accepts a POST body and the browser client uses it, on Explore as well. **Contents:** Archive (map and list), Stories, Data, Memorial, each with the destination catalog's own line and a link, plus search; no count as display type; the only image is the lead story's cover, shown only when `frontSafeCover` lists it. Routes come from the catalog through `front-routes.ts`. **Returning reader:** at `/?opening=1` only, a browser that has reached scene 6 or pressed skip (`ds-front-seen`, a local flag with no value) lands on scene 6 with "Watch the opening". **Picks and copy, all provisional:** the picks are a typed config of three record ids (`retelling-picks.ts`), re-checked against the live record on every render; the shortlist of 11, 10 and 12 candidates is [`v13/retelling-picks.md`](./v13/retelling-picks.md). The scene sentences and two alternatives each are [`v13/retelling-copy.md`](./v13/retelling-copy.md); Neo and the prose review have not read them. **Spike:** section 7.5; no library installed. **Read test:** [`v13/read-test-front.md`](./v13/read-test-front.md), written, not run. **Not done:** the scene captions are not `Cite`-able (7.6 gate); a claim cannot be pinned by id, so the page shows the claim the code ranks first; no person record can be used (see section 15); the kit `ChapterRail` is still not built (the rail here is local to the page); no satellite imagery on a landing (the home film had it; dropped for the performance budget); `apps/site`'s edge port does not know `opening=1`, which is correct for it because it has no such page; the app's onboarding. **Deleted:** nothing, because the home page is still the default. **Deletable when the owner flips the default:** `app/home/home-page.tsx`, `home-film.tsx` and `home.css` (1,155 lines); `public/home/grain.webp`, `ember-haze.webp` and `deckle.webp` with their three manifest entries (`home.css` is their last caller; `dust` is already gone; `paper.webp` and `halftone.webp` are also called only by `home.css` and stay as the two materials); the `opening` branch in `app/page.tsx` and its allowlist entry in `query-normalization.ts`; the `.ds-home` rule in `edition-atmosphere.css`; the home cases in `shell-layout.test.ts` and `leftover-stack.test.ts`. `home-journey.ts` and its test stay and move into `front/` (the retelling uses `legText`, `shortPlace` and `isJourneyEligible`). `door-tour-scrub.ts`, `door-decade-walk.ts`, `door-field-frame.ts`, `door-record-link.tsx` and `ground-frame.ts` are also still called from `front/` and must move there before 4b deletes the Door | Opus alone; Neo and the prose review this row planned were not run | Run from the worktree's own server on live data. **Shapes:** `/story` and `/?opening=1`, every scene landed, at eleven windows (320 by 568, 375 by 667, 390 by 844, 430 by 932, 768 by 1024, 1024 by 768, 1024 by 1366, 1280 by 720, 1440 by 900, 1920 by 1080, 2560 by 1440): no sideways overflow, the skip link on screen in every scene, the record link on screen and uncovered in scenes 2, 3 and 5, the word on screen, the rail marking the right scene, no target under 44px, no duplicate ids, no page errors, contents linking all five routes. Length 7.85 screens pinned; stacked 5.35 to 7.98 (the longest at 320 by 568, after the stacked layout was tightened from 8.78). **No script:** h1, the six headings, sentences, travel lines, record links, photographs, claims and contents in order at 1440 and 390; the town field is disabled with a note, because a bare form would have submitted the typed town into the address. **Reduced motion:** same content and order, stacked, the camera cutting to the scene in view. **No WebGL:** ground is ink, the pinned layout and the word change are unchanged, one status line says the map could not start. **Keyboard:** 31 stops from the rail through the record links, sources, the town field, its button and the contents, each with a visible ring and on screen when focused; Enter on a rail word goes to its scene. **200 percent zoom:** no overflow, skip and record links on screen. **Hold still:** pressed and released without a reload. **Resize mid-scene** across the 64rem line and back: no overflow, the right scene kept. **Returning reader:** lands on scene 6 with the link; `/story` always starts at scene 1. **Privacy:** with a fake position granted, a town typed and "Use my location" pressed: neither the town nor the position in any request address, the page address, any storage key or value, any cookie or any console line; the only stored key is `ds-front-seen`; the typed town is in one POST body to `/locate/api` and in no line of the server log; the one analytics line carries a kind and a time. After either, the map asks its tile host for tiles around that place at a regional zoom, as any map does. **Performance:** section 7.5. **Code:** web tests 2,903 (2,895 pass, 8 skipped as before; 31 new for the scene model, the picks, the copy rules, the nearest-record answer, the flag and the lookup), kit 110, typecheck, lint on the changed files, format; token baseline unchanged at 514. **CSS rose:** `apps/web/src` 30,728 to 31,644 lines, kit unchanged at 3,408. `front.css` is 916 lines and the 1,155 it replaces cannot go until the default flips; the net is then minus 239. **Captures:** every scene and the contents at 1440 and 390 in [`v13/retelling/`](./v13/retelling). **Not checked:** the read test; a screen reader; a real phone or touch; slow network; LCP and INP (only long tasks and script bytes were measured; the page transfers 554 kB of script on a production build); contrast on painted pixels; print; the canonical, robots and sitemap output beyond `/story` reading `noindex, follow` with its own canonical and `/?opening=2` redirecting to `/`; Firefox or Safari (the fallback for browsers without view timelines was read in code, not run); the scenes with a pick that fails its rules (unit test only); the dark theme (the opening and the paper contents were captured in light only). **Lead's judgment:** pinned, it is the right length to watch once and one scene too long to meet twice; the weak point is scene 4, which asks a reader to stop and type in the middle of a film, and Their story after it repeats the shape of scenes 2 and 3. On a phone it is a long page of three similar cards, and the word change, which is the point, is only six headings scrolling by. The returning-reader landing is what makes it tolerable as a front door. With every record its own light the country at scene 6 is heavier than the home page's grouped dots |
| 8. Memorial and sweep | Section 9.4; 404 and error; admin moved to `Button` so `.ds-cta` can go; delete every stylesheet with no importer; token baseline to zero or a named remainder | Opus / Haiku | Totals reported against 31,716; no retired file remains |
| 9. App | Per-anchor screens after each web sign-off (can start after phase 3) | Opus / Sonnet | `pnpm mobile:ios:verify`; simulator screenshots at two sizes |

Phases 3a, 3b and 5 can run in parallel after 2b; 4a and 6a after 3b; 6c waits for 5 and 6b; phase 7
waits for 4b, 5 and 6b. A phase is a dependency-bounded slice, and a slice that will not fit one
session is split before it starts, not during.

## 14. What is not in this plan

Admin screens; `apps/site`; new stories or records (the retelling uses existing ones); a public
API; accounts; teacher tools beyond share-exact-view; translation. A dark-theme-first variant
is not designed; dark is derived.

## 15. Open, for the owner

1. The authorship line for stories written by Neo (9.3). Phase 5 left "By Neo" as it was and
   added a link to `/about#neo`; the sentence itself is still the owner's to choose.
2. Whether `/law` and `/books` stay as alias URLs (section 8).
3. Who the five read-test readers are (section 12). The figures' script is ready and waiting on
   them: [`read-test-figures.md`](./read-test-figures.md). Plain stays every figure's default until it
   is run.
4. Whether pushes to `staging` are open during this work.
5. The three citation formats (MLA, APA, Chicago) on the record page's Cite control. MLA prints
   the URL with its scheme; with no revision date APA prints "n.d.". `Cite` goes on each claim
   only after this review (7.6, phase 3b).
6. Sign-off on the Record anchor (rule 6). Phase 3b's row lists what was run and what was not:
   no screen reader, real phone, slow network, production build or reader test yet.
7. Whether a record's image needs a kind (photograph or document). Without one, a document scan
   is labeled a photograph and the source-document step of the lead exhibit has nothing to show.
8. Sign-off on the Story anchor (rule 6), and three things phase 5 decided in code that are the
   owner's: which covers are safe on a front page (`lib/stories/cover-safety.ts` lists "The
   Count", "Buying a Home" and the presidents); the label "date in the credit" for an image whose
   credit states a date the data does not; and whether story images, covers and body blocks get
   the fields named in the phase 5 row.
9. From phase 6a: whether D-01's coiled bar stays at all if the read test finds it misread.
   Phase 6b gave each figure its own view. The share line's dropped finding stays dropped unless
   the owner writes one that stops before the 2000 change of definition (6b row).
10. From phase 6b: sign-off on the Data anchor (rule 6); whether the Lives appendix figures
    (`L-01` to `L-03`) should get addresses of their own, which needs the area and decade in the
    address; and whether the Method sentence crediting Du Bois reads as the owner wants it.

10. From phase 7, the front page. (a) The three records: all provisional, from
    [`v13/retelling-picks.md`](./v13/retelling-picks.md). (b) No person record can be shown in
    His story or Her story, because none of the 497 carries a recorded death and the archive
    treats unknown as living; every candidate is a house or site about a named person, and its
    photograph is of the building. Setting `livingStatus` in review is the way to a portrait.
    (c) The scene sentences ([`v13/retelling-copy.md`](./v13/retelling-copy.md)), which Neo and
    the prose review have not read. (d) Whether `/story` should be indexed and listed before the
    read test. (e) Whether the typed-town lookup moving to a POST body is acceptable on Explore
    too (it is live there with this phase). (f) Whether a device position may move the camera at
    all, since the map then asks its tile host for that region. (g) The entrance itself, which
    waits on [`v13/read-test-front.md`](./v13/read-test-front.md). To compare the two fronts on
    any deployment, open `/` and `/?opening=1`.

## 16. Adversarial review

Codex (read-only, 2026-11-23) read the first draft and the code. Verdict: **needs validation**.
Its factual corrections were spot-checked against the files it cited and hold.

| # | Finding | Severity | Disposition |
| - | ------- | -------- | ----------- |
| 1 | Citation formatting already exists; mobile derives from the brand pack, not its own hex list; the existing morph ends in text, not wordmark artwork | Major | Accepted. Sections 6, 7.3, 7.6 and 9.7 corrected |
| 2 | Record: a document image can read as proof of every claim; subject date and citation date get confused; one grade hides disputes; per-release figure numbers break next semester's citation | Major | Accepted. Section 7.3: persistent identifiers, separate dates, one receipt per claim, disputes shown |
| 3 | Archive: a record missing from the map reads as deleted; the mapped set reads as the whole | Major | Accepted. Membership counts in every view (9.2) |
| 4 | The merge is a migration: Records has canonicals, crawl rules and pagination; Explore keeps the camera out of the URL on purpose; permanent redirects weaken rollback | Major | Accepted. Phase 4 split into 4a and 4b, contract first, temporary redirects, production observation |
| 5 | Story: live figure embeds drift from the passage that cites them | Major | Accepted. Figures pinned to a data version; stored paragraph identifiers (9.3) |
| 6 | Memorial: "no motion" and a stacked content note conflict with the protected fading wall and quiet opening | Blocker | Accepted. The wall is exempt from the exhibit system; no note on the opening (7.3, 9.4) |
| 7 | Data: length tests do not cover fans or stacked fields; missing data, denominators and statewide-versus-local scope are unaddressed | Major | Accepted. Encoding-specific tests, Plain as default until the read test passes, gap and scope labels (9.5) |
| 8 | Method: a text layout is not evidence that a claim can be traced | Major | Accepted. The gate is a trace task (9.6) |
| 9 | Front: the apportionment clause is a dehumanizing opening; daily rotation is not a stable narrative; traversals imply relationships; six scenes repeat the choreography section 4 says failed | Major | Accepted in part. Scene 1 changed, picks fixed per release, no implied connection, and the retelling ships at `/story` and behind a flag, becoming the entrance only if the read test supports it. Not accepted: dropping scroll scenes, which is the owner's decision 4 |
| 10 | Sharing camera state can disclose a minor's location; typed input is not proof of non-retention | Major | Accepted. Camera and device location never enter a URL; a privacy gate reads the network and logs (9.2, 9.7, 12) |
| 11 | Phase 2 deleted styles that Records and admin still use; phases 4 and 6 were under-scoped; CSS reduction can hide cost moved into the kit | Major | Accepted. Delete with the last caller; phases split; totals counted across web and kit; embeds re-run sign-off |
| 12 | Gates missed screen readers, touch, text scaling, privacy, SEO, slow network and resize; "five students" had become two | Major | Accepted. Section 12 extended |
| Alt | Consolidate inside the existing routes: shared citations, tokens and controls first; validate Record, Method and plain charts with readers before changing navigation; keep the retelling optional | | Adopted as the order of work (4a before 4b, Plain before Portrait, `/story` before `/`). Not adopted as the end state: the owner chose one Archive, the Du Bois language and the scroll scenes, and each now has a test that can stop it |

**Where this leaves the direction:** accepted with controls by this document, needs validation
by Codex. Three of the owner's choices (the route merge, Portrait as the lead view, the
retelling as the entrance) are now staged so that the cheaper version ships first and a reader
test decides whether the bolder one replaces it.

## 17. Carried from earlier directions

Open findings from v11 and v12 that this system inherits. Each is owned by the phase named.

| Finding | Source | Phase |
| ------- | ------ | ----- |
| A story cover's safety for the front page is a code comment, not a data check | v12 section 12 row 1 | Narrowed in 5: a typed list every surface reads, hidden unless listed. Still not a data field; closes when the cover carries `frontSafe` |
| No story's places are published records, so no journey can follow one story | v12 section 12 row 3 | Content work; outside this plan, limits 9.7 |
| A statewide law grounds as an exact site; a harm record gets the standard grounded frame and ring | v11 section 21, v12 section 14 | Closed on the record page in 3b. Explore still draws a law as a site dot: 4b (not done in 4a) |
| Explore's place field is a combobox in name only (arrow keys) | v11 section 16, v12 section 15 | Closed in 4a |
| Explore place lines truncate; records without a photograph are 63 percent of the catalog (2,759 of 4,403 on 2026-11-23; it was 74) | v12 section 15 | 4b (not done in 4a). The record page leads with the map for them since 3b |
| A far zoom-out on a very wide window may repeat the flat map sideways | v12 section 15 | Did not reproduce in 4a at 2560 or 3440 wide. The map does zoom out to the whole world there |
| v11's reader test of "darkness is not absence" was never run | v11 section 14 | Folded into the read test, section 12 |
| Never checked on any direction: a real phone, a screen reader, a production build's web vitals | v12 section 13 | Section 12 gates, every anchor |
