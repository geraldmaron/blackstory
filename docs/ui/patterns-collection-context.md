# Pattern: collection context

One strip that names the collection the reader is holding and lets them choose how to look at it:
as a **Map** or as **Records**. Records and the embedded Explore browse surface render the same
component, so the choice reads the same in both places.

Module: `apps/web/src/components/discovery/collection-context.tsx` and `collection-context.css`.
Status: implemented; rendered, mobile and theme acceptance are not yet recorded.

## What it shows

| Line | Meaning | Source |
|---|---|---|
| View switch | Map and Records, native anchors in a `<nav>`; the active one has `aria-current="page"` | Records: `atlasHref` and `recordsHref(query)`. Explore: `buildExploreHref(collectionState)` and `recordsHref(recordsQueryFromExplore(collectionState))` |
| Collection count | Every record the shared narrowing (q, sort, facets) matches, located or not | `totalMatched` / `collectionMatched` |
| Map note | How many of those can be placed on the map and how many have no mapped location. Never says every match is drawn | `mappableMatched` / drawable collection |
| Map limit | Temporary map constraints (nearby, time sweep, overlapping pins), stated as limits on the view; the collection is unchanged | Explore only |

Membership and map constraints are different facts and are never merged into one number.

## Behavior

- Hrefs are supplied by the caller and never rebuilt in the component.
- Records is server-rendered and works with JavaScript off.
- While catalog facts are unavailable (`ready={false}`), counts read "Counting records" and the
  inactive view is plain text with `aria-disabled`, not a live link. The Explore root is also inert
  in that state.
- While Explore's instruments are inert, its loader offers a separate matching-Records link
  using the validated collection URL. That escape remains available on catalog failure.
- Count changes are announced with one polite, atomic live region, and only where the surface
  changes without a page load (`announce`, Explore). No `role="alert"`, no toolbar roving focus:
  this is navigation, so Tab moves between the two links.
- Targets are 44px; `:focus-visible` uses the kit ring; the only motion is a border-color
  transition, off under `prefers-reduced-motion: reduce`.

## Placement

- **Records:** directly under the room title, above the find bar. The OffRamp at the foot of the
  list stays as the return path after a long scroll.
- **Explore (embedded browse):** fixed between the Lens and Results columns. It is hidden with the
  chrome and while a record sheet is open. While hidden, the Results rail resumes its own count
  and "Open record list" link, so the list is always reachable. It is not on the resting home
  journey.
- At 64rem and below it spans the width under the top controls and wraps.

## Style

Kit tokens only: `--ds-surface`, `--ds-border`, `--ds-ink`, `--ds-ink-muted`, Geist for labels,
Geist Mono for the count. Opaque matte surface, one hairline, radius-md; copper only on the
active view. No shadows, gradients or blur.
