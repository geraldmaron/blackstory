# ADR-013: Map stack — MapLibre GL JS, tile strategy, and the dark archive basemap

- **Status:** Accepted
- **Date:** 2026-07-17
- **Bead:** BB-070 (map data platform and tiles)
- **Depends on:** ADR-004, ADR-008, ADR-010, ADR-011, BB-014, BB-015, BB-019, BB-026
- **Blocks (data platform for):** BB-051 (results list and national map experience)

## Scaffold vs target

| Aspect | Today (this bead) | Target (BB-051 and beyond) |
|--------|--------------------|------------------------------|
| Map library | MapLibre GL JS wired into a demo route (`apps/web/src/app/map`) | Same library, full national map experience (BB-051) |
| Map source build | Pure, tested `buildMapSource` in `@repo/domain`, run once against fixtures by a script | Called by the release-activation pipeline on every publish (see "Release-coupled build" below) |
| Basemap | Demo-stage: MapLibre background + line/circle layers only, no tile source, zero network requests | Self-hosted Protomaps PMTiles dark/desaturated style served from Firebase Hosting/CDN |
| Data volume | 9 fixture entities, flat GeoJSON | Everything-active population; flat GeoJSON until volume demands vector tiles |
| County boundaries | Not vendored; county aggregate only populates from upstream jurisdiction hints | Real polygon-based county attribution if/when justified |

## Context

The owner's brief for the 2026-07-17 course-correction review was explicit: "the map is a huge element of what we are doing ... populate with everything active." No map library exists anywhere in the repo today — `packages/ui/src/components/MapFrame.tsx` positions pins by hardcoded x/y percentages, which cannot represent real geography. The domain layer already has real geo primitives (BB-014 geohash encode/prefix, `GeoGeometry`, public precision levels) and BB-015's redaction layer explicitly exists to protect maps (`redactLocationForPublic` coarsens coordinates and geohash together specifically because "protects maps" is called out in its own doc comment). This ADR picks the map library, the tile-serving strategy, and the basemap's visual register, and records the perf and degraded-mode posture for the underlying data platform.

Two adjacent ADRs already set doctrine this one must fit inside:

- **ADR-008** (search and geocoding): bounded, static-first queries against released public projections; no separate search/query platform until measured need; U.S.-only scope (50 states + D.C.).
- **ADR-011** (Firestore system of record): geohash + lat/lng on projection documents, no PostGIS; cost/efficiency-driven, stay inside the Firebase-native surface where possible.

## Decision

### 1. Map library: MapLibre GL JS

MapLibre GL JS (BSD-2-Clause) renders the map. Rationale:

- **License and vendor independence.** BSD, no API key required to render, no runtime dependency on a single commercial vendor — consistent with this project's repeated preference (ADR-002→ADR-011, ADR-008) for avoiding vendor lock-in and fixed subscription cost before measured need.
- **Self-host friendly.** Works directly against static tile archives (PMTiles) or any vector-tile source over plain HTTP — fits the "stay inside Firebase Hosting/CDN economics" pattern already established for the rest of the public surface.
- **Fits the existing security posture.** Any future dynamic tile/query endpoint (not built in this pass — see "Out of scope" below) would sit behind the same App Check + BB-026 guardrail middleware every other `api-public` endpoint uses; MapLibre has no opinion about that and doesn't fight it.
- **Real GeoJSON support.** Renders our GeoJSON `FeatureCollection` output directly as a `geojson` source — no format translation layer needed between `buildMapSource`'s output and the renderer.

Mapbox GL JS was not considered: it moved to a non-OSS license after the version MapLibre forked from, which conflicts with this repo's license posture elsewhere (BSD/MIT dependencies). Leaflet was considered and rejected: it has no native vector-tile/GeoJSON-at-scale story on par with MapLibre's GPU-accelerated rendering, and would need a plugin ecosystem to reach feature parity, adding more third-party surface, not less.

### 2. Tile strategy: self-hosted Protomaps PMTiles (preferred), managed MapTiler (fallback)

**Preferred: self-hosted Protomaps PMTiles served from Firebase Hosting/CDN.**

PMTiles packages an entire vector tile archive as a single file that clients read via HTTP range requests — no tile server process required. That file can sit in Firebase Hosting (or a GCS bucket behind the same CDN this project already uses for public snapshots per ADR-004) exactly like any other static public asset.

| Cost driver | Self-hosted PMTiles | Managed MapTiler Cloud |
|---|---|---|
| Basemap authoring | One-time (+ periodic refresh) engineering effort to build/style a U.S.-extract PMTiles archive (Protomaps' basemap build tooling or `planetiler`) | None — vendor provides ready vector tiles and styles |
| Serving cost | Storage (cents/GB/month) + CDN egress on the same Firebase Hosting/CDN already paid for the rest of the site; a client's initial viewport load is tens of KB–few MB via range requests, not the whole archive | Per-map-load / tiered subscription pricing that scales directly with traffic; exact current tier pricing should be reverified at implementation time since vendor pricing changes independent of this ADR |
| Ongoing vendor dependency | None — an outage or price change at Protomaps (a tiling *format and tool*, not a hosted service we call at runtime) does not affect a rendered map, because the archive already lives in our own CDN | API key management, rate limits, and a live third-party dependency in the render path |
| Fit with existing doctrine | Matches ADR-011/ADR-008's "stay in Firebase-native, cost-controlled, no new managed platform before measured need" | Would be the first paid third-party SaaS dependency in the public render path |

**Fallback: managed MapTiler** if authoring/maintaining the self-hosted PMTiles basemap turns out to cost more engineering time than the team can absorb in the BB-051 timeframe. MapTiler ships ready-made vector tiles and styles under a MapLibre-compatible API, so switching later (or starting there and migrating to self-hosted once traffic/cost justifies the authoring investment) is a source-swap, not a rendering-library swap — this is exactly the kind of narrow, reversible vendor boundary ADR-011's "migration triggers" pattern favors over an irreversible one.

This bead does **not** ship a production PMTiles basemap archive — that is real geodata-authoring work out of scope for a data-platform bead. The demo route (see "What this bead actually ships" below) proves the rendering pipeline without it.

### 3. Basemap style: custom dark, desaturated — the "archive of record" register, not a tourism basemap

BB-051's design notes are explicit that a bright, cheerful, street-map/tourism-style basemap is the wrong register for a historical-record product; EJI's lynching-memory map and Mapping Police Violence's incident map both use a dark, desaturated register precisely because the content is historical/civic record, not a travel aid. Native Land's map additionally establishes "presence, not just pins" as a pattern this product's state/county aggregates deliberately mirror.

Concretely: `background-color` is Black Ink (`#0A0A0A`, `brandPalette.blackInk`); entity points render in Copper Pin (`#B86B2A`) with an Archive Paper (`#F4EFE5`) stroke for contrast against the dark canvas; any line/boundary layer uses the dark theme's low-contrast border tone (`darkTheme.border`), never a bright saturated color. **The map canvas is a fixed dark register regardless of the surrounding site's light/dark theme toggle** — the same way a printed archival map insert in a book doesn't recolor itself to match the page around it. See `packages/ui/src/tokens/brand-palette.ts` / `colors.ts` and `docs/ui/brand.md` for the token source; the map style pulls those tokens directly rather than hardcoding parallel hex values, so it cannot drift from the rest of the brand system.

The demo route's style (`apps/web/src/app/map/dark-archive-style.ts`) is a MapLibre style with **background + line + circle layers only — no tile source, no glyphs/sprite** — see "What this bead actually ships" for why, and "Known gaps" for what a target PMTiles-backed style adds on top.

### 4. Map data platform: pure, redaction-injected builder

`packages/domain/src/map/map-source.ts` exports `buildMapSource()`, which takes every active public-projection entity with a location and produces:

- a GeoJSON `FeatureCollection` of every geo-anchored entity (point features) — the "everything-active" population, no curated subset;
- state-level presence/density aggregates (count bucketed by approximate state, keyed by FIPS + postal code + name);
- county-level aggregates, populated only where an upstream jurisdiction hint is supplied (see "Known gaps" — this repo does not vendor county polygon boundary data).

**Hard invariant:** `buildMapSource` never reads a raw coordinate for output. It is dependency-injected with a `redactLocation` port function structurally identical to `redactLocationForPublic` from `@repo/security`; every coordinate that reaches a feature or aggregate is the *return value* of that function, never the raw input. This is enforced by construction (the function body only ever reads `.lat`/`.lng` off the redaction result) and proven by a regression test (`map-source.redaction.test.ts`) that wires the **real** `redactLocationForPublic` — not a stub — against a fixture with a precise living-person residential coordinate, and asserts the exact raw value never appears anywhere in the serialized output.

`buildMapSource` lives in `@repo/domain`, not `@repo/security`, deliberately: `@repo/security` already depends on `@repo/domain` at runtime, so the reverse edge would be a circular workspace dependency. The dependency-injection ("port") pattern avoids that entirely — `map-source.ts` has zero runtime import of `@repo/security`. (`@repo/security` is a **devDependency** of `@repo/domain`, used only by the regression test and the demo-data generator script — this follows existing precedent in this repo: `@repo/security` and `@repo/observability` already have the same kind of devDependency-only cycle.)

### 5. Release-coupled build (not wired live this pass)

BB-019's release model (ADR-004) already versions public projections and the search index with each immutable release, with instant rollback via the active-release pointer. The map source must join that same discipline: **on release activation, rebuild the map artifacts from the release's active public projections; rollback restores the prior map version automatically, the same way it restores the prior search-index version, with no separate map-specific rollback code.**

This bead does not wire that call live — there is no release-activation pipeline that iterates every public projection and calls `toPublicEntityProjection` yet in *any* language (Python `workers/publication/src/black_book_publication/release.py` only has manifest/hashing helpers today; nothing calls it end-to-end over live entities). Building that pipeline is a larger, separate piece of work than this data-platform bead. Wiring it in place of leaving it undone would mean guessing at an interface that doesn't exist yet and risking real drift from whatever the actual release-activation implementation ends up looking like.

**Exact integration point**, documented in both `packages/domain/src/map/map-source.ts`'s module doc comment and `workers/publication/MAP_SOURCE_INTEGRATION.md`:

1. Wherever the release pipeline builds `ReleaseArtifact`s per entity (see `packages/domain/src/publication/index.ts` `buildReleaseManifest`), also collect every entity's `location` into a `MapSourceEntityInput[]`.
2. Call `buildMapSource({ releaseId, generatedAt, entities, redactLocation: redactLocationForPublic })`.
3. Persist the result as three more release-scoped artifacts (mirroring `publicEntitySnapshotPath`'s layout): `public/releases/{releaseId}/map/source.json` (FeatureCollection), `.../map/state-aggregates.json`, `.../map/county-aggregates.json`.
4. Hash each with `sha256Json` and add matching entries to the signed release manifest, the same way entity projections/snapshots are hashed — so manifest verification covers the map artifacts too, and a tampered map source is detectable exactly like a tampered entity projection.

Until that lands, `packages/domain/src/map/generate-demo-map-source.ts` performs the same operation against fixture data as a one-off script, producing the static artifact the `/map` demo route reads. This is not dead code nobody would invoke — it is the exact shape of call the real integration will make, run once to prove the pipeline works end to end.

### 6. What this bead actually ships (demo-level integration, not BB-051)

Per the bead's own scope note, BB-051 (results list + national map experience, clustering, etc.) is a separate, larger, still-blocked bead that *consumes* this data platform. This bead ships:

- `packages/domain/src/map/` — `buildMapSource`, U.S. state reference table (`us-geography.ts`), fixtures, and three test files (pure-logic tests, the critical redaction regression tests, and U.S.-geography tests).
- `packages/ui/src/components/MapExplorer.tsx` — a presentational shell (accessible feature/state legend + a `children` slot for the interactive canvas) with zero MapLibre dependency, so it stays SSR-safe and testable via `renderToStaticMarkup` the same way every other component in that package is. `MapFrame.tsx` (schematic x/y pins) is left in place rather than replaced — three existing pages depend on its exact prop shape and were out of this bead's file ownership to edit; `MapExplorer` is the real-geography component that supersedes it for new usage.
- `apps/web/src/app/map/` — a new demo route: `MapLibreCanvas.tsx` (the only file in this bead with an actual `maplibre-gl` import and its required CSS), `dark-archive-style.ts` (the style described above), `page.tsx`, and the generated `map-source.seed.json` fixture artifact, rendered against `apps/web/src/data/public-seed.ts`'s sibling seed-data pattern (there is no live Firestore release to build from yet).

## Perf budget

**Target payload sizes** (documented target, not yet measured against a live deployment — see "Measurement plan"):

- State + county aggregate response: well under 20 KB gzipped at full 51-state scale — this is small, fixed-shape JSON (count, name, FIPS per row) and should load essentially instantly regardless of point volume, so national-zoom "presence" rendering never waits on per-point data.
- Flat GeoJSON `FeatureCollection` (current strategy, per ADR-008's bounded/static-first doctrine): target ≤ 2 MB gzipped for the full active-release population at initial product scale (tens of thousands of points). Point properties are kept minimal (`entityId`, `kind`, `displayName`, `precision`, state fields) specifically to keep this small — no embedded claims/citations/timeline data, which stays behind the existing per-entity page fetch.
- **Migration trigger:** if the active-release point count pushes the flat GeoJSON past that budget, move to PMTiles/vector tiles for per-point data (same self-hosted-preferred strategy as the basemap) rather than growing the flat file further — this mirrors ADR-011's "migration triggers" pattern (a measured threshold, not a guess, decides when to add complexity).

**Lazy-loading strategy:** state/county aggregates load first and render immediately at national zoom (presence rendering per Native Land's pattern); the full per-point `FeatureCollection` loads once, in parallel, and populates points as the aggregate view is already usable. Beyond that, deferring per-point detail further (e.g., fetching only points inside the current viewport) is exactly the kind of dynamic query BB-051 will need — and exactly what ADR-008's bounded/static-first doctrine says to avoid building until the static artifacts are measured insufficient (see "Out of scope" below).

**Measurement plan (not yet run):** the bead's acceptance criterion — "national view interactive in under 3 seconds on mid-tier mobile" — genuinely cannot be measured without a deployed environment and a real device/throttling test; fabricating a number here would be worse than stating the gap plainly. Once BB-070's artifacts are deployed (Firebase Hosting/CDN, per ADR-001), the measurement step is: a Lighthouse mobile run against the live map route with a mid-tier throttling profile (Lighthouse's default "Moto G Power"-class CPU/network throttling, or an equivalent mid-tier Android profile), recording Time to Interactive / Largest Contentful Paint for the map canvas specifically. This is a follow-up task once a deployed environment exists, not a blocker to closing this bead at repo-acceptance level (this project's established convention — see prior beads' "cloud/measurement blockers documented" pattern).

## Degraded mode

The map source is release-coupled data like every other public projection (see "Release-coupled build" above), so it **inherits ADR-004's existing snapshot/rollback mechanism** rather than needing new degraded-mode code:

- Map artifacts are versioned per release and hashed into the signed release manifest, same as entity snapshots and the search index.
- If live query APIs are disabled (ADR-004's degraded-rendering case), the map reads from the immutable release snapshot exactly like entity pages do — there is no live "map query" in this design to disable in the first place (see "Out of scope" below), so there is no separate failure mode to design for.
- Rollback to a prior release via the active-release pointer restores the prior map version automatically, with no map-specific rollback code, the same way it restores the prior search-index version.

The one real gap: none of this is wired live yet (see "Release-coupled build"), so there is nothing to degrade *from* in production today. This is the same "not yet wired" gap as the rest of the release-activation pipeline, not a map-specific one.

## Out of scope: dynamic map query endpoints

ADR-008's architecture doctrine is bounded/static-first: prefer in-product bounded queries over a new query platform until measured need. This bead does **not** add a bounding-box or any other dynamic map query API. The static GeoJSON + aggregate artifacts serve the "everything-active" population at this bead's scale; a dynamic endpoint (e.g., "give me points in this viewport") is exactly the kind of thing BB-051 may need once real point volume makes the flat file impractical (see "Migration trigger" above). If and when that endpoint is built, it **must** sit behind the same BB-026 guardrails + App Check middleware every other `api-public` endpoint uses (`packages/security/src/query-guardrails.ts`, `packages/firebase/src/app-check*.ts`) — not a new, unguarded surface.

## Known gaps (honest, not fabricated)

- **State attribution is an approximate bounding-box test, not polygon geometry.** `findUsStateForPoint` in `us-geography.ts` checks each state's rectangular bounding box (smallest-area-first, so small states like D.C. resolve ahead of larger overlapping neighbors). This is good enough for national/state-zoom presence aggregates over already-coarsened public coordinates, but it is demonstrably wrong at dense coastal-metro borders — e.g. Lower Manhattan's coordinates also fall inside New Jersey's bounding box and resolve to NJ under this heuristic. This is tested and documented (`us-geography.test.ts` "documented limitation" test), not silently wrong. Fixing it for real needs polygon boundary data (e.g. Census TIGER state shapefiles) this bead deliberately does not vendor.
- **County attribution has no coordinate-based fallback at all.** This repo does not vendor county polygon boundary data. `buildMapSource` only populates a county aggregate when the caller supplies an explicit jurisdiction hint (e.g. from the entity's `Jurisdiction`/`jurisdictionIds` records) — there is no attempt to guess a county from a bare coordinate, because a wrong guess would be worse than an honestly-missing aggregate.
- **The demo basemap is not the target basemap.** The `/map` route's style has no tile source at all (background + line + circle layers only) specifically so it renders with zero network requests in a repo-only, no-live-deployment environment. The target basemap (self-hosted Protomaps PMTiles, dark/desaturated land+water+admin-boundary style) is real geodata-authoring work this bead does not do.
- **The release-activation call is not wired live.** See "Release-coupled build" above — this is the single largest gap, and it's a real one: there is currently no code path in any language that would actually invoke `buildMapSource` against a live release. The pure function and its regression tests exist and are ready to be called from that pipeline once it exists.
- **Perf is a documented target and measurement plan, not a measured number.** See "Measurement plan" above.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Mapbox GL JS | Non-OSS license since the MapLibre fork point; conflicts with this repo's BSD/MIT dependency posture. |
| Leaflet | No native GPU-accelerated vector-tile/GeoJSON-at-scale rendering on par with MapLibre; would need a plugin stack to reach parity. |
| Google Maps / Google Maps Platform | Proprietary, API-key-gated, per-load billing from day one; conflicts with ADR-011's cost/independence rationale for staying Firebase-native. |
| Ship a real PMTiles basemap in this bead | Real geodata-authoring work (tile generation, styling, refresh pipeline) is out of scope for a data-platform bead; the demo route proves the rendering pipeline without it. |
| Build a dynamic bounding-box query endpoint now | Violates ADR-008's bounded/static-first doctrine before the static artifacts are measured insufficient; would also need BB-026 guardrails + App Check wiring this pass doesn't otherwise require. |
| Wire the release-worker call live this pass | No release-activation pipeline exists yet in any language to call into; guessing at that interface risks drift from the real implementation. Documented as an exact integration point instead (see above). |
| Put `buildMapSource` in `@repo/security` | Would need to call domain types directly for entity/location shapes, but `@repo/security` is explicitly a redaction/serialization choke point, not a data-platform module; also outside this bead's file ownership (`packages/security` is read-only for this bead). |

## Consequences

- `packages/domain` gains a `map/` module with a devDependency on `@repo/security` (test/demo-generator only, never in shipped runtime code) — this mirrors the existing `@repo/security`↔`@repo/observability` devDependency cycle already present in this workspace.
- `apps/web` gains its first WebGL/canvas-rendering dependency (`maplibre-gl`); it is isolated to a single client component (`MapLibreCanvas.tsx`) so it never touches server-rendered/SSR-tested code paths.
- The next real engineering investment for the map surface is the release-activation wiring (see "Release-coupled build") and, separately, authoring the target PMTiles basemap — both are natural inputs to BB-051, not further data-platform work.

## Migration triggers

- Move from flat GeoJSON to PMTiles/vector tiles for per-point data once the active-release point count pushes the flat file past the ~2 MB gzipped budget above.
- Move from the demo-stage empty-tile style to a real self-hosted PMTiles basemap once BB-051 needs a production map experience (this bead's demo route was never meant to ship as the public map).
- Reconsider polygon-based state/county attribution only if a specific product need (not just aesthetic accuracy) depends on getting border cases right — the bounding-box approximation is sufficient for presence/coverage aggregates.
- Add a dynamic bounding-box query endpoint only after the static artifacts are measured insufficient at real traffic/volume, and only behind BB-026 + App Check from day one.

## Rollback considerations

- Map artifacts roll back automatically with the active-release pointer (ADR-004) once the release-activation wiring lands — no separate rollback mechanism to design or test.
- If the demo route or `MapExplorer`/`MapLibreCanvas` components need to be pulled, they are additive, isolated files (new route, new component) — removing them does not affect `MapFrame`'s three existing consumers.
