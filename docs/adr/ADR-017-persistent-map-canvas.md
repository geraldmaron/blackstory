# ADR-017: Persistent map canvas — one MapLibre instance across hero and explore

- **Status:** Accepted
- **Date:** 2026-07-17
- **Bead:** BB-098 (premier map: cinematic zoom and seamless page-to-map transition)
- **Depends on:** ADR-013 (map stack), BB-051 (dignity/redaction rules), BB-096 (tokens v3), BB-097 (site redesign v3)
- **Blocks:** BB-101 (redesign quality gate)

## Context

The owner's redesign brief is explicit: clicking the homepage map must not read as a page
load. "The user doesn't see a refresh of the map. Rather, they kind of zoom into the area
that they clicked into, and the rest of the page fades away or transitions away smoothly,
cleanly." The register is Johnny Harris / Vox map storytelling — a continuous camera
descending into place while the chrome yields.

Today that contract is broken at the root: `/` (HomeMapHero) and `/explore`
(ExploreMapExperience) each mount their own `ExploreMapCanvas`, and the hero's click
handler does `router.push('/explore?…')`. Every hero engagement destroys one WebGL canvas
and boots another — tile flash, camera reset, exactly the "refresh" the owner rejects.

Constraints this decision must respect:

- **App Router semantics.** Next.js preserves a layout's component instance across
  navigations between routes that share that layout; pages remount, layouts do not.
- **SSR/SEO.** `/` and `/explore` are server-rendered surfaces with real document
  content (hero copy, filter forms, synchronized result lists). The map is a client
  island; nothing about this change may move page content out of the server render.
- **Deep links and history.** `/explore` viewport + selection live in the URL and must
  keep working (shareable links, back/forward).
- **BB-051 dignity rules** hold at every zoom, unchanged by architecture.

## Decision

### Route-group layout owns the canvas (option a)

A route group `(map)` wraps the two map surfaces:

```
apps/web/src/app/(map)/
├── layout.tsx        server: fetches public entity views once, renders <MapStage>
├── page.tsx          the homepage (hero chrome over the shared canvas)
└── explore/
    ├── page.tsx      the explore surface (filters, results, narrative cards)
    └── api/route.ts  unchanged
```

URLs do not change (`/` and `/explore`); only file locations move. The group layout is a
server component that builds the base feature collection + map style once and renders a
client `MapStageProvider`, which owns the **sole** `maplibre-gl` `Map` instance for the
app. Because both pages are siblings under the same layout, navigating `/` ↔ `/explore`
re-renders the pages but never the layout: the canvas element, the WebGL context, the
loaded tiles, and the camera all survive. Map identity is preserved by construction, not
by choreography.

Pages become **surface controllers**: they render their chrome (hero text, filter bar,
result list) in normal document flow above/beside the fixed canvas and talk to the stage
through a context handle (`useMapStage()`) exposing: source data patches, view-state
application, named camera flights, and event subscription (select / state-select /
viewport). `ExploreMapCanvas`'s instance-lifecycle code moves into the stage; its
source/layer/marker management becomes per-surface wiring.

### Camera grammar: authored presets, never library defaults

Camera movement is a brand register, so flights are named presets defined as motion
tokens in `apps/web/src/lib/map-experience/camera-presets.ts` (unit-tested, auditable by
BB-101):

- `national` — the resting CONUS frame.
- `state` — flight to a state's bbox (`us-geography` bounds), long arc, slow-out easing.
- `locality` — descent toward a metro/cluster region.
- `point` — arrival at a single record, narrative card reveals on landing.

Presets carry `duration`, `curve`, `speed`, and an authored `easing` (slow-out — motion
that reads as descent into place, not a jump cut). `flyTo`/`easeTo` are always called
with a preset; raw defaults are banned by review checklist.

### Transition contract

On hero engagement (state or point click): the camera flies with the matching preset
while hero chrome dissolves (token-driven, `--bb-duration-base` class, opacity/translate
only — no layout thrash), nav condenses, and `router.push('/explore?…')` runs the same
moment. The push re-renders pages only; the flight continues uninterrupted across the
navigation because the stage never unmounts. The reverse transition (explore → home)
eases back to the `national` preset as hero chrome returns.

- **URL:** viewport + selection stay in `/explore` query params via the existing
  `url-state` module. Back/forward: pages re-render from the URL and the stage
  reconciles the camera with `easeTo` (or an instant jump under reduced motion).
- **Reduced motion:** `prefers-reduced-motion` swaps every flight for `jumpTo` and every
  dissolve for opacity-only instant cuts. Full functional parity, zero camera travel.
- **Mobile (375px):** same continuity contract — tap state → flight → full-viewport map
  with sheet UI. Clustering/PMTiles/sheet depth stay in bead black-book-w72.

## Rejected alternatives

**(b) Full-screen map app shell — every page an overlay above a base-layer map.**
Rejected. Non-map routes (methodology, facts, legal, errata…) are archive-paper reading
surfaces; forcing them to float over a live WebGL canvas taxes memory and battery on
every page for the benefit of two routes, complicates document semantics and SEO, and
inverts the brand: the map is premier *on map surfaces*, it is not wallpaper behind
prose. The blast radius of rebasing every route on an overlay system is also the most
expensive possible unwind if it proves wrong.

**(c) View Transitions API over a remounted canvas.** Rejected. VT cross-fades a
screenshot of the old view into the new one — underneath, the canvas still remounts,
tiles still cold-load, and the camera still resets. A screenshot cross-fade of a
remount is a concealed refresh, which fails the acceptance rule ("no route transition
that visibly remounts or reloads the map"), and WebKit support nuances make the one
tool doing the concealing unreliable. VT remains available later for *non-map* chrome
polish on top of option (a).

## Consequences

- `HomeMapHero` and `ExploreMapExperience` are refactored against the stage handle;
  `ExploreMapCanvas` splits into stage (instance owner) and surface wiring. The
  `maplibre-gl` dynamic import moves to the stage and remains the app's only one.
- Memory improves at the margin: one instance instead of two sequential ones, no
  churn of WebGL context creation on the hottest navigation in the product.
- The `(map)` group layout fetches entity views once for both surfaces; `/explore`'s
  page-level fetch collapses into view-model construction over the shared data.
- Homepage LCP stays on server-rendered hero text; the canvas hydrates beneath it as
  today. Map failure keeps the existing graceful fallback (notice + nav links).
- Performance acceptance (BB-098): transition holds 60fps-class smoothness on mid-tier
  hardware, measured with DevTools traces on the final build and recorded in the bead —
  not asserted.
