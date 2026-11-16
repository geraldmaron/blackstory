# Place map (Explore)

**Status:** binding for how `/explore` groups records on the map, for the home Door, which paints the same plate, and for the record embeds (`## Embeds`). Supersedes the pixel clustering the older `patterns-map-entity-encoding.md` described. That doc now covers point marks by precision only.
**Code:** `packages/domain/src/map/place-groups.ts` (the rules, shared by web and mobile), `apps/web/src/lib/map-experience/place-map.ts` (the web adapter), `apps/web/src/app/map/explore-style.ts` (layers), `apps/web/src/components/map-stage/place-labels.ts` (the names in the house type), `apps/web/src/components/map-stage/MapStage.tsx` (token tap), `apps/web/src/app/explore/hooks/use-place-scope.ts` (list scoping and Back/Forward), `apps/web/src/app/explore/hooks/use-place-focus.ts` (the entered place's outline and veil), `apps/web/src/components/map-experience/explore-column.css` (the floating chrome).

---

## Intent

The map groups records by the place they belong to, never by how close their dots fall on screen. A bubble reading "945" told a reader nothing about history. A token reading "Fulton County, GA, 49 records" tells them where those records are and how finely the archive holds each one.

Three promises follow:

1. Every record with a public point is counted somewhere at every zoom. County- and state-precision records included.
2. No mark is ever drawn sharper than the record's stored public precision.
3. The map and the list always show the same set of records.

---

## Levels and zoom thresholds

| Level | Shows from zoom | Shows until | Frame it matches |
|---|---|---|---|
| State | 0 | 6 | National and regional views |
| County | 6 | 8 | One state |
| City | 8 | 11 | One metro area |
| Square | 11 | 14 | A city's districts |
| Site | 14 | map maximum (14) | A city's streets |

The thresholds are integers on purpose. MapLibre evaluates zoom inside a layer filter at integer zoom levels only, so a fractional threshold would not hold. County starts at 6 because that is where the state labels hand off to county names (`STATE_LABEL_FADE_END_ZOOM` 6.2, `COUNTY_LABELS_MIN_ZOOM` 6.2), and because a thousand county tokens at a zoom-5 multi-state frame read as noise. Squares start at 11, one step past the zoom a city-precision record frames at (10), so a framed city never shows street-level dots before the reader asks for them. A site alone in its square draws as its own dot from 11; sites that share a square draw from 14, the map's street zoom.

### Grid squares (city density)

At city framing a dense city used to draw every site at once: Washington's 272 exact sites read as about 300 stacked dots. Between the city and the street, site-precision records are now counted in **grid squares**: a fixed, global grid of `SQUARE_STEP_DEG` (0.02 degrees of latitude and longitude, about 2.2 km north to south, 58px at zoom 11). The rule:

1. A site-precision record's square is the grid cell its public point falls in (`squareKey`: column and row counted from 180W and 90S).
2. A square that holds two or more sites is a place: a token at the square's fixed center, from zoom 11 to 14. A square holding one site is not a place; that site draws as its own dot from 11.
3. Only site-precision records enter squares. City-, county- and state-precision records stay in their city, county or state token at these zooms, so nothing is drawn sharper than stored precision.
4. Every record is counted once at every zoom: the square level's tokens plus the lone sites add up to the whole set (`place-groups.test.ts`).
5. The grid never moves with the frame or with the filters, so a square's key and members are stable. Whether a square has two members is read from the records on the map, so a filter can turn a square of two into one dot.

A square has no name of its own on the plate (its tab sits among named streets); the column calls it "A square in Washington, DC", naming the city, county or state of its first member. City anchors round to the even hundredths of a degree and square centers sit on the odd hundredths, so a city's tab and a square's tab never stack.

---

## Counting rules

Each record gets a path from its stored data, not from screen position.

| Precision (stored) | Band | State | County | City |
|---|---|---|---|---|
| address, site, institution | site | its state | the county polygon containing its point | the city its jurisdiction label names |
| campus, neighborhood, city | area | its state | the county polygon containing its point | the city its jurisdiction label names |
| county | county | its state | the county polygon containing its point | never |
| state, country | state | its state | never | never |

At each level a record is counted in its deepest known place no finer than that level. A county record at the city level is counted in its county token. A statewide record is counted in its state token at every level. At the site level, site-band records leave the tokens and draw as their own dots; everything else stays in a token.

The city is the jurisdiction-label segment just before the state ("Harlem, New York City, New York" counts in New York City). A segment naming a county, parish, borough or census area is not a city. Every D.C. record is in Washington. A county-precision record never gets a city even when its label names one ("Cumming, Georgia" on a Forsyth County record): the archive holds the county, not the town.

A record with no state (four today, outside the 50 states and D.C.) is drawn as a site dot when it holds a site and is otherwise not counted. A record whose point falls in no county polygon (a coastline the 1:20m outline cuts) counts in its state at the county level.

Selecting a place is inclusive: a county holds its cities' records, and a state holds everything inside it.

---

## Anchors

A token sits at a canonical anchor for its place, never at one record's point.

- **State:** the state label point (`state-labels.ts`).
- **County:** the middle of the bounding box of the county's largest polygon in `public/geo/us-counties-20m.geojson`.
- **City:** the median of the city's city-scale records (the geocoded city point they share), or of all its records when none are city-scale, rounded to the even hundredths of a degree (about two kilometers). Rounding keeps a one-record city from putting its token on a street address.
- **Square:** the square's own center, a fixed grid point, never a record's point.

Until the county geometry loads (it is fetched from zoom 4), the county level falls back to state tokens; the plate regroups when the geometry arrives.

---

## The map in the living archive (spec, 2026-11-15)

**Binding** for `/explore`, the home map and every embed (record rail, story inset, reading-room slot). Replaces the copper count tabs, the paper name flag and the flat-marks rule of the first plate.

### Point of view

The map is the archive's register laid on an atlas. A place is an entry in that register, so it is set the way the rest of the site sets an entry: a copper numeral (the count, in the numeral role) beside a name in mono capitals (the meta role). There are no badges, pills or bubbles anywhere on the plate. A record is a pin, and the one record the reader is looking at is named the way home names its record: a paper callout card tied to its pin by an ink leader, with the record's name and one meta line. The chrome around the plate is glass, and everything read at length inside it (the column, the inspector) uses the same type roles as a record page. The reader should never meet a map idiom that exists nowhere else on the site.

### Token anatomy: a register entry

| Part | Encodes | Spec |
|---|---|---|
| Count | Record count | Copper numeral, Schibsted 800, tabular figures, centered on the place's anchor. Abbreviated past 999 ("1.2k"). Always drawn, so every record stays counted at every zoom. No box behind it: a 3px halo in the plate's land color keeps it legible, the way the plate's own type is haloed |
| Name | The place | Geist Mono capitals with meta tracking, in the plate's type color, set beside the numeral on its baseline side. States print their postal code below zoom 4.6 and their name above. Cities print in capitals too: on the plate every place name is meta, and Schibsted is kept for records. Drawn when it fits; it yields to every count and to other names |
| Size | Count step | Three steps by count (`placeTier`), tokenized: `--ds-map-count-1/2/3` for the numeral and `--ds-map-name-1/2/3` for the name. The invisible symbol layers that place them use the same values (`MAP_TYPE` in `explore-style.ts`). Never color by count |
| Hit circle | Where a tap opens the place | Invisible circle layer in three radii (`CLUSTER_RADIUS_BY_COUNT`), at least 44px across. The numeral and name take no pointer events |
| Hover / focus | Interactive answer | The numeral turns the plate's type color and the name takes a 2px copper underline; press settles the numeral to 92% |
| Summary | Count and precision mix in words | Unchanged: carried on the token, read by the scoped list header |

The precision mix is always words, never color alone. Copper and ink only. No red or alarm hues.

### Pins and areas (precision is the encoding)

- **Site** (address, site, institution): a solid copper disc with a 2px keyline in the plate's type color. No contact shadow. From zoom 12 the record's name sits beside it in Schibsted 650, the record page's name on the street.
- **Area** (campus, neighborhood, city): an open copper ring, never named as a spot.
- **County or state**: no point. A flat copper wash at 16% over the polygon, outlined only when the place is entered.
- Sizes are tokens (`--ds-map-pin`, `--ds-map-ring`), shared by the plate, the home callout's mark and the embeds.

### Selection: one callout everywhere

The selected record's pin grows 1.6x in its own shape, and a callout names it: a paper card (`data-ground="paper"`), 1px ink keyline, `--ds-shadow-float`, the record's name in Schibsted 650 and one mono-caps meta line (kind and decade, or its locality on home), tied to the pin by a 1px ink leader. Home's walk callout and the explore selection are the same component and the same CSS (`.ds-map-callout` in `shell.css`). The plate's own name for that pin steps aside so the name prints once.

### The plate (basemap)

The plate is printed, not rendered: one land tone, water one step deeper, hairline borders, the engraved waterlines in the national frame, and street ink only from city zoom. The palettes below are unchanged; what changed is everything drawn on them.

| Role | Dark (night atlas) | Light (day atlas) |
|---|---|---|
| Lower 48 (`land`) | Charcoal `#38332d` | Surface paper `#fbf8f2` |
| Land around it (`ocean` role, the background) | `#24201c` | `#efe8dc` |
| Water | Ink `#0a0a0a` | Stone sand `#cbbfad` |
| Waterlines | Paper hairlines at 24% | Ink hairlines at 30% |
| State line, country line | `#7d7468`, `#a39885` | `#a2957c`, `#6d675f` |
| Type | Paper `#f4efe5` on a charcoal halo | Ink `#2e2a24` on a paper halo |

Values live in `mapPalettes` (`packages/ui/src/tokens/colors.ts`, mirrored as `--ds-map-*` in `tokens.css`) and `plateForScheme` (`dignity-style.ts`). The ΔL* contract in `map-contrast.test.ts` holds for both.

- **Waterlines** show in the national frame only, fading in from zoom 3.4 and gone past 5.5. Lakes carry none.
- **County names** under the tokens are spaced mono-style capitals in the plate's quiet label color and yield to every token.
- **Entered place**: a 2px copper outline and a flat veil of the water color at 55% outside it. The outline is drawn only while a place is entered and at the zooms that frame it: each level fades its outline out two levels past the one that frames it (`OUTLINE_GONE_ZOOM` in `use-place-focus.ts`: state by 9, county by 11, city by 14, square by 17), so a state border never cuts across a street map after the reader selects a record inside the place.
- Marks have no gradients, glows or bevels: their information is shape and copper. Depth belongs to the chrome.

### How the type gets onto a WebGL map

Map glyphs cannot set Schibsted or Geist Mono, so the names are DOM (`components/map-stage/place-labels.ts`). MapLibre still does the cartography: the count, name and site-name symbol layers are invisible and only place their text, sized from the same `MAP_TYPE` values as the DOM. Every frame the DOM layer prints exactly the symbols MapLibre placed. Collision, hit testing and the place tap stay on the map layers.

### The chrome

Every piece of chrome is on the float plane (the `.ds-float` recipe; solid under reduced transparency) on the table's ground. The column and the strip run nearer solid (94%) because they carry reading text.

- **Column = the register.** Its head is the count as a copper numeral (`--ds-text-numeral` scale stepped down) with "records" in mono capitals, and the Filters control. Rows are the `/records` row: name in Schibsted, kind and place in meta, decade as a copper mono numeral, the grade as `GradeTag`. An entered place heads the list with its trail, its level as a mono-caps word (no copper pill), its name in the display face and the precision mix in the Newsreader serif.
- **Inspector = a record masthead in miniature.** Plate with its credit beside or under it (capped at 3:2 on wide screens and at 120px tall in the bottom sheet), the name in the display face, the decade once as a copper numeral, the summary in the Newsreader serif, then the record page's facts as ruled type rows (WHERE, EVIDENCE in mono-caps labels between ink rules), then the actions.
- **Strip = the home histogram.** Records per decade on a true time scale, in the home walk's idiom: bars in a rule tone, bars inside the chosen range in the plate's type color, the range edges and handles copper, decade labels in mono capitals.
- **Legend.** A one-line key in the strip's leading cell from 80rem up and in the Filters view below it (`MapKey`): the disc ("exact site"), the ring ("within a city or area"), the wash ("county or state"), each mark drawn beside its words.
- **Controls.** One glass stack, 44px buttons, 1.5px stroked icons in the plate's type color.
- **Geometry.** From 1024px the 380px column floats one 12px gutter in from the edges; the strip floats beside it; the controls sit above the strip. Below 1024px (phones and portrait tablets) the column is a bottom sheet, because a floating column on a 768px screen left 364px of map, too narrow to frame an entered state at its level's zoom. `chromePadding` mirrors this geometry, and where the column floats its left inset never drops below the column plus a gutter on each side (404px).

### Embeds

Embeds draw the same plate and the same marks. The place token on an embed is the register entry on glass (copper numeral, mono-caps name), the record's name sits beside its pin, and the attribution is the shared chip.

### Motion

- Entering a place is the one authored move.
- The callout and labels fade on the duration tokens; reduced motion cuts.

### Known limits

- A name that would touch a neighbor's numeral is not printed at that zoom. Dense metros name their largest places first and the rest on zoom.
- Over satellite imagery the DOM labels keep the flat plate's halo; they have not had the imagery pass the GL labels have (`plateOverImagery`).

---

## Embeds

**Code:** `apps/web/src/components/map-embed/RecordMap.tsx` and `record-map.css`, `apps/web/src/lib/map-experience/record-place.ts` (the place token, server-side), `components/theme-spine/MapInsetMoment.tsx` (story chapters), `components/room/MapMoment.tsx` and `room-kit.css` (the reading-room slot).

Every map on the site is this map. The embeds draw the same plate (`buildExploreMapStyle` with `clusteringEnabled: false`), so the night and day atlas, the waterlines and the street ink are the same style, not a lookalike. Embeds add no styling of their own beyond the frame and the token.

- **The record's mark** is the one /explore draws at its stored precision: a solid copper disc with a keyline in the plate's type color at a site, with its name in Schibsted beside it (`bindRecordName`, the `ds-site-name` label, drawn at any zoom because an embed frames closer than the plate's own name layer places); one open copper ring at a campus, neighborhood or city. Neither casts a shadow. A county or state record has no point. It shows its place as an entered place shows on /explore: a flat copper wash at 16% under the water, and a 2px copper outline, from the same polygons (`placeOutline`). Where the county polygon cannot be found for the stored point, the frame shows no area, never a guessed one. Frames never go closer than `zoomForLocationPrecision` or `EMBED_CONTEXT_MAX_ZOOM`, and the embed never moves its own camera.
- **The record in its place** is a token on the plate, bottom left, set as a register entry on glass: the count as a copper numeral and the place name in mono capitals (the `--ds-map-count-1` and `--ds-map-name-1` tokens), on a plate of the site theme's ground. No tab or box sits behind the numeral. It names the deepest place the record is counted in (city, else county, else state; `recordPlaceFor`) with the same count /explore shows when that place is entered, and links to `/explore?place=<key>&selected=<id>`, which enters the place and selects the record inside it. The token is server HTML, so it works without script. Where the server cannot read the county polygons it names the state, which is coarser, never sharper.
- **"Open on the map"** carries the place too (`mapHrefInPlace`): the record page's button keeps the reader's narrowing and adds `place=`; a story inset links straight to the place and record.
- **Neighbors** are not drawn. The token is the context. A neighbor dot would have to follow the grouping bands, and an embed's closest frame never reaches the zoom where sites that share a square draw.
- **Before the map paints** the frame is the plate's ground (`data-ground="ink"` on the frame, so it follows the site theme even inside a paper sheet) carrying the record's name and its precision in words, with the place token on it. It is page HTML: with scripting off, without WebGL, or while tiles load, the record page still says where the record is and how closely. When the map cannot paint at all the frame collapses to that plate.
- **Reading-room slot.** `MapMoment` borrows the persistent plate, so its map is already this world. Its slot is the same ground while idle, and its tag and Explore control are the same plate chips with a 44px target.
- **Unchanged:** precision wording (`precisionInWords`), the privacy rules above, cooperative gestures, and the embed is on the float plane like the explore chrome: its place token is glass, its frame a plate with a keyline, with no gradient, glow or shadow on the marks.

---

## Coincident sites

Site dots that share one stored coordinate spread on a Fermat spiral around it, ordered by record id so the layout is the same on every render. Coincident sites always share a grid square, so they spread only from zoom 14, where the step is about 28px on the 512px world. A thin ink leader runs from each spread dot back to the stored point. The stored coordinate is never changed, and the spread never implies a sharper location than the record holds: only site-precision records spread, and only around a point the archive already publishes.

City-scale records do not spread. They stay counted in their city token, because a ring of 80 rings around a city centroid would suggest 80 locations the archive does not have.

---

## Interaction and the URL

- **Tap a token:** the stage fires `placeSelect` and Explore enters the place (below). On a surface that does not listen for `placeSelect`, the stage closes in on its own, never short of the next level.
- **`?place=<key>`:** the address of a place. Keys are `state-<postal>`, `county-<5-digit FIPS>` `city-<postal>-<slug>` and `square-<column>-<row>` (pattern `PLACE_KEY_PATTERN`). A shared link enters the place on arrival.
- **List scoping:** with a place selected, the list column and the map both show exactly that place's records, inside whatever filters are on. A chip names the place and clears it. The column heads the list with the places that hold it (a trail of buttons back up: "District of Columbia / Washington"), its level as a mono-caps word, the place in the display face, and the precision mix in words in the Newsreader serif.
- **Clear:** the chip, or Clear all.
- **History:** entering or leaving a place pushes a history entry (`useExploreUrlSync`); every other lens edit replaces the current one. Back and Forward walk the places the reader entered and re-enter each one.

### Entering a place

Every way into a place (a token tap, a `?place=` link, a trail step, Back or Forward) runs one move:

1. The column swaps to the place's header and records at once, the header rising into place from already visible. The list is usable before the camera lands.
2. The camera flies to the place in the map the chrome leaves visible (`chromePadding`), in 700ms, never short of the next level's first zoom and never more than two levels past it. Reduced motion cuts.
3. The place resolves on the plate: its outline in copper (a state or county is its own polygon, a city its records' extent with a 0.01 degree margin, a square its square), and everything outside recedes under a flat veil of the plate's water color at 55% (ink on the night atlas, stone sand on the day one). No gradient, glow or blur.
4. Only the place's records are on the map, so the other places' tokens are gone, not dimmed.

Leaving the place reverses it: the veil and outline fade, and the camera flies back to the frame the reader entered from (or to the country, after a cold link).

---

## Accessibility

The scoped list is the accessible path. Every token on the map has an equivalent in the list: select the place and the list holds its records, each a focusable row with its own precision in words. The canvas itself still has no keyboard path to individual tokens; that is an open item below.

Color is never the only signal. Token counts and names are text, the precision mix is text, and site dots keep their dot (site) versus ring (area) shapes. The DOM labels are `aria-hidden`: they echo the canvas, and the scoped list stays the accessible path.

---

## Privacy invariants

- No point sharper than stored public precision. Tokens sit at jurisdiction anchors; city anchors are rounded to city scale; county and state records never draw a point.
- Living-person protection is upstream (`redactLocationForPublic` in `buildMapSource`) and untouched. Grouping reads only already-redacted points.
- No red or alarm hues; color never the only signal.

---

## Open questions

1. **Period gazetteer.** Places are modern jurisdictions. County lines moved, towns were absorbed or renamed, and some Black towns and neighborhoods were erased on purpose. Grouping a 1910 record under its 2010 county can hide the place it was about. A period-aware gazetteer (historical county boundaries, named historical places with their own anchors) is the fix; until then the token names a modern place and the record page names the historical one.
2. **Canvas keyboard path.** The list is the keyboard path today. Tokens are not focusable on the canvas.
3. **Mobile.** `apps/mobile` still uses its own clustering (`features/explore/clustering.ts`). The rules live in `@repo/domain/map/place-groups` so mobile can adopt them with its own county lookup.
4. **Embed neighbors.** An embed shows its one record and its place token, never its neighbors (see Embeds). Drawing them muted would have to follow the grouping zoom bands, which an embed's closest frame (11) never reaches for sites that share a square.
5. **Spread-site flag.** The selection flag on a spread site sits at the stored point, not at the spread dot.
6. **Square names.** A square is named by its city, not its neighborhood. Records carry no neighborhood field (the jurisdiction label names a city at most), so a period neighborhood name would have to come from the gazetteer above.
7. **Square at small widths.** A square fits the free map at zoom 14 on a laptop; on a tablet in portrait or a phone the camera still lands at 14 and the square's outline runs past the frame.
