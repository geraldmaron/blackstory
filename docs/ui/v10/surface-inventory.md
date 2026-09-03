# v10 surface inventory

**Status:** source-validated draft (2026-08-31). Rendered findings marked separately.  
**Branch:** `cursor/v10-modernization`.  
**Parent:** [`../design-direction-v10.md`](../design-direction-v10.md).  
**Audits:** [Web route inventory](9c0d6485-e773-46d8-9efa-1da92962f399), [Design doc drift](c062399d-d54d-49d1-9202-b7ca9ab225af), [Data schema cost](2af1e27f-f645-49bf-a2ae-760e9bdf262f), [Mobile + filters](4e28c3af-2658-413d-b1c4-b68e77073a8f).

## Public HTML routes

| Route | Surface class | Current purpose | Current modules | Problems (source) | Disposition | Target visual model |
|---|---|---|---|---|---|---|
| `/` | `reading` | Door: about framing + HTML pin plate | `page.tsx`, `door-home.tsx`, pin plate | v9 docs claimed Instrument here | **Keep** Rest Door | Explore Door |
| `/explore` | `instrument` | Live map | `explore/*`, MapStage, Lens, Results | Cockpit density; floor handoff fixed | **Redesign** progressive Explore/Focus | Explore Instrument |
| `/place/[slug]` | `record` | Holding place walks only (~10) | `HomeFirstPaint`, `EntityRoomSections` | Thinned anatomy; tiny hold set | **Redesign** full Place for corpus | Place Record |
| `/entity/[id]` | `record` | Full record room; 308 to `/place` only when place holds | `entity/[id]/page.tsx` | Sitemap still lists `/entity/*` | **Keep** interim; expand Place | Place Record |
| `/records` | `reading` | Crawlable non-spatial index | `records/*`, `build-records-index` | Full-catalog hydrate cost | **Keep** + slim projection | Reference Ledger / index |
| `/rooms` | `reading` | Knowledge hub beyond map | `rooms/page.tsx` | Must not read as settings | **Keep** restrained hub (v10 framing + group standfirsts) | Rooms Hub |
| `/stories` | `reading` | Editorial index | `stories/page.tsx` | Docs said `/chapters` | **Redesign** editorial archive | Story Spine (index) |
| `/stories/[slug]` | `reading` | Chapter/article | story components | Spine/map moments incomplete | **Redesign** | Story Spine |
| `/stories/mosaic-credits` | `utility` | Mosaic rights | mosaic-credits page | — | **Keep** | Utility Desk |
| `/books` | `reading` | Challenged titles index | books index | Off rooms chrome by design | **Keep**/enrich | Archive Shelf |
| `/books/[slug]` | `record` | Book detail | book detail | — | **Keep**/enrich | Archive Shelf |
| `/law` | `reading` | Law index | law browse | — | **Keep**/enrich | Reference Ledger |
| `/law/[slug]` | `record` | Law detail | law detail | No shared RecordAnatomy yet | **Keep**/enrich anatomy | Reference Ledger |
| `/data` | `reading` | Charts/indicators | data charts | Avoid BI dashboard feel | **Keep**/enrich Data Figure | Reference Ledger + Data Figure |
| `/memorial` | `reading` | Protected wall | `MemorialWallAtmosphere`, sections | Inventory once said “redesign”; **P-01 overrides** | **Keep** immutable | Memorial (P-01) |
| `/about` | `reading` | Origin + destinations | about sections | Can demonstrate pipeline | **Redesign** lightly | Reading / About |
| `/methodology` | `reading` | Evidence teaching | live Confidence/Citation | Align with production primitives | **Keep**/align | Methodology |
| `/errata` | `reading` | Corrections log | errata list | — | **Keep**/enrich | Reading |
| `/corrections` | `utility` | Submit correction | correction form | — | **Keep** | Utility Desk |
| `/corrections/status/[receipt]` | `utility` | Receipt status | status page | — | **Keep** | Utility Desk |
| `/submit` | `utility` | Lead intake | submit form | — | **Keep** | Utility Desk |
| `/support` | `utility` | Support links | support page | — | **Keep** | Utility Desk |
| `/privacy` | `utility` | Privacy | privacy page | — | **Keep** | Utility Desk |
| `/locate` | `utility` | Geocode helper | locate | Fold find into Explore later | **Merge** semantics | Utility / Explore handoff |
| `/design-system` | `utility` | Fixtures | design-system | noindex | **Keep** | Utility Desk |
| `/history` | endpoint | Decade → `/records` | history page | Keep forever (cached 308s) | **Keep** thin redirect | — |
| `/search` | endpoint | → `/records` | search page | — | **Keep** redirect | Search capability |
| `/_not-found` | utility | 404 | not-found | — | **Keep** | Utility Desk |
| root `error` | utility | Error boundary | error.tsx | — | **Keep** | Utility Desk |

## Endpoints / feeds (no chrome)

`/explore/api`, `/atlas/catalog` (now in `ENDPOINT_ROUTES`), `/search/api`, `/locate/api`, corrections APIs, `/errata/feed.*`, `/robots.txt`, `/sitemap.xml`, `/ai.txt`, `/.well-known/security.txt`, `/facts`/`/map` redirect family. Stale doc refs to `/history/api` (deleted).

## Mobile

See [`mobile-inventory.md`](./mobile-inventory.md).

## Evidence classes

| Kind | Meaning |
|---|---|
| Source-validated | Confirmed in app routes / `surface-classes.ts` / page modules |
| Rendered | Live HTTP 200 smoke 2026-08-31 on Door, Rooms, Records, Explore, Place (Dunbar + Church); entity→Place 308; Records→map `floor=B` handoff |
| Hypothesis | Browser light/dark screenshot QA still pending |

Memorial protected files listed in [`../PROTECTED-EXPERIENCES.md`](../PROTECTED-EXPERIENCES.md).
