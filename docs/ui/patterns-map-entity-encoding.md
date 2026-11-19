# Map entity encoding

**Status:** binding for how a single record is drawn on any BlackStory map, and for what kind and confidence mean on the map versus in lists. Rewritten 2026-11-13 for the place map. The earlier version (kind-family shade, evidence-sized pins, dominant-kind cluster color, four cluster steps, the Color key tab, the Group nearby toggle) no longer describes the web map.
**Code:** `apps/web/src/lib/map-experience/geo-precision.ts` (`recordMarkFor`, `precisionInWords`), `apps/web/src/lib/map-experience/record-marks.ts`, `apps/web/src/app/map/explore-style.ts`.

---

## Grouping lives elsewhere

How records group into state, county and city tokens, the zoom thresholds, anchors, coincident-site spreading and the `?place=` URL are specified in [`patterns-place-map.md`](./patterns-place-map.md). This document does not restate them.

---

## The mark is decided by stored precision alone

`recordMarkFor(precision)` maps the stored public precision to one of three marks. Kind, confidence and evidence count never change the mark.

| Mark | Precisions | Meaning | Words (`precisionInWords`) |
|---|---|---|---|
| Dot (solid) | address, site, institution | The archive holds the site | "Exact site" |
| Ring (hollow) | campus, neighborhood, city | The archive holds an area, not a street corner | "Campus-level location, not an exact address", "Neighborhood-level location", "City-level location" |
| None | county, state, country | No point is drawn. The record is counted in its jurisdiction tag | "County-level location", "State-level location" |

An unclassified precision fails soft to a ring. Every surface that prints a precision (record pages, the inspector, `RecordMap`) uses `precisionInWords`, so the wording is the same everywhere. Map camera zoom for a framed record follows the same precision (`zoomForLocationPrecision`).

---

## What kind and confidence encode

| Signal | On the map | In lists, cards and record pages |
|---|---|---|
| Kind | Nothing. Dots and rings are one ink regardless of kind | `KindGlyph` (shape icon) in record rows, the Door chapters and saved drawers. `KindBadge` (icon plus kind name) in the Explore result list |
| Confidence | Nothing | `ConfidenceMark` beside each result row. `GradeDot` (A filled, B ringed, C outline) for an evidence grade named in the abstract, such as the evidence-floor chips |
| Precision | Mark shape (dot, ring, none) and the words above | The same words, in the scoped list note and on each row |

Color is never the only signal. Copper and ink only, with no red or alarm hues. Copper is for selection and active chrome, not for filling records.

---

## Filters

The Kind facet and the other facets still filter which records appear. They do not restyle the marks that remain.

---

## Mobile still runs the older encoding

`apps/mobile` has not adopted this spec. It still paints kind-family shade, evidence-sized pins and its own pixel clustering. Mobile must switch to the shared `@repo/domain/map/place-groups` module for grouping and to the precision marks above. Files to change:

- `apps/mobile/src/features/map/entity-paint.ts`
- `apps/mobile/src/features/map/kind-encoding.ts`
- `apps/mobile/src/features/map/marker-size.ts`
- `apps/mobile/src/features/explore/MapColorKey.tsx` (the Color key has no counterpart on the web map any more)
- `apps/mobile/src/features/explore/clustering.ts` (grouping, per `patterns-place-map.md` open item 3)

Until then, [`../mobile/design-direction-v6-explore.md`](../mobile/design-direction-v6-explore.md) describes what mobile actually ships.

---

## Map dignity (non-negotiable)

- Points render at stored precision. A coarsened point is never labeled or drawn as an exact address.
- No alarm hues for violence-adjacent records, and no crime-heat treatment.
- Living-person protection is upstream of the map (`redactLocationForPublic`) and unchanged.

---

## Tests

| Module | File |
|---|---|
| Precision marks and wording | `geo-precision.ts` tests, `record-marks.test.ts` |
| MapLibre paint | `explore-style.test.ts` |
| Feature denormalization | `build-explore-map-source.test.ts` |
