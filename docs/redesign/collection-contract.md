# Story collection and chronology contract

Scope: one vertical slice over the existing `DiscoveryState`, Records query and Explore URL
contracts. No storage, schema, publication, dependency or stored-record change. Nothing here has
been executed or rendered by its author; the integrator owns tests and browser evidence.

## 1. Story collection

`collection=story:<published-slug>` means exactly `storyCitedEntities(doc)`: the story's explicit
`relatedEntityIds` and `mapInset` entity ids. Nothing is inferred from prose, proximity or author
reference counts. The `story:` prefix keeps it apart from a story's editorial series
(`doc.collection.id`, used by `/stories?collection=`).

Reader: `resolveStoryCollectionSource(slug)` in `lib/stories/source.ts`. It reads the unhydrated
docs from the existing release-scoped story list and never uses `resolveCitesEdgeIndex()`, which
turns a failed read into `{}`. It returns one of:

| State | Meaning | Members |
| --- | --- | --- |
| `live` | Story is published. May link zero records. | linked ids (resolved later) |
| `unknown` | Release has no such slug. No point read follows, so a slug cannot mint a query. | none |
| `unavailable` | Read could not run or failed. | none |

The loader (`app/records/load-records-index.ts`, `app/door-home.tsx`,
`app/record-first-paint.tsx`) resolves linked ids over the released bibliography only, via
`resolveStoryCollection`. The descriptor keeps the story title, `/stories/<slug>` href and an
`unresolvedCount`. Unresolved ids and names are never surfaced.

Absence never widens. `matchesExcept(fact, query, skip, members)` matches nothing when
`query.collection` is set and `members` is undefined (unknown, unavailable, malformed), and always
matches nothing for the `invalid` and `missing` sentinels. A live story with zero members is a
distinct, honest empty collection with its own copy.

Pure types and builders: `lib/discovery/story-collection.ts`.

## 2. URL

`collection`, `periodStart`, `periodEnd`, `includeUndated` and `layout` are read and written
through the existing codecs (`parseRecordsQuery` / `recordsQueryString`,
`parseExploreSearchParams` / `buildExploreSearchParams`, `discoveryFromSearchParams` /
`placeArrivalQuery`), never by concatenating the raw request.

- Malformed collection becomes the finite `invalid` sentinel. It renders an explicit,
  non-indexable error state.
- A well-formed story the release does not have redirects temporarily (307) to the `missing`
  sentinel on `/records` (`page.tsx`) and `/explore` (`door-home.tsx`), keeping all other
  narrowing. The story may publish later, so this is never a permanent redirect.
- Neither sentinel drops to the bare archive anywhere.
- Collection, range and chronology URLs are counted as combinations (`isRecordsCombinationQuery`),
  so they are `noindex` and `nofollow` and the edge parity port matches.
- `src/proxy.ts` sets `Cache-Control: no-store` on `/records` and `/explore` HTML that carries
  `collection`, and withholds the CDN header. Underlying released reads stay cached. A newly
  published slug needs no baked static list.
- Carried through: Records, Map, record-family arrival (`PLACE_PAGE_PARAM_ALLOWLIST` and the edge
  copy), previous/next, Return, and Explore URL sync (`exploreHrefFromLens`).

## 3. Range

`periodStart` / `periodEnd` are inclusive stored decade-start bounds (four-digit multiples of 10,
`1000..2990`). They are not event dates and are distinct from the origin `from`, the map sweep
`decade` and the `pop*` population decades. Codec: `lib/discovery/collection-period.ts`.

- A non-empty bound that is not a decade start becomes `invalid` and an explicit error state; it
  matches nothing and never silently widens.
- Reversed valid bounds normalize ascending. One-sided ranges are allowed.
- With an active range, records with no documented decade are excluded unless `includeUndated=1`.
  Without a bound they are included and a redundant `includeUndated` is dropped from the canonical
  URL. The page states how many undated records an active range leaves out.
- Period selects offer only decades the collection documents (plus a selected bound), so sparse
  buckets stay sparse.

## 4. Chronology

`layout=chronology` on `/records` changes representation of the same collection. The index has no
layout param. `lib/discovery/collection-chronology.ts`:

- Each record appears once, under its earliest documented decade within the active period (the
  earliest known bucket without a range). Undated records sit in an explicit last section.
- Coverage is the decades that hold records ("1880s and 2000s"), never a continuous span. Copy says
  documented decade or archive bucket, never event year.
- Order: dated decades ascending, then undated; within a group the collection's sort, then id.
- Paging slices the same 100-row pages as the index; sections state shown versus total and mark a
  page that opens partway through a decade.
- Record previous/next (`findRecordsNeighbors`) follows the displayed chronology order. Return
  restores `layout` and the prior sort and narrowing. The map carries `layout` as return context
  and never uses it to match.

## 5. UI

- `CollectionContext` offers Map, Records and Chronology as native links with `aria-current`. It
  names the source story with a link and the unresolved count, and replaces the count with a stated
  reason when the collection cannot be shown (never "Counting", never zero, never the archive).
- `CollectionPeriodControls`: one native GET form (From and Through decade selects, include-undated
  checkbox, Apply, Clear). Hidden fields carry every other param. It is a sibling of the find form
  on Records and sits in a native disclosure in the map strip, so no forms nest.
- On Records the period form is wrapped in a native `<details>` (`disclosure` prop) that stays
  closed by default so rows are not pushed below a phone viewport. The summary states the current
  range ("Any decade", "Documented 1880s through 1920s, plus undated") and, when a range leaves
  undated records out, how many. An unreadable range opens the disclosure and states that no
  records are shown. The Clear link sits beside the summary, never inside it. The GET form and
  hidden fields are unchanged. The submit is labelled "Show records" because the room kit forbids
  an "Apply" button (`room-kit.test.tsx`, no public route has an Apply button).
- Chronology: from 56rem the decade stands in a left ledger column beside its rows; narrower it
  stacks. Each section keeps its own shown/total count and the undated section stays last.
- `RecordsChronology` reuses `HairlineIndex` rows (native record links, evidence meter, kind glyph).
- The story page appendix adds Records, Map and Chronology links for exactly the linked set, with
  copy that it is not every source. Author text, citations, `#ref` and heading ids are untouched.
- Matte kit tokens only, 44px targets, scoped CSS files. Memorial is not touched.

## 6. Wire

The resolved descriptor rides the per-request Explore shell (`ExploreViewModel.collection`), not the
release-wide catalog, so `/atlas/catalog` stays v4 and unchanged. The client matches with
`collectionMemberIds(view.collection)`. An unresolved descriptor matches nothing and the strip says
membership is unavailable, including before the catalog arrives. The unfiltered map never reads the
story source, so an unavailable story read cannot take it down.

## Touched parts

`lib/discovery/{collection-period,story-collection,collection-chronology}.ts` and
`collection-contract.test.ts` (new), `discovery-state.ts`, `discovery-arrival.ts`,
`explore-collection.ts`; `lib/records/{records-query,records-matching,build-records-index}.ts`;
`lib/stories/source.ts`; `lib/map-experience/url-state.ts`;
`lib/runtime-hardening/constants.ts`; `apps/site/server/edge/{records-query,query-normalization}.cjs`;
`src/proxy.ts`; `app/records/*`; `app/door-home.tsx`; `app/record-first-paint.tsx`;
`app/explore/{explore-view-model,explore-view-model-wire,AtlasExperience}` and
`hooks/{use-lens-filters,use-explore-url-sync}`; `components/discovery/*`;
`components/story/story-records.tsx`; `app/stories/[slug]/page.tsx`.

## Remaining gaps

- `lib/search/search-href.ts` and `lib/redirects/history-href.ts` (outside the lease) still carry
  only `state`, `evidence` and `sort` on legacy redirects, and `SEARCH_PAGE_PARAM_ALLOWLIST` does not
  list the new keys. A legacy URL carrying `collection` or a range loses it.
- `apps/site/server/edge/surfaces.cjs` and the site cache layer have no collection no-store rule;
  only `src/proxy.ts` does. Parity needs the integrator's decision.
- A story published inside the story list's cache window shows as `unknown` until the list
  refreshes (no point-read fallback, by design).
- Not run: typecheck, unit tests, `site-edge-parity`, `query-normalization` drift tests, browser or
  375/1280 rendering, light/dark. Existing tests that build a `RecordsQuery` literal without
  spreading `EMPTY_RECORDS_QUERY` will fail typecheck on the new required fields.
- Map-side chronology is a link to Records, not a map layout. The map strip's period disclosure
  has not been checked against the fixed atlas layout.
- Counts for the Explore catalog `Counting` state were not changed beyond the unresolved case.
