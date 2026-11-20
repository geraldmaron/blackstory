# BlackStory design direction v11: One World

**Status:** proposed (2026-11-19). Not binding until the owner signs off on the flagship in section 9.
**Supersedes on sign-off:** v10 visual models, `PROTECTED-EXPERIENCES.md` P-01, the visual half of `brand.md`.
**Still binding, unchanged:** P-02 evidence honesty, privacy rules, accessibility law, American English, the dignity rules for names and harm imagery.

## 1. Decisions already made (owner, 2026-11-19)

| Question | Decision |
|---|---|
| Scope | Public web, mobile app, admin, docs and marketing site |
| Rules lifted | Visual identity, Memorial wall protection (P-01), information architecture |
| Immersion model | One persistent world; content stays server-rendered HTML over it |
| Stack | MapLibre first; three.js only where MapLibre cannot draw the effect |
| Floor | Progressive. Text and a static plate paint first; WebGL upgrades capable devices; reduced motion and no-JS get a complete calm version; Core Web Vitals do not regress |
| Imagery | Public-domain and open sources only |
| Generated assets | Abstract only. Never people, places or events |
| Themes | The world is always night. Reading sheets follow the reader's light or dark preference |
| Sound | None |
| Deliverable | This spec, a Codex adversarial review, then one flagship for sign-off before any rollout |

## 2. What the references do, and what we take

Reviewed in a browser on 2026-11-19. Pioneer was scrolled through its first three chapters. Igloo's opening scene was observed; its later scenes did not advance under automated scrolling, so claims about them below are marked.

| Pattern | Pioneer "Corn. Revolutionized." | Igloo Inc. | Verdict for BlackStory |
|---|---|---|---|
| One continuous scene, no page cuts | Scroll flies one camera through DNA strands into a node network into kernels | One terrain with one object; scroll moves through it (later scenes unobserved) | **Take.** The Earth is our scene. Routes become camera states. |
| Chapter headline swaps over a moving scene | Left-anchored display headline and one paragraph per chapter, cross-fading as the camera travels | Not used | **Take** for home and story openers. |
| Chapter rail | Right-edge dots with the current chapter named ("Science") | Not used | **Take** as the era and altitude rail. |
| Dive affordance | A circular "Explore the library" button that opens a side module without leaving the scene | Not observed | **Take.** This is how a record opens over the world. |
| Subject drawn as light | Glowing nodes joined by dotted edges | Numbered points joined by hairlines on the object | **Take, with a rule.** Records are lights. An edge is drawn only for a typed relationship row (P-02). No decorative constellations. |
| Corner-anchored mono HUD | Minimal: logo, menu | Mono text pinned to four corners, no nav bar | **Take.** Replaces the header bar on world surfaces. |
| Transition as optics | Depth of field and bloom between chapters | Chromatic smear on scroll bursts | **Take sparingly.** One optical move per transition, never over text. |
| Loading gate before first paint | Yes | Yes | **Reject.** Violates the progressive floor. |
| Text inside the canvas | Headlines are DOM; scene is canvas | Mostly canvas | **Reject** canvas text. All words are DOM. |
| Scroll hijacking | Scroll is scrubbed, with inertia | Scroll is captured | **Reject** capture. Native scroll drives a timeline; the page always scrolls at the reader's speed. |
| Sound | No | Toggle, off by default | **Reject** (owner decision). |
| Hidden navigation | Hamburger only | None | **Reject.** A history archive needs a visible way to search and to leave the scene. |
| Single linear path | Yes | Yes | **Reject** as the only path. Every scene state has a URL and a list equivalent. |

## 3. Thesis

> **There is one world, and you are always somewhere in it.**

v10 said the relationships are the product and the map is the way through them. v11 keeps that and removes the page. The Earth at night sits behind every public surface. Documented Black history is the light on it. Moving through the site is moving a camera: down toward a place, across to a related record, back up to the country, forward through time.

This rejects three things that exist today.

1. **The map as a rectangle.** The explore plate, the record rail embed, the story inset and the room slot are four presentations with three attribution treatments (`.impeccable/cohesion/assessment.md` section 3). The code has two map constructors: the persistent `MapStage`, which already survives every client navigation and serves framed slots, and `RecordMap` for embeds. v11 is a posture and visibility redesign of the first and the removal of the second. It is not new persistence.
2. **The document as the default.** Most routes are paper sheets on an ink table with the map absent. v11 inverts it. The world is the ground; a sheet is something you opened over it.
3. **The flat national plate.** A Mercator rectangle of the lower 48 frames the subject as a county map. A globe with terrain and real imagery frames it as places on Earth.

## 4. The world

### 4.1 Altitudes

The camera has four named altitudes. Each is a URL class, a camera recipe and a sheet posture.

| Altitude | Routes | Camera | What is lit | Sheet |
|---|---|---|---|---|
| **Orbit** | `/` | Globe, slow drift, atmosphere visible, night side | Every published record as one field of light. Not weighted by count. | None. Headline and search only. |
| **Country** | `/explore`, index routes (`/records`, `/stories`, `/law`, `/books`, `/data`, `/lives`) | Globe eased to North America, slight pitch | The current result set; everything else dims to 20 percent | Index as a left sheet; the list and the lights are the same set |
| **Ground** | `/place/*`, record detail routes | A still, pitched frame with terrain and imagery, for site-precision records only. No orbiting: MapLibre 5.24 does not support easing around a point on the globe. | The record, its typed neighbors, and labeled edges between them | Record as a right sheet; geography stays visible |
| **Reading** | `/stories/*` | Camera parks at the story's current place, heavily dimmed | Only places the paragraph in view names | Centered reading sheet, light or dark by preference |
| **Parked** | Trust, legal, utility, forms | No canvas rendered (the existing parked posture) | Nothing | Full-width document on the night ground color |

**Precision governs the camera (P-03).** Only a record stored at site precision gets the pitched Ground frame and a point. A campus, neighborhood, city, county or state record is drawn as its area at a flat camera no closer than its precision allows, using the existing `zoomForLocationPrecision` and `recordMarkFor` rules, and the sheet says the location is approximate. Records with no coordinate (many people, laws, books) get no pin. They open on the jurisdiction or the related places, labeled as such, or at Country when nothing spatial is sourced.

**Darkness is not absence.** A field of light reads as "this is where Black history happened", and unlit ground reads as "nothing happened here". Both are false: light is where this archive has published a record so far. Controls:

- Brightness is never weighted by record count, grade or importance.
- Orbit and Country carry a standing line in the chrome, "Lights show records published so far. Unlit places are not yet researched.", linking to the coverage method.
- The coverage-gap layer (catalog-relative gaps the research side already computes) is one toggle away at Country.
- Harm-related records get no camera motion beyond a cut, and no glow treatment (P-04).
- "Read as documents" is a persistent, remembered choice in the menu that parks the world on every route. The document fallback has to exist anyway; this exposes it.

### 4.2 Time

Time is the second axis and sits on the right-edge rail (the Pioneer chapter rail). Dragging it relights the world. A record is lit when its stored date range overlaps the window; a record with an uncertain or missing date stays lit and is listed as undated, never dropped. Period imagery is a separate, reader-chosen layer (section 6). It is never swapped in automatically and never substituted by the nearest year. The imagery's own date is printed beside the event date, so a 1950 topo sheet is not mistaken for a picture of a 1921 event.

### 4.3 Movement

- Route changes animate the one camera. No white flash, no remount. `MapStage` is already mounted once in `SiteShellProviders`; v11 makes it the stage for every public route instead of two.
- Home and story openers use native scroll to scrub an authored camera path (CSS scroll-driven animations where supported, an `IntersectionObserver` step fallback elsewhere). Scroll is never captured.
- Nothing animates over body text. The focus pull is cut (it needed a scene depth buffer MapLibre does not share).
- A visible "Hold still" control stops all camera motion for the session. Reduced motion sets it by default: camera cuts instead of flying; scrub becomes stepped stills.

### 4.4 Chrome

The header bar goes away on world surfaces. Four corners carry the chrome in mono caps.

| Corner | Holds |
|---|---|
| Top left | Wordmark, and the current location in words ("Orbit", "Alabama", "Selma, 1965") which is also the breadcrumb |
| Top right | Search (always visible, always one key away) and the four destinations in words (Map, Records, Stories, Collections). No hamburger on desktop. |
| Bottom left | Imagery credit and date, one treatment everywhere |
| Right edge | Time rail |

Glass is used for sheets only, with a solid fallback. Controls are not glass.

### 4.5 Rendering stack

| Layer | Tech | Notes |
|---|---|---|
| Globe, sky, atmosphere, terrain, imagery, labels, pins | MapLibre GL JS 5 (installed, `^5.24.0`) | Globe projection and sky shipped in 5.0 per MapLibre docs. Terrain on globe needs a spike. |
| Record light field, relationship edges | MapLibre circle (with blur) and line layers | Native layers are the default. three.js is not in the flagship. A custom layer on the globe cannot use a plain three.js camera: the globe projection is nonlinear, so shaders must take MapLibre's projection inputs and handle the globe-to-Mercator transition and horizon clipping. It is added later only for a named effect native layers demonstrably cannot draw. |
| Scroll timeline | CSS `animation-timeline` with step fallback | No GSAP, no Lenis. |
| First paint | Server-rendered HTML plus one pre-rendered night-globe still (AVIF) | The canvas fades in over the still. No loader. |

## 5. Identity

The world supplies the palette, so the identity is rebuilt around light on dark ground.

- **Ground:** night Earth. Near-black with a blue atmospheric rim. Replaces the ink table.
- **Light:** one warm emission color for records (the existing copper, pushed brighter into an ember). It is the only saturated color in the world, so every warm point on screen is a record.
- **Evidence in light:** brightness never encodes evidence grade or importance. Light means "published record here" and nothing more. Grade stays a glyph and a word in the sheet.
- **Sheets:** paper in light mode, graphite in dark. The only place long text lives.
- **Type:** keep Schibsted, Geist, Newsreader and Geist Mono. Tested against replacing them. The families are not what makes the current site feel like documents; the layout is. Mono takes the new HUD role.
- **Removed:** copper and sand bands, the sheet spine, plated photo frames, per-page mastheads with a giant numeral, the paper flag on pins, the three attribution styles.

## 6. Imagery and mapping sources

Only the first two rows are in production today. Every other row is a candidate whose license and endpoint must be opened and read during the flagship spike before any code depends on it.

| Layer | Source | Status |
|---|---|---|
| Vector base, glyphs | OpenFreeMap (OpenMapTiles schema, OSM data) | In use (`explore-style.ts`) |
| Aerial imagery, US | USGS National Map imagery | In use (`USGS_IMAGERY_TILE_URL`) |
| Globe-scale imagery | NASA GIBS (Blue Marble, and VIIRS night lights as a reference texture only) | Needs validation. Night lights must not be shown as if they were our data. |
| Globe-scale cloudless imagery | EOX Sentinel-2 cloudless | Needs validation. Used in MapLibre's own globe example; some yearly editions carry a non-commercial license. |
| Terrain DEM | Mapterhorn or AWS Terrain Tiles (Terrarium) | Needs validation. |
| Period maps | USGS Historical Topographic Map Collection (about 180,000 sheets since 1884) | Needs validation. The scans are public domain; the convenient tile service is hosted by Esri, which may fall outside "open only". Self-hosting a mosaic for flagship places is the fallback. |
| Period aerials | USGS EROS aerial archive, USDA NHAP | Later. No ready tile service found. |
| Period boundaries and streets | OpenHistoricalMap vector tiles | Later. Coverage for our places unknown. |
| Rejected | Esri Wayback, MapTiler, Mapbox, Google | Vendor terms or cost; excluded by the imagery decision. |

**Rights register.** Before any candidate layer ships, a register row records the exact edition and endpoint, its license, attribution text, and whether redistribution, self-hosting and screenshots are allowed. Self-hosting does not cure a license restriction. Known so far from the Codex review, each to be confirmed by opening the source: EOX licenses its 2018 and later editions non-commercial share-alike and only 2016 as CC BY; Mapterhorn and AWS terrain inherit the terms of their constituent sources; OpenHistoricalMap has feature-level exceptions to CC0; USGS imagery mixes sources and acquisition dates; modern US Topo has copyright exceptions that the historical collection does not.

Self-hosting path where the license allows it: PMTiles extracts for flagship places. Whether Supabase storage serves range requests with usable CORS and egress cost is unverified.

## 7. Every surface

| Surface | Today | v11 |
|---|---|---|
| Home `/` | Door sheet over a flat plate, tour scroll | Orbit. Scroll descends through four authored stops (the field of light, an era, a place, a relationship) and lands in Country. |
| Explore | Flat plate, column, histogram dock | Country. Column becomes the left sheet; histogram becomes the time rail. |
| Indexes (records, stories, law, books, data, lives, rooms, collections) | Sheets on ink, no map | Country with the index as the left sheet. Hovering a row lifts its light; the list is the accessible equivalent of the lights. |
| Place and record detail | Document with a rail map embed | Ground. Right sheet. Embed deleted. Typed neighbors are lit and listed. |
| Law, book, invention detail | Document | Ground at the jurisdiction or related places when sourced; otherwise Country. |
| Stories and chapters | Reading sheet, optional inset map | Reading. The camera follows the paragraph in view. Inset deleted. |
| Memorial | Handwritten wall, protected | See 7.1. |
| Data | Charts on sheets | Country. A chart selection relights the globe by the same measure; the chart stays the source of truth. |
| Trust and legal (about, methodology, sources, faq, errata, privacy, terms, support) | Sheets | Parked. New identity, no canvas. |
| Submit, corrections, receipts, locate | Sheets | Parked. Task completion beats atmosphere. |
| 404, record not found, error, maintenance | Copper band | Orbit over open ocean with the message and search. |
| Mobile app | React Native with a native MapLibre wrapper (UI kit not verified for this spec) | Same identity and altitudes. MapLibre Native reportedly lacks globe, terrain and sky, so Orbit is a pre-rendered globe still that hands off to a flat map. Needs a device demonstration before anything is committed. |
| Admin | Dense editor tooling | Identity only (ground, type, ember accent). No world, no motion. Speed and legibility win. |
| Docs and marketing site | Own shell | Identity only, plus the night-globe still as the hero. No WebGL. |

### 7.1 Memorial

The owner already opened P-01 on 2026-11-12 on the condition that the handwritten names fading in and out stay. That condition holds here, as do the dignity rules. Names stay names. No pins, no counters, no harm imagery, no engagement mechanics.

Proposal: the Memorial is the one place the camera looks up. From Orbit the view tilts away from Earth to a dark sky, and the handwritten names are that sky. The existing wall field is the content; what changes is that it is reached inside the world instead of on a separate page, and it is the only surface with no light on the ground. The accessible names list stays below as real HTML.

This is the highest-risk idea in the document and is not part of the flagship. It gets its own review with the owner.

## 8. Generated assets (Codex)

Abstract only. Each asset is committed with a manifest line giving the tool, the prompt and the date, and is never placed where a reader could take it for a photograph or a map.

| Asset | Use |
|---|---|
| Night-globe still, rendered from the real scene | First paint, social cards, mobile Orbit, docs hero. A capture of our own renderer, not generated. |
| Film grain and paper fiber tiles | Sheets |
| Glow and bokeh sprites | Record lights, focus pull |
| Star field | Sky behind the globe and the Memorial. Procedural preferred over generated. |

No generated terrain, skyline, portrait, building or scene.

## 9. Flagship and acceptance

One path, built on a new local branch, not pushed: **Orbit home, descend to Country, open one place at Ground, follow one typed edge to a second place.**

It is done when all of these are observed in the running app with live published data.

1. `/` paints headline, search and the globe still with JavaScript disabled.
2. With WebGL, the globe replaces the still with no layout shift and no loader.
3. Scrolling home moves the camera through four stops and never traps the wheel; reduced motion gives four stills.
4. Navigating `/` to `/explore` to `/place/{slug}` to a neighbor reuses one map instance (one WebGL context, verified in the console).
5. Every lit point corresponds to a published record; every drawn edge to a typed relationship row; the list in the sheet matches the lights.
6. Keyboard only: search, open a record, move to a neighbor, return to Country.
7. Imagery credit and date are present and correct at every altitude.
8. LCP, CLS and INP on `/` and one `/place/*` are no worse than the current branch, measured the same way before and after.
9. Checked at the nine window shapes the project already audits, including 768 and tall mid-width.
10. On a device without WebGL, and with "Read as documents" on, the same path completes as documents.
11. Cold deep link to `/place/{slug}` and browser back and forward restore the right camera and sheet.
12. Failure paths: tile host blocked, WebGL context lost, a record with no coordinate, a city-precision record (drawn as an area, flat camera), and a dense overlap of records all behave as specified.
13. A screen reader completes the path from the sheets alone; 200 percent zoom and 320 px reflow hold; reading sheets pass in both themes.
14. Soak: 50 navigations with no growth trend in JS heap or GPU memory, and the canvas stops rendering when idle or parked.
15. Compared with the current branch on three tasks (find a named record, read its evidence, copy its citation), the flagship takes no more steps and no more time. This is the test of the alternative in section 12.

Web vitals for criterion 8 are lab runs, five each, median, on one throttled mid-tier phone profile and one desktop profile; "no worse" means within 5 percent.

## 10. Rollout after sign-off

1. Indexes and remaining record types.
2. Stories at Reading altitude.
3. Time rail with period imagery for flagship places.
4. Trust, utility and error surfaces.
5. Mobile.
6. Admin, docs and marketing site (identity only).
7. Memorial, after its own review.

Doc cleanup rides with each phase: v10, `PROTECTED-EXPERIENCES.md` P-01 and the pattern docs are amended in the same change that replaces the surface, so no binding document describes a removed design.

## 11. Risks

| Risk | Control |
|---|---|
| Spectacle reads as disrespect for the subject | Light means presence only; no scores; trust, utility and Memorial surfaces have no camera motion; owner reviews the flagship before rollout |
| A globe hides dense local detail (most records are US, many in a few cities) | Country altitude is the working view; Orbit is an entrance, not a tool |
| WebGL cost on phones and old laptops | Still-first paint, lazy three.js, capability check, document fallback is a complete product |
| SEO regression | All content and every link stay server-rendered. The map is content, not decoration, so everything it shows has an HTML equivalent in the sheet; sitemap and structured data untouched |
| Light is read as where history happened, darkness as where it did not | Section 4.1 "Darkness is not absence" controls; reader testing of that interpretation before rollout, not only owner approval |
| Period imagery misread as evidence | Imagery date and source printed at all times; imagery never cited as a claim source |
| Third-party tile endpoints change terms or vanish | Validate licenses in the spike; PMTiles self-host path for flagship places |
| One map instance across all routes leaks memory or state | Flagship criterion 4 plus a soak test of 50 navigations |
| Scope (four apps, about 70 screens) | Flagship gate; identity-only treatment for admin, docs and site |

## 12. Adversarial review

Codex (read-only, 2026-11-19) reviewed the first draft and returned **reject**. Findings and what was done:

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | The globe makes catalog coverage look like historical presence | Blocker | Accepted. Count weighting removed; standing coverage line, gap layer, no glow or motion on harm records, "Read as documents", reader testing (4.1, 11). |
| 2 | "Four maps" and "instead of two" misdescribe the code | Major | Accepted and corrected (3). Checked: two constructors exist, `MapStage.tsx:1402` and `RecordMap.tsx:357`. |
| 3 | three.js is justified by chosen effects, not needs; globe custom layers need projection-aware shaders | Major | Accepted. three.js and the focus pull are out of the flagship (4.3, 4.5). |
| 4 | Orbit around a pin is unsupported on the globe; mobile claims unverified | Major | Accepted. Ground is a still frame; mobile row marked unverified (4.1, 7). |
| 5 | Coordinates treated as sufficient precision; nearest-period imagery and "active in window" undefined | Blocker | Accepted. Precision governs the camera; date-overlap rule; imagery never auto-swapped (4.1, 4.2). |
| 6 | "Open" does not settle licensing | Major | Accepted. Rights register required before any new layer (6). |
| 7 | Acceptance rewards the happy path | Major | Accepted. Criteria 11 to 15 and a measurement rule added (9). |
| 8 | The spec reintroduces hidden nav, attention-taking motion, and cost on non-spatial pages | Major | Accepted. Destinations visible, "Hold still", trust and utility pages parked (4.1, 4.3, 4.4, 7). |
| 9 | Alternative: keep documents full-width, expose the map only for exploration and requested context, compare before committing | Major | Not adopted as the direction; the owner chose one world. Its test is adopted as criterion 15, and "Read as documents" ships that alternative as a reader choice. |

**Standing disagreement.** Codex's verdict on the thesis is reject. This document's position is accepted with controls: the two blockers are answered in the spec, and the flagship is the validation. If criterion 15 or reader testing of "darkness is not absence" fails, the alternative in row 9 becomes the direction.

## 13. Flagship status (2026-11-20, second pass)

Branch `redesign/v11-one-world`, local, uncommitted. Checked in the dev server against live published data with the browser pane visible, at 1440 by 900, 768 by 1024 and 375 by 812.

| # | Criterion | Status |
|---|---|---|
| 1 | No-JS home paints headline, search, globe still | Partly. A drawn night disc with the atmosphere rim holds the globe's place until the plate paints, and stays without JavaScript. It has no continents or lights; a captured still of the real scene is not made. The no-JS path itself was not loaded with scripting off. |
| 2 | Globe arrives with no loader and no shift | Observed: the globe fades into the disc's outline. The disc is a few pixels larger than the globe. |
| 3 | Home scroll moves the camera, never traps the wheel | Observed, using the existing five-record tour as the stops. The four authored stops in section 7 are not written. |
| 4 | One map instance across the path | Observed for `/` to `/place/*` and back: same map object, one canvas, no context loss. |
| 5 | Every light is a record, every edge a typed row | Lights observed. **Edges cannot be shown with today's data.** 204 of 4,403 published records carry relationships and 35 of those are mapped, but the record loader keeps only relationships that carry a citation (`retainCitedRelationshipViews`), and the located pairs checked had none, so no record page lists a connection and no edge is drawn. That filter is P-02 doing its job. Edges wait on cited relationships, which is research work, not interface work. |
| 6 | Keyboard-only path | Partly. Focus moves through a record page with a visible outline. The full path was not walked by keyboard. |
| 7 | Imagery credit and date at every altitude | Ground: a caption names USGS and says the imagery's date varies and is not the record's. USGS imagery has no single date to print. Orbit and Country use no imagery and keep the existing attribution control. |
| 8 | Web vitals no worse | **Passes on a production build with a real GPU for load, map-ready and layout shift; phone blocking time is 38 to 114 ms higher.** See section 14.2. Sections 14 and 14.1 are dev-build numbers and overstate the globe's cost. |
| 9 | Nine window shapes | Three of nine: 1440 by 900, 768 by 1024, 375 by 812. No horizontal overflow at any. On a phone the globe is a horizon under the opening. |
| 10 | Completes as documents | Observed with "Read as documents" on: no canvas on home or a place, content intact. |
| 11 | Cold deep link, back and forward | Cold `/place/*` and one back step observed. Forward not checked. |
| 12 | Failure paths | A city-precision record (African Meeting House, Allensworth) is framed flat at zoom 10 on the plain plate, as specified. Tile failure, context loss and dense overlap not run. |
| 13 | Screen reader, zoom, both themes | Light theme observed: the world stays night, the record sheet is paper. Screen reader and 200 percent zoom not run. |
| 14, 15 | Soak, task comparison | Not run. |

Also built: Explore on the globe, the coverage line on the opening, "Hold still" (observed: a place arrives in two camera frames instead of a flight) and "Read as documents", corner chrome on home in both themes.

The right sheet is built (third pass). From 72rem a grounded record keeps the world on the left for the whole read, with the name pinned at its foot, and the record scrolls as one column on the right; the camera frames the pin in the uncovered part. Observed at 1440 and 1152 wide, in both themes, for a site-precision and a city-precision record. Below 72rem the sheet is laid over the world as before. The camera is not reframed if the window is resized across 72rem after load.

Not in the flagship though the spec describes them: the time rail, terrain, period imagery, the Memorial, mobile, admin, docs and generated assets. Explore's left column is unchanged from before this work.

Found on the way:

- MapLibre's globe tears line and text layers below zoom 2, so they stand down there.
- `renderWorldCopies: false` clamps a world-scale center, so it is removed on the stage.
- A hidden browser pane throttles the map; earlier "20 to 30 second" load readings came from that and are withdrawn.
- Place pages show no "Connected records" today for the reason in row 5.

## 14. Performance against the old code (2026-11-20)

Method: headless Chromium (Playwright, the project's own install) against the same dev server, old code and new code in turn, one warmup then five runs per case, medians. Desktop is 1440 by 900 unthrottled; phone is 390 by 844 with 4x CPU throttling. "Map ready" is when the plate reports its first painted frame. This is a development build with software WebGL, so the absolute numbers are not production numbers; the comparison is like for like. Production web vitals are still unmeasured.

| Case | Metric | Old | New | Verdict against "within 5 percent" |
|---|---|---|---|---|
| Home, desktop | LCP | 360 ms | 368 ms | Pass |
| | Map ready | 839 ms | 785 ms | Pass |
| | Blocking time | 197 ms | 392 ms | **Fail**, about double |
| | CLS | 0.017 | 0 | Better |
| Home, phone | LCP | 480 ms | 456 ms | Pass |
| | Map ready | 1,778 ms | 1,857 ms | Pass (4 percent) |
| | Blocking time | 471 ms | 775 ms | **Fail**, about 65 percent more |
| | CLS | 0.065 | 0 | Better |
| Place, desktop | LCP | 872 ms | 1,492 ms | **Fail**, though old runs ranged 696 to 1,900 |
| | Map ready | 834 ms | 1,293 ms | **Fail**, about 55 percent more |
| | Blocking time | 708 ms | 476 ms | Better |
| | CLS | 0 | 0.035 | Worse, still under the 0.1 "good" line |
| Place, phone | LCP | 960 ms | 620 ms | Better |
| | Map ready | 1,653 ms | 1,977 ms | **Fail**, about 20 percent more |
| | Blocking time | 432 ms | 739 ms | **Fail**, about 70 percent more |
| | CLS | 0.006 | 0.008 | Same |

JavaScript transferred is unchanged (2,108 KB to 2,110 KB on home in dev). A site-precision place page makes 160 requests where it made 46, which is the aerial imagery.

What the measurement changed:

- **Phone home layout shift fixed.** The first measurement had CLS 0.123, over the "good" line. The phone layout reserved 12rem for an opening that is now about 21.5rem tall; the reserve is corrected and CLS is 0.
- **Home map-ready time recovered.** It was 1,135 ms on desktop. The state land and tint fills cost about half a second to drape over the sphere, for a shape the background already paints. They now stand down below zoom 2 with the line and text layers.
- **The globe itself is the remaining cost.** With the projection switched back to Mercator and nothing else changed, home blocking time was 130 ms and map ready 748 ms. The globe projection accounts for the blocking-time regression.
- **Ruled out:** rebuilding the lights data on every patch. It is memoized now, which is right, but it did not move the number.

Open:

- Blocking time on the globe. Options are to accept it, to open in Mercator and switch to the globe after first paint, or to test on real GPU hardware, where it may differ from software WebGL.
- Place map-ready time, which is imagery tiles. An option is to paint the plain plate first and fade imagery in.
- The place page's 0.035 shift on desktop. Rail content moves once during load; the cause is not found.

### 14.1 Opening flat, then the globe (later the same day)

Tried as asked: load every surface flat and switch to the globe before the reveal. Same method as above.

| Case | Metric | Old | Globe from load | Flat everywhere | Per surface (kept) |
|---|---|---|---|---|---|
| Home, desktop | Blocking time | 197 ms | 392 ms | 468 ms | 388 ms |
| | Map ready | 839 ms | 785 ms | 2,133 ms | 770 ms |
| Home, phone | Blocking time | 471 ms | 775 ms | 897 ms | 755 ms |
| | Map ready | 1,778 ms | 1,857 ms | 3,284 ms | 1,818 ms |
| Place, desktop | Blocking time | 708 ms | 476 ms | 148 ms | 160 ms |
| | Map ready | 834 ms | 1,293 ms | 2,299 ms | 728 ms |
| Place, phone | Blocking time | 432 ms | 739 ms | 486 ms | 491 ms |
| | Map ready | 1,653 ms | 1,977 ms | 2,837 ms | 1,358 ms |

Flat everywhere made home worse: the globe has to be built either way, so the work only moved, and the reveal waited more than a second longer for it. It did cut blocking on place pages, where the camera is near the ground and the curve cannot be seen.

Kept: the Door and Explore open as the globe. A record page opens flat, is revealed at once when its frame is at zoom 8 or closer, and becomes the globe in idle time afterwards, where the switch cannot be seen. A record framed wider than zoom 8 switches before its reveal. Going from a cold place page to home on the real GPU gave the globe on the same map instance.

Where that leaves criterion 8: place pages now beat the old code on blocking time on desktop and on map-ready time on both; phone blocking is 14 percent over. Home blocking time is still about double on desktop and 60 percent over on phone, and that is the cost of the globe itself. Place pages over imagery make more requests than before (250 on desktop in the last run).

### 14.2 Production build (2026-11-20)

Method: `next build` of the old code and of the new code into separate output folders, each served with `next start` against the live published database, measured with Chromium using the machine's GPU (Apple M5 Pro, Metal). One warmup then five runs, medians. Desktop is 1440 by 900 unthrottled; phone is 390 by 844 with 4x CPU throttling. Local server, so network time is not representative.

| Case | Metric | Old | New |
|---|---|---|---|
| Home, desktop | LCP | 296 ms | 292 ms |
| | Map ready | 612 ms | 604 ms |
| | Blocking time | 0 ms | 0 ms |
| | CLS | 0.020 | 0 |
| Home, phone | LCP | 396 ms | 400 ms |
| | Map ready | 1,207 ms | 1,222 ms |
| | Blocking time | 184 ms | 222 ms |
| | CLS | 0.065 | 0 |
| Place, desktop | LCP | 808 ms | 680 ms |
| | Map ready | 696 ms | 555 ms |
| | Blocking time | 0 ms | 0 ms |
| | CLS | 0 | 0.035 |
| | Requests | 59 | 250 |
| Place, phone | LCP | 732 ms | 248 ms |
| | Map ready | 1,018 ms | 890 ms |
| | Blocking time | 66 ms | 180 ms |
| | CLS | 0.006 | 0.008 |
| | Requests | 56 | 149 |

JavaScript transferred is 543 KB old and 544 KB new on home, 520 KB and 527 KB on a place page.

The same builds under software WebGL show the gap the dev measurements showed (home desktop blocking 209 ms old, 422 ms new; home phone 354 ms and 691 ms). The globe's blocking cost is mostly a software-rendering cost. On a real GPU it is 0 ms on desktop and 38 ms on a 4x-throttled phone profile.

Open after this:

- Phone blocking time on a place page is 114 ms higher than the old code.
- A site-precision place page makes about four times the requests, which is the pitched aerial imagery. Not investigated.
- The 0.035 layout shift on desktop place pages.
- Devices without a usable GPU fall back to software rendering, where the globe does cost about 200 to 340 ms more blocking on home. How many readers that is has not been measured.
- This is a lab run on one fast machine. Field data from real phones does not exist yet.

### 14.3 Imagery requests on a place page (2026-11-20)

A site-precision place page (Amherst West Cemetery) loaded cold on the dev server, counted in Chromium on the real GPU. The dev server adds about 50 requests of its own to every count, so compare the columns, not the absolutes.

| | Before | After |
|---|---|---|
| Desktop, 1440 by 900, all requests | 297 | 136 |
| Desktop, imagery tiles | 181 | 55 |
| Phone, 390 by 844, all requests | 243 | 83 |
| Phone, imagery tiles | 147 | 14 |
| Home to place by link, imagery tiles | 135 | 55 |

What cut it:

- **Imagery waits for the camera.** It is switched on only once the frame has landed. Before, it was fetched for the national frame the plate is built at and for every zoom the descent passed through.
- **A cold arrival is a cut, not a flight.** There is nowhere to fly from, so the frame lands as soon as the plate exists.
- **The tilt is 45 degrees, down from 55.** A tilted view reaches toward the horizon and fetches imagery for all of it.
- Because imagery now starts after the plate has become the globe, the far ground uses the globe's coarser tiles.

Tried and dropped:

- MapLibre's tile level-of-detail setting changed the count by about 10 percent at best.
- Requesting imagery at half resolution cut tiles by two thirds but was visibly soft on a retina screen.

The descent from home now runs over the plain plate and the imagery arrives after it. Production timings in 14.2 were taken before these changes and have not been repeated.

## 15. Time rail (2026-11-20)

Built on the home globe at 64rem and wider. An upright slider on the right edge of the map window, the decade above it and the count of lights below. Its top is "All time". Moving it relights the globe; a reset button returns to all time. The globe is framed clear of the rail.

Observed in Chromium on the real GPU, driven by keyboard: at "All time" the readout is 4,393 records with 280 undated; through the 1940s it is 3,654; through the 1820s it is 623. The lights on the globe thin out to match, the slider's value text and the page's live region say the same sentence, and the featured-record callout stands down while the rail is set. No page errors and no horizontal overflow.

How it differs from section 4.2:

- **Lit means "first documented by this decade", not "date range overlaps the window".** The home page's pins carry one number each, their earliest decade, so an overlap test is not possible without sending every record's full date range to the home page. A record first documented in the 1860s stays lit at every later position.
- **It is one handle, not a window.** There is no start of the range to drag.
- **Undated records stay lit and are counted**, as specified. They are 280 of the 623 lights at the 1820s, so early positions look fuller than the dated record supports. The readout says so.
- **Home only.** Explore keeps its own decade histogram. Place pages have no rail, and period imagery (the other half of 4.2) is not built.
- **Wide screens only.** Below 64rem the globe is a strip and "Walk the decades" is the way through time.

Pointer drag, reduced motion and light-theme contrast were checked later the same day (section 16). A screen reader and touch drag were not.

## 16. Accessibility pass (2026-11-20)

Run in a real browser on a real GPU against the dev server, on the home page, Explore and one
place page (`/place/amherst-west-cemetery`). The repo's own axe lane runs in jsdom and says of
itself that it cannot see painted contrast, layout, focus or motion, so this pass covers those.

### What was measured

| Check | How | Result after fixes |
| --- | --- | --- |
| axe-core 4.14, WCAG 2.0 to 2.2 A and AA plus best practice | 15 runs: three pages, dark and light, desktop and phone, and documents mode | 0 violations |
| Text contrast against the painted page | Text hidden, page screenshotted, each text color compared with the pixels behind it (map, gradients and imagery included); 10th-percentile pixel per text run | 232 text runs in the first viewport, 0 below 4.5 to 1 (3 to 1 for large text); lowest 6.1 to 1 |
| Keyboard order and focus | Tab through each page at 1440 and 390 wide; record order, focus ring, and whether the focused element is covered | No stop without a ring, none fully hidden |
| Reduced motion | `prefers-reduced-motion: reduce`, camera `move` events counted for 6 s after the map attaches, running animations listed | At most 1 camera frame per page, no running animation |
| Zoom and reflow | 320 by 256 (a 1280 by 1024 screen at 400%) and 720 by 450 (1440 by 900 at 200%) | No sideways scroll on any page |
| Time rail | Accessibility tree, mouse drag, click on the track | Exposed as a named slider; drag and click both relight the map and update the readout |

### What it found, and the fix

1. **The reader switches were the last two stops on the page.** "Hold still" and "Read as
   documents" came after the footer, about 60 tabs in, and sat outside every landmark. They now
   follow the header in the tab order and are a named region, "Map display".
2. **The map credit could not be opened by mouse or touch on any place page.** The masthead lay
   over it. The masthead's empty parts now pass the pointer through, as the home page's do. The
   map is locked on place pages, so nothing else responds, and a swipe still scrolls the page.
3. **The map credit was covered outright in two places.** On the desktop home page it sat under
   "Read as documents"; on a phone place page it sat under the tab bar. The switches now stand
   beside the credit on the home page. Below 72rem a place page carries the credit at the top
   left of the map, beside the imagery caption, which steps aside while the credit is open.
4. **At 400% zoom, fixed pieces covered the content.** The switches sat on the home headline's
   main action, and the imagery caption sat on the place name. In a window under 20rem tall the
   switches now show only when focused, as a skip link does. Under 30rem tall the caption takes
   its own row, and the home page's featured-record label is hidden instead of sitting behind
   the headline.
5. **Keyboard focus could land under the phone tab bar.** The root now carries scroll padding
   for the bar, and the home footer clears it. Both predate v11.
6. **Explore's place search declared `aria-expanded` without a role that allows it** (axe:
   critical), and its focus was a border tint. It is now a `combobox` with the standard focus
   ring. This also predates v11.

### What this pass does not show

- **No screen reader was run.** The accessibility tree was read, which is not the same as
  VoiceOver or NVDA reading the page.
- **Explore's place search is a combobox in name only.** Suggestions are reached with Tab, not
  the arrow keys a combobox promises.
- **Phone and tablet place pages have no reader switches.** That was a layout decision from the
  side-sheet pass. The switches are on the home page, and the system's reduced-motion setting
  is honored everywhere.
- **Hiding the switches at 400% zoom costs mouse users the switches at that zoom.** Keyboard
  and assistive technology still reach them.
- **Contrast was sampled in the first viewport of each page only.** Text further down sits on
  paper or ink grounds that the token contrast test already covers.
- **One place page was tested.** A record with a long name, no image, or city-level precision
  was not re-run in this pass.
- Related neighbors on a place page still cannot be chosen by clicking the map. The map is
  locked there.
