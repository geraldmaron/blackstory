# Current implementation disposition

This table supersedes the initial phase-one suggestions below. It records intentional migration versus retention, not blanket visual acceptance. No independent implementation gap remains identified after the two finishing slices and focused review.

| Family | Final disposition | Concrete acceptance / remaining limit |
|---|---|---|
| Home, Explore, Records and record families | Collection-based map/index/chronology and contextual record navigation migrated; distinct entry and reading compositions retained | Same collection/query/range survives mode, record and return; empty, unavailable and unmapped stay distinct; loading and recovery are source-mapped and tested. Representative rendered flows passed. |
| Stories and chapters | Reading layout, contents, collection links and loading migrated | Existing prose, anchors and evidence identity preserved; linked collections use explicit published links. Copied-tile credit provenance remains a data-owner question. |
| Books and Law | Distinct catalogs and readers intentionally retained; paging, semantics and waits completed | Source-backed entries, filtered-empty/unavailable distinctions, compatible URLs and paging boundaries; no invented catalog content. |
| Lives and Data | Editorial/statistical layouts retained; waits and source-aware failure treatment completed | Unpublished and unreadable snapshots never assert zero. Notices have native recovery. Live defaults and synthetic notice variants were rendered. |
| Memorial, Errata, Sources and Rooms | Intentional distinct publication layouts retained | Names/order and Memorial protection preserved; source lineage readable; no route retirement or forced merge. |
| Static information, Submit and Corrections | Existing publication/intake UI retained; receipt wait added | Labels and existing validation remain; lookup failure differs from not-found. No submission or stored-record write was performed. |
| Legacy redirects and internal design-system route | Retained compatible routing and existing access posture | Historical URLs keep supported context; no fixture or staff data was exposed through an application route. |
| Staff/auth entry | Protected desk layouts retained; shared recovery, sign-in status/touch states and representative case selection/empty states migrated | Auth logic unchanged; sign-in targets measured44px; synthetic state fixtures and SSR checks pass. Representative populated Inbox/Queue and real dialog keyboard checks now pass using the existing Admin session; no mutation-path or all-role acceptance is claimed. |

There are no requested schema or stored-record changes needed for these UI slices. Canonical integration and recoverable cleanup are complete after owner release; exact copied-tile credit data remains unavailable. Retiring Rooms or merging Sources is optional, not a blocker.

---

# Migration classification (base 59c1667f, completion pass)

**Delta from the earlier pass (source-first; the rows below are corrected where they changed).**
Read from source this pass: `data/page.tsx`, `load-data-page-model.ts`, `lives/page.tsx`,
`lives/explorer/page.tsx`, `lib/lives/lives-source.ts`, `corrections/status/page.tsx`,
`corrections/status/[receiptCode]/page.tsx`, `explore/AtlasLoader.tsx`, `admin/queue/page.tsx`,
`admin/cases/CaseQueue.tsx`, `QueueKeyboard.tsx`, `admin/login/login-panel.tsx`, `admin.css`.

- **Real failure conflated with empty (fixed):** `loadLivesAreaBundle` returned the same every-figure-pending
  bundle for no database, a missing snapshot and an invalid snapshot. `loadLivesAreaView` now reports
  `snapshot`, `unpublished` or `unreadable` beside the unchanged bundle; `/lives` and `/lives/explorer` show a
  warning (nothing published) or an alert with a native retry link (unreadable). Stored data and schema are
  untouched. A thrown database query was never swallowed; it already reached `app/error.tsx`.
- **Not a gap:** `/data` throws when the indicator bundle is missing (inherited retry, never empty figures);
  the receipt page shows "not found" only when the store answers with nothing, and a store failure throws;
  home and Explore already show an error notice with Try again when the map catalog fetch fails, and the
  zero-match named collection already renders scope-aware recovery (browser-verified at 375px by the root).
- **Loading added (awaits data, had none):** `/data`, `/lives` (also covers `/lives/explorer`),
  `/corrections/status/[receiptCode]`. `/corrections/status` is a synchronous form: loading not applicable.
- **Staff:** `CaseQueue` used one sentence for a filtered zero and an empty desk, and case rows opened the
  detail sheet only from a mouse click on the row, with no focus return. Fixed: shared `EmptyState` with
  Clear filters, a native row button, focus returns on close. `/admin/queue` already separates filtered zero,
  empty and degraded and keeps server-rendered row links plus j/k: retained, no migration.
- **Auth entry:** the email target is the native input (the wrapper was already 44px, the input 40px). The
  login scope now floors `base-input` and the inner input at 44px. Handlers, POST, autocomplete and
  validation are unchanged. Not measured here; the root owns the 375px check.

## Earlier pass (base 50060223)

Phase 1 deliverable, written before implementation. Method: inventory state statuses (all 66 routes,
read from `docs/redesign/surface-inventory.json`) crossed with page signatures (async or static,
`dynamic`/`revalidate`, sibling `loading.tsx`/`error.tsx`). Source was read for: `app/error.tsx`,
`app/global-error.tsx`, `app/admin/{layout,loading}.tsx`, `app/admin/login/*`, `admin/design-system/{ui,fields,DeskToolbar}.tsx`,
`admin/components/AdminShellChrome.tsx`, `records/page.tsx`, `place/[slug]/page.tsx`, `entity/[id]/loading.tsx`,
`components/room/catalog-loading.tsx`. Everything else below is classified from the page signature and the
inventory text only, and is marked **unread**. Nothing here is rendered or browsed, and "partial/baseline" is
never visual acceptance.

Vocabulary: **migrated** (a redesign slice shipped; states may still be pending), **retained** (current layout
is intentional; no migration owed), **needs work** (a real, source-evidenced gap), **gate** (blocked by access or product).

## Public routes

| Route / family | Disposition | Real gap | Acceptance (visual / state) | Evidence | Gate |
|---|---|---|---|---|---|
| `/` ground-map | migrated | `error`, `empty`, `selected` still pending | Failed catalog read shows the shared error notice with retry, not a blank map; empty-map copy states scope, not absence of history | `door-home.tsx`, `explore/AtlasLoader.tsx` (unread this pass) | none |
| `/explore` | migrated | `error`, `empty` pending (loading exists) | Same as above; empty narrowing keeps the collection strip and a way to widen | `explore/loading.tsx` | none |
| `/records` | migrated | **loading: no `loading.tsx` although the page awaits the catalog** | Cold navigation shows one polite announcement, hidden placeholder rows, no invented count | `records/page.tsx` (read); `RecordsIndex.tsx` already has `EmptyList` for empty and unresolved states | none. **Targeted in this slice** |
| `/entity/[id]` | migrated | `error` pending: inherits the public boundary, which is already tested | Disposition change only: inherited boundary, notFound handled in page | `entity/[id]/loading.tsx` (read), `app/error.tsx` | none |
| `/place/[slug]` | migrated (shares the record room) | **loading: `force-dynamic`, awaits the record, no `loading.tsx`**; `error` | Same record skeleton as `/entity`, announced once | `place/[slug]/page.tsx` (read) | none. **Targeted in this slice** |
| `/invention/[slug]` | migrated | **loading: `force-dynamic`, async, no `loading.tsx`** (page body unread) | Same as `/place` | page signature only | none. **Targeted in this slice** |
| `/stories`, `/stories/[slug]`, `/books`, `/books/[slug]`, `/law`, `/law/[slug]`, `/stories/mosaic-credits` | migrated | none new; covered by the earlier closeout | Already asserted in `public-route-loading.test.tsx` | handoff, previous pass | mosaic per-tile credit data (owner) |
| `/lives` | migrated | `empty` pending; source falls back to `emptyLivesAreaBundle` | An empty area must say the release has no lives records there, never a blank list | `lives/page.tsx` (grep only) | none; needs source read |
| `/lives/explorer` | retained baseline, **needs work** | `loading`, `error`, `selected` pending; load failure silently becomes an empty bundle | Failed read distinguishable from empty | `lives/explorer/page.tsx` (grep only) | none; **next slice** |
| `/lives/[region]` | retained | none | notFound for non-regions | grep only | none |
| `/data` | migrated | `loading`, `error` pending; async page (unread) | Needs source read first | signature | none |
| `/corrections`, `/corrections/status`, `/corrections/status/[receiptCode]` | migrated | status lookup `loading`/`error` pending. The receipt page already renders `Notice` + `EmptyState` for not found | Disposition: not-found state exists; dev in-memory store makes "not found" expected locally | `corrections/status/[receiptCode]/page.tsx` (grep) | none; intake store is dev-only by design |
| `/submit` | migrated | none | none | inventory | none |
| `/about`, `/faq`, `/methodology`, `/privacy`, `/terms`, `/support` | retained baseline | `loading`/`error` listed pending, but these are static or `revalidate` documents | Disposition only: loading not-applicable, error inherited. Do not mark until each page is confirmed to await nothing (`/methodology`, `/faq` unread) | signatures | none |
| `/errata`, `/memorial`, `/rooms`, `/sources` | retained | none | Done in previous closeout | handoff | Memorial access rules untouched; `/rooms` retire and `/sources` merge are optional product choices, not prerequisites |
| `/search`, `/history`, `/apparatus`, `/how-it-works` | retained redirects | none | Redirect anchors | inventory marks all states not-applicable | none |
| `/design-system` | retained, internal | pending; auth state baseline | none | inventory | none |
| System: `app/error.tsx`, `global-error.tsx`, `not-found.tsx` | migrated | none | tested | `app/error.test.ts`, `global-error.test.tsx` | none |

**Superseded for `/lives`, `/lives/explorer`, `/data`, `/corrections/status*`, `/` and `/explore`:** see the
delta above. Their error and empty states are partial with component or source evidence; none is visually
accepted. Remaining public acceptance per family: rendered 375/1280 light and dark for the loading waits and
the two Lives notices (force `unpublished` and `unreadable` with a synthetic view only in a test, never by
editing data); `/methodology` and `/faq` loading still needs a confirmed no-await read.

Earlier public conclusion (historical): public surfaces are **not** genuinely complete. Three dynamic record/index routes await data
with no loading boundary. They are the highest-value public gap and are fixed first (small, reuse existing kit).
`/lives/explorer`, `/data`, `/explore` and `/` error/empty states are real remaining public gaps needing source reads.

## Staff and auth entry (31 pending)

Access: 29 `staff` routes plus `/admin/login` (`auth-entry`); the 31st pending route is the internal `/design-system`. Authentication, `proxy.ts`, route permissions and server
actions are **not** touched. No sign-in, submission or record write is needed for anything below.

| Item | Disposition | Real gap | Acceptance | Evidence | Gate |
|---|---|---|---|---|---|
| `/admin/login` | **needs work (presentation only)** | (1) error alert not tied to the fields (no `aria-describedby`/`aria-invalid`); (2) busy and "verifying your account" states are button-label only, no live status; (3) Suspense fallback has no `role="status"`/`aria-busy`; (4) disabled sign-in button has no stated reason while auth is not ready; (5) logic, markup and tests are in one client file so no state can be rendered without Supabase | Presentational panel renders idle, auth-not-ready, busy, verifying, error and loading from synthetic props with the admin theme; one polite status; error linked to both fields; handlers and auth checks byte-for-byte unchanged | `login/LoginClient.tsx`, `login/page.tsx`, `admin.css`, pattern `design-system/provider.test.tsx` (SSR with `AdminDesignProvider`) | none. Populated/real sign-in acceptance is **not claimable** from fixtures |
| Staff `error` (all 30 desks) | **needs work (shared)** | Desks inherit `app/error.tsx`, which says "The public shell hit an unexpected error" and links "Back to home" (`/`, the public site) inside the staff shell | `app/admin/error.tsx`: staff copy, retry, link back to `/admin`, sanitized detail through the existing `sanitizeClientErrorDisplay`, no raw message, stack or digest beyond that helper | `app/error.tsx`, `lib/runtime-hardening/error-surface.ts`, pattern `global-error.test.tsx` | none |
| Staff `loading` | retained | `app/admin/loading.tsx` -> `PageSkeleton` (`role=status`, `aria-busy`) covers every desk | none | `admin/design-system/ui.tsx` | none |
| Staff list `empty` | needs work, **not this slice** | Two ad hoc empties (`acq__empty` in `CaseQueue.tsx`, `queue__empty` in `queue/page.tsx`); no shared admin empty primitive. `@repo/ui` already exports `EmptyList`/`EmptyState` | A shared empty state used by desk lists, with filter-aware copy | grep of both files | none; per-desk edit |
| Staff list controls | retained | `DeskToolbar` is a GET form, works before hydration, labelled `role=search` | none | `DeskToolbar.tsx` | none |
| Staff `selected` (12 desks) | needs work, per desk, not this slice | Row/detail selection and focus return are per-desk | Needs per-desk reads | inventory | none |
| Staff forms | retained shared adapters | `FormInput`/`FormTextarea`/`FormSelect` wrap existing audited actions | Must not change submit semantics | `fields.tsx` | Any form write or server action change is out of scope |
| Staff mobile | retained | Drawer nav in `AdminShellChrome` with dialog label | rendered check belongs to root | `AdminShellChrome.tsx` | root browser |

Update: the staff empty row above is now done for `CaseQueue` (inbox and cases) and retained for `/admin/queue`.
Selected is partial for those three desks. The other ~9 desks with selection are **retained, not
migrated**: no finding justifies touching them, and populated acceptance needs a real staff session.

Staff conclusion: no product or access gate blocks isolated source work. What remains gated is **populated protected
acceptance**: real staff session, real queue data, real mutation paths. Fixtures can show state composition only.

## Slice chosen (<= 15 files)

1. Public: `records/loading.tsx`, `place/[slug]/loading.tsx`, `invention/[slug]/loading.tsx`, extend `public-route-loading.test.tsx`.
2. Staff: `app/admin/error.tsx` + `error.test.tsx`.
3. Auth entry: `login/login-panel.tsx` (presentation), `LoginClient.tsx` (render only, logic unchanged), `login/page.tsx` (fallback), `login/login-panel.test.tsx`, small `admin.css` additions.
4. Docs: inventory statuses and evidence for the touched routes only, `local-handoff.md`, `rendered-acceptance.md`, `SURFACES.md` rows.

No browser fixture route exists for staff UI and none is created. Evidence is SSR component tests plus source coverage.
