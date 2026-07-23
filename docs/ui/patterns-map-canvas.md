# Map canvas lifecycle (cross-browser)

**Code:** `apps/web/src/lib/map-experience/map-libre-lifecycle.ts`, `hero-map-inset.ts`, `MapStage.tsx`, `EntityLocationMap.tsx`.

Binding for every MapLibre mount in the web app. Target browsers: **Safari, Chrome, and Firefox** on desktop; **mobile WebKit** (iOS Safari) where map surfaces ship.

## Mount inventory

| Surface | Module | Notes |
|---|---|---|
| Home + Explore plate | `MapStage` (ADR-017 persistent canvas) | Full viewport; hero uses viewport-fixed inset |
| Entity detail | `EntityLocationMap` | Compact streets preview |
| Record anatomy | `RecordPlacePreview` → `EntityLocationMap` | Explicit `7.5rem` frame height |
| `/map` demo | `MapLibreCanvas` | Internal style lab only |

Theme-impact map strips are metadata panels, not MapLibre mounts.

## Failure modes and fixes

| Risk | Mitigation |
|---|---|
| `clip-path` on WebGL parent (Safari compositor) | Hero inset uses fixed `top/left/width/height` via `hero-map-inset.ts`; never set `clip-path` on `.ds-map-stage` |
| 0×0 canvas at mount | `waitForContainerLayout` + `ResizeObserver` before `new maplibregl.Map` |
| Stale size after rotation / tab return | `bindMapResizeLifecycle`: `ResizeObserver`, `orientationchange`, `visibilitychange` → `map.resize()` |
| WebGL blocked or unavailable | `isWebGlAvailable()` preflight; fail-closed UI with `role="status"` |
| WebGL context loss (mobile Safari, GPU pressure) | `webglcontextlost` → degraded notice; `webglcontextrestored` → `resize()` |
| Opaque overlay blocking paint | Hero/explore chrome: `pointer-events: none` on pass-through regions; CTAs `auto` |
| MapLibre container on fixed plate | Inner `.ds-map-stage__canvas` only — never mount on `.ds-map-stage` itself |

## Fail-state copy

| Surface | Message |
|---|---|
| Home hero | Notice: map canvas could not start; list browse still available |
| Explore | `DEGRADED_MODE_COPY.map_canvas_unavailable` |
| Entity / anatomy | `Map tiles could not load. Use Open in maps for street context.` |

External maps links remain when geo resolves.

## Regression tests

- `hero-map-inset.test.ts` — geometry math, no live `clip-path` on apply
- `map-libre-lifecycle.test.ts` — shared hooks wired in MapStage / EntityLocationMap / HeroStage
- `hero-stage.test.ts` — inset + `resize()` + `orientationchange`
- `entity-page.test.ts` — `role="status"` fallback copy

## Related docs

- [`design-direction-v6-home.md`](./design-direction-v6-home.md) §5.3 — hero inset
- [`design-direction-v6-explore.md`](./design-direction-v6-explore.md) §2 — full-bleed plate
- [`design-direction-v6-entity.md`](./design-direction-v6-entity.md) §9 — map fail states
