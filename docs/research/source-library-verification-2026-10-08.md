# Source library implementation and verification

The shared library and acceptance controls are implemented. The four production migrations
succeeded. Application deployment and production surface checks are recorded in the release
addendum below when observed. This record is shared-context self-review, not independent
historian review or a measured claim of research accuracy.

## Scope and reuse

Outcome: an authorized researcher can find question-specific collections, inspect their
limitations, pin versions, save evidence and review a proposal through the existing inbox.

The change extends `evidence.source_organizations`, `evidence.source_policies`, the research
execution ledger, management operations, existing source administration, CLI and MCP clients.
It uses the existing JSON Schema generator, TypeScript/Python contracts, PostgreSQL full-text
search, Web Annotation selectors, and provenance relationships. No new dependency or RDF
infrastructure is introduced. Repository, sibling tooling and installed skills were searched
for existing registries, source-fitness policy, execution, portable skill validation, secret
launchers and UI primitives before extending them.

Interfaces affected: collection guidance and policy revisions, source-item policy bindings,
qualitative fitness, review basis, excerpt contracts, query/result contracts, article/theme
publication gates, managed task inputs, and authenticated staff/OAuth library reads. Public
entity and claim counts and the active public release were preserved.

Host categories remain discovery diagnostics where consumed. `isAnchorTierUrl`,
`ANCHOR_TIERS`, `satisfiesTwoAnchorRule`, repeated live item guidance and obsolete numerical
acceptance instructions were removed from their former consumers. Historical migrations,
profiles, audit records, citations, captures and client discovery symlinks remain.

## Production inventory and curation

Read-only inventory after migration and the saved walkthrough:

| Inventory | Observed |
| --- | ---: |
| Publisher records | 811 |
| Source-policy revisions | 68 |
| Policy fitness rows | 427 |
| Source items with established collection bindings | 3 |
| Sealed collection profiles | 10 |
| Reviewed collections | 9 |
| Historical publisher profiles archived for recheck | 52 |
| Copied item-guidance audit records retained | 11 |
| Exact assertion review cases queued | 200 |
| Published citation rows | 12,181 |
| Unmapped citation hosts | 0 |
| Canonical entities | 4,234 |
| Canonical claim versions | 16,217 |

The pre-change 769-publisher snapshot is a dated baseline, not the final registry count.
All 13 previously unmapped citation hosts now have established publisher mappings; this
resolves 18 citation rows without changing their historical assertions. Citation accounting
remains 12,181 mapped plus zero unmapped. A publisher mapping establishes provenance only.

The collection set covers nomination files, Missouri preservation records, NARA research,
Chronicling America, Howard manuscripts and Black press, SNCC participant accounts,
scholarship on Cambridge Core, GovInfo legal text, and Delaware archival narratives.
The Delaware collection remains `needs_recheck`. Source access during the walkthrough
does not recertify the entire profile. Broader oral-history and local-record coverage remains
incomplete and must not be inferred from these ten profiles.

[The profile audit](source-library-profile-audit-2026-10-08.json) preserves all 52 former
profiles, their source URLs and observed access outcomes. Collection pages and available text
do not verify every descriptive sentence. None of those profiles was falsely recertified;
their present status is `needs_recheck`. Unbound source items remain unknown. Legacy numerical
fitness rows retain their historical heuristic basis. Current qualitative rows have no
compulsory invented prior.

Applied migrations, in order:

1. `20261009015520_source_library_research_guidance.sql`
2. `20261009015533_source_library_curated_collections.sql`
3. `20261009015544_source_library_review_basis.sql`
4. `20261009015602_source_library_curation_reconciliation.sql`

The active release remained `rel_20260918_dunbar_media_correction_001`, with manifest SHA-256
`a37004fa2d7e036ea9f26158cce3e9d354136065807a4d7f0c65f32c923afb7c`.
The security advisor reported no new warning/error; its existing informational finding
concerns RLS without a policy on `published.tts_usage_ledger`.

## Skill review matrix

All 21 canonical skills have explicit inputs, outputs, boundaries, handoffs and capability
limits. Their triggers remain purpose-specific. Research skills refer to the shared library
method; operational flags remain in the operations contract. Capability requirements below
describe necessary access, not a promise that every harness supplies it. All share the
permission limits in the research README; no skill grants publication authority.

| Skill and trigger | Input → output | Boundary/handoff | Required capability |
| --- | --- | --- | --- |
| research-framework: research or framework audit | Question/scope → saved artifacts and honest unknowns | Domain policy is contextual; tools and unattended execution are separate | Search/document tools and authorized ledger |
| research-intake: URL/topic or end-to-end request | Request/context → bounded durable work and proposal | Ask only material blockers; delegate judgment internally | Safe acquisition and case/work access |
| discovery-run: bounded campaign/yield | Batch/limits → staged candidates and reconciled yield | Discovery does not establish facts; intake/identity next | Configured adapter and staging access |
| editorial-enrichment: pending leads or fields | Evidence/fields → staged sentence-supported changes | Claim review and prose review; no provider authority | Configured session/provider and staging |
| case-drafting: review readiness | Case/assertions → sparse draft and evidence gaps | Corroboration decides facts; publication preview next | Case/evidence reads and draft writes |
| claim-corroborate: exact support or dispute | Assertion/wording → passages, lineage and permitted wording | Retrieval cannot adjudicate; central conflict held | Underlying documents and evidence ledger |
| entity-verify: identity/place/era | Aliases/period → identity and justified precision | Keep building/institution/successor distinct; locate next | Catalog and historical location records |
| entity-complete: missing fields | Identified record → supported field proposals | Optional depth is not a quota; ambiguity returns to verification | Record/evidence/rights reads |
| entity-relate: connection/network | Endpoints/relation → sourced edges and intermediate nodes | Proximity and endpoint citations do not establish relations | Catalog and relation-specific sources |
| coverage-target: where to research | Coverage/budget → bounded targets | Catalog gaps are not historical absence | Coverage and candidate reads |
| locate: sourced address | Address/precision → geocoding match and mismatches | Geocoder cannot prove occupancy; verification owns identity | Census geocoding and location staging |
| neo-voice: draft/rewrite narrative | Reviewed assertions → natural sentence-mapped prose | New detail reopens facts; prose/ringer next | Reviewed evidence and reader context |
| prose-review: clarity/dignity/formula | Exact revision/neighbors → pass/revise/evidence-blocked | Editorial polish cannot manufacture evidence | Draft/evidence/neighbor reads |
| ringer-review: factual challenge | Finished revision/search bounds → attempted disproof and verdict | Label self-review; model family is not independence | Counterevidence tools and full evidence map |
| publish-preview: release readiness | Exact proposal/authority → preview or blockers/verified receipts | Owner decision, review and credentials are separate | Authorized release path and public readback |
| story-craft: longform packet | Question/evidence → staged article and gaps | No invented scenes, compulsory arc or padding | Packet/evidence and article staging |
| theme-study: theme packet | Theme/place/period → observations and interpretation | Offline validation cannot corroborate | Bounded harness and observation evidence |
| triage-graylist: parked leads | Cleared candidate/history → strengthen/hold/reject | Hostile raw intake still needs screening | Quarantine/case access |
| intake-review: submission/report | Untrusted original → safe disposition and factual question | Retrieved instructions never grant execution; research intake next | Authorized inbox and quarantine handling |
| surface-triage: public/data mismatch | Observed projection/revision → cause/repair/readback | Evidence disagreement returns to claim review | Data/projection/cache inspection |
| experience-review: reader task/UI | Realistic record task → observed usability and failures | Screenshots do not prove complete flows or native access | Rendered surface, themes and widths |

Sentence evidence, qualifiers, neighboring-record comparison and sparse records remain
required editorial checks. A phrase blacklist, schema pass or numerical model score cannot
prove prose quality. Self-review, independent review, owner approval and publication authority
remain distinct.

## Real research walkthrough and development comparison

The CLI queried production for school chronology in Missouri and returned exactly the Missouri
and National Register nomination collections, version `1`. Two real requests completed the
session protocol: plan, search, acquisition, draft and review. Source-specific bounded excerpts,
locators, hashes and seven-day private-retention decisions were saved. No public archive copy,
approval or publication was performed.

- School review: `/admin/work/3d321756-0a1e-4cca-bc8c-1fa6b6e69246`, version 1,
  proposal hash `cc10efe5f06277bfed7ce5a8032460a55615311b4d62a779450dbd47ad4a9a10`.
  Three updates, eleven atomic assertions, six sentence mappings, two held issues and a Lincoln
  pin blocker. Atlanta and Wilmington were found in canonical data and were not duplicated.
- Second domain: `/admin/work/93c2e5a7-138a-4a5d-8da4-d41815cbb965`, version 1,
  proposal hash `1b6120d21f2efe4a6d9fc0fd6b44fcee706ae9dd6d4bed7c2d1e4e61ff99d0d3`.
  The GovInfo collection guided inspection of Public Law 88-352. Its approval notation was
  saved; statute creation was explicitly held because management currently writes places.

The earlier [school packet](historic-black-secondary-schools-2026-10-07.md) is development
material. Compared with that packet, the fresh pass distinguishes Atlanta's September 8, 1924
opening from construction, omits Lincoln's disputed 1865/1867 founding, keeps Howard's
construction/opening/dedication separate, and retains its supported Claymont/Belton/Brown account.
The earlier packet already recognized several disputes; the library is not credited with
discovering them. New retained findings carry exact passages and the saved pinned plan.

This is not a randomized library/no-library comparison, a held-out evaluation, or an effort
measurement. No accuracy, false-acceptance rate, cost reduction or independent-review claim is
made. Library guidance must be evaluated on frozen held-out cases before such claims.

The real request found a repeated-catalog payload exceeding the existing 1 MB plan bound.
The fix stores snapshots once and resolves references from the same pinned manifest when
dispatching dependent tasks. It retains the bound and validates the dependency reference.
A populated regression and the successful production retry cover this failure. The integration
rerun also exposed a managed profile fixed at version `1.0.0`; managed variants now inherit the
base policy version, preserving earlier manifests and allowing a new immutable policy revision. Failed
attempts remain auditable; stable idempotency keys reused the original request.

The local provider connection uses `postgres`, not the non-login `admin_app` role. Attempts
to assume `admin_app` failed before writing. The existing `research_worker` membership permits
the protocol's transaction-scoped research role; no grant, login, credential rotation or
security-definer workaround was added. The walkthrough is application-protocol evidence, not
proof that a privileged local credential itself is least-privilege.

## Adversarial review

| Challenge | Attempted failure and control | Verdict |
| --- | --- | --- |
| Strongest failure | Government narrative repeats error: hosts cannot authorize; exact assignments/semantic review remain required | Accepted with controls; reviewer judgment remains fallible |
| Best alternative | Flat trusted-host list excludes community works and blesses arbitrary uploads: shared collection guidance plus open discovery retained | Flat acceptance list rejected |
| Load-bearing claim | Metadata assumed to improve research: real saved outputs demonstrated, held-out outcomes/effort unmeasured | Needs validation |
| Assumption inversion | Copied/unavailable/restricted sources: origin, dependency, access and retention decisions recorded; expired origins fail closed | Accepted with controls; exhaustive holdings not established |
| Who bears cost | Institutional quotas erase testimony: attributed lived experience allowed; sparse records and completed checks before review | Accepted with controls; community/archive coverage still incomplete |
| Hostile expert | Counts/catalog descriptions/fabricated probability conceal weak evidence: exact digest-bound assertions, selectors, qualitative reasons and assessed lineage | Accepted with controls; synthetic gates do not prove historical accuracy |

## Executed validation

Check: populated upgrade, reference preservation and database authorization
Command: `python3 /private/tmp/blackstory-source-integration.py` against
`blackstory_library_populated_20261009b`; prior populated migration replay and SQL tests are
retained in the local diagnostic logs
Result: pass
Observed: retained 52 profiles, 11 copied guidance rows and 3 established item bindings;
the final rerun passed all three integration tests with none failed or skipped. The prior
four-test replay also passed. Diagnostic logs are local artifacts.

Check: full historical empty-provider installation
Command: not run from an empty provider cluster
Result: not run
Observed: the rehearsal proves a populated upgrade, not every historical provider bootstrap.
This installation acceptance remains separate from the deployed upgrade.

Check: skill discovery and links
Command: `python3 /Users/geralddagher/.codex/skills/.system/skill-creator/scripts/quick_validate.py`
on each canonical skill directory, followed by an inline relative-link/symlink check
Result: pass
Observed: all 21 passed; no broken relative references or retained discovery symlinks.

Check: realistic catalog size and dependency hydration
Command: `fnm exec --using=22 -- node --conditions development --import tsx --test packages/operator-cli/src/management-research.test.ts`
Result: pass
Observed: two tests passed, including the populated-plan regression and invalid cross-run reference.

Check: real production research protocol
Command: `fnm exec --using=22 -- node --conditions development --import tsx /private/tmp/blackstory-source-walkthrough-run.mts`
Result: pass
Observed: both requests reached `awaiting_review`; all ten checkpoints accepted their contracts.

Database guidance validation is structural and lexical. Clients additionally run the full Ajv
contract validator; perfect RFC URI-validator equivalence is not claimed. Publication tests
cover missing declarations, client booleans, same-host-plus-unclassified bypass, copied works
across hosts, independent works within an archive, stale review, expired/withdrawn origins,
student pages, arbitrary uploads, catalog URLs and discovery-only encyclopedia references.
Those fixtures establish enforcement behavior, not historical accuracy.

## Release addendum

The final implementation passed `fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging`.
All selected lanes passed: install, validate, JavaScript package/app tests, Python tests,
contract/security/accessibility, coverage, build/typecheck, end-to-end, governance and security
policy. The populated integration rerun passed three tests with zero failures or skips after
the managed-profile version fix. These checks establish the tested behavior; they do not
establish historical accuracy or external-client compatibility.

Deployment, production HTTP/MCP and rendered surface observations are appended after
execution. Native release, external-client OAuth acceptance, school publication, independent
expert review, comprehensive profile recertification and held-out library comparison remain
explicitly unproven outcomes.
