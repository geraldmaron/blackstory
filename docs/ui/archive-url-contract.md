# Archive parameter and SEO contract

**Status:** binding for phase 4b. Written 2026-11-23 in phase 4a from the code and from the dev
server's own output on live data. It records what exists. Phase 4b (the `/archive` route) is
tested against this file: every row here either still holds after the routes collapse, or 4b
names the row it changes and why.
**Parent:** [`DESIGN.md`](./DESIGN.md) section 9.2. Earlier state model, kept as history:
[`v10/discovery-state.md`](./v10/discovery-state.md).

How to re-check it: the canonical, robots, redirect and sitemap table in section 6 was produced
by fetching each URL from the dev server and reading the response. Phase 4a ran that fetch before
and after its changes and the output was identical.

## 1. The shared filter model

One type, `RecordsQuery` in `apps/web/src/lib/records/records-query.ts`, parsed by
`parseRecordsQuery` and printed by `recordsQueryString`. The edge runs the same pair to
canonicalize `/records`. Explore's parser (`parseExploreSearchParams` in
`lib/map-experience/url-state.ts`) calls `parseRecordsQuery` for every shared field, so a value
one view accepts, lowercases or drops, the other does too. Matching is shared as well: both views
filter through `matchesExcept` in `lib/records/records-matching.ts`.

The only translation between the list model and the map's view state is the pair in
`lib/discovery/explore-collection.ts`: `recordsQueryFromExplore` and
`exploreViewFromRecordsQuery`. `buildAtlasHref` and the record page's return links
(`lib/discovery/discovery-state.ts`) go through that pair.

| Field | `/records` key | `/explore` key | Values | Notes |
| ----- | -------------- | -------------- | ------ | ----- |
| Query | `q` | `q` | Free text, whitespace collapsed, 120 characters at most | Substring match on name, place and summary. No misspelling tolerance |
| Kind | `kind` | `kind` | A kind family (`people`, `places`, ...) or an exact kind (`school`); slug, lowercased | An unknown slug matches nothing on both views and shows as a removable chip |
| Era | `era` | `era` | One stored decade bucket, `1950s` | Exact bucket match |
| Decade range | `periodStart`, `periodEnd`, `includeUndated` | same | Four-digit decade starts; `includeUndated=1` | Reversed bounds are reordered. A bound that is not a decade start becomes `invalid`, which shows an error and matches nothing. Without a bound `includeUndated` is dropped |
| State | `state` | `state` | Two-letter postal code, uppercased | |
| Topic | `topic` | `theme` | A topic id in the domain registry | **Spelled differently.** 4b picks one and redirects the other |
| Evidence | `evidence` | `floor` | `A`, `B` or `C`: that grade and up | **Spelled differently.** Same rule |
| Status | `status` | `status` | Slug | |
| Story collection | `collection` | `collection` | `story:<slug>`, or the sentinels `missing` and `invalid` | An unknown story redirects (307) to `collection=missing`. An unresolved collection matches nothing, never everything |
| Sort | `sort` | `sort` | `era`, `name`, `evidence`. The default, `discovery`, is never written | See section 3 |
| Selected record | `selected` | `selected` | A record id | On the map it opens the record. On the list it is return context only (new in 4a, section 2) |
| Selected place | `place` | `place` | `state-ga`, `county-13121`, `city-ga-atlanta`, `square-x-y` | On the map it narrows the map and its list to that place. On the list it is return context only and the page says so (new in 4a) |
| Layout | `layout=chronology` | `layout=chronology` | | On the list it is the Timeline view. On the map it is return context only |

## 2. View-specific parameters

These are not part of the shared model. They do not survive a visit to the other view.

| Route | Key | Meaning |
| ----- | --- | ------- |
| `/records` | `page` | 100 rows a page. `page=1` is never written. A page past the end renders the last page |
| `/records` | `seed` | The shuffle behind the default order (section 3). Never in the canonical |
| `/records` | `view=timeline`, `layout=timeline` | Read only, as spellings of `layout=chronology`; redirected (308) to it |
| `/records` | `selected`, `place` | Return context from the map. Never filter the list, never in the canonical, and a URL holding either is `noindex, nofollow` |
| `/explore` | `tone`, `confidence` | Exact-match filters with no control in the current map chrome; old links still narrow by them |
| `/explore` | `layerMode`, `popGeo`, `popDecade`, `popFrom`, `popTo` | Area shading and its census vintage |
| `/explore` | `sat`, `lines`, `decade`, `edge` | Satellite ground, relationship lines, their decade slice, a selected line |
| `/explore` | `radius`, `near` | A distance preset and the typed place's label. Not written by the current chrome: a typed or device place is held in memory only |
| `/explore` | `find=place` | Opens with the place field focused. `/locate` redirects here |
| `/explore` | `density`, `panels`, `hidePanels` | Read only, for old links. Never written back |
| `/explore` | `lat`, `lng`, `zoom` | **Dropped at the edge** (`EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS`) and never written. The camera is not in any address |

Explore's list has three display orders that are never in the URL: earliest, latest and nearest.

## 3. Sort stability

- Every order puts internal-looking labels last and breaks ties on the record name, so no order
  is unstable for rows that tie on its key (`comparatorFor`).
- `discovery`, the default, is relevance when there is a query and a seeded shuffle when there is
  not. A bare `/records` draws a seed per request, writes it into the address without a
  navigation (`SeedInAddress`), and carries it on its own page, filter and row links, so page 2
  continues the same shuffle. The seed is dropped under any other sort or when there is a query.
- The map does not receive the seed. Going list to map to list starts a new shuffle.
- On the map the default order is best evidence first.

## 4. Pagination

`/records` only. 100 rows a page, `rel="prev"` and `rel="next"` link elements as well as the
anchors, page capped at 1000 at the parser and at the real page count on render. Choosing a
filter or an order returns to page 1. `/law` renders its whole catalog on one page; its `page`
key is accepted and normalized but changes nothing. `/books` has no pages.

## 5. History

Explore rewrites its address with `replaceState` as filters change, so filters do not add
history entries; entering or leaving a place is the one `pushState`. Records filters are links,
so each is an entry. The Map, List and Timeline links are plain anchors and each is an entry.
Phase 4a checked nine filter sets through map, list, map, Back, Back, Forward, Forward and a
reload, with the address and the membership sentence equal at every step.

## 6. Canonical, robots and redirects

Observed on the dev server, 2026-11-23, before and after phase 4a (identical).

| URL | Status | Canonical | Robots |
| --- | ------ | --------- | ------ |
| `/explore` | 200 | `/explore` | index, follow |
| `/explore?<any query>` | 200 | `/explore` | noindex, nofollow |
| `/explore?...&lat=&lng=&zoom=` | 308 to the same URL without the three | | |
| `/explore?<unknown key or tracking key>` | 308 to the URL without it | | |
| `/records` | 200 | `/records` | default (indexable) |
| `/records?page=2` | 200 | itself | default |
| `/records?<one facet>` (`kind`, `era`, `state`, `topic`, `status`, `evidence`) | 200 | itself | default |
| `/records?sort=name` | 200 | itself | default |
| `/records?<two or more of: facet, sort, page>` | 200 | itself | noindex, nofollow |
| `/records?q=...` | 200 | itself | noindex, nofollow |
| `/records?periodStart=...`, `?layout=chronology`, `?collection=...` | 200 | itself | noindex, nofollow |
| `/records?kind=people&page=999` | 200 | `/records?kind=people&page=5` (the last page) | noindex, nofollow |
| `/records?periodStart=18` | 308 to `/records?periodStart=invalid` | | |
| `/records?view=timeline` | 308 to `/records?layout=chronology` | | |
| `/records?<unknown key>` | 308 to the URL without it | | |
| `/records?...&selected=` or `&place=` (new in 4a) | 200 | the URL without `selected` and `place` | noindex, nofollow |
| `/search?q=tulsa` | 308 to `/records?q=tulsa` | | |
| `/search?q=tulsa&kind=all&era=1920s` | 308 to `/records?q=tulsa&era=1920s` | | |
| `/history` | 308 to `/records` | | |
| `/locate` | 308 to `/explore?find=place` | | |
| `/law` | 200 | `/law` | index, follow |
| `/law?q=vote&page=2` | 200 | `/law?q=vote` | noindex, follow |
| `/books`, `/books?state=GA` | 200 | `/books` | index, follow |
| `/presidents`, `/collections` | 200 | itself | index, follow |

Rules behind the table:

- **Explore.** The canonical is always bare `/explore`. Any query makes the page
  `noindex, nofollow` (`app/explore/page.tsx`).
- **Records.** The canonical is self-referential and carries the narrowing, in one fixed key
  order (`recordsQueryString`), minus the seed and minus the map's return context. A page is
  indexable when it is the bare list, plain pagination, one facet, or one non-default sort;
  anything else is `noindex, nofollow` (`isRecordsCombinationQuery`). Facet links that lead to a
  non-indexable page carry `rel="nofollow"`. An unresolved collection or unreadable range is
  never indexable.
- **Edge.** `/explore`, `/records`, `/search` and `/law` are canonicalized at the edge
  (`lib/runtime-hardening/query-normalization.ts`): unknown and tracking keys are dropped and
  values re-printed, with one 308. A reordering alone never redirects. `/books`, `/presidents`
  and `/collections` are not normalized at the edge.
- **robots.txt** disallows `/records?*&` (any combination), `/records?q=` and `/explore?` for all
  crawlers, and everything for the listed AI-training and SEO-tool agents (`app/robots.ts`).
- **Sitemap.** `/explore`, `/records`, `/law`, `/books`, `/presidents`, `/collections`,
  `/stories`, `/data` and `/memorial` are listed bare. No sitemap URL carries a query (0 of
  4,473 on 2026-11-23).

## 7. Lens pages

| Route | Keys read | Indexing |
| ----- | --------- | -------- |
| `/law` | `q`, `kind`, `topic`, `status`, `sort` (`chronological` default, `title`), `page` | Canonical is the cleaned URL without `page`. `noindex, follow` when there is a query or a non-default sort. A value no law carries is dropped |
| `/books` | `q`, `state`, `author`, `sort`, `dir`, `view=states` | Canonical always `/books`; always indexable. A state or author no title carries is dropped |
| `/presidents`, `/collections` | none | Indexable |
| Inventions | There is no inventions index route. Invention records live at `/invention/[slug]` | |

The lens pages keep their own parameter names and do not share the model in section 1. `/law`'s
`kind` and `topic` are the legal catalog's vocabulary, not the archive's. Folding them into the
shared model is 4b's work.

## 8. Privacy

No URL, storage key or request carries the map camera or a device location. Checked in 4a by
granting a fake device position, pressing the locate control, then reading the address, the
list link, local and session storage, and all 1,234 requests the session made. The map's tile
requests go to the tile host and name tile coordinates, which follow the camera as on any web
map; they carry no device position. A typed place is sent for lookup (the page tells the reader it
goes to the U.S. Census geocoder) and, by reading the code, is not written to the address; that
last point was not exercised in the browser.

## 9. Known gaps, for 4b

- Topic and evidence are spelled differently on the two routes (section 1).
- The list does not narrow to a place selected on the map; it carries the place back and says
  so. A place filter on the list needs the place groups server-side.
- `page` and `seed` do not survive a visit to the map.
- Map-only state (layers, satellite, `tone`, `confidence`) does not survive a visit to the list.
- A misspelled query returns nothing on either view; DESIGN.md section 10 asks for tolerance.
- With JavaScript off, `/explore` and `/records` show only their loading shapes: each has a
  `loading.tsx`, so the page streams into a block that script reveals. The filtered rows and the
  view links are in the HTML. This is the same cause the record routes had; commit `92edc1056`
  removed it there and left the index pages needing script on purpose.
