# v10 DiscoveryState and filter architecture

**Status:** draft binding (implementation in progress).  
**Parent:** [`../design-direction-v10.md`](../design-direction-v10.md).

## Canonical shape

Surfaces may expose a subset. Shared fields must share semantics.

```ts
type DiscoveryState = {
  query?: string;
  kind?: string[]; // map kind family or micro-kind; prefer family in UI
  era?: string[];
  from?: string; // ISO or EDTF lower bound when range UI exists
  to?: string;
  state?: string[]; // USPS postal codes
  place?: string[]; // place ids/slugs when explicit place filter exists
  topic?: string[]; // TOPIC_REGISTRY ids only
  evidence?: string; // confidence band; single select
  status?: string[];
  collection?: string[];
  sort?: string;
  selected?: string; // entity/place id in focus
  view?: 'map' | 'list';
};
```

### Mapping from current Explore URL

Source: `apps/web/src/lib/map-experience/url-state.ts`, `filters.ts`.

| DiscoveryState | Explore today | Notes |
|---|---|---|
| `kind` | `kind=` (single, `'all'` default) | Promote multi later; keep single for share-compat initially |
| `era` | `era=` | Same |
| `topic` | `theme=` | Rename conceptually to topic; URL key may stay `theme` during migration with alias |
| `evidence` | `confidence=` | Same semantics |
| `status` | `status=` | Same |
| `state` | `state=` | Same |
| `selected` | `selected=` | Same |
| `query` | (search palette / `q` on records) | Unify naming: prefer `q` in list URLs |
| `view` | implicit map on `/explore`; list on `/records` | Switching must preserve narrowing |

Map-only chrome (not DiscoveryState): `layerMode`, `popGeo`, `popDecade`, `group`, `sat`, `lines`, `decade` (edge decade), `edge`, panel chrome, camera.

## Primary vs advanced (Atlas Rest → Explore)

| Tier | Filters |
|---|---|
| Primary (Explore first layer) | search/query, era, geography/state, kind |
| Advanced | topic/theme, evidence/confidence, status, population layers, relationship lines |

Rest (Door) exposes search + invitation into Explore/Records/Library — not the full Lens.

## Map/List continuity

If N records match and M have mappable precision:

> “N records match. M appear on the map.”

Do not drop query/evidence/kind when switching `/explore` ↔ `/records`.

## Facet cost

Prefer:

1. Client-side counts from compact release catalog (Explore)
2. Release facet manifest for Records index where catalog is not loaded
3. DB aggregation only when release-static counts are insufficient

Do not materialize every Cartesian filter combination.

## Implementation status

- `apps/web/src/lib/discovery/discovery-state.ts` — adapters + place return paths
- `apps/web/src/lib/discovery/continuity-label.ts` — leaf continuity copy (avoids Records↔Discovery cycle)
- `apps/web/src/lib/discovery/discovery-arrival.ts` — client-safe Place arrival query (`from=map|list`)
- Explore `floor` is in `EXPLORE_URL_PARAM_KEYS`, parsed/serialized, and seeds the Lens
- Records→Atlas `buildAtlasHref` evidence handoff survives middleware
- Place arrival params allowlisted (`PLACE_PAGE_PARAM_ALLOWLIST`); Records rows carry `from=list`
- Atlas pin/sheet walks append `from=map` + live Lens narrowing
- Lens changes rewrite `/explore?…` via `useExploreUrlSync` (floor included; no lat/lng/zoom)
- Lens primary Where/Kind; topic/evidence/layers/population under More filters (opens when advanced active)
- Records off-ramp uses `mapListContinuityLabel(matched, mappable)`
- Place list arrival supplies prev/next via `findRecordsNeighbors`
- Tests: `discovery-state.test.ts`, `use-explore-url-sync.test.ts`, `LensPanel.test.ts`, query-normalization Place allowlist

### Still open

- Slim Records hydrate (search_index / lighter row model; keep ungeocoded rows)
- Mobile Explore/History adapters onto the same DiscoveryState type

