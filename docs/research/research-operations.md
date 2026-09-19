# Research operations: verb reference

Command reference for the [research framework](./README.md), usable by any model or operator. This is the one place
the actual command shapes, invocation rules, and guardrails live.

Agent skills live under `.claude/skills/blackstory/`:

- **CLI pointers** (`research-intake`, `discovery-run`, `editorial-enrichment`, `locate`,
  `case-drafting`, `story-craft`, `theme-study`, `triage-graylist`) exist for skill-matching
  UX. They point here and carry no command detail of their own.
- **Judgment playbooks** (`entity-verify`, `claim-corroborate`, `entity-complete`,
  `coverage-target`, `publish-preview`, `intake-review`) are not verbs. Their decision order lives in the
  skill file. They call verbs from this document when a command is needed.

See `AGENTS.md` for the one-line index of every verb with its exact command.

All commands live in `packages/operator-cli/src/bin.ts` (entry) / `cli.ts` (dispatch) and run
as:

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts <verb> [flags]
```

## Conventions that apply to every verb

- **Effects are verb-specific.** Intake and capture commands require `--commit` for database
  writes. Acquisition can fetch sources and `--enrich` calls a model. Live discovery dispatch
  records a run and private proposals. Read the verb before execution; stdout and `--output`
  also persist data when redirected. No research command publishes or approves.
- **`--json` is accepted on every verb.** Output is JSON unconditionally (the flag is a no-op
  that makes the contract explicit and machine-discoverable); `model-report` additionally uses
  it to switch from its human-readable summary to raw rows.
- **Targeting.** An entity is always `--entity-id`; a research case is always `--case-id`; a
  free-text ask (a URL, a topic, a description) is passed as `--url`/`--description`. Batch
  verbs (`discovery-run`, `editorial-run`/`enrichment-run`, `story-research-run`,
  `harness-run`) take a JSON file (`--batch`/`--subjects`/`--topics`) because their unit of
  work is a set, not a single id — that's a real shape difference, not an inconsistency to
  paper over.
- **Explicit endpoints.** Set `SEARXNG_BASE_URL` for an operator-controlled search service,
  or configure Brave through the search router. Set `OLLAMA_BASE_URL` only when intentionally
  using a local provider. There are no personal-host aliases or Corsair fallback. No research
  schedule is enabled by invoking these commands.
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
- **Ledger logging.** `model-routing.ts` and `model-invocation-log.ts` are the existing model
  policy and logging modules. Presence is not integration: the audit found no persisted model
  invocations or frontier tasks in the initial production observation. The durable protocol below
  now has real local Postgres tests; older verbs do not inherit its guarantees automatically. See [audit](./framework-audit.md).

---

## Durable research runs

The external-worker protocol works from any model, CLI process, or operator. It persists state
in the research ledger and installs no schedule. The worker performs source/model calls outside
database transactions. CLI commands print JSON and return nonzero on failed validation, stale
leases, rejected completions, or unsuccessful heartbeats.

Start from [`environmental-history-plan.json`](../../packages/research-kernel/examples/environmental-history-plan.json).
Replace its question, identities, exact model ID and cost bounds. It is an illustrative second-domain
manifest, not researched historical evidence. A new case/run requires unique identifiers.
Pin the profile and use `ResearchTaskSpec` / output schemas from `@repo/research-kernel`.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-run --plan plan.json
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-run --plan plan.json --commit
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-claim --run-id RUN --worker-id WORKER --output lease.json --commit
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-heartbeat --lease-path lease.json --commit
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-complete --lease-path lease.json --result-path result.json --model-record model.json --commit
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-status --run-id RUN
```

`OPS_DATA_SOURCE=postgres` and a server-only database identity able to assume `research_worker` are
required for ledger operations. These credentials must never reach public clients. Provision a login with only the `research_worker` role for unattended work; do not supply an administrator URL.
Use restricted worker infrastructure if models execute shell commands. The CLI is an operator boundary,
not an untrusted multi-tenant worker sandbox.

`research-run` without `--commit` validates without database writes or external calls. Replaying
an identical committed manifest is idempotent; changing a run/profile version in place is rejected.
Claims are scoped to one run. Dependencies must finish first. Claiming reserves each attempt's
maximum cost before external work; interrupted or uncertain attempts retain the reservation.
A task that loses its lease must stop work and obtain a fresh claim. Never complete with another
worker's lease. The lease token is a private capability and must not be logged publicly.

`model.json` follows `ModelInvocation`, omitting `schemaVersion`, `id`, `activityId`, `rawResponse`,
`status`, and `repairOfInvocationId`, which the executor supplies. Include actual model family,
provider route, prompt hash, output schema/version, benchmark identifier, and `accounting`.
Unknown token counts and charges are `null`, with `source:null` and `incomplete:true`.
A successful provider response after uncertain retries is still incomplete accounting.
Reported OpenRouter charges exclude purchase fees and any separate upstream BYOK bill.

The executor validates and retains raw invalid output. Extracted claims, relationship evidence,
and task-report quotes must match supplied/captured source records exactly. Every relationship
remains quarantined. Successful execution does not satisfy evidence needs or authorize publication.
The status response reports those review needs separately. A benchmark-required profile mode
currently refuses dispatch until a real admission path exists; changing a benchmark label cannot
make it pass. Trusted external model work remains proposals requiring independent review.

## Built-in worker

`research-work --run-id RUN --worker-id WORKER --max-tasks 3 --commit` executes at most three
leased attempts. Repeating it in a new process resumes durable state. No schedule is installed.
`ResearchWorkerInput` describes `search`, `acquire` and `synthesize` operations inside a task's
`input`; use `executor: "builtin"`. The shared JSON Schema is authoritative in both languages.

Each search reserves candidate capacity before dispatch. Each acquisition reserves every possible
fetch, validates an exact public-text retention decision, uses safe-fetch, persists capture origin
and authorized passages, and carries a bounded text window into its result. Redirects require a
separate final-URL decision. Search blurbs never become source text. Empty acquisition and failed
counterevidence search do not satisfy an evidence need.

Synthesis with `model: null` produces an evidence inventory. A configured model must be admitted by
the pinned profile; its input-byte, output-token and provider-price bounds must fit the reserved
attempt cost. Calls have one attempt, no hidden model/provider fallback, and schema validation.
OpenRouter receives maximum per-token prices and zero per-request/image charges. Unknown charges
stay unknown. Profile budgets cover model inference; search-service and infrastructure bills are
separate. Benchmark-required modes remain unavailable without independently validated admission.

For a task without `executor: "builtin"`, the worker returns an `externalLease` and its source
artifacts. A model or operator can complete that exact lease using `research-complete`, then resume
the worker. This is the route for models operating through another API or an agent session.
Treat lease output as a private capability; keep it out of shared logs. `--output` saves the JSON
response locally. `research-status` returns metadata, unresolved needs and publication denial.

## Evidence passage retrieval

`capture-backfill` indexes authorized extracted text while preserving original source, capture,
parser/text revision, and Unicode positions. Metadata-only capture without text permission does
not create a searchable full-text copy. Existing captures can be indexed only from text matching
the extraction hash recorded with their source origin.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-index --capture-id CAPTURE --source-item-id ITEM --parser-version PARSER --text-path source.txt --preservation-decision decision.json --commit
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-retrieve --query "school cartography" --source-item-ids ITEM --limit 10
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-embed --embedding-file embedding.json --commit
node --conditions development --import tsx packages/operator-cli/src/bin.ts research-retrieve --query "teaching navigation" --vector-file query-vector.json --limit 10
```

An embedding file contains `passageId`, `bodyHash`, `model`, and a 768-number `vector`.
A query vector file contains the same exact `model` revision and `values`. Generation is supplied
by the configured embedding provider or an external worker; these commands make no model calls.
Nonfinite, zero, wrong-size, stale-text and expired/withdrawn vectors are rejected.

Text and vector ranks combine using the existing reciprocal-rank fusion helper. Exact vector
search is the default comparison baseline. `--approximate` enables HNSW and may lose recall under
filters. Evidence scores are retrieval priorities, not probabilities or proof of historical truth.
Synthetic integration fixtures verify selectors, retrieval mechanics and isolation, not semantic
quality of a real model or coverage of archives not indexed.

## Preservation decisions and archive jobs

`capture-backfill --commit --preservation-decisions decisions.json` accepts an array of canonical
`PreservationDecision` records. Each identifies an exact `sourceUrl`, `allowTextRetention`,
`allowArchive`, `sensitivity` (`public`, `restricted`, or `unknown`), `reviewedBy`, `reviewedAt`,
`expiresAt`, and the rights/consent `basis`. No decision means metadata-only storage without an excerpt.
Private text retention and public archival submission require separate decisions; a source host
or institutional label is insufficient authorization.

Add `--wayback` and configured Internet Archive credentials to submit eligible sources. The
availability lookup runs first and does not create a capture. Returned pointers must identify a
successful snapshot of the exact requested source. An older snapshot is a historical pointer,
not proof that it preserves the bytes fetched now.

SPN2 jobs persist in `research.preservation_jobs`. A later explicit run polls pending jobs without
reposting them. A lost submission response leaves an uncertain reservation requiring reconciliation
with the archive; it is never automatically submitted twice. Reports distinguish metadata records,
extracted-text copies, pending jobs and archive pointers. None of these counters claims verified
full-page capture coverage. No archive request or schedule is made by a dry run.

## Capture retention

`capture-retention --operator-id NAME` previews expired or unapproved capture origins. Add
`--commit` to erase retained text and vectors in the database and record pending storage disposals.
Use `--source-item-id ITEM` for an explicit withdrawal, even before expiry. The command never
installs a schedule. Use a trusted operator database identity; research workers cannot erase
canonical evidence or grant themselves retention permission.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-retention --operator-id NAME --limit 100
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-retention --operator-id NAME --limit 100 --commit --delete-storage
```

`--delete-storage` requires configured private capture storage. Failed deletion stays pending;
rerun the command to retry. Shared objects remain while any retained origin references them.
New capture uploads use a retention-decision namespace, so renewed permission does not reuse an
object awaiting deletion. Review historical shared paths during cutover. A newer valid decision
can renew an unwithdrawn index; explicit withdrawal is a tombstone and prevents automatic revival.

The sweep retains source identity, hashes and minimal disposition metadata. It covers capture
text and the derived passage/vector index. It also erases affected run manifests, task inputs, dependent proposal payloads, raw model responses
and quarantine payloads while retaining hashes and disposal metadata. Expired failed payloads are
swept too, including abandoned manifests that produced no artifacts. Execution leases cannot
outlive the run payload deadline. Canonical reviewed claims, public Internet Archive copies, backups and externally copied
files require their own withdrawal procedures; the automatic worker refuses restricted content.
Do not export retained source text into unmanaged logs.

`capture-retention --orphans --bucket raw-sources --operator-id NAME` also inventories unreferenced
capture objects older than 24 hours using read-only Storage metadata. `--commit` records disposal
tombstones; `--delete-storage` drains them through the Storage API. Origin insertion rejects a
tombstoned key, preventing a late writer from reviving a disposed object. Repeating the sweep
reconciles interrupted uploads and deletion failures. No Storage metadata rows are deleted directly.

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
  --identity-source cli
```

`runResearchIntake` (`research-intake.ts`) sequences three real, independently tested steps:
1. `runQuickAddFetch` (`fetch.ts`) — DNS-pinned, SSRF-safe fetch through BB-030
   (`executeSafeFetch`, `packages/security/src/url-safety/`).
2. `buildCitationPrefill` / `planSelectiveCapture` — citation metadata plus a note that Wayback
   SPN2 is wired on `capture-backfill --wayback`, not on intake.
3. `prepareLeadIntake` (`intake.ts`) — real BB-029 quarantine intake plus a real BB-044 draft
   research case.

Use `--commit` when staging is authorized; it requires the configured Postgres operator store.

**Do:** read `fetch.reason` and explain a denial (`dns_answer_not_public`, `malware_indicator`)
instead of retrying around it; use the owner's own words for `--description`; report back
`submissionId`/`researchCaseId`.

**Never:** fetch the URL yourself and paste content in (bypasses BB-030); `--commit` without
explicit go-ahead; treat a completed call as published (it only reaches `state: 'candidate'`);
hand-build a `SubmissionInput`/`ResearchCaseRecord`.

---

## capture-backfill

**When to use:** snapshot cited URLs into `evidence.source_captures` (source identity, content hash, and any permitted text),
optionally secondary-anchor them at Wayback via Save Page Now.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill \
  --commit --max-captures 25
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill \
  --commit --wayback --max-captures 25
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill \
  --commit --wayback --max-entities 20
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill \
  --url "https://example.gov/reviewed-citation" --commit --wayback \
  --preservation-decisions decisions.json
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill \
  --commit --max-captures 25 --after-url "<nextCursor>" \
  --inventory-fingerprint "<inventoryFingerprint>"
```

Safe by default (inventory + coverage JSON, no fetch, no write). `--commit` fetches through the
SSRF-safe path and writes capture rows. `--wayback` POSTs each **successful** local capture to
`web.archive.org/save` (SPN2) through `packages/domain` Wayback client + the operator-cli
`SafeHttpClient` port. Snapshot URL lands on `source_captures.storage_object`. Keys live in
1Password item **Internet Archive** (Personal vault); inject with `run-with-dev-secrets`. If
`INTERNET_ARCHIVE_ACCESS_KEY` / `INTERNET_ARCHIVE_SECRET_KEY` are unset, SPN is skipped and
local capture still runs (`wayback.status: skipped_no_credentials`).

Every report includes the complete normalized inventory count and fingerprint. URL traversal is
sorted; bounded reports return `nextCursor` while `hasMore` is true. Pass that cursor as
`--after-url` and the prior fingerprint as `--inventory-fingerprint` so inventory changes fail
closed instead of skipping new earlier URLs. `--url` selects one explicitly reviewed cited URL and
fails if it is absent from the inventory; it cannot be combined with count, entity, or cursor
batching. A commit with no explicit URL/count/entity bound defaults to 25 captures. Dry-run still
reports the entire inventory and performs no fetch.

Do not treat the 25-URL commit default as permission to archive unreviewed sources. Prefer an exact
reviewed `--url` or an explicitly bounded batch. The repository defines a daily `source_fetch`
policy, but the capture-backfill request path does not currently charge a durable counter to that
policy; see [`capture-completeness-ops-bar.md`](./capture-completeness-ops-bar.md). Failed local
fetches still do not mint SPN jobs.

**Availability lookup (read, not save).** Under `--commit`, the lane asks
`archive.org/wayback/available` what Internet Archive already holds at two points: after a local
safe-fetch fails, and, with `--wayback` on, before minting a new SPN2 capture. A URL we cannot
read ourselves (a PDF, a robots block, a dead host) is the likeliest to already have a snapshot,
but an availability snapshot never satisfies a new content revision's SPN2 anchor. The current
revision is keyed by its content hash and receives its own anchor attempt. Availability metadata
is recorded separately as `waybackAvailabilityUrl` on `retrieval_events.detail`, and on
`source_captures.storage_object` when a capture row exists, tagged
`waybackAvailabilitySource: availability-lookup`. It needs no credentials, so it runs whether or
not SPN keys are set. A miss is a recorded skip, never a failure: the row carries
`waybackLookupStatus: miss` with a reason. Counts land in the report under `waybackLookup`
(`attempted`, `found`, `missed`, `recoveredAfterFetchFailure`). The lane does not apply a
`wayback_swap` to public citations;
`citation-link-health-sweep` owns that for stored pointers.

**Never:** raw `fetch` to archive.org; fabricate a Wayback URL when SPN fails or when a lookup
misses; treat `--wayback` without `--commit` as a live save (dry-run only reports
`wayback.status: planned`, and makes no lookup request either).

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
`--catalog-from=postgres` to join the live catalog.

```bash
OPERATOR_CLI_PRIVACY_PEPPER=dev node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts editorial-run \
  --subjects /tmp/subjects.json --catalog-from=postgres --provider mock \
  --operator-id "$USER" --session-id "research-$(date +%s)" --identity-source cli
```

Providers: `mock` (default), `openrouter`, `ollama`, `hybrid`. For `ollama`/`hybrid`, point
`OLLAMA_BASE_URL` at an explicitly configured endpoint. No personal host is assumed. `enrichment-run` is the same judge, result kind `enrichment.run.v1`.

Use `--commit` when staging is authorized. It writes quarantine `editorial_packet`
proposals (may open draft research cases). There is no `--publish`/`--promote`.

**Catalog reconciliation:** load the live catalog with `--catalog-from=postgres`. Name or
embedding similarity proposes an identity match; it does not authorize a merge.

**Prose links:** summaries use `[[ent_id|Display Name]]` so `LinkedProse` renders `EntityLink`s.

**Never:** call promotion gates or release activation; treat LLM confidence as publication
authority; skip `validationIssues` — surface them to the owner.

### backfill-entity

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
logging: none yet (see "Conventions" above; tracked in the research execution backlog).

### prose-run (short-form prose)

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

## enrich-entity

Assess a released entity's evidence deficits before drafting prose. The default reads and plans.
Supply a unique `--run-id` to compile a bounded manifest, and `--output plan.json` to inspect it.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts enrich-entity \
  --entity-id ent_example_001 --target-maturity corroborated --run-id unique-run --output plan.json
node --conditions development --import tsx packages/operator-cli/src/bin.ts enrich-entity \
  --entity-id ent_example_001 --run-id another-unique-run --preservation-decisions decisions.json \
  --worker-id researcher --max-tasks 3 --commit
```

Committed execution uses `research-work` for search, rights-scoped capture and an exact-source
inventory. Index retained text separately with `research-index` before review. The execution plan
prioritizes a contradiction query and records needs that exceed the available budget. It does not
approve claims or publish. Missing source rights, unavailable providers and unfunded questions
remain visible. Resume with `research-work --run-id` rather than reconstructing the immutable
manifest with another `enrich-entity` invocation.

The reported `maturity` and the plan use canonical reviewed evidence. An assignment counts only
when it supports the current accepted claim version, has an exact selector into an active indexed
passage, retains a current public text-retention decision, carries a reviewed lineage cluster, and
is covered by a later independent artifact approval. The output also reports
`releasedProjectionMaturity` as the conservative citation-only baseline and lists the assignment
ids admitted to the reviewed assessment. Acquisition by itself therefore leaves maturity
unchanged; rerunning this read after a separate authorized review derives the new state without
writing a hand-set maturity value.

`attach-evidence` remains proposal-only. The operator CLI cannot create accepted assignments or
call `research.approve_artifact`; authenticated admin/publication review owns that boundary.

**Which path to use when:**

- Nothing captured yet, or you don't know what's missing → `enrich-entity` first. It tells you
  the deficits and gives you leads to chase (resolve and fetch them through the normal safe-fetch
  path — `research-intake` / `attach-evidence` / `register-source` — before treating anything a
  query returns as a source).
- Evidence is already captured (`research.entity_enrichment.status = 'captured'` — the only
  status `fetchEnrichmentSubjects` will pull) and the record just needs that evidence turned into
  cited public prose → the prose-only path:
  use `packages/ops-data/scripts/session-enrich-prepare.ts` to prepare inputs and
  `session-enrich-apply.ts` to validate externally supplied answers, or use the metered
  `packages/ops-data/scripts/enrich-entities-llm.ts` path or the operator CLI verbs immediately
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
  --operator-id "$USER" --session-id "research-$(date +%s)" --identity-source cli
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

Runs an explicit source batch and optionally extracts evidence-attached proposals. It does not
create ThemeImpactPackets automatically. Packet assembly and review are described in
[`theme-impact-packet-system.md`](./theme-impact-packet-system.md).

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts harness-run \
  --theme 'Evidence provenance standards' --url https://www.w3.org/TR/prov-overview/ \
  --max-subjects 1 --max-relations 0

node --conditions development --import tsx packages/operator-cli/src/bin.ts harness-run \
  --theme 'The research question' --subjects /path/to/source-records.json \
  --enrich --provider openrouter --model '<chosen model>' --max-subjects 10 --max-relations 10
```

`--subjects` is an array of `HarnessSourceRecord` objects from the kernel schema. Each has
`id`, `connectorKind`, `title`, `description`, `cites`, and `rawRecord`; location fields are
optional. Supply real source text with its URL, never a fabricated receipt. Model memory and
search blurbs are not source text. Connector labels and the question can describe any domain.
`--metro` is optional context. This path does not read the catalog or resolve identity by name.

Adapters are explicit: `--connectors nps_network_to_freedom --nps-csv <file>` parses supplied
CSV; `--connectors dpla --dpla-json <file>` parses supplied DPLA records. Neither makes an API
request or inserts examples. `--connectors web_search` uses approved routing then independently
fetches leads; `--query` overrides its query. Missing adapter input fails.

Limits are subjects 1–100 (default 25), relationship model calls 0–100 (default 25). Deferred
subjects are counted. These bound batch work, not dollars: durable case-wide cost enforcement
remains incomplete. `--enrich` invokes the chosen provider; a mock is for testing only. The
harness requires exact schema output and quote/URL attachment. Invalid raw output is returned
with its failure for quarantine; it is not repaired or replaced with default values.

`--commit` stages successful relationship proposals in quarantine with their evidence.
It does not commit extracted claims, approve a relation, or publish. Numeric confidence is
labeled an uncalibrated self-report and cannot admit an edge. Save stdout explicitly when a
file artifact is wanted. Use `--progress-path` for progress records.

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
alternative persistence path). Precision policy (no LLM, ever): street number → `institution` (≤150m
drift); named campus/place → `campus` (≤500m); neighborhood/district → `neighborhood`
(≤1600m); city only → `city`, do not sharpen. See also
[`docs/security/location-precision-standard.md`](../security/location-precision-standard.md)
for the full NRHP-derived precision tier standard.


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

### graylist read path

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts graylist-read \
  --limit 20 --json
```

Reads `submissions.intake_items` (Postgres) where `status = 'quarantined'`, newest first,
via `getOpsPostgresPool`. This is a partial read path: it covers quarantined intake items
only. Low-confidence discovery candidates (the discovery lane writes them to Postgres through
its own quarantine gates, see `docs/runbooks/data-ingestion-methodology.md`) are not reachable
from this command yet; triage those in the admin console. The retired submission inbox
and `discoveryCandidates` collections, and the admin console fixtures that described them, no
longer exist.

### quarantine-triage (LLM-assisted)

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts \
  quarantine-triage --limit 200 --provider openrouter --commit \
  --operator-id "$USER" --session-id "$(date +%s)"
```

Judges each `submissions.intake_items` row with an LLM (`mock`/`openrouter`/`ollama`/`hybrid`,
see `llm-provider.ts`) into `case` / `reject` / `spam`, then downgrades anything below
`--confidence-threshold` (default `0.6`) to `needs_human` and leaves it quarantined untouched.
This is a lightweight triage pass, not the full editorial/enrichment harness: a `case` decision
only opens a bare draft research case (`research.cases`, `state: 'candidate'`) so it enters
the normal research pipeline actual sourcing/enrichment still happens later via
`editorial-run`/`enrichment-run`. Safe by default (prints JSON only); `--commit` is required to
write. Every decision including `reject`/`spam` is logged to `audit.events` with the
model's rationale. Never writes `canonical.*` or evaluates a promotion gate see
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

The seed is read from `canonical.entities`. The row's `identifiers` must carry a Wikidata
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

`--commit` opens a transaction, records a `research.source_program_runs` row
(`wikidata-network-expansion`), and inserts `research.landscape_candidates` rows with
`lane = 'wikidata'`, `research_lane_only = true`, `status = 'pending'`. Output becomes
`{ verb, entityId, depth, status: "staged", candidateCount, stagedCount, seed }`. Nothing
reaches `canonical.*`: `entity-network-expansion.test.ts` asserts the staging function has
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
| `.claude/skills/blackstory/intake-review` | Screen incoming leads, corrections, and mail before they are ordinary work |
