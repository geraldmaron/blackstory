# BlackStory design direction v11: One World

**Status:** binding (2026-11-20). The owner signed off on the flagship and started the rollout in section 10 on 2026-11-20. The sign-off was given with acceptance criteria 14 and 15 and the reader test of "darkness is not absence" still unrun; they stay open in section 21 and can still reverse the direction (section 12). Section 20 is the account of what was built at sign-off; section 21 tracks the rollout.
**Supersedes:** v10 visual models, `PROTECTED-EXPERIENCES.md` P-01, the visual half of `brand.md`.
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

Reviewed in a browser on 2026-11-19 and again on 2026-11-20. Pioneer "Corn. Revolutionized." (Resn and Bader-Rutter, 2020) is at `https://cornrevolution.resn.global/`, Resn's archive of the site; it was scrolled through its first three chapters. Igloo Inc. is at `https://www.igloo.inc/`; its opening scene was observed, and its later scenes did not advance under automated scrolling on either date, so claims about them below are marked. The owner refers to a third reference site whose address is not recorded here.

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
- "Read as documents" is a persistent, remembered choice in the menu that parks the world on every route. The document fallback has to exist anyway; this exposes it. **Withdrawn in code on 2026-11-20** (`aa6891791`): the switch is gone and a saved choice is cleared on load. Documents mode now applies only where WebGL is unavailable. Whether the control returns is an open owner decision (section 20).

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
10. On a device without WebGL, and with "Read as documents" on, the same path completes as documents. (The switch was removed on 2026-11-20, so only the no-WebGL half can be tested today. See section 20.)
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

**Rows 1 and 9 are weaker than written (2026-11-20).** Both dispositions count "Read as documents" among their controls, and that switch has since been removed from the code. Row 1 keeps its other controls. Row 9's alternative is no longer shipped as a reader choice. Neither criterion 15 nor the reader test has been run.

## 13. Flagship status (2026-11-20, second pass)

This table is the second pass as it stood. Later passes changed some rows: the work is now committed, eight window shapes were swept (section 17), and "Read as documents" was removed, which undoes the observation in row 10. Section 20 has the current state.

Branch `redesign/v11-one-world`, local, uncommitted. Checked in the dev server against live published data with the browser pane visible, at 1440 by 900, 768 by 1024 and 375 by 812.

| # | Criterion | Status |
|---|---|---|
| 1 | No-JS home paints headline, search, globe still | Partly. A drawn night disc with the atmosphere rim holds the globe's place until the plate paints, and stays without JavaScript. It has no continents or lights; a captured still of the real scene is not made. The no-JS path itself was not loaded with scripting off. |
| 2 | Globe arrives with no loader and no shift | Observed: the globe fades into the disc's outline. The disc is a few pixels larger than the globe. |
| 3 | Home scroll moves the camera, never traps the wheel | Observed, using the existing five-record tour as the stops. The four authored stops in section 7 are not written. |
| 4 | One map instance across the path | Observed for `/` to `/place/*` and back: same map object, one canvas, no context loss. |
| 5 | Every light is a record, every edge a typed row | Lights observed. **Edges cannot be shown with today's data.** 204 of 4,403 published records carry relationships and 35 of those are mapped, but the record loader keeps only relationships that carry a citation (`retainCitedRelationshipViews`), and the located pairs checked had none, so no record page lists a connection and no edge is drawn. That filter is P-02 doing its job. Edges wait on cited relationships, which is research work, not interface work. |
| 6 | Keyboard-only path | Partly. Focus moves through a record page with a visible outline. The full path was not walked by keyboard. |
| 7 | Imagery credit and date at every altitude | Ground: the map's attribution control names USGS and says the imagery's date varies and is not the record's (2026-11-22, owner: the always-open caption was bulky, so the caveat moved into the credit behind the "i"). USGS imagery has no single date to print. Orbit and Country use no imagery and keep the existing attribution control. |
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

- ~~MapLibre's globe tears line and text layers below zoom 2, so they stand down there.~~ Corrected 2026-11-20: the globe does not tear them (every line and symbol layer forced on at zoom 1.5 draws cleanly). The white spikes were the place tokens' tether lines, which are DOM and stayed visible after Orbit hid the tokens. They are now hidden with the tokens. Lines still stand down at Orbit, because Orbit is lights and water only.
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

## 17. Third pass: one scene on home, and what the sweep found (2026-11-20)

Measured in headless Chromium on the real GPU (Metal) against the dev server and live data, and
spot-checked in the owner's Chrome (1728 by 962 at 2x, "Hold still" on).

### Built

- **Home is one scene.** The opening is the headline (display role, 86px at 1440 wide), one
  line, two actions and the coverage legend over the globe. The five-article column is gone.
- **The tour is a pinned stage.** One screen of ordinary page scroll per stop; each stop's words
  (photograph and credit, name, place, one sourced claim, one action) hold still and cross-fade
  while the camera travels. A chapter rail on the right edge links every stop. Nothing captures
  the wheel. Without JavaScript the stops are a stacked list.
- **Flights last as long as the ground they cover**, capped at 3.2 seconds, so tiles load on the
  way down instead of the map arriving blank.
- **A surface can stand place tokens down** (`setPlaceTokens`). The tour does.

### Defects found and fixed, with their causes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Count numbers flashing across the map during the tour | Above Orbit every place token draws, and a flight to one record passes all of them | The tour stands tokens down |
| White spikes radiating from New England on the globe | Orbit hid the count chips but not their tether lines, which are a sibling SVG | The tethers are hidden with the chips |
| Decade walk showed an empty globe aimed at Hudson Bay | MapLibre fits bounds inside the padding it is given plus the padding already on the camera. The opening leaves its padding on the camera, so the walk's fit was padded twice and the country was fitted into a 69px sliver | The fit is computed with no padding held (`camera.ts`) |
| Country cut off under the walk card | The opening's wider map frame (third pass) also applied to the walk | The wider frame is scoped to the opening |
| Words invisible on tour stops in the light theme | The shade under the words took the light theme's paper | The tour sits on a fixed ink ground |
| Uncaught "feature index out of bounds" | A second message for a tile race the query wrapper already handled | Both messages are caught |

### Acceptance sweep

Eight window shapes (1024 by 768, 1100 by 1300, 1280 by 800, 1440 by 900, 1728 by 962 with "Hold
still", 1920 by 1080, 390 by 844, 768 by 1024), eight paths each: opening, a tour stop, back to
the opening, decade walk, "Skip to the map", Explore cold, a place cold, place to home. All 64
have records on screen, no tether without its chip, and no sideways overflow. The project's own
nine-shape audit over home, Explore and a place reported no finding in the code this pass
changed.

### Still open

- **Orbit has a ceiling** (`DOOR_ORBIT_MAX_ZOOM`), so the globe stops growing on large screens.
  It exists only to keep state lines off the opening; lifting it means starting line layers at
  `ORBIT_MAX_ZOOM`, which also changes Explore's national frame on phones. Owner's call.
- State lines appear for part of any flight between Orbit and the country, for the same reason.
- On windows narrower than about 1400px the decade walk rests inside Orbit, so it shows lights
  and no counts.
- The phone opening keeps its older boxed layout. The header is still the nav bar on every
  surface (section 4.4 is not built).
- Explore's list clips and truncates rows at several widths, and site names run under its left
  column when arriving from a place. Both predate this pass and belong to the Explore rebuild.
- Not run: a screen reader, touch on a real phone, and web vitals on a production build after
  these changes.

## 18. Fourth pass: the scroll is the camera (2026-11-20)

Owner's requirement: scroll transitions zoom into and out of the map. Ten questions settled the
behavior; the answers are the spec for this section.

| Question | Decision |
| --- | --- |
| How scroll drives the camera | Scrubbed: a scroll position is a camera, forward and back |
| Between two stops | Out to the globe, then down into the next record. Superseded in section 19: up until both records fit, never back to the opening globe |
| Entry and exit | Dive from the opening's globe into the first record; pull back out after the last |
| Scroll per stop | Two screens: about one to hold, one to travel |
| Words during travel | Clear the stage; the globe has it alone |
| Landing | The record page's ground frame: tilted with credited aerial imagery for an exact site, flat and farther out for coarser precision |
| Faster than tiles load | The camera follows the scroll; detail sharpens at rest |
| Click flights (decade walk, opening a record, Explore selections) | Pull out by distance |
| Phones | The same scrub |
| Where it applies | Home tour, decade walk, opening a record, Explore selections |

### Built

- `door-tour-scrub.ts` is the path as pure arithmetic: a phase for a scroll position and a camera
  for a phase. The words (`door-tour-scroll.tsx`) and the camera (`door-immersive.tsx`) both read
  it, each from one passive, frame-coalesced scroll listener. Nothing is timed or captured.
- A dive turns the globe to the place first, comes down at an even rate in zoom levels, and
  tilts and reframes last. The lights stay lit down to the pins while the tokens are stood down.
- "Hold still" and reduced motion get cuts between stops, never the scrub.
- Aerial imagery is asked for only when the scroll has rested on an exact site, and is credited
  on screen while it shows.
- The map's own names stand down while the camera travels and return at rest.
- Click flights share two rules in `camera-presets.ts`: a flight lasts as long as the zoom levels
  and ground it covers (`flightDurationFor`), and its arc tops out where both ends fit, never past
  the country (`flightPeakZoom`). The decade walk now flies to each decade's record at a
  regional zoom. An Explore selection a screen or more away is flown to; a nearer one is still
  one ease, now lasting as long as the zoom it covers.

### Measured (headless Chromium, Metal, dev build, live data)

| Check | Result |
| --- | --- |
| Scrub at 1728 by 962 and 1440 by 900, wheel through the whole tour | p50 17 ms, p95 33 ms, worst frame 33 to 50 ms, no page errors |
| Reversibility | The camera at a scroll position is identical arriving from above or below |
| Words, imagery, credit, tokens | Words only while landed; imagery and its credit only at rest on an exact site; no place counts at any point in the tour |
| "Hold still" | Cuts to each stop; no scrub |
| Phone 390 by 844 at 4x CPU throttle | Works, but not smooth: about 30 long tasks per two stops. Hiding names in travel cut long-task time by a third (3.75 s to 2.57 s) |
| Decade walk | Far hops pull out 0.7 to 0.8 zoom levels over 1.7 s; near hops 0.4 over 1.6 s |
| Explore selection from the country | 2.3 s down to the record (was 0.7 s) |
| Eight shapes by eight paths | 64 of 64 with records on screen, no orphaned tether, no sideways overflow |

### Open

- **Phones are not yet smooth.** The remaining cost is tile and source work on every zoom level
  of a dive. This was measured on the dev build, which overstates it (section 14.2); a
  production-build measurement on a real phone decides whether phones keep the scrub.
- A far Explore selection is covered by a unit test and by the decade walk, which uses the same
  flight rule; it was not driven in a browser.
- A straight-edged lighter patch shows in the Atlantic east of New England at about zoom 4. It is
  in the state land shapes and predates this pass.
- The tour is now about eleven screens of scroll for five stops.

## 19. Fifth pass: the dive lands on the pin (2026-11-20)

Owner's report: scrolling home does not zoom into the record's pin, it transitions to showing it.
The globe should not reset, and the zoom into the pin should be smooth.

### What the frames showed (1440 by 900, 40 samples per leg, live data)

Captured with `.impeccable/redesign/v11-scroll-zoom/frames.mjs`, which records the camera and the
target pin's screen position at each scroll step. Raw rows are in `before/` and `after/` beside it.

| Gap                                       | Before                                                                                                                                                                                                | Cause                                                                                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The zoom was anchored beside the pin      | Between stops the pin sat 360px left of its landing from zoom 6.6 to 7.4, then slid across during the last quarter of the dive at up to 53px per sample. On the way in from the opening it slid 109px | The landing's padding arrived in the second half of the dive, after the turn had finished. The zoom's fixed point was the middle of the stage, not the record |
| The pin wandered on the way down          | From the opening it went 72px off, out to 88, in to 40, out to 109                                                                                                                                    | The center eased in degrees while the zoom doubled the pixels in a degree each level                                                                          |
| The globe reset between every stop        | Halfway through every hop the camera was at -96, 36 and zoom 1.88, the home globe, even for Amherst to Washington                                                                                     | The path was written as out to the opening's globe and back                                                                                                   |
| The pin's ring arrived after the camera | The opening's featured record kept its ring through the dive in. The tour's own record was ringed only once the scroll rested on it | Two causes. The mark followed the nearest stop, which is none until halfway. And the shared stage held every selection change until the map was idle (`applyViewState` in `MapStage.tsx`), which a scrub never is: a trace of the filter showed one write for the whole dive, at the landing |
| A small step where the tour takes the map | The dive's progress was measured from the top of the page but started 0.04 screens down                                                                                                               | Arithmetic in `tourPhase`                                                                                                                                     |

### Built

The path is in `door-tour-scrub.ts`, pinned by `door-tour-scrub.test.ts` (9 tests).

- `tourDive` now comes down on the record. The ground still to cover shrinks with the zoom gained
  as well as with the turn, and the landing's padding arrives with the turn. The pin's distance
  from its landing only closes, and is closed by 45% of the dive. From there the pin does not
  move and the ground grows around it.
- `tourBetween` is the top of a hop: over the middle of the two records, only as far out as both
  fit on the stage, using the click flights' `flightPeakZoom`. This replaces "out to the globe"
  from section 18. Confirmed by the owner on 2026-11-20.
- `tourMarkedStop` rings the first record from the first frame of the dive in.
- `MapStage.tsx` `applyViewState` applies a selection at once and again when the map settles. It
  used to wait for the map to settle. This is shared, so Explore selections and record pages also
  get their ring at the start of a flight instead of the end.
- The dive in is measured from where the tour takes the map.

### Measured after

| Check                                                                                     | Result                                                                                                     |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Pin against its landing, opening to stop 1, 1440 by 900                                   | 54px at the start, closing every sample, 0px from 45% to landing                                           |
| Pin through the deep zoom, 390 by 844, 768 by 1024, 1024 by 768, 1440 by 900, 1728 by 962 | 0px of movement from 75% of every sampled leg to landing; no sample where it moved away in the second half |
| Top of a hop, 1440 by 900                                                                 | Amherst to Washington zoom 6.70; Washington to Oklahoma City zoom 4.84. The home globe is 1.88             |
| Pin drawn at rest, all five stops, 1728 by 962 and 768 by 1024                            | Drawn at every stop 1.5 s after arriving. After a hard jump some are not drawn at 150 ms (tiles)           |
| Real wheel scroll through the dive in, 1440 by 900 and 390 by 844 (`wheel.mjs`) | The tour's record is ringed in every frame (88 of 88, 75 of 75) and sits on the zoom's fixed point, 0px off, for the last 45% of the dive |
| Frame pacing on that wheel scroll, dev build | 1440 by 900: p50 17 ms, p95 33 ms, worst 40 ms. 390 by 844 unthrottled: p50 17 ms, p95 18 ms, one 168 ms frame |
| Shared selection change on other surfaces (`siblings.mjs`) | Record page ringed on a cold load at 1440 and 390 wide; Explore loads with nothing ringed, as it should; no page errors |
| Page errors                                                                               | None in any run                                                                                            |
| Web tests (2,813 run), typecheck, lint on the changed files | 2,805 pass, 0 fail; clean |

Not measured: a throttled phone profile, a production build, a real phone, reduced motion
and "Hold still" (their code path is unchanged), the light theme.

### Every map and globe surface

Camera calls were found by searching `apps/web/src` for `flyPreset`, `flyTo`, `easeTo`, `jumpTo`
and `fitBounds`, and `apps/mobile/src` for its map code. Timed flights were sampled every frame
with `flights.mjs` in the same folder.

| Surface                                                                 | How the camera moves                                                           | Same defect?                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Home tour (`door-immersive.tsx`, `door-tour-scrub.ts`)                  | Scroll scrub                                                                   | Yes. Fixed in this pass                                                                  |
| Home decade walk                                                        | Timed `flyTo` through `camera.ts`, same padding at both ends                   | No. Target closes steadily (148, 69, 43, 21, 9, 0px across the descent). See open item 2 |
| Home place drill (tapping a place count)                                | Timed ease to fitted bounds                                                    | Not sampled                                                                              |
| Explore place selection (`use-atlas-camera.ts`, `camera-moves.ts`)      | Timed flight or ease                                                           | No wobble. A city token from zoom 8.2: 202, 61, 61, 38, 16, 0px                          |
| Explore single-record selection                                         | Same route                                                                     | Not driven. Both test clicks landed on place tokens                                      |
| Record and place pages (`RecordGround.tsx`)                             | Timed `flyPreset('point')` on arrival from another surface, a cut when cold    | From a landed tour stop it is a 706px pan at the same zoom over 1.9 s. See open item 5   |
| Story map moments (`MapMoment.tsx`, `MapStage.tsx` `useMapMomentFrame`) | Timed flight when the live moment changes as the reader scrolls. Not a scrub   | Not sampled. Reading altitude (section 10, phase 2) is where a scrub would go            |
| Embedded record maps (`RecordMap.tsx`, story `MapInsetMoment`)          | A fixed frame. `jumpTo` only, to widen until a place name shows                | Does not apply                                                                           |
| Indexes, data, trust, error pages                                       | No map mounted today                                                           | Does not apply until section 10 builds them                                              |
| Mobile app (`apps/mobile/src/features/map`)                             | Native MapLibre, timed moves from the duration tokens, no scroll-driven camera | Not run in this pass                                                                     |
| Design system gallery                                                   | Static `MapMoment` demos                                                       | Does not apply                                                                           |

### Open, in order

1. ~~Confirm the hop.~~ Confirmed 2026-11-20: "up until both fit" stays.
2. **The decade walk's first hop dips below the opening globe.** It starts at zoom 1.88, goes out
   to 1.58, then comes in. `flightPeakZoom` returns 1.88 for it, so the extra pull-out is inside
   MapLibre's `flyTo` or the fitted frame. Not diagnosed.
3. **Phones, far hops.** On 390 by 844 the hop to San Francisco tops out at the country floor
   (zoom 3.3) with the target still off screen at the top. It arrives on the way down. A wider
   floor on narrow screens would fix it.
4. **Scrolling back to the very top hands over to a timed ease.** Scrolling down again before it
   finishes steps the camera (38px in the harness, which jumps there instantly). Not seen at wheel
   speed, not measured there either.
5. **A tour stop and its record page frame the pin in different places.** Opening the record from
   a landed stop pans 706px. Sharing one frame would make that hand-off still.
6. **Explore single-record selection and the home place drill** are not sampled.
7. **Story Reading altitude** should reuse `tourDive` when it is built, so it inherits the pin
   anchor instead of repeating this defect.
8. **Mobile** was not run.
9. Carried from section 18: phone smoothness on a production build and a real device; the
   lighter patch in the Atlantic; the tour's length.

## 20. Reconciliation: what is built, and where the documents disagree (2026-11-20)

Written after an audit of the branch at `aa6891791`. Thirty-three public routes were loaded at
1440 by 900 with a dark preference, in headless Chromium on the real GPU against live published
data. Each was checked for a visible map, the projection, the header bar and the older identity's
marks. Phones, the light theme, the other window shapes and the mobile app were not part of it.

### Built since section 19

- **The tour camera eases toward the scroll** (`aa6891791`). A scroll position sets a target
  camera and a frame loop closes the gap with a 140 ms time constant until it arrives exactly
  (`easeTourCamera` in `door-tour-scrub.ts`, pinned by `door-tour-scrub.test.ts`). "Hold still" and
  reduced motion still cut straight to the stop. This replaces "the camera follows the scroll" in
  section 18.
- **"Read as documents" is removed** in the same commit. Its only exit was the same switch. A
  saved choice is cleared on load.

### Surfaces

| Surface | State on the branch |
| --- | --- |
| Home `/` | v11: globe, scroll tour, time rail, coverage line |
| Explore | Globe only. The left column and the decade histogram are unchanged, so section 7's "column becomes the left sheet; histogram becomes the time rail" is not built |
| `/place/*`, `/entity/*`, `/invention/*` with a public point | v11 Ground with the right sheet |
| `/law/*`, `/books/*` | Unchanged document. No world |
| Indexes (`/records`, `/stories`, `/law`, `/books`, `/data`, `/lives`, `/collections`, `/presidents`) | Unchanged. No map, the 104px masthead and the count numeral |
| Stories and chapters | Unchanged. The spine, the year numeral and the inset map (`MapInsetMoment`) are still in use |
| Memorial | Unchanged, as section 7.1 intends |
| Trust, legal and forms | Unchanged identity with the copper band. The parked restyle is not built |
| 404 and record not found | Unchanged copper band. `/place/{unknown}` rendered in the light theme under a dark preference; the cause is not diagnosed |
| Mobile, admin, docs, marketing site | No commits since v11 began |

`/presidents`, `/presidents/*`, `/lives/*` and `/lives/explorer` are not named in section 7. They
need a row before rollout phase 1.

### Parts of this document that no surface uses yet

- **Corner chrome (4.4).** The header bar is on every route, the flagship's included.
- **The removed list (5).** Bands, masthead numerals and the sheet spine still render. The new
  right sheet itself carries a copper spine.
- **One map constructor (3).** `RecordMap` still exists and still serves story insets and record
  pages without a ground.
- **Ember and night ground as tokens (5).** `packages/ui/src/styles/tokens.css` has neither. The
  new identity lives in the flagship's own CSS.
- **The dive affordance (2).** A record opens by route change, not from a control inside the
  scene.
- **Edges (4.1, criterion 5).** Still none, for the reason in section 13 row 5.
- **Coverage-gap toggle, period imagery, terrain, the night-globe still.** Not built.
- **The time rail (4.2).** Home only, with the differences listed in section 15.

### Where the documents disagree with the code or each other

| Disagreement | State |
| --- | --- |
| This document is proposed; home, Explore and place pages on the branch are built from it | Open. Needs the owner's sign-off or a decision to hold |
| `README.md` binds v10 and forbids a live WebGL first paint on `/`; the branch's home is one | Recorded in `README.md`. Resolved only by sign-off |
| "Read as documents" is a control in 4.1, criterion 10 and section 12 rows 1 and 9; the code removed it | Noted inline at each place. Open: restore it, or rewrite those controls |
| Section 10 says pattern docs are amended in the change that replaces a surface | Not done for home, Explore or place. Owed on sign-off: `patterns-plate-posture.md`, `patterns-record-page.md`, `patterns-surface-classes.md`, `PROTECTED-EXPERIENCES.md` P-01, `brand.md`. They are left alone until then so that no binding document describes an unsigned design |
| `docs/redesign/surface-inventory.json` and `SURFACES.md` | Predate v11 (2026-11-16) and carry no v11 status. `SURFACES.md` now points here |
| Section 2 names two references and records no address for either; Igloo was seen only at its opening | Open. The owner refers to three reference sites; the third is not recorded in the repository |

### Not validated

Criteria 14 and 15 and the reader test of "darkness is not absence" (section 11) have not been
run. Criterion 15 is the test of the alternative in section 12, so the direction itself is still
unproven.

## 21. Rollout (from 2026-11-20)

The owner signed off on 2026-11-20 ("Yes, start rollout") after an audit of 43 public routes at
1440 by 900, dark, which matched the surface table in section 20.

### Done

- **The world palette is in the kit.** `worldPalette` in `packages/ui/src/tokens/colors.ts` and
  `--ds-world-space`, `--ds-world-rim`, `--ds-world-ember`, `--ds-world-hud-ink` and
  `--ds-world-hud-ground` in `tokens.css`, held together by `world.test.ts`. The stage ground, the
  home disc's rim, the Orbit lights and both labels laid over the world (the imagery caption on a
  record and on a tour stop) read them. The two captions had different grounds and inks; they are
  now one treatment, which is the first step of 4.4's "one treatment everywhere".

- **The bar goes to the corners.** From 64rem on home and Explore, and from 72rem on a grounded
  record, the wordmark and the tools sit 24px from the window's edges instead of on the centered
  column, and a grounded record's destinations take the mono caps voice home already had. Checked
  at nine window shapes from 390 to 2560 wide on home, Explore, a place and `/records`: no
  overlap in the bar, no sideways overflow, `/records` unchanged. The light theme was checked at
  1440 and 390 with the saved toggle set (the app opens dark whatever the system prefers).
- `apps/site` regenerated its token module, which now carries the world tokens.

- **`/records` is at Country** (phase 1 flagship, uncommitted at the time of writing). From 64rem,
  with scripting, the list is a left sheet and the persistent plate shows the rows on the page
  beside it, framed on the country (`IndexCountry.tsx`, `country.css`). Every light is a row on
  the page; a legend on the world's side says how many rows are lit and how many have no mapped
  place, with the coverage line. Pointing at a row or focusing it lifts its light and shows its
  name; a light opens its record. The plate keeps its cover until the lights are handed over, so
  the page does not move when the world arrives.
  - Observed on the dev server, real GPU, live data: seven wide shapes from 1024 to 2560 (one
    canvas, country in the uncovered part, no sideways overflow) and both themes at 1440; 768
    and 390 stay documents and build no map; record and back, a filter, client navigation to
    `/stories` (cover returns); reduced motion lands in one camera frame; with WebGL off the
    page is the full-width document.
  - How it differs from section 4.1 and 7: the lights are the page's rows, not the whole
    narrowed set; the frame is always the country, so a narrowing to one state does not move
    the camera and records outside the lower 48 can sit off frame; nothing dims to 20 percent
    because nothing else is drawn; the coverage-gap toggle is not built; the timeline layout
    stays a document; below 64rem there is no world.
  - Found, not fixed: with scripting off `/records` never leaves its loading skeleton, because
    the rows stream into a hidden container that a script reveals. This predates v11.
  - Approved by the owner and committed on 2026-11-20 (`37e7d8ada`). A page with nothing to
    light, such as a search with no match, is a document: an empty globe beside a list says
    nothing.
- **Section 7's index row does not hold for the other eight indexes.** It says every index goes
  to Country with "the list and the lights the same set". Checked against the data on
  2026-11-20:

  | Index | What its rows are | What could be lit |
  | --- | --- | --- |
  | `/records` | Published records | The rows. Built. |
  | `/stories` | Stories | Only the records a story cites: 7 across the list, and none on the default view, which is the lead-cover front laid out for the full window. Tried and backed out: the page flipped between a document and a split view on a sort, and the coverage line ("unlit places are not yet researched") is false when a light means "cited" |
  | `/presidents` | Stories | Nothing. No entry cites a record with a public point |
  | `/law` | Statutes from the legal snapshots, a dataset separate from records | Nothing. A statute row has no record and no point; lighting its jurisdiction would shade states by count, which 4.1 forbids |
  | `/books` | Banned titles with challenge counts by state | Nothing, for the same reason |
  | `/data`, `/lives`, `/lives/explorer` | Census figures | Nothing that is a record. Section 7's "a chart selection relights the globe by the same measure" is a separate design, not this pattern |
  | `/collections` | Six links to other indexes | Nothing |

  A light means a published record (section 5). On these eight a globe would be decoration or
  a count map, so they stay documents. Open for the owner: give them the Parked identity
  (section 4.1) with the trust pages in phase 4, or define a different spatial mark for
  statutes and titles first.

- **`/law` is the Parked flagship** (built 2026-11-20, approved by the owner 2026-11-21). Parked had only a one-line definition in 4.1; this is
  what it means as built (`parked.css`, `law.css`):
  - The page stands on the night ground (`--ds-world-space`) in either theme, to the window's
    edges. Nothing on it is a map.
  - Long text lives on one reading sheet, paper in light and graphite in dark, with a real
    shadow and no edge stripe. The eras are sections inside it, not color blocks.
  - A Parked page may carry its own instrument in the first column from 64rem. On `/law` it
    is the time axis turned into a rail that holds the window's height, the way the home globe
    carries its time rail: a stroke per law at its year, a bar per era, and the long stretches
    the catalog holds nothing in yet, named ("No entries yet, 1872 to 1953"). An era's bar
    turns copper while its section is in the window, by a CSS view timeline; without support
    the bars rest muted. Below 64rem the rail runs across the page under the head.
  - Gone from this page: the masthead numeral, the sand axis band, the alternating ink and
    copper era blocks with their band art, the era span numerals and the sheet spine.
  - Checked on the dev server: eleven shapes from 390 to 2560 wide with no sideways overflow,
    both themes, a filter, a sort, no match, an open menu, keyboard order with a focus ring on
    every stop in the page, and every text run at or above its contrast floor.
  - Not settled: the header bar is paper over a night page in the light theme (the same open
    question as a grounded record's bar); the shared "No laws match" block still carries the
    old sand ground and band art; the rail is a picture and its marks are not links.

- **The shared trust frame is Parked** (2026-11-21). `components/trust` (`TrustMast`,
  `TrustSheet`) is the frame of every trust, utility and data page, so the change is made once
  there and reaches `/about`, `/methodology`, `/faq`, `/sources`, `/errata`, `/privacy`,
  `/terms`, `/support`, `/submit`, `/corrections` and its status pages, the mosaic credits,
  `/data`, `/lives`, `/lives/explorer`, the 404 and the error page. `/presidents` and
  `/collections` moved onto the same frame.
  - The mast is the night ground in both themes; the copper and sand mast tones are gone and
    `TrustMast` no longer takes `tone`. The room is night around the sheet.
  - The signature is the horizon: the world's lit edge (rim light and ember, the globe's own
    colors) crests just above the sheet and runs out behind it. It is drawn in CSS and is not a
    map, so it claims no record.
  - The sheet lost its three-band spine (`bands="none"`), as on `/law`. The mast keeps its one
    display numeral, now ember on night.
  - Checked: 18 pages, nine window shapes, no sideways overflow; text contrast in both themes
    showed nothing new. Flags that predate this and sit inside sheets: the methodology grade
    matrix letters in dark (1.97:1 on its copper cell) and the Lives scrub labels in light
    (3.99:1). Both fixed 2026-11-21: the lowest is now 4.71:1 and 5.44:1.
  - Not done then: `/books` (built next, below) and `/stories` (see Open).

- **`/books` is Parked, on the `/law` stage** (2026-11-21). Its instrument is the state tile
  map, as a rail in the first column from 64rem, with its key and, in the titles view, the
  busiest states under it. The titles and the ranked list of states stand on the one sheet.
  - The tiles climb the world's ember from a dim coal to paper; they stay square at rail size,
    because a round ember dot would read as a light and a light means a record. State codes
    show only where a tile is big enough to carry one (under 64rem); the ranked list names
    every state.
  - Gone: the count numeral in the head, the sand lead band, the alternating ink and sand
    bands with their band art, and the per-band count numeral.
  - Checked: seven states of the page (titles, states, a state filter in both views, two
    other sorts, no match) at eleven window shapes with no sideways overflow, both themes,
    keyboard order with a focus ring on every stop in the page.

- **The horizon is on the stage too** (2026-11-21), so `/law` and `/books` carry the same
  signature as the trust frame. It is the sheet's first box, so it crests just above the sheet
  wherever the sheet falls, and it passes behind the rail. Checked at eleven window shapes on
  six states of the two pages: no sideways overflow and no added page height.

- **`/stories` stays a Reading front** (owner's decision, 2026-11-21). It is a front of chapter
  covers, not a Parked page, and takes no night stage or horizon. The Parked rollout of the
  indexes is complete with it left as it is.

- **An outcome on a Parked page is the sheet** (2026-11-21). "No titles match", "No laws
  match" and the two did-not-load states take the sheet's paper, shadow and corners, with no
  band art (`Outcome ground="paper"`). `/records` keeps the sand block. The `/books` dek no
  longer says "across 0 states" when nothing matches.

- **The header and the phone tab bar are night on a Parked page** (2026-11-21), in either
  theme. `isParkedPath` (`lib/nav/surface-classes.ts`) names the routes; the bars hold their
  ink roles there (`data-ground-fixed`) and take the world's night as their ground. `/records`,
  `/stories`, chapters, record pages and the memorial keep the theme's bar. Not covered: the
  error page shown on a route that is not Parked keeps that route's bar.

- **A rest short of a tour landing gets imagery** (2026-11-22). On `/`, stopping the scroll
  between two stops with the camera near the ground left an empty plate with one pin: the
  lights have faded by zoom 11 and imagery waited for an exact landing. Which scroll positions
  those are depends on the window's height. Resting from zoom 10 up now shows the nearest
  stop's imagery, under the same precision rule and credit, and it still goes the moment the
  scroll moves, so the scrub fetches none. Checked at 1440 by 900 and 390 by 844: held for 12
  seconds with no flicker. A stop whose precision does not allow imagery still rests on the
  plate.
- **The public database pool is bounded** (2026-11-22). It had no timeouts; after a dropped
  connection `/` took 60 seconds and `/explore` 15 minutes, and the map had nothing to draw.
- **The lights stay lit under the state counts** (2026-11-22). They used to be gone by zoom
  3.3, and the national frame on `/explore` sits above that from about 1366 wide, so wide
  windows opened on counts with no light. They now step down to 0.45 as the counts arrive, hold
  there, and fade with the counts between zoom 5.6 and 6.2. Measured at six widths from 390 to
  3840: lights on every one. The handoff to the place tokens past zoom 6 was not looked at.
- **The Orbit globe grows past a 1440 window** (2026-11-22). It stopped at zoom 1.88 because
  the style draws state lines from 1.9 and Orbit has none. On the Door the line, name and land
  layers now wait for zoom 2.7 (`applyOrbitLineFloor`), and the ceiling is 2.65: the disc is
  about 750px at 1920 wide (was 610) and about 1270px from 2560 wide. Explore and the Door's
  browse posture keep the style's own floor, so a 320 phone's national frame still has its
  lines. A 4K window is still not filled; going further means moving where the lights hand
  over to the place tokens.

### Open before or during phase 1

- The rest of 4.4: the current location in words beside the wordmark, one credit treatment at
  the bottom left, and whether a grounded record's bar takes the night ground in the light theme
  (it is paper there today, over a night world).

- Criteria 14 and 15 and the reader test. Unrun at sign-off.
- The horizon is drawn twice, once in `parked.css` (the stage) and once in `trust.css` (the
  frame), with the same values. Fold them into one rule if a third user appears.
- "Read as documents": restore it, or rewrite the controls in 4.1 and section 12 rows 1 and 9.
- The third reference site's address.
- `/presidents`, `/presidents/*`, `/lives/*` and `/lives/explorer` need rows in section 7.
- `pnpm lint:tokens` passes (2026-11-22). 72rem, the page grid's own cap, joined the
  breakpoint grid by the owner's decision, so the record page's side sheet stays where it was
  tuned; the Door's placeholder disc and the tour rail's dot margin are written with tokens.
- Found in the audit, not fixed: a statewide law (Mississippi Black Codes of 1865) grounds as an
  exact site over aerial imagery instead of at its jurisdiction (section 7); a harm record gets
  the standard grounded frame and ringed pin, and section 4.1's "no glow, no motion beyond a cut"
  was not checked for it; `/place/{unknown}` renders light under a dark preference.
- Pattern docs owed for the three built surfaces: `patterns-plate-posture.md`,
  `patterns-record-page.md` and `patterns-surface-classes.md` carry a pointer here but are not
  rewritten.
