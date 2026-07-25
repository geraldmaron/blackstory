# Research operations: verb reference

Canonical, tool-agnostic how-to for every research/operator-cli verb ("lane"). This is the
one place the actual command shapes, invocation rules, and guardrails live. Per-tool layers
(`.claude/skills/black-book/*`, `.opencode/opencode.json`) are pointers into this document —
they carry no command detail of their own. See `AGENTS.md` for the one-line index of every
verb with its exact command.

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
- **No personal host/IP.** Local/Corsair LLM or search endpoints are configured via
  `RESEARCH_LOCAL_LLM_HOST` / `RESEARCH_SEARXNG_HOST` (see `.env.corsair.example`, repo-xez5.1).
  Do not hardcode an operator's Tailscale IP or hostname in any command, doc, or example below.
- **Ledger logging.** `packages/operator-cli/src/model-routing.ts` (repo-xez5.2) is the one
  reviewed module for which model tier a lane uses, and
  `packages/operator-cli/src/model-invocation-log.ts` is the writer for
  `bb_research.model_invocations`. Both exist today, but no lane below calls them yet (the
  table has 0 rows) — retrofitting every LLM call site to log through them is repo-xez5.2's
  remaining scope, not duplicated here. New verbs added by repo-xez5.9 (`backfill-entity`,
  `prose-run`) reuse the same `runEnrichmentJudge` bridge as `enrichment-run` and inherit
  whatever logging that bridge eventually gets; do not add a second logging mechanism.

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
2. `buildCitationPrefill` / `planSelectiveCapture` — citation metadata + a note on where Wayback
   capture would attach (not wired yet).
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

**Catalog dedupe (required before new fixtures):** run
`packages/firebase/scripts/classify-corsair-keeps-against-catalog.ts` against enrichment keep
JSON — `existing_match` → enrich that entity, `non_entity` → exclude, only `new_candidate`
after human validation becomes a fixture.

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
`http://localhost:3001/login` → **Story review** (`/stories/review`) → approve returns seed
handoff JSON to paste into `packages/firebase/src/firestore/public-story-seed.ts`. Nothing
auto-publishes from the CLI or the portal.

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

**When to use:** resolve or correct an entity's lat/lng via Census geocoding (no LLM).

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts locate \
  --entity-id ent_example_001 \
  --address "1530 6th Avenue North, Birmingham, Alabama" \
  --jurisdiction "Birmingham, Alabama" --precision institution \
  --operator-id "$USER" --session-id "locate-$(date +%s)" --identity-source cli
```

Add `--commit` only when ready to write Firestore. Precision policy (no LLM, ever): street
number → `institution` (≤150m drift); named campus/place → `campus` (≤500m);
neighborhood/district → `neighborhood` (≤1600m); city only → `city`, do not sharpen.

Batch audit fixtures: `packages/firebase/scripts/audit-entity-locations.ts` (add
`--apply-street-corrections` for high-confidence street fixes only);
`packages/firebase/scripts/enrich-entity-locations.ts --apply` for named places via Wikidata
P625 (parent-site snaps capped at 15km, otherwise an honest precision downgrade).

**Do:** prefer street addresses; queue bare place names for review; re-publish after locating
so projections pick up `EntityLocation` overrides.

**Never:** use an LLM to guess coordinates; call Nominatim from product `/locate`; `--commit`
without reviewing `decision.action` when it is `review`.

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
via `getOpsPostgresPool`. This is a genuine partial fix, not a full read path: the
Firestore-backed `submissionInbox` (`moderationState` in `flagged`/`pending_review`/
`duplicate`/`coordinated_campaign`) and `discoveryCandidates` (`status === 'quarantined'`)
collections described in the admin console fixtures
(`apps/admin/src/console/fixtures.ts`) are **not** reachable from this CLI yet — operator-cli
has no Firestore Admin SDK wiring. Until that lands, use the admin console's
`/console/submissions` / `/console/candidate-queue` surfaces or a direct Firestore read for
those two collections.

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

## expand (new, repo-xez5.9 — stub)

**When to use:** grow an entity's network of related entities outward from a starting id.
**Not implemented yet** — full traversal depends on repo-xez5.4 (entity network expansion
engine), which does not exist yet. This command documents the intended interface and returns
`status: "not_implemented"` rather than faking a result:

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts expand \
  --entity-id ent_example_001 --depth 1 --json
```

Intended interface once repo-xez5.4 lands: `{ entityId, neighbors: [{ entityId,
relationshipType, edgeConfidence }], frontier }`, sourced from real relationship edges
(`propose-edge`'s domain, `RelationshipType`/`RelationshipRole`), never fabricated.
