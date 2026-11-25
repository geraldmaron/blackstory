# Research harness audit, 2026-11-25

Dated audit record. Counts are from the production database on 2026-11-25. The proposal was
attacked by a second vendor's model (Sol through Codex, read-only on the repository); its
objections are folded in and marked. It did not verify the production counts.

## Verdict

The harness has the right parts and no working loop. It can gate a claim well. It cannot yet run
unattended, it does not learn from its runs, and most of its relationship data is not evidence.
The repository describes three pipelines and production uses one of them.

## What was measured

| Area | State |
| --- | --- |
| Published records | 4,403. No image on 2,759, no related record on 3,872, no historical context on 1,417. 2,125 cite one publisher or none |
| Citations | 12,544 published claims. 3,145 (25%) cite a wiki or crowd host, against a policy that calls Wikipedia discovery-only |
| Source library | 811 publishers, 71 with a written profile, 52 reviewed. 10 collections have search guidance |
| Relationships | 1,094 canonical edges. 601 are `related_to`. 2 rows of relationship evidence. 864 of the 1,766 public related links are `related_to` |
| Review gate | 141 model review decisions ever (104 approve, 37 reject) and 187 exact-match script approvals. About 4,200 records predate the gate |
| Backlog | 1,433 gap-fill candidates, 270 network-expansion, 139 relationship proposals, 531 NRHP records awaiting enrichment, 660 candidate cases, 2,379 Green Book rows on hold |
| Unused tables | aliases, entity candidates, resolution decisions, evidence lineage, hypotheses, story packets, graylist, discovery campaign runs: all empty |
| Scheduling | None. `docs/architecture.md` says no research schedule should be installed |

## Findings, most serious first

1. **Unattended publishing is not possible today, by construction.** The ledger writers assume
   `service_role`, reached only through `scripts/with-owner-db.sh`, which reads the owner password
   from 1Password. Agents are barred from reading secrets and the permission classifier blocks the
   publisher even in dry run. Until a narrower credential exists, a scheduled run can prepare and
   review but not publish. `research.approve_artifact` itself also accepts admin, publication and
   security roles, so the narrowing is in the scripts' login choice, not the database (Codex).

2. **Enriching a live record has no gated path.** The incremental publisher refuses any change to
   an entry of a signed release. The largest backlog (images, context, better citations on 4,403
   live records) can only ship as hand-written in-place corrections. New records have a pipeline;
   improvements to old ones do not (Codex found this; confirmed at
   `publish-release-entities-incremental.ts:897`).

3. **The review step rewards deleting disagreement.** The public-text reviewer returns
   `request_changes` whenever sources conflict, and the handoff records that a record passes once
   the conflicting source is no longer cited. An unattended run optimizing for passes would erase
   legitimate disputes, against the brand's own rule that disputes stay visible (Codex).

4. **Relationship data is mostly heuristic.** `promote-relationship-candidates.ts` wrote
   accepted, published edges scored on co-participation, shared decades and proximity, with no
   evidence row. The relate skill forbids exactly that. Its deduplication also treats A to B and
   B to A as the same edge, which breaks directed predicates. Dependency chains need typed,
   directed edges that a record states; 55% of current edges are neither. The edge vocabulary in
   use (`related_to`, `cites`, `part_of`, `employed_by`) is not the profile's vocabulary.

5. **The source library does not learn.** It records who is cited. It does not record which
   collection answered which kind of need, which searches dead-ended, or which sources had claims
   rejected. Rejections are attributable to a publisher today; approvals are not without a
   claim-version join, and a raw approval rate would confuse source quality with drafting
   mistakes (Codex).

6. **A wrapper cannot trust exit codes.** The Codex reviewer logs missing verdicts and exits 0;
   the ledger apply prints refusals and exits 0. Any one-command runner must compare verdicts to
   packets and read the report.

7. **Three pipelines, one in use.** The management-work protocol has two rows; discovery
   campaigns and the graylist have none. Every live record took the landscape lane. Neither is a
   complete spine: the landscape path has no crash recovery between its database commit and the
   artifact republish, and the durable protocol does not cover relationships, stories or most
   entity kinds.

8. **A quarter of citations rest on Wikipedia.** The fix is re-reviewing the assertion against
   the underlying work, not swapping the URL.

9. **Nothing measures whether runs get easier.** No baseline, no denominator, no sampling of
   accepted output. Published counts can rise while research gets shallower.

10. **The gate has no false-approval check.** Reviewer agreement is the only signal, by owner
    decision. A periodic blind re-review of a sample of approved claims is the cheapest control.

11. **Withdrawal does not propagate.** A retracted record has no defined path through web,
    mobile artifacts, graph, and any social post that quoted it.

12. **Selection bias.** Backlog burn picks what is easy to source online, which favors
    institutions with websites over the obscure records the project exists for.

## Decisions taken in this session

| Item | Verdict | Done |
| --- | --- | --- |
| One orchestrating skill | Rejected as a new skill; the entry skill already owns it | "Runs" section added to `research-framework`: operation table, five-question intake, defaults, reviewer rule, unattended rule, report |
| Heuristic edge promotion | Rejected | The promoter's apply now throws; dry run still reports |
| Brand and social copy | Accepted, real gap | `blackstory-brand-content` skill; drafts only |
| A challenge skill | Rejected | `ringer-review` plus the executable Codex steps already cover it |
| A source-library skill | Rejected | Upkeep rules already live in `source-registry.md` |
| Pre-seeding 40 collections | Needs validation | Not done. Seed from demand: guidance for the collections the backlog's kinds need, each written from opened pages and reviewed |
| Four schedules | Rejected for now | One manual pilot task, `blackstory-research-prep`, that writes no database rows |
| Auto-sealing guidance from run results | Rejected | Runs record collection, query, coverage and outcome; a person or reviewed finding promotes it |

## What is still to build, in order

1. **Write authority for unattended runs.** Designed and challenged the same day. A login
   narrowed by table grants was rejected: the publisher upserts with `ON CONFLICT DO UPDATE`,
   taxonomy sync updates published rows and the graph rebuild deletes them, so "insert-only"
   cannot run it, and a separate credential isolates nothing while the admin URL sits in a file
   the same account reads. What survives: a capability role the existing admin login can assume
   for the ledger transaction, accepted by `research.submit_artifact` and
   `research.approve_artifact`, so routine ledger writes stop using the owner password; and
   confinement at the session, where the scheduled task may run one runner command and has no
   database connector. Both function gates must be tested under the real role, approval and
   rejection, before any unattended write.
2. **A gated path for changes to live records**, with the same review as new ones.
3. **Let a stated disagreement pass review**, or route it to a hold that keeps both citations.
4. **One runner for the ordered steps** that asserts complete results at each step.
5. **Run records with denominators**, then the library view built on them.
6. **Edge cleanup.** Re-research or withdraw the 601 generic edges; fix direction in dedup.
7. **Turn the pilot into a schedule** after one interrupted-and-resumed run proves recovery, and
   replace the "no research schedule" line in `docs/architecture.md` when that happens.
