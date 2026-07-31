# BlackStory design direction v9: surfaces

**Status:** proposed (2026-07-30). Binding once owner-approved and this line is changed to `binding`.
**Source mockup:** [`.design-mocks/blackstory-atlas-v9.html`](../../.design-mocks/blackstory-atlas-v9.html), extended with a room layer, the reading rooms, the record room, the records index, the legend overlay and the single-key toggle (packages SP-01 to SP-03 below).
**Companion:** [`design-direction-v9-atlas.md`](./design-direction-v9-atlas.md). That document governs the instrument. This one governs every other public surface and the shell they share. They are read together, and neither is complete alone.
**Supersedes on approval:** `design-direction-v6-history.md` (the route dissolves), `design-direction-v6-about.md`, `design-direction-v6-books.md`, `design-direction-v6-data.md`, `design-direction-v6-law.md`, `design-direction-v6-memorial.md`, `design-direction-v6-methodology.md`, `design-direction-v6-entity.md`, and `design-direction-v6-stories.md` and `design-direction-v6-themes.md`, whose routes no longer exist in the app directory. `patterns-utility-edition.md` is folded into the Utility class in section 2.4.
**Unchanged and still binding:** [`brand.md`](./brand.md) tokens, palette, type and dignity law; [`story.md`](./story.md) voice; [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md); [`patterns-map-canvas.md`](./patterns-map-canvas.md); [`patterns-record-anatomy.md`](./patterns-record-anatomy.md); [`patterns-browse-mode.md`](./patterns-browse-mode.md); [`patterns-edition-fact-icon.md`](./patterns-edition-fact-icon.md); [`patterns-site-footer.md`](./patterns-site-footer.md); ADR-017 map handoff; WCAG AA floor.

---

## 0. What this document is

`design-direction-v9-atlas.md` scoped itself to two routes. Its closing line is explicit: "Surfaces outside `/` and `/explore` stay on their v6 documents until separately revised." That was the correct scope for a document about a camera vocabulary and a map plate, and it left forty-five public URLs undecided while the two most-visited ones changed shape underneath them.

This document is that deferred revision. It resolves every public route: 47 rows, each with a verdict, a surface class, a URL disposition, a structure and an interaction contract. It also carries the shell rework that makes the Atlas plate persist, because a persistent plate that only persists on two routes is not persistent.

It is a design document, not an implementation plan. The twenty work packages in section 8 are the sequencing; the resolution table in section 4 is the contract.

---

## 1. Why this exists, and the thesis

v9 Atlas turned `/` into an instrument. That is right, and it creates three problems the moment you look past the two routes it covered.

1. The map answers "what happened near here" well and "what is documented about X" badly. Routing both through the instrument leaves the archive with no browsable, crawlable, non-spatial index at all.
2. Story mode was specified as `?mode=story`. The site's principal narrative, the surface that explains what the product is, would have been unlinkable, uncitable and excluded from the canonical.
3. The plate paints memorial names as ambient texture. That is confined to two routes today. Hoisting the plate site wide would have spread it to every surface.

The thesis that resolves all three:

> BlackStory becomes one instrument with rooms attached to it. A single Atlas chrome (command bar, palette, collections, keyboard, toasts) and a single map plate mount once above every route and never reload, so the whole site is one continuous session. The plate has three honest postures: Live and full viewport on the Atlas and Story, Framed inside a bounded slot on record pages and map moments, and Parked and invisible everywhere else. The map is never behind body text.

Three corrections, forced by the critiques and confirmed in code, follow from it.

- **The map is a spatial index, not the index.** The archive keeps a non-spatial index at its own crawlable URL, `/records`, rather than hiding one inside the homepage and canonicalising it away.
- **Story is a document, not a query parameter.** It moves to `/story` with chapter fragments, because six chapters of authored prose are the site's most linkable asset and the surface that explains the product.
- **The plate stops painting murdered people's names as ambient texture.** That layer is deleted rather than spread from two routes to all of them.

Everything else follows: every surface can search, save, cite and share; every record links back to its place and every place back to its records; and no previously public URL 404s.

---

## 2. The five surface classes

Every public route belongs to exactly one class. The class is emitted server side as `data-surface` on the page root, and it is the single switch that every shell rule, plate posture, keyboard scope and footer decision reads. It replaces two client route gates and roughly 25 ad hoc `:has()` selectors.

| Class | `data-surface` | Routes | Map | Document scrolls | Single-key bindings |
|---|---|---|---|---|---|
| Instrument | `instrument` | 4 | Live, full viewport | No | Yes, while focus is in `main` |
| Reading room | `reading` | 11 | Parked, one Framed slot at a time | Yes | Chorded only |
| Record page | `record` | 4 | Framed | Yes | Chorded only |
| Utility | `utility` | 9 | Parked and hidden | Yes | Chorded only |
| Endpoint | none | 19 | None | Not applicable | None |

### 2.1 Instrument

The Atlas and Story. The map is the content: one full viewport live plate with opaque panels floating over it. The document does not scroll and the keyboard belongs to the surface. Two rendered routes hold this class, `/` and `/story`, and they share one plate and one chrome; `/explore` and `/locate` fold into them.

**Chrome.** Command bar, Lens, Results rail, Time, Camera console, Dock, readout, legend overlay, attribution pill, record sheet in its over-plate posture, palette, shortcut sheet, collections drawer, toasts, onboarding hint. No site header. A footer only at the end of Story's outro.

**Map behaviour.** Live. Reader driven pan and zoom, all seven camera moves subject to both the move-level dignity gate and the new composition-level gate, decade sweep, corridor arcs, spotlight. Camera padding follows open panels via `chrome-padding.ts`. Presence only in the sweep, never harm density. No memorial names are painted on the plate.

**Entry and exit.** Enter from anywhere with the `A` key, the bar's brand lockup, the palette's Go section, or any deep link. Leave by opening a record (`Enter` goes to `/entity/[id]`), by a palette destination, or through Story's outro footer. `ESC` unwinds palette, then overlay, then spotlight, then sheet, and never navigates. Single-key camera and time bindings are live only while focus is inside the instrument's `main` landmark.

### 2.2 Reading room

Long form, catalogue and index editorial on paper. One scrolling, measure limited column. The plate is never behind body text. Geography appears only as bounded, in-flow map moments the reader scrolls to. This class also carries the record index, because a browsable list of what the archive contains is editorial, not instrumentation.

**Chrome.** Command bar (slim), reading progress rule, record sheet in its in-document posture, palette, collections, toasts, site footer. No Lens, Results, Time or Camera console.

**Map behaviour.** Parked by default. One Framed slot at a time: a map moment scrolled into view borrows the persistent plate, flies to its subject at stored precision, and releases it on exit. Reduced motion cuts instead of flying. No spotlight, no orbit, no sweep, no push in.

**Entry and exit.** Enter from the palette, the footer, an Atlas record's related links, or a catalogue card. Every reading room closes with a records off ramp into the Atlas or `/records`. The `A` key opens the page's subject on the Atlas; `ESC` closes an open record sheet and returns focus to the chip that opened it.

### 2.3 Record page

One catalogued thing with a place, an era and evidence: an entity, a banned book, a law. The Atlas record sheet unfolded into a durable, crawlable, citable page. Same anatomy component as the sheet, never a fork.

**Chrome.** Command bar, framed place or jurisdiction plate, record anatomy in inline rows, trust block, sources, connections, chapters that cite this record, session prev and next, palette, collections, toasts, footer.

**Map behaviour.** Framed. The persistent plate insets into the record's place frame and flies there at stored precision, never sharper, with the coarsening stated. Gestures locked until the reader presses **Explore this place**, which hands the plate to the Atlas. Violence adjacent records get a plain `flyTo` and nothing else; person records never get spotlight.

**Entry and exit.** Enter from an Atlas row or sheet, a palette record hit, a `/records` row, a catalogue card, a chapter citation, or an external link. `J` and `K` step the result set the reader arrived with, `A` returns to the Atlas with this record selected, browser back returns to the referring surface with scroll restored. Deep anchors are URL fragments, never query params.

### 2.4 Utility

Task surfaces: forms, receipts, legal text, credits, fixtures and failure states. Short, unglamorous, no geography. They exist to be finished and left.

**Chrome.** Command bar, utility edition card stack, palette, toasts, footer. No instruments, no plate, no atmosphere beyond the shared grain.

**Map behaviour.** Parked and hidden. No camera work and no GL cost while the surface is on screen.

**Entry and exit.** Enter from the palette, the footer, a contextual call to action, or a redirect. Every utility ends with at least one named next step, never a bare confirmation. Only chorded bindings are live here by construction, so no unmodified key can fire while a reader is filling a form. The `A` key is disabled where there is no subject.

### 2.5 Endpoint

Non rendered public routes: redirects, JSON and text responses, feeds and crawler files. No chrome by definition. They are listed because the resolution map has to cover the whole public surface, and because three of the site's live defects live here.

**Chrome.** None. **Map behaviour.** None.

**Entry and exit.** Reached by the Atlas client, a crawler, a feed reader, or a stale bookmark. Human facing endpoints are linked from the surface that owns them; redirects land the reader on a working surface with their intent preserved in the query string.

---

## 3. The three plate postures

One MapLibre plate mounts once in the root layout and never unmounts. `MapStageProvider` moves out of the `(map)` route group, the group is deleted, and the provider is decoupled from `await loadMapStageBase()` so it mounts data free and no route inherits `force-dynamic`. Base data streams in from the Atlas surface. Without that decoupling every navigation still calls `map.remove()` and the persistent plate is a fiction.

The plate then has exactly three declarative postures, selected by `data-surface`.

| Posture | Where | Geometry | Gestures | Camera |
|---|---|---|---|---|
| **Live** | Instrument | Fixed, full viewport, z 0 | Reader driven | All moves, subject to both dignity gates |
| **Framed** | Record page, chapter map moment | Inset into a bounded in-flow slot, z 26 | Locked until **Explore this place** | `flyTo` at stored precision only |
| **Parked** | Reading room by default, Utility always | Not painted, no GL cost on screen | None | None |

Two laws govern them.

**Only one Framed slot may be active per viewport.** A chapter with several map moments spaces them so the plate is not thrashed, and a static seeded placeholder covers the inactive ones. A second Framed request while one is live is refused at runtime, not left to authors.

**The plate is never behind body text outside the Instrument.** This is the rule that most needs its reasoning written down, because it will be argued with.

A map behind prose is a decoration that costs a GL context, competes with the text for the reader's eye, and cannot be read as a map because the text is the thing in focus. Worse, it makes the page a claim it has not earned: a live map behind a paragraph implies the paragraph is about that view, and the camera has no way to know whether it is. The Framed posture is the honest version of the same instinct. A bounded slot the reader scrolls to says "here is the geography of this passage", flies to a subject at stored precision, states the coarsening, and hands back the scroll. A full bleed plate says nothing and asserts everything. The rule is enforced in CSS, with a test asserting no live plate can sit behind a `.prose` column, rather than being left to authors to remember.

The z-index scale is merged into one token ladder matching the canvas law, replacing the three scales that exist today: map 0, annotation 5, spotlight 6, grain 7, instruments 20, doc layer 24, framed plate 26, record sheet 40, command bar 50, overlays 90, toasts 95, skip link above all.

Two related shell defects are fixed with the postures, because they break the plate's containing block. The transform based page enter animation in `apps/web/src/app/template.tsx` sets `animation-fill-mode: both` with a transform, which leaves a permanently non-none computed transform and makes that wrapper the containing block for the fixed plate; the only thing preventing it today is a `:has()` escape hatch keyed on a marker attribute the route happens to set. It is deleted. Plate geometry, the light theme background, the MapLibre control restyling and the pointer-events contract move out of route scoped `map-surfaces.css` into the shell stylesheet.

---

## 4. The surface resolution map

Every public route, with its verdict, class and URL disposition. Verdict vocabulary:

- **becomes-atlas-mode** the route survives and becomes the instrument
- **new-surface** a public URL that does not exist today
- **redirect** the route stops rendering and resolves elsewhere, permanently
- **folds-into-instrument** the surface dissolves into the Atlas or its endpoint twin, and its URL keeps resolving
- **restyled-in-place** same URL, same job, v9 surface class
- **unchanged** no render, no change beyond what is stated

| Route | Verdict | Class | URL disposition |
|---|---|---|---|
| `/` | becomes-atlas-mode | Instrument | Preserved and promoted to the canonical Atlas URL. Allowlist generated from `parseExploreSearchParams`. `panels` is dropped from the builder; `lat`, `lng`, `zoom` are dropped by ADR-017 policy. Canonical is always bare `/`. |
| `/library` | new-surface | Reading room | New. The hub for everything that is not the map, and the second breadcrumb step for every reading and utility room. Self-canonical, sitemapped, in the footer and the palette Go section. Opened by `L`. Cards are generated from the destination registry, so a new public route cannot be missing from it. |
| `/records` | new-surface | Reading room | New. `?page=N` self-canonical with rel prev and next; filters that narrow the set stay in the canonical. Every page in the sitemap. |
| `/story` | new-surface | Instrument | New, self-canonical, sitemapped, own OG. Chapters at `/story#chapter-{id}`. `?mode=story` on `/` 308s here. |
| `/explore` | redirect | Instrument | 308 to `/` carrying the full query string. Permanent rule in `next.config.mjs`. Removed from `STATIC_PUBLIC_ROUTES`. Never 404s. |
| `/history` | folds-into-instrument | Reading room | No config rule. `app/history/page.tsx` survives as a thin server component that maps decade to era and redirects to `/records`, always. Leaves nav and the sitemap. Can never be deleted. |
| `/facts` | redirect | Endpoint | `/facts` and `/facts/:path*` repointed from `/history` straight to `/records`, one hop. |
| `/chapters` | restyled-in-place | Reading room | Unchanged. Gains an absolute canonical and a per route OG. Stays the destination for the `/articles`, `/stories`, `/themes` and `/topics` redirect families. |
| `/chapters/[slug]` | restyled-in-place | Reading room | Unchanged, keeps `generateStaticParams`. Hand rolled relative canonical replaced by the absolute convention. Every slug in the sitemap. Theme and topic catch-alls replaced by a generated alias table. |
| `/chapters/mosaic-credits` | restyled-in-place | Utility | Unchanged. `/stories/mosaic-credits` keeps its permanent redirect here. Added to the sitemap. |
| `/books` | restyled-in-place | Reading room | Unchanged. Not in the middleware matcher, so its params survive; they must be allowlisted before it is ever added. Every slug joins it in the sitemap. |
| `/books/[slug]` | restyled-in-place | Record page | Unchanged, keeps `generateStaticParams`. Gains an absolute canonical, a per book OG and a sitemap entry. |
| `/law` | restyled-in-place | Reading room | Preserved, and a live bug fix: `q`, `kind` and `topic` must be allowlisted before the restyle ships. `/legal` and `/legal/:path*` keep redirecting here with slugs. |
| `/law/[slug]` | restyled-in-place | Record page | Unchanged, keeps `generateStaticParams` and its 404 for unknown slugs. Gains an absolute canonical and a sitemap entry. |
| `/entity/[id]` | restyled-in-place | Record page | Unchanged. Keeps the absolute canonical, Article JSON-LD and explicit robots block. Stays `force-dynamic`. The `/entity/*` allowlist stays empty; deep anchors are fragments. |
| `/data` | restyled-in-place | Reading room | Unchanged. Not in the middleware matcher. Added to the sitemap. Gains an absolute canonical. |
| `/memorial` | restyled-in-place | Reading room | Unchanged, stays `force-dynamic`. Already in the sitemap. Route layout keeps the six handwriting font variables. |
| `/about` | restyled-in-place | Reading room | Unchanged. Gains an absolute canonical. Matched with an empty allowlist, which is correct because it takes no params. |
| `/methodology` | restyled-in-place | Reading room | Unchanged. `/myths` and `/myths/:path*` keep redirecting here. Gains an absolute canonical. Stays in the sitemap. |
| `/errata` | restyled-in-place | Reading room | Unchanged, and both feeds keep their URLs and content types. Gains an absolute canonical. Already in the sitemap. |
| `/corrections` | restyled-in-place | Utility | Preserved, and a live defect fix: `target` and `targetType` must be allowlisted or every "Suggest a correction" link forgets its target. Already in the sitemap. |
| `/corrections/status/[receiptCode]` | restyled-in-place | Utility | Unchanged. Stays out of the sitemap. Gains an `X-Robots-Tag: noindex` response header. Gets no robots.txt Disallow, ever. |
| `/locate` | folds-into-instrument | Instrument | 308 to `/?find=place`. `/locate/api` keeps its URL and guards. Removed from nav, the footer entry rewritten, leaves the sitemap's static list. |
| `/submit` | restyled-in-place | Utility | Unchanged; `/submit/api` unchanged. Added to the sitemap. Gains an absolute canonical. Empty allowlist is correct. |
| `/support` | restyled-in-place | Utility | Unchanged. Added to the sitemap. Gains an absolute canonical. |
| `/privacy` | restyled-in-place | Utility | Unchanged. Added to the sitemap. Gains an absolute canonical. |
| `/design-system` | restyled-in-place | Utility | Unchanged, because it is publicly linked and must not 404. Gains robots noindex with follow true. Stays out of the sitemap. No Disallow in this release. |
| `/search` | redirect | Endpoint | Config rule removed so the filesystem route runs. Emits `/records` in one hop. `q`, `kind`, `status`, `era` and `topic` map through; facet values and `offset=0` are dropped. |
| `/map` | redirect | Endpoint | 308 to `/`, promoted from today's 307 page level redirect to a permanent config rule. |
| `/_not-found` | restyled-in-place | Utility | Serves 404 for genuinely unknown paths only. Every URL in this map resolves before it. Carries noindex. |
| (root error boundary) | restyled-in-place | Utility | No URL of its own. Renders in place of whatever threw, URL preserved, so Try again re-runs the same route. |
| (entity loading state) | restyled-in-place | Record page | No URL of its own. Streams at `/entity/[id]` while the record loads. |
| `/explore/api` | unchanged | Endpoint | Unchanged. Not in the middleware matcher and must never be added: its entire contract is a query string. |
| `/history/api` | folds-into-instrument | Endpoint | Preserved as a thin alias delegating to the explore refine handler, decade mapped to era. Live defect fix: must be removed from the middleware matcher. |
| `/search/api` | unchanged | Endpoint | Unchanged. Not in the middleware matcher, and must stay out. |
| `/locate/api` | unchanged | Endpoint | Unchanged, geocoding rate limits and request integrity guard intact. Not in the matcher. |
| `/submit/api` | unchanged | Endpoint | Unchanged. Removed from the middleware matcher, where it sits today with an empty allowlist. |
| `/corrections/api` | unchanged | Endpoint | Unchanged. Not in the middleware matcher today; no change needed. |
| `/corrections/abuse/api` | unchanged | Endpoint | Unchanged. Not in the middleware matcher. |
| `/corrections/appeal/api` | unchanged | Endpoint | Unchanged. Not in the middleware matcher. |
| `/corrections/status/api` | unchanged | Endpoint | Unchanged. Not in the middleware matcher. |
| `/api/request-integrity` | unchanged | Endpoint | Unchanged. |
| `/errata/feed.json` | unchanged | Endpoint | Unchanged, including the `application/feed+json` content type. |
| `/errata/feed.xml` | unchanged | Endpoint | Unchanged, including the `application/rss+xml` content type. Note `/errata/:path*` is matched with an empty allowlist. |
| `/ai.txt` | unchanged | Endpoint | Unchanged. Generated from the single `AI_TRAINING_USER_AGENTS` list in `robots.ts` so the two files cannot drift. |
| `/.well-known/security.txt` | unchanged | Endpoint | Unchanged. RFC 9116 response with an Expires computed 365 days from request time. |
| `/robots.txt` | restyled-in-place | Endpoint | Unchanged. Host continues to come from `NEXT_PUBLIC_SITE_URL`. Gains no new Disallow in this release. |
| `/sitemap.xml` | restyled-in-place | Endpoint | Unchanged, stays `force-dynamic`, still returns an empty list when live projections are unavailable. Entry list built from the destination registry. |

### 4.1 Instrument surfaces

**`/`** is the Atlas. Full viewport plate at z 0. Command bar fixed top: brand lockup plus `ATLAS` tag, centre command trigger, Atlas and Story links, Saved with count, Shortcuts, Theme. Lens left at 300px carries Where (the state select plus the place finder `/locate` becomes, with the privacy notice inline), five kind chips with live counts, a new **Topic** group with live counts directly under Kind, the evidence floor, three layer chips plus the population layer, presence bars and Reset lens. Results rail right at 344px is a windowed listbox whose header carries an active-filter chip row showing and clearing every constraint that arrived by URL. Time panel bottom centre, Camera console bottom right, Dock, readout, attribution, legend overlay, record sheet right at z 40.

`main#main` wraps the instrument stage so Lens, Results, Time and the sheet are inside the landmark and the skip link lands on the instrument. A server rendered fallback list renders inside that same `main` and is removed from the accessibility tree with the `hidden` attribute on hydration, never with a visually-hidden class, so a screen reader is not read 100 index rows alongside a live listbox announcing the same records. It carries one always-visible link to `/records`. Story is no longer a mode of this route.

Interactions: the command trigger, `Cmd+K` and `/` open the palette over records, state jumps, Go destinations and actions; every constraint that arrives by URL and narrows the result set renders as a clearable chip with its reason string, while `selected`, `collection` and `find` do not, because they are the sheet, the drawer and a focus instruction; `J` and `K` step, `S` saves; Time supports pointer scrub, arrow stepping, `Home` and `End`, and `SPACE` to play, with playback disabled entirely under reduced motion and the play control replaced by decade stepping; camera moves refused by either dignity gate render disabled with the reason in visible text; hiding a panel moves focus to its dock chip and restoring returns focus to the panel header; the onboarding hint persists until dismissed and stays recoverable as "How the Atlas works" from the shortcut sheet header and the palette. Without JS or on map failure, the server rendered list under `main` is a real list with working filter links plus the link to `/records`.

**`/story`** mounts the already-built `apps/web/src/components/story/StoryMode.tsx` over the persistent plate: six scroll chapters, the right edge chapter rail, chapter 3's corridor honesty line always rendered, chapter 4's decade sweep, and the outro that hands off to the Atlas, Near me and the footer. Each chapter is a `section` with `id="chapter-{id}"` and an `h2`, so the six chapters are addressable, crawlable and citable inside one document. The full chapter prose is server rendered. Scroll advances chapters through an `IntersectionObserver` at 0.42 and updates the fragment as the reader passes each one. Under reduced motion the sweep does not auto-advance, corridor arcs and the spotlight paint at final state, and camera moves cut. `A` opens the Atlas with the current chapter's collection loaded.

**`/explore`** has no structure of its own: everything it renders today is what `/` becomes. The route file is deleted and its metadata folds into `/`. The redirect is tested with the full param set, not just the bare path, and the four internal surfaces still pointing at it are rewritten in the same commit.

**`/locate`** dissolves into the Lens's Where group on wide viewports and into a dedicated full-width place sheet below the Lens breakpoint. The address and ZIP field, the radius presets, the catalog typeahead and the opt-in geolocation become one component with two postures, with `LocationPrivacyNotice` rendered inline above the field at full length in both, before any permission is requested. The orphaned `ExploreAddressSearch` and `suggest-catalog-records` modules are remounted there rather than rebuilt; `LocateExperience` and the standalone page are deleted. `N` geolocates, flies, spotlights the region (never an individual), selects the nearest record and reports the distance in a toast. Geolocation is never requested on load, and a denied permission falls back to the manual field with a plain sentence, not an error state.

### 4.2 Reading rooms

**`/library`** is new, and it closes a gap this document shipped with: the mock parents every reading room, record page and utility surface upward through a hub at `/library`, and the hub appeared in no row of the resolution map and in none of the twenty work packages. Twenty screens were specified with an up-link to a room that did not exist, which is why the shipped surfaces cross-linked ad hoc to each other and to `/history`.

The decision recorded here is to ship it rather than to resolve the parent chain to `/records`. `/records` answers *which record*; `/library` answers *which room*. Collapsing them puts eleven editorial rooms behind a paged list of four thousand rows, and makes the breadcrumb on `/methodology` read as though methodology were a kind of record.

Header, then a prose paragraph stating that every room is built on the same records and that uncertainty is stated in the room rather than in a footnote. Then three card groups: **Read** (Chapters, Law, Data, Banned books, Memorial), **Check the archive** (Methodology, Errata, About), **Take part** (Submit a lead, Request a correction, Support). Each card carries a mono kind tag, a title, one line, and a mono footer naming its surface class and any modifier. The class in that footer is read from `surface-classes.ts` rather than stored beside the card, so a reclassified route cannot go on advertising the old class. The off-ramp is "Or go straight to the record", with `Open the Atlas` and `Read the index instead`; the mock's third control opens the command palette, and it is stated as a shortcut rather than rendered as a button, because a room that must work without JavaScript cannot end on a control that does nothing. Plate parked.

Card content is generated from `apps/web/src/lib/nav/destination-registry.ts` (SP-15), never hand-written. That registry is also what the breadcrumb chain, the site footer, the palette Go section and the sitemap read, and `destination-registry.test.ts` fails when a route classified in `surface-classes.ts` has no entry — which is what makes "a new public route cannot be missing from the library" a gate rather than a habit.

**`/records`** is new, and it is the answer to the draft's worst defect. Command bar, then a paper column: mono `RECORDS` kicker, Sora title, serif lede naming the total and the as-of release. Then plain GET filter links using the exact Lens vocabulary (kind, era, state, topic, status, evidence floor) rendered as chips, then hairline rows carrying kind glyph, name, place, era and grade dot, 100 per page, then real prev and next anchors in the server HTML. Right rail groups by era and by state. Footer. Plate parked. Every filter is a link, every row is a link, every page step is an anchor: nothing on this surface requires JS. `q` is durable, visible, editable page state here, with a clear control and the term echoed above the results. "See these on the Atlas" hands the current filter to `/` with its reason string. The index is also the palette's named fallback when a query returns nothing.

**`/history`** dissolves. The decade stepper becomes the Atlas Time panel. The record list becomes `/records`. A bookmarked `/history?decade=1930` lands on `/records?era=1930s` with the era chip active and "See these on the Atlas" one click away.

> **Correction, shipped in repo-92n2.27.** This paragraph originally said the kind composition graph *moves to `/data`, which is its only honest home, rather than being deleted*. It was deleted instead, and the relocation was wrong on three counts. `HistoryGraphPanel` turned out to be a `@deprecated` pass-through to `HistoryDataPanel`, so there was no graph to move. The panel's substance — kind composition with counts — already exists on `/records` as a crawlable, linkable facet, where the redirect sends every `/history` bookmark anyway; re-rendering it as a client-only panel would have been a second, worse copy. And `/data` is national indicator series with sources attached, a different dataset entirely; the panel's `onSelectNode`/`onSelectEdge` handlers only mean something inside a browse surface with selection state, which `/data` is not. What genuinely had no home elsewhere is the connection-coverage statistic (how many records carry a published, evidence-backed edge). That is recorded as an open question rather than smuggled onto an unrelated room.
>
> Deleted with the render layer: `HistoryExperience`, `DecadeStepper`, `HistoryOverviewStrip`, `HistoryResultList`, `HistoryGraphPanel`, `HistoryDataPanel`, `HistoryDidYouKnow`, `HistoryEdgePanel`, `HistoryNarrativeCard`, `HistoryRipRow`, `HistoryGraphViz` (already unreferenced), the route's `history.css`, `history-edition.css` and `history-panel-chrome.ts`, and the `lib/history` leaves reachable only through them. `HISTORY_PAGE_PARAM_ALLOWLIST` went too: `/history` left the middleware matcher in SP-06, and an allowlist there would have made re-adding it look safe when normalization would strip the very `decade` param the redirect exists to carry.

**`/chapters`** keeps its published article grid on the v9 card. On wide viewports a right rail groups chapters BY ERA and BY PLACE as links to chapters, staying inside the index, with a single Atlas handoff at the foot worded "See every place these chapters touch". Distinct notices for the unavailable and none published states. Cards are real links in document order, never divs with click handlers, and the grid adopts the Results rail windowing law so it holds at fifty chapters.

**`/chapters/[slug]`** carries a reading progress rule under the bar. Header: mono era and place kicker, Sora title, serif standfirst, mono byline; hero figure; then the article column at roughly a 66 character measure with Source Serif 4 body, mono inline citation chips, stat callouts, timelines and map moments. Each map moment is a bounded in-flow frame that borrows the persistent plate on scroll in and releases it on exit, never full bleed behind prose, enforced in CSS rather than left to authors. Entity mentions open the record sheet in its in-document posture; `ESC` closes and returns focus to the chip. The close is numbered references, then "The records behind this chapter" handing a named collection to the Atlas, then prev and next chapter. This chapter's citations are the source of the chapter-cites-record edge that record pages and the Atlas sheet render in reverse.

**`/books`** keeps its intro panel with catalogue pulse counts in mono, the search field wired to the existing typeahead, facet chips using the exact Lens chip vocabulary, and rip rows with cover art, title, author, challenge state tags and era. Right rail: "Where books are challenged" as state lens handoff links. Cover art is decorative and `aria-hidden`; the title carries the accessible name. The typeahead uses the same keyboard contract as the palette.

**`/law`** keeps its intro panel naming what is and is not in the catalogue, kind and topic chips in the shared chip vocabulary, a search field, and hairline result rows carrying citation, year, jurisdiction and a one line plain language gloss. Right rail: "By jurisdiction" as state lens handoff links. The catalogue loads from a separate legal catalog, not from entities; its relationship to records is jurisdictional, not documented, and the copy has to say so.

**`/data`** renders the chart stack on paper: the national Census population timeline, the Phase 1 theme impact indicators, and the kind composition graph rescued from `/history`. Each chart sits in its own card with a mono source label, a mono as-of line, and a plain language reading of what the chart does and does not say. Charts render as static SVG with a "Show the numbers" disclosure beneath each, so no value is hover only or colour only. The "See this on the Atlas" handoff opens the population layer at the matching decade, and it ships only once the Lens exposes that layer with its comparability note; until then `/data` stays self-contained rather than dropping a reader on an unlabelled choropleth with no way back to pins.

**`/memorial`** takes the command bar in its quietest form: brand, search, theme, nothing else. The handwritten memorial wall owns the canvas and the plate stays Parked and hidden. Over the wall, an opaque paper column carries the alphabetical list with each name linked to its record where one exists, and a short serif preamble states plainly what the list is and what it is not. No instruments, no spotlight, no camera, no decade sweep. A persistent "Hold the wall still" control freezes both the reveal choreography and the indefinite cycling, persisted for the session; `prefers-reduced-motion` sets its initial state to held but never removes the control, because a wall that auto-plays for more than five seconds needs an in-page stop regardless of OS preference. Names are links where a record exists and plain text where none does, and the difference is stated in words, never implied by colour alone.

**`/about`** becomes a paper column of six hairline ruled sections rather than six identical cards: intro, pillars, mission beats, publish bar, destinations, and the no account close. The destinations block becomes the site's human readable map of itself, generated from the shared destination registry, naming every public surface with one line of what it is for. This block is the adoption gate: a route not in the palette, the footer and this block is not shipped.

**`/methodology`** is built from the live `Citation`, `Confidence` and `Notice` components rather than prose describing them, with section names matching the ones record pages use, so the encoding a reader learns here is exactly the one the Atlas sheet and record pages use. `TrustSite` and `PublishingPrinciples` JSON-LD are retained. It closes with a "See it applied" block linking to a live record, the errata log and the corrections form. `A` opens the Atlas with the evidence floor set to A only, which makes the page's argument operable. The living-person-protection section carries the named link to `/memorial`.

**`/errata`** renders the corrections log as a reverse chronological hairline list: mono date, mono linked record id, serif one line statement of what changed and why, and the public phase where one applies. The header carries the two feed links as mono chips. It is a plain list, not a set of disclosures: nothing that proves the archive corrects itself is hidden behind a click.

### 4.3 Record pages

All three record pages and the loading state share one anatomy component with the Atlas sheet, and their citation strings are byte identical to the sheet's because both call `lib/citation/format`.

**`/entity/[id]`** leads with the framed place plate, flown at stored precision with the coarsening stated, and beside it the kicker and the Sora name. Then serif linked prose summary, topic tags as lens handoff links, the record anatomy panel with its precision footnote, the trust block, the sensitivity banner where it applies, "Why this appears" naming the specific match reason, numbered sources, documented connections, the new "Chapters that cite this record", "How to read this record", and session prev and next. Documented connections state their relation in words, never a bare arrow. Camera dignity applies: violence adjacent records get a plain `flyTo` and the dramatizing moves render disabled with the reason in visible text; person records never get spotlight.

**`/books/[slug]`** leads with a framed jurisdiction plate showing the challenging jurisdiction as an outline at stored precision, never a school address, with cover art beside it. Then mono `BOOK` kicker, Sora title, author, serif summary, the anatomy panel in inline rows with its precision footnote, the challenge list as hairline rows, the Bookshop affiliate call to action marked as affiliate in plain words and visually separated from evidence, then sources, then "Records in this jurisdiction", then prev and next. The affiliate block is the only commercial element on the site and it must never read as evidence.

**`/law/[slug]`** leads with a framed jurisdiction plate showing the state or federal outline the law governs, never a point, with a precision note that reads that a law has a jurisdiction rather than a location. Then mono `LAW` kicker, Sora title, official citation in mono, serif plain language explainer, the anatomy panel in inline rows, official source links as numbered rows, then "Records in this jurisdiction and era" labelled exactly that, then prev and next. No push in and no orbit on a law: the dignity gate's spirit applies to abstractions too. The link from a law to records is constructed from jurisdiction and era, not from a documented edge, so the label must never imply causation and the lens handoff builder must refuse a reason string that does. Laws have no geo anchor in the catalogue today; if the state code to polygon join is not ready, this route ships without the plate rather than with a fabricated one.

**The entity loading state** is the record page's own skeleton rather than a different page. The framed plate renders its parked state and the kicker, name, summary and anatomy rows render as shimmer blocks at the exact geometry they will occupy, so nothing reflows when the record arrives. Nothing is interactive except the command bar, which stays fully live during the wait. `aria-busy` on the region with a single polite "Opening record" announcement, not one per shimmer block. Reduced motion renders the blocks static, read from the live media query rather than a one-shot boot value. Never a spinner.

### 4.4 Utility surfaces

All nine sit on the v9 utility card stack, and by construction only chorded bindings are live on them.

**`/corrections`** opens with an intro stating that a correction is normal system function, then the correction form prefilled from `target` and `targetType` and naming the target in words above the fields, then the appeal form and the abuse report as separate disclosures rather than peers, then the receipt code lookup. The abuse disclosure label names its job in plain words, never hidden under "Other"; the appeal disclosure accepts and validates the original receipt code before submit. Submit returns a copyable receipt code with a link to its status page and a toast carrying the code. There is no undo on submit, and the copy says so plainly.

**`/corrections/status/[receiptCode]`** renders one card: the receipt code in mono, the coarse public phase as a status mark with its text label, the date it entered that phase, and a plain sentence of what happens next. Unknown receipts render a `Notice` plus an `EmptyState` naming the two likely causes and offering the lookup field again. It never enumerates other submissions. `Cmd+L` copies the status URL, and the page states plainly that anyone holding the code can read it. The palette carries no entry for it: a receipt is not a place.

**`/submit`** opens with a `Notice` stating that nothing is published as-is, then the lead form, then a closing block explaining the moderated consensus review path with a link to the methodology section that governs it. Submit returns a plain confirmation and the next step, with no receipt code, because a lead is not a correction, and the copy says exactly that. The Atlas and `/records` empty states link here by name, which is the moment a reader is most likely to have a lead.

**`/support`** carries three named paths as hairline rows (a factual correction goes to `/corrections`, how we decide goes to `/methodology`, what we have already fixed goes to `/errata`), then a contact block using a role mailbox filled from the same config value as `security.txt`, so the two cannot drift. Five links and nothing else; no form, because every form it would host already exists elsewhere.

**`/privacy`** is written in the methodology voice rather than a legal register: what each surface processes, the explicit non collection list, geolocation handling on the Atlas Lens and the narrow place sheet, submission privacy in plain words, the AI crawler policy named with its URL, and the owner contact. Anchored sections with `scroll-margin` under the bar, each with a copyable hairline link control. Nothing legally relevant is hidden behind a disclosure.

**`/chapters/mosaic-credits`** carries a mono `CREDITS` kicker, Sora title, serif lede stating that every atmosphere tile is rights cleared, then a hairline table of tile index, linked entity and served path. Table rows are plain links in reading order; no sortable columns. It is effectively an orphan today, linked only from `/law`; it needs a link from every surface that renders the mosaic or the rights disclosure is not actually reachable. The `A` key is disabled here and the shortcut sheet says so.

**`/design-system`** rebuilds the fixture gallery on v9: the Atlas instruments (Lens group, Results row, Time histogram, Camera console, Record sheet, legend, dock chip, toast, empty state, skeleton) alongside the shared primitives, each rendered in light and dark side by side with its token names in mono. The "Design direction v5" label is replaced by "v9 Atlas". No plate. Every fixture is operable, including the keyboard path it documents.

**`/_not-found`** renders a mono `404` kicker, Sora "That page is not here", a serif line naming the two likely causes, then an `EmptyState` offering the palette, the Atlas, Chapters and `/records`. The `/design-system` exit is removed. `Cmd+K` opens the palette with the sanitised mistyped path pre-seeded as the query; sanitising it is required, because an unsanitised path in a search field is a reflected content vector. The record index exit now points at a surface that is actually a list, not at a map with a hidden list behind it.

**The root error boundary** renders a mono `ERROR` kicker, a plain sentence that something failed and the archive is not lost, a Try again control wired to `reset`, and two named exits. No stack trace and no error code the reader cannot act on. Focus moves to Try again on mount and the region announces once, politely. `Cmd+K` still opens the palette, because the chrome is mounted above the boundary and survives a segment error. This is the strongest argument for mounting the plate provider without awaiting release data: the shell must carry no data dependency that can throw.

### 4.5 Endpoints

Three of the nineteen carry live defects and change; the rest are listed to prove the map covers the whole public surface.

- **`/history/api`** is preserved as a thin alias delegating to the explore refine handler with decade mapped to era. Middleware matches the exact path `/history/api`, which is not `/history`, so it gets an empty allowlist and its own query is stripped by a 308 before the handler parses it. `/history/api` and `/submit/api` are the only two API paths in the matcher and both must be removed.
- **`/robots.txt`** keeps allowing standard crawlers at `/` and disallowing the 26 named AI training user agents, and gains no new Disallow. `/design-system` and `/corrections/status/` are handled by noindex and `X-Robots-Tag` respectively, because a Disallow would stop the crawler ever reading the noindex and would freeze an already-indexed URL in place.
- **`/sitemap.xml`** builds its entry list from the shared destination registry rather than by hand, with a test asserting no duplicate `url` element and that every registry entry marked indexable appears exactly once. Entries: `/`, `/records` plus every page, `/story`, `/chapters` plus every slug, `/books` plus every slug, `/law` plus every slug, `/data`, `/memorial`, `/methodology`, `/about`, `/errata`, `/corrections`, `/submit`, `/support`, `/privacy`, `/chapters/mosaic-credits`, and every `/entity/{id}`. Removed: `/explore`, `/history`, `/locate`. Excluded: `/design-system` and `/corrections/status/*`.

`/explore/api` becomes the Atlas's refine endpoint in fact rather than in theory: fully built, guarded, rate limited and unit tested, with zero callers today. Mounting a currently dead endpoint is a behaviour change that needs its own load testing before it sits on the site's busiest surface. `/search/api` stays the palette's later scale path behind a measured record count threshold, not part of this release. `/locate/api` gains a second call site (the Lens place finder and the narrow place sheet), so the opt-in gate must live in the shared component, not in each posture. `/api/request-integrity` now mints a token whose lifetime spans a much longer visit, so its expiry handling needs a retry path rather than a failed submit. Both errata feeds must keep entry URLs absolute against `NEXT_PUBLIC_SITE_URL`, and both are built from the same entry list, so they are fixed together. `/ai.txt` and `/.well-known/security.txt` are unchanged in shape; security.txt's placeholder values remain a launch blocker independent of this restructure.

---

## 5. The connective tissue

The resolution map is a list of rooms. This section is what makes them one building.

### 5.1 One shell above every route

`SiteShellHeader`, `ShellHeader`, `PRIMARY_NAV` and `OVERFLOW_NAV` are replaced by the CommandBar on every rendered surface. Navigation moves into the palette and the footer; the `isExploreMapShell` predicate and both client route gates are deleted. The bar never unmounts, which also kills the `--ds-island-clearance` leak that strands an inline custom property on `<html>` for the rest of the session.

Above every route, mounted once: the command bar, the palette, the collections drawer, the toast stack and the keyboard layer. Which bindings are live is scoped per surface class. The collections store becomes global and localStorage backed, and Saved sits in the bar everywhere, so a record saved on the Atlas is still saved on a chapter and a citation copied from a book uses the same formatter as one copied from a pin.

Three shell contracts ship with it.

- **Keyboard scope.** `isTypingTarget` is the only guard today and it satisfies none of WCAG 2.1.4's three mechanisms. Single-key camera, time and record bindings become live only while focus is inside the Instrument's `main` landmark, which is mechanism three and removes the failure on forms entirely. Reading rooms and Utility surfaces carry only chorded bindings by construction. A "Single-key shortcuts on/off" control ships in the shortcut sheet header and as a palette command, persisted beside `ds-theme`, as a second line of defence rather than the only one.
- **Focus.** Closing the record sheet returns focus to the row that opened it; hiding a panel by button or by `\` moves focus to that panel's dock chip; restoring returns focus to the panel header; dock chips get the 44px row target the Lens and Time panels already hold. A shared `useFocusTrap` is used by `ShortcutSheet`, `CollectionsDrawer` and every future `.ov` overlay, with `inert` set on the stage and bar while an `aria-modal` dialog is open. `CommandPalette` already handles Tab correctly and is the pattern to follow.
- **Motion.** The one-shot `prefersReducedMotion()` read is replaced by a `useReducedMotion()` hook backed by a `matchMedia` change listener, threaded through the camera, the sweep and the annotation overlay. On a site that is now one continuous session that never reloads, a reader who enables Reduce Motion mid-session currently keeps full-motion camera work until they close the tab.

Toasts that carry an action do not auto-dismiss. Undo by toast is the recovery path for Reset lens, clear-all and layer changes, and six seconds at screen-reader verbosity is not enough to hear the polite announcement, find the toast in the tab order and activate it. `TOAST_ACTION_DURATION_MS` is set to null so an action toast persists until acted on or dismissed, with its action bound to a chord named in the toast text. The 2600ms form is kept for toasts with no action.

### 5.2 How prose cites records

A chapter's inline citation chips are the source of truth. The chapter-cites-record edge is emitted as a release build artifact from the citations chapters already carry. In the reading column an entity mention opens the record sheet in its in-document posture; `ESC` closes it and returns focus to the chip. Citation chips jump to the numbered reference, and each reference has a return control back to the sentence. Every chapter closes with "The records behind this chapter", which hands a named collection to the Atlas.

### 5.3 How records link back

The same edge is rendered in reverse. "Chapters that cite this record" appears in both sheet postures and on `/entity/[id]`. This is the half of the thesis that has no implementation today: `AtlasExperience` hardcodes `sources: []` and `connections: []`, so the sheet always shows its no-sources fallback and never shows a connection, and from the homepage there is currently no route to any chapter at all. Emitting the edge is a prerequisite for folding `/history`, because the fold removes the other browse path from a record to editorial.

Beyond the cites edge, every record page links to its law, its jurisdiction records and its documented connections, and every law detail links back from the records that cite it, so the path is bidirectional in both directions rather than asserted in one.

### 5.4 The palette is the navigation

The command registry gains a fifth section, **Go**, carrying every destination plus the `A` binding, and the shortcut sheet is generated from the registry rather than hand authored. One destination registry is consumed by the palette's Go section, the site footer, the `/about` destinations block and the sitemap, with a test that fails when a public route is missing from it.

The palette's client record index is widened to carry topic, kind label, era label and summary alongside name and place. `rankRecords` scores name and place only today, so a reader arriving with the word "redlining" gets nothing, and readers arrive with topical vocabulary. A fixture test asserts that redlining, sundown town, restrictive covenant and Great Migration each return at least one record or chapter. Switching the palette to `/search/api` is explicitly not part of this release: the coverage defect is a data shape problem, not a scale problem.

### 5.5 The lens handoff

A typed builder turns any surface's subject into an Atlas deep link plus a mandatory human readable reason string that the Atlas renders in its results header. No surface hand writes an Atlas URL. A reason string that implies causation the archive has not documented fails the type, which is what stops `/law/[slug]`'s jurisdiction-and-era link reading as cause and effect.

Two rules travel with it.

- **Active constraint chip law.** Every param that narrows the result set renders as a visible, clearable chip with its reason string wherever it lands, including `status`. Params that do not narrow the set are named exclusions, not oversights: `selected` is the record sheet, `collection` is the drawer, `find` is a focus instruction.
- **Named collection handoff.** `?collection={slug}` loads an authored record set into the global collections drawer and fits the camera. This is how a chapter hands its evidence to the instrument.

### 5.6 No room is a dead end

Every Reading room ends in a records off ramp into the Atlas or `/records`. Every Utility surface ends with at least one named next step, never a bare confirmation. Every record page carries session prev and next, an Atlas return and a correction path. The Atlas and `/records` empty states name `/submit` rather than saying "no results".

The rule is enforced structurally, not by review. The `/about` destinations block is the adoption gate: a route not in the palette, the footer and that block is not shipped, and the registry test fails when a public route is absent. `/memorial` is the proof case. It has zero inbound hrefs anywhere in `src` today, and the four named inbound links (footer Trust column, palette, `/about` destinations, the living-person-protection section of `/methodology`) are the only thing that stops it staying an orphan.

### 5.7 What a crawler is told, and by which mechanism (SP-19, shipped)

The sitemap is derived from the destination registry: a route is advertised if and only if its entry carries `crawl`, so it cannot drift from the site the way the hand-kept list did. That list carried `/history` **twice** — a duplicate `<url>` element in the shipped XML — and went on carrying it after `/history` became a redirect. `sitemap-builders.test.ts` now asserts no duplicate URL, that the emitted list equals the registry's crawlable set, and that **every advertised path has a `page.tsx` on disk**. That last assertion is the one that earns its keep: it caught `/corrections/appeal` and `/corrections/abuse` being carried as destinations when both are API-only directories that 404, their forms being mounted inside the receipt status page. Both are gone from the registry and from the resolution map.

Absent `crawl` is a decision, and a test pins the list of decisions to exactly two: `/story`, which does not render until SP-10, and `/design-system`, which is noindexed. A third omission fails until someone records why.

Every static room now builds its head through `buildStaticPageMetadata`, which had zero callers outside its own test. Sixteen rooms shipped with **no canonical at all**, so every filter, fragment and tracking permutation of them was a separate URL to a crawler. The canonical is absolute because `metadataBase` is not set — a relative one emits verbatim and means nothing — and `metadata-builders.test.ts` walks the App Router tree and fails any page that exports a bare `metadata` object, so adoption is asserted rather than left to review.

Three deliberate exceptions to self-canonicalisation:

| Surface | Canonical | Why |
| --- | --- | --- |
| `/` | bare `/`, always | Filters, `/explore`'s forwarded query and every facet combination render substantially the front door. Self-canonicalising each permutation offers a crawler thousands of near duplicates of one page. |
| `/records?page=N` | itself, with `rel=prev`/`rel=next` | Here the narrowing **is** the page. A paged index without prev/next teaches a crawler that page 2 is an unrelated document. |
| `/corrections/status/*` | none | A receipt code is one person's private handle. It gets `X-Robots-Tag: noindex, follow` from `next.config.mjs` instead. |

**Noindex ships alone, with no `robots.txt` Disallow, in both cases.** The two are opposite instructions and pairing them defeats the intent: a Disallowed URL is never fetched, so the noindex is never read, and the URL can still be indexed from an inbound link with nothing but its anchor text. `follow` also stays `true` on both — dropping a page from the index is not a reason to discard where it points. `metadata-builders.test.ts` asserts `robots.txt` gains no Disallow beyond the AI-training agents and that the general crawler is blocked nowhere.

---

## 6. What the critiques changed

This section is the provenance record. Three review passes were run against the first draft of this resolution map; 29 findings were accepted and 6 were rejected or rejected in part. Eight of the accepted findings were blocking. Three of them reshaped the document rather than correcting a row.

### 6.1 The three corrections that reshaped the draft

**`/records` exists because the draft deleted the archive's only browsable index.** This was the strongest finding in all three reviews. The map answers "what happened near here" well and "what is documented about X" badly, and the draft routed both through it: `/history` folded into the Atlas, and the Atlas's server rendered list was to be the index. That list is a no-JS fallback, hidden from the accessibility tree on hydration, inside a surface whose canonical is bare `/`. A related blocking finding compounded it: canonicalising every `?page=` onto bare `/` would have told crawlers that pages two through forty-one duplicate page one. The fix is a real Reading room at `/records` with real anchors, real filter links, real pagination and self-referential canonicals, and pagination moves off `/` entirely.

**Story became `/story` because `?mode=story` made the site's principal narrative unlinkable.** The draft named Story as the mitigation for removing the homepage hero, which is the only place the product explains itself, and then specified it as a query parameter on a route whose canonical is always bare `/`. That is uncitable, unshareable, out of the sitemap, and in direct contradiction with the same row's own canonical rule. `/story` is now durable, self-canonical and sitemapped, with its own OG image.

**The memorial names plate layer is deleted rather than hoisted.** The `explore-memorial-names` symbol layer places murdered people at fabricated coordinates inside `PLATE_FRAME`, pushes every name off US land, randomises size, rotation and ink for collage texture, lets MapLibre collision silently drop whichever names lose a priority tiebreak, and fades each name as the decade passes their death year. That is a person rendered as anonymous decoration at a place they were not, animated by a scrub control. It is confined to two routes today, and the whole point of this document is to hoist the plate site wide. The layer is deleted and the wiring dropped from `MapStage`. The memorial lives at `/memorial`, which the reader chooses to enter.

A related claim in the draft was simply false in both directions and is recorded here so it is not reintroduced: `/memorial` has zero inbound hrefs anywhere in `src`, and the plate's names are MapLibre glyphs inside an `aria-hidden` canvas, so they were never links and could not have been made into links.

### 6.2 The other blocking findings

| Finding | What changed |
|---|---|
| The `/explore` to `/` param vocabularies are not identical. `EXPLORE_PAGE_PARAM_ALLOWLIST` carries 19 keys against the draft's 15, and `buildExploreSearchParams` additionally emits `tone`, `panels`, `radius` and `near`, none allowlisted, violating that file's own must-stay-aligned comment. | The allowlist is generated from the parser's key set with a two-way drift test rather than retyped. |
| A robots.txt Disallow and a meta noindex cancel each other, and the draft prescribed the exact combination its own risk line warned against. | noindex alone for `/design-system`, an `X-Robots-Tag` header for `/corrections/status/*`, no new Disallow in this release, and never a Disallow for the receipt prefix, because that advertises it. |
| Fifteen unmodified single-key bindings guarded only by `isTypingTarget` is a WCAG 2.1.4 Level A failure, and the draft converted a one-route defect into a site-wide one. `isTypingTarget` checks `tagName` and `isContentEditable` and nothing else. | Bindings are scoped to the owning surface, plus a global toggle as a second mechanism. |
| `AtlasExperience` renders no `main` element, so the skip link already dangles, and the draft's remedy would have left the instruments outside the landmark while a visually-hidden index double-announced every record. | `main` wraps the instrument stage and the fallback list is removed from the accessibility tree with `hidden`. |

### 6.3 Accepted corrections to individual rows

Routing and URLs: `/facts` and `/facts/:path*` were missed entirely and would have become two or three hop chains, so they are repointed to `/records` with a redirect-chain test. A `next.config` redirect cannot transform decade to era, and once a config rule for `/history` exists there is no later hook, so `/history` stays a filesystem route doing the mapping. `permanent: true` already emits 308, so the draft's stated `/search` risk was not real; the real constraint is the opposite one and is now recorded, that `/history` can never be deleted because cached permanent redirects point at it. Entity deep anchors become URL fragments so the `/entity/*` allowlist stays empty. The draft's sitemap delta was wrong in three places (`/memorial` and `/books` are already in `STATIC_PUBLIC_ROUTES`, and `/search` never was), which is why the list moves onto the destination registry with a duplicate-url test.

Dignity and accessibility: the dignity gate is move-level only and `isMoveAllowed` returns true for every move when nothing is selected, so nothing stopped the Lens composing a harm-density map; a composition-level gate is added. Retiring `MapExperienceLegend` while two surfaces promise "Show the legend" leaves a dangling command, and the area fills have no shape channel, so deleting the key would have shipped colour-only encoding; the legend is retained and mounted. The focus contract was unwritten: sheet close, panel hide and chrome hide all drop focus to body on a surface with no document scroll. `prefersReducedMotion` is a one-shot read with no change listener, which on a session that never reloads means the preference is ignored for the rest of the tab's life. The memorial wall auto-plays indefinitely with `prefers-reduced-motion` as its only mitigation, which fails WCAG 2.2.2 for any reader without the OS preference set. `ShortcutSheet` and `CollectionsDrawer` claim `aria-modal` without trapping Tab or setting `inert`. Undo-by-toast at 6000ms behind a polite live region is not reachable by keyboard or screen reader in time. A nine-second timer on the only orientation a first-time reader gets is a WCAG 2.2.1 problem for exactly the readers who need it longest.

Findability: nothing on the Atlas can hold a `q` (`ExploreFilterState` has no `q` field, the allowlist has no `q`, `LensPanel` renders no text field), so `/search` lands on `/records`. The palette indexes names, not subjects: `rankRecords` scores name and place only. `LensPanel` contains zero occurrences of `topic` while the lens-handoff pattern is the map's main connective tissue. The chapter-cites-record edge the draft cited in two `linkedFrom` rows does not exist.

Mobile and editorial: folding `/locate` into a rail that is `display:none` below 980px degrades the journey most likely to be mobile, so a dedicated narrow place sheet is part of the resolution row rather than left to implementation. The `/data` handoff would have dropped a reader on an unlabelled choropleth with no control to turn it off, from the one surface whose job is explaining what a number does not say. The `/chapters` rail sent readers who wanted a different chapter out to the map.

### 6.4 Rejected, and why

**Splitting `/story` into six routes.** Accepted that `/story` should be durable; rejected the split. The six chapters are one continuous scroll-driven camera narrative: `STORY_CHAPTERS` drives a single `IntersectionObserver` over one scroller, chapter 3's corridor arcs and chapter 4's decade sweep only read in sequence, and each chapter's camera spec assumes the plate is already where the previous chapter left it. Six routes means six MapLibre cold starts and six documents each of which is a fragment of an argument. `/story#chapter-{id}` gives citable, crawlable, shareable per-chapter addresses inside one document, and fragments are exactly what the same review correctly prescribed for entity deep anchors.

**Conditional `/history` targets.** Rejected redirecting `/history` to `/records` for some params and to `/?era=` when `decade` was the sole param. A redirect target that changes based on how many params a URL happens to carry means the same bookmark lands in two different rooms depending on an incidental extra key, and no reader can predict which. `/history` always resolves to `/records`, which renders the era as an active chip and carries the Atlas handoff one click away.

**Wiring `/search/api` as the palette backend in this release.** Accepted the coverage defect entirely; rejected the release coupling. `/search/api` has zero callers today, and switching the site's primary affordance from a client index to a network round trip changes its latency profile in the same release that hoists the plate, folds three routes and adds two more. Widening the client index shape fixes what readers actually hit, is cheap, is testable with a fixture, and ships now.

**Allowlisting `panels`.** Accepted the drift and the generated-allowlist fix; rejected preserving `panels`. Which panels a reader has open is chrome state, not shareable meaning, and it is the same class of thing as the viewport that ADR-017 already refuses to put in the URL for the same reason. The fix is to stop the builder emitting it. `radius` and `near` do carry meaning, so they are generated in with everything else.

**"Every accepted param must have a Lens control."** Right in spirit, wrong at the edges: shipping it as written would produce absurd controls for `selected`, `collection` and `find`, none of which narrows the result set. Replaced by the active constraint chip law in section 5.5.

**A global single-key toggle as the whole WCAG 2.1.4 remedy.** Accepted the finding, which is blocking and correct; rejected the toggle as the sole mechanism. Scoping camera, time and record keys to the Instrument's `main` landmark eliminates the speech-input and stuck-key failure on `/corrections` and `/submit` by construction, rather than leaving those surfaces one forgotten setting away from firing camera moves into a half-filled form. The toggle still ships, as a second line of defence.

---

## 7. New patterns this requires

Each of these gets a pattern doc under `docs/ui/` and a row in [`README.md`](./README.md)'s pattern index (SP-04).

| Pattern | Law |
|---|---|
| **Plate posture** | One persistent plate, three declarative postures (Live, Framed, Parked) selected by the surface class attribute. Only one Framed slot may be active per viewport, and the plate never sits behind body text outside the Instrument. |
| **Surface class attribute** | `data-surface` on the page root as the single switch every shell rule, plate posture, keyboard scope and footer decision reads, replacing two client route gates and roughly 25 ad hoc `:has()` selectors. |
| **Atlas chrome shell** | CommandBar, palette, collections, toasts and the keyboard layer mounted once above every route, with per surface class scoping of which bindings are live, a shared focus trap plus `inert` for every `aria-modal` overlay, and a named focus return for every open, close, hide and restore transition. |
| **Single-key scope law** | An unmodified key binding may only be live while focus is inside the surface that owns it, and every such binding is additionally switchable off globally. A typing-target check is not a WCAG 2.1.4 mechanism and does not count. |
| **Record sheet, two postures** | One component rendered over the plate on the Atlas and anchored in the reading column on chapters and catalogues, with "Fly to place" swapping to "Open on the Atlas". No surface forks the preview. |
| **Lens handoff link** | A typed builder that turns any surface's subject into an Atlas deep link plus a mandatory human readable reason string the Atlas renders in its results header. No surface hand writes an Atlas URL, and a reason string that implies causation the archive has not documented fails the type. |
| **Active constraint chip law** | Every param that narrows the result set must render as a visible, clearable chip with its reason string wherever it lands. Params that do not narrow the set (`selected`, `collection`, `find`) are deliberate exclusions. |
| **Named collection handoff** | `?collection={slug}` loads an authored record set into the global collections drawer and fits the camera. This is how a chapter hands its evidence to the instrument. |
| **Crawlable index as its own route** | The archive's non-spatial index is a real Reading room at `/records` with real anchors, real pagination and self-referential canonicals, not a hidden list inside an instrument. An Instrument's server rendered list is a no-JS and map-failure fallback only, removed from the accessibility tree on hydration. |
| **Map moment** | A bounded in-flow plate frame inside editorial prose that borrows the plate on scroll in, cuts instead of flying under reduced motion, never intercepts the scroll gesture, and is never full bleed behind text. |
| **Reading room chrome** | Measure limited paper column, progress rule, hairline section rules, one `h1`, and a mandatory records off ramp in the foot of every instance so no editorial surface is a dead end. |
| **Jurisdiction plate** | For records whose Where is a jurisdiction rather than a point, render the outline rather than a pin, with a precision note that says a jurisdiction is not a location. |
| **Composition dignity gate** | The archive refuses to compose a harm-density image, not just to dramatise one record. Under a violence-constrained lens, area fills and choropleths refuse to paint, records stay discrete points, unselected spotlight and trace are refused, and every refusal states its reason in visible text. |
| **Encoding key completeness** | Any channel the map uses to carry meaning must appear in the legend with a text label and, for a tier, its numeric range. A fill with no shape channel and no key is colour-only encoding and does not ship. |
| **Destination registry** | One list of public destinations consumed by the palette, the footer, the `/about` destinations block and the sitemap, with a test that fails when a public route is missing and a test that fails when the sitemap emits a duplicate `url`. |
| **Deep anchors are fragments** | A highlighted claim or source anchor is a URL fragment, never a query param, so it survives middleware, stays out of the CDN cache key and cannot fragment the canonical. |
| **Generated allowlists** | Any list that must mirror another list is generated from it and guarded by a drift test. Applies to the query allowlist against the URL parser, the shortcut sheet against the command registry, the sitemap against the destination registry, and `/ai.txt` against `robots.ts`. |

---

## 8. Work packages

Twenty packages. SP-01 to SP-03 extend the mock (room layer and registry, palette Go section, the chapter reading room and map moment, the record room, the records index, the catalogue and utility rooms, the legend overlay, the single-key toggle). SP-04 writes the docs. Everything from SP-05 is application code.

| Id | Title | Tier | Priority | Depends on |
|---|---|---|---|---|
| SP-01 | Mock: room layer, registry, plate postures, footer, palette Go section | opus | P0 | none |
| SP-02 | Mock: chapter reading room, map moment, record room | opus | P0 | SP-01 |
| SP-03 | Mock: records index, catalogue, utility rooms, legend overlay, single-key toggle | sonnet | P0 | SP-02 |
| SP-04 | Author the v9 binding docs and promote the Atlas doc from proposed to binding | opus | P0 | none |
| SP-05 | Generate the query allowlist from the URL parser and fix the three live stripping defects | opus | P0 | none |
| SP-06 | Rebuild the redirect table with one-hop guarantees and a chain test | sonnet | P0 | SP-05 |
| SP-07 | Shell rework: hoist the plate provider, add the surface class attribute, merge the z-index ladder | opus | P0 | SP-04 |
| SP-08 | Plate postures, delete the memorial names layer, retire the second MapLibre instance | opus | P0 | SP-07 |
| SP-09 | Build `/records`, the crawlable non-spatial record index | sonnet | P0 | SP-06, SP-07 |
| SP-10 | Mount Story at `/story` with chapter fragments and implement the decade playback loop | sonnet | P0 | SP-07, SP-08 |
| SP-11 | Reading room surface class: chapters, chapter detail, books, law, data, about, methodology, errata | sonnet | P1 | SP-07, SP-09 |
| SP-12 | Record page surface class: entity, book detail, law detail, loading skeleton | sonnet | P1 | SP-08, SP-20 |
| SP-13 | Utility surface class: corrections, status, submit, support, privacy, design-system, 404, error, credits | sonnet | P1 | SP-07, SP-17 |
| SP-14 | Fold `/locate` into the Lens Where group with a narrow-viewport place sheet | sonnet | P1 | SP-07, SP-16 |
| SP-15 | Destination registry, palette Go section, footer, and the link-graph rewrite | sonnet | P0 | SP-06, SP-09 |
| SP-16 | Lens topic group, active constraint chips, legend retention, and the three dead attributes | sonnet | P1 | SP-07 |
| SP-17 | Keyboard scope and toggle, focus contract, focus trap, persistent action toasts | opus | P0 | SP-07 |
| SP-18 | Dignity verification: composition gate, live reduced-motion, memorial wall pause | opus | P0 | SP-08 |
| SP-19 | SEO: canonicals, sitemap from the registry, noindex without Disallow | sonnet | P1 | SP-15 |
| SP-20 | Emit the chapter-cites-record edge and give the sheet real sources and connections | sonnet | P0 | SP-07 |

### 8.1 Package detail

**SP-01.** `.design-mocks/blackstory-atlas-v9.html`. Turn the mock's already-written but entirely unused ROOMS CSS block into a working third mode: the body-level `#docprog` and `#doc` scaffold, the DESTINATIONS and ROOMS registries, `setPlate()`, `openRoom()`, the `setMode('read')` arm, the `#doc` scroll progress binding, and the generated footer. Add the fourth `dest` palette item type. Done when a destination typed into the palette switches to `data-mode='read'` with the correct `data-cls` and `data-plate`, `Escape` returns to the Atlas, and the six camera keys, the sheet and the story rail all still work.

**SP-02.** `.design-mocks/blackstory-atlas-v9.html`. `ROOMS.chapter` and `ROOMS.record`, plus `bindMapMoments()` with the one-Framed-slot guard, reduced-motion cut and observer teardown between rooms. Done when only one map moment is ever live, the record room's citation string is byte identical to the one `C` copies, and Save from inside the room updates the bar's saved count.

**SP-03.** `.design-mocks/blackstory-atlas-v9.html`. `ROOMS.records`, `ROOMS.catalogue`, `ROOMS.corrections`, `ROOMS.notfound`, the `#legendov` overlay, and the single-key toggle with a KEYMAP-generated shortcut table. Done when the records index renders from `visible()` so it and the results rail are provably the same query, the legend opens from three places, and every addition is reachable from at least two.

**SP-04.** `docs/ui/design-direction-v9-atlas.md` (proposed to binding), this document, plus `patterns-plate-posture.md`, `patterns-surface-classes.md`, `patterns-reading-room.md`, `patterns-record-page.md`, `patterns-lens-handoff.md`, `design-direction-v9-chapters.md` (there is no binding doc for the largest publication surface today), and `README.md`. Done when every route in the resolution map has a named binding doc and README's pattern and route tables match the actual app directory.

**SP-05.** `apps/web/src/lib/runtime-hardening/constants.ts`, `query-normalization.ts`, `edge-query-normalization.ts`, `apps/web/src/middleware.ts`, `apps/web/src/lib/map-experience/url-state.ts`. Done when a test fails if the parser reads a key the allowlist lacks or the builder emits one it lacks, `/law?q=voting&kind=statute` reaches the page with its filters, `/corrections?target=x&targetType=entity` reaches `CorrectionForm` with the prefill, `/history/api` receives its own query, and `lat`/`lng`/`zoom` are dropped by a documented policy line rather than by omission.

**SP-06.** `apps/web/next.config.mjs`, `apps/web/src/app/search/page.tsx`, `apps/web/src/app/history/page.tsx`, `apps/web/src/lib/search/search-href.ts`, `apps/web/src/lib/redirects/theme-alias-table.ts`. Done when a test over the `redirects()` array fails if any rule's destination is itself the source of another, `/search?q=tulsa` reaches `/records?q=tulsa` in exactly one hop, `/history?decade=1930` reaches `/records?era=1930s`, and redirect tests assert with params rather than bare paths.

**SP-07.** `apps/web/src/app/layout.tsx`, `template.tsx`, `shell.css`, `shell-layout.test.ts`, `components/SiteShell.tsx`, `SiteShellHeader.tsx`, `SiteShellFooter.tsx`, `components/explore-map-shell.ts`, `app/(map)/layout.tsx`, `app/(map)/map-surfaces.css`, `packages/ui/src/components/ShellHeader.tsx`. Done when navigating between `/`, `/records`, `/entity/[id]` and `/chapters` does not call `map.remove()`, verified in the browser rather than asserted from source; no route outside the former group becomes `force-dynamic` and `generateStaticParams` still runs; a rendered DOM test asserts the plate's containing block is the viewport on every surface class. The current scroll lock is already dead (it keys on `.ds-explore-stage`, which the Atlas stopped rendering) while `shell-layout.test.ts` asserts stylesheet text with a regex and passes anyway, so those text assertions are replaced with rendered DOM tests.

**SP-08.** `app/(map)/MapStage.tsx`, `lib/map-experience/build-memorial-name-features.ts`, `memorial-decade-fade.ts`, `app/map/explore-style.ts`, `components/entity/EntityLocationMap.tsx`, `components/patterns/RecordPlacePreview.tsx`. Done when a test asserts the memorial names layer id is absent from the built style, the app holds exactly one GL context on a record page verified in the browser, a Framed plate releases on exit, and a second Framed request while one is live is refused.

**SP-09.** `apps/web/src/app/records/page.tsx`, `RecordsIndex.tsx`, `records-index.css`, `lib/records/build-records-index.ts`. Done when filtering, paging and opening a record all work with JavaScript disabled; `/records?page=2` declares itself canonical; every page is in the sitemap; the filter vocabulary is generated from the same source as the Lens with a drift test; and it lands correctly from `/history`, `/search` and `/facts`.

**SP-10.** `apps/web/src/app/story/page.tsx`, `components/story/StoryMode.tsx`, `story-mode.css`, `lib/story/chapters.ts`, `chapters.test.ts`, `components/story/story-copy.test.ts`, `lib/map-experience/decade-transition.ts`. `StoryMode.tsx` is imported by nothing and has no tests; `togglePlayback` is an empty function and `decade-transition.sweep()` has no call site. Done when table-driven tests assert six chapters in order, valid camera specs and chapter 3's corridor honesty line; `/story#chapter-4` scrolls to and activates that chapter; the Time panel's play control drives the sweep; and `?mode=story` on `/` 308s to `/story`.

**SP-11.** `app/chapters/page.tsx`, `app/chapters/[slug]/page.tsx`, `app/books/page.tsx`, `app/law/page.tsx`, `app/data/page.tsx`, `app/about/page.tsx`, `app/methodology/page.tsx`, `app/errata/page.tsx`, `app/reading-room.css`. Done when no Reading room is a dead end, a CSS test asserts no live plate can sit behind a `.prose` column, the v5-mast surfaces are off the old mast, and `/data` renders the rescued kind composition graph.

**SP-12.** `app/entity/[id]/page.tsx`, `app/entity/[id]/loading.tsx`, `app/books/[slug]/page.tsx`, `app/law/[slug]/page.tsx`, `components/patterns/RecordAnatomyPanel.tsx`, `app/record-page.css`. Done when the sheet and the record page render the same anatomy component with no fork and byte identical citation strings, the skeleton's geometry matches the record so there is no layout jump, and violence-adjacent records show the dramatising moves disabled with the reason in visible text.

**SP-13.** `app/corrections/page.tsx`, `app/corrections/status/[receiptCode]/page.tsx`, `app/submit/page.tsx`, `app/support/page.tsx`, `app/privacy/page.tsx`, `app/design-system/page.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/chapters/mosaic-credits/page.tsx`, `lib/config/contact.ts`. Done when no unmodified key fires on any surface carrying a form, the support contact and security.txt contact come from one constant, the 404 seeds the palette with a sanitised path, `Cmd+K` still opens the palette when a segment has thrown, and no personal address is published.

**SP-14.** `components/map-experience/PlaceFinder.tsx`, `ExploreAddressSearch.tsx`, `LensPanel.tsx`, `app/locate/page.tsx`, `app/locate/LocateExperience.tsx`, `lib/map-experience/suggest-catalog-records.ts`. Done when `/?find=place` at 375px opens the place sheet with the full privacy notice, the address field, radius chips and the opt-in in one column, verified in the browser at that width; `/locate/api` is not called before the reader opts in, enforced at the shared call site; and radius versus state-select disagreement resolves to the most recent action with the other control visibly cleared.

**SP-15.** `lib/nav/destination-registry.ts`, `components/patterns/command-palette/CommandPalette.tsx`, `command-registry.ts`, `components/shell/SiteFooter.tsx`, `app/about/about-destinations.ts`, `components/patterns/ShortcutSheet.tsx`. Done when a fixture test asserts redlining, sundown town, restrictive covenant and Great Migration each return at least one record or chapter; a registry test fails when a public route is absent; `/memorial` has four real inbound links; no internal link points at a redirect; and the shortcut sheet is generated from the registry.

**SP-16.** `components/map-experience/LensPanel.tsx`, `ResultsRail.tsx`, `MapExperienceLegend.tsx`, `app/(map)/explore/AtlasExperience.tsx`, `atlas.css`. Done when a topic or status deep link shows an active clearable chip naming the constraint, `Alt+D` and `M` change the rendered page rather than just an attribute, the Place labels chip changes the map, every legend tier survives greyscale because it carries text, and "Show the legend" resolves from the Atlas and from `/methodology`.

**SP-17.** `lib/keyboard/bindings.ts`, `lib/keyboard/use-focus-trap.ts`, `components/patterns/ShortcutSheet.tsx`, `CollectionsDrawer.tsx`, `toast-stack.ts`, `Toast.tsx`, `app/(map)/explore/AtlasExperience.tsx`. Done when a rendered DOM test asserts `document.activeElement` after each of the four panel and sheet transitions, Tab cannot leave an open `aria-modal` dialog and the stage beneath is `inert`, no unmodified key fires while focus is on body in a Reading room or Utility surface, an action toast persists until acted on, and the single-key setting is stated in the sheet the `?` key opens.

**SP-18.** `lib/map-experience/camera-dignity.ts`, `lens-composition.ts`, `camera-presets.ts`, `lib/motion/use-reduced-motion.ts`, `components/patterns/memorial-wall/MemorialWallAtmosphere.tsx`, `app/memorial/page.tsx`. Done when a test asserts that constraining the lens to a violence-adjacent topic refuses the density layer and that the refusal reason is rendered as visible text and not a `title` attribute; enabling Reduce Motion mid-session changes camera behaviour without a reload, verified in the browser; and the memorial wall has an in-page stop that works whether or not an OS preference is set.

**SP-19.** `lib/seo/metadata-builders.ts`, `lib/seo/sitemap-builders.ts`, `app/sitemap.ts`, `app/robots.ts`, `app/design-system/page.tsx`, `app/corrections/status/[receiptCode]/page.tsx`. `buildStaticPageMetadata` has zero callers outside its own test. Done when every indexable public route has an absolute canonical, `/records?page=N` is self-canonical with rel prev and next, a test asserts the sitemap emits no duplicate `url` and that every indexable registry entry appears exactly once, and robots.txt gains no new Disallow.

**SP-20.** `lib/release/build-cites-edge.ts`, `app/(map)/explore/AtlasExperience.tsx`, `components/map-experience/RecordSheet.tsx`, `explore-view-model.ts`. Done when opening a cited record on the Atlas shows its numbered sources, its documented connections each stating their relation in words, and the chapters that cite it, and clicking a connection selects that record. This is a prerequisite for folding `/history`, because the fold removes the other browse path from a record to editorial.

---

## 9. Acceptance checklist

- [ ] Every one of the 47 routes in section 4 resolves; no previously public URL 404s
- [ ] A redirect-chain test fails when any rule's destination is itself the source of another rule
- [ ] `/search?q=tulsa`, `/history?decade=1930` and `/facts/anything` each reach `/records` in exactly one hop, with params
- [ ] The `/` query allowlist is generated from `parseExploreSearchParams` and a two-way drift test guards it
- [ ] `/law` holds `q`, `kind` and `topic`; `/corrections` holds `target` and `targetType`; `/history/api` receives its own query
- [ ] Navigating between `/`, `/records`, `/entity/[id]` and `/chapters` never calls `map.remove()`, verified in the browser
- [ ] No route outside the former `(map)` group becomes `force-dynamic`, and `generateStaticParams` still runs
- [ ] `data-surface` is emitted server side on every rendered route and drives plate posture, keyboard scope and chrome
- [ ] The plate never sits behind a `.prose` column, asserted by a CSS test, and only one Framed slot is ever live
- [ ] No memorial name is painted on the plate on any route, asserted by the layer id being absent from the built style
- [ ] Exactly one WebGL context exists on a record page, verified in the browser
- [ ] `/records` supports filtering, paging and opening a record with JavaScript disabled
- [ ] `/records?page=N` is self-canonical with rel prev and next; every page is in the sitemap
- [ ] `/story` renders six server-rendered chapters, `/story#chapter-4` activates that chapter, and `?mode=story` 308s here
- [ ] The Time panel's play control drives the decade sweep; under reduced motion playback is replaced by decade stepping
- [ ] Enabling Reduce Motion mid-session changes camera behaviour without a reload
- [ ] A violence-constrained lens refuses the density and choropleth layers with the reason in visible text
- [ ] `/memorial` has four real inbound links and a persistent in-page control that stops the wall
- [ ] Every legend tier carries a text label and, for a tier, its numeric range
- [ ] No unmodified key fires while focus is on body in a Reading room or Utility surface
- [ ] `document.activeElement` is asserted after sheet close, panel hide, panel restore and chrome hide
- [ ] Tab cannot leave an open `aria-modal` dialog and the stage beneath is `inert`
- [ ] Action toasts persist until acted on or dismissed
- [ ] `main` wraps the Atlas instrument stage, and the fallback list is `hidden` after hydration
- [ ] The palette returns at least one record or chapter for redlining, sundown town, restrictive covenant and Great Migration
- [ ] A registry test fails when a public route is missing from the palette, the footer, `/about` and the sitemap
- [ ] The sitemap emits no duplicate `url`, and every indexable registry entry appears exactly once
- [ ] `/design-system` carries noindex with follow true; `/corrections/status/*` carries an `X-Robots-Tag` header; robots.txt gains no new Disallow
- [ ] Every Reading room ends in a records off ramp, and every Utility surface ends with a named next step
- [ ] The record sheet and the record page render one anatomy component with byte identical citation strings
- [ ] "Chapters that cite this record" renders in both sheet postures and on `/entity/[id]`
- [ ] No personal address is published; support and `security.txt` read one config constant
- [ ] Responsive verified at 375 / 768 / 1280 / 1440, including `/?find=place` at 375px
- [ ] `pnpm lint && pnpm typecheck && pnpm test:js && pnpm test:a11y && pnpm format:check` clean
- [ ] No em dashes in shipped copy
- [ ] v6 surface docs listed in the header block marked superseded; `docs/ui/README.md` pattern and route tables match the app directory

---

## 10. Basis in the codebase

Every blocking finding in section 6 was verified against source before it was accepted. This table is the evidence trail, so a later reader can check the claim rather than trust it, and so nothing here is "fixed" back to its current state.

| Verified defect | Where | Fixed by |
|---|---|---|
| Allowlist and builder have already diverged: `buildExploreSearchParams` emits `tone`, `panels`, `radius`, `near`, none allowlisted | `lib/runtime-hardening/constants.ts`, `lib/map-experience/url-state.ts` | SP-05 |
| `/law`, `/corrections`, `/history/api` and `/submit/api` are matched with empty allowlists, stripping documented params | `apps/web/src/middleware.ts` | SP-05 |
| `/facts` and `/facts/:path*` point at `/history`, which itself is about to move | `apps/web/next.config.mjs` | SP-06 |
| `/map` is the only temporary redirect in the whole set | `apps/web/src/app/map/` | SP-06 |
| The scroll lock keys on `.ds-explore-stage`, which the Atlas no longer renders, while the test asserts stylesheet text by regex and passes anyway | `app/shell.css`, `app/shell-layout.test.ts` | SP-07 |
| `animation-fill-mode: both` with a transform makes the page wrapper the containing block for the fixed plate | `apps/web/src/app/template.tsx` | SP-07 |
| Memorial names are placed at fabricated coordinates, randomised, collision-dropped and faded by the decade scrub | `lib/map-experience/build-memorial-name-features.ts`, `memorial-decade-fade.ts` | SP-08 |
| A record page mounts a second MapLibre instance | `components/entity/EntityLocationMap.tsx` | SP-08 |
| Nothing on the Atlas can hold a `q`: no field on `ExploreFilterState`, none in the allowlist, no text input in the Lens | `lib/map-experience/*`, `components/map-experience/LensPanel.tsx` | SP-09 |
| `StoryMode.tsx` is imported by nothing; `togglePlayback` is empty; `decade-transition.sweep()` has no call site | `components/story/StoryMode.tsx`, `lib/map-experience/decade-transition.ts` | SP-10 |
| `AtlasExperience` renders no `main`, so the skip link dangles | `app/(map)/explore/AtlasExperience.tsx` | SP-07, SP-16 |
| `/memorial` has zero inbound hrefs anywhere in `src`; plate names are glyphs in an `aria-hidden` canvas | `apps/web/src` | SP-15 |
| `rankRecords` scores name and place only, so topical vocabulary returns nothing | command palette ranking | SP-15 |
| `LensPanel` contains zero occurrences of `topic` | `components/map-experience/LensPanel.tsx` | SP-16 |
| `[data-density]` and `[data-motion]` are written to `<html>` with no CSS rules anywhere; `layers.labels` is read by no code | Atlas toggles, `atlas.css` | SP-16 |
| `isTypingTarget` checks `tagName` and `isContentEditable` only, which is none of WCAG 2.1.4's three mechanisms | `lib/keyboard/*` | SP-17 |
| `ShortcutSheet` and `CollectionsDrawer` claim `aria-modal` without trapping Tab or setting `inert` | `components/patterns/*` | SP-17 |
| Action toasts auto-dismiss at 6000ms behind a polite live region | `components/patterns/toast-stack.ts` | SP-17 |
| `isMoveAllowed` returns true for every move whenever no record is selected | `lib/map-experience/camera-dignity.ts` | SP-18 |
| `prefersReducedMotion()` is a one-shot read with no change listener | motion helpers | SP-18 |
| The memorial wall auto-plays indefinitely with `prefers-reduced-motion` as its only mitigation | `components/patterns/memorial-wall/*` | SP-18 |
| `buildStaticPageMetadata` has zero callers outside its own test | `lib/seo/metadata-builders.ts` | SP-19 |
| The sitemap lists `/history` twice with conflicting `changeFrequency` and `priority` | `app/sitemap.ts` | SP-19 |
| `/design-system` is indexable and is one of four exits on the 404 page | `app/design-system/page.tsx`, `app/not-found.tsx` | SP-13, SP-19 |
| `/support` publishes a personal address while `security.txt` uses a role placeholder | `app/support/page.tsx`, `.well-known/security.txt` | SP-13 |
| `AtlasExperience` hardcodes `sources: []` and `connections: []`, so the sheet never shows a source or a connection and the homepage has no route to any chapter | `app/(map)/explore/AtlasExperience.tsx` | SP-20 |
