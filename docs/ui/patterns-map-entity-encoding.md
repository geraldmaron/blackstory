# Map entity encoding (Explore)

**Status:** binding for `/explore` entity circles, Color key tab, and Kind filter facet.  
**Code:** `apps/web/src/lib/map-experience/kind-encoding.ts`, `marker-size.ts`, `explore-style.ts`, `MapExperienceLegend.tsx`.

---

## Intent

Readers should decode the map in three channels that never contradict the Color key:

| Channel | What it encodes | Count on map |
|---|---|---|
| **Shade (primary)** | Kind **family** or historical **tone** | 5 families + 3 tone overrides |
| **Shape (secondary)** | Micro-kind **glyph** (rim/fill signature) | 4 glyphs |
| **Size** | Evidence depth (single pin) or record count (cluster) | Continuous / 4 cluster steps |
| **Confidence** | Claim strength | Glyph + green→orange (never size alone) |

Map paint and the instrument Color key list the **same** families, tones, size scales, and confidence tiers.

---

## Kind families (map color)

Six groups share one shade each. Micro-kinds remain in data, badges, and spotlight copy.

| Family | Label | Micro-kinds | Shade token | Representative glyph |
|---|---|---|---|---|
| `people` | People | person | `kindPerson` | circle |
| `places` | Places | place, school | `kindPlace` | circle |
| `organizations` | Organizations | organization, institution, movement | `kindOrganization` | ring |
| `events` | Events | event, case | `kindEvent` | diamond |
| `sources` | Sources | law, publication, artifact, other | `kindLaw` | square |
| `inventions` | Inventions | invention | `kindInvention` | diamond |

**Paint:** `displayEncodingFor()` writes `properties.shade` from family (or tone override).  
**Glyph:** still per micro-kind (`properties.glyph`) for WCAG non-color channel.

---

## Historical tones (shade-only)

When `mapTone` is massacre, plantation, or epicenter, **shade** follows the tone table; **glyph** stays with the micro-kind. Tones never claim a shape. Massacre red is a controlled semantic tone, not an alarm / crime-heat layer.

Filter facet: **Tone** (unchanged).

---

## Size

### Single records

```
radius = clamp(MIN, MAX, (BASE + log2(1 + evidenceCount) × COEFF) × confidenceModifier) × zoomScale
```

- `evidenceCount`: count of accepted claims on the record (public, not a hidden score).
- `confidenceModifier`: high 1.0, medium 0.9, low/unrated 0.8 (secondary only).
- Defaults: MIN 4px, MAX 11px at locality zoom (`marker-size.ts`).

Color key shows three sample diameters at MIN / mid / MAX.

### Clusters (`Group nearby`)

Step radii from `CLUSTER_RADIUS_BY_COUNT` at locality zoom, scaled down at national zoom:

| Records in cluster | Radius (px @ z≥9) |
|---|---|
| 2–9 | 10 |
| 10–49 | 14 |
| 50–199 | 18 |
| 200+ | 22 |

Dominant kind-family shade (same palette as single pins); count label inside. Mixed-kind
clusters pick the family with the most records; ties break events → sources → organizations →
places → people. Color key lists cluster **size** steps only (radius grows with count).

---

## Confidence

High / medium / low / unrated: Unicode glyph + tier color in list rows and spotlight facts. **Not** encoded in circle radius as the primary signal.

Color key includes all four tiers beside the size sections.

---

## Filters

**Kind** facet uses the five **family** slugs (`people`, `places`, …), not twelve micro-kinds.
Micro-kind deep links (`?kind=place`) still filter that kind until re-shared as a family slug.

Other facets (Tone, Era, Theme, Status, Confidence, Where) unchanged.

---

## Map dignity (non-negotiable)

- No alarm hues for violence-adjacent records beyond the documented massacre **tone** (not crime heat).
- Color never the only signal: glyph + confidence glyph + labels.
- Points render at stored precision; coarsened points never labeled as exact addresses.
- Copper ~10–15%: selection ring, active chrome, not entity fill wash.

---

## First-paint pin plate (Explore bootstrap)

Before MapLibre paints, `/explore` renders an HTML pin plate (`FirstPaintPinPlate`, `first-paint-pin-plate.css`) over the Web Mercator CONUS board (`conus-mercator.ts`), at the plate's own opening frame and with the plate's own clusters (`first-paint-clusters.ts`). This is **not** the kind-encoded Explore stack; it is the national field the plate settles into, and it is also what a reader without JavaScript or WebGL keeps.

`/` (the Door) does not render it. The Door's only map is the live plate, framed to the Door's own map window (`door-field-frame.ts`); a static Albers board under a Mercator plate read as a second, older map on every load (repo-18ma2).

| Role | Visual | Token |
|---|---|---|
| Record disc | Page Sand disc | `--ds-first-paint-pin-ink` (`--ds-accent-muted`) / `--ds-first-paint-pin-size` |
| Holding walk | Copper disc, and the plate's only link | `--ds-accent-graphic` / `--ds-first-paint-pin-size-walk` |
| Grouped record | Hidden; a copper count disc stands in | `--ds-first-paint-cluster-ink` / `--ds-first-paint-cluster-size` |

Rem values are exported from `first-paint-pin-tokens.ts` for drift tests.

**Related but distinct:**

| Surface | Marker | Notes |
|---|---|---|
| Explore live map | Kind-shaded GL circles + `.ds-map-entity-marker` hit targets | See tables above; `ENTITY_POINT_FILL_OPACITY` = 52% |
| Place search | `.ds-map-search-center-marker` copper head + stem | Orientation only, not an entity |
| Record anatomy | `.ds-locator__pin` copper ring | City-precision honesty; ring not filled disc |
| `@repo/ui` `MapFrame` | `.ds-map__pin` Page Sand disc | Static inset, not live map |

---

## Tests

| Module | File |
|---|---|
| Family + tone encoding | `kind-encoding.test.ts` |
| Family facet filter | `filters.test.ts` |
| Legend contract | `MapExperienceLegend.test.ts` |
| Cluster dominant-family paint | `cluster-encoding.test.ts`, `cluster-expand.test.ts` |
| MapLibre paint | `explore-style.test.ts` |
| Feature denormalization | `build-explore-map-source.test.ts` |
| First-paint pin tokens | `first-paint-pin-tokens.test.ts` |
| First-paint payload | `first-paint-pins.test.ts` |

## Reader control and overlapping pins

The live browse map exposes the existing **Group nearby** toggle beside its map controls.
Grouping defaults on for broad exploration and is shareable through `group=0` or `group=1`.
A successful device-location request turns grouping off; denied or failed requests leave it
unchanged. The reader can turn grouping back on afterward. Device coordinates stay out of URLs.

Clusters expand on tap. With individual pins, a tap that hits several records opens those
records in the existing Records panel, with a clearable **overlapping pins** constraint.
Deduplicate halo and crossfade hits by entity identity. Retain names, kinds, dates and place
labels in the list. Panning or selecting another map target clears the overlap selection.
The chooser does not alter the map filter or imply that the records share a historical relation.
Never move stored coordinates to make a stack appear to contain distinct documented sites.

Research checked 2026-10-08: [MapLibre cluster expansion](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/),
[Google marker clustering](https://developers.google.com/maps/documentation/javascript/marker-clustering),
and [Leaflet overlap handling](https://leaflet.github.io/Leaflet.markercluster/).
These establish clustering and overlap disclosure patterns. Turning grouping off after Near me
is BlackStory's explicit product choice, not a universal platform requirement. A named list
fits this archive's geographic precision constraints better than displacing markers.
