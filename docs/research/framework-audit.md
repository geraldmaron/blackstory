# Research framework audit evidence

Working engineering record. Scope: methodology, framework, skills, relationships, preservation,
providers, persistence, scheduling and operational authority. Observation date: 2026-09-18 UTC.
This records findings and challenge outcomes; [Research framework](./README.md) is the maintained
method, [Architecture](../architecture.md) governs changes, and Beads owns execution status.

## Recommendation

Finish and measure the existing evidence-first kernel and ledger before buying more model work
or introducing a graph database, vector service, orchestration framework, or another generic
research package. Black history remains a domain profile; prove reuse with a second domain.
Remove retired host launchers and contradictory instructions. Treat prefix removal as an atomic
migration and deployment operation, with no compatibility views or dual writes.

## Observed implementation and live state

A read-only transaction against the configured Supabase database returned:

| Observation | Result | Interpretation |
|---|---:|---|
| `bb_canonical.entities` | 4,232 | Canonical entity count, not released count |
| `bb_canonical.entity_embeddings` | 646 | Embedding rows; not a measured distinct-entity coverage ratio |
| `bb_evidence.source_captures` | 69 | Capture rows; not a citation coverage or full-page preservation ratio |
| `bb_research.model_invocations` | 0 | The canonical model ledger has no recorded invocations |
| `bb_research.frontier_tasks` | 0 | The canonical durable frontier is unused |

`information_schema.tables` exposed tables/views in nine `bb_*` namespaces (auth functions live
in another schema). These prefixes belong to schemas, not every table's name. A source search
found 526 files with `bb_*` references, including docs and migrations. Renaming only table names
or changing a SQL search path cannot reconcile this system.

The aggregate query was `SELECT count(*)` from the five tables above inside `BEGIN READ ONLY`,
with a ten-second statement timeout. No records or credentials were exported. Counts describe
that observation, not a permanent property. No production data was changed by this audit.

An isolated local Supabase/Postgres 17 rehearsal initially exposed duplicate migration version
`20260729200000`. The living-status constraint now has a unique migration version. The full
chain applied locally, and SQL ledger/authorization tests and claim-review integration tests passed.
The responsibility-schema cutover preserved 130 tables, 461 constraints, and 334 indexes in that
rehearsal. Production migration history and cutover remain unverified; no production migration
was applied. Checked-in schedule state cannot establish external account state. No Corsair
connection or new schedule was attempted.

## Findings and disposition

| Area | Evidence and strongest failure mode | Action / remaining limit |
|---|---|---|
| Fabricated harness inputs | CLI embedded NPS/DPLA example rows and invented URLs in ordinary runs | Removed. Explicit source files, source URL, or connector required |
| Structured extraction | Bridge stripped fences/comments, coerced fields and invented defaults | Strict kernel schemas and untouched invalid payloads; exact quote/URL checks |
| Confidence | Staging admitted edges above a model self-score threshold | Model edges remain quarantined regardless of score; no calibrated-probability claim |
| Identity | Harness matched catalog name prefixes, including ambiguous names | Removed automatic name resolution; explicit evidence/identifier resolution remains separate |
| Relationship loss | Wikidata deduplication kept the first predicate for each target QID | Distinct predicates and paths preserved |
| Chain corruption | Second hop lost its seed path; summaries could assert a direct seed→target relation | Intermediate endpoint, path and source predicate provenance retained |
| Lifespan contamination | Staging copied seed birth/death onto neighboring candidate fields | Removed; seed dates remain explicitly seed metadata |
| Unbounded traversal | Candidate cap applied after fetching a neighborhood | Request cap, cache, per-step limits, no redirects, timeouts and cycle rejection |
| CSV evidence loss | Separate simplistic parser split quoted archival descriptions at newlines | Reused one CSV parser across harness and bulk intake; escaped quotes preserved |
| Contradiction stop | Missing contradiction needs could vacuously satisfy the stop test | Required contradiction search cannot be met by omission |
| Host/scheduling drift | Host env sample, systemd/launchd scripts, broken gap-fill and overnight parity path | Removed. Manual dispatch/job capability retained; external timer state unproven |
| Duplicate schedule config | Cloud Scheduler mirror independently described different real/stub jobs | Removed mirror; TypeScript registry remains authoritative |
| Documentary authority | 2,500-line carryover mixed recovery history, stale routes and decisions | Replaced by concise current contract; architecture and research entry point own challenge procedure |
| Durable execution | Live audit found unused ledger tables | Implemented immutable manifests, leases, dependencies, cost reservation, proposal validation and invocation accounting. Built-in search/acquisition/synthesis and external-worker handoff resume across processes |
| Vectors | Entity vectors alone could not return exact supporting passages | Added authorized capture passage index, text/vector RRF and model/hash isolation. Real model recall and coverage remain unmeasured |
| Preservation | Shared bytes could erase source origin; SPN response loss could cause duplicate saves | Origin mapping, exact-source pointer checks, durable jobs, explicit rights decisions and retention disposal implemented. Actual archive-save completion remains unproven; run/proposal payload erasure and private Storage deletion verified locally |
| Publication confidence | Source-name and entity-wide heuristics could approve unsupported claims | Removed; each claim requires an exact current claim version, evidence selectors, confidence assessment, and independent review. Calibration quality still requires evaluation |
| Python parity | Generated types omitted schema constraints and root pytest skipped their tests | Models validate the shared schema before coercion; 24 shared fixtures plus nonfinite checks, included in root pytest |
| Portable profiles | Generic profile/schema, but Black history model roster and source rules dominate execution | Generic input proven; profile-bound durable execution and a second-domain source-review CLI run work; broad domain quality evaluation remains |
| MCP | Server exposes indicator/context read tools | Does not expose the complete research lifecycle; CLI is the actual headless front door |
| Wikidata semantics | “educated at” was rewritten as membership and reverse edges cited the wrong item | Preserve source predicates, ranks, qualifiers, references, exact statement endpoints and paths; deprecated statements excluded, uncertain years withheld |
| Source truncation | Direct harness URL input keeps a bounded excerpt, with full length/truncation metadata | Evidence chunk retrieval and missing-context recall must be evaluated |

Comment cleanup rewrote 452 identified comments across research, product and operator code.
Both batches preserved the comment-free TypeScript syntax trees before other code changes.
Descriptions retain failure modes and evidence limitations. Retired provider telemetry now uses
the actual client-header contract, without claiming authentication or replay protection. Removed
the duplicate person living-status field, unused theme allowlist and hardcoded Audre Lorde pilot
launchers; the parameterized expansion command owns that capability. Historical operational
memories that prescribed Firebase, Corsair or automatic runs were reconciled with current authority.

## Challenges resolved

**Replace the engine outright. Rejected.** The strongest argument is that partial integrations
and product coupling make reuse expensive. The alternative is to connect existing contracts,
source clients, ledger and provider ports and remove duplicate adapters. This has lower migration
risk and provides observable progress. Reconsider if a second-domain run still requires editing
BlackStory rules inside the generic kernel.

**Add a separate graph/vector platform. Needs validation.** Multi-hop retrieval can be expensive,
but no measured Postgres bottleneck or held-out retrieval baseline exists. First test normalized
edges, bounded traversal, text/trigram/identifier retrieval and pgvector with query plans and
recall measurements. Reconsider only with observed failure under representative load.

**Use semantic proximity to piece facts together. Accepted with controls.** It is useful for
recall. The failure is plausible but unsupported relationships, especially across same-name
people. Retrieval emits hypotheses; evidence entails edges; identity and each intermediate node
remain explicit. No automatic causal shortcut or score-based promotion.

**Institution-first evidence ranking. Accepted with controls.** Institutional records often have
stable custody and useful identifiers. They can also reproduce exclusion, misclassification,
copying and silence. Fitness is claim-relative; include community/oral/Black press sources and
record evidence-production context. Search and evaluation must sample the gaps institutions miss.

**Remove schema prefixes immediately. Accepted with controls.** Cleaner names benefit reuse.
The strongest failure mode is breaking function bodies, RLS/auth role lookup or PostgREST while
clients are already deployed. Rehearse schema/function/auth/client changes on a restored database,
compare constraints/counts, verify denied operations, and coordinate deployment. Applied migration
history remains history; new compatibility views and dual-write periods are rejected.

**Schedule for continuity. Rejected for current operation.** Durable state and explicit headless
execution provide continuity without an active schedule. Keep job definitions and resume semantics.
No new timer, model bill, or personal-host dependency is necessary to finish the engine.

## Execution order and cost controls

Execution is tracked in epic `repo-91sqj`. Its evidence-integrity and operating-authority children
cover this change. Reuse `repo-atya` for portable ledger execution, `repo-93p35.9` for executing
research needs, and `repo-e9yj` for causal/counter-literature assessment.

The next load-bearing gates are recorded in `repo-91sqj.3` (schema cutover), `.4` (hybrid retrieval
and ledger integration), `.5` (preservation), and `.6` (contract/calibration evaluation). They carry
acceptance criteria rather than repeating a roadmap here. Schema cutover can be rehearsed in
parallel with evaluation, but application changes must not deploy against the wrong schema.

Use one bounded proving cohort before broad acquisition: aliases/same-name records, two distinct
predicates, a multi-hop path, a copied source, a contradictory source, missing/OCRed evidence, a
community/oral source, a dead URL, and a second-domain case. Use deterministic checks first. Persist
query, fetch, token, retry and dollar counts before expanding the cohort. Compare cost per closed
need and accepted assertion, not output volume. Do not regenerate all embeddings or run paid
campaigns merely because a migration or prompt changed. Bulk work starts only when the bounded
pilot demonstrates the intended result. No paid model or archival-save request was made here.

## Primary research consulted

Opened during this audit; these are technical and methodological references, not claims that the
implementation already conforms to them.

- [W3C PROV overview](https://www.w3.org/TR/prov-overview/): entities, activities and agents provide
  interoperable provenance. Supports using existing run/activity/derivation contracts.
- [W3C Web Annotation](https://www.w3.org/TR/annotation-model/): quote/position selectors and source
  state. Supports exact evidence attachment to a captured revision rather than a bare URL.
- [Internet Archive availability API](https://archive.org/help/wayback_api.php): closest snapshot,
  timestamp, availability and status. An availability result does not create a new capture.
- [pgvector documentation](https://github.com/pgvector/pgvector/blob/master/README.md), retrieved
  through Context7: hybrid full-text/vector retrieval, iterative scans for filtered HNSW recall,
  and exact-search comparison. Supports measurement before buying a separate search service.
- [NARA catalog search tips](https://www.archives.gov/research/catalog/help/search-tips): phrase,
  wildcard and optional query expansion; increased recall can reduce precision. Supports multiple
  explicit retrieval strategies and recording search scope.
- [FAIR principles](https://www.go-fair.org/fair-principles/): reusable data needs identifiers,
  metadata, provenance and usage conditions. FAIR does not mean every source is publicly shareable.
- [Oral History Association best practices](https://oralhistory.org/best-practices/): consent,
  context, documentation, preservation and access. Oral testimony is situated evidence, not
  anonymous decoration or a source class to discard by default.
- [Wikidata statements](https://www.wikidata.org/wiki/Help:Statements): qualifiers, references and
  ranks are part of a statement. A simplified property→entity link is incomplete provenance.

## Additional challenge outcomes

**Source attribution under deduplication. Accepted with controls.** Identical bytes can have
several origins. Evidence selectors now require the exact capture/source-item pair; publication
loads that origin rather than guessing from a capture's single-source field. A foreign key rejects
unobserved pairs. The migration backfills only existing explicit source relationships and refuses
unresolved selectors. This is another precondition for production migration review.

**Capture disposal. Accepted with controls.** Source/capture/origin/passages/retrieval events commit
in one transaction. Withdrawal erases capture text and vectors and queues private object deletion.
Shared references defer removal; disposal tombstones prevent reuse of a deleted object key.
Uploading bytes still precedes database persistence, so interrupted or rejected acquisitions can
leave orphaned private objects. Explicit orphan reconciliation inventories objects older than 24 hours
and queues deletion through the Storage API. Withdrawals erase affected run manifests, task inputs,
proposal payloads, model responses and quarantine payloads under a run lock. Retention bounds the
execution deadline. Canonical reviewed claims, provider logs, exports, backups and public archives
still require separate withdrawal procedures; automatic acquisition refuses restricted content.

**Runtime homepage. Accepted with controls.** Next.js `connection()` defers catalog reads until
requests; a failed live read no longer silently substitutes seed pins. This adds request-time
rendering compute. A static release-artifact shell is the alternative and needs freshness evidence.

**Recovery. Accepted with controls.** Launch gating requires an executed Postgres restore report
with measured RPO/RTO, integrity, authorization, projection and storage checks and a hashed log.
A passing simulation fixture no longer proves recovery. A consistent-snapshot local dump/restore
matched 136 application tables, 183 rows and every table hash, with no unvalidated constraints;
authorization passed on the restored database. This is local rehearsal, not production recovery proof.

**Cost controls. Accepted with controls.** Embedding backfill now requires valid CLI item and cost
caps and retains estimated reservations after failed calls. Estimates remain distinct from actual
charges. Official Supabase billing documentation corrects the old three-Micro estimate to about
$45/month before usage/add-ons, identifies egress quotas as organization-wide, and confirms pooler
and Storage CDN egress are metered. No new service or paid work was provisioned.

## Validation evidence

The full local CI mirror ran with `fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging`.
Its package lane exposed a malformed assertion introduced while removing seed-claim recovery.
The assertion was fixed; `--lane validate --lane unit-js-packages` passed on rerun. All other full-run
lanes passed. Later affected-lane checks are recorded below; a green fixture is not production evidence.

Check: Local CI after cost-cap and workflow corrections
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-packages --lane build-typecheck --lane governance
Result: pass
Observed: all four selected lanes passed; the subsequent selector-origin change has additional checks below.

Check: Comment-only rewrite equivalence
Command: node /tmp/blackstory-apply-comments.cjs; node /tmp/blackstory-apply-extra-comments.cjs
Result: pass
Observed: 350 and 102 comments rewritten; TypeScript printer output with removeComments:true was identical before and after each batch, including type declarations.

Check: Final cleanup static and mobile lanes
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-packages --lane build-typecheck --lane mobile --lane security-static
Result: fail
Observed: validate and mobile passed. The sandbox denied localhost binds in package tests and font downloads during build; those lanes were rerun with the required permissions. security-static is not a lane name; the actual security-policy lane was run below.

Check: Final cleanup package and security lanes
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane unit-js-packages --lane security-policy
Result: pass
Observed: both selected lanes passed, including updated client-header telemetry, record schemas and production guards.

Check: Final cleanup build and typecheck
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane build-typecheck
Result: pass
Observed: the complete selected build/typecheck lane passed after allowing existing font downloads.

Check: Selector-origin contract parity
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-py --lane build-typecheck
Result: pass
Observed: all three lanes passed after the exact selector-origin change, before the subsequent comment/provider cleanup.

Check: Final domain and record fixtures
Command: fnm exec --using=22 -- pnpm --filter @repo/domain test
Result: pass
Observed: 1,838 tests passed with no failures or skips after removing obsolete nested living-status fixture fields.

Check: Final operator-data fixtures with local Postgres
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- pnpm --filter @repo/ops-data test
Result: pass
Observed: 1,131 tests passed with no failures or skips after the final fixture cleanup.

Check: Web package
Command: fnm exec --using=22 -- pnpm --filter @repo/web test
Result: pass
Observed: 2,572 tests passed, zero failures.

Check: Operator CLI with real local Postgres
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- pnpm --filter @repo/operator-cli test
Result: pass
Observed: 295 tests passed, zero failures/skips, including capture/disposal transactions and resumable execution.

Check: Operator data with exact-origin reviewed citations
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- pnpm --filter @repo/ops-data test
Result: pass
Observed: 1,131 tests passed, zero failures/skips. Review selected the explicit origin even when the capture's older source field named a different copy; an unobserved pair was rejected.

Check: Kernel contracts
Command: fnm exec --using=22 -- pnpm --filter @repo/research-kernel test
Result: pass
Observed: 34 tests passed, including the shared selector-origin validation cases.

Check: Isolated migration chain
Command: fnm exec --using=22 -- pnpm exec supabase db reset --local --workdir /tmp/blackstory-research-rehearsal
Result: pass
Observed: the entire fresh migration chain through 20260918070610 applied on local Postgres 17, including the exact selector/source-origin foreign key.

Check: SQL authorization
Command: docker exec -i supabase_db_blackstory-research-rehearsal psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/research-kernel.sql
Result: pass
Observed: authorization and research-worker publication/approval denial checks completed again after the final fresh migration chain.

Check: Live web E2E
Command: E2E_BASE_URL=http://127.0.0.1:3148 CI_REQUIRE_E2E=1 fnm exec --using=22 -- pnpm test:e2e
Result: pass
Observed: the live check passed; its complementary absent-URL behavior test skipped by design.

Check: Generated documentation
Command: fnm exec --using=22 -- pnpm docs:publish
Result: pass
Observed: GitHub Pages output rebuilt from apps/docs.

Check: Staged file secret scan
Command: gitleaks dir /tmp/blackstory-final-staged-scan --redact --config gitleaks.toml --no-banner
Result: pass
Observed: 1,023 staged file snapshots scanned, no leaks. A raw diff scan also sees removed public client keys and loses the existing path-scoped Beads allowlist; it is not the staged-tree result.

## Observed outcomes

Outcome: A worker can resume another domain's task across processes without conversational memory.
Surface: operator-cli research-run, research-claim, research-complete, research-status
Data: EPA “Why are Wetlands Important?” and a wetland-ecology profile; one exact paragraph, zero model budget.
Observed: separate CLI processes created, claimed and completed a local task; status retained its proposal, an open mandatory evidence need and publicationAuthorized:false.
Verdict: proven for the bounded external-worker protocol; broad research quality remains unmeasured.

Outcome: Readers see source links and honest evidence/location labels.
Surface: Local production-build homepage, records and place detail; light/dark themes.
Data: Three local records including a clearly labeled EPA verification record with no coordinates.
Observed: original EPA link, “Evidence grade: low”, no manufactured 0.40 score or independent-source count, no fabricated pin, and a correct missing-location label. Homepage used the local catalog. No horizontal overflow. Missing-record behavior was observed. Two console errors came from the locally absent Vercel analytics script.
Verdict: proven on the local browser surface; production remains unverified.

Outcome: Authorized staff can enter the workbench through Supabase Auth.
Surface: Local development browser /admin/login → /admin.
Data: Disposable local Supabase account.
Observed: corrected CSP allowed the configured development Auth origin and login succeeded. Production requires HTTPS and does not grant that origin allowance to public routes.
Verdict: proven locally; production credential rollout and JWT refresh remain deployment gates.

## Built-in execution and completion checks

`research-work` connects existing search, safe-fetch, capture/index and model ports to the same
immutable ledger used by external workers. It reserves every fetch and model attempt, applies
source-specific public-text decisions, and preserves unknown charges. OpenRouter requests bound
prompt/completion prices and disallow request/image charges, hidden provider fallback and data
collection. Deterministic runs produce a source inventory, never historical conclusions. Mixed
runs return an external lease to the caller and resume after `research-complete`. Enrichment
compiles deficits into this protocol; unfunded needs remain explicitly open.

Removed the unused unique-name entity reconciliation implementation, old mention overrides and
legacy tag splitting. Public mention edges require exact existing catalog IDs and a stable cited
claim naming the relationship predicate and target. Unrelated entity claims cannot stand in for
edge evidence. Opposite directed assertions remain distinct. The history graph no longer restores
seed relationships when proof is absent; release materialization requires explicit published and
accepted canonical edges with relationship evidence. This can reduce displayed edges until stored
records are reconciled during cutover. Unknown sites
are unknown sources; DOI, archive and JSTOR hostnames do not establish document type or peer review.
Evaluation rejects nonfinite scores and malformed labels, deduplicates results and counts missing
precision-at-k slots. These checks do not establish calibrated probabilities or measured recall.

Check: Full local CI mirror after worker integration
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging
Result: fail
Observed: every applicable lane passed except validate, which identified five inline type-import style errors; these were corrected.

Check: Affected CI lanes after type-import corrections
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-packages --lane build-typecheck
Result: pass
Observed: validate, package tests and build/typecheck all passed; final retention/workflow changes have an additional rerun below.

Check: Complete final migration chain
Command: fnm exec --using=22 -- pnpm exec supabase db reset --local --workdir /tmp/blackstory-research-rehearsal --yes
Result: pass
Observed: the dedicated disposable local stack applied every migration through 20260918132658, including run payload deadlines and orphan disposal.

Check: Final SQL authorization
Command: docker exec -i supabase_db_blackstory-research-rehearsal psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/research-kernel.sql
Result: pass
Observed: authorization and research-worker publication/approval denial checks passed on the fresh final schema.

Check: Worker and retention regressions against local Postgres
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- node --conditions development --import tsx --test packages/operator-cli/src/research-worker.test.ts
Result: pass
Observed: five tests passed with no skips, including mixed external handoff, withdrawn payloads and an expired abandoned manifest without artifacts. Database leasing also refused the expired run.

Check: Consistent-snapshot local restore
Command: fnm exec --using=22 -- node --conditions development --import tsx .cache/research-reconciliation/compare-restore.mts
Result: pass
Observed: a read-only repeatable-read transaction exported the pg_dump snapshot and source hashes; isolated restore matched 136 tables and 183 rows, with zero unvalidated constraints. Restore took 5.871 seconds locally; this is not a production RTO.

Check: Restored database authorization
Command: docker exec -i supabase_db_blackstory-research-rehearsal psql -U postgres -d blackstory_research_restore_20260918 -v ON_ERROR_STOP=1 < supabase/tests/research-kernel.sql
Result: pass
Observed: the restored local database retained the expected grants and publication denials.

Check: Actual local private-object deletion
Command: fnm exec --using=22 -- node --conditions development --import tsx .cache/research-reconciliation/storage-disposal-verification.mts
Result: pass
Observed: a temporary private Storage object was queued and deleted through the Storage API; a subsequent read returned not_found. The temporary bucket was removed.

Outcome: A headless worker acquires and indexes real evidence in two domains and resumes by run ID.
Surface: research-run, research-work, research-status and research-retrieve CLI commands.
Data: NPS Mary Ann Shadd Cary and EPA What is a Wetland, with explicit public-text decisions and zero model budget.
Observed: the Black history run resumed under a second worker identity; each run captured one real source, kept its mandatory need open and returned publicationAuthorized:false. Text retrieval returned NPS passages with source/capture IDs, offsets and hashes. Unconfigured contradiction search remained a limitation.
Verdict: proven for acquisition, resumption and exact-source retrieval; paid synthesis, semantic vector recall and independent historical conclusions remain unproven.

The temporary rehearsal programs and logs are local working evidence, not operational product tools.
Repeatable product tests live beside the worker; deployment recovery still requires production-shaped
inputs and the recovery report contract. No paid model, embedding campaign, Internet Archive save,
schedule or GitHub Actions dispatch was initiated.

Check: Local CI after final retention and workflow cleanup
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-packages --lane build-typecheck --lane governance
Result: pass
Observed: all four selected lanes passed. Subsequent relationship-proof changes are checked separately.

Check: Graph evidence gates and full affected CI
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-packages --lane unit-js-apps --lane build-typecheck
Result: fail
Observed: validate, packages and build/typecheck passed, including a real-database query that excluded unpublished, unreviewed and unsupported edges. Two app fixtures still expected seed edges and were corrected to carry exact cited relationship claims.

Check: Full app lane after fixture correction
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane unit-js-apps
Result: pass
Observed: all app tests passed, including positive map-line projection and negative missing-evidence cases.

Check: Final public documentation generation
Command: fnm exec --using=22 -- pnpm docs:publish
Result: pass
Observed: generated static documentation rebuilt successfully with access to the required font downloads. An initial sandboxed attempt failed to fetch fonts.

Outcome: Map relationship lines do not borrow unrelated citations or restore seed edges.
Surface: Explore view-model regression and local /explore?lines=1 browser attempt.
Data: Exact cited relationship fixtures plus a missing-proof case; three local public projection records.
Observed: full app tests verify both positive lines and empty missing-proof lines. Local HTTP returned 200, but the in-app browser rendered only the map shell without a populated map; no console error was reported.
Verdict: not proven visually for the final graph change; its database and application contracts passed. Recheck map rendering on the deployment candidate with a reviewed release dataset.

Check: Final fixture typecheck
Command: fnm exec --using=22 -- pnpm --filter @repo/web typecheck
Result: pass
Observed: TypeScript completed after the final graph test fixture corrections.

Check: Final staged-tree secret scan
Command: gitleaks dir /tmp/blackstory-delivery-staged-scan-l06wxuxv --redact --config gitleaks.toml --no-banner
Result: pass
Observed: 1,038 staged snapshots (8.78 MB) scanned with no leaks. The final tree has 1,290 changed paths; classification found 459 comment/mechanical-equivalent code files, 246 code/type changes, 252 deletions and 333 other files. Classification is not a complete raw line-by-line review.

## Delivery checks and acquisition hardening

The initial draft PR's Workspace Checks, Workspace Tests, Python, governance, dependency review,
secret scan, policy/API security and SBOM jobs passed. CodeQL reported six annotations: a cache
check/use race, unsafe NHGIS temporary-file/download handling and three hostname substring
assertions. Mobile's Expo Doctor also required six SDK 57 patch updates. No check was disabled.

The Wikidata cache now reads directly and atomically renames complete private temporary files.
NHGIS downloads restrict credential use to the documented IPUMS origin/path, reject redirects,
bound streamed bytes and validate every ZIP entry before writing CSV/text into a private random
directory. Path traversal, links/devices, duplicate paths, unsupported formats and expansion bombs
are rejected; failed extraction removes partial output. Tests assert parsed hostnames. The
standard-library extractor avoids adding a ZIP dependency. Repository security/ops utilities,
sibling workflow tooling and installed utilities were searched; no reusable safe extractor existed.
The runbook records limits and the trust boundary for operator-supplied local directories.

**Archive extraction choice. Accepted with controls.** The strongest failure is credential leakage
or arbitrary file writes through an upstream URL or archive. The alternative is manual extraction
for every run, which does not serve unattended execution. Use a fixed authenticated endpoint,
private directories, bounded input/output, isolated Python execution and exclusive file creation.
This protects the automated table path; an authenticated real NHGIS download was not attempted.

Check: Acquisition, cache parsing and citation URL regression cases
Command: fnm exec --using=22 -- node --conditions development --import tsx --test packages/ops-data/scripts/lib/lives-nhgis-ingest.test.ts packages/ops-data/scripts/backfill-visit-from-wikidata.test.ts packages/ops-data/src/demographics/acs-loader.test.ts packages/ops-data/src/demographics/loader.test.ts packages/ops-data/src/demographics/nhgis-loader.test.ts
Result: pass
Observed: 27 tests passed, including real Python extraction of valid and hostile ZIP fixtures, credential destination checks, byte-preserving output, private permissions and cleanup. The network boundary is mocked.

Check: Full affected local CI lanes after acquisition fixes
Command: RESEARCH_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane validate --lane unit-js-packages --lane unit-py
Result: pass
Observed: all three selected lanes passed; 137 Python tests passed. The Node package lane actually invokes the new Python extractor.

Check: Operator script types and extractor style
Command: fnm exec --using=22 -- pnpm --filter @repo/ops-data typecheck; .venv/bin/ruff check packages/ops-data/scripts/lib/extract-nhgis-tables.py; .venv/bin/ruff format --check packages/ops-data/scripts/lib/extract-nhgis-tables.py
Result: pass
Observed: both ops-data TypeScript projects and both Python style checks passed.

Check: Mobile CI parity after Expo patch alignment
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging --lane mobile
Result: fail
Observed: clean npm install, format, typecheck, lint and 167 suites / 1,275 tests passed. Expo Doctor passed 20/21 checks; CocoaPods cannot run because this Mac's Xcode license has not been accepted. No license was accepted or native check bypassed. The local mirror now includes Doctor and dependency alignment, matching GitHub.

Check: Mobile dependency alignment after the native-tooling stop
Command: cd apps/mobile && fnm exec --using=22 -- npm run deps:check
Result: pass
Observed: Expo reports dependencies up to date. Existing exclusions were unchanged. Native Release rebuild remains unproven on this host until its Xcode license is resolved by the owner.

The API's automatic preview compiled, then failed while tracing a missing `supports-color@7.2.0`
path after restoring an older cache. A clean local trace of the compiled API traversed 1,114 files
without that filesystem error (optional-module/type-declaration warnings remain). A normal frozen
install over an isolated old dependency graph retained the old package; it did not reproduce the
remote missing target. A stale cache is a hypothesis, not an established diagnosis. No dependency
was reintroduced, build gate bypassed, manual deployment or workflow retry started. The next normal
PR checks must verify the security/mobile changes and establish whether the preview failure persists.

Opened primary references for these fixes:

- [IPUMS NHGIS data workflow](https://developer.ipums.org/docs/v2/workflows/create_extracts/nhgis_data/): authenticated table downloads use `https://api.ipums.org/downloads/nhgis/`.
- [Expo SDK 57 changelog](https://github.com/expo/expo/blob/sdk-57/packages/expo/CHANGELOG.md) and the SDK-57 package changelogs for UI, build-properties, constants, router and updates: required patch alignment; no opt-in scene lifecycle change was enabled.

## Remaining gates

- Verify deployed migration history, reconcile any unassigned frontier tasks or unresolved selectors,
  execute an isolated production-shaped restore, compare data/constraints and coordinate clients,
  schema and staff JWTs. No production mutation or restore was performed.
- Evaluate obscure/OCR/alias/undated recall, false merges, entailment, edge/path recovery and calibration
  on independently reviewed held-out data. Synthetic vectors establish mechanics only.
- Observe a rights-cleared Internet Archive save through completion. No save was submitted here.
- Apply the implemented orphan/retention sweep to an authorized deployed inventory and verify
  withdrawal handling for canonical reviewed claims, external exports, backups and provider logs.
- Remote schedule inventory and provider-account deletion were not performed. No checked-in
  Actions cron remains; research host launchers are removed. Four remotely inspected discovery,
  convergence, egress and release-artifact workflows were disabled manually; the canary was manual
  only. Repository cleanup cannot establish other provider/host state. Stored non-ID mentions need
  explicit identity reconciliation during cutover; name/alias/tag-based edge guessing was removed.
  Reconcile edge-specific claims before comparing graph coverage; missing proof now removes an edge
  rather than borrowing unrelated citations or restoring seed edges.

## Verification record

- Project inspected: answered: architecture and findings above identify “kernel and ledger”, provider retirement, public projections, auth and schema dependencies.
- Reuse checked: answered: existing kernel, source clients, capture sink, pgvector and scheduled-job registry were extended. Repository, sibling workflow configuration and installed skill catalogs were searched; no second research engine was added.
- Validation path run: answered: “all four selected lanes passed”, with full-run and real-database evidence above.
- Outcome observed: answered: “separate CLI processes” and local reader/login observations above; semantic research quality is not proven.
- Surface inspected: answered: “light/dark themes”, source links, no-coordinate and missing-record behavior; production not inspected.
- Diff reviewed: partial: high-risk contracts, SQL, authorization, accounting, capture disposal, semantic runtime changes, authority documents and workflow commands reviewed. Mechanical schema/path changes were classified separately and comment batches checked for syntax-tree equivalence. The entire raw diff, including generated output and retired files, has not received line-by-line review; this remains a draft.
- Residual risk: listed in “Remaining gates”, with the evidence each requires.
- Root-cause-debugging: remote annotations and mobile failures reproduced/read; malicious-input regressions pass. The API cache hypothesis remains inconclusive, and the Xcode license blocks native proof.
- Commit-and-PR: draft consolidation; staged-tree secret scan passed; branch targets staging. No merge or deployment is authorized by local checks.

Additional opened primary sources:

- [OpenRouter usage accounting](https://openrouter.ai/docs/guides/guides/usage-accounting.md) and [FAQ](https://openrouter.ai/docs/faq.md).
- [Next.js connection](https://nextjs.org/docs/app/api-reference/functions/connection).
- [EPA wetlands functions](https://www.epa.gov/wetlands/why-are-wetlands-important).
- [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute) and [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), opened 2026-09-18.

- [Supabase Storage schema](https://supabase.com/docs/guides/storage/schema/design.md): metadata may be queried; object deletion must use the Storage API.
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection.md): explicit price caps and parameter support.
- [NPS Mary Ann Shadd Cary](https://www.nps.gov/people/mary-ann-shadd-cary.htm) and [disclaimer](https://www.nps.gov/aboutus/disclaimer.htm).
- [EPA What is a Wetland](https://www.epa.gov/wetlands/what-wetland) and [disclaimers](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers).
