# Local redesign handoff

2026-11-01. This is an isolated integration candidate, not a released or visually accepted
redesign. Original checkout and servers remain unchanged at `c65df582`.

## Actual ownership and model assignments

- Coordinator: this Codex task, clone at
  `/Users/geralddagher/Documents/Codex/2026-10-31/task-4/blackstory-integration`, branch
  `redesign/coordination-inventory-2026-11-01`.
- Codex Luna: adversarial review and route/state inventory completed.
- Codex Sol: bounded collection continuity implementation and targeted checks completed.
- Claude Sonnet 5.5: completed the bounded collection-navigation UI implementation in isolated
  clone `/tmp/blackstory-claude-collection-ui-20261101`; receipt model `claude-sonnet-5-5`,
  session `23ed4862-dd03-432a-80df-596352cbd471`, process exit 0. Eight files were edited.
  File tools only, restricted to that clone; no test execution, subagents or shell tools.
- Existing CLI authentication was verified outside the sandbox as `claude.ai`, first-party,
  Max subscription. The sandboxed status could not see that login. No credentials or shared
  configuration were copied or changed, and no paid API fallback was used.
- Existing Claude owner: unknown. Scoped and global `claude agents --json` returned no
  sessions, while process working directories showed Claude in BlackStory. No session was
  resumed, attached, stopped or scraped; no owner message was delivered.

## Saved work

| Commit | Outcome |
|---|---|
| `f26bcc9c` | Adversarial refinements, acceptance criteria and branch/ownership reconciliation |
| `69738c7d` | 66 page sources and six shared surface groups; route/state/reference guard in `validate` |
| `64e5d8b3` | Normalized query and bibliography order across map/list/record, authoritative matches including unlocated records, bounded catalog cache version and compatible additive payload |
| `0ed47f20` | Claude's shared collection view switch and counts, with Codex fixes for real tokens, pagination retention, catalog fallback and a duplicate test import |

The slice reuses `DiscoveryState` and Records matching. Opaque first-paint pins use actual
cached-plate ordering; controls stay inert with explicit loading until matching facts arrive.
Map-only display order remains separate from bibliography order. Existing clients still accept
schema version 1; new clients request finite `v=3` and reject incomplete payloads. No new state
store, data service or dependency was added.

## Verification

Runtime revision `64e5d8b3`, Node 22.23.1, existing installed dependencies reused without installation:

- `pnpm --filter @repo/web test`: 2,830 tests, 2,822 passed, zero failed, eight skipped.
  Log: `/tmp/blackstory-frozen-web-tests-final-20261101.log`.
- Inventory plus site edge tests: 21 passed. Inventory check maps 66 routes and six shared groups.
- Formatting, scoped web ESLint and diff checks pass.
- Follow-up dependency/foundation builds passed. After removing an existing duplicate Field
  import in a test, web TypeScript checking passes; the earlier 55 diagnostics were largely
  missing/stale workspace artifacts rather than 55 established source defects.

The stable UI working candidate passed 2,832 web tests with eight skipped and zero failed
(`/tmp/blackstory-claude-ui-frozen-web-20261101.log`). New module filenames were then normalized
to the project's lowercase convention; the final component/integration recheck passed all ten
tests. Changed-web ESLint, formatting and inventory checks pass. The global token ratchet still
fails with diagnostics byte-identical to the untouched original baseline; the new collection
CSS adds no flagged violations. No extra reviewer or repeated plan audit was launched.

The first aggregate caught two source-text guards tied to the old shell argument count and
map-only match count. They now assert cached-plate ordering and whole-collection counts;
separate behavioral tests prove the opaque-pin and unlocated-record cases. The frozen rerun
above passes them.

Candidate component fixtures were inspected at 375px and 1280px, across light/dark themes;
the view controls wrap without clipping and keyboard focus is visible. These are actual SSR
components with seed/synthetic data, not a full app or a functioning geographic interaction.
Safe static preview: http://127.0.0.1:3102/records-light.html and `/map-dark.html`.
http://localhost:3048/ still serves the original checkout.
http://127.0.0.1:4199/ is the inspected fixture prototype, not this implementation. Desktop,
mobile, light/dark, browser Back, focus, loading/retry and production payload performance remain
gates. The four-record seed payload grew by 325 gzip bytes; synthetic repetition is not a
production performance estimate.

## Blockers and next action

Claude authentication and the implementation lane succeeded. Current original-owner discovery
remains unavailable; shared-checkout integration and original branch pruning still await a
handoff rather than competing with an unidentified writer.

The initial environment-reuse attempt was denied and did not execute. The owner subsequently
explicitly approved the exact bounded read-only reuse. The reviewed retry succeeded: only this
clone has an ignored `.env.local` link to the original BlackStory environment. Non-secret
backend metadata matched the repository's Supabase project. The full candidate is running at
**http://127.0.0.1:3103/**, loopback only, with Postgres `default_transaction_read_only=on`.
Original port 3048 remains untouched. Existing installed dependencies were materialized inside
the clone with APFS copy-on-write; no package installation or shared configuration change.

At `c996f398`, the candidate integrates the second Claude Sonnet 5.5 reading slice (session
`0aa6b48d-912b-4f80-ba0e-90fdf53b5730`, exit 0): native narrow-screen contents, unchanged numbered
references, and source-derived linked records with typed relations. Focused Codex review fixed
the breakpoint seam and distinguished retrieval errors from unresolved public links. A true
retrieval failure now retains the story and offers retry for its linked-record appendix.

Live rendering exposed search-projection drift: Records used the released slim index while Map
used full entities. Both now share the released index/fallback, start independent reads together,
and retain unavailable-index fallback to the real entity release. Actual map-feature IDs bound
the Records map count; anchor eligibility alone is insufficient. This introduces a cold Records
request dependency on the existing cached pin plate; no additional data is sent to the client.
Live `/records?q=school&sort=name` and `/explore?q=school&sort=name` agree on 1,095 matches and
963 mapped records. This is UI/read-adapter work, not a stored projection correction.

At c996f398, 43 focused integration/reading/catalog tests pass, web TypeScript and changed-source
ESLint pass. A subsequent actual-feature count regression passes all nine continuity tests.
Earlier full-suite evidence above remains historical for its exact revision. Narrow story
contents were operated in the full app: one contents placement is visible, native disclosure
opens, 375px document width has no horizontal overflow. Screenshot:
`/tmp/blackstory-redesign-proof-20261101/chapter-contents-mobile.jpg`.

The broader composition lane has actually started on Claude Sonnet 5.5, session
`1bb5017b-e4dd-4a90-adc4-52bf5d7628d0`, in
`/tmp/blackstory-claude-ground-composition-20261101`: home collection entry, map/index workbench,
and place-record mast. File tools only, bounded source lease, no environment/database access.
The coordinator owns integration and rendered acceptance. This is in progress, not acceptance.

Owner gate: any schema or stored-record change requires an exact proposed diff, adversarial
review, isolated/synthetic validation, impact and rollback plan, then **final user sign-off
before application**. No such changes have been applied. Range semantics, remaining family
migrations and all-route rendered acceptance remain open; original ownership still blocks
canonical branch reconciliation/pruning, not isolated source work.

This clone's `origin` is a local path, not GitHub. No push, deployment, published-data write,
original branch deletion or original working-tree change occurred.

## Finish polish on d9b9604f (Claude Sonnet 5.5, isolated clone, 2026-11-01)

Changed: `collection-period-controls.{tsx,css}`, `records-chronology.css`, `RecordsIndex.tsx`,
`collection-context.test.tsx` (two new disclosure tests), `collection-contract.md`, this file.
Nothing rendered or browsed; the root owns 375/1280 and light/dark comparison. No data, schema,
manifest, dependency or protected-route change.

Wrapper results at this revision: focused 125/125, types pass, edge 59/59, inventory ok
(66 routes, six shared surfaces). The first aggregate had two failures; one was the room-kit guard
"no public route has an Apply button", fixed by relabelling the period submit "Show records"
(guard untouched).

**Remaining aggregate failure, identified and fixed.** `door-catalog.test.ts` ("door home and pin
route share the cached pin plate loader") matched a five-argument `buildAtlasShell(...)` call.
`door-home.tsx` now passes the resolved story collection descriptor as a sixth argument on
purpose, so the stale assertion was updated to require `collectionCatalog, collection`. The
guards that `door-home.tsx` uses `loadDoorPinPlate`, does not use `toDoorLinkPins`, and that the
pin route stays off `getSharedPublicEntities` are unchanged. Fixed wrapper `regression`: 5/5
pass. Only a source-regex assertion changed, so the full aggregate was not repeated; the delta
from 2,906 pass / 1 fail is expected to be 2,907 pass / 0 fail, which the root should confirm.

**Map status fix (found in the real browser).** With a named collection and a documented range
active, the bottom time panel still said "All time / 4,202 records" and the Filters chip said "no
filters", contradicting the collection strip (2 records, Documented 1860s through 1900s). The
slider keeps its meaning (its "All time" is still the whole archive, and no handler or value
moved). Changes: `AtlasExperience.tsx` builds a `scopeStatus` line only when the scope is
countable (`Collection narrowed: N records, Documented 1860s through 1900s`, or `Documented
range: N records, ...` with no named collection); `TimePanel.tsx` shows it on its own line and
its all-time sub-line becomes "4,202 records in the whole archive" while a scope is set;
`decade-density.ts` `decadeSubLine` takes an optional `scoped` flag; `time-panel.css` styles the
line; the Filters chip reads "no map filters" instead of "no filters" while scoped. An
unresolved or unreadable scope still shows no count. Added a `decade-density.test.ts` case for
the scoped and unscoped sub-line. Fixed wrapper `focused` 125/125 and `types` pass after the
change. The new test file and the rendered panel (375/1280, light/dark, line wrapping inside the
narrow panel) are not browser-verified here; the root owns that.

Secondary public routes, read from source in this pass (`sources/page.tsx`,
`SourcesSections.tsx`, `rooms/page.tsx`, `law/page.tsx`, `law/LawBrowseSections.tsx`):

| Route | What the source shows | Classification |
|---|---|---|
| `/sources` | Shared Room kit with an entry plate, three jump sections (citation chain, publisher kinds, where sources appear). It states that counts live on the operator desk and lists no individual source. | Retained distinct reading-room layout. Reader-facing copy now; the old "pipeline words" finding is stale. Not merged into methodology. |
| `/rooms` | Wayfinding hub whose cards, groups and copy derive from the destination registry; no second index or immersion surface. | Retained as orientation. The "Retire `/rooms`" proposal in `SURFACES.md` is an open IA and redirect decision, not an implementation gap. |
| `/law` | Browse with entry plate built from an already quoted catalog entry, stats, orientation rail, search/sort view model and the shared `Pagination`. It declares no documented join to a record. | Retained distinct browse layout. The old "no pagination" finding is stale. |

Detail views (`/law/[slug]`, books, errata, Stories index, mosaic credits, Memorial) were not
re-read in this pass; an earlier pass recorded books browse and errata as retained reading rooms
from source, which is not re-verified here. None of these is rendered-complete.
`surface-inventory.json` statuses are left unchanged: the vocabulary only allows complete with
explicit verification metadata, none exists for these routes, and their route-level `pending`
means acceptance is not recorded, not that the page is broken. Source and test references are
planning evidence, not visual QA.

**Remaining gaps, split by kind.**
- Independent implementation or verification (no owner decision needed): rendered acceptance at
  375/1280 in light and dark for the ten public routes the inventory still counts pending (books
  browse/detail, errata, law browse/detail, Memorial, Rooms, Sources, Stories index, mosaic
  credits); Records cold-load budget with the cached pin plate; browser check of the map status
  line above.
- Data gate: the mosaic manifest has no immutable tile author or licence metadata, so
  `/stories/mosaic-credits` names sources but invents no per-tile credit. Real credits need the
  manifest data from its owner. No law dataset is manufactured to fill a layout.
- Owner or product decision: exact date-bound semantics for uncertain or undated records (census
  decades are not event intervals); whether to retire `/rooms` or merge `/sources`; any schema or
  stored-record change, which needs final sign-off before application.
- Authorization and integration gates: Memorial's protected access rules stay untouched; staff
  surfaces (31 pending in the inventory) are behind authentication and were not inspected;
  canonical merge and original branch pruning wait on the original owner.

## Latest candidate — 6ae2b4a4

The broader source slice is saved and serving at **http://127.0.0.1:3103/**. See
[rendered-acceptance.md](./rendered-acceptance.md) for exact revision, tasks, screenshots, payload
measurement, test evidence and explicit unfinished scope. Original checkout rechecked at
`c65df582`, branch `redesign/ux-audit-2026-10`, only untracked old HANDOFF.md.

New commits: `c996f398` shared released membership and reading improvements; `b27bd688` coherent
collection entry/workbench/place composition; `6ae2b4a4` shared record-family return, preserved
redirect narrowing, safe actual map eligibility, unmapped row notes and lossless bounded v4
transport. No push, deployment or original branch/worktree mutation.

Two additional Sonnet5.5 tasks genuinely completed (exit0):
- composition: session `1bb5017b-e4dd-4a90-adc4-52bf5d7628d0`, isolated ground-composition clone;
- record continuity: session `76d8e145-21e8-4fed-b990-d1e8ca4fc6f3`, isolated record-continuity clone.
Codex performed integration, defined-risk delta review and rendered checks. One focused Codex
transport lane completed in `/tmp/blackstory-transport-20261101`; its exact roundtrip/gzip proof
is in `/tmp/blackstory-transport-handoff-20261101.txt`. No new Claude implementation task remains
running; original Claude ownership is still unknown, not inferred from process liveness.

The candidate was restarted once after newly exported functions stayed stale in Next's dev
module graph. The real person-record retry then rendered correctly. Current owned Next PID9740,
terminal session71058, port3103, loopback-only/read-only Postgres. Keep it running for the user.
No original server was restarted.

Exact unresolved integration action: merge/reconcile this isolated candidate into the original
checkout and prune original branches/worktrees. **Not attempted; pending original-owner handoff.**
Parent explicitly barred canonical merges/pruning while that ownership remains unresolved.
Native discovery exposed no contactable owner; private session scraping/resume was not used.
This is a verified core candidate, not a claim that the full redesign is finished.

### Coordinator integration receipt (2026-11-01)
Sonnet finishing execution and routine checks are integrated. Follow-up session
`774230de-a0bf-42cf-bd3c-9340eff366d5` verified model `claude-sonnet-5-5`, exit 0. The final frozen
aggregate is 2,916 tests, 2,908 pass, 8 skip, 0 fail (measured, not projected); the new decade
test ran in a targeted 16 pass. Root standardized the new chronology breakpoint to the existing
48rem with no behavior-logic change. Actual browser evidence is in `rendered-acceptance.md`. The
canonical original owner remains unknown: no merge, prune, push or deploy. The read-only database
guard is unchanged. Stored schema or records still need a reviewed proposal, synthetic validation,
impact and rollback plan, and final user sign-off.

## Public state closeout (Claude Sonnet 5.5, isolated clone, base 9f62798f)

**Ten public routes were pending in the inventory:** `/books`, `/books/[slug]`, `/errata`, `/law`,
`/law/[slug]`, `/memorial`, `/rooms`, `/sources`, `/stories`, `/stories/mosaic-credits`. Each was
read from source against the shared loading, error, empty and not-found components. Most "pending"
reasons were generic text, not findings.

**Real gaps fixed (source and tests):**
- `/stories` awaits the story list but had no `loading.tsx`; added it, plus `/stories/[slug]/loading.tsx`
  (before, the detail route inherited the parent wait). Both use the shared `CatalogLoading`.
- `app/error.test.ts` imported a legacy `UtilityEditionErrorView`, never the live `app/error.tsx`
  that every public route inherits. Two tests now render the real boundary: retry plus way home,
  and no raw message or stack in production.
- New `app/public-route-loading.test.tsx` renders all seven public loading boundaries (one polite
  announcement, hidden placeholders, no invented counts) and asserts the static rooms (`/errata`,
  `/memorial`, `/rooms`, `/sources`) have none because they await nothing.
- `scripts/check-surface-inventory.mjs` gained a drift guard: a route cannot record loading as
  pending or not-applicable while a `loading.tsx` sits beside its page. Existing route, source,
  state and verification guards are unchanged. Case added to `check-surface-inventory.test.mjs`.

**Inventory dispositions (statuses are not visual verification; nothing is marked complete):**
loading baseline for books, books detail, law, law detail, stories, story detail and mosaic credits;
error partial for books, law, stories, mosaic credits (stated unavailable notes plus the inherited
boundary); empty partial for books, law, stories and errata; selected partial for books, law,
stories and mosaic credits. Memorial, errata, rooms and sources are `baseline` retained layouts with
loading recorded as not-applicable because they await no read; inherited route errors remain applicable to synchronous rendering and are recorded separately. Route-level `partial` for
the seven data-backed routes, `baseline` for those four. Shared `system-states` error moved to
`partial`, still naming the missing `global-error.tsx`.

**Corrected old findings (source evidence):** `/law` is paginated (24 per page via shared
`Pagination`, `LawBrowseSections.tsx`); `/books` has a working 12-per-page pager with
`rel=prev/next` in its own view model; `/sources` is reader-facing copy, not pipeline words;
`/errata` has an empty state and is intentionally unpaged at 7 entries. `SURFACES.md` rows updated.

**Not changed:** published identities, author prose, Memorial (no pins, access rules, wall), auth
gates, any public URL, manifest, schema or data. Mosaic credits still invents no per-tile credit.

**Checks run through the wrapper:** `focused` 125/125 (its target list does not include the new
test files), `types` pass, `inventory` ok (66 routes, six shared surfaces), both before and after
the fix below.

**The one aggregate failed: 2,926 tests, 2,909 pass, 9 fail, 8 skip.** The wrapper prints only the
tail, so the failing names were not visible. The count was 10 above the 2,916 baseline, so the new
tests did run. Nine failures match the 7 loading renders plus the 2 `app/error.tsx` renders in the
new tests: those files used JSX without `import React`, which the test loader needs (the repo's
pages and `entity/[id]/loading.tsx` use `import React` plus `void React`). That is a diagnosis by
inference, not a read failure log. The fix added that import to the seven `loading.tsx` files and
`error.tsx`; no behavior changed. **The fix has not been re-run through the aggregate**, so the
root should rerun it and expect 2,926 tests with 0 fail; treat any other failure as unexplained.

**Follow-up fixes:** (1) map-controls.css hides the on-map control group at compact sizes while a
sheet is open over a collection strip (`.ds-atlas[data-sheet-open][data-collection=shown]`), restoring
on close; landscape phones (no lift) and desktop are unchanged; guard test
`app/map-controls-collision.test.ts`. (2) `app/global-error.tsx` with `app/global-error.test.tsx`.
(3) 404 keeps its visible Find in the archive and Read the chapters links; no change. Wrapper
`public` 122/122 pass after (1) and (2) were added. The stub `components/map-experience/map-controls-collision.test.ts`
is a leftover with no tests; root should delete it.

**Remaining, by kind:**
- Implementation: none open in this pass's scope.
- Verification (root): rerun the aggregate at root integration; rendered acceptance at 375/1280 light and dark for
  the ten routes, including the new loading waits and unavailable notes; map status line and
  Records cold-load budget from the earlier pass.
- Optional decisions, not blockers: retire `/rooms`, merge `/sources`, adopt the shared
  `Pagination` in `/books`, window `/errata` if it grows.
- Gates unchanged: mosaic manifest author and licence data; stored schema or records need final
  sign-off; original-owner canonical merge and prune; 31 staff surfaces protected.

### Remaining-state slice (Claude Sonnet 5.5, isolated clone, base 50060223)

Classification with per-route acceptance is in `.task-tools/migration-classification.md`. Real public gaps
found and fixed: `/records`, `/place/[slug]` and `/invention/[slug]` awaited data with no `loading.tsx`.
Staff gap fixed: all 29 staff desks inherited the public error boundary (public copy, "Back to home");
`app/admin/error.tsx` now serves them. Auth entry: `admin/login/login-panel.tsx` extracts presentation only
(live status, alert linked to fields, busy and verifying states, suspense fallback announced); `LoginClient`
handlers, `enterConsole`, `/admin/api/auth/me` check and the POST form are unchanged. Inventory moves the
touched states to baseline or partial (records error/empty and entity error as inherited or in-page evidence);
the guard passes at 66 routes / 6 shared surfaces. Checks through the wrapper: `staff` 12/12, `public` 125/125
(was 122; the three new loading cases), `types` and `inventory` pass. `ui.tsx` and `login-panel.tsx` gained the
repo's `import React` plus `void React` after a first `staff` run failed 3 of 12. Root's 32px touch-target
finding is addressed in CSS only (`admin.css` login scope, `management.css` coarse-pointer inputs); it is the
dense `pointer: fine` rule, so it is not measured in a browser. Nothing rendered.

Still open: `/lives/explorer` and `/data` loading and error, `/`, `/explore` error and empty states, a shared
staff list empty state (two ad hoc empties today), per-desk staff selected/focus. Populated protected
acceptance needs a real staff session and data. Owner release is still needed only for canonical merge and prune.

### Final integration checkpoint

The independent public implementation pass is integrated and verified. Frozen web aggregate: 2,929 tests, 2,921 pass, eight skipped, zero failures. TypeScript, scoped ESLint, eight inventory guard tests, and the 66-route/six-shared-surface manifest check pass. Final source and log evidence is in rendered-acceptance.md. Root removed an empty task-owned test stub, corrected the global fallback's canvas token, and removed raw client error logging. The new global and inherited boundaries keep error details out of rendered output.

The mobile When-drawer collision is browser-verified fixed at 375px light: controls hide while the compact collection drawer is open and restore on close. The invalid-period recovery also returns to the same five-record story collection. Static public pages retain inherited error-boundary coverage; only their catalog loading state is not applicable. Inventory route totals are 19 partial, 16 baseline and 31 pending; all pending routes are staff or authentication-entry surfaces. Partial/baseline are implementation dispositions and supporting evidence, not blanket visual acceptance.

Next required coordination action: identify or obtain release from the original Claude owner of `/Users/geralddagher/Developer/Projects/blackstory`, branch `redesign/ux-audit-2026-10`, before canonical reconciliation or branch pruning. Supported discovery did not establish an owner; no private session access or takeover occurred. The isolated candidate remains reviewable on port3103. No push, deploy, canonical merge, branch deletion or stored data change has been attempted. Exact immutable copied-tile author/licence metadata remains unavailable; any schema or stored-record remedy requires a scoped proposal, adversarial review, isolated validation, impact/rollback, then final user sign-off before application.

### Remaining UI slice A — integration checkpoint

Claude execution receipt: session1473cad3-638d-4b6b-8d53-727ea3c1d752, verified claude-sonnet-5-5, exit0. Added Records/place/invention loading, staff-specific error recovery, and a presentational sign-in panel with synthetic idle/not-ready/busy/verifying/error coverage. Auth handlers and checks were reviewed unchanged; form method remains POST. Twelve staff/auth tests,125public tests, types and inventory passed in the isolated worker; scoped auth ESLint and12staff/auth tests passed after integration.

Actual browser found the extracted BaseUI panel needed an explicit client boundary when imported by the server Suspense fallback; coordinator added it and verified successful live rendering. At375px light, password, reveal and submit targets now measure44px; email's inner input is still40px despite its44px wrapper, so that remaining target needs correction. No credentials were entered and no sign-in was submitted. The existing zero-match named map collection also renders honest scope with Filters/one-filter recovery; do not infer missing empty UI from stale pending labels.

Migration classification is saved in migration-classification.md. Remaining public failure/empty cases need focused source confirmation, then genuine fixes; staff empty/selected patterns need representative assessment. No aggregate was repeated during this slice. Populated protected acceptance, copied-tile credit data and canonical owner release remain distinct gates.
