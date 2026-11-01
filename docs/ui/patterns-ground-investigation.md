# Ground investigation composition

**Status:** implemented in source; rendered light/dark and 375/1280 acceptance pending.
**Scope:** how a reader enters a collection, works it on the map or in the list, and reads one
record without losing the investigation. Composition only: query, URL, source, citation and
precision contracts are unchanged.

Builds on, and does not replace: [`patterns-collection-context.md`](./patterns-collection-context.md),
[`patterns-plate-posture.md`](./patterns-plate-posture.md), [`patterns-record-page.md`](./patterns-record-page.md),
[`PROTECTED-EXPERIENCES.md`](./PROTECTED-EXPERIENCES.md) (P-02, P-03, P-04, P-06).

## 1. One investigation, four places

| Place | Role | Source |
|---|---|---|
| Home opening (`/`) | Collection entry: search, map, list, or the guided walk | `app/door-immersive.tsx`, `app/door-home.css` |
| Records (`/records`) | The list view of the collection, with the workbench above the rows | `app/records/RecordsIndex.tsx`, `records-index.css` |
| Map (`/explore`, embedded in Home browse) | The map view of the same collection | `app/explore/AtlasExperience.tsx`, `explore.css` |
| Record (`/place/*`, `/entity/*`, `/invention/*`) | One record, with the way back | `app/HomeFirstPaint.tsx`, `app/entity/[id]/EntityRecordRoom.tsx`, `components/discovery/record-investigation-return.tsx` |

The collection strip (`CollectionContext`) is the shared heading for the middle two. It never
changes membership: temporary map limits are stated separately and the collection is unchanged.

## 2. Home opening

- Opaque matte sheet clamped to the frame's left edge, as before. Two columns above 900px:
  the action column (headline, invite, search, three ways in) and the orientation column
  (spotlight place, record count, kind census). One stacked column below, orientation after actions.
- Search is a real GET form to `/records` with field `q`. It works without JavaScript. It offers no
  canned queries; there is no filter vocabulary shortcut on the sheet.
- Ways in, in order: **Begin** (guided walk, copper), **Browse the map**, **Browse the list**
  (`/records`). The census and spotlight are the existing source-derived values.
- The map is never behind long prose. The sheet is shorter than before so the framed country stays
  visible; camera framing, the plate postures and tap-to-browse are unchanged.

## 3. Records workbench

- Header: `ReadingEntry` with the scoped class `ds-records-entry`. The shared Reading posture is not
  changed. Active narrowing appears once in the find bar; the introductory lede yields when filters are active.
- Workbench (`ds-records-workbench`): the collection strip (flat variant, no box of its own), then
  the find bar with facets and sort, as one unit directly above the rows. One panel edge, not a
  card in a card.
- All narrowing stays native GET and links. Records with no mapped location stay in the list.

## 4. Map strip and rails

- The strip is a heading (the count) with the Map / Records choice as a segmented control, in the
  center band between Lens and Results. Placement offsets are unchanged.
- `data-collection="shown"` on the atlas root lets `explore.css` give Lens, strip and Results one
  edge weight. It changes no hit area, close control or selected, empty or loading state.
- Map-only limits keep their own caption, set off from the membership count.

## 5. Place record mast

- Investigation return bar above the mast: the map and list links from `PlaceDiscoveryReturn`
  (`mapHref`, `listHref`, their labels, and the position label when present). Home and rooms stay in
  the archive navigation and the off-ramp; they are not part of this bar.
- Identity: kind and era pills, name, then the record's own location and jurisdiction strings.
- Geography: when there is no photograph and a stored anchor, the framed place preview sits beside
  the text (above it on a phone) with a precision line under it. No live map behind text.
- Evidence: the glance band follows the mast, unchanged in content, citation strings and anchors.

## 5a. Investigation return across record families

One component, `components/discovery/record-investigation-return.tsx` (styles beside it), renders
the bar for every public record family: Place (`/place/*`), people and other non-standable records
(`/entity/*`), and inventions (`/invention/*`). Hrefs, the position label and narrowing wording
come from `placeDiscoveryReturn`; the component reads nothing.

- **Arrival.** Each route reads its own `searchParams` and normalizes through
  `discoveryFromSearchParams`. Supported: `q`, `sort`, `kind`, `era`, `state`, `topic`/`theme`,
  `status`, `evidence`/`floor`, and the `from` origin (legacy `explore`/`records` spellings fold to
  `map`/`list`). Nothing else is read.
- **Redirects.** `/entity` to a record's public address, an absorbed id to its survivor, and a
  wrong-family `/place` or `/invention` request all carry the arrival via `recordArrivalQuery`
  (re-serialized through `placeArrivalQuery`, never raw concatenation). Unknown, auth, token,
  `returnTo`, external params and `selected` are dropped. A bare URL gains no `?from=`. Status,
  paths and slugs are unchanged.
- **Map link.** The record room's map CTA is `returns.mapHref`, so it keeps the narrowing. The pin
  viewport is added only when a stored anchor exists.
- **Copy.** Place keeps its place wording. Other families use neutral wording when the arrival is
  not narrowed ("See this record on the map" when pinned, "Browse the map" when not), so a person
  or unmapped record never promises a pin. Narrowed arrivals use the builder's narrowing labels.
- **List position.** Previous/next and "n of N" come from the released records catalog
  (`loadRecordsCatalog`) for any family arriving with `from=list`. Random and catalog-order
  stepping ("Keep reading") is separate and unchanged.
- **Caching.** Reading `searchParams` makes `/entity/[id]` render per request, so its hourly page
  cache no longer holds the HTML. Catalog reads stay cached. `/place` and `/invention` were already
  dynamic. Metadata and canonical URLs never read the query.
- **Edge.** `/entity/*` query params must be allowed by the edge normalizer
  (`PLACE_PAGE_PARAM_ALLOWLIST` semantics) or they are stripped before the page runs.

## 6. Do / Don't

**Do** keep every number and href from its existing builder; keep counts labeled by what they
measure; use only kit tokens; keep 44px targets and `:focus-visible` rings.

**Don't** add gradients, shadows or blur; invent collections, counts or statistics; imply a
relationship from shared membership or proximity (P-02); sharpen a point past stored precision (P-03).
