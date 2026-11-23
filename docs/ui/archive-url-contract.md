# Archive parameter and SEO contract

**Status:** sections 1 to 9 record the routes as phase 4a left them (written 2026-11-23 from the
code and the dev server's own output on live data). Section 10 is the target phase 4b built, and
section 11 is what was observed once it was built. Where 10 and 1 to 9 differ, 10 is current:
`/explore` and `/records` now redirect to `/archive`.
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

## 10. Phase 4b target: `/archive`

Written 2026-11-23 before any 4b code. Sections 1 to 9 describe the routes as 4a left them; this
section is what 4b builds, and each row says which earlier row it keeps or changes. Section 11
records what was observed once it was built.

### 10.1 The address

One route, `/archive`. The path never changes with the view, the filters or the lens.

| Key | Values | Rule |
| --- | ------ | ---- |
| `view` | `map`, `timeline` | The list is the default and is never written, the way `page=1` and the default sort are never written. `view=list` is read and dropped. Changes section 1's last row: on the list, `layout=chronology` is now `view=timeline`. On the map, `layout=chronology` is still carried as return context (the reader came from the timeline), as in 4a |
| `q`, `kind`, `era`, `state`, `topic`, `status`, `evidence`, `collection`, `periodStart`, `periodEnd`, `includeUndated`, `sort` | As section 1 | The shared filter model, unchanged: same parser (`parseRecordsQuery`), same values, same matching, in all three views. `topic` and `evidence` are the one spelling; the map's `theme` and `floor` are read and rewritten. Closes section 9's first gap |
| `selected`, `place` | As section 1 | On the map they open the record or narrow to the place. On the list and timeline they are return context only, as in 4a |
| `page`, `seed` | As sections 2 to 4 | They page and order the list and timeline. On the map they are return context only: carried, never read by the map, and handed back on the List and Timeline links while the filters are the ones they arrived with. Closes section 9's third gap |
| `tone`, `confidence`, `layerMode`, `popGeo`, `popDecade`, `popFrom`, `popTo`, `sat`, `lines`, `decade`, `edge`, `radius`, `near`, `find`, `density`, `panels`, `hidePanels` | As section 2 | Read only with `view=map`; dropped from any other view's address. Map-only state still does not survive a visit to the list |
| `lens` | `law`, `books`, `presidents`, `inventions` | Section 10.3 |
| `lat`, `lng`, `zoom` | | Dropped at the edge and never written, as before. Nothing derived from the camera or from a device position is ever in the address |

Why the list is the default view. The bare address of the archive is the page a crawler, a
reader without script, a reader without WebGL and a phone all need to work first, and that is the
list (DESIGN.md 9.2: "Phone: list first"; section 10: "no WebGL requirement to read anything").
It also means every indexable `/records` address maps to an `/archive` address with the same
query string and no added key. From 64rem the list already stands beside the ink map with its
rows lit, so the bare address is still "ink map beside a paper column". The cost: the working map
is one click away (Map in the view switch) instead of being the first thing "Archive" opens.

Key order is fixed (`view`, then the order `recordsQueryString` already prints, then the map-only
keys), so a given state has one address.

### 10.2 Canonical, robots, pagination

| Address | Canonical | Robots |
| ------- | --------- | ------ |
| `/archive` | itself | indexable |
| `/archive?page=N` | itself | indexable |
| `/archive?<one facet>` (`kind`, `era`, `state`, `topic`, `status`, `evidence`) | itself | indexable |
| `/archive?sort=name` (one non-default sort) | itself | indexable |
| `/archive?<two or more of: facet, sort, page>` | itself | noindex, nofollow |
| `/archive?q=...`, a decade range, a `collection` | itself | noindex, nofollow |
| `/archive?...&selected=` or `&place=` (no `view`) | the address without them | noindex, nofollow |
| A page past the end | the last page | noindex, nofollow |
| `/archive?view=timeline` with or without filters | itself | noindex, nofollow (as `layout=chronology` was) |
| `/archive?view=map` | itself | index, follow |
| `/archive?view=map&<anything>` | `/archive?view=map` | noindex, nofollow |

These are section 6's `/records` and `/explore` rows with the path changed; nothing that was
indexable stops being indexable and nothing that was closed opens. The list's canonical never
carries `seed`, `selected` or `place`. Pagination is section 4 unchanged: 100 rows a page,
`rel="prev"` and `rel="next"`, choosing a filter or an order returns to page 1.

`robots.txt` adds `/archive?*&` and `/archive?q=` (the two `/records` shapes; the first also
covers every map address with a filter). The `/records` and `/explore` lines stay while those
paths redirect, so a rollback needs no robots change.

Sitemap: `/archive` replaces `/records`; `/archive?view=map` replaces `/explore` and is the one
sitemap address with a query; `/collections` leaves. `/law`, `/books`, `/presidents`, `/stories`,
`/data` and `/memorial` stay.

Edge: `/archive` is canonicalized like `/records` was: unknown and tracking keys dropped, values
re-printed, `theme`, `floor`, `layout=chronology`, `view=list` and `lens=inventions` rewritten,
in one 308 that stays on `/archive`. A reordering alone never redirects.

### 10.3 Lenses

A lens is one of the archive's bounded sets with its own exhibit. The lens chips sit under the
view switch on the list, the timeline and the lens pages, and replace the `/collections` index.
The map view's column has the view switch only.

| Lens | What it sets | Address | Canonical | Signature exhibit |
| ---- | ------------ | ------- | --------- | ----------------- |
| `inventions` | `kind=inventions` on the shared model, nothing else | `/archive?kind=inventions`. `lens=inventions` is read and rewritten to it | itself (a one-facet page) | none exists |
| `law` | The legal catalog, with its own keys from section 7 (`q`, `kind`, `topic`, `status`, `sort`) | `/law` | `/law`, by section 7's rule | the time rail: above the list on a phone, beside it from 64rem, as signed off |
| `books` | The challenged-titles catalog, with its own keys (`q`, `state`, `author`, `sort`, `dir`, `view=states`) | `/books` | `/books` | the state tile map, on its own ink ground: above the titles on a phone, beside them from 64rem |
| `presidents` | The presidents collection, which is stories, not records | `/presidents` | `/presidents` | none |

**`/law` and `/books` stay as addresses. They are aliases, not redirects, and each is its own
canonical.** They render the Archive page with the lens set: the same header, view switch and
lens chips as `/archive`, on paper. `/archive?lens=law` and `/archive?lens=books` answer a 307 to
`/law` or `/books` carrying the lens's own keys, so each lens has one address that renders; the
chips link to it. (The first draft of this section had the `lens=` address render too, with a
canonical to `/law`. One rendering address is simpler and leaves nothing duplicated to crawl.)
Reasons: both were signed off on 2026-11-21 and have inbound links; every law
and book record lives under them (`/law/[slug]`, `/books/[slug]`), so the index is the natural
parent of its records; and keeping them canonical means this phase moves no indexed lens address
at all, so a rollback has nothing to undo there. The alternative, `/archive?lens=law` as the
canonical with `/law` pointing at it, would move two indexed pages for no gain to a reader.

The law and books catalogs are separate datasets with their own vocabularies (a law's `kind` is
`statute` or `court-decision`, not an archive kind). Section 7 left "folding them into the shared
model" to 4b. It is not done and should not be: one `kind` key meaning two vocabularies in one
model would make a filter that silently matches nothing when the lens changes. The keys keep
their names and are scoped by the lens. A lens page has no Map or Timeline of its own; its view
switch leads back to the whole archive. `/books` keeps its own `view=states` (the ranked list of
states in place of the titles); it never meets the Archive's `view`, because the lens does not
render on `/archive`.

`/archive?lens=presidents` answers a 307 to `/presidents`: the collection is 45 stories on the
Story anchor (DESIGN.md section 8), and there is no record filter that means "presidents".

### 10.4 Redirects

All temporary (307) in this phase, each one hop, each keeping its query state. They become
permanent only when the owner says so after watching production search and traffic.

| Old address | New address | Query |
| ----------- | ----------- | ----- |
| `/records` | `/archive` | Every key kept. `layout=chronology`, `layout=timeline`, `view=timeline` become `view=timeline`. Unknown and tracking keys dropped in the same hop |
| `/explore` | `/archive?view=map` | Every key kept. `theme` becomes `topic`, `floor` becomes `evidence`. `lat`, `lng`, `zoom`, unknown and tracking keys dropped in the same hop |
| `/search` | `/archive` | As today's map onto `/records` (`q`, `kind`, `status`, `era`, `topic`, state, evidence, sort, collection, range); `kind=all` and `offset` dropped. Was a 308 to `/records` |
| `/history` | `/archive` | As today (`decade` becomes `era`). Was a 308 to `/records` |
| `/facts`, `/facts/...` | `/archive` | Was a 308 to `/records` |
| `/inventions` | `/archive?kind=inventions` | Was a 308 to `/records?kind=inventions` |
| `/locate` | `/archive?view=map&find=place` | Was a 308 to `/explore?find=place` |
| `/collections` | `/archive` | No keys |
| `/library`, `/rooms` | `/archive` | Were 308s to `/collections` |
| `/archive?lens=law`, `?lens=books`, `?lens=presidents` | `/law`, `/books`, `/presidents` | The lens's own keys kept (10.3) |

Not redirected:

| Address | Why |
| ------- | --- |
| `/law`, `/books` | Aliases with their own canonical (10.3) |
| `/presidents` | A Story-anchor page; only its chip lives in the Archive |
| `/law/browse`, `/books/browse` | Already permanent redirects to `/law` and `/books`, which do not move |
| `/map` | Already a permanent redirect to `/`, the front page; not an Archive address |
| `/explore/api`, `/search/api`, `/locate/api`, `/atlas/catalog` | Endpoints. The mobile app and the map call them; their paths do not change |
| `/place/...`, `/entity/...`, `/law/...`, `/books/...`, `/invention/...` | Records. A record opens as it did. Its return links now point at `/archive` |

One place, one switch: `ARCHIVE_REDIRECTS_ENABLED` in
`apps/web/src/lib/redirects/archive-redirects.mjs`. The proxy (`archive-routing.ts`, for
`/records`, `/explore`, `/search` and `/history`, whose queries have to be rewritten) and the
config redirect table (`next-config-redirects.mjs`, for `/facts`, `/inventions` and `/locate`)
both read it. Set to `false`, those addresses answer as they did in 4a: `/explore` and `/records`
render (the same page, by path), `/search`, `/history`, `/facts`, `/inventions` and `/locate`
return to their 308s, the list and map name the old address as canonical, and the sitemap lists
the old addresses. `/archive` keeps answering and names the old address as canonical, so nobody
holding a new link gets a 404. Links inside the site keep pointing at `/archive`; undoing those
as well is a revert of the phase, not of the redirects.

Outside the switch: `/collections`, `/library` and `/rooms` land on `/archive` either way,
because the collections page is deleted (its rows are the lens chips). Bringing it back is
restoring that file from git, not a redirect change.

Every proxy redirect is sent `Cache-Control: no-store`, so no CDN keeps a 307 past a rollback.
Normalizing an `/archive` address to its one spelling is still a 308, as it was on `/records`:
that hop stays on `/archive` and is not a move between routes.

### 10.5 What 4b is tested against

- Every row of 10.4: status 307, one hop, the query state in the table.
- Every row of 10.2 and the lens canonicals in 10.3, read from the server's response.
- Section 5's round trip on `/archive`, now through map, list and timeline.
- Section 8's privacy check, unchanged.

## 11. Phase 4b, observed

Run against the dev server on live data, 2026-11-23, after the build.

**Redirects.** 27 addresses answered by the proxy (`/records`, `/explore`, `/search`, `/history`,
`/collections` and the three lens spellings, each with the query states in 10.4): every one a
307 with `Cache-Control: no-store`, landing on the address in the table, and that address
answering 200 with no further redirect. `/facts`, `/facts/...`, `/inventions`, `/locate`,
`/library` and `/rooms` are config rules, which Next reads when the server starts; the running
dev server was not restarted, so it still answered their old 308s and those six rows are
checked by unit test only (`redirect-table.test.ts`, `archive-routing.test.ts`), not observed.

**Canonical, robots, pagination.** Every row of 10.2 read from the response and equal to the
table, 30 addresses: the bare list and map indexable and self-canonical; one facet, one sort and
plain pagination indexable; any combination, search, range, collection or carried selection
`noindex, nofollow`; a page past the end canonical to the last page; the timeline `noindex,
nofollow`; every narrowed map canonical to `/archive?view=map`; `/law`, `/books` and
`/presidents` as section 7 left them. `rel="prev"` and `rel="next"` on the list and timeline.

**robots.txt** lists `/archive?*&`, `/archive?q=`, `/records?*&`, `/records?q=`, `/explore?`.

**Sitemap.** 4,488 addresses. `/archive` and `/archive?view=map` are in it (the latter is the one
address with a query); `/explore`, `/records` and `/collections` are not.

**With the switch off** (set to `false`, observed, then set back): see the 4b row in DESIGN.md
section 13 for what was and was not exercised.

