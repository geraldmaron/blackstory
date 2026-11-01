# Redesign execution contract

Revision: 2026-11-01. Baseline: `c65df582`. This supersedes the sequencing in
`README.md` §7; `SURFACES.md` remains the surface-specific evidence and execution log.
Completion means rendered behavior and preserved publication contracts, not a commit count.

Independent review used one Codex Luna lane with no edits or test runs. Findings were
checked against the actual adapters, route allowlists and protected register before the two
bounded implementation lanes below were assigned. The attempted Claude review did not run.

## Adversarial decisions

- **Accepted with controls: collection continuity.** Extend the existing `DiscoveryState`,
  Records query and Explore URL contracts. Do not introduce a parallel state store, saved-set
  database, generic dashboard or component framework. A collection begins as a bounded,
  reproducible query. Named editorial sets follow only with real published record membership.
- **Rejected: instrumentation as a prerequisite.** Fix continuity now. Preserve destination
  URLs and documents; collect usage evidence before proposing retirement. Token repairs are
  separately reviewable visual changes, not a prerequisite to the collection.
- **Rejected: prototype URLs as an implementation contract.** USPS geography stays canonical.
  `from` already describes map/list arrival on record pages; do not overload it with a date.
  Date bounds need an explicit disjoint spelling, inclusive-bound semantics and handling for
  unknown/uncertain dates, verified against the domain before implementation. Census decades
  and historical record date ranges are separate concepts.
- **Accepted: the query is authoritative.** Panning is a view operation and must not remove
  matches from the bibliography. Matching, drawable and currently visible counts must state
  what they measure. Unknown coordinates and retrieval failures must remain distinguishable.
- **Accepted with controls: preserve protected experiences.** Keep Memorial separate and
  materially unchanged; use existing sensitive-record cuts and reduced-motion behavior.
  These conform to P-01/P-04 without amending them. Any actual policy amendment requires an
  explicit owner decision. Use framed maps alongside reading rather than assuming permission
  for a live map behind body text.
- **Rejected: a second inventory dashboard.** Extend the existing route guards and
  `packages/testing/src/visual` Playwright setup. Use a checked-in route/state manifest plus
  a dependency-free drift check, not a second visual test runner or Storybook installation.
- **Accepted with controls: pruning.** Delete only superseded reachable code after its
  replacement passes the same tasks. Preserve document content, anchors, citations and URL
  redirects. Never delete unexplained branches or work owned by a live session.
- **Rejected: porting the prototype paint unchanged.** The existing preview on port 4199
  uses gradients, shadows and backdrop blur despite P-06's brand constraints. Treat it as a collection
  interaction sketch with fixture records, not visual acceptance or production source data.
  Opaque matte surfaces and clear layer ownership must replace that treatment.

## Dependencies and acceptance

1. **Route/state inventory.** Enumerate actual App Router page sources, normalize route
   groups correctly and record route family, access, current component, lifecycle states,
   redesign status and evidence. New/removed/duplicate/unmapped routes must fail the guard.
   Shared navigation, footer, overlays, forms, system boundaries and mobile states must be
   visible in the inventory. Existing screenshot projects remain the rendered evidence lane.
2. **Collection vertical slice.** Preserve supported query, geography, evidence, sort and
   origin through Records → Explore → record → return. Add unsupported dimensions only with
   parser, edge, matching, URL and rendered controls in the same slice. Direct entry and old
   links stay meaningful; home remains distinct from return-to-investigation. Test browser
   Back and URL reload as well as pure codecs. No silent widening of a text query.
3. **View composition.** Make map/index mode changes explicit, with the same collection and
   honest counts. Add range and chronology only after uncertain-date semantics are specified.
   A phone user must filter, find an ungeocoded match, open evidence and return without losing
   context. Keyboard access, focus order, zoom/reflow, touch and reduced motion are gates.
4. **Reading and editorial sets.** Keep published stories and references as SSR documents.
   Place sourced framed geography beside the relevant passage; never manufacture associations
   from proximity. Named-set handoffs require explicit sourced record membership, not a count
   extracted from prose. Census values cite their actual source and comparability breaks.
5. **Record templates and secondary surfaces.** Migrate one family at a time, preserving all
   evidence axes, citation strings, precision statements, fragment targets and content. Keep
   statutes on their existing addresses until their legal dataset exists. No production data
   write is authorized by this plan. Utility forms, empty/error states and relevant admin tasks
   use the existing kit where that preserves semantics.
6. **Integration and retirement.** Review each worker delta once, run scoped checks while
   iterating, then freeze the integrated revision for the existing aggregate gate and rendered
   task matrix. Reconcile local branches only after ownership and ancestry are established.
   Keep recoverable commits; no push, deployment or published-data mutation is authorized.

For every family, capture light/dark and narrow/wide evidence, plus realistic loaded, empty,
error and selected states where applicable. Auth routes retain their actual protection. A
snapshot from another revision is historical evidence, never a passing current check.

## Ownership and model budget

One integration owner; at most five worker sessions, each in an isolated checkout with a
bounded file lease. Use a small Codex model for inventory/guard work, a general Codex model
for codecs and integration defects, and subscription Claude Sonnet for editorial composition
and visual critique when authenticated. Reuse a single independent adversarial review instead
of repeatedly reviewing the whole plan. No Astra/Fable or paid API fallback.

Initial implementation leases are Codex Luna for the route/state manifest and guard, and
Codex Sol for query/sort continuity through existing Records, Explore and record adapters.
Each has its own local clone. The coordinator alone integrates and commits; workers do not
commit, push, publish, prune branches or launch other agents. A subsequent restricted Claude
Sonnet 5.5 lane completed the shared collection-navigation UI in its own clone; Codex reviewed
and validated that delta. See `local-handoff.md` for its receipt and evidence.

At this baseline, `claude agents --json --cwd <repo>` returned no discoverable sessions,
although process working directories show existing Claude processes. That does not identify
an owner or establish inactivity. The initial read-only Sonnet attempt failed before execution;
later authentication was verified through the existing Max subscription outside the sandbox.
Do not resume or take over the original processes. Until
ownership is resolved, independent work stays in isolated local clones and does not modify
the active checkout or its running preview. Existing preview: http://localhost:3048/.

## Primary pattern references

- Existing route guards: `scripts/check-web-entity-visibility-guards.mjs`.
- Existing rendered matrix: `packages/testing/src/visual/routes.ts` and
  `packages/testing/playwright.config.ts` (three widths, two themes; maps masked).
- [Next.js App Router colocation and route groups](https://nextjs.org/docs/14/app/building-your-application/routing/colocation).
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots): compare on a
  consistent host/browser; review baseline changes instead of accepting them automatically.

## Current blockers

Stored-record or schema changes require a separate final owner sign-off. Before requesting
that sign-off, prepare the exact scoped diff, adversarial findings, isolated/synthetic
validation evidence, impact and rollback plan. Broad redesign permission and read-only preview
permission do not authorize applying a migration, changing records or publishing. Source UI
edits and local fixtures remain separate from stored data.

- The owner explicitly approved read-only reuse of the existing BlackStory environment. The
  isolated full candidate runs at http://127.0.0.1:3103/ with Postgres transaction read-only
  enforced. No migrations, submissions, publishing or stored-record writes are authorized.
- Existing Claude ownership cannot be identified or messaged through the available native
  discovery interface; shared-checkout integration and branch pruning wait for ownership.
- A legal-dataset migration needs separate operator authorization; preserve statute URLs.
- No permission is implied to amend protected experiences or change production access.
