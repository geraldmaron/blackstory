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
