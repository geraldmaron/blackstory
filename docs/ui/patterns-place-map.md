# Place map (Explore)

**Status:** binding for how `/explore` groups records on the map, and for the home Door, which paints the same plate. Supersedes the pixel clustering the older `patterns-map-entity-encoding.md` described. That doc now covers point marks by precision only.
**Code:** `packages/domain/src/map/place-groups.ts` (the rules, shared by web and mobile), `apps/web/src/lib/map-experience/place-map.ts` (the web adapter), `apps/web/src/app/map/explore-style.ts` (layers), `apps/web/src/components/map-stage/place-labels.ts` (the names in the house type), `apps/web/src/components/map-stage/MapStage.tsx` (token tap), `apps/web/src/app/explore/hooks/use-place-scope.ts` (list scoping).

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
| Site | 11 | map maximum | A city's streets |

The thresholds are integers on purpose. MapLibre evaluates zoom inside a layer filter at integer zoom levels only, so a fractional threshold would not hold. County starts at 6 because that is where the state labels hand off to county names (`STATE_LABEL_FADE_END_ZOOM` 6.2, `COUNTY_LABELS_MIN_ZOOM` 6.2), and because a thousand county tokens at a zoom-5 multi-state frame read as noise. Sites start at 11, one step past the zoom a city-precision record frames at (10), so a framed city never shows street-level dots before the reader asks for them.

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
- **City:** the median of the city's city-scale records (the geocoded city point they share), or of all its records when none are city-scale, rounded to two decimal places (about a kilometer). Rounding keeps a one-record city from putting its token on a street address.

Until the county geometry loads (it is fetched from zoom 4), the county level falls back to state tokens; the plate regroups when the geometry arrives.

---

## Token anatomy

| Part | Encodes | Notes |
|---|---|---|
| Count tab | Record count | A copper tab at the place's anchor, Geist Mono, ink on copper with a keyline in the plate's type color. Abbreviated past 999 ("1.2k"). Always drawn, so every record stays counted at every zoom |
| Name | The place | Beside the tab, in Schibsted. States and counties in spaced capitals (a state prints its postal code below zoom 4.6, its name above), cities as written. Drawn when it fits; it yields to every count and to other names, and returns as the reader zooms in |
| Size | Count step | Three type steps by count (12, 13.5 and 16px names; `placeTier`), the same steps as the hit circle (`CLUSTER_RADIUS_BY_COUNT`). Never color by count |
| Hit circle | Where a tap opens the place | An invisible circle layer in three radii. The tab and name take no pointer events |
| Summary | Count and precision mix in words | "Washington, DC, 352 records. Of these, 272 sit at exact sites and 80 are placed within a city." Carried on the token; the scoped list header reads the mix |

The precision mix is always words, never color alone. Copper and ink only. No red or alarm hues.

---

## Visual

**Status:** the visual world of the plate, binding for `/explore` and the home Door (both paint the one `MapStage` plate). Record embeds and story insets share the plate's colors and labels but have not had their own pass. Replaces the flat paper-on-ink plate with copper count discs, solid and hollow dots, the sand county hatch and grey county names.

### Thesis

The map is an atlas plate set in the app's own type. Named places are the marks, not anonymous counts: a reader sees "JEFFERSON 58" and "Washington 80" in the faces the record page uses, at sizes that rank places the way an atlas does. It refuses the category default of colored count bubbles on a generic basemap.

### The plate

| Role | Dark (night atlas) | Light (day atlas) |
|---|---|---|
| Lower 48 (`land`) | Charcoal `#38332d` | Surface paper `#fbf8f2` |
| Land around it (`ocean` role, the background) | `#24201c` | `#efe8dc` |
| Water | Ink `#0a0a0a` | Stone sand `#cbbfad` |
| Waterlines | Paper hairlines at 24% | Ink hairlines at 30% |
| State line, country line | `#7d7468`, `#a39885` | `#a2957c`, `#6d675f` |
| Type | Paper `#f4efe5` on a charcoal halo | Ink `#2e2a24` on a paper halo |

Values live in `mapPalettes` (`packages/ui/src/tokens/colors.ts`, mirrored as `--ds-map-*` in `tokens.css`) and `plateForScheme` (`dignity-style.ts`). The ΔL* contract in `map-contrast.test.ts` holds for both.

- **Waterlines** are the plate's signature: two hairlines inside every sea coast, offset 2 and 5px, the outer one lighter, the engraved coast of a nineteenth-century atlas. They show in the national frame only, fading in from zoom 3.4 (where the whole continent and its arctic coast are in frame) and gone past zoom 5.5, where the vector coast becomes marsh and inlet detail and the lines clump. Lakes carry none, because the northern lake country would read as static. Offsets stay under the tiles' 8px render buffer so no line surfaces on a tile seam.
- **County names** under the tokens are spaced capitals in the plate's quiet label color, the atlas convention, and yield to every token.
- **Area precision** is a flat copper wash at 16% over a county (or state) that holds records known only by county (or state). It says "somewhere in here", never a point.
- No gradients, glows, bevels, glass or 3D. The only shadow is the flat contact shadow under a site pin.

### Marks

- **Place token:** the copper count tab and the name (anatomy above). Hover inverts the tab (the plate's type color behind the land color) and underlines the name in copper; press settles the tab to 92%.
- **Site pin:** a copper pin head with a ring opposite the plate (paper on charcoal, ink on paper), a flat contact shadow, and, from zoom 12, the record's name beside it in Schibsted: the record page's pin and name, on the street. A city-precision record stays an open copper ring and is never named as a spot.
- **Selection:** the pin grows 1.6x in its own shape and the paper name flag (`selection-flag.ts`) names it; its plate name steps aside so the name prints once.

### How the type gets onto a WebGL map

Map glyphs cannot set Schibsted or Geist Mono, so the names are DOM (`components/map-stage/place-labels.ts`). MapLibre still does the cartography: the count, name and site-name symbol layers are invisible and only place their text. Every frame the DOM layer prints exactly the symbols MapLibre placed, at the same anchor. Collision, the always-drawn count, hit testing and the place tap all stay on the map layers, so the labels take no pointer event and the canvas behaves as before. Counts sit above names in the style, so in MapLibre's top-down placement every count claims its tab before any name is placed.

### Motion

- A token tap eases the camera into the place's frame (420ms, never short of the next level) and scopes the list. The column then names the place the way the plate does: the level in a copper tab, the place in the display face, the precision mix in one plain sentence.
- Labels fade in on the duration tokens as places regroup by zoom; reduced motion collapses them to a cut.

### Known limits

- A name that would touch a neighbor's count tab is not printed at that zoom. Dense metros name their largest places first and the rest on zoom.
- Over satellite imagery the DOM labels keep the flat plate's halo; they have not had the imagery pass the GL labels have (`plateOverImagery`).

---

## Coincident sites

Site dots that share one stored coordinate spread on a Fermat spiral around it, ordered by record id so the layout is the same on every render. The step is 14px at zoom 11 and widens as the reader zooms in. A thin ink leader runs from each spread dot back to the stored point. The stored coordinate is never changed, and the spread never implies a sharper location than the record holds: only site-precision records spread, and only around a point the archive already publishes.

City-scale records do not spread. They stay counted in their city token, because a ring of 80 rings around a city centroid would suggest 80 locations the archive does not have.

---

## Interaction and the URL

- **Tap a token:** the camera frames the place's records, never short of the next level's first zoom, so one tap always goes one level deeper. The stage fires `placeSelect`.
- **`?place=<key>`:** the address of a place. Keys are `state-<postal>`, `county-<5-digit FIPS>` and `city-<postal>-<slug>` (pattern `PLACE_KEY_PATTERN`). A shared link frames the place on arrival.
- **List scoping:** with a place selected, the list column and the map both show exactly that place's records, inside whatever filters are on. A chip names the place and clears it. A note above the list states the precision mix in words.
- **Clear:** the chip, or Clear all.

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
4. **Record embeds.** `RecordMap` still shows one record with no neighbors (it runs ungrouped).
5. **Spread-site flag.** The selection flag on a spread site sits at the stored point, not at the spread dot.
