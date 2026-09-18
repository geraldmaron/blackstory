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
GCS URL returns HTTP 403. This is an unresolved source/object gap, not a successfully recovered
229th object. The private backups are retained outside Git. Recovery targets and production failover have not
been established by these local timings.

Active-release coverage is materially incomplete: 12,180 cited claims use 7,566 distinct URLs,
while the 69 capture rows cover 14 source-item URLs with no overlap against those release citations.
No production capture or retrieval row currently has a Wayback pointer. Implemented preservation
capability is not completed preservation of the published corpus.

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
reserved upper bounds, cumulative reservation was **$0.00255264**, below the authorized $0.25.
The earlier charges are not independently known; failed credential reads made no provider calls.

Hybrid SQL retrieval measured precision@5 **0.23**, recall@5 **1.0** and MRR **0.975**. It also
retrieved a forbidden document on **0.55** of queries, versus **0.10** lexically. This is a useful
recall signal and a strong reason to retain strict identity, entailment and edge review. It does
not justify automatic assertion admission. Exact and approximate modes returned identical results,
but both actual plans used sequential scans: this tiny corpus provides **no HNSW recall evidence**.
The artifact includes input hashes, query-level outcomes, SQL plans and cleanup counts; all six
classes of temporary evaluation rows were removed. The successful OpenRouter pilot does not
verify the corrected Gemini adapter against its live service. The reusable runner accepts prior
spend and call counts as inputs; historical attempt details belong to the recorded artifact.
Entailment inputs are validated before any provider call.

Entailment predictions are frozen agent decisions, not a paid model comparison. The retrieval path
category measures retrieval of supporting documents, not end-to-end relationship extraction.
Measurement-only reports use `qualityAdmission: not_evaluated`; zero measurement thresholds
cannot produce a misleading quality-pass flag. No probability calibration, resolver false-merge
rate, human-adjudicated quality threshold or population-level quality claim is supported.

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
Check: Local CI mirror, Node 22
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --skip mobile
Result: fail, followed by affected-lane rerun
Observed: install, packages, Python, contract/security/a11y, coverage, build/typecheck, E2E harness, governance and security-policy passed. Formatting and one HTTP app test failed. Fixture formatting was corrected; the HTTP case passed after workspace build.

Check: Failed local lanes after corrections
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-apps
Result: pass
Observed: both lanes passed; web reported 2,575 passes and one intentional skip.

Check: Mobile static and unit gates
Command: cd apps/mobile && fnm exec --using=22 -- npm run format:check && fnm exec --using=22 -- npm run typecheck && fnm exec --using=22 -- npm run lint && fnm exec --using=22 -- npm test -- --ci
Result: pass
Observed: format, both type projects, lint and 167 suites / 1,275 tests passed. Native Release proof remains deferred because the installed Xcode license is unaccepted.

Check: Real HTTP entry points against the production-shaped restore
Command: E2E_BASE_URL=http://127.0.0.1:3048 CI_REQUIRE_E2E=1 fnm exec --using=22 -- pnpm test:e2e
Result: pass
Observed: root and cold Explore HTTP checks passed; the absent-URL behavior test skipped as designed.

Check: Escaped source semantics
Command: inline TypeScript AST comparison against HEAD, then tracked text-file NUL scan
Result: pass
Observed: six mechanical source edits were AST-equivalent; the final 4,532 tracked text-file scan found no literal NUL characters.

Check: Final package and app lanes after preservation, retrieval and graph changes
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane unit-js-packages --lane unit-js-apps
Result: pass
Observed: both lanes passed with local network permission. The sandboxed run had listen EPERM errors; it was not treated as a pass. The coverage lane passed separately at 93.62% lines.

Check: Final build and type checks
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane build-typecheck
Result: pass
Observed: all workspace builds and type checks passed in the final selected lane.

Check: Evaluation provider contract
Command: fnm exec --using=22 -- node --conditions development --import tsx --test scripts/gold-corpus/openrouter-evaluation-embedding-provider.test.ts
Result: pass
Observed: four mocked-boundary cases passed for ordering, dimensions, model identity and usage validation; no additional paid call was made.

Check: Final delivery validation after comment cleanup
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-packages --lane unit-js-apps
Result: pass
Observed: validate, package tests and app tests all passed. The final comment pass also preserved comment-free syntax across 250 TypeScript/CSS files; ten additional web test files changed diagnostic text only. Six source-escape edits preserve decoded string values.

Check: Standalone evaluation utility types
Command: fnm exec --using=22 -- pnpm exec tsc --noEmit --allowImportingTsExtensions --skipLibCheck --module nodenext --moduleResolution nodenext --target es2022 --strict scripts/gold-corpus/evidence-retrieval-pilot.ts scripts/gold-corpus/openrouter-evaluation-embedding-provider.ts
Result: pass
Observed: corrected callback receipt typing; standalone strict compilation passed. Duplicate entailment IDs and an occupied output path were also rejected before database/provider access in local CLI probes.

Check: Current security authority
Command: fnm exec --using=22 -- pnpm --filter @repo/testing test; fnm exec --using=22 -- pnpm --filter @repo/testing typecheck
Result: pass
Observed: 123 tests passed, four were skipped, zero failed; typecheck passed. Ajv 2020 validated corpus v2 against the strict JSON schema, and the missing-reference negative case passed.

Check: Staged delivery secrets and whitespace
Command: gitleaks dir /tmp/blackstory-staged-secret-scan --config gitleaks.toml --redact --no-banner; git diff --cached --check
Result: pass
Observed: the index export includes only reviewed delivery paths; no secret or whitespace findings. Private database dumps, object backups, credentials and scratch files remain outside the index.

Check: Final static validation
Command: fnm exec --using=22 -- pnpm validate; fnm exec --using=22 -- pnpm typecheck; fnm exec --using=22 -- pnpm format:check
Result: pass
Observed: boundaries, entity visibility, lint, local governance, workspace types and formatting passed. Remote governance was skipped by the command's default policy.

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
  not executed. This intentional transfer requires an explicit finding disposition.
- Alert 328 follows selected benchmark queries into the JSON body sent to the fixed
  OpenRouter embeddings endpoint. The runner requires explicit provider, model and cost
  arguments and uses the selected corpus, not a filesystem crawl. This is the requested
  embedding operation. The alert does not trace local file bytes into authorization headers.

The exact SARIF source-to-sink paths and the official CodeQL query definitions were read.
`fnm exec --using=22 -- node --conditions development --import tsx --test
scripts/gold-corpus/openrouter-evaluation-embedding-provider.test.ts
packages/ops-data/scripts/backfill-visit-from-wikidata.test.ts` passed all ten cases.
These tests establish provider request shape and parsing behavior; they are not live
provider calls or a complete filesystem adversary test. Intentional-transfer findings
remain open pending operator disposition. No security rule is suppressed or disabled.
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
- Residual risk: production cutover, approved recovery targets, the missing Dunbar media object, Archive completion and representative-scale quality evidence remain explicit.
- Commit-and-PR: scoped signed commits on `codex/research-framework-reconciliation`, one authorized draft PR into staging, reviewed index and staged-file secret scan. No merge or production release follows from local checks. Ordinary remote checks are reported in the PR delivery record.
