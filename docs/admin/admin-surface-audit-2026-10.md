# Admin surface audit, 2026-10-17

Scope: every route under `apps/web/src/app/admin`, the shell chrome, and the article editor. Evidence is
from reading the code and from timing and exercising the running app (`localhost:3048`, signed in as
staff, live Supabase data). "Measured" means observed in this pass; "read" means from source only.

## Summary

The admin is closer to coherent than it looks. The catalog and submissions desks already use the
right pattern: URL-driven filters, SQL-side search, sort and paging, shared `FacetRail`, `Toolbar`,
`DataTable` and `Pagination` from `@repo/ui`. The slow, unfilterable, inconsistent surfaces are the
ones that predate that pattern. This pass moved four of them onto it, fixed the worst query, and
reworked the editor and the sidebar. It did not touch every surface; the remainder is listed below.

## Findings and what changed

### 1. Speed

| Surface | Finding | Measured | Fix |
|---|---|---|---|
| Inbox, Cases | `listAdminResearchCases` loaded each case with its own 3 queries, sequentially: 200 cases was about 600 round trips to a remote pooler. | 47 s, twice | Two batched queries (`listResearchCaseDocumentsPostgres`). Both desks now page in SQL. 0.6 s. |
| Article editor page | Eight sequential reads (article, reviews, history, publication, public release, contributors, related records). | 8.4 s | Independent reads run with `Promise.all`; the contributor list loads alongside the article. |
| Article preview | Packet views, entities and blockers awaited in series; one request hit a 10 s read timeout. | 6.7 s | Parallel. |
| Home dashboard | Loaded 200 full story packets (plus every review row, each carrying its packet JSON) to compute two counts. | about 2 s | `countStoryPacketsPostgres`: one `count(*)` join. The packet list now reads only the review rows it needs. |
| Every page | The role check (`/admin/api/auth/me`) and the shell run client-side after paint. | 150 to 450 ms | Not changed. See remaining work. |

Caveat: timings are from the dev server, so first hits include compile time. The 47 s and the N+1
shape are not compile artifacts; the 0.6 s after is the same route, warm pool.

### 2. Filtering and sorting

| Surface | Before | After |
|---|---|---|
| Inbox, Cases | Filter and sort ran in the browser over the latest 200 rows. The Inbox held 475, so 275 were unreachable and the header counts read "200". | Search, state, assignee, sort and page are URL params resolved in SQL. State chips show true totals (Inbox 475). Sortable headers, pagination. |
| Audit log | Latest 100 events, no controls. About 5,100 events exist. Rows with a malformed actor or subject were silently dropped. | Search, category and actor-type facets, date range, sort, pagination. Malformed rows are shown with a placeholder. |
| Graylist | Latest 100, no controls. | Search, status and disposition facets, sort by parked, score or updated, pagination. Defaults to the parked queue. |
| Catalog, Submissions | Already server-side. | Unchanged. Submissions still sorts by time only. |
| Discovery runs (50), Releases (50), Sources (200 slice), Articles (client filter, no sort) | Capped, little or no sorting. | Not changed. |

New code uses `admin/lib/desk-query.ts`. The entity, submission and case codecs carry their own copies
of the same readers; folding them together is a cleanup, not a fix.

### 3. Rich text editor

The editor is sound underneath: autosave, optimistic revision locking, session recovery, a
contract-checked document adapter. What it lacked was authoring ergonomics, and it did unnecessary
work on every keystroke.

Added, all inside the existing article contract (no schema or public-renderer change):

- Record links. Inline `[[entityId|Label]]` atoms with a record picker; selecting text first keeps it
  as the label. Previously these were raw bracket text. Serialization is exactly the stored form.
- Insert evidence blocks at the cursor, not only at the end. The toolbar now holds cite, link record
  and insert block together.
- Block cards can move up, move down and be removed. Alt+Up and Alt+Down move any block.
- Live checks against the contract limits (heading 240, pullquote 600, list item 600, 24 items, no
  empty blocks), drawn on the offending block, with a count and list under the editor. Citations to a
  source that is not attached are marked.
- Placeholder, reading time, keyboard-shortcut hints.
- Pasted rich text arrives as plain text instead of being rejected block by block.
- Typing performance: toolbar state moved to `useEditorState` (no whole-component re-render per
  transaction), and the editor skips the full-document compare when the parent hands back the body it
  just emitted.

Not done, and it is the largest remaining gap: **no bold, italic or links.** The contract stores
paragraphs as plain strings with `[ref:id]` and `[[entity|label]]` markers, and the public renderer
(`ArticleProse`) understands only those. Italics are standard for titles of works and newspapers in
this kind of writing, so the gap is real, but closing it changes stored data and the public page. See
decision 1.

### 4. Menu and chrome

Findings (read, and seen in the running app): four triage queues (Requests, Inbox, Submissions,
Research cases) sat in one group in no pipeline order; "Attach evidence" and "Quick add" were
filed under Catalog; the top bar said "Management" on every page; "Public site" appeared in both the
top bar and the sidebar; group labels looked like items; there was no sign of queue size anywhere
but the home page. The `adminPrimaryNav` and `adminOverflowNav` functions, and their tests, described
a bar the shell no longer renders.

Changed:

- Groups follow the work: Intake (Submissions, Graylist, Discovery runs), Research (Inbox, Research
  cases, Requests, Attach evidence, Quick add), Catalog, Sources, Publish, System.
- Group labels are styled as labels. The top bar shows where you are ("Research / Inbox").
- Queue badges on Submissions, Inbox and Story review, from `/admin/api/queue-counts`, fetched after
  paint and refreshed every 60 s while the tab is visible.
- Dead nav code and tests removed; tests now guard group size, duplicates, palette coverage and the
  auth gate.

### 5. Consistency (not changed)

Four header systems and three table systems are in use: `ds-page__header`, `story-review__header`,
`acq__header` and `admin-base-page-header`; `DataTable`, hand-built `story-review__table` and
`acq__table`, and Base Web `TableBuilder` (Articles). Unrelated desks borrow `story-review__*` class
names. Converging on `ds-page__header` and `DataTable` is mechanical but touches about a dozen files.

## Route-by-route

| Route | Data source | Controls | State after this pass |
|---|---|---|---|
| `/admin` | counts only | none | Faster. Cards still duplicate the sidebar. |
| `/admin/work`, `/work/[id]` | client fetch, polls every 15 s | none | Unchanged. Client waterfall: auth, then role, then data. |
| `/admin/inbox`, `/admin/cases` | SQL, paged | search, state, assignee, sort | Done. |
| `/admin/cases/[id]` | read | n/a | Unchanged. |
| `/admin/submissions`, `/[id]` | SQL, paged | search, status, kind, direction | Unchanged. Add sort keys. |
| `/admin/graylist` | SQL, paged | search, status, disposition, sort | Done. |
| `/admin/catalog`, `/[id]`, `/merge` | SQL, paged | facets, search, sort, bulk | Unchanged (reference implementation). Table clips at 1440 px with the rail open. |
| `/admin/quick-add`, `/evidence` | forms | n/a | Unchanged. |
| `/admin/sources`, `/[organizationId]` | SQL, 200-row slice | search, 2 sorts | Unchanged. |
| `/admin/discovery` | latest 50 | none | Unchanged. |
| `/admin/citation-health` | **fixture data only** | none | Unchanged. See decision 2. |
| `/admin/stories/articles` | all articles, client filter | search, state | Unchanged. No sort; Base Web table. |
| `/admin/stories/articles/[slug]` | SQL | n/a | Faster; editor reworked. |
| `/admin/stories/articles/[slug]/preview` | SQL | n/a | Faster. |
| `/admin/stories/review` | SSR, then 200-row client desk | client filter and sort | Unchanged. Only 6 pending today. |
| `/admin/stories/contributors` | all rows | n/a | Unchanged. |
| `/admin/releases` | latest 50 | none | Unchanged. |
| `/admin/audit` | SQL, paged | search, category, actor, dates, sort | Done. |
| `/admin/switches` | all rows | none | Unchanged (small table). |
| `/admin/login` | n/a | n/a | Not reviewed. |

Also fixed: page titles for Inbox, Cases, Story review, Attach evidence, Citation health and Quick add
rendered "… — BlackStory Admin — BlackStory Admin" because the layout template already adds the suffix.

## Decisions for the owner

1. **Inline emphasis (bold, italic, links) in articles.** Recommendation: add italic only, as a
   `_text_` marker stored in the existing string, rendered by `ArticleProse`, with a one-time check
   that no published paragraph already contains a bare `_`. Failure mode: any existing text that uses
   the marker for another reason changes appearance on the public site. Alternative: leave the
   contract plain and use a convention (italic titles via entity or work links). Needs validation
   against published articles before building.
2. **Citation health shows fixture numbers in the main navigation.** Recommendation: hide it from the
   sidebar until it reads the real link-health sweep. The page does say it is fixture data, but an
   operator scanning the nav will not read that.

## Remaining work, in order

1. Move the role check and shell data server-side (removes the per-page client waterfall); add a
   non-blocking loading state to the heavy desks.
2. Sort keys on Submissions; filters and paging for Discovery runs and Releases; server-side
   filter and sort for Articles and Story review.
3. Converge page headers and tables on `ds-page__header` and `DataTable`.
4. Catalog table: let the rail collapse so the Updated column is not clipped at 1440 px.
5. Editor: outline of headings, find and replace, and the decision 1 outcome.
6. Fold the three older query codecs into `desk-query.ts`.

## How this was checked

- `pnpm test` in `apps/web`: 2,767 passed, 0 failed.
- `pnpm typecheck` in `apps/web`: clean.
- New SQL (case page and facets, audit page and facets, graylist page and facets) run against the live
  database before the pages were built.
- Running app, signed in: Inbox, Audit, sidebar badges and the editor exercised. Editor testing used a
  blank draft with article writes blocked in the page, so nothing was saved. Exercised there: typing, Alt+Up block move, live word
  count, and inserting a record link (the stored text came out as `[[ent_david_blackwell_001|David
  Blackwell]]`). Not exercised in a browser: Graylist (the table is empty), the mobile drawer, dark
  mode, paste handling, the block-card move and remove buttons, the lint highlights and
  missing-citation marks (covered by unit tests only), drag-and-drop, and the editor on a long article
  (typing latency was not measured).

## Follow-up: why navigation is slow, and the UI pass

### Where the time goes on one navigation

Measured against the running app, first visit versus repeat visit of the same route:

| Route | First visit | Repeat |
|---|---|---|
| Switches | 8.1 s | 0.40 s |
| Graylist | 6.7 s | 0.43 s |
| Audit | 3.9 s | 0.55 s |
| Catalog | 8.1 s | 0.49 s |

Three separate causes, in order of size:

1. **First visits compile (dev only).** `next dev --webpack` compiles each route on demand, so the
   first click on any desk takes 3 to 8 s and the old page stays on screen the whole time (measured:
   the next route's loading state appeared 1.6 s after the click). A production build does not do
   this. Untested option: drop `--webpack` from the `dev` script and use Turbopack; the flag was set
   deliberately, so that needs a decision and a check that Base Web and the CSS stubs still work.
2. **No loading state existed.** There was no `loading.tsx` under `/admin`, so every server render,
   warm or cold, left the old content frozen. Added `app/admin/loading.tsx` (a skeleton) and hover
   and focus prefetch on the sidebar, which `router.push` navigation never did.
3. **Repeated auth round trips.** Each navigation called Supabase `getUser` in the proxy, again in
   each nested layout and page (two to three more, 150 to 250 ms apiece), and the browser then called
   `/admin/api/auth/me` for the role. Now: the proxy still validates the session with Supabase; the
   layout and pages verify the signed token locally with `getClaims` (the project signs with ES256,
   so no network) and share one result per request through `cache()`; the layout passes the verified
   role to the client, which no longer fetches it. Warm navigations improved by 60 to 140 ms
   (Switches 397 to 260 ms, Audit 553 to 476 ms).

What remains in a warm navigation is the proxy's `getUser` (about 150 ms) plus the page's own
Postgres reads (100 to 250 ms per round trip to the remote pooler). Cutting further means a Supabase
region closer to the Vercel region, or caching reads that tolerate staleness; neither was changed.

Security note on the change in item 3: the second auth layer no longer detects a session revoked
server-side in the last hour; the proxy layer still does, on every request. The API routes still call
`getUser`.

### UI pass

- Controls follow operator density on desktop (`pointer: fine`): 32 px buttons, inputs and selects
  with 6 px corners, replacing the public site's 40 to 44 px pills. Touch devices keep large targets.
- New shared pieces in `admin/design-system`: `DeskTitleBar` (title, count, short description,
  actions), `Panel` (bordered, shadowed section container), `StatTile` and `StatGrid`,
  `ActiveFilters` (removable filter chips with clear-all), `DeskToolbar` (search, filters, sort
  select and direction toggle, count), and `PageSkeleton`.
- Applied to the dashboard (stat tiles and panels instead of paragraphs), Catalog, Submissions,
  Inbox, Research cases, Audit and Graylist. All five list desks now share one search, sort and
  filter control, chips for every active filter, and a count. Submissions gained sort keys (submitted,
  kind, status) and moved onto `DataTable`.
- Long guidance moved out of headers (the Inbox's three-step list is a disclosure); long case titles
  clamp to two lines; audit rows show a short actor id instead of a 36-character account id.
- Sidebar rows are shorter and less indented so the full menu fits a laptop screen.

Not changed: Sources, Discovery runs, Releases, Switches, Articles, Story review, Contributors, the
forms (Quick add, Attach evidence), the detail pages, and Citation health still use the earlier
headers and tables. Filter controls on Sources, Releases, Discovery runs and Articles are the
remaining gap in the "consistent filtering" request. The catalog table still scrolls sideways at
1440 px with the rail open (the Updated column); the Base Web buttons inside the editor and forms
follow the new density but were not re-checked one by one.
