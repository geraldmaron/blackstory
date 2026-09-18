# Research framework audit evidence

Engineering verification record, observed 2026-09-18. The maintained method is
[Research framework](README.md); [Architecture](../architecture.md) owns authority and the challenge
procedure. Beads epic `repo-91sqj` owns execution status. This record replaces superseded intermediate
results rather than accumulating competing completion claims.

## Outcome and release boundary

The reusable kernel, durable execution ledger, source capture, passage retrieval, relationship
proposals, review gates and manual worker entry points are implemented. Black history is a domain
profile; the same loop has acquired EPA wetland sources. Research cannot publish. No Firebase,
Firestore or Corsair runtime is required, and no research timer is enabled in the inspected accounts.

This remains a draft release candidate. The database and application changes are incompatible with
the currently deployed schema names. Production still uses `bb_*`; no production mutation, merge or
cutover has occurred. Native iOS Release verification is deferred by the operator. A passing build
or preview does not prove production migration, reviewed graph coverage or research quality.

## Decisions challenged

| Choice | Strongest failure and alternative | Disposition |
|---|---|---|
| Extend the existing kernel | Product coupling can make reuse superficial. Alternative: replace the engine | Accepted with controls: explicit profiles, shared TS/Python schema and second-domain execution; no second framework |
| Postgres graph and vectors | Filters can reduce approximate recall; graph expansion can exhaust a budget. Alternative: separate graph/vector services | Accepted pending representative-scale measurements; exact baseline, query plans, bounded traversal and model/hash isolation |
| Semantic candidate discovery | Similar names or topics can invent identity and relationships. Alternative: lexical-only retrieval | Accepted with controls: similarity proposes; exact source selectors and independent review establish assertions |
| Institutional source preference | Custody does not remove exclusion, copying or archival silence. Alternative: equal source weights | Claim-relative fitness, lineage checks, community/oral/Black press discovery and explicit negative-case searches |
| Prefix removal | Old clients, SQL function bodies and JWT claims can fail together. Alternative: compatibility aliases | One coordinated schema/auth/client cutover; no alias views or dual writes; restored-data rehearsal before release |
| Public relationship shortcuts | A stored connection can borrow unrelated evidence. Alternative: leave old edges visible | Require the exact directed predicate, target and cited claim throughout public graphs and record chains |
| Preservation | Metadata or an old Wayback snapshot can masquerade as saved bytes. Alternative: URL-only citations | Distinct raw/extracted hashes, explicit rights decisions, historical availability pointers and revision-keyed resumable saves |
| Automated continuity | Timers create unbounded work and cost. Alternative: scheduled campaigns | Durable leases and headless workers retained; scheduling capability exists without active timers |

## Reconciled implementation

- Removed fabricated ordinary harness inputs, permissive extraction repair, model-score promotion,
  name-prefix identity resolution, copied seed lifespans, lost predicates and lost intermediate hops.
- Immutable manifests, bounded attempts, dependencies, reservations, terminal reasons and proposal
  artifacts survive separate CLI processes. Built-in workers and external model workers share the ledger.
- Evidence selectors bind a source item to an observed capture origin. Byte deduplication cannot
  change source attribution. Reviewed inputs and membership are immutable.
- Passage retrieval combines full text and model-pinned vectors through reciprocal rank fusion.
  Expired, withdrawn, mismatched-model and changed-text passages cannot be used.
- Retention erases captured text and dependent research payloads. Storage deletion uses the API and
  checks both origin references and older capture-row references at inventory and deletion time.
  Malformed references block deletion. Native file bytes are not inferred from a database hash.
- Save Page Now jobs identify URL plus fetched content revision. Historical availability never
  satisfies a request to save the current page. Uncertain submissions require reconciliation;
  known job IDs resume without another POST. Completion is not proof of byte equality with a
  source that may have changed between the local fetch and the Archive fetch.
- The shared Gemini adapter preserves one vector per input for embedding-2. An array of texts is
  one multimodal input for that API; sequential per-text calls preserve order and bound concurrency.
- Runtime/auth contracts describe Vercel public/admin surfaces and Supabase staff sessions. Optional
  GCP manifests no longer claim deployed IAP, Armor, WIF, queues or private service identities.
  The security catalog points to existing implementation and architecture files rather than
  retired tracker codes; its validator rejects missing repository references.
- Broken recovery commands and simulated passing recovery evidence were removed. Launch recovery
  requires an executed restore and a verifiable log. The launch decision remains `NO_GO`.
- Literal NUL source characters were replaced by equivalent string escapes. Active scripts use the
  responsibility schemas. Rewritten comments describe behavior and constraints rather than session history.

## Database and storage evidence

The configured production source was read without mutation. It held ten `bb_*` namespaces,
133 application tables and 412,140 exact rows on Postgres 17.6. A consistent application snapshot
was exported to a private local dump (90,198,939 bytes). The isolated restore matched all table
counts and stable row hashes, with 467 constraints, 342 indexes, 18 functions and no invalid
constraints. Production authentication data was not copied; a synthetic staff account exercises
role migration and authorization. Object recovery is a separate check.

The migration ledger contains 61 deployed versions. Each now has exactly one local version-matched
file. All 38 stored SQL bodies match under a SQL-aware lexical comparison; 23 history rows have
no stored SQL body, so byte-equivalence cannot be established. Seven live-only files were recovered.
The deployed NULL name for version `20260908120000` cannot be represented by a normal descriptive
filename; its version matches. No migration-history repair was used.

An explicit bootstrap supplies prerequisites for the historically misordered first eight rows.
It is a no-op on complete existing installations and refuses partial/mixed namespaces. The actual
CLI dry run rejects this earlier version by default; upgrades must explicitly use `--include-all`
and inspect the plan. Both complete 75-file clean installation and the 61-to-75-version upgrade
from the original production dump passed with `supabase db push --include-all`. All 133 original
table counts remained unchanged; all 132 comparable common-column hashes matched. The remaining
original table, `research.model_invocations`, was empty before and after its intentional column
change. Six tables were added, including 14 evidence-linked `capture_origins` rows; no origins were
inferred for the 55 captures without a source-item link. Both databases passed
`supabase/tests/research-kernel.sql` and a final `db push --dry-run --include-all` reported up to date.
Final state: ten current schemas, zero old schemas, eleven generated projection columns and no
invalid constraints. Unrecorded generated-column and redirect changes are reconciled by forward
migration `20260918154322`, which validates existing expressions and refuses mixed column states.
Do not edit applied history to introduce new behavior.

Storage inventory found 58 distinct referenced raw objects, all present, totaling 16,595,885 bytes.
All were downloaded to a private backup, restored to an isolated private bucket, and read back with
matching downloaded-byte hashes. All 116 anonymous access probes were denied; temporary restored
objects were removed after verification. Fifty-five extracted-text objects do not share the raw
source digest stored in their capture row. Historical writer `575e1efd` confirms that safe-fetch
hashed raw response bytes while the Storage sink uploaded extracted text under that raw hash.
The original raw bytes cannot be reconstructed from those text snapshots.
The public-media bucket contains 242 objects (509,384,251 bytes). Scanning 85 projection/artifact
JSON and text columns found 229 legacy GCS media references: 228 map to existing Supabase objects (457,165,770 bytes), one does not.
All 228 available referenced media objects were downloaded, restored into a private local bucket
and read back with identical hashes and sizes; 456 anonymous access probes were denied, and the
temporary bucket was removed. The missing object is the Dunbar school primary image; its original
GCS URL denied public access; an authenticated object lookup confirms HTTP 404. No authentic
replacement exists in the recovery set. Its stale published reference requires a corrected
release and rebuilt artifacts; it is not a successfully recovered 229th object. The private backups are retained outside Git. Recovery targets and production failover have not
been established by these local timings.

A separate local Dunbar correction cloned the release, removed the unavailable media reference,
built a 4,210-entry manifest, signed it with a throwaway P-256 key, verified the persisted signature,
and activated it through `publication.activate_release`. The previous release became superseded
and one activation audit event was recorded. Source release hashes remained unchanged. The new
release retained 4,210 entities and search rows, 12,180 citations, and Dunbar’s four claims and one
related record. No production signature, upload, cache purge or activation occurred; this verifies
the correction mechanism, not live delivery. Production signing configuration and a complete timed
Auth/database/object recovery remain cutover prerequisites. A prepared complete logical recovery
runner has not exported production Auth or Storage metadata: automatic approval review requires
explicit permission for the sensitive Auth records. The existing application and object checks
remain component proofs, not a matched-cutoff full recovery.

Preservation coverage is materially incomplete. The production snapshot has 12,180 cited claims
across 7,566 distinct entity URLs; packets contribute 202 references
across 32 URLs and articles 391 references across 338 URLs. The normalized all-surface inventory
contains **7,913 distinct URLs**. The 69 pre-existing capture rows link to 14 source-item URLs
with no overlap against current entity citations. No production capture or retrieval row has a
Wayback pointer. Capture count, citation delivery coverage and distinct-source preservation
coverage have separate denominators.

A bounded local CLI pilot selected two actual article citations: the NARA Freedmen’s Bureau guide
and the NPS 1860 St. Louis slave-schedule explanation. Source-specific decisions followed opened
NARA and NPS reuse policies; retained copies are private extracted text, not the linked holdings,
embedded data rows, images or original response bytes. Both captures were retrieved from local
Supabase Storage with matching hashes and sizes (14,654 and 3,923 bytes); anonymous reads were
denied. `research-retrieve` returned source-bound passages with selectors for both sources.
An identical NARA capture deduplicated successfully. Two one-URL dry-run batches advanced the
cursor without network requests. Authenticated Internet Archive completion remains blocked on
credential access; no successful save is inferred from local storage or an availability lookup.

Publication attaches an Archive pointer only to its independently reviewed claim and exact
supporting capture revision, source item, URL and digest. The completed job's original and current
preservation decisions must both permit public archival access. A newer unrelated capture of the
same URL cannot replace that evidence. Every write in the incremental publisher requires an
unsigned release under a row lock; eligible origins and jobs are locked and checked again in the
write transaction. Changed eligibility aborts the publication. A completed remote save still does
not establish byte equality between the local capture and the Archive's separate fetch. Public
reads consume validated projections and never join private evidence storage.
The actual Place route and design-system source list were inspected in Chrome in both themes,
with separate archived/original links, an explicitly labeled capture date, visible keyboard focus
and no captured console errors. The Place fixture used the real loader, current schema contract,
public projection and source renderer. Original signed release rows stayed untouched; the
temporary unsigned release and jobs were removed and the local active pointer restored. Its
Wayback result was explicitly synthetic, so this proves local delivery, not an Archive save.
The persistent working database predates the final migration rehearsal; its empty job table was
temporarily conformed for this component check and restored afterward. The complete 75-file
CLI proofs used separate disposable databases, as recorded above.

## Research evaluation

The reusable [held-out corpus](../../packages/testing/src/gold-corpus/fixtures/heldout-evidence-retrieval.v1.md)
contains six opened primary pages, 20 retrieval questions and 14 entailment cases. It includes
rare people, aliases, synthetic OCR perturbations, indirect questions, a two-hop chain, conflicting
fields, missing evidence and a second domain. A separate agent authored provisional gold labels;
root predictions were frozen before reading those labels. This is not a human-adjudicated benchmark.

The actual lexical SQL baseline measured precision@5 **0.09**, recall@5 **0.45** and MRR **0.425**.
Exact-name and alias recall was 1.0; OCR, semantic, missed-entity and path categories were 0.
Forbidden-document retrieval occurred in 0.10 of queries. That is a candidate false-positive rate,
not an identity-merge rate. The frozen entailment pass matched 12/14 provisional labels and made
no false-support decisions; two disagreements concern boundary-sensitive labels.

The real [embedding pilot](../../packages/testing/src/gold-corpus/artifacts/evidence-retrieval-pilot-2026-09-18.json)
used OpenRouter `openai/text-embedding-3-small`, returning `text-embedding-3-small`, at 768
dimensions. The explicit normalized model mapping is allowlisted; arbitrary model substitutions
are rejected. Seven passages and 20 queries used 2,392 reported tokens and $0.00004784 in
provider-reported credit charges. Including two earlier failed-contract attempts at their full
pre-call byte-rate estimates, the cumulative budgeted estimate was **$0.00255264**, below the
authorized $0.25. This estimate was not an external billing cap; the successful provider receipt
is authoritative, and the earlier charges are not independently known. Failed credential reads
made no provider calls.

Hybrid SQL retrieval measured precision@5 **0.23**, recall@5 **1.0** and MRR **0.975**. It also
retrieved a forbidden document on **0.55** of queries, versus **0.10** lexically. This is a useful
recall signal and a strong reason to retain strict identity, entailment and edge review. It does
not justify automatic assertion admission. Exact and approximate modes returned identical results,
but both actual plans used sequential scans: this tiny corpus provides **no HNSW recall evidence**.
That historical provider run omitted a source-item allowlist during vector-mode fusion, so unrelated
local lexical rows could enter its rankings. Its semantic scores remain provenance for the pilot,
not current bounded quality evidence. The runner now scopes provider semantic retrieval to held-out
document source items and keeps deterministic mechanics padding in a separate namespace.
The artifact includes input hashes, query-level outcomes, SQL plans and cleanup counts; all six
classes of temporary evaluation rows were removed. The successful OpenRouter pilot does not
verify the corrected Gemini adapter against its live service. The reusable runner accepts prior
spend and call counts as inputs; historical attempt details belong to the recorded artifact.
Entailment inputs are validated before any provider call.

Entailment predictions are frozen agent decisions, not a paid model comparison. The retrieval path
category measures retrieval of supporting documents, not end-to-end relationship extraction.
Measurement-only reports use `qualityAdmission: not_evaluated`; zero measurement thresholds
cannot produce a misleading quality-pass flag. The original pilot did not measure identity merges. No probability calibration, human-adjudicated
quality threshold or population-level quality claim is supported; the later categorical and index
mechanics measurements below have their own explicit limits.

The [controlled index and categorical measurement](../../packages/testing/src/gold-corpus/fixtures/heldout-quality-measurement.v1.json)
uses 1,000 included deterministic-vector rows and 100 wrong-model rows. The approximate SQL bounds
candidates by distance before deterministic outer ordering. Default local planner settings selected
a sequential scan for the padding preflight; transaction-local planner controls then proved
`retrieval_passages_vector_idx` execution. Both actual source-filtered exact/approximate retrieval
plans preferred `retrieval_passages_origin_idx`. Fused source-document results matched on all 20
queries, with overlap 1.0 on 14 nonempty baselines and six empty baselines reported separately.
This is index-mechanics evidence, not raw ANN recall or semantic quality. Exact mode remains the
default. The runner isolates provider vectors and synthetic padding, scopes source candidates,
and records cleanup: 1,107 passages and associated temporary rows deleted, zero remaining rows
across six tables, with planner statistics refreshed afterward. No additional provider call or spending occurred. The raw current receipt is
hash-bound and earlier superseded local mechanics outputs are excluded from the maintained corpus.

Separate frozen identity/edge predictions were evaluated against independent provisional gold:
12 identity cases, zero false merges among four distinct-identity cases, 14 edge cases, zero
unsupported assertions among five unsupported cases, and one missed supported edge out of nine.
Repeated aliases overlap, source summaries are shortened/paraphrased, and labels are not human
adjudicated. These are categorical measurements of the recorded predictor, not a population
estimate or probability calibration. The publication boundary admits only exact independently
reviewed claims and emits `reviewBasis: independent_review`; arbitrary calibration-version strings
cannot return a numerical publication score. Numerical admission remains unavailable without a
trusted binding to reviewed held-out calibration evidence.

## Scheduling and provider inventory

Authenticated read-only checks found:

- Four historical GitHub scheduled workflows are `disabled_manually`.
- Vercel `blackstory` and `blackstory-api` have empty cron lists.
- GCP `black-book-efaaf` has no Cloud Scheduler jobs across the queried regions.
- The configured Supabase database has no `pg_cron` extension.
- The connected Cloudflare account has no Worker scripts, hence no Worker cron triggers.

This is an inventory of those accounts, not every machine or third-party account. No Corsair
connection, workflow dispatch or new schedule was made. Unrelated provider resources were not deleted.

## Verification

```text
Check: Complete non-mobile local CI mirror, Node 22
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --skip mobile
Result: fail, corrected in affected-lane rerun below
Observed: install, package/app tests, Python, contract/security/a11y, coverage, build/typecheck, E2E harness, governance and security-policy passed. Only formatting failed on hash-bound raw evaluation receipts; those emitted bytes are now explicitly excluded from Prettier.

Check: Final publication package and build gates
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-packages --lane build-typecheck
Result: fail in lint only, corrected below
Observed: package tests and all workspace builds/types passed. Domain 1,830, ops-data 1,153, operator 303 and testing 135 tests passed, with four intentional testing skips. Lint identified cleanup throws inside finally; cleanup now preserves both original and cleanup failures outside finally.

Check: Final static gate after cleanup error handling correction
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate
Result: pass
Observed: lint, boundaries, local governance and formatting passed. Standalone evaluation lint/types and the real pilot also passed after the correction.

Check: Public app regressions
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-packages --lane unit-js-apps --lane build-typecheck
Result: pass
Observed: all four lanes passed; web reported 2,582 passes and one intentional skip. This ran after the final UI changes and before the publication-only transaction corrections.

Check: Reviewed capture and withdrawal database regression
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --conditions development --import tsx --test packages/ops-data/scripts/lib/confidence.integration.test.ts
Result: pass
Observed: exact reviewed capture selected over a newer unreviewed same-URL capture; revocation between preflight and the locked recheck removed eligibility. Fixture writes rolled back. Independent code review confirmed the release lock spans all reconciliation writes and graph persistence respects the caller's transaction.

Check: Delivery secrets and whitespace
Command: gitleaks dir /tmp/blackstory-final-index-scan --config gitleaks.toml --redact --no-banner; git diff --cached --check
Result: pass
Observed: reviewed indexed delivery files contained no detected secrets or whitespace errors; private backups, credentials and local scratch evidence remain excluded from Git.

Check: Mobile static and unit gates
Command: cd apps/mobile && fnm exec --using=22 -- npm run format:check && fnm exec --using=22 -- npm run typecheck && fnm exec --using=22 -- npm run lint && fnm exec --using=22 -- npm test -- --ci
Result: pass
Observed: format, both type projects, lint and 167 suites / 1,275 tests passed. Native Release proof remains deferred because the installed Xcode license is unaccepted; expo-doctor did not pass that prerequisite.

Check: Real HTTP entry points against the production-shaped restore
Command: E2E_BASE_URL=http://127.0.0.1:3048 CI_REQUIRE_E2E=1 fnm exec --using=22 -- pnpm test:e2e
Result: pass
Observed: root and cold Explore HTTP checks passed; the absent-URL behavior test skipped as designed. The CI mirror's E2E harness without this URL is not substituted for this observed HTTP result.

Check: Escaped source semantics
Command: inline TypeScript AST comparison against HEAD, then tracked text-file NUL scan
Result: pass
Observed: six mechanical source edits were AST-equivalent; the 4,532 tracked text-file scan found no literal NUL characters. The comment pass also preserved comment-free syntax across 250 TypeScript/CSS files.

Check: Evaluation provider contract
Command: fnm exec --using=22 -- node --conditions development --import tsx --test scripts/gold-corpus/openrouter-evaluation-embedding-provider.test.ts
Result: pass
Observed: four mocked-boundary cases passed for ordering, dimensions, model identity and usage validation; no additional paid call was made.

Check: Final evaluation utility contracts and types
Command: fnm exec --using=22 -- pnpm exec tsc --noEmit --allowImportingTsExtensions --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --strict scripts/gold-corpus/evidence-retrieval-pilot.ts packages/testing/src/gold-corpus/heldout-quality-eval.ts packages/testing/src/gold-corpus/evidence-retrieval-cost.ts
Result: pass
Observed: strict standalone compilation passed.

Check: Evaluation integrity and empty-baseline metrics
Command: fnm exec --using=22 -- node --conditions development --import tsx --test packages/testing/src/gold-corpus/hybrid-retrieval-eval.test.ts packages/testing/src/gold-corpus/heldout-quality-eval.test.ts
Result: pass
Observed: 22 tests passed, including empty challenge classes, tampered/label-leaking inputs, receipt overruns and empty exact baselines.

Check: Corrected zero-provider-call pilot and cleanup
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- node --conditions development --import tsx scripts/gold-corpus/evidence-retrieval-pilot.ts --blind packages/testing/src/gold-corpus/fixtures/heldout-evidence-retrieval-corpus.v1.json --gold packages/testing/src/gold-corpus/fixtures/heldout-evidence-retrieval-gold.v1.json --entailment-predictions packages/testing/src/gold-corpus/fixtures/heldout-entailment-predictions.v1.json --quality-cases packages/testing/src/gold-corpus/fixtures/heldout-identity-edge-corpus.v1.json --quality-predictions packages/testing/src/gold-corpus/fixtures/heldout-identity-edge-predictions.v1.json --quality-gold packages/testing/src/gold-corpus/fixtures/heldout-identity-edge-gold.v1.json --quality-freeze-manifest packages/testing/src/gold-corpus/fixtures/heldout-identity-edge-freeze.v1.json --embedding-provider deterministic-evaluation --embedding-model mock-deterministic-embedding --max-cost-usd 0.25 --prior-reserved-cost-usd 0.00255264 --prior-provider-calls 3 --hnsw-padding-rows-per-partition 1000 --out /tmp/evidence-retrieval-hnsw-isolation-final-v4.json
Result: pass
Observed: controlled HNSW preflight executed; source-filtered plans used the origin index. The current hash-bound artifact records zero remaining rows in all six temporary tables. Earlier intermediate CLI failure incorrectly required HNSW on the source-filtered plan; that assertion was corrected, not counted as a passing run.

Outcome: Restored records remain readable and staff controls require a staff session.
Surface: Chrome /records, /entity/ent_martin_luther_king_jr_001 and /admin/switches.
Data: Restored 4,210-record active release and a synthetic local Supabase administrator.
Observed: records and real bibliography links rendered; unsigned staff access redirected to login; signed staff access showed the stored switch row. Notices were inspected in light/dark themes and keyboard focus was visible.
Verdict: proven locally for these reads and unsupported-edge removal. After the shared evidence gate was applied, the same MLK record retained its two claims and bibliography and withheld the previous 30 unsupported connections and chains, reporting “No linked records yet”. A temporary NPS-cited Mat Bransford → Nick Bransford → Mammoth Cave fixture rendered the exact two-hop chain in light and dark themes, with no invented dates or map precision. The fixture was removed. Positive outgoing, incoming and two-hop paths also pass the public-data regression tests.
```

The independent review used fixed head `f208a03f` against `a1b5ddb1`: all migration diffs and
repository-wide retired-reference/deletion scans, plus targeted implementation groups. It did not
read every line of every changed product/generated file. Subsequent fixes require their own
validation. Do not convert targeted review coverage into a claim of exhaustive line review.

## Security check disposition

The PR checks for `06c9d2a2` passed workspace, mobile, Python, dependency, secret,
policy and preview validation. CodeQL analysis completed successfully but its aggregate
check reported four changed-line alerts. These are distinct outcomes: completing the
scanner is not passing its findings gate.

- ACS metadata used a predictable file under the OS temporary directory. This is an
  actionable local file-safety defect, surfaced by a changed comment on existing code.
  Permanent metadata caching also lacked freshness semantics. Metadata is now parsed
  into memory on each run, and the default extract root is an unpredictable private
  directory. Reusing a downloaded extract remains supported. The metadata helper builds
  only official IPUMS URLs, rejects redirects and mismatched table identities, and uses
  the existing parser. This trades 28 small metadata requests per run for fresh schemas
  and removes the unnecessary disk-write boundary.
- CodeQL alert 327 follows public Wikidata SPARQL JSON into a cache file. The URL endpoint
  is fixed, the filename is derived from a batch hash, and publication uses an exclusive
  mode-0600 file inside `mkdtemp`, followed by atomic rename. The JSON is parsed as data,
  not executed. Disposition: accepted with controls. Public JSON caching is required acquisition behavior;
  the fixed origin, parsed-data use, private exclusive write and atomic rename constrain the transfer.
- Alert 328 follows selected benchmark queries into the JSON body sent to the fixed
  OpenRouter embeddings endpoint. The runner requires explicit provider, model and cost
  arguments and uses the selected corpus, not a filesystem crawl. This is the requested
  embedding operation. The alert does not trace local file bytes into authorization headers.
  Disposition: accepted with controls under the explicit public-corpus pilot and $0.25 budget
  authorization; arbitrary local files and unbounded calls are not authorized.

The exact SARIF source-to-sink paths and the official CodeQL query definitions were read.
`fnm exec --using=22 -- node --conditions development --import tsx --test
scripts/gold-corpus/openrouter-evaluation-embedding-provider.test.ts
packages/ops-data/scripts/backfill-visit-from-wikidata.test.ts` passed all ten cases.
These tests establish provider request shape and parsing behavior; they are not live
provider calls or a complete filesystem adversary test. These intentional-transfer findings remain visible in GitHub and do not require dismissal.
The reviewed controls address their actual data flows; no security rule is suppressed or disabled.
The focused NHGIS command
`pnpm --filter @repo/ops-data exec node --conditions development --import tsx --test
scripts/lib/lives-nhgis-ingest.test.ts` passed eight cases, including invalid destination
identifiers, malformed metadata and a different returned table. The command
`pnpm --filter @repo/ops-data typecheck:scripts` also passed. The first full package run
failed two unrelated socket tests under sandbox `listen EPERM`; that run is not a pass.
The complete affected CI lanes then passed with local socket permission:
`RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres
fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate
--lane unit-js-packages`. This includes the previously blocked socket cases.
No credentialed live NHGIS ingestion was performed. The current commit and final remote
check state are maintained in the PR delivery record.

## Primary sources consulted

Opened during this work; technical references inform decisions without proving conformance:

- [W3C PROV](https://www.w3.org/TR/prov-overview/) and [Web Annotation](https://www.w3.org/TR/annotation-model/): source identity, derivation and exact selectors.
- [pgvector](https://github.com/pgvector/pgvector/blob/master/README.md): hybrid retrieval, filtered approximate search and exact baselines.
- [NARA search guidance](https://www.archives.gov/research/catalog/help/search-tips), [FAIR](https://www.go-fair.org/fair-principles/) and [Oral History Association](https://oralhistory.org/best-practices/): retrieval tradeoffs, reuse, consent and context.
- [Wikidata statements](https://www.wikidata.org/wiki/Help:Statements): ranks, qualifiers and references.
- [Wayback availability](https://archive.org/help/wayback_api.php): a historical pointer does not create a capture.
- [NARA reuse policy](https://www.archives.gov/global-pages/privacy.html), [NPS disclaimer](https://www.nps.gov/aboutus/disclaimer.htm), [Freedmen’s Bureau guide](https://www.archives.gov/research/african-americans/freedmens-bureau) and [St. Louis 1860 schedule explanation](https://www.nps.gov/articles/000/united-states-census-slave-schedule-for-st-louis-county-1860.htm): exact-source preservation review and local capture pilot.
- [Supabase Storage](https://supabase.com/docs/guides/storage/schema/design.md): metadata inventory is separate from object operations.
- [OpenRouter usage accounting](https://openrouter.ai/docs/guides/guides/usage-accounting.md) and [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection.md): price caps and receipt limitations.
- [IPUMS NHGIS](https://developer.ipums.org/docs/v2/workflows/create_extracts/nhgis_data/): documented authenticated download destination.
- [Expo SDK 57](https://github.com/expo/expo/blob/sdk-57/packages/expo/CHANGELOG.md) and [Next.js connection](https://nextjs.org/docs/app/api-reference/functions/connection): dependency and rendering behavior.
- [EPA wetlands](https://www.epa.gov/wetlands/why-are-wetlands-important) and the corpus provenance file: opened source pages for portability and evaluation.

## Verification record

- Project inspected: schema, evidence, auth, projections and durable execution are scoped in “Reconciled implementation”.
- Reuse checked: existing kernel, source clients, capture sink, pgvector and job registry extended; repository, sibling utilities and installed tooling were searched before additions.
- Validation path run: exact commands and observed exceptions are recorded above; final-tree checks and their limits are recorded in “Verification”.
- Outcome observed: restored record and staff reads proven locally; unsupported relationship removal and a sourced positive two-hop chain proven in Chrome; actual Archive completion remains unproven.
- Surface inspected: both admin and graph themes, restored records, citations and staff redirect observed in Chrome.
- Diff reviewed: targeted independent review and migration equivalence completed; full raw-line review is not claimed.
- Residual risk: production cutover, approved recovery targets, production delivery of the rehearsed Dunbar correction, Archive completion and representative-scale quality evidence remain explicit.
- Commit-and-PR: scoped signed commits on `codex/research-framework-reconciliation`, one authorized draft PR into staging, reviewed index and staged-file secret scan. No merge or production release follows from local checks. Ordinary remote checks are reported in the PR delivery record.
