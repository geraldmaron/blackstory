# Local rendered acceptance — 2026-11-01

Runtime source revision: `6ae2b4a4b378eff3dcaf436784a2c3280870772c`.
Branch: `redesign/coordination-inventory-2026-11-01` in the isolated integration clone.
Preview: **http://127.0.0.1:3103/**. Original http://localhost:3048/ remains on `c65df582`.
This is a bounded candidate report, not all-surface or release acceptance.

## Visible slice

- Home: two-column collection entry beside the map on desktop, stacked on phones; real GET
  search into Records, direct map/list choices and the existing guided walk. Counts and spotlight
  remain release-derived. No invented named collections or authored record changes.
- Records: compact editorial mast and one investigation workbench; shared map/list view choice,
  native search/facets/sort and pagination. Matches absent from the safe map plate remain readable
  and carry **Not on the map** on their row. Clipped names have a full title.
- Map: the same collection and bibliography order, clear distinction between membership and
  temporary map limits, coordinated matte rails. Current rendered school query has **1,095
  matches and 1,094 drawable records** in both views. The earlier 963 figure was an interim
  overconservative search-index-geohash gate, corrected after independent review: membership
  comes from the released index, drawing from the actual redacted public feature set.
- Reading: narrow native chapter contents before prose; desktop rail uses the same anchors.
  Numbered references and authored text persist. Linked records state explicit relation types,
  unresolved-public-link and true retrieval-failure states separately.
- Place/person/invention: one shared investigation-return bar, preserved query/sort and list
  position. Place identity has framed geography with published precision, plus unchanged evidence
  axes. Person and invention retain their distinct record anatomy. Unmapped/protected records
  return without a promised pin or viewport. The duplicated bar, fallback reader and unfiltered
  record-room map-link builder were removed.

## Actual rendered tasks

Operated through the full candidate with approved read-only Postgres, not static fixtures:

| Task | Observed result |
|---|---|
| Home GET search for school | Arrives at Records with q; no JavaScript-only search dependency |
| Records school/name → Map | Same q/sort, 1,095 matches / 1,094 drawable; narrow and wide checked |
| Mobile map row → selected record → 1907 House | Public address retains from=map, q and sort |
| 1907 House → return to Records | `/records?q=school&sort=name`; narrowing and count retained |
| Unmapped William F. Penn | Explicit row note; entity address retains from=list/q/sort; no public map location; return restores its one-record collection |
| Cabinet Bed from invention list | Invention address retains kind/sort/origin and shows 1 of 32 in the list |
| Historical entity address for Cabinet Bed | Resolves to its invention address with the same narrowing |
| Historical `/place/cabinet-bed` | HTTP 308 to invention with normalized arrival query |
| Legacy `/search?q=school&sort=name` | Arrives at Records with q/sort; state/evidence also covered by targeted tests |
| Legacy `/history?decade=1920s` | HTTP 308 to `/records?era=1920s` |
| The Count at375px | One inline contents placement, native disclosure opens, exact heading anchors; no horizontal overflow |
| Journey/browse keyboard transition | Hidden subtree is inert; active controls remain reachable; Next route remount focuses main and Tab reaches Back to journey |

Next's streamed entity redirect response was observed as HTTP200 with its browser redirect,
not a verified HTTP308. Source still uses permanentRedirect; no stronger status claim is made.
No user forms were submitted. No stored records, migrations, seed data or production data changed.

## Evidence and validation

Screenshots are local artifacts in `/tmp/blackstory-redesign-proof-20261101/`:

- `collection-entry-desktop.jpg`, `collection-entry-mobile.jpg`
- `collection-index-desktop.jpg`, `collection-index-mobile.jpg`,
  `collection-index-desktop-light.jpg`, `collection-index-mobile-light.jpg`
- `collection-map-desktop.jpg`, `collection-map-desktop-light.jpg`, `collection-map-mobile-light.jpg`
- `place-record-desktop.jpg`, `place-record-desktop-light.jpg`, `place-record-mobile.jpg`
- `person-record-desktop.jpg`, `invention-record-desktop.jpg`, `chapter-contents-mobile.jpg`

Screenshots document the iteration; some predate the final map-count correction or shared-bar
extraction. The latest map, person and invention captures show the final visible behavior.
They are evidence samples, not a complete screenshot matrix.375px and1280px reflow/light/dark
were inspected; full keyboard/screen-reader/reduced-motion, all lifecycle states and every
record/photo variation remain incomplete.

At the frozen source revision:

- Web: **2,892 tests; 2,884 pass, eight skipped, zero failures**.
  `/tmp/blackstory-final-frozen-web.log`.
- Web TypeScript: pass. `/tmp/blackstory-final-frozen-tsc.log`.
- Changed-source ESLint: pass. `/tmp/blackstory-final-eslint.log`,
  `/tmp/blackstory-legacy-eslint.log`.
- Inventory/edge:21 pass;66 routes and six shared groups mapped.
  `/tmp/blackstory-final-frozen-edge.log`.
- Global token ratchet retains preexisting failures; changed composition styles add no new
  flagged rules. `/tmp/blackstory-final-tokens.log`.

Public catalog comparison on this machine: original4,955,912 raw /984,754 gzip bytes. Naive new
facts made the candidate8,322,692 raw /1,805,254 gzip. Lossless references to existing story text
reduce the live v4 response to **6,413,881 raw /1,204,960 gzip**, with4,180 referenced haystacks.
All4,210 facts roundtrip exactly in the representative fixture; malformed references are
rejected before caching. Legacy URLs keep raw string haystacks; only bounded v4 opts in. These
are local payload measurements, not production latency claims. Cold Records now also loads the
existing cached safe pin plate to make drawable counts factual; a production cold-load budget
is still open.

## Honest remaining scope

Inventory: **13 partial,12 baseline,41 pending; zero marked complete**. Pending includes31 staff
surfaces and10 public ones: books browse/detail, errata, law browse/detail, Memorial, Rooms,
Sources, Stories index and mosaic credits. This counts outstanding acceptance/spec work, not
41 known broken pages. Existing kit adoption or old tests are not new visual acceptance.

The GROUND proposal is not fully implemented. Named story-set map handoffs and a distinct
chronology/range experience are still absent. Exact date bounds need grounded semantics for
uncertain/unknown dates; census decades are not historical event intervals. No law dataset or
publication migration was manufactured to satisfy a layout. Protected Memorial/access rules
remain intact. Further source work can continue in isolation; the original-owner constraint
blocks canonical integration and deletion of original worktrees/branches.

Schema or stored-record proposals require scoped diff, adversarial review, isolated validation,
impact/rollback and **final owner sign-off before application**. This candidate does not include
such a proposal.

## Story collection and chronology integration — 2026-11-01

Source candidate: d9b9604f plus the two bounded Sonnet finishing tasks (2e6f1cea and 774230de); the following polish commit freezes this delta. Live read-only preview remains http://127.0.0.1:3103 .

- Actual published story `the-count` resolves five explicit linked records. Native documented-range GET1860..1900 plus undated resolves two: Freedmen's Bureau Act of1865 and Greenwood District. Chronology→record→return retained collection, bounds, undated flag and chronology; switching to Map settled to the same two records, with1860s/1900s labels. These are archive buckets, not exact occurrence dates.
- New native period disclosure opens with Enter/focus on SUMMARY; range GET works after polish, zero nestedforms. Invalidrange fail-closed behavior remains covered by focused tests.375px and1280px chronology have zero horizontaloverflow. Wide view renders a144px decade margin; narrow view stacks. At375px the first row remains below the initial viewport (top802px), so do not claim all rows abovefold; the large expanded form is removed from initialflow.
- Map status explicitly distinguishes the narrowed collection/range from the archive-wide slider; actual rendered scope says two records and the matching1860..1900 range. Wholearchive subline is qualified. Desktop screenshot confirms wrap/readability; this is not a claim of exhaustive map QA.
- Law375px: live12entries, nohorizontaloverflow/nestedanchors.24-row pagination boundary uses synthetic focused evidence, because liveentrycount is belowthreshold. Its loadingboundary was observed duringnavigation.
- Mosaiccredits375px: recordednames and images load; Next?page=2 exists; nohorizontaloverflow. Missing immutable copied-tile author/licence metadata is stated honestly; currentrecordcredits are not substituted.
- Screenshots in /tmp/blackstory-redesign-proof-20261101: story-chronology-desktop.jpg, story-chronology-mobile.jpg, story-range-map-desktop.jpg, law-room-mobile.jpg, mosaic-credits-mobile.jpg. Screenshots record the stated viewport/state, not acceptance of everyroute/state.

Frozen integration checks: web aggregate2916tests,2908pass,8skip,0fail (`/tmp/blackstory-final-candidate-web.log`); targeted door-loader+decade-density16pass; Claude focused125pass, typespass, edge59pass, inventory66routes/6sharedsurfacespass. The earlier one aggregatefailure was a stale five-argument source assertion, fixed without removing cached-loader guards. No database writes, publishing or canonical merge occurred.

## Public-state finishing receipt — 2026-11-01

Candidate based on9f62798f plus Claude public finishing sessions b3a29fc4 and b6ac52d6 (both verified claude-sonnet-5-5, exit0). Missing Stories list/detail loading boundaries, inherited-boundary tests, a standalone root-layout fallback and a loading/inventory drift guard are integrated. The fallback uses the actual `--ds-canvas` token with a plain CSS fallback; raw error logging was removed at integration. No authored content or stored records changed.

Actual375px light rendering confirms the map's When drawer no longer overlays the collection caption with Group nearby. The floating controls are hidden while this compact collection drawer is open, then visibly restore when it closes. The two-record range and qualified whole-archive status remain readable, without horizontal overflow. Screenshot: /tmp/blackstory-redesign-proof-20261101/story-range-time-mobile-final.jpg.

The invalid-range recovery was also exercised: explanatory unresolved collection state, zero rows, automatically opened period disclosure and Clear range returning to the same five-record story chronology. This is rendered recovery evidence, not an induced database failure. Existing retained secondary layouts use source/component-test evidence; no exhaustive375/1280 light/dark acceptance of every route is claimed.

Final frozen checks: web2929tests,2921pass,8skip,0fail (/tmp/blackstory-public-final-web.log); TypeScript pass; scoped ESLint pass; inventory guard8pass; manifest check66routes/6sharedsurfaces. Earlier9 aggregate failures were confirmed as ReferenceError in the new JSX render tests and corrected with the repository's explicit React import convention. The passing final aggregate includes those tests. No further aggregate is required for documentation-only evidence updates.

## Completion pass — base 59c1667f, not browser-verified

Source-first reads of `/data`, `/lives`, `/lives/explorer`, `/corrections/status*`, home/Explore error and empty, `CaseQueue` and `/admin/queue`. Added: `data/loading.tsx`, `lives/loading.tsx`, `corrections/status/[receiptCode]/loading.tsx`; `loadLivesAreaView` plus `LivesSourceNotice` (unpublished warning, unreadable alert with native retry); `CaseQueueEmpty` and a native row button with focus return in `CaseQueue`; a 44px floor on the native email input in the login scope. Wrapper results after the changes: `public` 128/128, `staff` 12/12, `guard` 8/8, `types` pass, `inventory` ok (66 routes, 6 shared surfaces). The two new test files (`lives-source-notice.test.tsx`, `case-queue-empty.test.tsx`) ran through the root's `states` wrapper argument: 6/6 pass. Not rendered: the email target height, the Lives notices, the staff empty state. No aggregate was run, and no populated protected acceptance is claimed.

## Remaining-state slice — base 50060223, not browser-verified

Added `loading.tsx` for `/records`, `/place/[slug]` and `/invention/[slug]` (the latter two reuse the record skeleton); `app/admin/error.tsx`, one staff error boundary replacing the inherited public one (staff copy, retry, link to `/admin`, sanitized detail); and `admin/login/login-panel.tsx`, a props-only presentation of the sign-in panel (idle, auth not ready, signing in, verifying an existing session, failed) with a live status line and an alert linked to both fields. `LoginClient` keeps every handler and auth check unchanged and only renders the panel. Evidence is SSR component tests with synthetic props. No fixture route exists for staff UI and none was created, so no populated, authenticated or browser acceptance is claimed.

Touch targets (from root's unauthenticated 375px observation of 32px fields, show-password toggle and Sign in button): that height is the dense `pointer: fine` desk rule, which a narrow desktop window also matches. `admin.css` now pins 44px for inputs, buttons and the show-password toggle inside `.admin-login` whatever the pointer, and `management.css` adds inputs and selects to the existing `pointer: coarse` 44px rule that already covered buttons. Validation, labels, autocomplete and handlers are untouched. This is CSS only and is **not measured in a browser**; root should re-measure at 375px.

Wrapper results: `staff` 12/12 (admin error 3, login panel 9), `public` 125/125 (122 before plus the three new loading boundaries), `types` pass, `inventory` 66 routes / 6 shared surfaces pass. A first `staff` run failed 3 of 12 because `admin/design-system/ui.tsx` renders JSX without `import React`, which the test loader needs; the repo's `import React` plus `void React` convention was added there (`login-panel.tsx` needed it too) and no behavior changed. Not yet done: render `/admin/login` at 375/1280 in light and dark, and trigger the staff boundary with a synthetic throw.

## Final independent UI completion — 2026-11-01

Claude execution:1473cad3 (loading/auth/staff recovery),901f964e (public states and representative staff states),a8d56a37 (focused modal/fixture refinements); each verified claude-sonnet-5-5 and completed exit0. No new Codex workers.

- Actual unauthenticated sign-in at375px light/dark: native email/password, reveal, submit and theme controls measure44px; no horizontal overflow. No credentials entered or submission made. The extracted BaseUI module's required client boundary was caught and corrected through the actual browser check.
- Actual Lives default renders its published editorial view at375px without overflow. Actual Data shows its new Opening data wait, then resolves to the sourced indicator view without overflow. Records' new Opening records wait was also observed.
- Explicitly synthetic Lives unpublished/unreadable notices and staff filtered-empty/empty components rendered at375px light/dark and1280px dark; no overflow, readable contrast and44px native recovery links. These are component captures with synthetic props, not protected populated acceptance or real mutation tests. HTML is self-contained, has a synthetic heading, and is served separately on loopback3102.
- Staff dialog source now reuses the tested focus-trap/inert hook and restores row focus after cleanup. Shared hook tests pass; actual protected CaseQueue interaction is not claimed. Filtered-empty copy does not assert that unseen cases exist.
- Two obsolete, unreferenced acq__empty CSS blocks were removed only after the replacement empty component was rendered. Public routes and historical content remain.

Final frozen aggregate after cleanup:2,953 tests,2,945 pass,eight skipped,zero failures (/tmp/blackstory-final-stable-web.log). TypeScript passes on the same TypeScript sources; scoped changed-file ESLint, inventory guard and66-route/six-shared-surface manifest checks pass. Existing unrelated token-ratchet debt remains outside this slice; no global-clean claim.

Durable visual evidence and the two labelled standalone HTML captures are in /Users/geralddagher/Documents/Codex/2026-10-31/task-4/artifacts/blackstory-redesign-20261101 . The actual app remains http://127.0.0.1:3103 . The separate synthetic capture is http://127.0.0.1:3102/state-fixtures-light.html .


## Real staff acceptance after owner release

The former protected-session gate is resolved. Real read-only Work/Inbox/Queue and desktop/mobile case-dialog checks passed on code7fb7f62a in the user's existing Chrome session; see staff-acceptance-and-reconciliation.md. No protected record text, identifiers, credentials or tokens are included in this report. Synthetic fixtures remain distinct. No record decision or mutation was submitted.
