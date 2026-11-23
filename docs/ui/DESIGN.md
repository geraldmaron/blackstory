# BlackStory design system: The Exhibit (v13)

**Status:** binding (owner go-ahead 2026-11-23, phase 0 landed the same day). This is the one
design system. Phases 0, 1, 2a, 2b, 3a and 3b are done (3b is not signed off); every later phase
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

- **Library:** `motion` (the Framer Motion successor), chosen over GSAP because it is React-first
  and drives scroll-linked animation through the browser's own scroll timeline where one exists.
  Unverified in this session: its current version, bundle cost and its behavior under Next 16
  and React 19. Phase 6a opens with a half-day spike that measures it on the first scroll-linked
  figure at 4x CPU throttle; if it fails the budget in section 12, GSAP ScrollTrigger is the
  fallback and the spike says so in writing.
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
Explore. Phase 4b collapses the routes with temporary redirects, watches production search
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
| 4a. Archive model | Shared filter and URL model, membership counts and kit chrome behind `/explore`, `/records` and the lens pages. Parameter and SEO contract written first | Opus / Sonnet; one `verify` agent on URL-state correctness | State survives every view change and Back; canonicals and crawl rules unchanged; room kit deleted with its last caller |
| 4b. Archive routes | View switch at `/archive`, lenses, temporary redirects, production observation, then permanent. Delete the Door and `atlas.css` | Opus / Sonnet | Redirect chains tested; search and traffic checked after one release; rollback is reverting the redirects |
| 5. Story | Section 9.3; cover-safety flag in data; figure version pinning; authorship line | Opus / Neo for any copy; Sonnet | Gates pass on all stories |
| 6a. Figures | Motion spike (section 7.5), on the first scroll-linked figure. Registry, `Figure`, `YearScrubber`, `ChapterRail`; D-01 and D-02 in three views with encoding tests; read test | Opus / Sonnet | Read-test result recorded; default view decided from it |
| 6b. Data pages | Remaining figures, `/data/[figure]`, Lives folded in | Opus / Sonnet per figure | Gates pass |
| 6c. Embeds | Figures in stories and on record pages with scope labels. Record and Story are re-run through section 12 because their signed-off pages change | Opus / Sonnet | Both anchors re-signed |
| 7. Front | The retelling as a component at `/story` and behind a flag on `/`; contents; reviewed record list; read test against a direct-to-contents Front | Opus / Sonnet; Neo and prose review for scene copy | Gates pass including performance and privacy; entrance decided from the read test; `app/home/` film replaced |
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

1. The authorship line for stories written by Neo (9.3).
2. Whether `/law` and `/books` stay as alias URLs (section 8).
3. Who the five read-test readers are (section 12).
4. Whether pushes to `staging` are open during this work.
5. The three citation formats (MLA, APA, Chicago) on the record page's Cite control. MLA prints
   the URL with its scheme; with no revision date APA prints "n.d.". `Cite` goes on each claim
   only after this review (7.6, phase 3b).
6. Sign-off on the Record anchor (rule 6). Phase 3b's row lists what was run and what was not:
   no screen reader, real phone, slow network, production build or reader test yet.
7. Whether a record's image needs a kind (photograph or document). Without one, a document scan
   is labeled a photograph and the source-document step of the lead exhibit has nothing to show.

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
| A story cover's safety for the front page is a code comment, not a data check | v12 section 12 row 1 | 5 |
| No story's places are published records, so no journey can follow one story | v12 section 12 row 3 | Content work; outside this plan, limits 9.7 |
| A statewide law grounds as an exact site; a harm record gets the standard grounded frame and ring | v11 section 21, v12 section 14 | Closed on the record page in 3b. Explore still draws a law as a site dot: 4a |
| Explore's place field is a combobox in name only (arrow keys) | v11 section 16, v12 section 15 | 4a |
| Explore place lines truncate; records without a photograph are 63 percent of the catalog (2,759 of 4,403 on 2026-11-23; it was 74) | v12 section 15 | 4a. The record page leads with the map for them since 3b |
| A far zoom-out on a very wide window may repeat the flat map sideways | v12 section 15 | 4a |
| v11's reader test of "darkness is not absence" was never run | v11 section 14 | Folded into the read test, section 12 |
| Never checked on any direction: a real phone, a screen reader, a production build's web vitals | v12 section 13 | Section 12 gates, every anchor |
