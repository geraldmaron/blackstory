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

## Built and run the same day

- **Ledger on the admin login.** `claim_reviewer` marker role, live in production; no ledger write
  needs the owner password.
- **`research-batch.ts`.** One command for capture, claim review, ledger, text review, publish
  and catalog republish, reading results instead of exit codes. Its `--apply` path published one
  new record end to end (Oklahoma Senate Bill One, 1907): 11 claims approved, text approved,
  appended, catalog workflow dispatched, page checked on the Postgres-backed site.
- **Standing capture rule** (owner): a private one-year text copy for any publisher the pipeline
  recognizes; Wikipedia and unrecognized hosts get none and their claims stay blocked.
- **Stated disputes pass text review** (owner): the text must state the disagreement and
  attribute each value; a silent pick still fails.
- **Live records through the publisher** (owner): `--republish --correct --ids` changes a live
  record in place after the same review, audited as `publication.entities_corrected`. The gate
  ran on two live NRHP records and held both; the publish step of this mode has not yet written.
- **Run log.** One JSON line per run when `RESEARCH_RUN_LOG` is set, with the attempted
  denominator, approvals, rejections, holds and undecided sources.
- **`evidence.source_review_outcomes`.** Per publisher host, model reviews approved and rejected.

## What the first runs found

1. **The NRHP lane's own claims fail review.** Its templated `listing` and `significant for`
   claims cite the NPGallery asset page, whose captured text states neither. Every one of the
   2,550 NRHP records will be held on re-review until those claims cite a capture that states
   the listing (the state office's announcement did, for the record tried). This is the largest
   blocker to burning down the enrichment backlog.
2. **Reputable local news is often unrecognized.** A public radio station's report was the only
   evidence for one record and the source register returned `review`, not `accept`, so the
   record holds for an owner decision. Expect this often for recent listings.
3. **Source guidance cannot be seeded from fetch summaries.** Five of eight collections refused
   automated fetches. Three were drafted with every support quote verified verbatim against the
   live page, and the second-vendor review still returned `revise` on all three because the
   search methods and access statements went beyond the quotes. Nothing was sealed; drafts and
   the review are in the vault under `Agent Memory/blackstory-source-library/`.

## NRHP lane fix, same day

The lane's listing facts come from the NPS listed-properties spreadsheet, so its `listing` and
`significant for` claims now cite that property's row
(`national-register-listed_<date>.xlsx?refnum=<reference>`), and the capture step stores the row
as labeled text (`packages/operator-cli/src/nrhp-registry-row.ts`). All 2,581 lane rows carry
`payload.registrySourceUrl`; the scraper sets it for new rows. Enrichment staging now writes every
quoted passage as a single-fact claim, and NRHP records publish those alongside the two registry
claims, so each sentence of the summary has a claim to rest on. A fact rejected against one source
no longer counts as a rejected fact once the record cites a different source for it.

Proved on a live record (Building at 220 Sunset Avenue, NW): 8 claims and the text approved, the
record corrected in place, `publication.entities_corrected` written, page checked on the
Postgres-backed site. The dataset URL is dated, so the citation link will break when NPS replaces
the file; the captured row text is kept for a year.

## First NRHP batch, same day

Five live records were enriched from stored government evidence and run through the correction
path. Three published in place (Nugent House, Jake Gaither Golf Course, Palmer Memorial Institute
Historic District); 39 claims were approved across the four that reached review. Two were held,
both for reasons the gate should catch:

- **George Washington Carver Library.** The city's page now gives October 5, 1980 where the stored
  evidence said October 24. The reviewer rejected the claim. The record needs its evidence swept
  again before anything about that date is published.
- **Eastside Historic District.** The state press release groups two bridges under the 1950s; the
  text reviewer held the record because that chronology looks wrong for one of them and no second
  source was supplied.

The batch also exposed two defects in the capture text, both fixed: HTML entities were left
encoded (`A&amp;M`, `&nbsp;`), so a quotation copied from the page did not occur in its capture;
and review picked a document's longest stored text, which after a recapture is the stale one.
Entities are now decoded (angle brackets excepted) and review prefers the extraction the capture
origin currently records.

## Follow-up to the first batch

The runner now holds one record at a time: a blocked claim, a missing verdict, a ledger refusal,
a rejected claim or a publisher skip holds that record and the rest go on. Eastside Historic
District published after its summary dropped the bridge sentence the reviewer doubted.

George Washington Carver Library cleared claim and text review and is still held, by the
publisher. Its live record carries two claims cited to Wikipedia, one of them about George
Washington Carver the man. A correction carries live claims forward so none disappears silently,
those two have no review, and the capture rule never captures Wikipedia, so they can never get
one. Every live record with a Wikipedia-cited claim will stop at the same place: 3,145 published
claims cite a wiki or crowd host. The owner has to decide whether a correction may retire them.

## Second NRHP batch, same day

Five large-nomination records (Jackson Ward, Collier Heights, Colored Musicians Club, Farish
Street, Dorrance Brooks Square). One published (Dorrance Brooks Square, 7 claims); four held.
George Washington Carver Library also published earlier through the new rule that a correction may
retire Wikipedia-cited live claims when it adds reviewed claims from another source, with the
dropped claims listed in the audit event.

What the batch found:

- **Capture text is cut at 100,000 characters** (`pdf-parser.ts`, safe-fetch). A drafter reads a
  relevance-selected excerpt of the whole nomination, so a quote can come from past the cut and the
  reviewer, who sees only the capture, says the text does not state it. Collier Heights and Jackson
  Ward held for this. The fix is a design choice (a larger cap per nomination, or capturing the same
  excerpt the drafter read), not a patch.
- **Scanned nominations of 20 to 30 MB exceeded the 2 MB fetch cap.** NPS asset URLs now get a
  64 MB, 90-second limit (`NOMINATION_PDF_LIMITS`); other hosts keep the default. One PDF (Farish
  Street) still fails to capture.
- **A live claim and a rebuilt claim differing by a closing period counted as two facts**, so the
  live one was carried forward unreviewed and the publisher held a record that had cleared review.
  Identity now ignores trailing punctuation.
- The Colored Musicians Club ledger refused a verdict because one quotation did not occur verbatim
  in its capture (curly quotes or the cut above).

### Follow-up the same day

Collier Heights published after three more fixes: NPS nomination PDFs now keep up to 400,000
characters of text (`nominationParser`), the passage index is written in batches of 50 (one
340,000-character document in a single statement dropped the pooled database connection), and a
rejection recorded against a truncated capture stops counting once a claim for that fact is
approved against the current text. Two records still hold: Jackson Ward and Colored Musicians
Club fail in the storage upload of the extracted text (`fetch failed`, other side closed; not size
related, cause not found), and Farish Street's PDF exceeds the 64 MB fetch limit.

The upload failure was a large first upload whose response the connection dropped while the object
landed; the retry then found the object stored. The storage client now retries once (the path is
the content hash, so a retry is safe). Jackson Ward and Colored Musicians Club then cleared claim
and text review and are held by the publisher alone: each live record carries an older claim from
the same nomination (one an OCR-garbled quote, one the 1917 claim Sol rejected as conflating the
union and the club). Replacing live claims that cite a document the correction just re-reviewed
needs an owner decision.

## What is still to build, in order

1. **Burn down NRHP enrichment** with the correction path, in small batches, and re-pin the
   dataset URL when NPS publishes a new file.
2. **Purge the Cloudflare zone after corrections**; no token for it exists on this machine.
3. **Decide the unrecognized-publisher queue**: who registers a host the register returns as
   `review`, and how often.
4. **Seed source guidance by hand-opened pages**, one collection at a time, with statements
   limited to what was quoted.
5. **Edge cleanup.** Re-research or withdraw the 601 generic edges; fix direction in dedup.
6. **Schedule.** The prep task is manual. Turn on a nightly run only after one unattended run
   finishes without a permission stall, and replace the "no research schedule" line in
   `docs/architecture.md` when that happens.
7. **Per-record stops in the runner** once batches are large; today one refusal stops the batch.
