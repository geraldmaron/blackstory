# Admin console: from pipeline to footprint

Status: revised after adversarial review, 2026-10-29. Awaiting operator decisions (end of file).
Nothing beyond Phase 0 is started.

## The problem

The admin is organized around the pipeline: what is waiting (Intake, Research, Catalog, Sources,
Publish, System; 19 destinations). The operator asked for intuitive management of the footprint:
what the archive holds, where, how well evidenced, and what needs a decision. No surface answers
the first three.

Observed 2026-10-29 on the live database through the observer session:

- 4,218 canonical entities (3,224 places); 4,206 of 4,210 published entities carry lat/lng. No admin
  surface shows place, region or time.
- `published.search_index` already carries `recordMaturity`, `researchCoverage` and
  `evidenceInputs` facets per record (`packages/ops-data/scripts/lib/incremental-publish.ts:1407`).
  The admin shows none of them.
- Five overlapping queues: Submissions (2,068 quarantined), Inbox (475 in three states, 464 of them
  awaiting triage; a filtered view of Research cases), Research cases (2,430), Requests
  (owner-scoped, newest 50 only), Story review (6). Newest inbox case updated Oct 8.
- Entity detail opens on an empty "Propose a revision" form, not on the record's state.
- **Releases is theater.** "Stage activate" returns `staged: true` and persists nothing
  (`apps/web/src/app/admin/api/releases/stage/route.ts:31`). Publishing actually happens through the
  incremental publisher, which rewrites rows inside the active release in place.
- Page headers differ across surfaces although `DeskTitleBar` exists
  (`apps/web/src/admin/design-system/ui.tsx:12`) and is used on only five pages. The catalog table
  overflows at 1440px.
- Impeccable critique: 23/40 (weakest: real-world match, consistency, recognition over recall).
  Deterministic detector: clean. This is structure, IA and honesty, not styling.

## What the adversarial review changed

Sol 6.1 (Codex, read-only) returned "needs validation": 2 blockers, 7 major, 3 minor. Verified
against code before acting:

| Finding | Verdict | Change |
|---|---|---|
| "Changed since active release" has no baseline: the publisher edits the active release in place | Accepted (blocker) | Dropped. Replaced by "canonical differs from published" (a real, computable state). A historical change report needs an immutable baseline first; out of scope. |
| A unified Queue needs a membership and authorization contract (owner-scoped requests, type-specific actions, store caps of 50/200) | Accepted (blocker) | Queue is no longer a build phase. It becomes a written contract, then a decision. |
| State attribution: the fixture is overlapping bounding boxes; real polygons in production are unproven | Accepted | Footprint uses the existing `jurisdictionLabel` and search facets first, and keeps an "unassigned" bucket so totals reconcile. Point-in-polygon only after a live geometry check. |
| Phase 1 redirects retire screens before the replacement exists | Accepted | All new surfaces are additive. Nav switches last, after acceptance, with URL translation tests. |
| Reuse `DeskTitleBar` instead of a new header | Accepted | Done that way. |
| Record summary fields need provenance (linked cases are not a direct entity relation) | Accepted | The Record contract names the source and completeness of every field before build. |
| Observer QA cannot prove authorized writes work | Accepted | Gates add write-path journeys against blocked fetches plus existing unit tests; a non-production database is the real fix (see Out of scope). |
| Handoff expires but the session does not | Accepted, fixed | `--revoke` bans the agent user; verified that the console signs it out on the next request. |
| Phase 0 is an app-level fence, not a database write barrier | Accepted as stated | The guarantee is narrowed below. |
| "Footprint-first is an untested diagnosis; the bottleneck may be throughput" | **Partly rejected** | The operator named the footprint as the problem; that is their call, not a hypothesis to re-test. Accepted the sequencing point: Footprint ships as a view beside the Work home, and becomes home only if the operator prefers it after using it. |

## Revised phases

Each build phase gets a written contract from Opus first. Executors implement the contract; they
do not define it.

| Phase | Scope | Executor | Gate before starting |
|---|---|---|---|
| 0 | Observer identity, write fence, revocation (done) | Opus | none |
| 1 | Honesty and consistency: `DeskTitleBar` on every page; catalog overflow; Releases states what it actually does (see decision 2) | Sonnet | operator decision 2 |
| 2 | Record summary on entity detail: canonical vs published state, record maturity, research coverage, claim count, location, links to open work where a direct relation exists, "none found" vs "not linked" kept distinct | Sonnet | Opus contract for each field's source |
| 3 | Footprint view at `/admin/footprint`, additive: coverage by state (from `jurisdictionLabel`, with an unassigned bucket) and kind, crossed with record maturity; static map of published places on the existing US locator SVG; "canonical differs from published" count; every cell links to a Catalog filter that exists | Sonnet, Opus review | Opus contract; Catalog gets a jurisdiction filter first |
| 4 | Queue contract (document, not code): membership, identity, visibility, pagination and actions per row type | Opus | none |
| 5 | Nav switch and redirects with URL translation, saved-view matching, palette keywords | Sonnet | Phases 2 and 3 accepted by the operator |

Execution rules: each file-editing executor runs alone in its own worktree. Its one permitted git
command is the initial `git reset --hard <integrated prerequisite sha>`, which Opus names per phase.
No other git or `bd` commands. Opus reviews `git diff` against that worktree's HEAD, integrates, and
reruns the gates on the integrated tree. Gates: `pnpm -s typecheck`, the web test suite, lint, a
production build before any push, and a live check through the observer session at 1440px and
375px in both themes. Pushes stay local while the Vercel build budget is tight; the operator ends
the hold.

## Phase 0 guarantee, stated narrowly

The observer role holds no permission. The edge gate refuses it any non-GET under gated `/admin`
paths (this covers server actions posted to those pages), and the route authorizer refuses it any
non-GET under `/admin/api`. It can still refresh or end its own session through `/api/admin-auth`,
and it can use public write paths (for example `/submit`) like any visitor. It is not a database
barrier: the server's admin pool can write, so a future handler without its own permission check
is fenced only by those two choke points.

Agents start a session with `apps/web/scripts/admin-dev-session.mts` and end it with `--revoke`.

## Out of scope

- Agent auto-triage of the quarantined submissions (policy).
- Schema changes and a historical change baseline.
- A non-production Supabase branch for admin development. Recommended next; it is the only control
  that makes write-path QA safe.

## Open decisions for the operator

1. Footprint as a view beside Work (recommended) or as the new home straight away.
2. Releases: relabel it as a record-only review page, or remove the staging buttons until a real
   staging decision is persisted.
3. Go-ahead to dispatch Phases 1 and 2.

## Phase 3 contract (written 2026-10-29)

Built first, by Opus: the catalog `state` filter and its attribution (`f5f5604b`).

- **Attribution:** `apps/web/src/admin/lib/footprint-attribution.ts`. A record's state is
  `findUsStateFromJurisdictionLabel(facets.jurisdictionState)` from `@repo/domain/map/geography`.
  There is no coordinate fallback. Anything else is `unassigned`. Scope is 50 states plus D.C.
- **Rows:** `readPublishedJurisdictions()` in `published-jurisdictions.ts` returns one row per
  record in the active release, with label, kind, record maturity and lat/lng.
- **Reconciliation, checked live:** 4,210 rows land in exactly one bucket (17 unassigned).
  `/admin/catalog?state=AL` totals 219, the same as the attribution. No published record is
  missing from canonical or merged away, so links can use the catalog's default view.

The Footprint view at `/admin/footprint` (additive; the Work home is unchanged):

| Element | Source | Link |
|---|---|---|
| Published records, total | rows | none |
| Canonical records not in the active release | count of merge-active `canonical.entities` with no `search_index` row in the active release | none (no catalog filter exists for it yet) |
| Per state: records, minimum record, partial enrichment, other/unknown maturity, share at minimum record | rows grouped by attribution | `/admin/catalog?state=XX` |
| States with no published records | `FOOTPRINT_STATES` minus the states that have rows | `/admin/catalog?state=XX` |
| No state assigned | rows that resolve to `unassigned` | `/admin/catalog?state=unassigned` |
| Map | lat/lng projected with `locatorPinPercent`, binned, drawn over the `us-locator.svg` mask | none; decorative, with the table as the accessible content |

Maturity cells do not link anywhere, because the catalog has no maturity filter. The nav gains
"Footprint" as the first destination in the Catalog group.

## Phase 4: Queue contract (draft for review, 2026-10-29)

No code. This defines what one unified Queue at `/admin/queue` would contain, who sees what, how
it pages, and which actions it offers. Every number below was measured read-only against the live
database on 2026-10-29.

### What the current queues actually hold

The nav badges add up to 2,549 (Submissions 2,068, Inbox 475, Story review 6). This Queue's workload is 466
rows (453 candidates with open cases, 5 leads, 6 packets, 2 requests). Three overlaps account for the difference:

1. **Submissions are mostly research cases already.** 2,062 of the 2,067 quarantined intake items
   have a research case (`research.cases.candidate_id = intake_items.id`). Those cases are mostly
   finished: 1,015 merged, 506 excluded, 301 at minimum, partial or substantial enrichment, and
   only 240 still open. The submission's own status stays `quarantined` after its case is
   decided, so the Submissions badge counts finished work as waiting.
2. **Requests appear twice.** Each management request creates a case with id
   `managed-<work id>-v<version>-case`. The 2 open requests (both `awaiting_review` since Oct 9)
   show both on Requests and as `candidate` cases in the Inbox.
3. **Story packets are intake items.** The 7 packets are rows in `submissions.intake_items`, and
   each has a research case (all 7 are `excluded` today, so no double count yet).

### Revision after adversarial review

Sol 6.1 rejected the first draft (1 blocker, 8 major, 2 minor). Checked against code and live data
before revising:

| Finding | Verified | Change |
|---|---|---|
| Story review cannot open a given packet: it loads 200 and selection is local state | Yes (`stories/review/page.tsx:24`, `StoryReviewDesk.tsx:104`) | A packet detail route by submission id is a prerequisite (P1 below) |
| Case detail offers only triage transitions; no assign, checklist editing or promote | Yes | Destination parity is a prerequisite (P2); the Queue promises only what the page does |
| One candidate can have several open cases | Yes: 14 candidates have more than one open case, 64 have more than one case | The case work unit is the candidate (below) |
| `managed-` prefix is a convention, not a link | Accepted | Suppression requires a matching `management_work` row (below) |
| Interrupted and dispatch-failed requests would vanish | Accepted (none live today) | Included under Stuck |
| `needs_evidence` packets and failed bulk imports would vanish | Accepted (none live today) | Included |
| Age: promotion writes `from_state = to_state`; request `updated_at` is last activity | Accepted | Self-transitions excluded; requests labeled "last activity" |
| Redirects lose filters, sorts and history views | Accepted | No redirects. The Queue is an added entry point; desks stay |
| The 348 eligible cases may not all be published | Not adopted | The operator answered this from knowledge of the data; recorded as their decision |

### Membership

Four row types. A unit of work appears once.

| Type | A row when | Not a row when | Today |
|---|---|---|---|
| `case` | One row per **candidate** that has at least one case in `candidate`, `relevance_review`, `relevance_confirmed` or `insufficient_evidence`. The row names the most recently updated open case and shows "N open cases" when there are several | every open case for the candidate is suppressed (managed work, story packet) | 453 candidates (473 open cases; 14 candidates have 2 to 4 open cases each) |
| `lead` | intake item is `quarantined`, is not a story packet, and has no case with `candidate_id` = its id | it has a case (shown as that case's source) | 5 |
| `packet` | story packet with no review, a review whose decision is null or `needs_evidence`, or an approved review whose import did not complete | approved and imported, or rejected | 6 |
| `request` | owned by the viewer, and state is `awaiting_review`, `held`, `failed` or `verification_failed`, or `dispatch_status = 'failed'`, or the state is one the Requests page already treats as interrupted (`work-inbox.tsx:71`) | any other state, or another owner | 2 |

Identity is `<type>:<id>`, where a case row's id is its candidate id.

Exact predicates the build must use, one definition each, shared by membership, exclusions and
counts:

- **Story packet:** the same recognition as `extractPacket` in `postgres-story-packets.ts`,
  including the legacy `statement` with `packetJson=` form. A payload that matches the SQL filter
  but fails extraction is not a packet row; it is counted under "Unreadable packets" so it is never
  silently dropped.
- **Managed case:** a case is suppressed only when its id parses as `managed-<uuid>-v<n>-case` and a
  `research.management_work` row with that uuid exists, for any version. An unmatched case with that
  prefix is an ordinary case row. Suppression applies for every viewer, so another owner's request
  can never surface as a case.
- **Packet case:** a case whose candidate is a story packet is suppressed while the packet has its
  own row. If the packet is finished and the case is reopened, the case shows as an ordinary case.
- **Import completed:** needs a marker the bulk review path does not write today
  (`review-bulk/route.ts:52` records the review before importing). Until it exists, approved
  packets with no story linked to their submission id count as pending.

Promotion-eligible cases (348) and retracted cases (0 today) are out of scope by operator
decision; see below.

### Visibility

- `case`, `lead`, `packet`: any staff role, including `observer`.
- `request`: rows where `owner_id` equals the verified Supabase user id (`caller.uid`, the same value
  `/admin/api/work` uses), never an email and never a parameter from the URL. The owner predicate
  sits inside the request branch of the query, so it governs rows, totals, search, and every facet,
  including when a facet drops its own filter to compute its counts.
- Approving a request also needs `publication:publish` (`work-store.ts:325`); the Queue shows the
  row to its owner either way and the request page explains the missing permission.

### Ordering, age and pagination

- **Cases:** waiting since the latest history event whose `to_state` is the current state and whose
  `from_state` differs from it. With no such event, `created_at`, shown as "since import". Check the
  query plan against the `(case_id, occurred_at)` index before adding another.
- **Leads and packets:** `created_at`.
- **Requests:** `updated_at`, labeled "last activity", not "waiting since".
- Default sort: oldest first, then type, then id. One `UNION ALL` read projection with one
  `ORDER BY`, `LIMIT/OFFSET` and `count(*)`, not merged store calls. No schema change.

### Stage

| Stage | Native states |
|---|---|
| Triage | case `candidate`, case `relevance_review`, every `lead` |
| Needs evidence | case `insufficient_evidence`, packet `needs_evidence` |
| In research | case `relevance_confirmed`: the next step is enrichment by the research lane, and the console offers no action for it (`research-case-types.ts:169`) |
| Ready to decide | packet with no review, request `awaiting_review` |
| Stuck | request `held`, `failed`, `verification_failed`, dispatch failed or interrupted; packet approved but not imported |

Native state is shown on every row.

### Facets and filters

Type, stage, age band (under 7 days, 7 to 30, 30 to 90, over 90), assignee, and text search.
Assignee applies to cases only; other types read "Not assignable". Search covers title and native
id for every type, plus candidate id and reviewer id for cases and source URL for leads, matching
what each desk searches today.

### Actions

The Queue lists and routes. Decisions stay on each type's page, and the Queue promises only what
that page actually does.

Prerequisites before the Queue ships:

- **P1. Packet detail by id:** `/admin/stories/review/<submissionId>` reads one packet directly
  (`getStoryPacketPostgres` already exists) and offers the same review decision as the desk.
- **P2. Case detail parity:** add assignment to `/admin/cases/<id>` (it lives only in the queue
  sheet today). Promotion and checklist editing are not added; they are out of the Queue's scope.

| Type | Opens | Decisions there | Permission |
|---|---|---|---|
| `case` | `/admin/cases/<case id>`, and lists the other open cases when there are several | triage transitions, assign (after P2) | `research:write` |
| `lead` | `/admin/submissions/<id>` | promote, reject, spam | `research:write` |
| `packet` | `/admin/stories/review/<submissionId>` (after P1) | approve, reject, needs evidence | `research:write` |
| `request` | `/admin/work/<id>` | approve, decline, retry | owner, plus `publication:publish` to approve, plus delegation for agent clients |

Keyboard: j and k move, Enter opens, off while typing. Bulk: one type at a time through the existing
endpoints (both `research:write`, 50 items, partial failures reported per item). Bulk packet
approval must list each import failure, and failed items stay in the Queue under Stuck.

### Rollout

The Queue is added at `/admin/queue` and linked from the Work home. Inbox, Research cases,
Submissions, Story review and Requests all stay, with their filters, sorts and history views. A
desk is retired only after a route-by-route parity table shows the Queue covers what operators use
there, and only with the operator's go-ahead. The Submissions nav badge switches to the `lead`
count when the backfill (decision 1) lands.

### Acceptance checks

- The total equals the sum of the four membership counts, against fixtures and once live.
- No candidate appears in two rows, checked across types, not only by row id.
- Two owners with distinguishable request titles and ages: adding the second owner's requests
  changes no row, total, search result or facet count for the first.
- An observer sees no request rows except any they own.
- Page 1's oldest item is older than or equal to every item on later pages.
- The 14 duplicate candidates each render once with their open-case count.

### Operator decisions (2026-10-29)

1. **Submission status follows its case, including a backfill.** Going forward, deciding a case
   advances its linked submission. The roughly 1,820 submissions whose cases are already decided
   get corrected once. Both are live data writes: the mapping (which case state sets which
   submission status) and exact counts go to the operator for approval before anything runs.
   Until then, the Queue and the nav badge ignore submission status for anything that has a case.
2. **Promotion-eligible cases are published.** The 348 cases at minimum, partial or substantial
   enrichment went out through the landscape lane. They are done and stay out of the Queue.
3. **Managed cases are decided only through their request.** The operator was unsure, so this
   was settled from the code: the case is the research run's container
   (`packages/operator-cli/src/management-plan.ts:36`), and approving or publishing a request
   never reads or moves it (`apps/web/src/admin/work/publish-work.ts:146` publishes under the
   work id). Managed cases therefore stay at `candidate` forever and inflate the Inbox. The Queue
   hides them, and their case page should name the request it belongs to.

### Submission status backfill (awaiting approval)

Measured read-only on 2026-10-29. Scope: quarantined intake items that have research cases, none of
them open, excluding story packets (their status follows the packet review).

| Cases | Submission becomes | Rows |
|---|---|---|
| any case reached minimum, partial or substantial enrichment | `promoted` | 301 |
| otherwise any case merged into an existing record | `promoted` | 1,015 |
| every case excluded | `rejected` | 500 (506 less the 6 story packets) |
| any case still open | unchanged | 240 |

Total changed: 1,816 = 301 + 1,015 + 500 (1,610 leads, 206 editorial packets). No row has more than one case, none is
anonymous, and none carries a public receipt, so `/corrections/status` shows no change to anyone.

How it runs: through the same plan as a console decision (`prepareSubmissionDecisionPlan` and
`commitSubmissionDecision` in `postgres-submissions.ts`), one transaction per row, so each change
gets the usual audit event and the compare-and-set on current status. The outbox message is
written as for any decision; nothing consumes that topic today. A dry run prints the counts by
target status first, and the write needs an explicit flag. The actor is a named operator account,
not the observer.

Going forward, deciding a case advances its submission by the same mapping. That is a code change
in the case transition path, built after the backfill is approved.
