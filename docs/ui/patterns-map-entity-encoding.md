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

Five groups share one shade each. Micro-kinds remain in data, badges, and spotlight copy.

| Family | Label | Micro-kinds | Shade token | Representative glyph |
|---|---|---|---|---|
| `people` | People | person | `kindPerson` | circle |
| `places` | Places | place, school | `kindPlace` | circle |
| `organizations` | Organizations | organization, institution, movement | `kindOrganization` | ring |
| `events` | Events | event, case | `kindEvent` | diamond |
| `sources` | Sources | law, publication, artifact, other | `kindLaw` | square |

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
