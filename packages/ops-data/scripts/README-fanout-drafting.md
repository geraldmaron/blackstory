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
   - the full draft shape, **including `keywords`** — it is a required string array, and a brief
     that omits it costs every drafter a round-trip on `keywords is not an array`
   - to iterate `check.mjs` until PASS
   - to weigh the evidence tiers: the tier-1 nomination is authoritative and a tier-2 block is
     often a short encyclopedia stub. **If all the Black-history content lives in one sentence of
     a tier-2 stub and the tier-1 nomination has none, that is a refusal.** See "The tier-2 stub
     trap" below — this is the rule that catches otherwise-valid entries about the wrong subject.
   - to choose between THREE outcomes, not two (see below)
   - not to run `git`, `bd`, `psql`, or any repo script, and to write only under its drafts dir

   **Three outcomes, and the difference between the last two matters.**

   | outcome | file | what it records |
   | --- | --- | --- |
   | draft | `draft-N.json` | an entry |
   | refuse | `refuse-N.json` | terminal `no-lane-significance`; never re-offered |
   | defer | *(write nothing)* | row stays `pending`; will be re-offered |

   Refuse means *this subject does not belong on the site* — a white institution, an architecture-
   only nomination, a district that turns out to be someone else's history. Defer means *it may
   well belong, but the captured text cannot support an entry* — most often because the read
   window truncated before the Section 8 narrative (repo-z57b), leaving only an "Areas of
   Significance" line or a theme label.

   Conflating them is expensive in both directions: refusing a truncation case permanently drops a
   real subject, and drafting one produces a sentence about the nomination form. Wave 5 hit this
   exactly — a first pass at Redd Road Rural HD returned *"Black heritage is one of the historic
   themes the National Register nomination recognizes across this rural Kentucky district…"*,
   which **passed the validator** because every clause was citable. Only a human read caught it.

   Mechanically, a deferred subject writes no file, so `session-enrich-collect.ts` reports it under
   `NO OUTPUT AT ALL — a drafter likely died`. That is the right behaviour reached by the wrong
   path; read that line as "deferred or died" until collect learns about an explicit
   `defer-N.json`.

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

## The evidence you are handed is an excerpt, and it says so

Since repo-z57b the read window is **relevance-aware, not positional**. It is no longer the first
12,000 characters of the nomination. For any source too long to hand over whole, a drafter gets the
document's own opening statement plus the passages that actually discuss Black history, chosen from
the whole document, in document order, with `[…]` marking each gap
(`scripts/lib/evidence-excerpt.ts`).

Two consequences at the drafting desk:

- **Never quote across a `[…]`.** Each side is verbatim from the source; the join is not. The
  validator only checks that a quote is a substring of what you were handed, so it would *accept* a
  quote that spans the marker and reads as one sentence in the source when it is two, thousands of
  characters apart.
- **Read the `readNote`.** It states how much was omitted and whether the document mentions Black
  history *anywhere* — the excerpter scanned all of it, so this is knowledge you do not otherwise
  have. `Nothing anywhere in the full document mentions Black history` is an **absence**, which is a
  refusal. Anything else is a truncation question, which is a defer.

Why this replaced the head slice: Redd Road Rural HD's narrative began at 12,183 characters and the
old window stopped at 12,000. It missed by 183 characters and cost a whole drafting attempt, which
came back with a sentence about the nomination form. Big Sink Rural HD's best passages sit at 27%
and 55% of a 290,000-character document — no affordable cap reaches those by reading from the front.

## The tier-2 stub trap

The validator checks that prose is *sourced*. It cannot check that the prose is about *our*
subject, and that gap has a specific, repeatable shape.

Cato Hill Historic District is the clean example. Its tier-1 nomination documents an Irish, then
French-Canadian, then Central European mill neighbourhood in Woonsocket and contains no Black
content whatsoever. Its entire Black connection is one sentence in a Wikipedia-derived tier-2 stub:
the hill is named for Cato Aldrich, an African American who bought the land from the family that
founded the town. A drafter turned that into a valid entry — the naming fact is genuinely citable —
but it only cleared the 120-character floor by appending *"and it grew into a dense working-class
enclave"*, and its context paragraph was entirely about Irish and French-Canadian immigrants.

Every clause was true and every quote verbatim, and the entry was still wrong. This is the same
family as the "thin" mis-attachment class in repo-pjob: correct citations, wrong subject. Give
drafters the tier rule up front and they catch it themselves — once it was added, drafters flagged
West Capitol Street HD (a white downtown Jackson commercial strip whose tier-2 block is a
mis-attached stub about the Mississippi Governor's Mansion) and Portland Proper (an archaeological
site whose only Black reference is "slavery and ethnicity" listed among research problems the site
could *potentially* address) without further prompting.

District and archaeological nominations are where this concentrates.

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

Triage with `audit-evidence-subject-match.ts` before spending a wave. As of 2026-08-11 that has
been done once for this lane: 231 tier2 documents quarantined, 227 entities moved out of the
drafting pool and into re-sweep. **Do not re-sweep them before repo-u84y is fixed** — the identity
gate accepts 231 of the 249 documents in question, so a sweep today re-attaches the same class.

The one thing to keep in mind when you read a refusal: *thin* evidence is more dangerous than
*unrelated* evidence, which is the opposite of the intuition. An unrelated document gives a drafter
nothing and it refuses. A city article attached to one of its own historic districts gives it
paragraphs of real, quotable Black history about a **different** district — and every quote is a
genuine verbatim substring, so the validator passes it. That is how a sourced-looking entry ends up
attributing Vinegar Hill's destruction to West Main Street. Refusing is the drafter's job; the
harness cannot catch this one.
