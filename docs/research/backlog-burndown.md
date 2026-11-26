# Unpublished backlog burn-down

Status: proposed 2026-11-25; one-row proof published the same day. Revised after an adversarial review by Codex (Sol), which
rejected the first draft. Counts are from `research.landscape_candidates`, `research.entity_evidence`,
`research.entity_enrichment` and `reference.stories` read on that date.

## Recommendation

Run the backlog as an evidence-first funnel on the tooling that already exists, cheapest step first,
and count success as **records live after the publish gate**, not rows closed.

1. Kill or route rows with scripts and cheap triage before anything touches the web.
2. Collect evidence with the deterministic sweep (`sweep-entity-evidence.ts`, no model cost).
3. Draft only rows that have captured evidence, with Claude subagents on the subscription.
4. Send rows the sweep could not source to Sonnet web research, which feeds URLs back to the sweep
   as leads rather than drafting from them directly.
5. Review and publish with `research-batch.ts`, which runs capture, Sol claim review, both ledgers, the
   publisher and the catalog republish as one command.

Before scaling anything, prove one cold row end to end (Codex's reopen condition, and the right one).

## What the backlog actually is

4,406 rows are `pending`. Only 17 have captured evidence, only 4 have a 400 to 900 character summary,
and none carries `summaryClaims`. This is a research backlog, not a publish queue.

| Lane | Pending | What the rows are | Route |
|---|---|---|---|
| greenbook | 2,379 | NYPL listings. The six-state slice is done; the rest are other states (886 when counted 2026-11-08), tourist homes, taverns, beauty parlors, personal names | Owner policy call |
| other, `find-catalog-entity-gaps.ts` | 1,433 | Names mentioned inside live records ("Douglas MacArthur", "Warner Bros.", "President Johnson") | Triage hard |
| other, no generator | 357 | One-line stubs ("Black Panther Party", "Seattle Medium") | Triage, then funnel |
| relationship-inference | 139 | Scored edges between live entities | Edge review, not entity publish |
| wikidata, claims-relationship | 33 | Edges ("Audre Lorde authored Zami") | Edge review |
| nrhp-black-heritage | 32 | 15 share a name with a live record | Identity check, then funnel |
| dc-sites, divine-nine, hbcu | 31 | 13 are persons | Funnel |

Also: 513 pending persons (held by the gate until `payload.personReview` is approved), 1,931
non-Green-Book rows with no location by my query (Codex could not confirm the count), 549 `pending` and
349 `never_swept` enrichment rows, and 24 draft stories. Stories wait for the owner's word to publish and
are out of scope.

## The funnel

Every stage writes its decision to the row (status and a reason), so a stopped run resumes and a drop can
be reversed.

### Wave 0. The 17 rows that already have evidence

Skip straight to drafting and `research-batch.ts`. This is also the cheapest test of the drafting
handoff.

### Stage 1. Deterministic sweep (script, $0)

- **Exact identity only**: a row whose `id` or `source_item_id` is already live becomes `merged`. A
  name-only match (about 110 rows) is not identity; it goes to the `blackstory-entity-verify` check
  instead of being merged, because the publisher holds name collisions rather than merging them.
- Edge lanes leave the entity funnel for `blackstory-entity-relate` review.
- Persons with no sourced death date are held as living-unknown; nothing downstream spends on them.

### Stage 2. Triage (cheap models, two vendors, no web)

One question per row: should BlackStory hold its own record for this subject? Answers: `keep`,
`drop:off-mission`, `drop:not-a-thing`, `verify-identity:<live id>`.

- Claude Haiku subagents, 50 rows per agent, rows in and JSON out. Rows are a line each and need no
  fetch, so large batches are cheap.
- Codex `gpt-6-luna` triages the same batch independently.
- Both say drop: drop. Either says keep: keep.
- Two models reading the same stub can share a blind spot on an obscure subject, so audit a random 20
  drops per lane with a Sonnet agent that is allowed to search before accepting that lane's drops.

### Stage 3. Evidence sweep (script, $0)

`sweep-entity-evidence.ts --lanes=<lane> --limit=<n>` on the kept rows. It fetches through
deterministic collectors (Wikipedia, NRHP nominations and others), records rights, runs the identity
check, quarantines identity failures and reports no-evidence rows without writing filler. Dry run first;
writes need `DRY_RUN=0 EVIDENCE_SWEEP_APPLY=1`.

Location gets settled here or in Stage 5: a new record without a usable location fails the publisher, so
a row that cannot be placed is held before anyone drafts it.

### Stage 3b. Source assessment for unrecognized hosts (owner decision 2026-11-25)

`research-batch.ts` only auto-captures hosts that are tier 1, on `REPUTABLE_SECONDARY_HOST_SUFFIXES`,
or in `lib/source-register.json`. Everything else used to wait for a per-URL owner decision. The owner
chose instead to have the framework assess the source itself.

1. Collect the distinct hosts behind captured evidence that the standing rule does not cover.
2. `source-register.ts propose --hosts ...`. An `accept` is applied as today (Wikidata basis).
3. Each `review` or `reject` host goes to an **isolated assessment**: a fresh Sonnet agent that researches
   the publisher, not the record. It never sees the subject or the claim the host would unblock, so it has
   no reason to want a pass. It answers: who publishes it, ownership and editorial process, whether it is
   self-published about its own subject, independent descriptions of it (with quotes from pages it
   opened), and a proposed class.
4. Sol assesses the same host independently with the same brief. Take the lower class on disagreement.
5. Outcomes: register the host (`news_reportage` or `reputable_secondary`, with an agent-assessment basis
   recording both verdicts and their quotes) or refuse. A narrower "facts about itself only" tier for
   self-published sites is not built; those are refused for now.
6. One assessment per host, kept in the register, so the cost is per publisher, not per record. A
   registered host is then covered by the standing capture rule. `source-register.ts verify` keeps
   re-checking liveness.

Built 2026-11-25: `source-assess.ts` (brief, Sol runner, pairing), `source-register.ts
apply-assessment`, and `entryFromAssessments` in `lib/source-register.ts`. Procedure and acceptance rule:
[source-assessment.md](source-assessment.md). Wikipedia stays bridge-only.

### Stage 4. Draft rows that have evidence (Claude subagents, $0 marginal)

- `session-enrich-prepare.ts --entity-ids=...` emits prompts only for rows with captured evidence.
- Haiku drafts first, 10 rows per agent: the evidence is already in the prompt and the deterministic
  validators in `session-enrich-apply.ts` reject bad output. A row Haiku fails twice goes to Sonnet.
- `session-enrich-apply.ts` then `apply-enrichment-to-landscape.ts`, which builds single-fact
  `summaryClaims` with `citationHref` (the shape of the 13 records published after 2026-11-18, about 9
  claims each). The 2026-11-08 review rejected every whole-summary claim, so one fact per claim is
  required, not stylistic.

### Stage 5. Research rows the sweep could not source (Claude Sonnet, web)

- 6 to 8 rows per agent, **clustered by topic and place** (all Negro Leagues names together, all
  Atlanta organizations together) so one agent reuses pages it already opened. Fetching is the main cost;
  clustering is the main saving.
- The agent returns candidate source URLs with an identity note (why this page is this subject) and a
  location with its source. It does not draft prose.
- Those URLs go back into `sweep-entity-evidence.ts` as search-supplied leads, which pass the same
  acquisition and identity gates, and the row re-enters Stage 4.
- Fewer than two independent sources, or an unresolved identity: hold as thin evidence and move on.
- Choose sources for fitness and independent lineage. The old 0.75 host-score floor is gone; the gate
  now needs an exact, independently reviewed assessment per claim (`confidence.ts`).
- Haiku is not used here. The Green Book pilot (5 weak hits in 24) failed on finding sources, and a
  cheaper model makes that worse.

### Stage 6. Review and publish (`research-batch.ts`)

```bash
DATABASE_URL="$ADMIN_DATABASE_URL" node --conditions development --import tsx \
  packages/ops-data/scripts/research-batch.ts --ids=<ids> --work-dir=<outside repo> \
  --drafter-actor=<actor> --drafter-family=anthropic --max=10
```

Dry run first, then `--apply`. It captures under the owner's standing capture rule (2026-11-25), sends
claims to Sol (`gpt-6.1-sol`, batch of 3), writes both ledgers, runs the publisher and republishes the
catalog. It holds a record alone on a rejected or blocked claim and stops on a missing verdict.

The capture-time quote check only proves the words exist on the page. It does not catch a namesake, a
wrong date or a reversed attribution, so the Sol brief must ask whether the quote is about this subject
and directly supports the claim, and the pilot plants two misleading-but-verbatim claims to see whether
review catches them.

Group `--ids` by wave of up to about 150 so the catalog republish runs a few times, not once per 10.
After each wave, refresh the live-name snapshot so triage does not redraft what just went live.

## Model routing

| Stage | Model | Why this one |
|---|---|---|
| 1, 3, 6 mechanics | Scripts | No model cost, no variance |
| 2 triage | Haiku + `gpt-6-luna` | One-line rows, no fetch; two vendors |
| 4 drafting | Haiku, Sonnet on retry | Evidence is in the prompt and validators catch bad output |
| 5 web research | Sonnet | Lowest tier that holds up on source finding |
| 6 review | `gpt-6.1-sol` (Codex) | Different vendor from the drafter, which the gate requires |
| Escalation | Opus | Only for identity disputes the sweep and Sonnet cannot settle |

Claude work runs as in-session subagents on the subscription. Nothing routes through OpenRouter or any
metered API. Codex work runs through `codex exec` on the ChatGPT login with stdin closed.

## Pilot, fixed before it runs

1. One cold row from `other` through every stage to a live page. Nothing scales until this works.
2. Then a stratified sample: 30 from `other` (15 mention-mined, 15 stubs, mixed kinds), the 17 dc-sites,
   the 13 divine-nine, and the 17 evidence-ready rows as a separate cohort so easy rows cannot inflate
   the result.
3. Measure per cohort: triage drop rate and audited false drops, sweep hit rate, research hold rate, Sol
   approval rate, records live, and subagent runs, Codex calls and operator minutes per live record.
4. Proposed stop rule, to be confirmed by the owner before the pilot starts: a cohort with fewer than 1 in
   4 kept rows reaching a live page stops and gets reported. This is a judgment call, not a derived
   number.
5. Scale only cohorts that pass, at no more than 4 concurrent research subagents. Subscription rate
   limits and the orchestrator's review of each batch are the real ceiling.

**Stop rule confirmed by the owner, 2026-11-25:** fewer than 1 in 4 kept rows live stops the cohort.

**Owner decision, 2026-11-25:** contemporary institutions (for example The Black Wall Street Times,
founded 2017) stay live. A record is not held for being recent.

### Sample, fixed 2026-11-25 before any stage ran

Drawn from `pending` rows, ordered by `md5(id || 'burndown-pilot-2026-11-25')`. Cohort 1 takes the first
row per kind, then the second per kind, and so on, excluding persons and rows with evidence.

1. **other, mention-mined (15):** `gap_aclu`, `gap_first_and_fourteenth_amendments`,
   `gap_mississippi_house_of_representatives`, `gap_emory_university`, `gap_chicago_landmark`,
   `gap_double_v_campaign`, `gap_summit_agreement_on_open_housing_reached_august_26_1966`, `gap_kongo`,
   `gap_davis_v_county_school_board`, `gap_new_york_national_guard_s_369th_infantry_regiment`,
   `gap_massachusetts_attorney_general`, `gap_second_party_system`,
   `gap_louisiana_s_legislative_act_87_of_1880`, `gap_flying_africans`, `gap_harvard`.
   **other, stubs (15):** `disc_odd_fellows_cemetery_q7077343`, `disc_exodusters_q5420574`,
   `disc_samuel_anderson_q123592059`, `disc_black_panther_militia_q106726791`,
   `disc_john_warren_davis_q90649402`, `sundown_humboldt_county_california`,
   `disc_william_brinkley_q107265790`, `disc_new_york_african_society_for_mutual_relief_q104844761`,
   `disc_harlem_renaissance_q829895`, `disc_william_tebeau_q22806753`, `disc_gordon_q16200625`,
   `disc_black_ankle_q4920275`, `disc_the_black_wall_street_times_q122945494`,
   `disc_black_abstractionism_q130251315`, `disc_segregation_academy_q7446325`.
2. **dc-sites (17):** `dc-black-history-sites-` + `c14`, `i10`, `i106`, `i49`, `i58`, `i81`, `i87`, `i88`,
   `i93`, `l2`, `l4`, `p32`, `p85`, `p90`, `s11`, `s22`, `s24`.
3. **divine-nine (13):** `divine-nine-person-iota-` + `albert-hicks`, `barron-willis`, `charles-briscoe`,
   `charles-brown`, `charles-gregory`, `elias-dorsey-jr`, `frank-coakley`, `john-slade`,
   `lewis-hudnell`, `lonnie-spruill-jr`, `michael-williams`, `webster-lewis`; and
   `divine-nine-person-zpb-fannie-pettie-watts` (already holds the owner's 2026-07-28 person review and
   one captured source; counted here, not in cohort 4).
4. **evidence-ready (16):** `us-ed-hbcu-140146`, `gap_meharry`, `gap_supreme_court`,
   `gap_tulsa_race_massacre`, and the persons `disc_a_j_smitherman_q112749131`,
   `disc_alfred_niger_q111214355`, `disc_arthur_l_hardge_q124343795`,
   `disc_barbara_gomes_beach_q132201345`, `disc_black_hawk_q714534`,
   `disc_elise_johnson_mcdougald_q19974907`, `disc_eliza_ann_gardner_q22018527`,
   `disc_james_l_farmer_jr_q3806642`, `disc_john_robinson_q16073477`,
   `disc_oscar_james_cooper_q110409084`, `disc_richard_h_harris_q108215593`,
   `disc_ruth_denny_q111317467`.

Person rule for the pilot: the owner's 2026-11-10 decision lets a session record approvals, so a person
whose death is sourced gets `payload.personReview` from the session with that source as its basis. A
person with no sourced death date is held as living-unknown, not published.

## Owner decisions this cannot make

- Whether to widen Green Book beyond the six states. The other-state rows could go through the existing
  `greenbook-listings.sh` exact-match review at no model cost; it is policy, not research.
- Tourist homes, personal-name listings and pending persons: the living-person hold.
- The stop rule above.
- Ledger writes need the admin login (`docs/research/agent-local-env.md`). Whether an agent session can
  run `research-batch.ts --apply` today is unverified; it was blocked on 2026-11-08 and has worked since.

## One-row proof (2026-11-25): Seattle Medium, `disc_seattle_medium_q7442135`

What the proof found, in pipeline order:

1. **Sweep.** The Wikipedia collector captured the article; the search-supplied LOC and Seattle Times
   leads failed the identity gate (a Seattle Times feature on the paper scored "mentions the subject but
   is not about it"). One Sonnet research agent found pages on the paper's own site, BuyBlack.org and
   BlackPast's biography of the founder; the sweep captured all of them through its own fetcher, including
   BlackPast, which had returned 403 to the agent's fetcher.
2. **Wikipedia is bridge-only.** `tier1-sources.ts` treats it as never corroborating, and the standing
   capture rule excludes it, so a record cannot rest on it. Of four captured sources, only BlackPast was
   usable without an owner decision; Stage 3b exists because of this.
3. **The session drafting prompt omits the output schema.** `session-enrich-prepare.ts` emits the system
   and user prompts but not `ENTITY_ENRICHMENT_RESPONSE_SCHEMA`, which the API path sends as a response
   format. Haiku's first draft failed on a missing `keywords` field. With the schema handed over, Haiku's
   BlackPast-only draft passed the validators first time (819-character summary, 12 claims). Fix: have
   prepare emit the schema.
4. **No script stages a location.** The row had none and the publisher refuses new records without one.
   It was set by hand at city precision (Seattle centroid, `payload.geocode` naming its source).
5. **`research-batch.ts` cannot dry-run a new record.** Capture runs only with `--apply`, so the dry run
   blocks every claim as `no_retained_capture_text`. Either capture in the dry run or document that a
   first run must use `--apply`.
6. **Review caught a real problem.** Sol approved all 13 claims, then held the public text: the only source
   is a 2009 profile, and the summary said the son "runs the paper now". The summary was rewritten in past
   tense, attributed to the 2009 profile, through `stage-landscape-evidence.ts` prose corrections, and
   passed on the second run. The drafting brief should say this up front: facts about current roles from
   a dated source are written in past tense with the date.
7. **The re-run reviewed all 13 approved claims again.** Their text had not changed, so that was a wasted
   Sol pass. Skipping claims that already have a ledger approval for the same text would halve review cost
   on every correction loop.
8. **Era buckets drifted.** The record shows "1970s to 1980s"; the 1980s comes from the founder's 1987
   protest, not the paper. Era should come from the subject's own dated facts.

**Result: live.** Published to the active release at 2026-11-26 02:04 UTC (city precision, 13 claims,
"Thinly evidenced, 1 source"), in search, rendered on the local Postgres-backed server, and the catalog
artifacts were republished by the GitHub workflow (`uploaded` for both files). Catalog is now 4,405 live
records.

**Cost of one cold record:** one Sonnet research agent (about 102k tokens), two Haiku drafting agents
(about 126k and 116k; the first wasted on the missing schema), two Sol claim-review passes and two text
reviews, and roughly 15 minutes of orchestrator time. Most of that is setup that batching amortizes:
research and drafting cost per agent, not per record, so 6 to 10 rows per agent should cut the per-record
agent cost several times over. That is an estimate until the pilot measures it.

### Fixes made after the proof (2026-11-25)

| Fix | Where | Status |
|---|---|---|
| Emit the response schema with each prompt | `session-enrich-prepare.ts` now writes `responseSchema` on every line | Done |
| Stage a sourced location | `stage-landscape-evidence.ts` accepts `location`; refuses a row that already has a point or an uncontrolled precision | Done, tested |
| Dry run on a new record | `research-batch.ts` now says capture needs `--apply` instead of failing silently; capture still writes, so a dry run cannot do it | Done |
| Skip claims already approved for the same text | `research-batch.ts` reuses verdicts from `verdict-cache.jsonl` in the work dir by `packetHash` and reviewer | Done; dry run on the proof row reused 13 of 13 |
| Dated-source tense rule and subject-only eras | enrichment system prompt and user-prompt rules | Done |
| Source assessment for unrecognized hosts | Stage 3b | Done, tested |

First real run of Stage 3b, on the two hosts from the proof with no basis:

- **buyblack.org: refused** by both. Sol found it is a commercial directory whose own annual report says
  its content is "90% automated".
- **seattlemedium.com: registered as `news_reportage`.** Sol cited the Local Media Association, BBB and
  Muck Rack. The first Claude assessment cited only Wikipedia as independent evidence, which exposed a
  hole: the rule accepted Wikipedia as an outside assessment. It no longer does (test added), the brief
  says so, and a fresh Claude assessor re-ran and cited a Washington State OMWBE bulletin. That agent
  called its own case borderline with one independent page; the rule's floor is one per assessor, and
  the lowest class applies.

## Operating rules for sessions and context

Owner expectation (2026-11-25): the harness cycles subagent sessions and keeps context and its
indicators in check.

- **One fresh subagent per batch, never resumed.** A triage, research, drafting or assessment agent
  gets one bounded batch (50 triage rows, 6 to 10 research or drafting rows, a handful of hosts),
  returns a file, and ends. Follow-ups start a new agent with the file, not the old transcript.
- **Files carry state, not context.** Every stage writes its output to the work dir (JSONL answers,
  verdicts, the run log) and its decision to the row. The orchestrator reads counts and refusals,
  not transcripts, so its own context grows per batch by a few lines.
- **Indicators per batch**, from `RESEARCH_RUN_LOG` and the stage reports: rows in, rows dropped or
  held and why, validator quarantine rate, Sol approve/reject counts, verdicts reused, records live,
  and agent tokens per live record. A batch whose quarantine or rejection rate jumps stops the wave
  for a look before the next one starts.
- **Orchestrator sessions are cycled too.** One wave per orchestrator session; at the end of a wave
  it writes the wave summary to this doc's run table and the next wave starts in a fresh session.
  A long session (this one included) should hand off rather than keep accumulating.
- **Concurrency stays low**: at most 4 research or assessment agents at once, so rate limits and the
  orchestrator's review of each batch keep up.

## Adversarial review record

Codex (Sol, read-only, 2026-11-25) rejected the first draft. Points accepted and folded in:

- The first draft started drafting with `session-enrich-prepare.ts`, which skips any row without
  captured evidence: 4,389 of 4,406 rows. Fixed by the evidence sweep in Stage 3 and leads in Stage 5.
- Name overlap is not identity: name-only matches now go to identity review, not merge.
- Location is a hard stop at the publisher: now settled before drafting.
- A verbatim quote can still support the wrong claim: now in the review brief and the pilot.
- The 0.75 floor no longer exists: removed.
- The pilot could reward easy rows: now stratified, with the stop rule fixed in advance.

My own challenges, and what survived:

- **A burn-down target rewards publishing junk.** Mention-mined rows include obvious non-subjects. The
  metric is live records that pass the gate; a drop is a valid outcome. Accepted with controls.
- **Claude drafting and Sol reviewing from the same pages are not independent.** True; agreement is
  not accuracy, and the owner's own decision says no accuracy number can be claimed. The controls are
  the identity check in the sweep and the support question in review. Accepted with controls.
- **Cheap triage silently drops good subjects.** Two-vendor agreement to drop plus an audit with search.
  Needs validation in the pilot.
- **Metered batch APIs would be cheaper per token for triage.** Rejected: the owner's standing rule is
  subscription work only.

Verdict: accepted with controls for the one-row path (proven 2026-11-25); needs validation at batch scale until the pilot runs, after the fixes listed under the proof.

## Throughput changes after the pilot's first pass (2026-11-25)

The pilot took about two hours to put 7 records live. Most of the wait was Codex running one call
after another, correction loops after Sol's text review, and waves of 10.

- **Codex runs in parallel.** Claim review, text review and source assessment now run
  `--concurrency` calls at once (default 4) through `lib/codex-exec.ts` and the existing
  `operator-cli/src/map-pool.ts`. Output keeps input order.
- **Check before review.** `research-batch.ts` runs `lib/pre-review-text-check.ts` before capture.
  Measured against all live records, only a lowercase display name was reliable enough to hold a
  record (3 of 4,412 live records hit it, all genuine). A month with no year, an em dash and
  present-tense time words flagged hundreds of correct live records, so those only print warnings.
  The month rule also went into the drafting prompt, which is where it actually prevents a bounce.
- **Bigger waves.** `research-batch.ts --max` defaults to 50, so one run, one Sol pass and one
  catalog republish cover a wave.
- **Keep stages moving.** Start drafting a batch as soon as its sweep is done and send each drafted
  batch to `research-batch.ts` as it lands, instead of waiting for every batch at each stage.

What these do not change: rows held for thin evidence, living status or no citable source. That
share is set by the backlog, not the pipeline.

## Pilot results (2026-11-25)

**22 records went live from 76 sampled rows.** Three cohorts pass the stop rule (at least 1 in 4 kept
rows live) and Divine Nine fails it. "Kept" means a row survived identity dedupe and triage. A row
that research later found was not a subject counts as kept and not live. Every row carries its
decision and reason in `payload.burndown` (pilot `2026-11-25`).

| | other (30) | dc-sites (17) | divine-nine (13) | evidence-ready (16) |
|---|---|---|---|---|
| Merged as an existing live record | 2 | 5 | 0 | 2 |
| Dropped at triage (both vendors agreed) | 10 | 0 | 0 | 2 |
| Kept | 18 | 12 | 13 | 12 |
| Sweep found a non-Wikipedia source | 2 of 18 | 10 of 12 | 1 of 13 | 4 of 12 |
| Held or dropped at research | 6 of 18 | 2 of 12 | 7 of 13 | 2 of 12 |
| Held for no citable source after assessment | 0 | 3 (+1 thin at drafting) | 0 | 2 |
| Held after review (corrections did not converge or ran short) | 2 | 1 | 4 (template-only) | 1 |
| **Live** | **9 (50%)** | **5 (42%)** | **1 (8%)** | **7 (58%)** |
| Stop rule | pass | pass | **stop** | pass |

Within "other", the mention-mined half put 4 of 6 kept rows live and the stub half 5 of 12. Mention
mining had the higher drop rate (9 of 15 dropped at triage) and the higher yield on what survived.

Live: John Robinson, The Black Wall Street Times, Elise Johnson McDougald, Segregation academies,
William Tebeau, Fannie Pettie Watts, the 1966 Chicago Summit Agreement, St. Teresa of Avila, Wormley's
Hotel, A. J. Smitherman, Black Panther Militia, New York African Society for Mutual Relief, Ruth
Denny, Interdenominational Theological Center, Masjid Muhammad, St. Augustine (DC), James Farmer,
Davis v. County School Board, Flying Africans, 369th Infantry Regiment, Jones-Haywood School of
Ballet, Meharry Medical College.

### Measures

- **Triage:** 13 of 70 rows dropped on two-vendor agreement. The Sonnet audit (all 13, fewer than the
  planned 20) upheld 12 and overturned Black Abstractionism. Research later found that it isn't a
  discrete subject, so the cheap vote was right. The audit ran only two searches; treat it as thin.
- **Identity:** 9 merges. 6 matched by name. 3 DC sites matched a live record by identical
  coordinates under a different name, which name matching missed.
- **Sweep:** 51 of 55 kept rows captured something, but only 17 had a source other than Wikipedia.
  10 of 32 captures on the Divine Nine and DC rows were namesake pages that passed the identity gate:
  a saint, a pirate, an Air Force general, an actor, a Philadelphia church, an unrelated Confederate
  monuments article. All were quarantined.
- **Research:** 8 Sonnet clusters of 6 to 8 rows. 46 of 56 rows came back sourced.
- **Source assessment:** 29 hosts went through the isolated two-vendor assessment, and 11 registered.
  7 more registered on a Wikidata basis. Claude refused 17 of 29 and Sol 12 of 29; a host needs both.
  Several Claude quotes came from WebFetch summaries rather than raw page text, which weakens that
  side.
- **Drafting:** 32 Haiku drafts. 10 of the first 24 failed the validator on one rule (expanded
  negatives such as "did not"). That was fixed mechanically in prose fields only and then stated in
  the drafting brief. One validator false positive came from a book title (The New Negro).
- **Sol claim review:** about 562 claim reviews, 11 rejected (98% approval). 246 verdicts were reused
  from the cache.
- **Text review:** 73 reviews. Three correction passes, delete-or-narrow only, took 19 held records to
  14 live and 5 held.
- **Cost:** 28 subagent runs, 3.48M tokens in all (Haiku 1.21M, Sonnet 2.27M), about 158k per live
  record. About 337 Codex calls (234 claim-review batches, 73 text reviews, 29 host assessments, 1
  triage), about 15 per live record. Wall clock about 165 minutes, roughly an hour of it waiting on
  old-code Sol runs. Seattle Medium alone cost about 340k agent tokens.

### Old code against new code (same records, same work dir)

| Stage | Old: batch B, 8 records, 103 new claims | Old: batch A re-run, 16 records, 146 new | New, run 3: 19 records, 119 new, 112 reused | New, run 5: 12 records, 59 new, 96 reused |
|---|---|---|---|---|
| Capture | 0:46 | 1:28 | 2:22 | 1:19 |
| Claim review | 8:37 (5.0 s/claim) | 10:24 (4.3 s/claim) | 2:33 (1.3 s/claim) | 1:14 (1.3 s/claim) |
| Claim ledger write | 2:13 | 3:12 | 4:56 (1.28 s/claim, 231) | 1:06 (0.43 s/claim, 155; per-record transactions) |
| Text review | 2:23 (7 records) | 5:29 (15) | 1:48 (18) | 1:07 (12) |
| Publish and republish | 0:38 | stopped | 1:10 | 0:55 |
| Total | 14:37 | stopped before publish | 12:48 | 5:41 |

Times come from work-dir file mtimes, because piped stdout is block-buffered and log timestamps are
not reliable. Sol host assessment went from about 6 minutes per host to 5 hosts in 66 seconds.

### Pipeline gaps the pilot found

Fixed in this branch:

- Rows with no `canonical_url` (every mention-mined `gap_` row) ignored `summaryClaims`, so their
  summaries reached text review with no claim to cite (`lib/incremental-publish.ts`, test added).

Fixed by the session that started the pilot (staging `b030625d0`, `af969f65e`):

- Parallel Codex calls, larger waves, the month-without-year drafting rule, the lowercase
  display-name hold, and per-record ledger transactions.

Still open:

1. **The sweep's identity gate passes namesakes on common names.** About a third of the captures on
   person and church rows named someone or something else.
2. **The verdict cache is written after the ledger step.** A DNS failure between claim review and
   the ledger threw away 35 fresh verdicts, and the retry paid Sol again.
3. **An earlier "request changes" on identical text overrides a later approval.** The text has to
   change before it can pass, even when the new review approves it.
4. **Location staging accepts point precisions for cases, laws and movements.** The publisher then
   refuses them (earned precision). `stage-landscape-evidence.ts` should refuse up front or coarsen
   to county.
5. **Kind is wrong on Wikidata-derived rows.** 5 persons were filed as `other` or `institution`,
   which bypasses the person gate. Fix kind at sweep or triage.
6. **Title-case display names from Wikidata labels.** The live "segregation academy" record was
   renamed "Segregation academies", with the old name kept as an alias. 30 other pending non-Green
   Book rows start lowercase.
7. **Review passed an undated "launched in June".** The Black Wall Street Times was corrected by
   removing the clause, since no citable page states the year. The dated-source rule now needs a
   month-without-year check, and the drafting prompt has one.
8. **Drafts carry sentences with no claim behind them.** This was the most common text-review
   finding. The drafter should emit one claim per sentence, or the validator should refuse a sentence
   with no claim.
9. **Self-published sites hold DC churches.** Churches and schools are often documented only on their
   own sites. The "facts about itself only" tier is the decision that would unblock them.

Owner decisions recorded during the pilot: the stop rule; contemporary institutions stay live; and
persons get a session `personReview` only when a captured page states the death (13 recorded). Albert
Hicks is held because only an uncaptured page gives his death date.

### Recommendation per lane

- **other, mention-mined: scale.** Triage removes most rows for nearly nothing, and what survives
  publishes at the best rate. Fix gaps 4 and 8 first.
- **other, stubs: scale.** 5 of 12 kept rows went live. The holds are mostly persons with no
  sourced death and thin single-source subjects. Fix gaps 1 and 5 first.
- **evidence-ready: scale,** though only one cohort of 16 exists. The 17 rows are done.
- **dc-sites: scale with the location dedupe.** Match live records by coordinates as well as name
  (5 of 17 were already live). The rest hinge on gap 9.
- **divine-nine: stop.** 1 of 13 live, and the stop rule fires. The 12 Iota Phi Theta founders are
  documented mainly by their own fraternity. Two may be living (Spruill, Williams). The independent
  pages for the others sit on refused hosts, or their captures failed identity. Nothing more should
  go here until there is a source beyond the fraternity's own roster.
