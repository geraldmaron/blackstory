# Research framework audit evidence

Engineering verification record, observed 2026-09-19. The maintained method is
[Research framework](README.md); [Architecture](../architecture.md) owns authority and the challenge
procedure. Beads epic `repo-91sqj` owns execution status. This record replaces superseded intermediate
results rather than accumulating competing completion claims.

## Outcome and release boundary

The reusable kernel, durable execution ledger, source capture, passage retrieval, relationship
proposals, review gates and manual worker entry points are implemented. Black history is a domain
profile; the same loop has acquired EPA wetland sources. Research cannot publish. No Firebase,
Firestore or Corsair runtime is required, and no research timer is enabled in the inspected accounts.

The coordinated non-iOS release is live. The signed Dunbar correction is active, Preview database
credentials are removed, and the web and separately deployed API read production Postgres. The
authorized migration completed all 14 pending files, advanced the ledger from 61 to 75 versions,
removed the `bb_*` responsibility schemas, and moved staff metadata to `app_role`. Production web
deployment `dpl_4U8WcqP5bGJpgp71dfz1YhH4VwMQ` built staging SHA
`6f96a2b7d7362a22a19c9300502518e2fa325095`, including the nonce hydration and headline clipping
fixes. It became READY before Cloudflare was purged and maintenance was removed. The anonymous
reopened canary completed at `2026-09-19T15:08:59.850Z`; real browser checks then verified the
public theme control, final headline and authenticated production admin surface without runtime
errors. The freeze cutoff is `2026-09-19T04:43:09.299Z`; matched recovery completed at
`2026-09-19T05:07:26.655Z` in 1,457.356 seconds, meeting RPO 0 and RTO 14,400 seconds. Native iOS
Release verification remains deferred by the operator. A passing release does not establish
representative graph coverage, research quality or preservation completeness.

## Decisions challenged

| Choice | Strongest failure and alternative | Disposition |
|---|---|---|
| Extend the existing kernel | Product coupling can make reuse superficial. Alternative: replace the engine | Accepted with controls: explicit profiles, shared TS/Python schema and second-domain execution; no second framework |
| Postgres graph and vectors | Filters can reduce approximate recall; graph expansion can exhaust a budget. Alternative: separate graph/vector services | Accepted pending representative-scale measurements; exact baseline, query plans, bounded traversal and model/hash isolation |
| Semantic candidate discovery | Similar names or topics can invent identity and relationships. Alternative: lexical-only retrieval | Accepted with controls: similarity proposes; exact source selectors and independent review establish assertions |
| Institutional source preference | Custody does not remove exclusion, copying or archival silence. Alternative: equal source weights | Claim-relative fitness, lineage checks, community/oral/Black press discovery and explicit negative-case searches |
| Prefix removal | Old clients, SQL function bodies and JWT claims can fail together. Alternative: compatibility aliases | One coordinated schema/auth/client cutover; no alias views or dual writes; restored-data rehearsal before release |
| Staff session authority | A runbook can mistake session revocation for immediate JWT invalidation. Alternative: add a separate revocation gate | Retain server-verified current `app_role` for web/admin and JWT `app_role` for database RPCs; test each boundary, refresh the cutover session, and do not promise forced reauthentication or a retired-claim fallback |
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
  requires an executed restore and a verifiable log. Traffic remains gated until recovery,
  namespace migration and matching client verification are complete.
- Literal NUL source characters were replaced by equivalent string escapes. Active scripts use the
  responsibility schemas. Rewritten comments describe behavior and constraints rather than session history.

## Database and storage evidence

The initial production inventory was read without mutation. It held ten `bb_*` namespaces,
133 application tables and 412,140 exact rows on Postgres 17.6. A consistent application snapshot
was exported to a private local dump (90,198,939 bytes). The isolated restore matched all table
counts and stable row hashes, with 467 constraints, 342 indexes, 18 functions and no invalid
constraints. That application-only rehearsal used a synthetic staff account for role migration and
authorization. The separately authorized Auth/Storage recovery below uses a later private snapshot.

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
replacement exists in the recovery set. The signed correction below removes its current reference;
the original immutable release preserves the historical reference. It is not a successfully
recovered 229th object. The private backups are retained outside Git. These component timings alone
do not establish complete recovery.

A separate local Dunbar correction cloned the release, removed the unavailable media reference,
built a 4,210-entry manifest, signed it with a throwaway P-256 key, verified the persisted signature,
and activated it through `publication.activate_release`. The previous release became superseded
and one activation audit event was recorded. Source release hashes remained unchanged. The new
release retained 4,210 entities and search rows, 12,180 citations, and Dunbar’s four claims and one
related record. This rehearsal established the correction mechanism before production delivery.

The production replacement `rel_20260918_dunbar_media_correction_001` is now active. Both release
artifacts were uploaded through resumable Storage uploads and read back with exact byte hashes:
`entities.json` is 17,665,183 bytes with SHA-256
`eb200fb283e8fce0df2f733fceb4be0a34a1af8be776a518f177cab9a7e4a8ed`; `search-index.json` is
8,310,554 bytes with SHA-256
`c39a64fdbe27269192a9e7ffc21974f666e9a1b22b3660b34f3ac9a7992e623d`. The production P-256 signature
verified before and after persistence. Activation used `bb_publication.activate_release`.
All nine release tables matched normalized source content except the approved image removal and
replacement release identifiers; the original signed release was preserved and superseded.
The new release retains the same entities, search documents, citations and Dunbar evidence as the
rehearsal. The signing key and maintenance credential are held in 1Password; private key material,
upload journals and recovery exports remain outside Git.

Production maintenance was verified anonymously before and after an operator bypass request.
Cloudflare excludes bypass cookies, headers and query parameters from shared caching. Both Vercel
projects protect direct deployment URLs with SSO and have no Preview database credentials or cron
definitions. The four scheduled GitHub workflows remain disabled. The freeze check found no active
or idle-in-transaction client, no prepared transaction and no external-job database extension.
The frozen inventory contains 170 tables, 433,931 rows, 303 Storage metadata rows and 288 required
objects totaling 499,737,392 bytes (58 private and 230 public), including both new release
artifacts. Exact readbacks and access denials passed for the required objects; the absent historical
Dunbar image is reported separately. The complete matched restore is proven in the owner-only
recovery record.

The authorized private Auth/Storage database drill restored a consistent table/Auth/Storage metadata snapshot into a dedicated
loopback-only container with fresh local database credentials. All **170 tables and 421,166 rows**
matched their source counts and hashes, including one staff Auth user, 301 Storage metadata rows and the
61-version migration ledger. All 3,442 queried table/routine grants, 130 policies, RLS flags,
queried role capabilities and 21 role memberships matched. Anonymous public reads succeeded;
anonymous public writes and Auth-user reads were denied. The authenticated database role without
staff claims saw no canonical rows and could not write. No production mutation occurred.

The rehearsal exposed prerequisites that an application-only dump concealed: extension versions
and owners, extension grants, and membership in built-in Postgres roles must be supplied explicitly
when restoring a schema-filtered dump. Source `extra_float_digits=0` also had to be used for the
JSON row-hash comparison; the fresh server's value of `1` caused four apparent mismatches that
vanished with equal serialization settings. Extension and full-role metadata were inventoried
after the data snapshot. They are supplemental component evidence, not a freeze-time manifest.

The dump, configuration, manifests and logs remain outside Git in owner-only storage. This is a
historical component proof. Verification
ran with `node --conditions=development --import tsx
.cache/research-reconciliation/preproduction-recovery-drill.mts
.cache/research-reconciliation/blackstory_preprod_recovery_20260918222337-source.json --verify-only`.
The report is `.cache/research-reconciliation/preproduction-recovery-drill.json`, with result
`component-pass-recovery-gate-open` and `completeRecoveryProven: false`. Its 4.162-second timing
covers final verification only, not recovery time. Restoration and permission corrections preceded
that comparison; no launch-ready recovery artifact was generated by that earlier drill.

A separate Auth API proof used the source's observed GoTrue `v2.197.0`, the restored
`supabase_auth_admin` role, its observed `search_path=auth`, and fresh local credentials. From the
isolated Docker network, health, link generation, token verification and authenticated `/user`
returned HTTP 200. The restored staff identity and `bb_role=admin` matched. Logout returned 204;
refresh-token reuse returned 400. No email was sent. The command was
`node --conditions=development --import tsx
.cache/research-reconciliation/preproduction-auth-service-proof.mts --go-ahead`; its private report
records `auth-service-proof-pass`. Temporary credentials, service/network and the disposable
recovery database were removed after verification; the protected dump and reports are retained.
This historical proof establishes the local Auth API flow, not the original password, email delivery, a browser sign-in
page, production JWT reuse or a restored Storage service. The host HTTP route was not verified.

This historical comparison did not independently establish all ownership, schema/default/sequence ACLs,
role settings, or full-surface object references. The retained 286-object byte proofs predate this
snapshot. Those limits were closed by the later matched recovery; the component records remain
supporting evidence rather than the release-time measurement.

The completed matched recovery is recorded in the owner-only artifacts
`artifacts/recovery/latest.json` and `.cache/research-reconciliation/matched-recovery-run.json`.
It proves `completeRecoveryProven: true` from the frozen cutoff through completion, with RPO 0 and
RTO 14,400 seconds. The postcutover production verifier completed at
`2026-09-19T05:13:29.865Z`: migration frontier `20260918154322`, 10 current responsibility
schemas and no `bb_*` schemas, 11 expected generated columns, zero invalid constraints, and
PostgREST configured for `public,published,submissions`. It found one admin `app_role`, no
`bb_role`, exact mapped counts and full-row hashes for 133 original application tables and
424,903 rows, 14 new capture origins, five other new tables, and passed anonymous and privileged
function denial checks. The API and public canaries passed: four API claims/citations checks and
HTTP 200 responses for `/`, `/records`, `/explore`, the place surface and the login route. Anonymous
admin checks returned 401/307 and fresh Auth release checks returned 200. The deployed static-nonce
fix now supplies one request-bound nonce to every framework script. Production `/admin/login`
rendered the credential form, a real staff login reached `/admin` with the `ADMIN` role and
production Supabase/Postgres runtime, and the session remained valid after maintenance was removed.

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
cursor without network requests. The bounded authenticated preservation pilot submitted the NARA
URL once. Internet Archive's account status recorded one daily capture, and CDX reported a new
HTTP 200 capture at `20260919023853`, eleven seconds after the local revision reservation. The
[sanitized receipt](../../packages/testing/src/gold-corpus/artifacts/internet-archive-preservation-pilot-2026-09-18.json)
records the exact URL, local digest, CDX digest, replay URL, capture time and readback result without
credential values. The exact replay returned HTTP 200 with the matching Memento datetime.

The initial SPN response was `text/html`, so no remote job id could be parsed. The local URL-plus-
digest reservation remains `reserved`; it is not relabeled as a completed job and prevents an
automatic duplicate POST. External capture completion and local job completion therefore remain
separate facts. Internet Archive's official `gospn` client requests `application/json`; the shared
client now sends the same `Accept` header on submission and status polling. No NPS URL was
submitted. This proves one rights-reviewed external save, not preservation coverage for the
**7,913-URL** inventory, and it does not establish byte equality between the local extracted text
and the Archive's independent fetch.

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
Wayback result was explicitly synthetic, so this proves local delivery separately from the live
NARA save above; it does not prove that the new external pointer has been published on the route.
The persistent working database predates the final migration rehearsal; its empty job table was
conformed to the checked-in revision-keyed schema for the authenticated pilot. The complete 75-file
CLI proofs used separate disposable databases, as recorded above.

Preservation verification commands:

```text
Command: fnm exec --using=22 -- pnpm --filter @repo/domain test
Result: pass
Observed: 1,830 tests passed, including the SPN request contract.

Command: fnm exec --using=22 -- pnpm --filter @repo/domain typecheck
Result: pass
Observed: TypeScript completed without errors.

Command: fnm exec --using=22 -- node --conditions development --import tsx --test packages/domain/src/adapters/internet-archive/wayback/wayback.test.ts packages/operator-cli/src/wayback-anchor.test.ts packages/operator-cli/src/capture-backfill.test.ts
Result: pass
Observed: 44 tests passed, including JSON negotiation, durable revision keys and ambiguous-submission no-retry behavior.

Command: curl -sS -G 'https://web.archive.org/cdx/search/cdx' --data-urlencode 'url=https://www.archives.gov/research/african-americans/freedmens-bureau' --data-urlencode 'output=json' --data-urlencode 'filter=timestamp:2026091902' --data-urlencode 'fl=timestamp,original,statuscode,digest' --data-urlencode 'limit=10'
Result: pass
Observed: CDX returned timestamp 20260919023853, the exact NARA URL, HTTP 200 and digest XOEYUUVS6M5ILY53LOOKCFV4G6G4G4H3.

Command: curl -sS -L -o /dev/null -D - 'https://web.archive.org/web/20260919023853id_/https://www.archives.gov/research/african-americans/freedmens-bureau'
Result: pass
Observed: the exact replay returned HTTP 200 and Memento-Datetime Sat, 19 Sep 2026 02:38:53 GMT.
```

## Research evaluation

The reusable [held-out corpus](../../packages/testing/src/gold-corpus/fixtures/heldout-evidence-retrieval.v1.md)
contains six opened primary pages, 20 retrieval questions and 14 entailment cases. It includes
rare people, aliases, synthetic OCR perturbations, indirect questions, a two-hop chain, conflicting
fields, missing evidence and a second domain. A separate agent authored provisional gold labels;
predictions were frozen before reading those labels. This is a small, independently labeled engineering benchmark.

The actual lexical SQL baseline measured precision@5 **0.09**, recall@5 **0.45** and MRR **0.425**.
Exact-name and alias recall was 1.0; OCR, semantic, missed-entity and path categories were 0.
Forbidden-document retrieval occurred in 0.10 of queries. That is a candidate false-positive rate,
not an identity-merge rate. The frozen entailment pass matched 12/14 provisional labels and made
no false-support decisions; two disagreements concern boundary-sensitive labels.

The corrected [embedding pilot](../../packages/testing/src/gold-corpus/artifacts/evidence-retrieval-pilot-2026-09-18.json)
used OpenRouter `openai/text-embedding-3-small`, returning `text-embedding-3-small`, at 768
dimensions. The explicit normalized model mapping is allowlisted; arbitrary substitutions fail.
The run scopes lexical and vector fusion to the six held-out source items and isolates synthetic
index-mechanics padding from semantic vectors. Seven passages and 20 queries used 2,392 reported
tokens and **$0.00004784** in provider-reported charges. The cumulative receipt plus prior reserved
estimate is **$0.00260048**, below the authorized $0.25. Earlier failed attempts remain charged at
their conservative reservations because their actual charges are unknown. This is local accounting,
not an external billing cap.

Hybrid SQL retrieval measured precision@5 **0.23**, recall@5 **1.0** and MRR **0.975**, compared
with lexical recall **0.45**. It retrieved a forbidden candidate on **0.55** of queries, versus
**0.10** lexically. That tradeoff supports candidate discovery with strict review; it does not
support automatic merges or assertions. Exact and approximate fused results matched on all 20
queries. A controlled preflight exercised HNSW, while source-filtered plans preferred the origin
index. This provides bounded semantic and index-mechanics evidence, not representative ANN recall.
Exact retrieval remains the default.

The artifact binds input hashes, query outcomes, categorical measurements, SQL plans, costs and
cleanup receipts. All six temporary-row classes were empty after cleanup. The corrected provider
vectors were retained only in an owner-only local replay cache keyed by input-text hashes and
model/dimension contract. A zero-call replay reproduced every quality section exactly. Invalid,
missing or mismatched cached vectors fail closed. Public EXPLAIN plans retain operators, index
names and measured plan details while replacing embedded SQL vector literals with a redaction
marker; the public artifact contains no vectors or credentials. Executable tests recompute the
categorical summary and bind the provider report to its frozen inputs. This does not verify the
Gemini adapter against its live service. Entailment
inputs are validated before any provider call.

Entailment predictions are frozen agent decisions, not a paid model comparison. The retrieval path
category measures retrieval of supporting documents, not end-to-end relationship extraction.
Measurement-only reports use `qualityAdmission: not_evaluated`; zero measurement thresholds
cannot produce a misleading quality-pass flag. Identity and edge decisions are measured separately below; retrieving a forbidden candidate is not an admitted assertion. No probability calibration or population-level quality claim is supported.

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

### Final web-fix and production checks

The synchronous root layout declares `force-dynamic` so Next renders scripts with the request's
nonce. The proxy forwards identical request/response CSP values, and `adminAuthGate` preserves
request overrides. The local and deployed `/about` theme controls changed between dark and light.
The headline passed all five held words on desktop and 390px mobile, with both themes inspected
and no horizontal document overflow. Fractional measurements include the padded border box;
the original failure had a 103px extent inside a 99px clip.

```text
Check: Applicable final web release lanes
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/main --skip mobile
Result: initial run failed only in validate, package and coverage lanes; the affected fixes were applied.
Observed: all other selected lanes passed. Formatting scanned generated Supabase metadata; the launch-gate test incorrectly expected recovery evidence to be absent from the real repository. The corrections exclude generated state and isolate the missing-evidence fixture. Unchanged mobile checks retain the separately recorded verification below.

Check: Corrected validation and test isolation
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/main --lane validate --lane unit-js-packages --lane coverage
Result: pass
Observed: all three rechecked lanes passed. Logs: `/tmp/blackstory-final-web-ci.log` and `/tmp/blackstory-final-web-recheck.log`.

Check: Temporary recovery service cleanup
Command: fnm exec --using=22 -- node --conditions development --import tsx .cache/private/matched-recovery-cleanup.mts --remove-database
Result: pass
Observed: `matched-recovery-cleanup-pass`; recovery containers and proxy were removed while dumps, bundles and proofs were retained.

Check: Reopened production client and artifact canary
Command: node .cache/research-reconciliation/verify-production-clients.mjs --reopened
Result: pass
Observed: six public routes returned 200; anonymous admin checks returned 401/307 and staff APIs returned 200; the missing record returned 404; the API returned the active release with four Dunbar claims and citations; both release artifacts matched their recorded byte counts and SHA-256 hashes; an operator request did not alter the following anonymous response.

Check: Production browser surfaces
Command: Chrome inspection of https://blackstory.app/, /about and /admin on deployment dpl_4U8WcqP5bGJpgp71dfz1YhH4VwMQ
Result: pass
Observed: the Black Story headline retained padded glyph clearance with no horizontal overflow; light and dark theme controls worked; the authenticated admin surface reported ADMIN, production and Supabase/Postgres; browser runtime logs were empty.

Check: Direct-deployment protection
Command: curl -sS -o /dev/null -D - https://blackstory-h83bb4o41-geraldmarons-projects.vercel.app/
Result: pass
Observed: the direct deployment returned 302 to the Vercel SSO endpoint with no-store and noindex headers; blackstory.app remained publicly available.
```

The local gates establish the checked tree; the production checks establish the deployed web,
credential flow, public API and release artifacts. They do not cover native iOS execution.

```text
Check: Final complete local CI mirror, Node 22
Command: fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/main
Result: fail only on the operator-waived native iOS prerequisite
Observed: install, validate, package/app tests, Python, contract/security/a11y, coverage, build/typecheck, E2E harness, governance and security-policy passed. Mobile formatting, types, lint and all 167 suites / 1,275 tests passed. Expo Doctor passed 20/21 checks and failed only its CocoaPods native-tooling prerequisite. The final log is /tmp/blackstory-cutover-ci-final-sanitized.log. Earlier receipt-formatting and cleanup-lint failures were corrected before this full run.

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

Check: Exact archived-link assertions
Command: fnm exec --using=22 -- pnpm --filter @repo/web exec node --conditions development --import tsx --import ./test/css-stub.mjs --test src/components/room/room-kit.test.tsx
Result: pass
Observed: 73 tests passed; rendered archive/original links are checked against exact expected hrefs.

Command: fnm exec --using=22 -- node --conditions development --import tsx --test packages/ops-data/scripts/lib/citation-archive-publication.test.ts
Result: pass
Observed: 12 archive selection tests passed, including exact expected pointer comparison. These replace loose URL regular-expression assertions flagged by CodeQL; no security rule was disabled.

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
- [Internet Archive gospn](https://github.com/internetarchive/gospn/blob/main/capture.go): the official SPN client requests JSON on authenticated submissions.
- [NARA reuse policy](https://www.archives.gov/global-pages/privacy.html), [NPS disclaimer](https://www.nps.gov/aboutus/disclaimer.htm), [Freedmen’s Bureau guide](https://www.archives.gov/research/african-americans/freedmens-bureau) and [St. Louis 1860 schedule explanation](https://www.nps.gov/articles/000/united-states-census-slave-schedule-for-st-louis-county-1860.htm): exact-source preservation review and local capture pilot.
- [Supabase Auth link generation](https://supabase.com/docs/reference/javascript/auth-admin-generatelink) and [GoTrue v2.197.0 verification contract](https://github.com/supabase/auth/blob/v2.197.0/internal/api/verify.go): generated links do not send email; hash verification accepts only the hash and type.
- [Supabase Storage](https://supabase.com/docs/guides/storage/schema/design.md) and [backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore.md): metadata inventory is separate from object operations; role credentials, provider configuration and extension prerequisites need separate recovery treatment.
- [OpenRouter usage accounting](https://openrouter.ai/docs/guides/guides/usage-accounting.md) and [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection.md): price caps and receipt limitations.
- [IPUMS NHGIS](https://developer.ipums.org/docs/v2/workflows/create_extracts/nhgis_data/): documented authenticated download destination.
- [Expo SDK 57](https://github.com/expo/expo/blob/sdk-57/packages/expo/CHANGELOG.md) and [Next.js connection](https://nextjs.org/docs/app/api-reference/functions/connection): dependency and rendering behavior.
- [EPA wetlands](https://www.epa.gov/wetlands/why-are-wetlands-important) and the corpus provenance file: opened source pages for portability and evaluation.

## Verification record

- Project inspected: schema, evidence, auth, projections and durable execution are scoped in “Reconciled implementation”.
- Reuse checked: existing kernel, source clients, capture sink, pgvector and job registry extended; repository, sibling utilities and installed tooling were searched before additions.
- Validation path run: exact commands and observed exceptions are recorded above; final-tree checks and their limits are recorded in “Verification”.
- Outcome observed: restored-data and production reads passed; the public web and staff admin were exercised after reopening; unsupported relationship removal and a sourced positive two-hop chain were proven in Chrome; one rights-reviewed NARA Archive capture and exact replay were proven externally.
- Surface inspected: production home, About, admin, records, Explore, a cited record, missing-record behavior, both themes, API responses and signed release artifacts were observed.
- Diff reviewed: targeted independent review and migration equivalence completed; full raw-line review is not claimed.
- Recovery verification: exact private commands and scope appear above; `fnm exec --using=22 -- ./scripts/ci-local.sh --base HEAD` passed the governance lane for the documentation-only update. Code lanes were correctly gated off.
- Root-cause debugging: the row-hash comparison failed with local `extra_float_digits=1` and passed with the observed source setting `0`; no row data was changed to make hashes match.
- Residual risk: native iOS execution is deferred; preservation of the remaining 7,912 inventory URLs, the unresolved no-job-id local reservation and representative-scale quality evidence remain explicit.
- Commit-and-PR: PR254 merged at `2026-09-19T05:23:38Z` as SHA `e0a6faf07393f79aeab0629b6b9ac2952d421d6a`; remote CI checks 35423567775 and 35423567804 passed. The final web fixes are on staging SHA `6f96a2b7d7362a22a19c9300502518e2fa325095`; API `dpl_693wvmnFYhFzVNgnWWo1AAg6Q6or` and web `dpl_4U8WcqP5bGJpgp71dfz1YhH4VwMQ` passed their production canaries.
