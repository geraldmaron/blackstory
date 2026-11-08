# Claim review: where it stands and what the next session does first

Written 2026-11-08. This is the plan for the next session. The first job is to write the approvals
and rejections for the 17 near-ready records to the review ledger.

## Why this exists

The publisher refuses every new record with `claim_assessment_required`, because since 2026-09-18 a
claim only counts when the review ledger holds a full chain for it (see
`REVIEWED_CLAIM_ASSESSMENTS_SQL` in `packages/ops-data/scripts/lib/confidence.ts`). Until this work,
nothing wrote that ledger, so no new record could publish. The 4,210 live records predate the gate.

## Decisions made (owner, 2026-11-08)

- The reviewer is a different model from a different provider than the one that wrote the claim.
  Producers are Claude. The reviewer is Sol through Codex (`gpt-6.1-sol`, family `openai`, actor
  `codex-review:gpt-6.1-sol`).
- No extra human approver, including for the 12 Divine Nine founders.
- Rejections are recorded in the database, not dropped.
- The capture of the 17 records' sources was approved and has run (20 fetched, 18 newly captured,
  none failed). Private text copies only, no public archiving, expiring one year out.
- The live records are grandfathered in, because the owner states they all already had a separate
  agent review. This was stated by the owner and has not been verified by an agent. Do not state the
  grandfathering on the site.
- Public wording says a reviewing agent on a different model, and where possible a different
  company's, checks each claim. It names no vendor. It is committed on this branch with the rest.

## What was built

| Piece | Path |
|---|---|
| Ledger writer and checks | `packages/ops-data/scripts/lib/claim-review-ledger.ts` (+ test) |
| Build review packets (read only) | `packages/ops-data/scripts/session-claim-review-prepare.ts` |
| Reviewer step (Codex, Sol) | `packages/ops-data/scripts/session-claim-review-codex.ts` |
| Apply verdicts (dry run by default) | `packages/ops-data/scripts/session-claim-review-apply.ts` |
| Opt-in capture of unpublished candidates | `capture-backfill --landscape-ids` in `packages/operator-cli` |

The main control is mechanical. An approval needs a quote that appears word for word in the stored
capture, or nothing is written. The strict check is deliberate: typographic normalization recovered
0 of 11 refused quotes, so those quotes genuinely differ from their sources.

## Where the data stands

First run over the 17 records (12 Divine Nine founders, 5 laws) gave 40 claims.

- Sol approved 21 and rejected 19.
- The apply dry run would accept 10, record 19 rejections, and refuse 11 whose own quotation is not in
  the source.
- No record has every claim approved, because each record's summary claim was rejected. Those are the
  500 to 800 character summaries that bundle facts a single source does not support.
- Written to the ledger on 2026-11-08 (steps 1 to 5 below are done). `research.review_decisions` gained
  27 rows for `codex-review:gpt-6.1-sol`: 10 approvals, and 17 rejections. The 19 rejected claims map
  to 17 rejection rows because two records had two rejected claims that share one artifact, so the
  handoff's earlier figure of 29 rows was a miscount. 11 claims were refused and are not in the ledger.
- Step 6 (publisher dry run) has not run: the permission classifier blocks
  `publish-release-entities-incremental.ts` as a production deploy even in dry-run mode.

Durable copies of the results are outside git, in
`~/Documents/Backpack/Agent Memory/blackstory-claim-review/` (verdicts, the 17 record ids, the
preservation decisions, the dry run log, and the backlog scoring SQL). The review packets are not
saved, because they hold third-party source text. They are rebuilt from the stored captures.

## Do this first in the next session

1. Rebuild the packets (read only). From `apps/web` load `.env.local` without printing it, then from the
   repo root run `session-claim-review-prepare.ts --entity-ids=<the ids file> --out=<dir>/packets.jsonl`.
   Expect 40 packets and 0 blocked.
2. Copy `verdicts-2026-11-08.jsonl` from the vault next to the packets.
3. Dry run `session-claim-review-apply.ts --packets-file=... --verdicts-file=...`. Expect 10 approved,
   19 rejected, 11 refused. A refusal for a stale `packetHash` means a capture changed, so stop and
   re-run the reviewer step (`session-claim-review-codex.ts`) for those packets.
4. Write it, which needs the owner's permission rule or the owner running it:
   `DRY_RUN=0 CLAIM_REVIEW_APPLY=1 CLAIM_REVIEW_REVIEWER_ACTOR_ID=codex-review:gpt-6.1-sol
   CLAIM_REVIEW_REVIEWER_MODEL_FAMILY=openai` plus the same two file flags, with `DATABASE_SSL=1`.
5. Verify with read-only SQL that `research.review_decisions` gained 29 rows (10 approve, 19 reject)
   and nothing else moved.
6. Run the publisher dry run on the 17 (`publish-release-entities-incremental.ts --ids=<ids>`, dry run
   is the default). Expect them still blocked until the summary claims are fixed.

## Split of the summary claims (2026-11-08, second pass)

The owner chose to split each summary into single-fact claims.

- `payload.summaryClaims` on a landscape row (`[{ object, citationHref }]`) replaces the one claim that
  restated the whole summary (`summaryClaimsFromPayload` in `lib/incremental-publish.ts`). A row without
  the key behaves as before.
- 181 facts across the 17 records were reviewed by Sol: 129 approved, 52 rejected. The 52 were removed
  from `summaryClaims` (copies in the vault, `pruned-summary-facts-2026-11-08.json`); their rejections
  stay in the ledger. 129 split facts remain, all approved.
- Split facts are paraphrases, so the ledger skips the "claim is a verbatim quote" check for them
  (`PreparedClaim.paraphrase`). The reviewer's own quote must still be verbatim.
- Gate result after the split (the publisher's own `assessPublicationClaims`, read only): 5 of 17 passed.
  The other 12 were each blocked by one stored evidence quote that was not verbatim in its capture.
- Quote repair (same day): 13 quotes in `payload.evidenceCitations` were replaced with verbatim spans
  from the stored capture (originals in the vault, `evidence-citations-before-repair-2026-11-08.json`).
  Sol approved all 13. Result: 17 of 17 pass the claim gate. This is the claim check only, not full
  publish eligibility (depth, template and location checks are separate).
- Three repairs changed what the quote says, because the source never stated the original wording:
  Illinois (chicagohistory.org) now quotes the 1853 prohibition, not the 1865 repeal; Oklahoma grandfather
  clause (okhistory.org) now quotes the Guinn ruling, not the 1910 and 1915 dates; New York (albany
  review) now quotes the 1846, 1860 and 1869 referenda and the 1821 convention. The Illinois repeal date,
  the Oklahoma 1910 enforcement date and the New York 1874 amendment still need a source of their own.
- The SGR founders quote on six records no longer names Mary Lou Allison Gardner Little: the capture
  has stray spaces around her link, so only the clean part of the sentence is verbatim.
- The record's public summary text is unchanged and still contains facts that were pruned from the
  claims. Whether to trim it is the owner's call.
- The publisher dry run is blocked by the permission classifier, so it has not run.

## Then

- **Do not publish the 17.** The publisher dry run reported 17 of 17 eligible, but the gate checks structured
  claims only: the summaries still carry the 52 rejected facts, every accepted claim has one source (53 on
  Wikipedia alone), and the split and repaired claims are credited to the wrong producer. A bulk apply of the
  incremental publisher would now include them, so the hold is by convention only until the gate is fixed.
  Adversarial review and the proposed redesign are in the vault (`sol-critique-round1-2026-11-08.md`,
  `sol-critique-round2-2026-11-08.md`, `opus-blind-audit-2026-11-08.jsonl`).
- Source the three facts named above that lost their quote.
- Re-running enrichment staging (`apply-enrichment-to-landscape.ts`) could overwrite the repaired
  `evidenceCitations`. Check before running it on these rows.
- Decide whether to trim summaries to the facts that survived.
- Backlog burn-down order, from the earlier analysis. Close dead weight (77 name duplicates, 140
  relationship proposals, 3 duplicate cases), which needs the owner's approval. Enrich tier A (250 rows,
  scored by how many live records already mention them). Then tiers B and C. Policy waves last: people
  (about 515) and the Green Book lane (2,556), which is held by design for a living-person review.
  Already done: 191 candidates that were already live were marked accepted.

## Not shipped yet

Everything here is committed on `redesign/ux-audit-2026-10` and unpushed. Before a staging to main
release, run `fnm exec --using=22 -- ./scripts/ci-local.sh`. Commits are unsigned because 1Password
signing fails in agent sessions. `apps/web/next-env.d.ts` is generated and must not be committed, and
a one-word edit in `apps/web/src/lib/public-data/map-projection.ts` is not part of this work.
