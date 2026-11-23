# BlackStory design direction v12: On the Ground

**Status:** proposed (2026-11-22). The home page is built as the flagship on
`redesign/v11-one-world`, uncommitted, for the owner's sign-off. Nothing else is rolled out.
Codex reviewed the first draft and returned "needs validation" (section 12); the build follows
the review where the two disagree with the sections above it.
**Supersedes, if signed off:** v11's Orbit altitude and its home row (v11 sections 4.1, 7, 15,
17 to 19 as they describe `/`). v11's Country, Ground, Reading and Parked altitudes stand.
**Still binding, unchanged:** evidence honesty (P-02), precision governs the camera (P-03),
privacy and living-person rules, accessibility law, the dignity rules, American English, the
copy rules in `story.md`, real photographs only, generated assets abstract only.

## 1. The brief (owner, 2026-11-22)

The globe and the main page are weak and do not carry the "Story" in BlackStory. Traversing
across the map is loved and stays. Rebuild the main page from the ground up, do not start from
agreement, audit the surrounding pages harshly, generate visual assets with Codex, and have
Codex challenge the approach.

## 2. What the references do

Opened in a browser on 2026-11-22 at 1440 by 900 and scrolled three screens each: Pioneer
"Corn. Revolutionized." (`cornrevolution.resn.global`), Lando Norris (`landonorris.com`,
Awwwards Site of the Year), Plastic Human (`plastichuman.org`, Awwwards nominee 2026-11-20),
197 Historias Ilustradas (`197historiasilustradas.com`, Site of the Day 2026-11-20), Igloo Inc.
Awwwards listing and detail pages were read as text for Route 66 Centennial, Museum of Love,
Veluwe and MemoryQuest; those live sites were not opened.

| What they do                                                             | Seen on                                                             | What the current home does                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The first screen holds one physical subject, close up, filling the frame | Corn (a plant), Plastic Human (a head), Lando (a face)              | A brown ball a third of the screen wide, with the subject as dots in one corner of it   |
| Type at the scale of the image, set into it or behind it                 | Corn, Plastic Human                                                 | An 86px headline beside the image, never touching it                                    |
| Purpose in one or two lines on the first screen                          | Plastic Human ("An investigation into the plastic inside us"), 197  | A wordplay headline, then a mono paragraph apologizing for what the globe does not show |
| Real pictures floating at different depths, moving at different speeds   | Lando (plates scattered over a contour ground), 197 (portrait grid) | One 280px sepia thumbnail per stop                                                      |
| One committed visual system (two inks, one texture, one motif)           | Plastic Human, Corn                                                 | Night globe, sepia plates, aerial imagery, copper band, mono HUD: five looks            |
| Named chapters with a visible place in the sequence                      | Corn (rail), Plastic Human                                          | Five dots; nothing says why these five or in what order                                 |
| Evidence shown as part of the look                                       | Plastic Human (sources and caveats on screen)                       | The grade is a 10px label under the claim                                               |
| A loader before anything shows                                           | Corn, Igloo, Plastic Human                                          | None. Keep it that way                                                                  |

## 3. The current home, taken apart

Captured on the dev server, real GPU, live data, 1440 by 900 and 390 by 844, nine scroll
positions each (2026-11-22).

1. **The hero's subject is empty space.** At 1440 wide the globe is about 610px across and the
   lit part of it is about 240px. The rest is ocean, Canada and Mexico in one brown. The page
   then has to say "Outside the United States, almost nothing is on this map", which is an
   apology for the picture it chose.
2. **A globe is the wrong claim.** The archive is the United States. A planet says "world
   history" and makes 4,400 records look like a rash on one continent.
3. **Dots are a chart, not a story.** No face, no building, no document and no year is on the
   first screen. Nothing there could not be a map of pharmacies.
4. **The tour has no through-line.** Five records chosen for spread: on the day of capture a
   cemetery, a home and three churches, each with one sentence, two of them graded "Thinly
   evidenced" and sourced to Wikipedia. Nothing connects one to the next. It is a slideshow.
5. **Most of the scroll is dead.** The tour is 11 screens. Between stops the frame is
   unlabeled farmland or a flat brown plate for a full screen at a time, with only "Skip the
   tour" on it.
6. **The photograph is a thumbnail.** 280px wide, sepia-toned, in a corner, while present-day
   aerial imagery gets the whole screen.
7. **Seven things compete on the opening.** Headline animation, line, "Start here", two
   buttons, a coverage paragraph, a callout on the globe, a time rail with three readouts,
   "Hold still", an info button and a scroll cue.
8. **The Story is one line.** The chapters are the only long-form stories the product has, and
   the best single image on the site is the Constitution cover on `/stories`. On the home they
   are "Start here The Count" in 14px and a copper band at the very end.
9. **It ends by repeating itself.** After the last stop the camera returns to the same globe,
   then a grade table, then a band in the retired copper identity.
10. **On a phone the globe is a small disc in the bottom corner** under a boxed text block.

What the old opening got right, and v12 keeps: it said the scope is the United States, said
every record is sourced, named one real place and stated the coverage caveat on the first
screen (Codex, section 12 row 7).

Verdict on v11's Orbit: rejected. Verdict on the scroll-driven dive and the traverse between
places: kept. They are the best thing on the page and are buried under the rest.

## 4. Thesis

> **Don't show the planet. Show the place.**

A story is a person or a place, a year, a picture and a piece of paper. The home page opens on
those things at full size, says in one sentence what the archive is, and then travels: the
map is the ground you move across, never the thing you look at from space.

## 5. The five planes

Every scene on the home page is built from the same five planes, back to front. They move at
different speeds under scroll, which is where the depth comes from. No plane is decoration:
each carries one kind of information.

| Plane     | What it is                                                                         | What it tells you                                                                          | Moves                        |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| 1. Ground | The persistent map: the country as lights, then the land under a place             | Where                                                                                      | The camera (scroll-scrubbed) |
| 2. Air    | Ember haze and grain over the ground on the title only (generated, abstract)       | Nothing. It is atmosphere, and is kept off every photograph and every word for that reason | Fixed                        |
| 3. Year   | The year or decade in display type at the height of the window, behind the picture | When                                                                                       | Slower than the page         |
| 4. Plate  | The record's own photograph, large, in its own color, credited                     | Who and what                                                                               | With the page                |
| 5. Slip   | The words: name, place, one claim on a plain paper card with its source and grade  | What is known and how well                                                                 | With the page                |

Rules: the plate is never toned sepia and never aged. The archive does not store when a
photograph was taken and most are recent, so every plate in the journey says so beside its
credit. The year plane is the decade the archive first documents the record in, and the words
say exactly that; it is not the date of the photograph or of the claim. The slip is interface,
not a reproduced document, so it is flat paper with no fiber and no torn edge.

## 6. The home page, reel by reel

| Reel        | Scroll                 | Ground                                                  | What is on it                                                                                                                                                                                     |
| ----------- | ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Title    | First screen           | The lower 48 edge to edge, lights only, no ball, dimmed | Five real photographs at three depths around one statement: "Black history happened here." One sentence that says what this is and how many records. Search. Two ways in: the lead story, the map |
| 1. Journey  | About 2 screens a stop | Dive, hold, rise, traverse, dive                        | Stops in time order, oldest first. Each is a scene of the five planes. In transit the screen says where you are going, how far and how many years on, so no frame is dead                         |
| 2. Country  | 1 screen               | Pulled back to every light                              | The count, what a light means and does not mean, "Find a place" into the map                                                                                                                      |
| 3. Stories  | 1 screen a story       | Covered                                                 | The chapters as full-width covers with their real documents. This is the Story                                                                                                                    |
| 4. Receipts | 1 screen               | Covered                                                 | How a record is graded, with the three counts, on paper                                                                                                                                           |

What the journey's stops are: records the page may already show (never quiet, never a living
person, photographed, a whole sourced sentence), now also required to be graded above "thinly
evidenced" and to differ in kind, so the journey is not three churches. Oldest first, so the
scroll is also a walk forward in time. Every connective fact on screen (miles, direction,
years between) is computed from the two records. No authored historical claims are added.

Removed from `/`: the globe, the time rail, the decade walk, the spotlight callout, the
headline morph, the in-place browse morph (the map is `/explore`, one click away, on the same
map instance), the grade table's copper band.

## 7. Identity changes

- **Ground stays night.** The ember stays the only saturated color on the map.
- **Photographs come forward in color.** Sepia toning is retired on the home page.
- **Paper returns as a material**, for slips and the receipts reel only: warm rag paper with a
  torn edge, ink type. It is the "piece of paper" in the thesis.
- **Numerals are years, not counts.** A giant "4,403" says how big the archive is. A giant
  "1866" says when something happened. The count appears once, in a sentence.
- **Texture is back, on purpose.** The owner's 2026-11-15 rule kept out grain and glow "that
  carries no information". The 2026-11-22 brief asks for layering, effects and generated
  assets. This direction reads the newer instruction as replacing the older one on the home
  page only, and keeps textures to plane 2 and the paper.

## 8. Generated assets (Codex, abstract only)

Made with the Codex CLI's image tool on 2026-11-22. Prompts are in
`apps/web/public/home/manifest.json`. None shows a person, place, building, map or event.

| File         | Use                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `grain`      | Plane 2, over the whole film                                                                               |
| `dust`       | Generated, not used. Film scratches over a present-day photograph are a false aging cue (section 12 row 2) |
| `ember-haze` | Plane 2, the warm light at the foot of the title                                                           |
| `paper`      | The stories and receipts sheet only                                                                        |
| `deckle`     | The top edge of that sheet, once                                                                           |
| `halftone`   | Year numerals' fill                                                                                        |

## 9. Floor

- Server-rendered: every reel is HTML with real headings and links, in order, without
  JavaScript. Without WebGL the ground is the night color and nothing else changes.
- Native scroll only. Nothing captures the wheel. "Hold still" and reduced motion cut between
  stops and stop every parallax.
- Precision still governs the landing frame. Aerial imagery only on an exact site, credited.
- Photographs keep their credit beside them at every size.
- AA contrast for every text run, measured against the painted pixels.

## 10. The surrounding pages, audited

Captured 2026-11-22 at 1440 by 900, dark.

| Surface               | Finding                                                                                                                                                                     | Severity | Action                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| Header                | "Map" is lit on the home page, so the home is filed as a tool                                                                                                               | High     | Home is the wordmark. Map goes to `/explore`                                                       |
| `/explore`            | Still the ball. State count chips ("206 NY") sit on top of the lights they summarize. The list is 11px. It is a control panel in brown                                      | High     | Next flagship: flat country, counts off until asked for, the list at reading size with photographs |
| `/records`            | A cropped slice of the ball is wedged beside the list. Every row shows a gray pin tile where most records have a photograph. The hero is the number 4,403                   | High     | Drop the ball slice for the flat country. Show the photograph in the row                           |
| `/stories`            | The strongest page: a real document, full width. Then three small rows and nothing                                                                                          | Medium   | Give every story the cover treatment; this becomes reel 3's source                                 |
| `/place/*`            | The photograph is in the sheet's first screen but small; a present-day aerial has the whole left half. v11's open precision and harm findings (section 14 row 6) apply here | Medium   | Plate first, at size. Aerial second. Fix the two findings first                                    |
| `/collections`        | Six links and a giant "6". A sitemap dressed as a page                                                                                                                      | Medium   | Fold into the footer and reel 4, or give each collection a cover                                   |
| `/about`, trust pages | The count numeral is the hero again. Otherwise sound                                                                                                                        | Low      | Replace the numeral with the sentence                                                              |
| Everywhere            | The count numeral (4,403, 6, 01 to 06) is the site's only display motif. A count is not a story                                                                             | Medium   | Years and names take the display role                                                              |

## 11. Risks and the strongest objection

- **Photographs carry more weight than their sourcing.** Most plates are Wikimedia Commons
  photographs of a building as it stands today, not period pictures. At hero size a reader may
  take one for a historical photograph. Control: the credit and source sit beside every plate,
  and the slip dates the record, not the picture. Open.
- **The collage picks faces and buildings to sell the page.** That is a marketing move on an
  archive. Control: the same eligibility rule as every other surface, chosen by rule, not by
  hand; no harm-adjacent record; no living person.
- **Texture can read as costume**, a "vintage" filter on Black history. Control: no sepia, no
  fake aging of real photographs; texture stays on the air plane and the paper.
- **Best alternative not taken:** make `/stories` the home page and leave the map to
  `/explore`. Cheaper and clearly story-first. Not taken because the traverse is the one thing
  the owner asked to keep on the main page, and because three stories cannot carry a front
  door alone.

## 12. Adversarial review

Codex (read-only, 2026-11-22) read the first draft of this document, v11, `PRODUCT.md`,
`story.md`, the old home's code and the before screenshots. Verdict: **needs validation**.

| #   | Finding                                                                                                                                                                                                                        | Severity | Disposition                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Full-width story covers can put harm imagery on the home page ("The Gap That Never Closed" is covered by a Tulsa massacre postcard)                                                                                            | Blocker  | Accepted. Only the lead story's cover is shown; every other story is text. The rule is a code comment in `home-page.tsx`, not a data check, so a future lead story with a harm cover would get through. Open                                                                                                                |
| 2   | Atmosphere, monumental dates, modern photographs and paper slips together manufacture a period the data does not support. The decade is the record's earliest, not the claim's or the picture's. "Years on" is false precision | Blocker  | Accepted. No sepia, no dust. Each plate says its date is not on record. The decade is labeled "First documented in the". "Years on" is cut; a trip states distance and direction only. Slips are flat paper                                                                                                                 |
| 3   | Chronological variety is still a slideshow. Miles are not a narrative                                                                                                                                                          | Major    | Accepted in part. The page calls the stops "records from the archive, oldest first" and claims no connection. A journey that answers one question needs a story whose places are records, which the catalog does not have yet (v11 section 21: seven cited records across all stories). That is content work and stays open |
| 4   | The first screen's sentence was unspecified, and the coverage caveat had moved to reel 2. The lower 48 frame drops Alaska                                                                                                      | Major    | Accepted. The sentence is written (section 6 as built), the coverage line is on the first screen, and the country reel says what sits outside the frame                                                                                                                                                                     |
| 5   | The floor had no acceptance gates                                                                                                                                                                                              | Major    | Accepted in part. Section 13 lists what was run. A real phone, a screen reader and a production build were not                                                                                                                                                                                                              |
| 6   | Reading the new brief as lifting the texture rule is not established                                                                                                                                                           | Major    | Accepted with controls. Texture is on the title's ground, the numerals and the one paper sheet; never on a photograph or a slip. Whether that satisfies the 2026-11-15 rule is the owner's call                                                                                                                             |
| 7   | The teardown overstated two things and the audit missed v11's open precision and harm findings                                                                                                                                 | Major    | Accepted. Section 3 corrected. The two findings are carried into section 14                                                                                                                                                                                                                                                 |
| Alt | An editorial front: one substantial story, search and evidence, a short optional traverse through that story's sourced places                                                                                                  |          | Not adopted, for the reason in row 3: no story's places are records yet. The lead story is on the first screen as its own document, and the stories reel follows the map. If the owner prefers this alternative, the title and the sheet are already most of it                                                             |

**Where this leaves the direction:** accepted with controls by this document, needs validation
by Codex. The flagship is the validation, and the owner decides.

## 13. What is built and what was checked (2026-11-22)

Built: `apps/web/src/app/home/` (`home-page.tsx`, `home-film.tsx`, `home-journey.ts` with its
test, `home.css`) and six generated textures in `apps/web/public/home/`. `/` renders it.
`/explore` still renders the old Door in its browse posture, so `door-*.tsx` stays. The header
no longer marks Map as current on `/`. The shared lights grow a little past zoom 2.7
(`explore-style.ts`), which also brightens Explore's national frame.

As built, the first screen says: "Black history happened here." and "BlackStory is an archive
of 4,403 sourced records of Black history in the United States, each pinned to the place it
happened.", with search, the lead story, the map, and the coverage line.

Checked on the dev server, real GPU (Metal), live published data, dark preference:

| Check                                                               | Result                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Eleven window shapes, 375 by 667 to 2560 by 1440, every stop landed | The way into the record is on screen at every stop; no sideways overflow; no page errors    |
| Scroll through the whole page at 1440 by 900                        | Title, five stops, four trips, the country with its lights, the sheet, the footer, in order |
| Reduced motion, 1440 and 390 wide                                   | No film: the stops are a stacked document and the camera cuts to the stop in the window     |
| No JavaScript, 1440 and 390 wide                                    | Every section renders in order with its links. No map, by design                            |
| Light theme, 1440 wide                                              | The page stays night, as v11 decided for the world                                          |
| Web tests, typecheck, lint, token lint, the design detector         | 2,832 run, 0 fail; clean; clean; no finding                                                 |

Not checked: a real phone or a throttled profile, a production build and its web vitals, a
screen reader, keyboard order by hand, text contrast measured against painted pixels, 200
percent zoom, touch, WebGL unavailable, and the title's photographs failing to load. The film
adds two blended layers and up to five photographs to the first screen; its cost is unmeasured.

Known and left: below 80rem the time rail is hidden. On a window shorter than 48rem, or
narrower than 80rem, the photograph is a band above the words instead of a column. On a phone
shorter than 700px the photograph is dropped from the pinned scene. The decade numeral sits
under aerial imagery and is partly covered by the scene on some shapes.

## 14. Open, in order

1. Owner sign-off on v12, or the alternative in section 12.
2. A check, in data, that a story cover is safe for the home page (section 12 row 1).
3. A story whose places are published records, so the journey can follow one (row 3).
4. Remove `door-home.tsx`, `door-immersive.tsx`, the decade walk, the time rail and their CSS
   once `/explore` has its own page. Until then they are live code for `/explore` only.
5. Section 10's audit, starting with `/explore` and the photograph in `/records` rows.
6. Carried from v11 section 21: a statewide law grounds as an exact site; a harm record gets
   the standard grounded frame and ring.
7. The checks listed as not run in section 13.
8. `PRODUCT.md`'s visual-world paragraph still describes toned plates and the texture rule.

## 15. Explore, and the globe removed from the map (2026-11-23)

The owner asked for `/explore` to be rebuilt the same way. Looked at in full resolution, in
four states at 1440 by 900 and 390 by 844, section 10's row for it was partly wrong: the list
is 13px, not 11px, and reads; the column, filters, brush and non-modal inspector work. Codex
reviewed the plan and said so too (verdict: needs validation, "presentation only" too narrow).
So this is a targeted rebuild of what was actually broken, not a new page.

### What was wrong

1. **The ball.** A planet's edge in the corners on desktop and half the screen on a phone.
2. **The selected record.** Its photograph, a 480px thumbnail, was toned sepia and stretched
   over the whole map with a hole cut around the pin. Streets were drawn over a blurred
   picture, the panel lost its surface, and neighbors could not be read.
3. **Counts shouted over the records.** State counts were bold ember numerals; the lights
   under them were dimmed to 45 percent. Ember is supposed to mean a record.
4. **The panel cut the summary at three lines** and showed the decade as a bare numeral.
5. **On a phone, finding by place was hidden** until the sheet was dragged up.
6. **Keyboard:** the list's only tab stop could be a row that was not in the DOM.

### What changed

| Change                                                                                                                                                                                                   | Where                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| The map is flat (Mercator) on every surface. MapLibre's globe is no longer requested anywhere; v11 measured it as the main-thread cost of the home page                                                  | `MapStage.tsx`, `map-plate-paint.ts`                                     |
| A selected record leaves the map alone. Its photograph is in the panel, in color, at column width, with its credit and a line that its date is not on record. The panel keeps its surface in both themes | `RecordInspector.tsx`, `record-inspector.css`; `SelectionGround` deleted |
| The panel shows the whole summary and says "First documented in the 1970s"                                                                                                                               | same                                                                     |
| Counts are labels in the night's ink; lights stay at 85 percent under them. A hovered count underlines                                                                                                   | `shell.css`, `explore-style.ts`                                          |
| List photographs are in color                                                                                                                                                                            | `ExploreRecordList.tsx`, `explore-record-list.css`                       |
| The count in the column head is a plain title, not a copper numeral                                                                                                                                      | `explore-column.css`                                                     |
| On a phone the sheet's peek is the count and the place field; focusing the field raises the sheet                                                                                                        | `ExploreColumn.tsx`, `explore-column.css`                                |
| The list's tab stop is the selected row while it is rendered, otherwise the first rendered row                                                                                                           | `ExploreRecordList.tsx`                                                  |

### Codex's findings and what was done

| Finding                                                                                 | Disposition                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Exact-site precision alone does not authorize aerial imagery in Explore (blocker)       | Accepted. Automatic imagery was dropped from the plan. The existing satellite toggle is unchanged |
| Untruncated rows break the fixed-height windowed list                                   | Accepted. Row height is unchanged at 84px; place lines still truncate                             |
| The list's tab stop depends on mounted rows; the place field is a combobox in name only | First half fixed. The combobox arrows are still open (also v11 section 16)                        |
| A two-row peek misses the phone's real problem, place search                            | Accepted and built                                                                                |
| The inspector photograph was suppressed by the selection overlay                        | Accepted and built                                                                                |
| Taller bars do not improve time selection; keep the key                                 | Accepted. The dock is untouched                                                                   |
| Photo batching must stay                                                                | Untouched                                                                                         |

### Checked

Dev server, real GPU, live data: `/explore` cold, a selected record with a photograph, and a
two-filter view at 1440 by 900 and 390 by 844; cold and selected at 1024 by 768, 768 by 1024,
1920 by 1080 and 375 by 667, with no sideways overflow; light theme at 1440. A place page,
`/records` and the home page on the flat map. Web tests 2,832 run, 0 fail; typecheck, lint and
token lint clean.

Not checked: the list's tab stop by hand, a screen reader, the phone sheet by touch, a far
zoom-out on a very wide window (the flat world may repeat sideways), a production build. Still
open in Explore: place lines truncate, the place field's arrow keys, records with no
photograph are 74 percent of the list, and `/explore` still mounts through `door-home.tsx`.
