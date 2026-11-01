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
