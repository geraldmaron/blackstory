# Map as premier experience — plan

## Product north star

The **map is the primary product surface**. Search, entity pages, history, and methodology are off-ramps from the map — not peers that compete with it.

Visual register (ADR-013 + current brand): **black ink canvas, white strokes/labels, copper entity markers**. Not a colorful tourism basemap. Not cream Archive Paper. Rest of the world is muted gray / out of frame until we deliberately add countries later.

---

## What you asked for (mapped)

| Ask | Intent |
|-----|--------|
| Match site color scheme | Dark archive canvas + copper pins + white UI chrome |
| US-focused; gray other countries | `maxBounds` ≈ CONUS+pad; no world basemap; optional gray plate later |
| States visible / selectable | Clickable state shapes → filter/zoom + URL `state=XX` |
| Home map interactive → map experience | Pan/zoom on home; click → `/explore` with viewport (+ `selected` / `state`) |
| Premier map experience | Explore is the hub: entities, filters, density, relationship lines, decade/settings |
| Relationship lines + decade settings | Bridge History graph edges onto the map; settings panel for line mode / decade |

## What you may have missed (design for)

1. Deep links / shareable URLs  
2. Keyboard + screen-reader list peer  
3. Locate / near-me without residential precision  
4. Empty / sparse state honesty  
5. Precision / dignity (no street-level residence)  
6. Degraded mode (map fail → list)  
7. Performance (HTML markers → cluster/tiles)  
8. Real state polygons (vs bbox)  
9. AK / HI insets  
10. History ↔ Explore bridge on the map  
11. Mobile sheets  
12. Analytics / abuse guards  

---

## Information architecture

```
Home (map teaser)
  └─ interact / click → Explore (premier)
        ├─ Map canvas (US, branded, states, entities, optional relationship lines)
        ├─ Filters (kind, era, theme, confidence, state)
        ├─ Settings sheet
        │     ├─ Density presence layer
        │     ├─ Relationship lines on/off
        │     ├─ Line mode (all-time | decade)
        │     └─ Decade stepper (when lines/decade mode)
        ├─ Synchronized list + narrative card
        └─ Off-ramps: entity page, history (full graph), locate, methodology
```

---

## Phased delivery

### Phase 1 — Branded US + home→explore
- [x] Dark-archive canvas (no demotiles); CONUS `maxBounds`
- [x] Circular HTML copper pins; clickable states (bbox stand-in)
- [x] Home interactive → `/explore` with viewport / selected / state
- [x] Explore settings stub
- Bead: `black-book-0vf` (closed)

### Phase 2 — Real state polygons
- [x] Vendor simplified US state(+DC) GeoJSON (Census cartographic / public domain)
- [x] Replace bbox rectangles in explore-style (URL race fixed: empty source + client `setData`)
- [x] Keep selection + density on real shapes; CONUS camera without portrait-clipping maxBounds
- Bead: `black-book-37j` (closed)

### Phase 3 — Relationship lines + decade settings
- [x] Project History edges as map lines between entity anchors
- [x] Settings: lines on/off, all-time vs decade, decade stepper
- [x] Line click → edge panel
- Bead: `black-book-814` (closed)

### Phase 4 — Scale / polish (**next**)
- [ ] Clustering or vector tiles; mobile sheets; locate deep-link
- [ ] Self-hosted PMTiles (ADR-013 target)
- Bead: `black-book-w72`

---

## Status

- Phases 1–3 done  
- Phase 4 queued  
