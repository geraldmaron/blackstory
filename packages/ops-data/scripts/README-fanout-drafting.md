# Drafting the NRHP backlog with a subagent fan-out

How to turn captured evidence into public prose using in-session subagents rather than the metered
provider path. Measured on 2026-08-11 over a 40-subject batch.

> This repository is public. Do not record which model drafted which content here, in commit
> messages, or in `.beads/` — that data belongs in `bb_research.entity_enrichment`, which is not
> published. The comparison below is between *paths*, not between named models.

## Why this shape

`enrich-entities-llm.ts` (the metered path) works, but on a dev Mac it fell back to the local
failover under free-tier rate limits and slowed to minutes per entity, and it quarantined 20% of
what it produced. The fan-out inverts that: subagents draft against the *same* prepared prompts,
verify their own citations before returning, and hand back answers the *same* validator accepts.

| | Metered path | Subagent fan-out |
| --- | --- | --- |
| Accepted | 8/10 | 35/35 |
| Quarantine rate | 20% | 0% |
| Metered cost | $0.0017/entity | none |

The 0% is not a quality claim — it is the pre-flight check doing its job. Drafters iterate against
a local checker until it passes, so the failures that quarantine an answer on the metered path (a
quote that is not a verbatim substring, an off-vocabulary topic id, a summary under the floor) are
fixed before the answer is ever submitted.

## The run

From the repo root, with `set -a && source apps/web/.env.local && set +a` and
`export DATABASE_SSL=1`.

1. **Pick subjects and prepare prompts.** Select pending entities that have `status='captured'`
   tier-1 evidence, then:

   ```
   node --conditions development --import tsx \
     packages/ops-data/scripts/session-enrich-prepare.ts --entity-ids=<ids> > <dir>/prompts.jsonl
   ```

2. **Write two throwaway helpers next to it** — `show.mts` (print subject N's rules, allowed topic
   ids and full evidence) and `check.mts` (pre-flight one draft). Keep these out of version
   control; `packages/ops-data/tmp/` is gitignored and resolves workspace imports, which the
   scratchpad does not.

   Have `check.mts` **call `validateEnrichmentResponse` directly** rather than restate its rules.
   An earlier version of this runbook told you to duplicate a subset of the validator and warned
   that the copy would drift — importing the real one removes the drift instead of warning about
   it, and a drafter that sees PASS locally is then guaranteed to pass `session-enrich-apply`.
   Pair it with a one-off `dump-subjects.mts` that writes the assembled subjects to a JSON file, so
   the checker runs offline and eight concurrent drafters do not each reopen Postgres.

3. **Fan out.** One subagent per ~5 lines. Give each agent LINE NUMBERS, never entity ids — the
   line number is the only binding to a subject, and it is resolved later from the prompts file, so
   an agent cannot attach its output to the wrong entity. Tell each agent:
   - what a good entry is (significance, not fabric — the same instruction the system prompt in
     `lib/entity-enrichment-llm.ts` now carries)
   - to iterate `check.mjs` until PASS
   - to REFUSE by writing `refuse-N.json` when the evidence carries no Black-history significance,
     rather than padding to clear the 120-char floor
   - not to run `git`, `bd`, `psql`, or any repo script, and to write only under its drafts dir

4. **Collect and validate.**

   ```
   node --conditions development --import tsx \
     packages/ops-data/scripts/session-enrich-collect.ts \
     --prompts=<dir>/prompts.jsonl --drafts=<dir>/drafts --out=<dir>/answers.jsonl

   node --conditions development --import tsx \
     packages/ops-data/scripts/session-enrich-apply.ts --answers-file=<dir>/answers.jsonl
   ```

   The second command is a dry run. Read the summaries it prints before applying — the validator
   checks that prose is *sourced*, never that it is *good*, and that judgement stays with a person.

5. **Apply.** Set `SESSION_ENRICH_MODEL_ID` so the internal ledger records the provenance
   accurately; it defaults to a hardcoded value that may not reflect what actually ran, and the
   ~414 pre-existing session-drafted rows carry that default whether or not it was correct.

   ```
   DRY_RUN=0 ENRICH_ENTITIES_LLM_APPLY=1 SESSION_ENRICH_MODEL_ID=<what-actually-ran> \
     node --conditions development --import tsx \
     packages/ops-data/scripts/session-enrich-apply.ts --answers-file=<dir>/answers.jsonl
   ```

6. **Stage onto the landscape row — do not skip this** (repo-63ka). Applying a draft writes only
   to `bb_research.entity_enrichment`; the publisher reads `bb_research.landscape_candidates`.
   Nothing bridges them automatically, and skipping the bridge fails *silently and misleadingly* —
   the publisher evaluates the stale row and reports `template_only: summary carries a
   generated-template signature`, which reads exactly like the drafter never ran.

   ```
   DRY_RUN=0 APPLY_ENRICHMENT_TO_LANDSCAPE_APPLY=1 \
     node --conditions development --import tsx \
     packages/ops-data/scripts/apply-enrichment-to-landscape.ts --entity-ids=<ids>
   ```

7. **Publish.** Dry-run first and read the skip counts; `template_only` should be zero for
   anything you just staged.

   ```
   DRY_RUN=0 INCREMENTAL_PUBLISH_APPLY=1 \
     node --conditions development --import tsx \
     packages/ops-data/scripts/publish-release-entities-incremental.ts \
     --lane=nrhp-black-heritage --republish
   ```

   Expect some drafted records not to publish. Two gates legitimately hold them back and neither
   is a drafting problem: `confidence_below_floor` (repo-60zx) and `name_overlap` (repo-n7p6.10).

   The lane-wide `--republish` scans the whole lane and takes several minutes; run it in the
   background rather than under a short command timeout.

8. **Verify against the live projection, not the publisher's exit code.** The publisher reporting
   *N* upserts does not tell you those rows now read as prose. Query `bb_public.release_entities`
   for the ids you just published and assert none of their summaries still contains a
   `LANE_TEMPLATE_SIGNATURES` fingerprint. Wave 3: 22 of 23 live with drafted prose, the 23rd
   correctly held by `confidence_below_floor`.

## Two things that will bite

**Agents write to the scratchpad, never the repo.** Concurrent agents sharing one git working tree
is how a previous session lost verified work (see CLAUDE.md). Drafts land outside the tree, so
there is no shared index to corrupt and no worktree isolation to set up.

**Refusals are the point, not attrition.** 5 of 40 subjects in the first batch had captured,
identity-verified evidence containing no Black-history significance at all — a purely architectural
nomination, or a Catholic cemetery nomination about Irish and German immigrant communities. Two
independent drafters refused the same subject for the same reason. Those entities currently stay
`pending` and will be re-offered on every future pass; repo-n9dq tracks giving them a terminal
state.

The rate climbs as you work down the backlog: wave 1 refused 5 of 40 (12.5%), wave 2 refused 14 of
40 (35%), wave 3 refused 17 of 40 (42.5%). Do not plan capacity off the first wave, and treat a
batch with a 0% refusal rate as a signal that the drafters are padding rather than as a good run.

**But a refusal rate is two numbers wearing one hat** (repo-pjob). Only 8 of wave 3's 17 refusals
were "evidence carries no significance". The other 9 were evidence about an *entirely different
subject* — a 240,000-character timeline of US disability rights filed under a church, an
encyclopedia entry on Frankfurt filed under Hogan Quarters, an article on Confederate monuments
filed under a university student union. Corpus-wide, 244 of 2,029 evidence-bearing entities (12%)
have no attached document that names them, and every one is still `pending` and still queued to be
offered to a drafter.

That distinction is load-bearing in two directions. It means the "thinning tail" story explains at
most half the climb — a 12% floor has nothing to do with evidence volume. And it means repo-n9dq's
terminal `no-lane-significance` status must not be applied to a refusal without checking which kind
it is first, or it will permanently close records whose real nomination was simply never fetched.

Triage with `audit-evidence-subject-match.ts` before spending a wave.
