# Edition fact icon pattern

**Status:** reusable site pattern (2026-07-23).  
**Scope:** mono label rows on home edition entry steps and record anatomy panels (featured + spotlight).  
**Home binding:** beats 01–02 on `/` (`design-direction-v6-home.md`).  
**Explore binding:** spotlight `NarrativeCard` (`design-direction-v6-explore.md`).

---

## Intent

Entry rows (Pin / Browse / Source) and record anatomy labels (Kind / Where / Era / Evidence) should read as a typed list, not bare uppercase words. Icons reuse the same Font Awesome glyphs as Explore kind badges and confidence marks so home does not invent a second visual language.

---

## Components

| Module | Role |
|---|---|
| `apps/web/src/components/patterns/edition-fact-icon.ts` | Icon resolver: entry steps + record fact variants |
| `apps/web/src/components/patterns/EditionFactIcon.tsx` | Presentational glyph (`aria-hidden`; label text stays visible) |
| `apps/web/src/components/patterns/edition-fact-icon.css` | `ds-edition-fact-icon*` sizing and accent colors |
| `apps/web/src/components/patterns/RecordAnatomyPanel.tsx` | Shared place preview + fact grid for cards |
| `apps/web/src/components/patterns/RecordPlacePreview.tsx` | Compact MapLibre preview (client; defers WebGL) |
| `apps/web/src/components/patterns/record-anatomy.css` | `ds-record-anatomy*` layout, fact grid, map frame |

Import `edition-fact-icon.css` and `record-anatomy.css` once per route bundle that renders record anatomy (home `/`, explore `/explore`).

---

## Icon sources

| Variant | Icon | Source module |
|---|---|---|
| Entry Pin | `faLocationDot` | `@fortawesome/free-solid-svg-icons` (same glyph as place kind) |
| Entry Browse | `faMap` | `@fortawesome/free-solid-svg-icons` |
| Entry Source | `faScroll` | `@fortawesome/free-solid-svg-icons` (citation / document cue) |
| Record Kind | per-entity kind | `kindIconFor` + kind shade from `kind-icons.ts` / `kind-encoding.ts` |
| Record Where | `faLocationDot` | `@fortawesome/free-solid-svg-icons` |
| Record Era | `faCalendarDay` | `@fortawesome/free-solid-svg-icons` (same as event kind) |
| Record Evidence | tier glyph | `confidenceIconFor` from `confidence-icons.ts` |

Evidence tier colors mirror `ds-confidence-mark` in `shell.css`.

---

## Accessibility

- Icons are decorative (`aria-hidden="true"`); visible mono labels remain beside every glyph.
- Kind shade and evidence tier color never replace the text value in the fact strip.
- Map preview uses `EntityLocationMap` with `role="img"` and a visually hidden title; precision caption is plain text below the panel (never color-alone).
- When coordinates exist, the map preview and **Where** value open the device maps app via `buildExternalMapsSearchUrl` (Google Maps universal search URL: `https://www.google.com/maps/search/?api=1&query=lat,lng`). Links use `MapsExternalLink` (`target="_blank"`, `rel="noopener noreferrer"`, `aria-label="Open {place} in maps"`). No coords → preview and Where stay non-link (empty matte / plain text).

---

## Record anatomy panel layout

**Adopters:** `HomeFeaturedRecord` (beat 02) and Explore `NarrativeCard` spotlight. Never fork markup or CSS per surface — always `RecordAnatomyPanel`.

### Structure

1. **Place column (left on wide):** compact MapLibre preview via `RecordPlacePreview` → `EntityLocationMap` + `buildEntityLocationMapStyle` (OpenFreeMap streets, copper pin, theme-aware). Uses real entity `lat`/`lng` when available; empty matte state when not pinned. When pinned, the preview is wrapped in `MapsExternalLink` (`.ds-record-anatomy__place-link`).
2. **Fact list (right on wide, below map on narrow):** vertical list of **inline fact rows** (label → value on one line). **No 2×2 label-over-value grids** inside anatomy panels (see [`patterns-record-anatomy.md`](./patterns-record-anatomy.md)).
3. **Precision footer (full width):** mono caption from `radiusAffordanceLabel` when place data exists (map dignity: words-only, no overstated precision).

Each fact cell in anatomy panels (inline row):

1. **Label (left):** `EditionFactIcon` (kind uses `muted` for stone glyph) + uppercase mono field type (`Kind`, `Where`, …) in `.ds-record-anatomy__fact-label`.
2. **Value (right):** editorial serif string or copper underlined link in `.ds-record-anatomy__fact-value`, beside the label on the same row.

Entry-step rows (Pin / Browse / Source) in beat 01 keep the side-by-side grid — only record anatomy panels use this pattern.

### Map sourcing

| Field | Home | Explore |
|---|---|---|
| Coordinates | `HomeFeaturedEntity.geoAnchor` or `geoAnchorFor(id)` fallback | `feature.geometry.coordinates` |
| Precision | `locationPrecision` on entity projection | `feature.properties.precision` |
| Caption | `radiusAffordanceLabel(geoPrecisionTier, radius)` | same, from feature properties |

---

## Adoption checklist

- [ ] Import `record-anatomy.css` + `edition-fact-icon.css` on the route
- [ ] Build facts as `RecordAnatomyFact[]`; pass optional `RecordAnatomyPlace`
- [ ] Use `ds-record-anatomy__fact-link` for copper fact links (not surface-specific classes)
- [ ] Verify light + dark theme; WCAG focus on links
- [ ] Do not reintroduce equal 4-column grids with vertical hairlines
