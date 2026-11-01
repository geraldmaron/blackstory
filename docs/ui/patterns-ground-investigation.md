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
| Place record (`/place/*`, `/entity/*`) | One record, with the way back | `app/HomeFirstPaint.tsx`, `home-first-paint.css` |

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

## 6. Do / Don't

**Do** keep every number and href from its existing builder; keep counts labeled by what they
measure; use only kit tokens; keep 44px targets and `:focus-visible` rings.

**Don't** add gradients, shadows or blur; invent collections, counts or statistics; imply a
relationship from shared membership or proximity (P-02); sharpen a point past stored precision (P-03).
