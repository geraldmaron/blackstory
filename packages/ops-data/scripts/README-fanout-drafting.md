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

2. **Write two throwaway helpers next to it** — `show.mjs` (print subject N's rules, allowed topic
   ids and full evidence) and `check.mjs` (pre-flight a draft: summary length, citation quotes as
   verbatim substrings, topic ids in `allowedTopicIds`, era buckets grounded in a year that appears
   in the evidence). Keep these OUT of the repo. They deliberately duplicate a subset of
   `validateEnrichmentResponse`, and a committed copy would drift from the real validator. They are
   a fast local loop, never the authority.

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

## Two things that will bite

**Agents write to the scratchpad, never the repo.** Concurrent agents sharing one git working tree
is how a previous session lost verified work (see CLAUDE.md). Drafts land outside the tree, so
there is no shared index to corrupt and no worktree isolation to set up.

**Refusals are the point, not attrition.** 5 of 40 subjects in the first batch had captured,
identity-verified evidence containing no Black-history significance at all — a purely architectural
nomination, or a Catholic cemetery nomination about Irish and German immigrant communities. Two
independent drafters refused the same subject for the same reason. Those entities currently stay
`pending` and will be re-offered on every future pass; repo-y7hd tracks giving them a terminal
state.

This lane runs ~15% refusal. Budget for it, and treat a batch with a 0% refusal rate as a signal
that the drafters are padding rather than as a good run.
