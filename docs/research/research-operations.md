# Research operations: verb reference

Canonical, tool-agnostic how-to for every research/operator-cli verb. This is the one place
the actual command shapes, invocation rules, and guardrails live.

Agent skills live under `.claude/skills/blackstory/`:

- **CLI pointers** (`research-intake`, `discovery-run`, `editorial-enrichment`, `locate`,
  `case-drafting`, `story-craft`, `theme-study`, `triage-graylist`) exist for skill-matching
  UX. They point here and carry no command detail of their own.
- **Judgment playbooks** (`entity-verify`, `claim-corroborate`, `entity-complete`,
  `coverage-target`, `publish-preview`) are not verbs. Their decision order lives in the
  skill file. They call verbs from this document when a command is needed.

See `AGENTS.md` for the one-line index of every verb with its exact command.

All commands live in `packages/operator-cli/src/bin.ts` (entry) / `cli.ts` (dispatch) and run
as:

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts <verb> [flags]
```

## Conventions that apply to every verb

- **Safe by default.** Every command only *prepares* an outcome and prints it as JSON; nothing
  writes until `--commit` is passed. There is no `--publish`/`--approve`/`--promote` flag
  anywhere in this CLI (see `promotion-boundary.test.ts`).
- **`--json` is accepted on every verb.** Output is JSON unconditionally (the flag is a no-op
  that makes the contract explicit and machine-discoverable); `model-report` additionally uses
  it to switch from its human-readable summary to raw rows.
- **Targeting.** An entity is always `--entity-id`; a research case is always `--case-id`; a
  free-text ask (a URL, a topic, a description) is passed as `--url`/`--description`. Batch
  verbs (`discovery-run`, `editorial-run`/`enrichment-run`, `story-research-run`,
  `harness-run`) take a JSON file (`--batch`/`--subjects`/`--topics`) because their unit of
  work is a set, not a single id — that's a real shape difference, not an inconsistency to
  paper over.
- **No personal host/IP.** The variable code actually reads for search is `SEARXNG_BASE_URL`,
  a full base URL rather than a host. `.env.corsair.example` also defines
  `RESEARCH_SEARXNG_HOST`, but no code reads it: it is a bare host that
  `scripts/run-scheduled-searxng-discovery.sh` uses to build `SEARXNG_BASE_URL` when localhost
  isn't listening. The local-LLM pair works the same way: `RESEARCH_LOCAL_LLM_HOST` is a script
  input, `OLLAMA_BASE_URL` is what the code reads. Set the base URL, not the alias, and
  do not hardcode an operator's Tailscale IP or hostname in any command, doc, or example below.
- **Reaching a search provider.** Two things are true at once and the split between them is the
  whole design. The operator's SearXNG is *private on purpose* — loopback, or a Tailscale
  `100.64.0.0/10` address — so `executeSafeFetch` refuses it, correctly: every other caller of
  that function hands it a URL scraped from a web page, and such a URL must never reach an
  internal service. A *search result*, by contrast, is an untrusted URL and belongs on the full
  safe-fetch path.

  So the provider call uses `createOperatorEndpointClient`
  (`packages/security/src/url-safety/search-endpoint-client.ts`): one configured origin, compared
  as scheme/host/port rather than as a string, resolved once and pinned, JSON content-types only,
  a byte cap, a timeout, no redirect ever followed, and no retries (pacing belongs to the caller
  that knows the campaign). It **requires** the configured address to be one the SSRF policy
  rejects, so a `SEARXNG_BASE_URL` pointed at a public host fails at startup with a message naming
  `evaluateExternalUrl` + `resolveAndPinDestination` as the path to use instead. Brave is a public
  API and therefore takes the ordinary DNS-pinned route, not this client.

  Queries go through `runRoutedWebSearch` (`@repo/domain`), which returns **leads**, not sources.
  A lead carries a URL, a title and the engine's blurb, and deliberately has no text field: the
  blurb is not the page. A lead becomes evidence only after an independent fetch through
  `gatherSourceSnippetsFromUrls`, and `assertStorageTermsConfirmed` still stands between a result
  and a persisted row. A run without a campaign budget reports `budgetEnforced: false` rather than
  implying a guard ran.

  The CLI resolves all of this in `packages/operator-cli/src/search-routing.ts`. A verb asks for
  queries and gets leads; it does not read search env vars itself.
  `packages/ops-data/scripts/lib/corroborate-source.ts` reaches the same client directly, because it
  is a script rather than a verb and its own 4s inter-query throttle owns the pacing — which is why
  the client itself never retries. No web-search query anywhere uses bare `fetch`.
  `packages/operator-cli/src/worker-preflight.ts` also reads `SEARXNG_BASE_URL`, but only to probe
  the instance's health endpoint; it issues no queries.
- **Ledger logging.** `packages/operator-cli/src/model-routing.ts` (repo-xez5.2) is the one
  reviewed module for which model tier a lane uses, and
  `packages/operator-cli/src/model-invocation-log.ts` is the writer for
  `bb_research.model_invocations`. Both exist today, but no lane below calls them yet (the
  table has 0 rows) — retrofitting every LLM call site to log through them is repo-xez5.2's
  remaining scope, not duplicated here. New verbs added by repo-xez5.9 (`backfill-entity`,
  `prose-run`) reuse the same `runEnrichmentJudge` bridge as `enrichment-run` and inherit
  whatever logging that bridge eventually gets; do not add a second logging mechanism.
  `enrich-entity` (below) is a different code path entirely — it never touches this bridge,
  because it plans research rather than drafting prose.

---

## research-intake

**When to use:** the owner hands you a URL or topic and wants it turned into a proposed lead —
fetched safely, cited, and opened as a draft research case.

```bash
OPERATOR_CLI_PRIVACY_PEPPER=<pepper> node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts research-intake \
  --url "https://example.org/source" \
  --description "Optional owner note — omit to use the fetched excerpt" \
  --location "City, State" --era "1960s" \
  --operator-id "<your operator id>" --session-id "<this session's id>" \
  --identity-source claude_session
```

`runResearchIntake` (`research-intake.ts`) sequences three real, independently tested steps:
1. `runQuickAddFetch` (`fetch.ts`) — DNS-pinned, SSRF-safe fetch through BB-030
   (`executeSafeFetch`, `packages/security/src/url-safety/`).
2. `buildCitationPrefill` / `planSelectiveCapture` — citation metadata plus a note that Wayback
   SPN2 is wired on `capture-backfill --wayback`, not on intake.
3. `prepareLeadIntake` (`intake.ts`) — real BB-029 quarantine intake plus a real BB-044 draft
   research case.

Add `--commit` only after the owner reviews the printed result and asks you to write it
(needs `GOOGLE_APPLICATION_CREDENTIALS`/`FIREBASE_PROJECT_ID`).

**Do:** read `fetch.reason` and explain a denial (`dns_answer_not_public`, `malware_indicator`)
instead of retrying around it; use the owner's own words for `--description`; report back
`submissionId`/`researchCaseId`.

**Never:** fetch the URL yourself and paste content in (bypasses BB-030); `--commit` without
explicit go-ahead; treat a completed call as published (it only reaches `state: 'candidate'`);
hand-build a `SubmissionInput`/`ResearchCaseRecord`.

---

## capture-backfill

**When to use:** snapshot cited URLs into `bb_evidence.source_captures` (local hash + excerpt),
optionally secondary-anchor them at Wayback via Save Page Now.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill \
  --commit --max-captures 25
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill \
  --commit --wayback --max-captures 25
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill \
  --commit --wayback --max-entities 20
```

Safe by default (inventory + coverage JSON, no fetch, no write). `--commit` fetches through the
SSRF-safe path and writes capture rows. `--wayback` POSTs each **successful** local capture to
`web.archive.org/save` (SPN2) through `packages/domain` Wayback client + the operator-cli
`SafeHttpClient` port. Snapshot URL lands on `source_captures.storage_object`. Keys live in
1Password item **Internet Archive** (Personal vault); inject with `run-with-dev-secrets`. If
`INTERNET_ARCHIVE_ACCESS_KEY` / `INTERNET_ARCHIVE_SECRET_KEY` are unset, SPN is skipped and
local capture still runs (`wayback.status: skipped_no_credentials`).

Do not run unbounded `--wayback --commit` against the full cited-URL inventory. Use
`--max-captures`, `--max-entities`, and the daily `source_fetch` budget in
[`capture-completeness-ops-bar.md`](./capture-completeness-ops-bar.md). Failed local fetches do
not mint SPN jobs; that lookup-fallback is a separate lane.

**Never:** raw `fetch` to archive.org; fabricate a Wayback URL when SPN fails; treat `--wayback`
without `--commit` as a live save (dry-run only reports `wayback.status: planned`).

---

## discovery-run

**When to use:** launch a bounded adapter discovery campaign against an already-assembled
batch of candidates and get a yield summary (accepted/quarantined/dead-lettered).

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-run \
  --batch path/to/batch.json \
  --campaign-id "campaign-2026-07-17-01" --countries US \
  --max-candidates 100 --max-quarantined 10 --max-dead-letter 5 --max-retries 2 \
  --continue-on-quarantine
```

`--batch` is `{ "pack": QueryPack, "records": AdapterCandidateRecord[], "runContext":
DiscoveryRunContext }`. This is a thin wrapper over `runBoundedDiscoveryCampaign`
(`discovery-run.ts`) → `createDiscoveryCampaignConfig` + `runDiscoveryCampaign`
(`@repo/domain` discovery/). Fetching candidates from a real source is out of scope — that's an
adapter/worker concern (`packages/domain/src/adapters/**`). See
[`discovery-pipeline.md`](./discovery-pipeline.md) for the adapter-level pipeline this feeds.

**Do:** report accepted/quarantined (with `failureReason`)/dead-lettered in plain terms; keep
quarantine/dead-letter budgets conservative on an unfamiliar batch; point the owner at
`graylist-read`/triage for anything quarantined.

**Never:** hand-build `records` to force a run through; treat `accepted` as published or as a
research case (`assertDiscoveryCannotPublish` is a hard domain gate); widen budgets mid-run to
push through a stall — that's a signal to investigate the source, not a limit to raise.

---

## editorial-enrichment (`editorial-run` / `enrichment-run`)

**This whole family is prose-only.** It drafts or rewrites prose from evidence it is handed; it
never searches, never fetches a new source, and never changes an entity's `ResearchMaturity`
(`packages/domain-core/src/research/maturity.ts`). If the question is "what does this record
still need researched," skip to **enrich-entity** below — that is the evidence-directed planner,
and it is a different code path from everything in this section.

**When to use:** check pending discovery/obscurity leads, run editorial or enrichment with an
LLM (mock/OpenRouter/local), weed bad items, draft linked prose, stage packets for quarantine.
Never publishes.

Pending list:

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts pending-list \
  --from /tmp/obscurity-summary.json
```

Editorial / enrichment (dry-run default). Subjects file: `{ "subjects": [{ "subjectId",
"title", "existingSummary?" }] }`. Optional catalog JSON `{ "entities": [...] }`, or
`--catalog-from=firestore`/`--catalog-from=postgres` to join the live catalog.

```bash
OPERATOR_CLI_PRIVACY_PEPPER=dev node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts editorial-run \
  --subjects /tmp/subjects.json --catalog-from=postgres --provider mock \
  --operator-id "$USER" --session-id "cursor-$(date +%s)" --identity-source cursor_session
```

Providers: `mock` (default), `openrouter`, `ollama`, `hybrid`. For `ollama`/`hybrid`, point
`OLLAMA_BASE_URL` at `RESEARCH_LOCAL_LLM_HOST` (see repo-xez5.1 / `.env.corsair.example`) — never
hardcode a host. `enrichment-run` is the same judge, result kind `enrichment.run.v1`.

Add `--commit` only after the owner reviews the JSON — writes quarantine `editorial_packet`
proposals (may open draft research cases). There is no `--publish`/`--promote`.

**Catalog dedupe:** `packages/firebase/scripts/classify-corsair-keeps-against-catalog.ts` was
deleted with the rest of the fixture-catalog tooling once Supabase became the sole entity
store (commit f8c81a06); there is no scripted dedupe replacement. Before enriching a keep,
check the live catalog by hand (`--catalog-from=postgres`) for an existing match.

**Prose links:** summaries use `[[ent_id|Display Name]]` so `LinkedProse` renders `EntityLink`s.

**Never:** call promotion gates or release activation; treat LLM confidence as publication
authority; skip `validationIssues` — surface them to the owner.

### backfill-entity (new, repo-xez5.9)

**When to use:** re-run enrichment for one specific entity id you already know, without
building a subjects file.

```bash
OPERATOR_CLI_PRIVACY_PEPPER=dev node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts backfill-entity \
  --entity-id ent_example_001 --title "Display name" --summary "existing summary, optional" \
  --provider mock --operator-id "$USER" --session-id "backfill-$(date +%s)"
```

Implemented as a one-subject wrapper over the same `runEnrichmentJudge` bridge as
`enrichment-run` (`cli.ts`, case `backfill-entity`/`prose-run`) — same providers, same
`--commit` semantics, same output shape (`enrichment.run.v1`) plus `{ verb, entityId }`. Ledger
logging: none yet (see "Conventions" above; tracked under repo-xez5.2).

### prose-run (new, repo-xez5.9 — short-form prose)

**When to use:** a lighter-weight prose draft for one subject, instead of a full
`story-research-run` packet (ten research moves, cite map, pattern cases). Reuses the exact
same enrichment bridge and output (`enrichment.run.v1`) as `backfill-entity` — the "short form"
*is* the existing editorial/enrichment draft (`drafts.publicSummary` /
`drafts.historicalContext`), not a new prose engine. Reach for full `story-research-run` when
you need the oral-methodology structure (start-line relocation, named anchors, mechanism
layer); reach for `prose-run` for a quick, citation-light summary draft.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts prose-run \
  --entity-id ent_example_001 --title "Display name" --provider mock \
  --operator-id "$USER" --session-id "prose-$(date +%s)"
```

---

## enrich-entity (deep research planner) — evidence-directed, not prose

**When to use:** find out what a specific released entity is actually missing, evidence-wise,
before anyone drafts a sentence. This is the ONLY verb described in this document that is
evidence-directed rather than prose-only — see the note atop the section above. Read
`packages/operator-cli/src/enrichment-plan.ts` before touching this verb; its file header states
the distinction this section summarizes.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts enrich-entity \
  --entity-id ent_example_001 --target-maturity corroborated
```

What it does: reads the released entity, runs `assessResearchMaturity`
(`packages/domain-core/src/research/maturity.ts`) to get its current `ResearchMaturity` state and
its `ResearchDeficit`s, then `planEnrichment` (`packages/operator-cli/src/enrichment-plan.ts`)
turns each deficit CODE (not each occurrence — three claims sharing one deficit are one research
task) into an `EvidenceNeed` — what is missing and why, `mandatory` or not, whether it needs a
contradiction search — plus a small number of bounded search queries. A query here is a LEAD, not
evidence, and is emitted as a query string rather than a result for exactly that reason (see
"Reaching a search provider" above). Deficits with no searchable remedy (for example
`missing_creation_or_publication_date` — a schema gap, not something a search can close) come back
named in `unaddressedDeficits` instead of being silently dropped or handed a query anyway.

What it does NOT do, as of this writing: the search, fetch, capture, selector, and
claim-extraction stages that would turn one of this plan's queries into evidence are not built.
`enrich-entity` PLANS deep research; it does not run it. There is no `--commit` for this verb —
deliberately, per its own code comment: a `--commit` that staged an empty result would tell the
same lie `enrichment-run` tells by relabelling the editorial judge. The JSON output always carries
`"executed": false`. Do not read a plan's `queries` as sources, and do not point a drafting pass at
this verb's output expecting sourced prose back — nothing here has been fetched yet.

**Which path to use when:**

- Nothing captured yet, or you don't know what's missing → `enrich-entity` first. It tells you
  the deficits and gives you leads to chase (resolve and fetch them through the normal safe-fetch
  path — `research-intake` / `attach-evidence` / `register-source` — before treating anything a
  query returns as a source).
- Evidence is already captured (`bb_research.entity_enrichment.status = 'captured'` — the only
  status `fetchEnrichmentSubjects` will pull) and the record just needs that evidence turned into
  cited public prose → the prose-only path:
  either the $0 session-subagent fan-out (`packages/ops-data/scripts/session-enrich-prepare.ts` →
  fan-out drafting subagents → `session-enrich-collect.ts` → `session-enrich-apply.ts`; full
  runbook in `packages/ops-data/scripts/README-fanout-drafting.md`), or the metered equivalent
  (`packages/ops-data/scripts/enrich-entities-llm.ts`), or the operator-cli verbs immediately
  above (`enrichment-run` / `backfill-entity` / `prose-run`). All of these read only evidence
  already on hand and validate every citation with `validateEnrichmentResponse`
  (`packages/ops-data/scripts/lib/entity-enrichment-llm.ts`); none of them search or fetch, and
  none of them can raise the record's maturity state — maturity is derived from evidence lineage
  and diversity, which rewriting prose over the same evidence does not change.
- Never run the prose-only path on a subject with no captured evidence expecting it to do
  research. `fetchEnrichmentSubjects` (`packages/ops-data/scripts/lib/entity-enrichment-fetch.ts`)
  already skips entities with none for the scripted paths, but a hand-built `enrichment-run`
  subjects file has no such guard and will draft confidently from whatever `sourceSnippets` you
  hand it.

---

## story-craft (`story-research-run`)

**When to use:** draft or recommend longform `/stories` articles from archive evidence using
citation-gated story research packets. LLM drafts stay proposals; human approval maps an
approved packet onto `publicStoryProjection`. There is no auto-publish.

Brand register: [`docs/ui/story.md`](../ui/story.md) — place-first, evidence before assertion,
proud/precise/unflinching, never trauma-forward as the default lead.

Ten research moves (thesis question, start-line relocation, named anchors, omitted actors,
winner-built test, mechanism layer, pattern cases, authority witnesses, present bridge, cite
map) and hard bans (trauma-as-hook, unsourced sweeping claims, personal testimony as proof,
LLM-confidence-as-authority, scrape-as-truth) are the full methodology — see the topics-file
shape and dry-run/commit/approval flow below; do not shorten these rules when running the
verb, only when reaching for `prose-run` instead.

Topics file: `{ "topics": [{ "topicId", "title", "eraLabel", "placeLabel",
"relatedEntityIds", "relatedFactIds", "publishedClaims", "authorityLeadHints" }] }`.

```bash
OPERATOR_CLI_PRIVACY_PEPPER=dev node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts story-research-run \
  --topics /tmp/story-topics.json --provider mock \
  --operator-id "$USER" --session-id "cursor-$(date +%s)" --identity-source cursor_session
```

`--commit` stages quarantine `story_packet` proposals only. Human approval:
`http://localhost:3048/admin/login` → **Story review** (`/admin/stories/review`) → approve
returns seed handoff JSON to paste into
`packages/domain/src/publication/public-story-seed.ts`. Nothing auto-publishes from the CLI or
the portal.

**Never:** call promotion gates or release activation; paste unresolved/unpublished cites into
seed stories; lead with graphic violence; invent market figures, continental claims, or family
proof.

---

## theme-study (`harness-run`)

**When to use:** run a thematic study (e.g. redlining, urban renewal) and draft
`ThemeImpactPacket`s. Full workflow, schema, and curation rules:
[`theme-impact-packet-system.md`](./theme-impact-packet-system.md).

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts harness-run \
  --theme redlining --metro metro:chicago-il --connectors dpla,nps-network-to-freedom,shpo \
  --output /tmp/chicago-redlining-raw.json
```

Enrich the raw output (point `--model`/`OLLAMA_BASE_URL` at `RESEARCH_LOCAL_LLM_HOST` for a
local/Corsair model — never hardcode a host):

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts harness-run \
  --theme redlining --input /tmp/chicago-redlining-raw.json --enrich \
  --provider openrouter --model google/gemini-2.5-pro:free --commit
```

Hard curation rules: juxtaposition by default (never state automatic causation without a
cited, gated study); dignity in mapping (no alarm colors for violence, precision matches
record); no anonymous cites; archive citations must have valid Wayback/content-addressed URLs.

---

## locate

**When to use:** a sourced street or named-place address already exists and must be
Census-geocoded to lat/lng (no LLM). If you still need to find the place, confirm which
namesake this is, choose precision honestly, or assign era, stop and use the
`blackstory-entity-verify` skill first. Do not invent an address so this verb can run.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts locate \
  --entity-id ent_example_001 \
  --address "1530 6th Avenue North, Birmingham, Alabama" \
  --jurisdiction "Birmingham, Alabama" --precision institution \
  --operator-id "$USER" --session-id "locate-$(date +%s)" --identity-source cli
```

Add `--commit` only when ready to write Postgres (the live atomic store — there is no
Firestore path). Precision policy (no LLM, ever): street number → `institution` (≤150m
drift); named campus/place → `campus` (≤500m); neighborhood/district → `neighborhood`
(≤1600m); city only → `city`, do not sharpen. See also
[`docs/security/location-precision-standard.md`](../security/location-precision-standard.md)
for the full NRHP-derived precision tier standard.

The old fixture-catalog batch scripts (`audit-entity-locations.ts`,
`enrich-entity-locations.ts`, and `classify-corsair-keeps-against-catalog.ts` under
`packages/firebase/scripts/`) were deleted along with the rest of `fixtures/national-catalog/`
once Supabase became the sole entity store (commit f8c81a06). There is no batch-audit
replacement yet; run `locate` per entity.

**Do:** prefer street addresses; queue bare place names for review; re-publish after locating
so projections pick up `EntityLocation` overrides.

**Never:** use an LLM to guess coordinates; invent an address so this verb can run; call
Nominatim from product `/locate`; `--commit` without reviewing `decision.action` when it is
`review`. Identity, unsourced sites, and era are the `blackstory-entity-verify` skill.

---

## case-drafting

**When to use:** the owner wants to know whether a research case is review-ready, or wants
help assembling its claims/evidence/confidence toward the minimum publishable record.

Evaluation is read-only and pure — call the real functions directly against the case record:

```ts
import { evaluateEvidenceChecklist, buildResearchCasePreview } from '@blap/domain';
const evaluation = evaluateEvidenceChecklist(caseRecord.checklist);
```

These are the exact functions BB-044's own transitions use (`packages/domain/src/research-case/
workflow.ts`) — never hand-roll an "is this ready" check.

Filling a gap the evaluation surfaced:

```bash
OPERATOR_CLI_PRIVACY_PEPPER=<pepper> node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts attach-evidence \
  --case-id "<research case id>" \
  --description "Fills the missing 'source_citation' checklist item: ..." \
  --source-url "https://..." --operator-id "<your operator id>" --session-id "<this session's id>"
```

**Do:** quote `evaluation.missingMinimum`/`completedEnrichment` back verbatim; name the
checklist key the evidence fills; check `buildResearchCasePreview(...).publishable` before
calling a case "ready" — `meetsMinimumRecord` alone isn't enough.

**Never:** call `transitionResearchCase`/`markResearchCasePublished` yourself (needs a
`research:write`-authorized `VerifiedAdminToken`); assemble evidence and call
`evaluatePromotionGate` expecting to approve it yourself (`proposer_approver_conflict`); mark a
case ready based on your own read of the evidence.

---

## triage-graylist

**When to use:** walk parked, weak-signal candidates (quarantined submissions or
low-confidence discovery candidates) and decide what to do with each — strengthen with
corroboration, or recommend rejection. Never executes the decision.

### graylist read path (new, repo-xez5.9)

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts graylist-read \
  --limit 20 --json
```

Reads `bb_submissions.intake_items` (Postgres) where `status = 'quarantined'`, newest first,
via `getOpsPostgresPool`. This is a partial read path: it covers quarantined intake items
only. Low-confidence discovery candidates (the discovery lane writes them to Postgres through
its own quarantine gates, see `docs/runbooks/data-ingestion-methodology.md`) are not reachable
from this command yet; triage those in the admin console. The Firestore-era `submissionInbox`
and `discoveryCandidates` collections, and the admin console fixtures that described them, no
longer exist.

### quarantine-triage (LLM-assisted, repo-t2vh)

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts \
  quarantine-triage --limit 200 --provider openrouter --commit \
  --operator-id "$USER" --session-id "$(date +%s)"
```

Judges each `bb_submissions.intake_items` row with an LLM (`mock`/`openrouter`/`ollama`/`hybrid`,
see `llm-provider.ts`) into `case` / `reject` / `spam`, then downgrades anything below
`--confidence-threshold` (default `0.6`) to `needs_human` and leaves it quarantined untouched.
This is a lightweight triage pass, not the full editorial/enrichment harness: a `case` decision
only opens a bare draft research case (`bb_research.cases`, `state: 'candidate'`) so it enters
the normal research pipeline actual sourcing/enrichment still happens later via
`editorial-run`/`enrichment-run`. Safe by default (prints JSON only); `--commit` is required to
write. Every decision including `reject`/`spam` is logged to `bb_audit.events` with the
model's rationale. Never writes `bb_canonical.*` or evaluates a promotion gate see
`quarantine-triage.ts`'s header and `promotion-boundary.test.ts`.

Run in batches (`--limit 200`–300), review the `needs_human` items in the output, then repeat
until the backlog clears. Free-tier OpenRouter rosters come from `OPENROUTER_MODELS`
(comma-separated); omit `--model` to let the roster rotate.

**Propose corroborating evidence** (strengthens a weak-signal item tied to a case) and
**prepare a recommendation** both go through `attach-evidence` exactly as in case-drafting
above — state accept/reject/needs-more-evidence explicitly in `--description`.

**Do:** read the full existing submission/candidate before recommending anything; prefer
`attach-evidence` over a fresh `submit-lead` when a case id already exists.

**Never:** write directly to `submissionInbox`/`discoveryCandidates` to change state (no
sanctioned write path); call this "resolving" or "closing" an item — only a reviewer with
`research:write` transitions it; fabricate corroboration.

---

## expand

**When to use:** grow an entity's network outward from a starting id and stage the neighbors
as reviewable candidates.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts expand \
  --entity-id ent_example_001 --depth 1 --max-candidates 50 --json
```

The seed is read from `bb_canonical.entities`. The row's `identifiers` must carry a Wikidata
QID, or the command fails with `Entity <id> has no Wikidata QID in identifiers`
(`expand-verb.ts`, `loadExpansionSeed`). Traversal is live Wikidata, not a fixture
(`entity-network-expansion.ts`): forward claims come off the seed's own `Special:EntityData`
document (P108 employer, P69 educated at → `member_of`, P463 member of, P485 archives at →
`other`), and the claims Wikidata records only on the *neighbor's* item (P112 founded by, P50
author) come from the public SPARQL service. `--depth 2` expands each first-hop neighbor once,
applying the person forward-property set to all of them because the neighbor's canonical kind
isn't resolved at that point; any `--depth` other than `2` is treated as `1`.
`--max-candidates` (default 50) caps the whole run across hops. A neighbor reached by two
properties is deduped, keeping the first hypothesis and merging both provenance hops.

A dry run prints `{ verb, entityId, depth, status: "dry_run", candidateCount, seed,
candidates }`. Each candidate carries `qid`, `label`, `hop`, a `hypothesis` (a
`relationshipType` from the `docs/relationship-taxonomy.md` vocabulary, a `direction`, and,
where a Wikidata property has no exact taxonomy type, a `note` explaining the mapping), and
`provenance` hops naming the source QID, the property, and the Wikidata item URL.

`--commit` opens a transaction, records a `bb_research.source_program_runs` row
(`wikidata-network-expansion`), and inserts `bb_research.landscape_candidates` rows with
`lane = 'wikidata'`, `research_lane_only = true`, `status = 'pending'`. Output becomes
`{ verb, entityId, depth, status: "staged", candidateCount, stagedCount, seed }`. Nothing
reaches `bb_canonical.*`: `entity-network-expansion.test.ts` asserts the staging function has
no code path that could.

**Current limitations.** Both are wiring gaps in the CLI call site, not missing engine work:

- The CLI calls `expandEntityNetwork(seed, config)` and leaves the module's injectable fetcher
  at its default, so live traffic goes out through a bare global `fetch` rather than the
  SSRF-safe path the rest of the CLI uses. The tests inject a mock fetcher; the shipped command
  does not inject anything.
- The CLI passes neither the traversal's `meta` out-param nor `seedBirthDeathYears` to
  `stageNetworkCandidates`, so the seed's P569/P570 birth and death years are read during
  traversal and then dropped. Staged rows carry no `seed_birth_year`/`seed_death_year`, which
  is exactly what a reviewer would use to reject an anachronistic neighbor.

**Do:** read the dry run before committing; treat a staged row as a hypothesis for the normal
review path.

**Never:** call a staged candidate an edge. `propose-edge` is the verb that proposes one, and a
candidate is not a relationship until a reviewer says so.

---

## Judgment playbooks (not verbs)

These have no operator-cli command. Load the skill, then call verbs from this document when
a sourced address, evidence attachment, or campaign is actually ready.

| Skill | When |
|---|---|
| `.claude/skills/blackstory/entity-verify` | Confirm identity, source a place, set precision, assign era |
| `.claude/skills/blackstory/claim-corroborate` | Independent lineage, Wikipedia rule, superlatives |
| `.claude/skills/blackstory/entity-complete` | Blank public fields (image, related, historicalContext) |
| `.claude/skills/blackstory/coverage-target` | Where research should look next |
| `.claude/skills/blackstory/publish-preview` | Release preview only; never activate |
