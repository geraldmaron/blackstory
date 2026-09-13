# Decisions carryover

Still-binding invariants extracted from ADR/decision docs removed 2026-07-24
(`repo-xez5.11` docs purge). History is preserved in git (`git log -- docs/adr/`,
`docs/prds/`, `docs/memos/`, `docs/meetings/`, `docs/notes/`, `docs/bb-001/`,
`docs/mobile/decisions/`). Only rules not already stated in a surviving doc are
listed here; most invariants from the removed ADRs were already restated in
`docs/data/`, `docs/security/`, `docs/mobile/security/threat-model.md`, and
`docs/relationship-taxonomy.md`, and did not need duplication.

- **Mobile reads only through `apps/api-public`, and imports only client-safe packages.** The
  mobile app shares environment-neutral wire types and pure helpers from
  `packages/public-contracts` and reaches the server over HTTP only; `packages/firebase`,
  `@repo/security` and `firebase-admin` are never imported from it. The blanket form of this
  rule — "never imports `packages/domain`" — is no longer true: see "Mobile data boundary"
  below for the one subpath that is imported, what the CI gate does and does not cover, and
  the rest of this decision. (from ADR-022, "mobile data boundary")

- **Admin never edits active public projections directly.** Changes to what the public site
  serves must go through the publication workflow (preview → promote / release activation), never
  a direct write to the active public projection tables. (from ADR-004, "public projection and
  immutable publication snapshot model")

## Addendum, 2026-07-24 (repo-xez5.10): entity source-of-truth precedence

Entities historically existed in four places (git fixtures, Firestore `canonicalEntities`,
Supabase `bb_canonical.entities`, in-code hand-curated tables). This restates the ADR-020
precedence rule. Firestore is leftover, not a current write path:

**The number ADR-020 is shared by two unrelated decisions.** This entry is the web-series
ADR-020, "Supabase Postgres as system of record." Under the pre-rename mobile numbering ADR-020
was "Mobile stack — Expo React Native, MapLibre Native, and SQLite offline cache," which
`apps/mobile` and `apps/mobile/README.md` still cite by that old number; it is recovered
separately in this file under "Mobile stack". A mobile ADR-020 citation means nothing in this
entry.

**The number ADR-020 is shared by two unrelated decisions.** This entry is the web-series
ADR-020, "Supabase Postgres as system of record." Under the pre-rename mobile numbering ADR-020
was "Mobile stack — Expo React Native, MapLibre Native, and SQLite offline cache," which
`apps/mobile` and `apps/mobile/README.md` still cite by that old number; it is recovered
separately in this file under "Mobile stack". A mobile ADR-020 citation means nothing in this
entry.

- **Supabase `bb_canonical.entities` is the system of record.** It is the only place that a
  canonical entity is created, promoted, merged, or edited going forward.
- **Git fixtures (`packages/firebase/fixtures/national-catalog/`) are one-way seed input**,
  consumed by an import lane into `bb_canonical`. They are never re-exported from Supabase, and
  never hand-edited after their initial import — an entity that needs a correction is corrected in
  Supabase, not in the fixture file that seeded it.
- **The Firestore path (`canonicalEntities`) is retired.** `publish-national-catalog.ts`, the
  write path this rule originally flagged as drift, no longer exists in the repo (removed ahead of
  `repo-348e.8`) and Firestore itself has no live database, rules, or indexes left
  (`repo-348e` epic; `docs/data/firebase-wind-down.md`). Do not add new Firestore entity-write call
  sites — there is no Firestore config left to deploy them against.
- **In-code hand-curated entity/reference tables** (e.g. `MENTION_OVERRIDES` in
  `packages/domain/src/graph/mention-resolver.ts`) should be data files with provenance metadata,
  loaded at runtime, not literals in source — so curation edits don't require a code deploy. See
  `docs/research/entity-source-drift-audit.md` for the audit and what was moved under this rule.

## Case → canonical entity promotion authority lives in the admin console (repo-k2kb, 2026-07-25)

Note (2026-09-11): the admin console moved from its own `apps/admin` deployable into `/admin`
routes inside `apps/web` (`apps/web/src/admin/**`); the auth-boundary argument below is unchanged,
only the file paths are.

**Problem:** the only working "research case → canonical entity" promotion path in the repo was
an untracked, gitignored script (`.cache/promote-authority-net-2026-07-23.mjs`) that ran raw SQL
by hand under a single hardcoded actor id, reused across every run. Attempting to formalize it as
an `operator-cli` verb (`promote-entity`) was correctly blocked by
`packages/operator-cli/src/promotion-boundary.test.ts`, which proves operator-cli must never
expose a promote/approve/publish/activate/retract capability — proposer and approver must be a
distinct call, distinct identity.

**Decision:** promotion authority lives in `apps/admin`, not a new CLI package.

- `apps/admin` already has a real, distinct auth boundary (Postgres roles via
  `bb_auth.current_role()`: `research`/`admin`/`publication`, enforced through
  `authorizeAdminRequest`) that operator-cli deliberately lacks. That's the natural home for an
  *approver* identity structurally separate from the *proposer* — operator-cli (or whatever
  assembled the candidate record) never carries approval authority.
- New surface: `POST /admin/api/research-cases/[id]/promote`
  (`apps/web/src/app/admin/api/research-cases/[id]/promote/route.ts`), gated to the `admin`/
  `publication` roles, calling `promoteCaseToCanonical`
  (`apps/web/src/admin/cases/promote-case.ts`).
- The gate itself (`evaluateCasePromotionGate`,
  `packages/domain/src/promotion/case-promotion.ts`) is deliberately **not** the existing
  `evaluatePromotionGate` (`packages/domain/src/promotion/controls.ts`): that gate operates on a
  `PromotionClaim` shape (contradiction-search records, evidence-lineage reputation) this
  pipeline has never populated — forcing case data into that shape would fabricate fields no one
  actually assessed. `evaluateCasePromotionGate` is a smaller, honest gate: case must be in
  `state: 'substantial_enrichment'`, and proposer/approver identities must be non-empty and
  distinct (same core invariant as `evaluatePromotionGate`, applied at case granularity instead
  of per-claim).
- `validateCanonicalPromotionRecord` ports the content checks the ad hoc script enforced by hand
  (two independent source hosts, US coordinate bounds, well-formed decade buckets, non-trivial
  summary) so they run on every promotion instead of depending on a human remembering to check.

**Correction made while porting:** the ad hoc script wrote canonical-promotion metadata into
`bb_research.cases.publication` — but that column is typed
(`ResearchCaseRecord['publication']`, `packages/domain/src/research-case/model.ts`) for *public
release* metadata (`releaseId`/`publishedAt`/`revision`) — a later, distinct stage from case→
canonical promotion. Reusing it would have silently corrupted that field for any later release
step. `promoteCaseToCanonical` does not touch `cases.publication`; the canonical link is recorded
the same way the script already did on the entity side
(`entities.identifiers: [{scheme: 'research_case', value: caseId}]`) and via a
`case_history_events` row (`reason_code: 'canonical_promotion_approved'`).

**Status:** implemented and tested. `packages/domain/src/promotion/case-promotion.test.ts` covers
the pure gate/validation functions; `apps/web/src/admin/cases/promote-case.test.ts` covers
`promoteCaseToCanonical`'s actual transactional write path (gate rejection, validation rejection,
live-duplicate rejection, and a happy-path commit) against a fake Postgres client, the same
fixture style as `canonical-write.test.ts`, via the injectable `PromoteCaseDependencies` seam.
`.cache/promote-authority-net-2026-07-23.mjs` is no longer the only way to do this — as of
2026-09-12 it is superseded but still present (untracked, gitignored) and not yet deleted. As of
2026-09-12,
`promoteCaseToCanonical` has still never been exercised against a live promotion (0 of 3,420
`bb_research.case_history_events` rows carry `reason_code = 'canonical_promotion_approved'`; all
23 case→canonical promotions to date went through the ad hoc script or otherwise bypassed this
path) — residual verification risk, tracked as a follow-up.

**Alternatives considered:**
- A new small CLI package with its own auth/identity model — rejected, duplicates the auth
  boundary admin already has, for no benefit.
- Reusing `evaluatePromotionGate` as-is — rejected, requires data (contradiction search,
  evidence-lineage reputation) this pipeline doesn't produce; would need those fields faked.

## Admin edits canonical records directly, under a role gate and a mandatory audit row (repo-gyq6.11, 2026-08-04)

**What changed.** The console's operating rule used to be that admin never mutates canonical: an
operator staged decisions, and only a release build reading those decisions — behind
signed-manifest verification — made anything change. The entity workbench reverses that for the
record itself. An operator with `canonical:write` now edits `bb_canonical.entities` in place, and
merge and bulk kind reassignment write across a whole filtered set.

**Why.** `bb_canonical.entities` is already the declared system of record for entity creation,
promotion, merge, and edit (see the 2026-07-24 addendum above). The console was the only surface
where a human could see the 4,097 rows and the only one forbidden from correcting them, so
corrections were happening through ad hoc scripts with no role check and no audit trail. Moving
the write into the console does not add a mutation path; it replaces unaudited ones.

**What did not change.** The publication invariant stands unchanged: admin still never edits an
active public projection, a release snapshot, or `/api/public/**` in place (ADR-004, above).
Publishing is still preview → promote → release activation behind the signed manifest. What is now
directly editable is the canonical record, not what the public site is currently serving.

**The controls that make the reversal acceptable:**

- Every canonical write goes through `commitCanonicalWrite`
  (`apps/web/src/admin/lib/canonical-write.ts`). There is no second path, and the state change is
  handed to `commitWithAuditPostgres` — domain state, audit event, and outbox message are one
  transaction, so an unaudited canonical write cannot exist.
- The verb decides the permission, and the permission table
  (`apps/web/src/admin/auth/staff-permissions.ts`) is the single source both the server gate and the
  client's affordance-hiding hook read. Field edit needs `canonical:write` (admin, research);
  merge needs `canonical:merge` and bulk reassign needs `canonical:bulk_write` (admin only,
  because their blast radius is a filtered set rather than one field).
- The audit actor is the verified session identity from `readVerifiedAdminIdentity`, never an
  operator id submitted with the form.
- A non-empty reason is required; a canonical edit with no stated justification is rejected before
  any state work.

**Residual risk, not yet closed:** the cookie-session path has no `auth_time`, so
`assertRecentReauth` is not enforced on canonical merges and bulk edits the way it is specified for
publish/retract/rights/policy/role changes. Tracked as a follow-up on repo-qv9h.

## Addendum, 2026-09-11 (repo-z3g1f): admin console folded into apps/web, not a separate deployable

**What changed.** `apps/admin` — a separate Next.js application with its own `package.json`, own
port (3001), own Vercel project (`blackstory-admin`), own build/deploy pipeline, and own edge
middleware — is retired. Its routes and code now live inside `apps/web`: pages at
`apps/web/src/app/admin/**`, everything else (auth, data access, components) namespaced under
`apps/web/src/admin/**`. There is one Next.js application and one Vercel deployment (`blackstory`)
where there used to be two.

**Why.** The operator's stated goal: stop maintaining the admin console as a second
application/repository-shaped thing inside the monorepo. `docs/security/service-surfaces.md`
previously documented "admin is a separate deployable" as load-bearing specifically for DB
credential isolation (admin's write-capable `DATABASE_URL` never living in the process serving
anonymous public traffic). That rationale was examined, not waived: the isolation now lives at
the credential layer instead of the process layer.

**What replaces the old invariant:**

- `apps/web/src/admin/lib/canonical-postgres-client.ts` reads `ADMIN_DATABASE_URL` — a distinct
  env var from the public read-only pool's `DATABASE_URL`/`APP_DATABASE_URL`
  (`apps/web/src/lib/public-data/postgres-client.ts`), which is untouched by this change.
- `apps/web/src/admin/canonical-write-boundary.test.ts` asserts nothing outside
  `apps/web/src/admin/**` imports that module or `canonical-write.ts` — this is the automated
  check that replaces the old `apps/admin/src/surface.test.ts` "no imports from apps/web"
  assertion, which became meaningless once admin routes live inside apps/web by design.
- `apps/web/src/middleware.ts` scopes the Supabase-session + `app_metadata.bb_role` edge gate to
  `/admin/:path*` only — every other route in the app is ungated, same as before the merge.
- The `admin` `SurfaceId` in `packages/config/src/surfaces.ts` still exists, distinct from `web`
  (`appPath: 'apps/web/src/admin'` now, not a separate app); it is a capability/credential
  identity, not a deployment identity.

**What did not change:** `role_admin_app` (the Postgres role, `infra/database/ROLE_MATRIX.md`)
and the `apps/admin` string used as `allowedSurfaces`/surface-constant identity in
`packages/data-access/src/sql-connect/operations.ts` and `packages/ops-data/src/constants.ts` —
those are logical authorization-capability identities, not literal deployment paths, and stay as
they are on purpose.

**Accepted, not closed:** `blackstory-admin`, the old Vercel project, is decommissioned once the
merged `/admin` routes are verified working on `blackstory` in a deployed environment — that step
needs a human with Vercel dashboard access and is tracked on repo-z3g1f, not assumed done here.

## Addendum, 2026-09-12 (repo-30k6): recent-searches SecureStore carve-out from program invariant 7

**Problem.** `apps/mobile/src/features/search/recent-searches.ts` stores a small (max 8),
user-visible, user-clearable list of recent search terms in SecureStore (iOS Keychain / Android
Keystore) rather than in MOB-009's SQLite release-coupled cache. Its header comment justified this
by citing "ADR-022 section 2" — a misnumbering; the removed mobile ADRs were renumbered
2026-07-22, and the actual source is ADR-023 ("mobile state, cache, and offline read policy")
section 2, program invariant 7. The original ADR-023 text (recovered from git history,
`a2f559f8~1:docs/adr/ADR-023-mobile-state-cache-offline.md`) is more direct against this pattern
than the code comment implied: its "Rejected alternatives" table has a row titled exactly
"Persisting query text / correction content / precise location for offline history," resolved as
"Violates program invariant 7. These stay in-memory only or are excluded entirely" — a blanket
statement, not a carve-out for a small user-controlled list. recent-searches.ts's own
distinction (automatic opaque cache vs. user-controlled convenience list) is a reasonable one on
its own merits, but it was never actually reconciled against this text — it was an unrecorded,
unilateral decision. A second problem, independent of the citation: the same file's supporting
claim that `docs/mobile/security/threat-model.md` T1 "explicitly flags" recent search terms as
more sensitive than ordinary cached content does not hold up — T1 never discusses search-term
sensitivity; it argues the SQLite cache is safe because it holds only already-public data. That
claim has been corrected in the source comment to attribute the reasoning to this module, not to
the threat model.

A third, independent gap surfaced during this review: iOS Keychain items are not cleared when an
app is deleted (unlike Android's Keystore-backed storage, which is). A user who deletes BlackStory
expecting a clean slate and later reinstalls would see their prior recent-search list return.

**Decision.** The SecureStore carve-out is approved, WITH a control, despite ADR-023 having
already rejected the general pattern of persisting query text. The reasoning that tips this in
favor of an exception rather than deference to the original blanket rule: (1) the list this module
persists is categorically different in kind from what ADR-023 was reacting to — small (max 8),
entirely user-chosen, user-visible, and user-clearable at any time, not an automatic record of
everything searched; (2) SecureStore is a materially stronger protection boundary than the plain
SQLite the ADR was written against; (3) the feature has real user value (returning to recent
searches across sessions) that an in-memory-only implementation would defeat entirely. The
control: `recent-searches.ts`'s `RECENT_SEARCHES_SECRET_KEY` is now cleared automatically on the
first launch following a fresh install or reinstall (`search-runtime.ts`'s
`clearRecentSearchesOnFreshInstall`, gated on a SQLite `cache_meta` flag that — unlike
Keychain/Keystore — is wiped by the OS on uninstall on both platforms, and also incidentally on
an app-update schema migration, which over-clears in a privacy-safe direction rather than under).

**Why.** The project's own posture elsewhere (redaction chokepoints, PII scrubbing, no analytics)
is unusually careful about exactly this class of risk, which argues for taking ADR-023's original
"in-memory only" position seriously rather than waving it off as outdated — but the cost of the
mitigating control here is genuinely low (a few lines, reusing the store's existing `clear()`
method and the existing SQLite meta-key mechanism, no new dependency), and a small,
user-owned convenience list with a working uninstall-safe reset is a materially different risk
profile than what the original invariant was written to prevent. This is a considered exception,
recorded here so it is never again mistaken for an accident or a citation bug.

**Follow-up filed:** the 2026-07-22 mobile-ADR renumbering left ~40+ other files across
`apps/mobile/src`, `packages/domain/src/publication/`, and
`docs/mobile/security/threat-model.md` citing the pre-renumbering ADR numbers for cache/offline
(should be ADR-023), build/release/OTA (should be ADR-024), and one data-boundary site (should be
ADR-022) content. Only the sites feeding this decision were corrected here; the rest are tracked
separately (repo-wide stale mobile-ADR citation cleanup) since fixing them requires per-site
topic judgment, not a blind find-and-replace — at least one existing "ADR-022" citation
(`apps/mobile/README.md:201`) is already correct under the final numbering and must not be
touched.

## Addendum, 2026-09-12 (repo-316nh): ADR-021's two invariants, recovered

`ADR-021` is cited in roughly fifty places across the repository and the document does not exist. It was
removed in the 2026-07-24 purge above, and unlike ADR-004, ADR-020 and ADR-022 its invariants were
never extracted here — so a rule stated five times had no statement anywhere, and
`scripts/validate-boundaries.mjs` does not encode it either (it checks dependency direction,
deployable isolation and cycles generically). Both invariants below are restated from the code
that implements them today, not from the removed document.

**Workspace dependency direction.** `@repo/domain` and `@repo/domain-core` must not depend on
`@repo/public-contracts`. The core model does not take a dependency on the wire contract, and
`public-contracts` is the mobile token source, so an edge from domain both inverts the layering
and widens what fires the mobile CI lane. `public-contracts` stays a LEAF — it has no `@repo/*`
dependencies, only `zod` — which is what makes it safe for anything above it to import.

`@repo/ops-data` and the apps MAY depend on it. `ops-data` is the publisher, and a publisher
depending on the contract it publishes to is correct layering, not a violation; because
`public-contracts` is a leaf, no such import can create a cycle. This is consistent with the
ADR-022 carryover above, which already treats `public-contracts` as the shared
environment-neutral wire-type package.

Where domain restates something rather than importing it — the `ReleaseRevisionMetadata` shape in
`mobile-bootstrap.ts`; the lineage-key normalization in `evidence-inputs.ts`, which mirrors
`citationLineageKey` from `@repo/public-contracts/evidence` — the restatement is the consequence
of this rule, and the two copies must be kept in agreement by test rather than by type. (from
ADR-021, "dependency direction")

**A restated RULE is a different thing from a restated shape, and repo-6qjv0 retired the one that
existed.** `highestClaimConfidenceTier` in `release-builder.ts` used to copy `recordConfidenceTier`
outright so the publisher could write a graded `search_index.facets.confidenceTier` for `/records`
to read back. That is the shape of duplication this dependency direction makes tempting and it is
the one to refuse: the copy cost a day of wrong grades on `/records` when the rule changed
(repo-ngojq). The fix was not a better test. Domain now projects the grading INPUTS
(`recordEvidenceInputs`), the index caches those, and every surface applies the single rule at
read time. When this rule forces a choice again, project the inputs across the boundary and keep
the judgment on one side — do not copy the judgment.

**App/API compatibility policy (ADR-021 §2).** A client is incompatible when its app build is
below the manifest's `minSupportedAppBuild` floor, or when it speaks an API major version the
manifest no longer supports. `apiVersion`/`minSupportedApiVersion` mirror the URL-prefix major
version and are the values `/v1/bootstrap` echoes; `minSupportedAppBuild` is the numeric store
build below which a client must force-update. `evaluateClientCompatibility` in
`packages/domain/src/publication/mobile-bootstrap.ts` is the evaluation, mirroring what the server
enforces through the `X-BlackStory-Client` header and `CLIENT_VERSION_UNSUPPORTED`.
(from ADR-021 §2, "app/API compatibility")

**What this recovery now covers.** The 2026-09-13 extension below (repo-gtm2y) takes the rest of
what the citations reference: §1's `@repo/public-contracts` boundary and what
`scripts/check-boundary.mjs` actually gates, §3's public-response redaction discipline and the
submissions surface, §4's HTTP-only / types-only-from-contracts line, and the numbered red-team
resolutions #1 (the deprecation window), #2 (`X-BlackStory-Client` / `CLIENT_VERSION_UNSUPPORTED`
is a UX affordance for honest clients, never a security control) and #3 (correction shapes stay in
the contracts package). Those citations are repointed here rather than left pointing at a file
that does not exist.

What is deliberately NOT restated: the decisions in the ADR-021 that actually survived to the
purge — Expo managed workflow with CNG, Expo Router, MapLibre Native, `expo-sqlite`, the
version-pinning policy, the gitignored `ios/`/`android/` directories, and the iOS 16.4 / Android
API 26 floor. Nothing in the citations recovered below is about any of that, for the reason the
next paragraph gives.

### Extension, 2026-09-13 (repo-gtm2y): the rest of what the ADR-021 citations mean

**A number collision, found while recovering the rest — do not merge the two meanings.** Every
"ADR-021 §N" in this repository's code means the document that was renumbered to **ADR-022** on
2026-07-19 (commit `3b365d44`, which moved `ADR-020-mobile-stack.md` to `ADR-021` and
`ADR-021-mobile-data-boundary.md` to `ADR-022`). This is the same off-by-one the 2026-09-12
repo-30k6 addendum above found for the cache/offline and build/release numbers, one rename earlier
than that note dates it. Under the numbering that survived to the purge, `ADR-021-mobile-stack.md`
is the Expo / MapLibre Native / SQLite decision — §1 framework, §2 map, §3 Firebase access, §4
local storage — and not one of the forty-eight citations recovered here is about any of that;
their §1..§4 and their numbered red-team resolutions match `ADR-022-mobile-data-boundary.md`
section for section, in both its pre- and post-rename copies. The mobile-stack decision is cited
elsewhere under its own pre-rename number, ADR-020 (`apps/mobile/app.config.ts` still names the
dead path `docs/adr/ADR-020-mobile-stack.md`), which is the ADR-020 collision already on record.
The section numbers below are the ones the code uses; they are stable across the rename, which is
why they are kept.

**Section 1 — the `@repo/public-contracts` boundary, and what the gate actually checks.** The
package declares exactly one runtime dependency, `zod`. Its `devDependencies` (`@types/node`,
`tsx`, `typescript`) are build and test only, and `tsconfig.json` sets `"types": []` so no host
ambient — `process`, `URL`, DOM — is even in scope, which is why `src/internal/primitives.ts`
validates URLs with a regex instead of `new URL()`. The gate is
`packages/public-contracts/scripts/check-boundary.mjs`, and it is a real CI gate rather than a
convention: it is the first half of the package's own `test` script, so CI's "Run package tests"
step (`pnpm -r --filter './packages/**' run --if-present test`, `.github/workflows/ci.yml`) runs
it, and any change under `packages/public-contracts/` puts that lane in scope
(`scripts/ci-local.sh`). (from ADR-021 §1, "hard boundary, not a convention")

What it checks is narrower than its own header comment reads, and the narrowing matters. The gate
is an ALLOWLIST: `ALLOWED_EXTERNAL_SPECIFIERS` is `new Set(['zod'])`, and any non-relative
specifier that is not `zod` fails. The named `FORBIDDEN_PACKAGE_SPECIFIERS` list —
`firebase-admin`, `@repo/domain`, `@repo/security`, `@repo/ops-data` — only changes the wording of
the failure message; it is not what catches anything. So `@repo/firebase` and a direct Firestore
import, both named in that header, do fail, but as an "unlisted external dependency" rather than
by name. Every `node:`-prefixed specifier and every bare Node built-in name on the script's own
list fails as well.

"Transitive" is also narrower than it sounds. `scanOwnSource()` regex-scans every `.ts` under
`src/` except `*.test.ts` and `src/testing/**`. `scanEntrypointGraph()` starts from the files
`package.json`'s `exports` map names under the `development` condition and follows RELATIVE
imports only. The one step past this package's own files is: for each external specifier that got
through (only `zod` can), read that package's `package.json` and fail if it declares any runtime
dependency at all. That is a "zod has zero runtime dependencies" assertion, not a bundle. No code
is executed, Metro is never run, and the script says so in its own closing paragraph. (from
ADR-021 §1, "a compile-time gate ... rather than code review")

`src/testing/load-fixture.ts` uses `node:fs`, `node:path` and `node:url` legitimately. Its
exclusion from the first pass is not what keeps that safe — what keeps it safe is that no
`exports` entry points at it, so the entrypoint-graph pass never reaches it. Add an `exports`
entry for `./testing` and the gate fails, which is the correct behavior and the actual guard.

**Section 3 — what a public response cannot carry, and what still depends on the producer.** Three
of the four "omitted by construction" claims at the top of
`packages/public-contracts/src/v1/entity.ts` hold exactly as written. There is no numeric
notability or relevance score anywhere in the contract: `notabilityBasisEntryV1Schema` carries
`criterion`/`note`/`evidenceIds`, all strings, and `notabilityLabels` are bounded strings.
`locationPrecisionSchema` is a closed enum of four tiers — `city`, `neighborhood`, `campus`,
`institution` — so `'address'` and `'exact'` cannot be expressed, and `entity.test.ts` asserts it.
No reviewer identity, moderation state, abuse signal, or internal source-lineage rollup field
exists; claims carry only the public `independentLineageCount`.

The fourth is weaker than the comment reads, and this is the correction worth keeping.
`geoAnchorV1Schema` carries numeric `lat`/`lng` bounded only to valid coordinate ranges, so the
wire type CAN express a street-level point. The precision guarantee is not structural: it is the
closed `locationPrecision` enum plus the projection that produced the anchor, both upstream of the
contract. The true statement is "the contract cannot express a precision tier finer than
institution," not "the contract cannot express a raw coordinate." (from ADR-021 §3, "no precise
location ... in any v1 response shape")

The mechanical redaction is the zod parse. `apps/api-public/src/http/data-access.ts` validates
every entity against `entityV1Schema` before it leaves the module and zod strips unknown keys, so
the guarantee holds across adapters rather than per adapter.
`apps/api-public/src/http/redaction.test.ts` is the negative snapshot that proves it: it pushes a
deliberately polluted entity through the real router and asserts that `notabilityScore`,
`relevanceRankingScore`, `preciseLocation`, `residentialAddress`, `internalReviewNotes`,
`sourceLineageInternal`, `moderationState`, `draftOnly`, `unpublishedStatus` and `__collection`
never appear; that a search result additionally carries no `score`, `relevance`, `evidenceCount`
or `connectionCount`; that a citation's `protectedFromPublicLink`, `protectedReason` and
`internalDocumentId` are stripped; and that a media object's `gsUri` never reaches the wire.
`toSearchResult` is where the no-number rule lives on the search path — a result explains itself
through `matchedOn`, `matchedText` and `explanation`.

One part of section 3 is NOT gated by anything. `errorResponse` in
`apps/api-public/src/http/responses.ts` emits a bounded `message` and bounded `details`, but
nothing inspects what a caller put in that string; `publicApiErrorSchema` bounds shape and size
only. "Never a stack trace, internal path, collection name, or secret" is discipline at each call
site, not enforcement, and should be read that way.

**The submissions surface, and the one comment about it that had gone stale.**
`apps/api-submissions` serves the corrections write path today: `src/http/router.ts` routes
`POST /v1/corrections` and `POST /v1/corrections/status` into `src/http/handlers.ts`, and every
write goes through `createSubmissionQuarantineService().intake()`, so a client can enqueue a
quarantined correction and nothing else. `apps/mobile/src/features/corrections/contract.ts` still
said the route was not wired; that was true when it was written and is not true now. (from
ADR-021 §3, "no write endpoints beyond the single, explicit exception")

Red-team resolution #3 — keep the correction shapes in `public-contracts`, do not fork a second
contracts package — is only half-honored, and anyone about to treat it as settled should know
that. `packages/public-contracts/src/v1/corrections.ts` exists and is exported at
`./v1/corrections`, but nothing imports it: `apps/api-submissions` does not depend on
`@repo/public-contracts` at all, and `apps/mobile/src/features/corrections/categories.ts` and
`contract.ts` declare their own copies. The category and target vocabulary is written out three
times — web, mobile, api-submissions — plus that unused contract module. What makes the
duplication safe is real and is stated in every copy: the server re-validates against its own list
on intake (`correction-intake.ts`), so a drifted client fails a submission rather than smuggling
an unknown category through.

**Section 4 — HTTP-only holds; "types only" does not.** Mobile does reach the server over HTTP
only: `apps/mobile/src/security/api-client.ts` for `apps/api-public`, and
`src/features/corrections/client.ts` for `apps/api-submissions`. There is no server import path,
and the only client write is the quarantine intake.

The "types only, no runtime coupling" half is not what the code does any more.
`apps/mobile/package.json` declares `@repo/public-contracts` as a `file:` dependency, and mobile
imports runtime values from it: `mapSourceV1Schema` is parsed at runtime in
`features/explore/map-source-client.ts` and `features/entity/use-ordered-entity-ids.ts`,
`evidenceLabel` and `evidenceMeterLabel` come from `/evidence`, `stripInternalIds` from
`/narrative-text`, the destination catalog from `/destinations`, and `ENTITY_KINDS` and
`CLAIM_ROLES` from `/v1/entity` and `/v1/claim`. The invariant that actually holds is the narrower
one the ADR's own diagram note stated: the package carries no shared runtime service, singleton or
transport, only pure zod schemas and pure functions — which is exactly what `check-boundary.mjs`
keeps true. Several mobile files still carry an "INTEGRATION GAP" note saying
`@repo/public-contracts` cannot be imported here; `features/entity/types.ts` said it four lines
above an import of it.

"Mobile never imports `@repo/domain`" is likewise no longer literally true, and this one carries
more weight. `apps/mobile/package.json` declares `@repo/domain` and `@repo/domain-core` as `file:`
dependencies, and `src/features/record-facts/record-facts.ts` imports `deriveEraBuckets`,
`filterDecadesAtOrBeforeCurrent` and `isDatePrecision` from `@repo/domain/era` — a re-export shim
over `@repo/domain-core/era`, a package that carries no node or `firebase-admin` dependency.

A correction to how this got here: `eas-build-post-install` does NOT compile both, despite
declaring both as dependencies. The script only runs `tsc` for `public-contracts` and for
`domain` — it never separately builds `domain-core`, even though `domain`'s own `package.json`
depends on `@repo/domain-core` and `domain`'s `tsconfig.json` resolves that import through
`node_modules`, which needs `domain-core`'s (gitignored) `dist` to already exist. Removing that
`dist` and re-running `tsc -p packages/domain/tsconfig.json` fails immediately with dozens of
"Cannot find module '@repo/domain-core/...' or its corresponding type declarations" errors
(confirmed by doing exactly that). Whether the real EAS Build cloud environment has
`domain-core` built by some step outside this script is not established here and should be
checked before trusting that a from-scratch native build actually succeeds. What is forbidden
in practice is the barrel and any server-only subpath, not the package name. Nothing lints
that. `scripts/validate-boundaries.mjs` does reach `apps/mobile` — it discovers every
directory under `apps/` and `packages/` that carries a `package.json`, independently of the pnpm
workspace `apps/mobile` is excluded from — but its only rules are app-cannot-import-a-deployable-
app, one `@repo/data-access` file rule for the staff-gated admin routes, and dependency cycles.
None of them says anything about which `@repo/domain` subpath a client may import. A reviewer is
the only thing between the mobile bundle and a node built-in on this edge.
(from ADR-021 §4, "apps/mobile NEVER imports packages/domain or packages/firebase directly")

**Red-team resolution #1 — the deprecation window is documentation, and the soft signal is
dormant.** `DEPRECATION_WINDOW_DAYS = 90` lives in `packages/public-contracts/src/version.ts` and
`version.test.ts` asserts the value. Nothing reads it to retire anything; `evaluateCompatibility`
only echoes it into the `/v1/compatibility` body. That is deliberate — the constant is a floor,
not a timer — but it does mean the ninety days is kept by a human holding a bead, not by code. The
soft nudge is `softDeprecated`, computed in `packages/public-contracts/src/v1/compatibility.ts` as
`supported && !isCurrentMajor`, which `handleCompatibility` turns into a `Deprecation: true`
response header. Two narrowings the citations hid: that header rides only `/v1/compatibility`,
never an ordinary read, so an honest client learns it by asking rather than by being told; and
with `API_VERSION` and `MIN_SUPPORTED_API_VERSION` both `'v1'` today, `softDeprecated` is false
for every real client and the header is never actually sent. The path exists and is unexercised
until a `v2` ships. (from ADR-021 red-team resolution #1, "deprecation window length")

**Red-team resolution #2 — the floor fails open, on purpose.** `parseClientApiVersion` in
`apps/api-public/src/http/handlers.ts` returns `undefined` for an absent or unparseable
`X-BlackStory-Client` header, and `enforceClientFloor` returns `null` — serve normally — on
`undefined`. Omitting the header is therefore never a denial, and that fail-open is the
code-level expression of "a UX affordance for honest clients, never a security control." The floor
runs on five read handlers.

A claimed asymmetry does not survive checking. `isApiVersionBelowFloor` does fail CLOSED (treats
as below-floor) on a value its own `/^v(\d+)$/` regex can't parse — `compatibility.test.ts`
asserts exactly that — but no live HTTP request can reach that branch. `parseClientApiVersion`'s
own regex already reduces every header it can parse at all into a canonical `v<digits>` string
that `isApiVersionBelowFloor`'s regex always accepts, and any header it cannot parse becomes
`undefined`, which both live call sites (`enforceClientFloor` and `handleCompatibility`) treat
exactly like an absent header. So today there is no HTTP-observable difference between a client
that sends nothing and one that sends an unparseable version string — both are served normally.
The fail-closed branch is real and unit-tested; it just is not reachable from `apps/api-public` as
the code stands today, only from a caller that invokes `evaluateCompatibility`/
`isApiVersionBelowFloor` directly with an already-malformed string.
`CLIENT_VERSION_UNSUPPORTED` and `CLIENT_VERSION_UNSUPPORTED_HTTP_STATUS = 426` sit together in
`packages/public-contracts/src/errors.ts`, and `responses.ts`'s `ERROR_CODE_STATUS` reads the
constant rather than repeating `426`, so both sides compile against one pair. Nothing here is an
authorization boundary: the real controls are server-side re-validation of every parameter and the
absence of a canonical write path. (from ADR-021 red-team resolution #2, "header spoofing")


## Vector search (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-014-vector-search.md` does not exist and never survived the 2026-07-24 purge, but it
is cited 14 times outside the built export, and three of those citations name the dead file PATH,
so a reader can try to open it and get nothing. Recovered here from the code that implements it.

**Embedding shape.** Every entity vector is `gemini-embedding-001`, Matryoshka-truncated and
unit-normalized to 768 dimensions (`packages/ops-data/src/embeddings/constants.ts`:
`EMBEDDING_MODEL`, `EMBEDDING_DIMS`). 768 is not a preference — it is a hard gate: the storage
column is `extensions.vector(768) NOT NULL`
(`supabase/migrations/20260720220006_canonical_entities_claims.sql`), so a vector of any other
width fails to insert. The pipeline truncates and renormalizes locally even when it also asks the
server to truncate (`gemini-provider.ts`), so the stored vector does not depend on the provider
honoring that request. (from ADR-014, "vector search")

**Similarity measure.** `DOT_PRODUCT`, which is equivalent to cosine similarity on unit-normalized
vectors and cheaper (`constants.ts`: `DISTANCE_MEASURE`). This is only true while the vectors are
in fact unit-normalized, which is why normalization is part of the pipeline rather than a caller's
responsibility. (from ADR-014, "vector search")

**Gemini Developer API, not Vertex AI.** The embedding call uses the API-key Gemini Developer
surface. The decision rejected Vertex AI *Vector Search* for the index itself because it carries an
always-on per-node cost floor, and kept the embedding *call* off Vertex too rather than pull in
project/location plumbing this project otherwise avoids (`gemini-provider.ts` header). The
consequence a reader needs: a real embedding run requires a live `GEMINI_API_KEY`, and there is no
Vertex fallback path to reach for. (from ADR-014, "vector search")

**Pre-filters are `kind`, `state` and `eraBucket`**, derived at embed time rather than joined at
query time (`packages/ops-data/src/embeddings/text.ts`). `eraBucket` is single-valued and is simply
omitted when an entity has no temporal anchor, so a filtered query silently excludes undated
records rather than erroring. `state` was omitted entirely by the Postgres backfill source until
2026-09-13 (repo-9qf9); it now resolves from `projection->>'jurisdictionLabel'`.

**Not wired live.** `@repo/domain`'s `similarity` surface (candidate recall, near-duplicate
detection) is pure math with no I/O, and wiring it into the live discovery workflow
(`workers/research/`) was left undone by the decision, not by an oversight since corrected. It is
still not wired.

**Kill switch: reused, not dedicated.** Semantic search IS gated, and a comment claiming
otherwise is wrong. `apps/api-public/src/vector-search-kill-switch.ts` reuses the existing `search`
core switch id from `@repo/config` rather than introducing a `vector-search` id, on the grounds
that vector search is "dynamic search" under that switch's own description. The reuse is
load-bearing rather than lazy: `search` is already in `STATIC_MODE_DENIED_SWITCHES`, so
`public-static-mode` stops semantic search too, which a fresh dedicated id would not have
inherited. `vector-search-endpoint.ts` evaluates it as step 2 of its request path.

What ADR-014 recorded as a GAP is narrower than "no kill switch": there is no way to stop semantic
search *independently of* text search. Adding a dedicated `vector-search` core id is a small
additive change to `packages/config` if that control is ever wanted. (from ADR-014, "vector
search")

## Jurisdiction reference data (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-016-jurisdiction-reference-data.md` does not exist. Three source comments cite it by
that dead path, one of them for a rule that governs two copies of the same code. Recovered from the
code.

**The jurisdiction id scheme is `us` / `us-{2-digit state FIPS}` / `us-{2-digit state FIPS}-{3-digit
county FIPS}`**, built by `countryJurisdictionId` / `stateJurisdictionId` / `countyJurisdictionId`.
It is defined in `packages/ops-data/src/jurisdictions/schema.ts` and duplicated, byte for byte, in
`packages/domain/src/geocode/jurisdiction-ids.ts`. The duplication is deliberate and narrow: only
the pure string builders are copied, never the schema, loader or resolver. `@repo/domain` cannot
import `@repo/ops-data` because ops-data already depends on domain at runtime, so the reverse edge
would close a cycle — the same dependency-direction rule recorded above for `public-contracts`.
Any change to the id format must be mirrored in both files by hand; nothing enforces the agreement
today, which makes this a rule a reader must actually follow rather than one a gate will catch.
(from ADR-016, "jurisdiction reference data")

**County bounding boxes from the Gazetteer are an approximation, and are labeled as one.** The
Census Gazetteer county file carries a centroid (INTPTLAT/INTPTLONG) and land/water area but no
bounding box, so `approximateCountyBBox` centers a square sized to the county's total area on that
centroid and stamps the row `bboxSource: 'census-gazetteer-area-approximated'`
(`packages/ops-data/src/jurisdictions/tiger-gazetteer.ts`). `JURISDICTION_BBOX_SOURCES` exists so
that a coarse box can never be mistaken for a precise one: the alternatives are
`us-geography-module`, `census-cartographic-boundary` and `manual`. This is the same deliberately
coarse, never survey-grade posture `us-geography.ts` takes for state bboxes. A precise box can be
backfilled from Census cartographic boundary shapefiles later; recomputing it here would duplicate
the map-tile pipeline. (from ADR-016, "jurisdiction reference data")

**ZIPs are never stored as reference data — translate then discard.** A user-entered postal code is
used ONLY to ask what place, state and county it falls within, and the raw input is never persisted
and never returned. `normalizeUsZipInput` reduces a ZIP or ZIP+4 to its 5-digit base for centroid
lookup only; `zip-translate.ts` resolves that to an approximate centroid and reverse-geocodes the
coordinates through Census for jurisdiction ids, because the Census forward `onelineaddress`
endpoint does not match a bare ZIP. This is a privacy rule, not a data-modeling preference: it is
what keeps a reader's typed location out of the record. Treat any change that persists a ZIP as
reversing a decision, not as adding a field. (from ADR-016 §1, "ZIPs: never stored as reference
data")

**Cities are on-demand only, keyed by Census place FIPS**, and the writer does not exist yet. The
`us-{state}-place-{5-digit place FIPS}` id is a proposal: `buildPlaceCreateHint` returns the id a
future on-demand creation pass should use plus the minimal fields it would need, and this module
writes nothing. The loader populates only the 50 states plus D.C. from the same table. So a reader
finding `placeId` on a resolved match should not assume a `jurisdictions/{id}` document exists for
it — it is a hint, never a write. (from ADR-016 §1, "cities: on-demand only")

## Search and geocoding (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-008-search-and-geocoding.md` does not exist. Eleven source comments cite it, one by
that dead path, and two of them carry privacy rules. Recovered from the code.

**Geocoding is the US Census Geocoder, with no key and no vendor rate-limit contract.** Every
request uses benchmark `Public_AR_Current` and vintage `Current_Current`
(`packages/domain/src/adapters/census-geo/types.ts`). It is a public, unauthenticated "reasonable
use" service, so there is no vendor-issued key to rotate and no quota the vendor enforces — what
actually bounds call volume is this repo's own `geocoding` endpoint-class quota in
`packages/security/src/rate-limits.ts`. Parsing is defensive throughout
(`census-geo/response-parser.ts`) because the API is not versioned in a way this repo controls: a
missing or renamed field must degrade one match, never throw on the batch.
`wikidata-place-coords.ts` exists for research enrichment only and must not become a second product
geocoder. (from ADR-008 decision 4, "search and geocoding")

**Exact coordinates are reduced when no longer needed, and retention is opt-in.** A geocode call
needs the exact lat/lng only long enough to resolve state/county/place ids; after that the exact
coordinate serves no product purpose for an ordinary lookup and is dropped.
`neededForPublic` and `retainExactCoordinates` both default to `false`
(`packages/domain/src/geocode/coordinate-precision.ts`), so a caller must opt IN to keeping it —
`/locate`'s `camera=1` is such an opt-in, for a one-shot map fly-to. This is a DIFFERENT and
earlier layer than `packages/security/src/redaction.ts`'s `reducePublicPrecision`, which governs
what a PUBLISHED entity location may show; this one governs what the geocode response retains
before anything is published or even persisted. Both move in one direction only, coarser and never
finer, and they are deliberately not merged. (from ADR-008 decision 5, "search and geocoding")

**Product scope for address discovery is the 50 states plus D.C.** Scope is derived from the same
`US_STATES` table that `../map/us-geography.ts` owns as the single source of truth, never a second
hand-typed FIPS list. A Census match for a territory (PR `72`, GU `66`, VI `78`, AS `60`, MP `69`)
has a real state-equivalent FIPS but is out of scope, and `evaluateGeocodeProductScope` reports
that rather than resolving ids for a state row the `jurisdictions` collection will never contain —
only the 50 states plus D.C. are loaded from that table. The Gazetteer loader skips the same rows
on the same line. Note this gate was NOT widened by the 2026-09-12 owner ruling that the Atlas
supports non-US birthplaces (repo-9rkh), even though the ruling named this file: the gate only ever
receives a US Census Geocoder match, and that service does not geocode non-US places at all, so
widening the set would be a no-op for the actual need. (from ADR-008, "search and geocoding")

**Bounded, and never a read-time geocode.** State attribution in `findUsStateForPoint`
(`packages/domain/src/map/us-geography.ts`) is a bounded local lookup against a vendored 50-state
bbox table, not a geocoder call, and `buildMapSource` uses it for every feature it emits. Geocoding
happens upstream on the write path, and the map a reader sees is built only from the active
release's own published projections, so no reader-facing request reaches the Census Geocoder. That
is the part of this decision that holds.

The "static-first" half of the original phrasing does not, and was narrowed on 2026-09-13
(repo-uogug). It cited a demo generator, `packages/domain/src/map/generate-demo-map-source.ts`,
which has been retired along with the `/map` demo route it fed. Neither live map surface reads a
prebuilt artifact: `api-public`'s `GET /v1/map` builds its FeatureCollection per request from
`listEntities(releaseId)` (`apps/api-public/src/http/handlers.ts`), bounded by a `public,
max-age=60, stale-while-revalidate=300` cache rather than by a static file, and web `/explore`
builds its own source from the active-release catalog. The static release artifact
(`public/releases/{id}/map/source.json`) is implemented in `release-activation.ts` and has neither
a live producer nor a live consumer, as the "Map stack" section records. Nor does "no live
third-party call" survive at the basemap layer: web `/explore` renders OpenFreeMap vector tiles
live (`OPENFREEMAP_TILE_SOURCE_URL` in `apps/web/src/lib/map-experience/dignity-style.ts`). Read
this decision as a rule about geocoding, which is its own territory, not as a rule about how map
data is served. (from ADR-008, "search and geocoding")

## Service surface separation (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-005-service-surface-separation.md` does not exist. Six source comments cite it as
binding law across `packages/config` and both public-facing API apps; a further nine `docs/`
references (`service-surfaces.md`, `ingress-armor.md`, `admin-identity.md`,
`environment-isolation.md`, `vercel-public-web-cutover.md`, the mobile threat model, and
`docs/architecture.md`) treat it the same way. Recovered from the code, the CI workflow that would
deploy it, and the docs that already admit it never was.

**The typed capability matrix is real and tested, but only as a code-level contract.**
`packages/config/src/surfaces.ts` defines five surface ids (`web`, `api-public`,
`api-submissions`, `api-internal`, `admin`) each with a declared `networkPosture`,
`allowedOperations`, `acceptedAuth` and `mustNotAcceptAuth`, plus `assertOperationAllowed` /
`assertAuthAccepted` helpers that throw `SurfaceCapabilityError`. `packages/config/src/surfaces.test.ts`
runs in CI (`packages/config/package.json`'s `test` script lists it explicitly) and genuinely
verifies the matrix's own logic — e.g. `deniesPublication('api-submissions')` and
`deniesCanonicalWrite('api-public')` are both true. This part of ADR-005 is true today. (from
ADR-005, "service surface separation")

**Whether that matrix is actually consulted on a live request path is mixed, and this is the real
gap.** `apps/api-submissions/src/quarantine.ts:185` and `:278` call `guardIntakeOperation` and
`guardPublishAttempt` for real, inside the actual intake handler — this surface's "cannot publish"
guarantee is live-enforced. `apps/api-public` is the opposite: `posture.ts` defines
`guardReadOperation` / `guardMutationAttempt` and `index.ts` re-exports them, but nothing outside
their own tests ever calls them (`grep -rn "guardReadOperation(\|guardMutationAttempt("` across
`apps` turns up only the definitions, the compiled `.d.ts`, and no call sites). The comment at
`apps/api-public/src/http/router.ts:22` credits ADR-005 for making this surface read-only, but the
line immediately below it is the actual live gate: a hardcoded `request.method !== 'GET' &&
request.method !== 'HEAD'` check that 404s everything else. The typed posture guard is an unused
safety net here, not the operative control. `apps/api-internal` is further still: its `src/`
contains only `posture.ts`, a health-payload `index.ts`, and `index.test.ts` — no HTTP server, no
handlers, no route ever calls it (`grep -rln "api-internal"` outside tests/config/docs finds
nothing that dials it). The "private-network, service-identity-only" surface is a pure-function
contract with a unit test, not a deployed boundary. (from ADR-005, "service surface separation")

**The network-level isolation ADR-005 describes — Cloud Run, IAP, separate ingress — has never
been deployed, and three independent sources say so.** `docs/architecture.md` labels all three API
apps "Cloud Run deploy unverified" and calls `infra/*` "Leftover Firebase/GCP scaffolding, GitHub,
parked PostGIS." `.github/workflows/deploy-production.yml`'s `deploy-surfaces` job is literally
named "Deploy Surfaces Dry Run" and its one step, "Surface deploy plan (no live apply)," only
echoes lines like `deploy-api-public → Cloud Run black-book-api-public` — there is no live-apply
step anywhere in the repo for these three apps. `docs/security/environment-isolation.md` (an
ADR-005 dependency) says outright that its GCP multi-project split is "designed, not yet
provisioned" and that the single project `black-book-efaaf` is what is actually live. Only
`apps/api-public` even has a `vercel.json`; `api-submissions` and `api-internal` have none. A
reader looking for the deployed, network-isolated surfaces ADR-005 promises will not find them —
what exists is in-repo TypeScript and a dry-run print statement. (from ADR-005, "service surface
separation")

**The one surface separation that is actually live today is not what ADR-005 describes, and one of
its own acceptance tests no longer means what it says.** Admin was folded from a standalone
deployable into a staff-gated route group inside `apps/web` (2026-09-11, see the addendum above and
`docs/security/service-surfaces.md`); it had already moved once before, into its own standalone
Vercel project in 2026-07-25, gated by Postgres roles "not an IAP boundary" per
`docs/runbooks/vercel-public-web-cutover.md:147`, which says plainly that ADR-001/ADR-005 predate
that cutover. The boundary that actually holds today is credential scope plus a static import
check: `apps/web/src/admin/canonical-write-boundary.test.ts` walks every non-admin file under
`apps/web/src` and asserts none of them imports `canonical-postgres-client.ts` (which alone reads
`ADMIN_DATABASE_URL`) or `canonical-write.ts`. It runs in CI via `apps/web`'s test glob and its own
header says it *replaces* the ADR-005-era "no imports from apps/web" check, "which stopped meaning
anything once admin became a route group inside this same app." Meanwhile
`packages/config/src/surfaces.test.ts`'s `'admin and web are separate deployables with distinct
identities'` test still passes — but only because it diffs `serviceAccountId` and `runtime` fields
that `surfaces.ts`'s own admin entry comment admits are "already stale (this surface runs on
Vercel, not Cloud Run)." The test proves two hardcoded strings differ, not that admin and web are
separate deployables — they are the same Vercel deployment today. Treat that one green test as
proving less than its name claims. (from ADR-005, "service surface separation")

**`api-submissions` not importing `apps/web` is true, but nothing lints it.** The rule at
`apps/api-submissions/src/corrections/categories.ts:8` holds only as a structural consequence of
`apps/api-submissions/package.json` never declaring `apps/web` as a dependency (so pnpm's workspace
resolution would not resolve such an import); no dedicated lint rule, dependency-cruiser config, or
CI check enforces it directly — a search of the repo's ESLint config and every app under `apps/`
turned up none. If someone ever adds `apps/web` to that package's dependencies, this boundary
silently disappears with no gate to catch it. (from ADR-005, "service surface separation")

No number collision found for ADR-005. Every citation, including the mobile threat model's
"(ADR-005; never a canonical write — invariant 6)" at `docs/mobile/security/threat-model.md:543`,
consistently means the same decision; that line sits next to a separate citation of "ADR-011 §7;
invariant 6" making the same substantive claim from the client's-eye view, which is convergence on
one numbered invariant, not a collision.

## Scheduled-job worker packages (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-007-*.md` does not exist. Seven source files cite it (eight citation sites), one of
them already disclosing part of the gap below in its own comment. Recovered from the code.

**The mechanism ADR-007 picked (Cloud Scheduler -> Cloud Tasks -> Cloud Run Jobs/workers) has
never been applied to live GCP.** `infra/gcp/scheduler/scheduled-jobs.json` carries
`"status": "design"` and its own note: "Declarative mirror only — not applied to live GCP." The
Python worker this mechanism was meant to drive says so about itself:
`workers/research/src/black_book_research/scheduled_jobs.py`'s module docstring reads "Historical
Cloud Scheduler dispatch targeted Cloud Run Jobs (ADR-007). Scheduled discovery and overnight
enrichment now run on Corsair/systemd against the Postgres research ledger." A reader looking for
a deployed Cloud Scheduler job will not find one. (from ADR-007, "scheduled-job worker packages")

**What actually dispatches jobs today bypasses the picked mechanism entirely.** Discovery
campaigns — the roster's flagship "real" jobs — run on Corsair systemd
(`docs/runbooks/discovery-campaign-automation.md`), writing directly to Postgres, or through
GitHub Actions' `discovery-campaigns.yml`, which calls `operator-cli`'s `discovery-dispatch`
command directly on the Actions runner. Neither path touches Cloud Scheduler, Cloud Tasks, or a
Cloud Run Job image. (from ADR-007, "scheduled-job worker packages")

**The allow-list on `targetWorker.package` is the one part of ADR-007 that is real and enforced
today — but it only checks a label, not where code actually runs.**
`TARGET_WORKER_PACKAGES = ['research', 'publication', 'security']`
(`packages/config/src/scheduled-jobs/types.ts:16`) is validated by
`assertScheduledJobDefinitionValid` (`packages/config/src/scheduled-jobs/registry.ts:57-61`),
called from `registerScheduledJob` (`registry.ts:117`) for every entry in
`DEFAULT_SCHEDULED_JOBS` (`roster.ts:483`), and covered by
`registry.test.ts:101`. This is genuinely live: it fails closed if a job definition names a
fourth package. But it is a config-time check on a string field, not a constraint on what gets
deployed — see the next two points. (from ADR-007, "scheduled-job worker packages")

**Most "real" `targetWorker.function` strings name Python code that was never written.** Of the
roster's `research`-package jobs, only `source-drift-run-health-check` has a real Python
implementation (`evaluate_run_health` and friends, in `scheduled_jobs.py`). The rest —
`discovery.campaign.run_rss_campaign`, `reddit.deletion_sync.run`, `legal.change_monitoring.run`,
`dataset_refresh.check_fbi_hate_crime`, and the other discovery-campaign entries — are label
strings shaped like Python module paths with no corresponding Python function. Their actual job
bodies are TypeScript, in `packages/config/src/scheduled-jobs/jobs/*.ts`, run by Corsair, GitHub
Actions, or the CLI. `targetWorker.package` records which team/domain owns the job, not which
runtime executes it. (from ADR-007, "scheduled-job worker packages")

**"Never a new worker microservice" is violated in the letter, and is inert in effect.**
`workers/research-node/` is a fourth directory under `workers/`, with its own `package.json`,
`Dockerfile`, and `src/main.ts` — real code, added 2026-07-18 and last touched 2026-07-21, still
present today. Its own README calls it "Cloud Run Job (legacy packaging)" and names Corsair
systemd "the preferred production path." Nothing live invokes it: neither the Corsair runbook nor
`discovery-campaigns.yml` builds or runs its Docker image; both call the TypeScript dispatcher
directly. So the repo does contain a fourth worker microservice the decision said never to add,
but it is dead packaging today, not a live deployment — a distinction worth checking before either
deleting it (it is still the only Cloud Run Job entry point on record) or citing it as proof the
rule is unenforced in practice. (from ADR-007, "scheduled-job worker packages")

**One citing comment already told the truth and just needs a live pointer.** The
`backup-verification-daily` roster entry (`roster.ts:369-378`) discloses, in its own words, that
`scripts/backup-restore/` predates ADR-007 and lives outside all three worker packages, and that
its `targetWorker.package: 'security'` label is "closest fit," not a claim the code lives in
`workers/security/`. That self-disclosure is accurate and did not need correcting, only
repointing off the dead ADR path. (from ADR-007, "scheduled-job worker packages")

## Research and discovery cannot publish (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-009-*.md` does not exist. It is cited 48 times outside `.beads/` and the built
`docs/guides` export: 21 times in TypeScript source across 19 files, 22 times in `docs/`, twice in
applied SQL migrations, twice in `infra/gcp/isolation-matrix.json`, and once in
`docs/security/threat-corpus.json`. Every one of those citations means the same decision, so this
is not a number collision. The `Depends on: ADR-009` line in `docs/security/environment-isolation.md`
reads like a second, GCP-flavored ADR-009 until you open that document's machine-readable
companion: `infra/gcp/isolation-matrix.json` pins ADR-009 to acceptance criterion AC-ISO-2, whose
criterion string is literally "Research workers cannot publish". Recovered here from the code.

**"Cannot publish" means four named operations, and nothing broader.** The whole rule reduces to
`FORBIDDEN_DISCOVERY_OPERATIONS` in `packages/domain/src/discovery/guard.ts`:
`write_public_projection`, `create_public_entity`, `activate_release`, `publish_snapshot`. Research
is not read-only and was never meant to be: `role_research` holds full DML on `bb_research` and
insert/update on `bb_evidence` (`infra/database/init/30-grants.sql`), and the research kernel's own
`claim_frontier_task` / `submit_artifact` / `approve_artifact` are granted to it. A reader who takes
a bare "research cannot publish" comment as "research cannot write" will refuse work the decision
permits, which is the exact failure the ADR-021 recovery already found once. (from ADR-009,
"research and discovery cannot publish")

**What actually stops a research identity is the database, not the TypeScript guard.**
`bb_publication.activate_release` (`supabase/migrations/20260720220008_publication_public.sql`) is
SECURITY DEFINER and raises `activate_release denied: research cannot publish` when
`bb_auth.current_role()` is `research`, and it does so *before* the positive
service_role/admin/publication allowlist, so the denial is explicit rather than incidental.
`bb_publication.activate_research_release`
(`supabase/migrations/20260721041950_research_kernel_ledger.sql`) adds a second condition on top:
the release must carry an independent accepted lineage, meaning a different publisher than
producer, a different reviewer than producer, and different reviewer and producer model families.
On the native-role side, `infra/database/init/30-grants.sql` revokes everything on `bb_public` and
`bb_publication` from `role_research` as labeled defense in depth. (from ADR-009, "research and
discovery cannot publish")

**One half of that is gated in CI, and it is the half that runs against stub tables.**
`infra/database/init/91-isolation-checks.sql` asserts that `role_research` inserting into
`bb_public` raises `insufficient_privilege`, and `.github/workflows/ci.yml` runs it through
`pnpm db:init && pnpm db:verify`. The table it inserts into is `bb_public.released_entity`, a
boundary stub created by `infra/database/init/25-boundary-stubs.sql`, not the live
`bb_public.release_entities` that the Supabase migrations define. So CI proves the grant *shape*,
not the live schema, and the `bb_role = 'research'` branch inside `activate_release` has no test
anywhere in the repo. Treat that branch as the load-bearing, untested line it is. (from ADR-009,
"research and discovery cannot publish")

**`assertCampaignCannotPublish()` with no argument blocks nothing, and that is deliberate.** It
checks only that `FORBIDDEN_DISCOVERY_OPERATIONS` is non-empty, a tripwire for a misconfigured fork
(`packages/domain/src/discovery/campaign-runner.ts`). The blocking form is the one-argument call,
and it string-matches an operation label the caller supplies, so `network-traversal.ts` passing
`network_traversal_emit_candidates` can never throw. Several campaign headers and two research docs
describe the entry call as if it blocked the four operations; it does not. Do not "fix" these into
throwing calls. They are declarations that a module has checked itself against the rule, and the
guarantee they stand for is structural, not dynamic. (from ADR-009, "research and discovery cannot
publish")

**The structural guarantee is the real one, and nothing enforces it.** No module under
`packages/domain/src/discovery`, `adapters`, `submissions`, `query-packs` or
`citation-independence` imports a database client or opens a socket. Every live reader is injected
(`readRelationships`, `FindingAidAdapter`, `OralHistoryAdapter`, `HbcuAdapter`,
`BlackPressAdapter`), and adapters register disabled until `approveSourcePolicy` runs.
`scripts/validate-boundaries.mjs` checks dependency direction, deployable isolation and cycles, and
nothing else: there is no lint rule and no CI script that would fail a pull request adding a
Postgres import to a discovery module. This is a rule a reviewer has to hold, not one a gate will
catch. (from ADR-009, "research and discovery cannot publish")

**Automation gets exactly two pre-approved public effects, and that list is enforced.**
`packages/config/src/scheduled-jobs/registry.ts` throws at job registration if a job's
`publicEffect` is anything but `none` or a member of `ALLOWED_AUTOMATIC_PUBLIC_EFFECTS`
(`types.ts`), which holds `link-repair-archived-copy` and `release-coupled-rebuild`. Both are
mechanical and reversible by construction: an archived-copy URL is added alongside the original and
never replaces evidence, and a release-coupled rebuild is idempotent against an already activated
release. This is the one code-side gate on this rule that actually throws today. The neighboring
rule in `publish-guard.ts`, that every job path reaching a public surface must call
`assertScheduledJobOperationAllowed`, is honored by one of the 14 job modules
(`citation-link-health-sweep.ts`); the other 13 are safe only because they declare `publicEffect:
'none'`. (from ADR-009, "research and discovery cannot publish")

**The operator research CLI has no publish verb to call.** `TargetedBriefDecision.action` in
`packages/operator-cli/src/research-directive.ts` is the closed union `stage_for_review | hold |
reject`. Adding a publishing outcome to a research directive is a type error, caught by
`pnpm typecheck` in CI, which makes this the cheapest enforcement of the rule anywhere in the tree.
The staff coverage-gap surface is shaped the same way: `bb_ops.coverage_gap_by_county_decade`
(`supabase/migrations/20260724000003_coverage_gap_view.sql`) is SELECT-only, gated twice by an
in-view `bb_auth.is_staff()` predicate and by grants, with `REVOKE ALL` from anon. A low coverage
ratio there is a prioritization signal and never a claim that history is absent. (from ADR-009,
"research and discovery cannot publish")

**Community intake reaches `relevance_review` by routing, not by the mechanism its comments
claim.** `packages/domain/src/submissions/community-campaign.ts` states twice that hard-coding
`signals.outcome` to `candidate_only` makes the module "structurally incapable of self-including".
That is wider than the code: both the score ceiling in `relevance/decisions.ts` and the downgrade in
`relevance/gates.ts` require `weak` AND `candidate_only`, and the module sets strength `medium`
whenever a submission carries a citation and a year, so a strong submission can reach decision
`include`. The guarantee holds anyway, by a different route: `scoreCommunitySubmission` hard-codes
`routing.targetState` to `relevance_review` regardless of the decision and stamps
`cannotPublishAlone: true` on every brief and assessment. A later change that relaxes the routing
because "the outcome gate already handles it" would remove the only thing that actually handles it.
(from ADR-009, "research and discovery cannot publish")

## Security and abuse assumptions (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-010-security-and-abuse-assumptions.md` does not exist. Two source comments cite it
directly, and the rest of `docs/security/` and `docs/mobile/security/threat-model.md` treat its
assumptions as binding without restating them anywhere a reader can open. Recovered from the code
that implements each assumption today.

**Client attestation is a trust signal, never an authorization gate.** `X-BlackStory-Client`
(`packages/security/src/client-attestation.ts`, `createClientAttestationGuard`) proves only that a
caller is an honest shipped client; the decision it returns (`allowed`/`verified`) never unlocks
data by itself. `evaluateQuota` (`packages/security/src/rate-limits.ts`) is where it actually bites:
a static read fails open regardless of attestation, but an unattested `anonymous` caller on an
`expensive_read`/`mutation` endpoint IS hard-denied (`app_check_required`) under normal operation —
this is deliberate enumeration defense, not a bug — and it relaxes only to a bounded 0.25x degraded
quota, never to free access, during a confirmed `appCheckAvailability: 'outage'`. A reader checking
whether a missing header can ever deny a *read* should check the endpoint's cost tier, not assume
one answer for all reads. (from ADR-010, "security and abuse assumptions")

**Anonymous users never write canonical history.** Corrections and submissions land only in the
`apps/api-submissions` quarantine pipeline; a canonical write requires an authenticated admin/
research role (`canonical:write`/`canonical:merge`/`canonical:bulk_write` through
`commitCanonicalWrite`) — already recorded in the 2026-08-04 addendum above. This ADR-010 assumption
and that addendum are the same fact from two directions; not restated further here.

**Perfect bot elimination is out of scope; the guarantee is cost and integrity bounds, not
secrecy.** No code in this repo claims to stop scraping. `evaluateSearchQueryGuardrails` bounds page
size and pagination depth, `DEFAULT_ENDPOINT_QUOTA_MATRIX` bounds request rate per subject and
endpoint class, and server-side redaction (`PROTECTED_FIELD_KEYS`) is the actual integrity
guarantee — a fully-scraped corpus still contains only what was published to be read. The consequence
a reader needs: raising rate limits further will not "solve" scraping, because the ADR never asked
it to.

**Kill switches exist per feature class, and never default to wiping the public corpus — but the
live mechanism is narrower than one heavily-cited doc claims.** The real, live implementation is
`packages/config/src/kill-switches.ts`: eleven independently addressable `CORE_KILL_SWITCH_IDS`
(search, geocoding, corrections-submissions, publication, queue-processing, etc.), with
`public-static-mode` specifically preserving immutable public-corpus reads while other switches
deny only their own workload. It is wired live into `apps/api-public` via
`apps/api-public/src/http/kill-switches.ts` (reads `bb_ops.kill_switches` from Postgres) and
`compose.ts`/`vector-search-kill-switch.ts` (the same mechanism the 2026-09-13 ADR-014 recovery
above documents reusing the `search` switch id). `docs/mobile/security/threat-model.md:489` instead
credits this assumption to `DEFAULT_SOFT_SHUTDOWN_POLICY`/`evaluateSoftShutdown`/
`evaluateCircuitBreaker` in `packages/security/src/resource-controls.ts` — but those three have no
call site anywhere outside their own module and `packages/testing/src/load-abuse/*`, a load/abuse
*simulation* harness. They are not wired into any live request path in `apps/api-public`,
`apps/web`, or `apps/mobile` today. A reader looking for the mobile kill-switch should read
`packages/config/src/kill-switches.ts`, not `resource-controls.ts`. (from ADR-010, "security and
abuse assumptions"; gap in `docs/mobile/security/threat-model.md`, not corrected here — see notes
below)

**"Never log a raw App Check token" no longer has an App Check token to log.** App Check is fully
retired (`infra/firebase/auth-and-app-check.md`'s 2026-08-14 correction: `apps/api-public/src/
app-check.ts` and the rest of that family "no longer exist"), replaced by the plain-string
`X-BlackStory-Client` header above — not a JWT, not a credential. `apps/mobile/src/security/
log-redaction.ts`'s citation names a mechanism that is gone. The underlying behavior it protects —
never emit an attestation credential or any JWT-shaped value to a log sink — is still true and
still enforced (`SENSITIVE_KEY_PATTERNS`' `attestation`/`token`/`app_check` key match and
`SENSITIVE_VALUE_PATTERNS`' JWT-shape value match in the same file), so this is stale terminology on
a still-correct rule, not a dead rule. Treat "App Check" in that comment as a synonym for "any
attestation credential," pending the same code-cleanup the mobile threat model already flagged for
`rate-limits.ts`'s own legacy field names (`appCheckVerified`, `missing_app_check`).

**This recovery does not touch `docs/mobile/security/threat-model.md` or `docs/security/
threat-model.md`.** Both are large, actively-maintained documents where the ADR-010 citations are
woven into substantive analytical prose rather than bare tags (the mobile doc already has its own
in-place correction/amendment convention, most recently 2026-08-14). Repointing their citations
without also fixing the kill-switch mis-citation above would leave a misleading reference in place
under a "corrected" label. That fix is left as a follow-up, per the same precedent as the ADR-021
recovery: only the sites feeding this decision were corrected here.

## Firestore as system of record, reversed (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-011-firestore-system-of-record.md` does not exist. Sixty-three citations remain
outside `.beads/` and the built `docs/guides/` export, twenty of them in source across ten files,
one of them gating a CI job. No historical wording of the ADR survives anywhere in the tree, so
everything below is recovered from the code. This is the unusual case: the decision itself was
reversed, and most of what still cites it is asserting the opposite of what the repo does.

**The decision is reversed, not merely stale.** Firestore stopped being the system of record on
2026-08-28 when ADR-020's Supabase Postgres cutover completed. `docs/data/firebase-wind-down.md`
records the end state: "Structured SoR is Postgres (ADR-020); Firestore has no live database,
rules, or indexes left." A search of the whole tree for `firestore.rules` or
`firestore.indexes.json` returns nothing, and `infra/database/README.md` opens with "SUPERSEDED FOR
PRODUCT SoR". So any comment that calls Firestore the primary path, the production path, or the
system of record is false today, and any comment that calls Postgres parked or deferred is false in
the other direction. Treat a citation to this ADR as a reason to check the code, never as
authority. (from ADR-011, "Firestore as system of record, reversed")

**The `@deprecated` markers in `@repo/data-access` point the wrong way, and it has cost five copies
of one guard.** `packages/data-access/src/index.ts` marks ten exports `@deprecated Parked Postgres
helpers not the production path (ADR-011)` while its header calls the Firestore collection maps and
publish guards the "Primary path". The truth is inverted on both halves: `FIRESTORE_COLLECTIONS`,
`FIRESTORE_PATHS`, `assertStaffMayPublish` and `assertNotResearchPublish` have no caller anywhere
outside this package's own barrel and `firestore.test.ts`, while every live consumer
(`apps/web/src/app/admin/evidence/actions.ts`, `apps/web/src/admin/cases/research-case-store.ts`,
`packages/operator-cli/src/cli.ts`, `packages/ops-data/src/embeddings/backfill-cli.ts`) imports the
Postgres exports from the same file. The deprecation marker is roughly right for the Cloud SQL role,
session, pool and SQL Connect modules, which are genuinely unused, but it also covers
`assertNoBrowserDatabaseCredentials`, which is not Cloud SQL specific. Five identical definitions of
that guard now exist (`packages/data-access/src/config.ts`,
`packages/data-access/src/postgres/pool.ts`, `apps/web/src/lib/public-data/postgres-client.ts`,
`apps/web/src/admin/lib/canonical-postgres-client.ts`, `apps/api-public/src/http/postgres-client.ts`),
because the shared one reads as forbidden. That is the concrete cost of a citation nobody could open.
(from ADR-011, "Firestore as system of record, reversed")

**The repo's only Postgres CI lane is disabled by this dead ADR, and the reason is wrong even though
the outcome is right.** `.github/workflows/ci.yml` gates the `integration-postgres` job on
`vars.ENABLE_POSTGRES_CI` with the comment "ADR-011 / D-014: Postgres is parked". Postgres is not
parked. What is parked is the `infra/database/` Cloud SQL role foundation, and that is exactly what
the job exercises: `packages/data-access/src/postgres.integration.test.ts` shells out to
`infra/database/scripts/apply-init.sh` and `verify-isolation.sh`, not to `supabase/migrations/`. So
the lane should stay off, but for the narrow reason that it tests non-production schema, not because
Postgres is parked. A reader who "fixes" the stale ADR reference by flipping the variable would gate
pull requests on a schema the product does not use, and would still have no CI coverage of the
Supabase migrations. That gap is real and is not closed by this lane. (from ADR-011, "Firestore as
system of record, reversed")

**PostGIS is no longer deferred, but nothing queries it, and the geohash path is deliberate.**
`packages/domain/src/index.ts` and `packages/ops-data/src/firestore/types.ts` still say Cloud SQL
PostGIS is deferred or not the production path. PostGIS is installed on the production database
(`supabase/migrations/20260720220001_extensions.sql`), `bb_canonical.entity_locations` carries a
`geography(Point, 4326)` column, and `bb_reference.jurisdictions` carries a GIST-indexed
`geography(Polygon, 4326)`. Yet the only `ST_` call in the repo is commented out inside
`supabase/migrations/20260724000003_coverage_gap_view.sql`. Every live radius query is still
lat/lng plus geohash plus an in-process haversine
(`apps/web/src/lib/map-experience/explore-place-radius.ts` calling `haversineMeters` from
`@repo/domain/geography/geohash`), and writers still populate `geohash` and `geohash_prefixes`
(`apps/web/src/admin/cases/promote-case.ts`). The shape outlived the store it was designed for.
This is a deliberate non-change: do not "finish the migration" by rewriting radius search as a
PostGIS query without deciding to, because the columns existing is not evidence that anything
depends on them. (from ADR-011, "Firestore as system of record, reversed")

**The client-closed boundary survived the reversal; only its enforcement moved.** ADR-011's
substantive rule, that public clients read only released projections and no client has a canonical
write path, is still true and is still what `docs/mobile/security/threat-model.md` is built on. What
is no longer true is how it is enforced. The threat model and
`docs/security/environment-isolation.md` say Firestore security rules enforce it; there are no
rules. Today the enforcement is in the database: `supabase/migrations/20260720220002_schemas_roles.sql`
grants `anon` usage on `bb_public` and `bb_reference` only and reserves `bb_canonical` for
`service_role`; `supabase/migrations/20260720220010_rls_policies.sql` scopes every public select to
the id in `bb_public.active_release` and revokes insert, update and delete on that pointer from
`PUBLIC`, `anon` and `authenticated`; `supabase/config.toml` exposes only `public`, `bb_public` and
`bb_submissions` over PostgREST. On the application side
`apps/web/src/lib/runtime-hardening/constants.ts`'s `FORBIDDEN_PUBLIC_RENDER_IMPORTS` bans
`@repo/data-access`, `firebase-admin`, `@supabase/`, `pg` and any `*/postgres` module from the
public render path, and `runtime-hardening.test.ts` sweeps that over every app route file. The
active-release pointer that ADR-004 and the mobile cache-invalidation design lean on is
`bb_public.active_release`, created in `supabase/migrations/20260720220008_publication_public.sql`.
(from ADR-011, "Firestore as system of record, reversed")

**No statement timeout exists on the live public read path, and the comment saying so is the one
citation that is still accurate.** `packages/security/src/query-guardrails.ts` says SQL statement
timeouts remain deferred. They do. `queryTimeoutMs` and `firestoreStatementTimeoutMs` are reported
as policy metadata and never applied to any executor; the only thing that reads them is an assertion
in `query-guardrails.test.ts` that one is larger than the other. The public read pool
(`apps/web/src/lib/public-data/postgres-client.ts`) sets no timeout at all. Only the admin pool does
(`apps/web/src/admin/lib/canonical-postgres-client.ts`, 10s, client side). The per-role timeouts in
`infra/database/init/40-timeouts-and-limits.sql` belong to the parked Cloud SQL foundation and have
never been applied to Supabase. So a reader who sees the guardrail limits and assumes a slow public
search query gets cancelled is wrong: what bounds it is the cost estimate and page-size ceilings in
the same file, nothing else. (from ADR-011, "Firestore as system of record, reversed")

**The gold-corpus harness is local-only, and the package boundary is what keeps it that way.**
`packages/testing/src/gold-corpus/retrieval-embedding.ts` reimplements embedding math rather than
importing `@repo/ops-data`, citing this ADR for "evaluation does not read or write Firestore and
neither CLI applies cloud changes." The rule survives the store change unaltered, restated as: the
eval harness touches no product store and no CLI it drives applies a cloud change. What enforces it
is `packages/testing/package.json`, whose dependencies are only `@repo/domain` and `@repo/security`,
with no `@repo/ops-data`, no `firebase-admin` and no `@google/genai`. Adding one of those to reuse
the real embedding provider would silently end the guarantee, and nothing would fail. The
reimplementation is a deliberate non-change; do not deduplicate it. (from ADR-011, "Firestore as
system of record, reversed")

**`packages/ops-data/src/firestore/` is the shared document-schema vocabulary, not a store adapter.**
Despite the directory name and its "Firestore model surface" headers, this is live code: the zod
schemas and `FIRESTORE_ROOT` path constants are imported by Postgres-era modules including
`embeddings/text.ts`, `discovery/kill-switch.ts`, `jurisdictions/resolver.ts` and the demographics
loaders. Deleting it as Firebase leftover would break the build. The Firestore *client* code in the
same package (`server.ts`, `emulators.ts`, `embeddings/vector-store.ts`) is a different matter:
there is no live Firestore database left for it to reach. Separate the two before removing anything.
(from ADR-011, "Firestore as system of record, reversed")

**`infra/github/release-pipeline/migrate-firestore-dry-run.sh` is fully dead.** It prints a deploy
sequence for Firestore rules and indexes against `infra/firebase/firebase.json`, a file deleted
under repo-348e.8, and no workflow calls it. `docs/runbooks/production-release.md` still describes it
as a gate CI "may still run"; it cannot. (from ADR-011, "Firestore as system of record, reversed")

## Entity ontology (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-015-*.md` does not exist. It is cited 8 times outside the built export (7 source
files, plus one docs page), covering three things bundled into one decision: the closed public
entity-kind set, the notability-basis inclusion rubric and its publish gate, and the shared
era/date-precision module the rest is built on. Recovered from the code.

**The public entity ontology is a closed, 13-member `kind` set** — person, place, school,
organization, institution, event, law, case, publication, artifact, movement, invention, other —
defined independently in three places: `packages/domain/src/entity-kinds.ts`,
`packages/public-contracts/src/v1/entity.ts` (`ENTITY_KINDS`), and
`packages/schemas/src/public-projections.ts` (`entityKindSchema`). `movement` was ADR-015's own
addition, the 12th kind at decision time; `invention` was added later by a separate decision
(commit `cd96dc8f`, "invention is a kind, patents are receipts") and is not part of this ADR. The
boundary is actually enforced where it's cited: `apps/api-public/src/http/
projection-mapping.ts`'s `SUPPORTED_KINDS = new Set(ENTITY_KINDS)` (imported from
`@repo/public-contracts`) makes `mapProjectionToEntityV1` return `undefined` for any out-of-set
`kind`, collapsing it to the same "not available" signal as an unpublished or nonexistent record —
verified by reading the function, not just its comment. (from ADR-015, "entity ontology")

**Nothing keeps the three kind lists in sync.** `packages/schemas`, `packages/public-contracts`,
and `packages/domain` each hold their own literal 13-item array by design (no shared import,
because `@repo/public-contracts` deliberately carries zero runtime dependencies beyond zod, and
`@repo/schemas` cannot depend on either without creating a cycle). `packages/schemas/src/
public-projections.ts` even says "Must stay in lockstep with `ENTITY_KINDS`" in a comment, but no
test checks the three lists against each other — a reader has to keep the agreement by hand, the
same shape of gap ADR-016's jurisdiction-id duplication has. (from ADR-015, "entity ontology")

**The era/date-precision model is a real single source, not a duplicate.**
`packages/domain-core/src/era.ts` is the implementation; `packages/domain/src/era.ts` is a
re-export shim over it. `packages/ops-data/src/embeddings/text.ts` imports `deriveEraBuckets` from
`@repo/domain` and its own `deriveEraBucket` (singular) is a thin single-bucket adapter over that
import, not a second implementation — confirmed by reading the function body. This part of the
decision is fully live with no correction needed. (from ADR-015, "entity ontology")

**The notability-basis publish gate is wired into the live release path** — a citing comment says
otherwise, and that comment is wrong. `packages/domain/src/relevance/notability-gate.ts` claims
"Not wired live: the projection/release build ... should call
`assertPublishableEntityHasNotabilityBasis` before including an entity in a release." In fact
`packages/domain/src/publication/release-builder.ts`'s `buildReleaseEntityArtifacts` already calls
the sibling function `evaluateNotabilityGate` on every entry and fails the release closed
(`reason: 'notability_basis_gate'`) when an entity has zero `notabilityBasis` records — same
underlying rule (`count >= 1`), different (boolean-result, not throwing) entry point.
`buildReleaseEntityArtifacts` is the real release path: `packages/ops-data/scripts/lib/
incremental-publish.ts`, the production incremental publisher, imports it directly from
`@repo/domain`. The throwing `assertPublishableEntityHasNotabilityBasis` the stale comment names is
not dead, either — `packages/domain/src/seed-campaigns/validators.ts` calls it directly for seed
records. The gap the comment describes does not exist today; a reader who trusted the comment and
assumed the release build could silently publish notability-less entities would be wrong. (from
ADR-015, "entity ontology")

**The cultural-figure notability calibration is documented policy, not an enforced gate — and its
own comment says so honestly.** `CULTURAL_FIGURE_NOTABILITY_CALIBRATION = 'icons_and_firsts_only'`
(`packages/domain/src/entity-status.ts`) is "reviewable rubric text pending ratification ... not a
scoring threshold." Nothing in the repo reads this constant to accept or reject an actual entity —
only a unit test asserts its literal value. Unlike the release/notability-gate comment above, this
one does not overclaim: treat it as unenforced until a later ratification decision changes that.
(from ADR-015, "entity ontology")

## Acquisition crawler runtime (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-019-acquisition-crawler-runtime.md` does not exist; it was removed in the 2026-07-24
purge. One source file cites it directly (`packages/ops-data/scripts/lib/trafilatura.ts`), and two
runbook docs cite it by number for the same two decision items. Recovered from the code, and from
the 2026-07-19 ADR text preserved in git history (commit `de395cfc`) for the decision items no
citation still names but the runbooks already describe as deliberately unbuilt.

**Trafilatura is the standard HTML text/metadata extractor, and it is live.**
`extractWithTrafilatura` (`packages/ops-data/scripts/lib/trafilatura.ts`) shells out to a Python
bridge (`workers/research/src/black_book_research/crawl/trafilatura_extract.py`) that calls
`trafilatura.extract` / `extract_metadata`; a pytest fixture (`test_trafilatura_extract.py`)
asserts it keeps article text and drops nav/footer boilerplate, and that test runs in CI's
`unit-py` job (`uv run pytest`, gated on the python-changed path predicate in
`.github/workflows/ci.yml`). `trafilatura>=2.1.0` is a real dependency of
`workers/research/pyproject.toml`; it is best-effort only — any failure falls back to the regex
strip already returned by `safe-fetch.ts`, never a hard pipeline dependency. (from ADR-019 decision
item 5, "acquisition crawler runtime")

**Fetching and SSRF safety stay in TypeScript, never delegated to the Python side.**
`safe-fetch.ts`'s `safeFetchPage` calls `executeSafeFetch` (`@repo/security/url-safety` — DNS
pinned once, private/loopback/link-local/metadata answers rejected before any socket opens, TLS
SNI/Host sent for the original hostname while connecting to the pinned IP) and only then hands the
already-safety-checked HTML to Trafilatura for re-extraction. This is not just asserted in a
comment: the actual pipeline the runbook names chases through real code —
`build-gap-fill-enrichment-subjects.ts` → `lib/corroborate-source.ts` → `lib/fetch-page.ts` →
`lib/safe-fetch.ts`. The underlying DNS-pinning primitives are covered by
`packages/security/src/url-safety/url-safety.test.ts`. (from ADR-019 decision item 7, "acquisition
crawler runtime")

**The Scrapy crawl engine the ADR is named for was never built, and the surviving citations do not
overclaim it.** Decision items 3, 4, 6, 8 and 9 — a Scrapy engine, per-domain scheduling,
conditional-GET checkpointing, and a Playwright ban with a documented-exception process — describe
infrastructure with zero code today: `scrapy` is not a dependency anywhere in the uv workspace, no
spider file exists, and no crawl checkpoint store exists. `docs/runbooks/gap-fill-research.md`
already says this correctly ("Scrapy reserved for recurring institutional-collection crawl
campaigns... a separate, larger piece of work, not built as part of this pipeline"), and
`docs/research/black-women-in-stem-source-identification.md` lists "No Scrapy/Crawlee/Playwright
run against this domain" as a still-in-force non-action. Treat this as a decision accepted on
paper and never executed for the bulk of its scope, not one that was reversed: a reader should not
assume a crawl engine or a Playwright policy gate exists anywhere in this repo. The Playwright
prohibition itself has nothing enforcing it today (no lint rule, no import restriction) — that is
moot only because nothing acquisition-side currently uses Playwright, not because a gate would
catch it if something did. (from ADR-019 decision items 3/4/6/8/9, "acquisition crawler runtime")

## Mobile cache and OTA release (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-023-mobile-state-cache-offline.md` does not exist. Thirty source comments across
thirteen files cite ADR-023, and they do not all mean the same document: fourteen of them are
using the pre-2026-07-22 number and are really citing ADR-024. Seven more, in the file that
implements the invariant, are invisible to `grep`. Recovered from the code and from the two
removed documents in git history.

**ADR-023 names two different decisions in this tree, and roughly half the citations carry the
wrong number.** The mobile ADRs were renumbered on 2026-07-22. Under the final numbering (verified
against `git ls-tree -r a2f559f8~1 -- docs/adr`, the commit before the 2026-07-24 purge), ADR-022 is
the mobile data boundary, ADR-023 is "Mobile client state, local cache, and offline-read mode", and
ADR-024 is "Mobile build, distribution, OTA update, and release-rollback model". Every ADR-023
citation under `apps/mobile/src/data/**`, `apps/mobile/src/features/search/**` and
`packages/domain/src/publication/mobile-bootstrap.test.ts` is correct. Every ADR-023 citation under
`apps/mobile/src/updates/**`, `apps/mobile/src/observability/report-context.ts*` and
`apps/mobile/app.config.ts` is the old number for ADR-024, and its section references
(§1 channels, §2 OTA policy, §3 version scheme, §4 min-supported-app, §7 reversal cost, amendment
#1 code signing) resolve correctly only against ADR-024. The mirror-image error also exists: about
forty-nine ADR-022 citations under `apps/mobile/src` are cache and offline content that belongs to
ADR-023 today, including `data/db/migrations.ts:2` and `data/cache-policy.test.ts:68`, whose own
modules (`db/schema.ts:5`, `cache-policy.ts:30`) cite ADR-023 for the same sections. This is not a
find-and-replace: at least one existing ADR-022 citation (`apps/mobile/README.md:201`) is already
correct and must not be touched. (from ADR-023, "mobile cache and OTA release")

**The on-disk cache is disposable, and a schema change drops and rebuilds it rather than migrating
it.** `CACHE_SCHEMA_VERSION` is a single integer (`apps/mobile/src/data/db/schema.ts:14`, currently
`1`), and `runMigrations` (`apps/mobile/src/data/db/migrations.ts`) rebuilds whenever the on-disk
version is absent, differs, the store is unhealthy, or a prior migration was interrupted. There is
deliberately no `ALTER` path and no data-preserving migration, because every row is reconstructable
from `api-public`. The interrupted-migration case is handled by a write-ahead `migration_state`
flag set to `in_progress` first and to `clean` last, so a crash mid-rebuild leaves the next launch
re-running the rebuild instead of serving a half-migrated cache. Do not "fix" this into an
incremental migration system: the destructive path is the decision, and it is safe only because the
server stays authoritative. (from ADR-023 §5, "mobile cache and OTA release")

**A single global release stamp, not a clock, is the authoritative freshness signal.**
`isReleaseStampStale` (`packages/domain/src/publication/mobile-bootstrap.ts:251`) treats both a
mismatch and an absent client stamp as stale. On the client, `applyReleaseStamp`
(`apps/mobile/src/data/release-cache.ts`) calls `store.deleteReleaseCoupledExcept(serverStamp)`, so
one stamp invalidates entities, evidence, search results and map GeoJSON together, and a server
rollback invalidates exactly as a roll-forward does with no special case. TTL survives only as a
soft background-revalidation hint. Per-entity or per-artifact stamps were considered and rejected by
the original red team as premature; `apps/mobile/src/data/release.ts:12-14` records that
non-change on purpose, with a measured trigger (a coarse map-only second stamp) as the one
sanctioned way to revisit it. (from ADR-023 §4, "mobile cache and OTA release")

**Query text, correction content and precise location never reach the SQLite cache, but that
guarantee is narrower than the comments in the code claim.** Enforcement is structural and
dynamic: `db/schema.ts` declares only `cache_meta` and `cache_entries`, so no column can hold those
categories; `assertCacheSafe` (`apps/mobile/src/data/cache-policy.ts`) throws `NeverCacheViolation`
on a forbidden field name and is called before every disk write (`release-cache.ts:127`) and over
the persisted TanStack snapshot (`query-client.ts:53`); search results are keyed by
`hashSearchKey`, a salted SHA-256 of the normalized query shape rather than the text. This is a
PRIVACY decision (program invariant 7), so relaxing any of it reverses a decision rather than
tuning a cache. Two comments overstate it, though. `db/schema.ts:21-23` says "the schema itself is
the structural guarantee that those categories have nowhere to land on disk", and
`cache-policy.ts` says "there is simply no code path to persist those categories". Both are true of
the SQLite cache and false of the app: `features/search/recent-searches.ts` persists up to eight
normalized search terms to SecureStore, deliberately, under the recorded repo-30k6 exception, with
`clearRecentSearchesOnFreshInstall` (`features/search/search-runtime.ts`) as its uninstall-safe
control. A reader who takes the absolute reading will look for a leak that is actually a recorded
carve-out. (from ADR-023 §2, "mobile cache and OTA release")

**The 50 MB cache ceiling is a documented target that has never been measured.**
`CACHE_BYTE_CEILING = 50 * 1024 * 1024` with a 90% low-water mark (`cache-policy.ts:30-32`), and
`evictIfOverCeiling` runs LRU-by-last-access on every write. The original ADR was explicit that the
number was to be measured on real devices in MOB-018 and the code comment repeats that. It has not
happened. `MAX_CACHED_ENTRY_BYTES = 4 MB` per row (`release-cache.ts:43`) is a client-side addition
the ADR never stated. Changing the ceiling or the eviction strategy is policy over a disposable
store, the cheapest class of change here, and needs no decision record. (from ADR-023 §2, "mobile
cache and OTA release")

**The OTA-versus-rebuild boundary is enforced by the EAS runtime version, and nothing in this repo
checks that it stays that way.** `app.config.ts:209` sets `runtimeVersion: { policy: 'appVersion' }`,
so a JS bundle only installs onto a binary whose runtime version matches and an OTA built against a
changed native layer is rejected client-side rather than shipped and crashed. Channel isolation is
the second half: `apps/mobile/eas.json` binds `development`, `preview` and `production` each to its
own channel so an OTA cannot cross an environment boundary, and `app.config.ts` sets
`updates.enabled: false` plus `checkAutomatically: 'NEVER'` for `APP_VARIANT=development` (Metro
owns the dev bundle), with a JS-side `isDevRuntime()` gate in `updates/bootstrap.ts` as belt and
braces. `app.config.ts` has no test file, `eas.json` has no assertion over it, and nothing fails if
either value is changed. (from ADR-024 §1/§2, "mobile cache and OTA release")

**OTA ships without end-to-end code signing, and `free-tier-accepted-risk` is a label, not a
control.** Expo gates EAS Update code signing behind a paid plan, so the 2026-07-20 adversarial
review amended the decision to an accepted risk on the free tier, with the blast radius reduced to
MFA custody of the EAS publish credential, a scoped CI-only token, channel and staged-rollout
discipline, and rollback by republishing the previous immutable update. `CODE_SIGNING_POSTURE`
(`apps/mobile/src/updates/config.ts:23`) hard-codes that string so crash reports carry it, and its
own comment says it "is fixed by the ADR, not read from any runtime input". The ADR no longer
exists, no `codeSigning` key appears in `app.config.ts` or `eas.json`, and the tests assert only
that the label is passed through. A reader looking for the thing that keeps this true will not find
one: the real control is the EAS account plan, outside this repo, and enabling signing is a
cost-gated upgrade trigger, not a bug. (from ADR-024 amendment #1 and §7, "mobile cache and OTA
release")

**The OTA client module exists but is not wired into the app.** `getUpdatesPosture`,
`checkForUpdate` and `fetchAndApplyUpdate` (`apps/mobile/src/updates/bootstrap.ts`) have no caller
anywhere in `apps/mobile/src` outside their own tests, which the module header states deliberately:
the composition-root call belongs to whoever owns `src/runtime/AppProviders.tsx`. Crash reports get
their runtime version from `Constants.expoConfig` in `observability/bootstrap.ts:50`, not through
this module. So today no BlackStory build checks for or applies an OTA update at runtime, despite
`updates.enabled: true` on preview and production binaries letting the native updater do it on
load. `updates/bootstrap.ts:36` also cites "§4 fail-open posture" for its update check; ADR-024 §4's
fail-open rule governs the minimum-supported-app floor (never self-brick on an unreadable
min-version signal), not OTA polling. The posture is real, the section does not cover this call.
(from ADR-024 §2/§4, "mobile cache and OTA release")

**Nothing that can block a merge enforces the mobile half of this.** The Jest suites that do
enforce it (`data/cache-policy.test.ts`, `data/db/migrations.test.ts`, `data/release-cache.test.ts`,
`updates/*.test.ts`) run in the `Mobile Checks` job (`.github/workflows/ci.yml`), which is gated on
`changes.outputs.mobile` and is NOT in the required set: `infra/github/rulesets/main-protection.json`
requires only "Workspace Checks", "Workspace Tests", "Unit Tests (Python)" and "Governance", and
ci.yml's own header says "Mobile is not required". The one piece that does sit behind a required
check is the server-side release-stamp contract, because
`packages/domain/src/publication/mobile-bootstrap.test.ts` runs in "Workspace Tests". Nothing at all
enforces the ADR numbering, the runtime-version policy, the channel binding, or the code-signing
posture. (from ADR-023 and ADR-024, "mobile cache and OTA release")

**`apps/mobile/src/data/cache-policy.ts` is invisible to `grep`, which is why every prior citation
census undercounted.** The file contains a literal NUL byte at byte 4571 (line 99), used as a hash
domain separator inside the `hashSearchKey` template literal and written as a raw control character
rather than a `\0` escape. `file` reports the file as `data` and `grep -rn` skips it silently. The
byte is committed, not an in-flight edit. Seven ADR-023 citations live in that file, including the
byte ceiling, the LRU eviction rule and the never-cache tripwire, so the file that owns the
invariant is the one no sweep can see. Eight other main-tree source files carry NUL bytes the same
way (`packages/ops-data/scripts/load-banned-books-to-supabase.ts`,
`packages/ops-data/scripts/fix-civil-rights-leaders-derived-fields.ts`,
`packages/ops-data/scripts/lib/incremental-publish.ts`,
`packages/domain/src/relevance-feedback/recalibration-report.ts`,
`packages/domain/src/datapacks/import-pipeline.ts`,
`apps/mobile/src/features/entity/testFixtures.ts`,
`apps/mobile/src/features/corrections/idempotency.ts`,
`apps/mobile/src/data/db/memory-store.ts`). Any future citation or invariant sweep must use
`grep -a`. (from ADR-023, "mobile cache and OTA release")

**Correction, 2026-09-13:** the paragraph in this section beginning "Query text, correction content and precise location never reach the SQLite cache, but that guarantee is narrower than the comments in the code claim" quotes `db/schema.ts` and `cache-policy.ts`'s NOTE comments as currently overstating the never-cache guarantee ("nowhere to land on disk" / "no code path to persist those categories"). That quote is the text as it read before the same 2026-09-13 recovery commit that wrote this section (`e9ac2b5b`). That commit also rewrote both comments in place: `db/schema.ts`'s NOTE now says the categories have "nowhere to land in THIS store" and adds "It is not a whole-app guarantee: normalized recent-search terms are persisted to SecureStore under the recorded repo-30k6 exception"; `cache-policy.ts`'s NOTE gained the equivalent caveat sentence in the same diff. A reader checking either file today will find the caveat already in place, not the absolute claim quoted in that paragraph. The quote is retained there only as the reasoning trail for why the caveat exists, not as today's text. (from ADR-023 §2, "mobile cache and OTA release")

## Public projection and immutable publication snapshots (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-004-public-projection-immutable-snapshots.md` does not exist. Twenty-nine source
comments across twenty-one files cite it, several of them as the authority for how publishing
works, and the one bullet this file already carried for it ("Admin never edits active public
projections directly", above) promised the whole model in its title and delivered a line of it.
Recovered from the code, with the removed document read out of git history as a cross-check. Where
the two disagree the code wins, and this section says so each time.

**What the section numbers in the citations mean.** ADR-004's decisions were numbered: 1, canonical
evidence, claims and research data are not public-readable; 2, denormalized public projection tables
are the live query surface; 3, each publication produces an immutable release record with a signed
manifest and a search-index version; 4, public JSON snapshots per release for degraded rendering;
5, release activation is atomic; 6, instant rollback by switching the active pointer; 7, draft and
preview releases are admin-only; 8, every public fact maps to accepted claim and evidence records.
`packages/public-contracts/src/v1/entity.ts`'s "ADR-004 §1" means the first of those. The document
also recorded, at acceptance on 2026-07-16, that the projection tables and `workers/publication`
were "Not implemented"; none of the citations below should be read as describing a shipped pipeline.

**The existing bullet is true of the admin console, which cannot touch an active public projection
and cannot activate a release either.** Nothing under `apps/web/src/admin/**` writes `bb_public`:
the only two mentions are a SELECT of the active-release pointer
(`apps/web/src/admin/lib/postgres-publication.ts`) and a comment in `admin/lib/entity-merge.ts`
saying a merge deliberately leaves `release_entities` and `search_index` alone. The release action
surface is explicitly inert: `POST /admin/api/releases/stage`
(`apps/web/src/app/admin/api/releases/stage/route.ts`) authorizes the caller, demands a durable
reason, and then returns `executionAllowed: false` with a note saying the active public pointer was
not changed. What backs the rule is the Postgres grant layer rather than a test: `bb_public` writes
are reserved for `service_role`, which the admin pool does not hold, and no test asserts the absence
of an admin write path. (from ADR-004, "public projection and immutable publication snapshot model")

**The wider reading, that nothing edits an active public projection in place, is false.** The live
publish path is `packages/ops-data/scripts/publish-release-entities-incremental.ts`, which upserts
rows into `bb_public.release_entities` and `bb_public.search_index` under the id already sitting in
`bb_public.active_release`. Dozens of `packages/ops-data/scripts` fix and backfill passes do the
same, and `theme-packets.ts` upserts and deletes `bb_public.release_theme_impact_packets` that way
too. No new release id is minted and no pointer moves.
`apps/web/src/lib/public-data/live-policy.ts` already documents the consequence for the published
CDN artifacts (repo-19mxs). So "publication goes through preview, then promote" describes a design,
and an operator running a script under `service_role` is what actually changes what the public sees.
(from ADR-004, "public projection and immutable publication snapshot model")

**Exactly one release is active at a time, and that part is enforced by the database.**
`bb_public.active_release` is a single-row table (`id text PRIMARY KEY DEFAULT 'active' CHECK
(id = 'active')`, `supabase/migrations/20260720220008_publication_public.sql`). Every public read
policy in `supabase/migrations/20260720220010_rls_policies.sql` scopes its select to
`(SELECT release_id FROM bb_public.active_release WHERE id = 'active')`, and insert, update and
delete on that pointer are revoked from `PUBLIC`, `anon` and `authenticated`. That is what makes
`apps/mobile/src/features/entity/dataClient.ts`'s shortcut sound: any endpoint's
`revision.releaseId` names the same release `/v1/bootstrap` would. It is also what keeps a draft or
preview release invisible without any application code: `bb_publication.releases.status` allows
`draft` and `preview`, and rows carrying those release ids simply never match a public select.
(from ADR-004 §5 and §7, "public projection and immutable publication snapshot model")

**Nothing in this repo flips the pointer today, but the function-level gate is not the only path
that writes it.** `bb_publication.activate_release(text)` is a `SECURITY DEFINER` function that
refuses the `research` role outright and otherwise requires `service_role`, DB `postgres`, or a
`publication`/`admin` `bb_role`. Its one caller is `bb_publication.activate_research_release` in
`supabase/migrations/20260721041950_research_kernel_ledger.sql`, which additionally demands an
approval lineage whose publisher and producer are distinct identities, whose reviewer and producer
are distinct identities, and whose reviewer and producer are not the same model family. No
TypeScript calls either function directly, but "every `bb_public.active_release` reference in
application and script code is a SELECT" is not true of the code that exists, only of the code
that runs: `packages/data-access/src/postgres/release-store.ts`'s `syncPublicationPointerRow`
issues a raw `INSERT ... ON CONFLICT DO UPDATE` straight into `bb_public.active_release` (and into
`bb_publication.releases.signed_manifest` — see below), bypassing every check `activate_release`
enforces: the research-role denial, the distinct-identity and model-family lineage requirement,
all of it. Like the release-activation state machine below, this function has no caller anywhere
in the repo outside its own package (`packages/data-access/src/postgres/release-activation.ts`,
its own tests, and the re-exporting barrel `index.ts`), so nothing running today exercises this
path — but a reader should not generalize "is a SELECT" from the citation sites to the codebase.
Whatever Postgres role this store's pool authenticates as would need direct table INSERT
privilege for the write to succeed, since RLS revokes INSERT on this table from `PUBLIC`, `anon`
and `authenticated` alike; which role a live caller would use, and whether granting it write access
would also hand it a path around `activate_release`'s checks, was not traced further here. (from
ADR-004 §5, "public projection and immutable publication snapshot model")

**Atomic activation, rollback and garbage collection are fully implemented and fully unwired.**
`packages/domain/src/publication/release-activation.ts` is the real thing. It validates every
artifact's hash before anything is persisted; it writes artifacts through a store whose
`putArtifact` throws `IMMUTABLE_ARTIFACT_VIOLATION` when an existing path would receive different
content; and only then does it flip one pointer by compare-and-set, so a losing concurrent
activation throws `CONCURRENT_ACTIVATION` having written nothing but content-identical bytes.
`rollbackTo` re-validates the whole target release and flips the same pointer, restoring every
artifact hash together and never a mix. `collectGarbage` retains the active and the
immediately-previous release, and the store itself refuses to delete either, which pins rollback
depth at one on purpose. `packages/data-access/src/postgres/release-activation.ts` is the
Postgres-backed async twin. Both are exercised only by their own tests: `activateRelease`,
`rollbackTo`, `collectGarbage`, `activateReleaseAsync` and `rollbackToAsync` have no production
caller anywhere in the repo. Read that module as a design that is ready, not as a description of
what runs. (from ADR-004 §5 and §6, "public projection and immutable publication snapshot model")

**The signed release manifest is a library, not a live gate, and at least two comments in the tree
claim otherwise.** `signReleaseManifest` and `verifySignedReleaseManifest`
(`packages/domain/src/publication/index.ts`, ECDSA over canonical JSON) are imported only by
`packages/domain/src/publication.test.ts` — a header comment in `packages/domain/src/datapacks/
manifest.ts` names both functions but imports neither. `bb_publication.releases.signed_manifest` is
`jsonb NOT NULL DEFAULT '{}'::jsonb`, and while it is not quite true that nothing in the repo writes
it — the same unwired `syncPublicationPointerRow` from the paragraph above would write a
`{mobileBootstrap, manifestHash}` object into it if anything called it — nothing does call it, so
every row's `signed_manifest` is the empty default in practice. Nothing on the read path verifies a
manifest hash: `bb_public.active_release.manifest_hash` is read from Postgres in three places, not
one — the admin releases list, and both apps' `postgres-readers.ts`
(`apps/web/src/lib/public-data/postgres-readers.ts`, `apps/api-public/src/http/postgres-readers.ts`)
— but only the admin surface does anything with the value once read: it displays it. Both
application readers parse it into a doc and then drop it before it reaches a response —
`apps/api-public`'s `mapActiveReleaseToPointer` builds `ReleasePointer` with no `manifestHash` field
at all, and `apps/web`'s `getPublicActiveReleaseMeta` returns only `releaseId`/`activatedAt`. So
`apps/web/src/admin/lib/entity-merge.ts`'s "the signed manifest is still the only thing that changes
what is live" is not true today, and neither is this file's own 2026-08-04 sentence "Publishing is
still preview to promote to release activation behind the signed manifest". Both are statements of
intent. (from ADR-004 §3, "public projection and immutable publication snapshot model")

**A release artifact is a canonical-JSON object at a release-scoped path, hashed when it is
generated, and only two of the eight kinds are ever published.**
`packages/domain/src/publication/release-paths.ts` defines eight paths under
`public/releases/{releaseId}/`: `entities.json`, `search-index.json`, `map/source.json`,
`map/state-aggregates.json`, `map/county-aggregates.json`, `map/bounded-points.json`,
`content/index.json` and `bootstrap.json`. `sealArtifact` canonicalizes, SHA-256 hashes and measures
raw and gzip size deterministically, which is where "content-addressed" comes from. Only the first
two have a live publisher (`packages/ops-data/scripts/publish-release-catalog-artifacts.ts`) and a
live consumer (`packages/domain/src/publication/release-artifact-fetch.ts`, and through it
`apps/web`'s public data layer and `apps/api-public/src/http/release-artifact-catalogs.ts`). The
other six are referenced only inside the unwired activation path. The per-entity JSON snapshots of
decision 4 (`publicEntitySnapshotPath`, `publicEntityProjectionPath`) are never written by anything.
(from ADR-004 §3 and §4, "public projection and immutable publication snapshot model")

**A published artifact is release-scoped, not content-addressed, and not immutable.** The publisher
uploads through the Supabase Storage REST API with `x-upsert: true`
(`packages/ops-data/scripts/lib/release-catalog-publish-upload.ts`), so the object at
`public/releases/{releaseId}/entities.json` is rewritten in place whenever a script corrects
`bb_public` under an unchanged release id. The read-side guard compares only `releaseId`
(`release-artifact-fetch.ts`), never a hash, so a pre-correction artifact and a post-correction one
are indistinguishable to a consumer. That is the gap `live-policy.ts` spells out, and it bounds
worst-case artifact staleness at roughly 24 hours: a manual
`publish-release-catalog-artifacts.yml` dispatch after each script, with a daily cron as
forgetting-insurance. `apps/api-public/src/http/release-artifact-catalogs.ts` called those objects
"release-versioned and immutable"; the first half was right. (from ADR-004 §3, "public projection
and immutable publication snapshot model")

**Release and revision metadata on every public response, and CDN-friendliness, are the parts wired
end to end.** `revisionMetadataV1Schema` (`packages/public-contracts/src/v1/revision.ts`) is a
required field of `entityV1Schema` and of the bootstrap response, so no entity can leave
`apps/api-public` without naming the release it came from. `apps/api-public/src/http/responses.ts`
pairs released reads with `public, max-age=60, stale-while-revalidate=300` and a strong ETag
computed over the canonical JSON body, answering a matching `If-None-Match` with a bodiless 304;
the release pointer gets a shorter 30-second TTL so a new release is picked up promptly, and
operational endpoints are `no-store`. (from ADR-004, "public projection and immutable publication
snapshot model")

**The coordinate a public projection carries was reduced before it was published, and the wire DTO
has no field that could carry a raw one.** `reducePublicPrecision` and `redactLocationForPublic`
(`packages/security/src/redaction.ts`) run on the publish path, and `redactLocationForPublic` runs
only when `reducePublicPrecision` actually reduced, which is the part
`packages/ops-data/scripts/resync-release-location-precision.ts` calls out as easy to get wrong.
The single-engine rule is written down at `docs/security/location-precision-standard.md` §4.
`geoAnchorV1Schema` (`packages/public-contracts/src/v1/entity.ts`) then carries only `lat`, `lng`,
`geohash` and `matchMethod`, and `locationPrecision` is one of four public tiers. Decision 1, the
other half of that file's citation, is enforced by grants rather than by the DTO:
`supabase/migrations/20260720220002_schemas_roles.sql` gives `anon` usage on `bb_public` and
`bb_reference` only and reserves `bb_canonical` for `service_role`. (from ADR-004 §1, "public
projection and immutable publication snapshot model")

**Degraded mode is real on mobile and absent on the server.** `createInMemoryPublicDataAccess`
(`apps/api-public/src/http/data-access.ts`) is a complete adapter that would serve a fixed set of
already-released, already-redacted projections, but production never populates it:
`apps/api-public/src/http/compose.ts` constructs it as `{ entities: [] }` whenever the live-Postgres
gate fails, and the handlers then return `UPSTREAM_UNAVAILABLE` rather than serve anything. The
ADR's "entity pages must remain serveable if live APIs are disabled", which
`apps/mobile/src/features/search/search-controller.ts` quotes correctly, is satisfied today by the
mobile SQLite cache and by CDN caching of already-fetched responses. There is no server-side
snapshot to fall back to. (from ADR-004, "public projection and immutable publication snapshot
model")


## Map stack (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-013-map-stack.md` does not exist. Twenty-seven source comments across seventeen
files cite it, one of them by that dead path, and five further citations sit in `docs/` and in
`workers/publication/MAP_SOURCE_INTEGRATION.md`. Recovered from the code and from the removed
document in git history (`git show a2f559f8^:docs/adr/ADR-013-map-stack.md`). Several citations
restate rules the code has since moved past; those are corrected below rather than repeated.

**This is one decision, not a number collision.** ADR-013's citations fall into two territories
that look unrelated: the web/domain map data platform, and a handful of `apps/mobile` design-token
comments. They are one number. The mobile ADRs were renumbered on 2026-07-22 into the 021-025
range and there was never a mobile ADR-013 (`git log --diff-filter=A --name-only -- 'docs/adr/*'`
shows every mobile ADR created at 020-023 and renumbered upward). The map-plate comments are
genuine ADR-013 material. The two elevation-token comments are a misattribution with a traceable
origin, recorded at the end of this section.

**MapLibre GL JS on both surfaces; the tile strategy shipped as neither of the two options.**
ADR-013 chose MapLibre GL JS for its license and its ability to render a GeoJSON
`FeatureCollection` directly, preferring self-hosted Protomaps PMTiles served from a static CDN,
with managed MapTiler as the fallback if authoring a PMTiles archive cost too much engineering
time. Neither landed. Web `/explore` renders free OpenFreeMap vector tiles
(`OPENFREEMAP_TILE_SOURCE_URL` in `apps/web/src/lib/map-experience/dignity-style.ts`, wired in
`apps/web/src/app/map/explore-style.ts`), and mobile defaults to the same source with PMTiles as an
optional `extra.map.pmtilesUrl` that is not configured
(`apps/mobile/src/features/map/mapConfig.ts`). MapTiler was never introduced. PMTiles is still the
stated target on both surfaces, so a reader should treat it as unbuilt work, not a rejected
option. Mobile additionally carries `MAP_BASEMAP_ENABLED`, a kill switch that detaches every tile
source and leaves entity points over a flat dark canvas with zero tile egress; the web map has no
equivalent. (from ADR-013 §1 and §2, "map library" / "tile strategy")

**The dark archive register survives, but the web half of the rule is gone.** ADR-013 §3 was
explicit that the map canvas is a fixed dark register regardless of the surrounding site's
light/dark toggle, on the analogy of a printed archival map insert. That is no longer true on web.
`plateFor(scheme, satellite)` in `apps/web/src/lib/map-experience/dignity-style.ts` returns a
complete light plate as well as a dark one; `readDocumentColorScheme()`
(`apps/web/src/components/map-stage/color-scheme.ts`) reads `data-theme` off the document root, so
the plate follows the site theme and is dark only by default; and `?sat=1` swaps the cartographic
plate for USGS aerial imagery entirely. The demo-stage `apps/web/src/app/map/dark-archive-style.ts`
that ADR-013 named is gone, replaced by `explore-style.ts`. What survives intact is the rule
underneath the register: every color comes from the brand palette through `dignity-style.ts`, the
style introduces no new hues, and there is no red violence marker and no density-keyed heat ramp on
either surface. On mobile the original rule does still hold literally:
`apps/mobile/src/features/map/mapStyle.ts` binds `themeColors.dark` unconditionally, so the native
plate does not flip with the OS theme, while `resolveThemeName`
(`apps/mobile/src/ui/tokens/index.ts`) defaults everything outside the plate to the light Archive
Paper theme. Read "fixed dark plate" as a mobile rule and a web default today, not a cross-surface
invariant. (from ADR-013 §3, "basemap style")

**The redaction-injected builder is intact, and it is now the shared spine of three surfaces.**
`buildMapSource` (`packages/domain/src/map/map-source.ts`) takes a `redactLocation` port by
dependency injection and never reads a raw coordinate for output; every coordinate that reaches a
feature or an aggregate is that function's return value. `map-source.redaction.test.ts` wires the
real `redactLocationForPublic` from `@repo/security`, not a stub, against a living-person
residential fixture and asserts the literal raw value never appears in the serialized output.
`map-source.ts` keeps zero runtime import of `@repo/security` and its own header comment explains
that as cycle avoidance ("that package already depends on `@repo/domain`"), but that rationale is
stale and the correction matters: `@repo/security` is a full `dependencies` entry (not a
devDependency) of `@repo/domain`'s `package.json`, and it is imported at runtime across dozens of
files in `packages/domain/src` (`era.ts`, `relationship.ts`, `release-activation.ts`, and others) —
not "only by the test and the demo generator." The cycle claim itself is also backwards:
`@repo/security` imports `@repo/domain-core`, not `@repo/domain` — `@repo/domain-core`'s own header
comment says this package exists precisely so `@repo/security` can read shared primitives "without
importing @repo/domain (which imports @repo/security)." So `@repo/domain` depends on
`@repo/security`, `@repo/security` depends on `@repo/domain-core`, and there is no reverse edge for
a direct import in `map-source.ts` to close. The injection here is a genuine and useful discipline
— the regression test proves the invariant against the real function without this one module
importing it — just not the forced-by-a-cycle discipline ADR-013 and the module's own comment both
describe it as. Three independent callers now inject the real function at their own layer: web
Explore (`buildExploreMapSource` in `apps/web/src/lib/map-experience/build-explore-map-source.ts`),
`api-public`'s `GET /v1/map` (`apps/api-public/src/http/build-map-source-v1.ts`), and the
release-activation state machine. All three depend on the invariant holding inside the domain
function, so weakening it is a change to three public surfaces at once, not to one module. (from
ADR-013 §4, "map data platform")

**Release-coupled build: implemented, and still called only from tests.** ADR-013 §5 recorded the
integration point as designed but not wired, and named the artifact layout.
`generateReleaseArtifacts` (`packages/domain/src/publication/release-activation.ts`, MOB-005) now
does exactly what that section described. It builds the map source and the state/county
aggregates through `buildMapSource`, plus a bounded flat-point artifact, a content index and the
mobile bootstrap manifest; hashes and canonicalizes every one; persists them content-addressed
and immutably, so an existing path may only be rewritten with byte-identical content; activates
by flipping one pointer under compare-and-set; and refuses to garbage-collect the active or the
rollback-target release. The paths are in `release-paths.ts`:
`public/releases/{id}/map/source.json`, `.../map/state-aggregates.json`,
`.../map/county-aggregates.json`, `.../map/bounded-points.json`. What has not happened is the
wiring.
`generateReleaseArtifacts` and `activateRelease` have no caller outside
`release-activation.test.ts` and `release-evidence.test.ts`. The publisher that actually runs,
`packages/ops-data/scripts/publish-release-catalog-artifacts.ts`, emits `entities.json` and
`search-index.json` and no map artifact at all. Nothing anywhere reads `map/source.json`. The live
map surfaces build their own source per request or per build instead. So the artifact path exists,
is tested, and is unused, and a comment that says "not wired live" is right about the outcome even
where it is now wrong about the cause. (from ADR-013 §5, "release-coupled build")

**Two size budgets, one of which is enforced.** `DEFAULT_BOUNDED_POINTS_BUDGET`
(`release-activation.ts`) is 5,000,000 raw bytes and 1,500,000 gzipped, measured at a fixed gzip
level so the number is deterministic across machines, and it is a real gate:
`generateReleaseArtifacts` throws `BUDGET_EXCEEDED` rather than letting an oversized payload become
a release. It covers `map/bounded-points.json` only. `map/source.json` has no budget. The ~2 MB
gzipped figure ADR-013 set for the flat GeoJSON survives as `MAP_FLAT_GEOJSON_MAX_GZIP_BYTES` (with
`MAP_FLAT_GEOJSON_MAX_FEATURE_COUNT = 50_000`) in `apps/mobile/src/features/map/mapConfig.ts`,
where it is exported and nothing asserts against it. So the migration trigger those numbers were
meant to arm, moving per-point data to vector tiles rather than growing the flat file, is a rule a
human has to notice on mobile, while on the release path the only gate that fires is the
bounded-points one. For scale, `apps/web/src/lib/map-experience/door-catalog.ts` records the live
pin GeoJSON at roughly 2.3 MB uncompressed. (from ADR-013, "perf budget" / "migration triggers")

**Known gaps, narrower than the ADR left them.** State attribution is still bbox-first, but the
flat "an approximate bounding-box test, not polygon geometry" is no longer the whole truth. The
repo vendors the Census 1:20,000,000 cartographic boundary file at
`packages/domain/src/map/data/us-states-20m.json` (the same GeoJSON `apps/web` serves at
`/geo/us-states-20m.geojson`), and `state-boundary-geometry.ts` ray-casts it through the same
`pointInPolygonRings` helper the publish-time geo-integrity gate uses. Those polygons are consulted
only when a point falls inside more than one state's rectangle, which is the case that used to put
Philadelphia in New Jersey and the Milliken's Bend river point in Mississippi. A single unambiguous
bbox match still wins outright with no polygon check, so a point outside a state's true shape but
inside only its rectangle can still resolve wrong; that fast path is the gap that remains. The
NJ/NY Hudson-divide carve-out survives as a fallback for an inconclusive polygon test, not as the
primary fix. County attribution is unchanged and is the larger gap: `buildMapSource` populates a
county aggregate only from an explicit upstream jurisdiction hint and never derives one from a
coordinate. That is true even though county polygons are now vendored for rendering
(`apps/web/public/geo/us-counties-20m.geojson`) and drive the county choropleth layers. Drawing
county shapes and attributing a point to a county are different jobs, and only the first one is
done. (from ADR-013, "known gaps")

**Correction: the explore style does have a glyph server.** Two sentences in
`apps/web/src/app/map/explore-style.ts` attributed a rendering limit to ADR-013's known gaps and
got the cause wrong. The style sets `glyphs` to `OPENFREEMAP_GLYPHS_URL`, and
`EXPLORE_CLUSTER_COUNT_LAYER_ID` is a live `symbol` layer rendering `point_count_abbreviated` in
Noto Sans Regular, faded on decade transitions by `decade-layer-transition.ts`. It is not the
"documented no-op" the comment claimed. What is actually missing is an icon **sprite**: the style
declares none, so there is no way to draw literal square/diamond/ring marker geometry, which is why
kind identity is carried by a fill/stroke signature on circle layers and by CSS shapes in the
legend. The limit is real; its stated cause was not. (Corrected 2026-09-13, repo-gtm2y.)

**Correction: the mobile elevation tokens are not ADR-013.** `apps/mobile/src/ui/LiftedSurface.tsx`
and `apps/mobile/src/ui/tokens/elevation.ts` cite ADR-013 for the rule that mobile surfaces are
flat matte except map floating instruments, which may opt into an `sm` shadow. ADR-013 contains no
sentence about elevation, shadow or lift. The rule's real home is
`docs/ui/design-direction-v6-mobile.md`, which states the narrow `getShadowStyle` exception "for
map floating instruments only" and which is also where the ADR-013 attribution was invented (it
writes "flat matte everywhere except the ADR-013 map plate", conflating the plate's dark register
with a shadow allowance). That document still exists and can be opened, so those comments point
there. Worth knowing before anyone defends the exception: nothing under `apps/mobile/src` passes
`shadow="sm"` today, and the one explicit call site passes `shadow="none"`
(`features/explore/explore-edition-chrome.tsx:244`), so this is a permission nobody has taken up.
(Corrected 2026-09-13, repo-gtm2y.)

## Persistent map canvas (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-017-persistent-map-canvas.md` does not exist. It is cited 23 times in `apps/web`
TypeScript, four more times in CSS comments the source sweep missed, and 26 times across
`docs/ui/`, in every case as binding law. Recovered from the code. Two of its four parts hold
exactly; one holds in substance but not in the literal wording two comments still use; one did not
survive at all, and comments still describe it as live.

**One MapLibre instance, and a real gate behind it.** `apps/web/src/components/map-stage/MapStage.tsx`
owns the sole `maplibregl.Map`. That is enforced, not merely asserted:
`apps/web/src/lib/map-experience/map-libre-lifecycle.test.ts`, "MapStage is the only module that
constructs a MapLibre instance", greps `apps/web/src` for `new maplibregl.Map` and asserts the
result is exactly `['src/components/map-stage/MapStage.tsx']`. It runs under `apps/web`'s `test`
script (`node --test 'src/**/*.test.ts'`), so CI catches a second mount. The library's runtime
import lives in the same place, inside `ensureMap`'s async body. Every other module in the app
takes `import type` only, though `MapStage.tsx` itself also takes a *static*
`maplibre-gl/dist/maplibre-gl.css` import, so a comment claiming the CSS is dynamically imported
too is wrong. Nothing greps for the import: the constructor is what is gated. (from ADR-017,
"persistent map canvas: one MapLibre instance")

**The root shell owns the canvas. The route group the decision named does not exist.** ADR-017's
"Route-group layout owns the canvas" described an `apps/web/src/app/(map)/` group wrapping `/` and
`/explore`. There is no such group today. `MapStageProvider` mounts in
`apps/web/src/components/SiteShell.tsx` by way of `SiteShellProviders.tsx`, inside the ROOT layout,
so the plate sits above every route and the canvas survives navigation anywhere, not only between
the two original map surfaces. That is stronger than the decision asked for, and three consequences
are load-bearing:

- **The provider mounts bare.** The root layout passes it no data props. Awaiting
  `loadMapStageBase()` there would make every route in the app `force-dynamic`, including routes
  that must stay static and keep `generateStaticParams`. A surface that wants a plate does its own
  `await loadMapStageBase()` in its own server component and hands the result down as the first
  `patchData` (`MapStageProviderProps`' doc comment).
- **GL is built lazily.** `ensureMap()` runs on a surface's first contact with the handle, so a
  reading room that never speaks to the stage never pays for a WebGL context.
- **The plate renders as a sibling of `.ds-shell`**, not a descendant of any map surface. Plate
  geometry, the MapLibre chrome contract and marker styling therefore live in
  `apps/web/src/app/shell.css`, the sheet the root layout loads on every route.
  `apps/web/src/app/shell-layout.test.ts` asserts that in both directions: the plate rules are in
  `shell.css`, and `explore/explore.css` contains no `.ds-map-stage` rule at all.

**Covered, never unmounted.** On a reading surface the plate is painted over with `--ds-canvas` by
a gated `::after` rule rather than hidden with `display: none`. That is the persistence contract
itself: the MapLibre instance is never touched, returning to the Instrument does not rebuild it,
and no resize observer fires against a hidden container. `shell-layout.test.ts` asserts both the
cover and the absence of a `display: none` rule that would replace it. (from ADR-017, "persistent
map canvas: one MapLibre instance")

**`ssr: false` is gone from the shell on purpose, and restoring it would be a regression.**
`SiteShellProviders` mounts `MapMomentStage` and `MapStageProvider` synchronously, with no
`next/dynamic` and no `ssr: false`, so the shell they wrap (header, search, footer) is in the
server-rendered HTML on every route, including for a reader with JavaScript off and a crawler that
never runs it. MapLibre stays off the server because `MapStage.tsx` imports it inside a mount
effect, not because of a dynamic boundary in the shell. Anyone re-adding `ssr: false` here to
"protect" the canvas would be undoing a deliberate fix, not restoring an invariant.

**Request-scoped shared data.** The decision's "the group layout fetches entity views once for both
surfaces" survives as `React.cache()` memoization rather than as a layout fetch:
`apps/web/src/lib/map-experience/shared-map-data.ts` exports `getSharedPublicEntities`
(`cache(listPublicEntityViews)`) and `loadMapStageBase`, memoized the same way. Callers now include
`atlas-home.tsx`, `record-first-paint.tsx`, `records/load-records-index.ts` and three route
handlers, so "one fetch per request however many server components ask" is doing real work well
outside the two surfaces the decision had in view. (from ADR-017, "route-group layout owns the
canvas")

**Camera grammar: the presets are real and tested.** `apps/web/src/lib/map-experience/camera-presets.ts`
holds the four named tiers (`national`, `state`, `locality`, `point`) as motion tokens: `duration`,
`curve`, `speed`, a shared authored slow-out `easing` (`CAMERA_EASING_SLOW_OUT`, a cubic bezier
mirroring `@repo/ui`'s `--ds-easing`) and `padding`. Every preset has a reduced-motion twin at
`duration: 0`, and `runFlyPreset` calls `jumpTo` instead of running a timed animation in that case.
`camera-presets.test.ts` asserts the authored ranges: 2000-2600ms for national and state, curve
1.32-1.42, durations monotonically shorter as the descent narrows, padding tightening the same way.
The grammar cannot be silently retuned. The module takes no `maplibre-gl` runtime import, which is
what keeps it testable in plain Node. (from ADR-017, "camera grammar: authored presets, never
library defaults")

**"Raw flyTo defaults are banned" mostly holds, with one confirmed live exception. "flyPreset is
the only sanctioned way to move the camera" does not, and nothing enforces either one.** That
second sentence is what two source comments still say, and it is too wide. There are three
families of camera call site: `map-stage/camera.ts`'s `runFlyPreset`, which is what `flyPreset`
calls; `lib/map-experience/camera-moves.ts`, a second sanctioned vocabulary (wide, push, orbit,
tilt, spotlight, trace, flyToRecord, plus `resetBearing`) that drives the plate through the
structural handle `MapStage.getMap()` returns; and a few in-place calls (`door-immersive.tsx`'s
chapter flights, the Atlas zoom buttons, and MapStage's own cluster-expansion ease). Every one of
those passes an authored `duration`, and every arc flight among them passes an explicit `curve`
and `CAMERA_EASING_SLOW_OUT` (`spotlight` is the one gated move that issues no camera call at all —
it isolates without moving, so "authored duration" does not apply to it either way).

One call site does not belong on that list, and it sits in the same file that carries the rule.
`MapStage.tsx`'s own MapMoment framing effect — exercised on every article `mapInset` block through
`resolveMomentCamera` and `MapInsetMoment.tsx` — builds a bare `{ center, zoom, pitch, bearing }`
target and calls `map.flyTo(target)` with no `duration`, `curve`, `speed`, or `easing` at all
whenever the move is not a reduced-motion or plain-moment cut (`move: 'fly'` is the ordinary case).
That is a raw `flyTo` on library defaults, live on an ordinary article read, not a hypothetical: it
is the exact shape the next sentence warns nothing would catch. So the substance of the ban does
NOT fully hold — there is one confirmed gap — and enforcement is separately absent: there is no
lint rule, and no test would catch a new `map.flyTo({ center, zoom })`, including this one.
`camera-moves.test.ts` only guards `camera-moves.ts`'s own vocabulary; nothing exercises the
MapMoment framing effect's camera call at all (`room-kit.test.tsx` is the only test touching that
code path, and it asserts markup, not camera options). `door-home.test.ts` asserts the immersive
Door module imports no `maplibre-gl` runtime, a different guarantee (no second mount) that does not
bear on this gap. Treat "no library defaults" as a rule already broken once in the very file that
states it, and one a reviewer has to hold, not one CI will catch. (from ADR-017, "camera grammar:
authored presets, never library defaults")

**Viewport policy: a shareable URL restores what the reader was looking at, never where the camera
was.** This is the most enforced part of the decision, and the mechanism is not the one the
comments imply. `lat`, `lng` and `zoom` ARE parsed by `parseExploreSearchParams`, and
`buildExploreSearchParams` DOES write all three when the view state carries a `viewport`. The rule
is not "the code cannot emit them". It is enforced in three independent places:

- **The edge allowlist.** `EXPLORE_PAGE_PARAM_ALLOWLIST`
  (`apps/web/src/lib/runtime-hardening/constants.ts`) is generated from the parser's own
  `EXPLORE_URL_PARAM_KEYS` minus the named `EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS`
  (`['lat', 'lng', 'zoom']`, in `lib/map-experience/url-state.ts`). `normalizeQueryString` filters
  the incoming bag through that allowlist BEFORE it runs `/explore` through parse and rebuild, so a
  viewport key never reaches the serializer, and `handleQueryNormalization` 308s any URL that
  carried one. The exclusion is a named list, not an omission from an allowlist, so removing it is
  a decision someone has to make on purpose.
- **A runtime throw on the share path.** `assertNoViewportKeys` in
  `apps/web/src/lib/share/deep-link.ts` throws on any of ten forbidden keys (`lat`, `lng`, `lon`,
  `longitude`, `latitude`, `zoom`, `bearing`, `pitch`, `bbox`, `center`), a deliberately wider set
  than the three the allowlist drops.
- **The client never writes the live camera.** `use-explore-url-sync.ts` syncs the address bar with
  `history.replaceState` from the Lens only, and the view state it builds sets no `viewport`. Panel
  chrome (`panels`, `hidePanels`) is excluded for the same reason: which panels a reader has open
  is session state, not shareable meaning.

Three test files hold it, all under `apps/web`'s `test` script. `query-normalization.test.ts`
proves lat/lng/zoom never survive normalization on `/explore` and that a URL carrying them needs a
redirect, and its drift tests prove the exclusion covers keys the parser genuinely reads, failing
in both directions. `deep-link.test.ts` pairs the negative assertion with round-trips, which exist
precisely so the rule cannot be satisfied by emitting nothing. The reason is the part worth
keeping: a pinned camera hands the recipient a framing they did not choose and cannot tell apart
from the data, and a tight zoom on one county reads as an editorial claim about that county.
(from ADR-017, "URL: viewport + selection")

**The transition contract did not survive, and nothing implements it now.** ADR-017's hero
engagement choreography (hero chrome dissolving while `router.push('/explore?...')` runs, the
flight continuing uninterrupted across the navigation) went with the surfaces it described.
`HomeMapHero`, `ExploreMapExperience` and `ExploreMapCanvas` are all gone; `/` is now the Door, a
reading surface whose plate posture is ambient, and `/explore` is the Instrument. Comment blocks in
`apps/web/src/app/explore/explore.css` used to name the contract as if it were live. The "Hero
dissolve" class one of them described was not in the sheet at all, and the surviving
`ds-explore-panel-enter` keyframes were keyed on `.ds-explore-stage--entering`, which nothing in
`apps/web/src` ever set (the `.ds-explore-stage` element is not rendered either), so those rules
could never fire. They were deleted in repo-mtk9g rather than rewired, since rewiring them meant
inventing a state on markup that no longer exists;
`apps/web/src/app/explore/explore-enter-motion.test.ts` now holds the sheet and the markup to that
agreement. The page-level enter animation was deleted earlier, for a reason that is itself
load-bearing: `animation-fill-mode: both` left a permanently non-`none` computed transform on the
page-root wrapper, which made that wrapper the containing block for the fixed plate and let the
plate scroll with the document instead of holding the viewport. The plate holding the viewport now
depends on `.ds-shell-page-transition` never acquiring a transform. (from ADR-017, "transition
contract")

**Reduced motion is intact.** Every preset has a `duration: 0` twin, `runFlyPreset` calls `jumpTo`
whenever `prefersReducedMotion()` is true or a caller asks for `mode: 'cut'`, and every move in
`camera-moves.ts` collapses to zero duration. Both camera test files assert it. (from ADR-017,
"reduced motion")


## Explore basemap and live map source (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-025-mobile-map-data.md` does not exist; it was deleted in the 2026-07-24 docs purge
(`git show a2f559f8^:docs/adr/ADR-025-mobile-map-data.md` recovers the original text). It decided
the mobile basemap platform (self-hosted Protomaps PMTiles on Firebase Hosting/CDN as the default,
managed MapTiler as an owner-gated paid fallback that is "never a silent default") and inherited
the release-coupled redacted GeoJSON point contract `apps/api-public` already served for web
Explore. Ten citations name it across mobile config, the API's OpenAPI contract, and the handler
that builds the payload. Recovered from the code, which in one important respect has moved past
what the original text decided.

**The basemap that ships today is neither of the two options ADR-025 decided between.** ADR-025
(mirroring the web `ADR-013-map-stack.md`) chose self-hosted PMTiles as the default and managed
MapTiler as an owner-approved, cost-ceilinged fallback. Today's actual default on both platforms is
a third option the original text never named: free, third-party-hosted OpenFreeMap vector tiles
(`tiles.openfreemap.org/planet`, `.../fonts/{fontstack}/{range}.pbf`) — see
`apps/mobile/src/features/map/mapConfig.ts` (`DEFAULT_OPENFREEMAP_TILE_SOURCE_URL`,
`DEFAULT_MAP_GLYPHS_URL`) and web's `apps/web/src/lib/map-experience/dignity-style.ts`
(`OPENFREEMAP_TILE_SOURCE_URL`). MapTiler is gone from the live code entirely; its one surviving
mention (`dignity-style.ts`) explains why USGS imagery was chosen *over* it for satellite tiles, not
a wired basemap fallback. Self-hosted PMTiles is still reachable, but only as an opt-in override
(`MAP_PMTILES_URL` env / `extra.map.pmtilesUrl`) for "when a U.S. archive is published on CDN" — the
archive ADR-025 deferred to a future bead was never authored, so the decided default never shipped
and an undecided interim (OpenFreeMap) took its place with no decision record of its own.

**PMTiles configuration is validated and empty-string-safe, identically on both platforms.**
`apps/mobile/app.config.ts`'s `optionalHttpUrl` and `apps/mobile/src/features/map/mapConfig.ts`'s
`sanitizeHttpUrl` both trim the raw env/`extra` value, treat an empty string as unset, and require
the parsed URL's protocol to be `http:` or `https:` — anything else is silently dropped to
`undefined`/`null` rather than passed through. When `MAP_PMTILES_URL` does resolve, MapLibre Native
is meant to read the archive via the `pmtiles://` protocol layered over HTTPS range requests (the
original ADR-025 §2 requirement); nothing in the current mobile code path exercises that read
against a live archive, because no U.S. archive has been published, so the range-request behavior
is implemented but unexercised. (from ADR-025, "Explore basemap and live map source")

**`MAP_BASEMAP_ENABLED` is a real kill switch, not just a comment.** `mapConfig.ts`'s
`MAP_BASEMAP_ENABLED` reads `extra.map.basemapEnabled`, defaulting to enabled; an explicit `false`
wins even when a tile URL is configured, and `app.config.ts` plumbs it through from the
`MAP_BASEMAP_ENABLED` env var at build/OTA-config time. Flipping it removes the basemap tile source
entirely rather than degrading it, matching the original decision's "points-only, zero tile egress"
design. (from ADR-025, "Explore basemap and live map source")

**`GET /v1/map` is release-coupled and served from the same active-release pointer as every other
public read.** `handleMap` (`apps/api-public/src/http/handlers.ts`) reads the current release
pointer, lists that release's entities, and builds the response with `buildMapSourceV1`
(`apps/api-public/src/http/build-map-source-v1.ts`); entities without a `geoAnchor` are skipped
outright. The response goes through the same client-attestation, rate-limit, ETag and
cache-control path as `/v1/entity/{id}` and `/v1/search` — there is no map-specific auth or
throttling. (from ADR-025, "Explore basemap and live map source")

**"Redacted" and "coordinates are already reduced" mean a specific, table-driven coarsening, not a
vague privacy gesture.** `buildMapSourceV1` routes every entity through `packages/domain`'s
`buildMapSource`, wired to the real `redactLocationForPublic` (`packages/security/src/redaction.ts`)
as its only source of coordinates — the domain builder's invariant is that it never reads a raw
`lat`/`lng` back out of its input, only out of the redactor's return value. `redactLocationForPublic`
coarsens each coordinate to a fixed decimal count keyed to a public precision tier (`country`: 0
decimals, `state`/`county`: 1, `city`: 2, `neighborhood`/`campus`: 3, `institution`/`site`/`address`:
4; `none`: the coordinate is dropped and the feature skipped) and truncates any geohash to a
matching length. Before that coarsening runs, `reducePublicPrecision` can force a coarser tier
regardless of the source data: a `withheld_on_request` sensitivity class drops the location
entirely; a raw prohibited level (unit/parcel/exact-coordinates/residence) is forced to `city`; a
living person's location — or a place explicitly classed `living_residence` — is capped to the
product constitution's `livingResidenceMaxPublicPrecision` whenever living status is `living` **or
unrecorded** (the fail-safe default); `restricted_site`/`sensitive_site` locations are capped the
same way. Memorial and violence-history classes are the one deliberate exception: they publish at
source precision, uncapped, because a vague location would defeat the record's purpose. This same
reduction already ran once upstream, when the entity was published into `bb_public.release_entities`
(`redaction.ts`'s own header: it "runs INSIDE the publish path itself... for every... projection");
`buildMapSourceV1` re-runs it a second time rather than trusting the already-reduced projection, so
the map endpoint has no code path that can emit a coordinate the redactor did not just produce.
(from ADR-025, "Explore basemap and live map source")

**The reduction is enforced by construction and by one named regression test, not by the wire
schema.** There is no independent check on the served payload: `mapSourceV1Schema`
(`packages/public-contracts/src/v1/map.ts`) only bounds each coordinate to a valid lat/lng range and
caps the feature array at 20,000 — it does not check decimal precision, so a hypothetical second
code path emitting `MapSourceV1` features could ship an over-precise coordinate without failing
validation. What actually holds the guarantee is that `buildMapSourceV1` is the only producer of
`MapSourceV1` features and cannot construct one without going through `redactLocation`, plus
`packages/domain/src/map/map-source.redaction.test.ts`, which wires the real
`redactLocationForPublic` (not a stub) and asserts that a living person's exact residential
coordinate and street-address label never appear anywhere in the serialized output. That test runs
as part of `packages/domain`'s own suite; nothing separately re-verifies the guarantee against a
live `/v1/map` response. (from ADR-025, "Explore basemap and live map source")

**On the client, the mobile map source consumer only re-shapes fields it is given.**
`mapSourceV1ToFeatureCollection` (`apps/mobile/src/features/explore/map-source-client.ts`) copies
the wire feature's `coordinates` tuple and properties into the local `MapFeatureCollection` shape
MapLibre renders; it does not recompute, sharpen, or otherwise derive a coordinate from anything
else in the payload. `useExploreMapSource`'s `GET /v1/map` fetch shares the same attestation- and
ETag-aware transport, and the same release-cache fallback, as the other live data the app reads
(`docs/decisions-carryover.md`, "mobile data boundary"), and falls back to a bundled
`DEMO_MAP_SOURCE` only in `__DEV__` when the live endpoint is unreachable. (from ADR-025, "Explore
basemap and live map source")

## Mobile stack (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-020-mobile-stack.md` does not exist, and has not existed under that name since the
mobile ADRs were renumbered (commit `3b365d44`, landed 2026-07-21). That rename moved mobile-stack
from ADR-020 to ADR-021 and handed ADR-020 to "Supabase Postgres as system of record" — the "entity
source-of-truth precedence" addendum near the top of this file. `apps/mobile` never followed the
rename. Fourteen of its ADR-020 citations, plus thirteen more in `apps/mobile/README.md`, still use
the old number, and `app.config.ts` names the dead file path outright. A reader who follows any of
them lands on the Postgres cutover and finds nothing about Expo, MapLibre, SQLite, native
directories or OS floors. The numbering is verified against `git ls-tree -r a2f559f8^ -- docs/adr`,
the commit before the 2026-07-24 purge. Everything below is recovered from the code; the removed
document (`git show a2f559f8^:docs/adr/ADR-021-mobile-stack.md`) was read only as a check on how
wide each restatement should be, and where the two disagree the code wins and this says so.

**ADR-021 is not a safe substitute for the old number, because ADR-021 is overloaded too.** The
2026-09-12 addendum in this file titled "ADR-021's two invariants, recovered" is about the mobile
DATA BOUNDARY document — its §1 is the `@repo/public-contracts` zero-runtime-dependency boundary,
§2 the app/API compatibility floor, §3 response redaction, §4 dependency direction — and that
document is ADR-022 under the final numbering, ADR-021 only under the pre-rename numbering its own
citations use. So "ADR-021" means the mobile stack under the final numbering and the mobile data
boundary under the numbering half this tree actually cites. Do not resolve an `apps/mobile` ADR-020
citation by adding one to the number. Match the topic, the way the "Mobile cache and OTA release"
recovery in this file does for ADR-023 and ADR-024.

**Expo managed workflow with CNG, Expo Router and a custom dev client — but the exact-pin rule did
not survive.** `apps/mobile/package.json` declares `expo: ^57.0.0`; the lockfile resolves Expo
57.0.20, React Native 0.86.3, React 19.2.3 and TypeScript 6.0.3. `expo-router` and `expo-dev-client`
are both dependencies and both listed in `app.config.ts`'s `plugins`, so file-based routing and a
custom development build (not Expo Go) are what ships. The version policy required an EXACT Expo
SDK pin with no range, with React Native taken as whatever that SDK bundles and native modules added
through `expo install`; a caret range is not that. `apps/mobile/README.md`'s stack table still reads
"Expo SDK 56.0.16 ... Exact pin, no `^`/`~` range" and is stale on the version and on the pin shape
at once. Nothing in CI checks either. (from ADR-021 §1 and §5, "mobile stack")

**`apps/mobile` lives outside the pnpm workspace with its own npm lockfile, which is the fallback
the decision preferred not to take.** `pnpm-workspace.yaml` excludes it (`'!apps/mobile'`),
`apps/mobile/package-lock.json` is its lockfile, and CI's mobile lane installs with `npm ci` against
that file (`.github/workflows/ci.yml`). `metro.config.js` reaches the two workspace packages mobile
needs by path — `extraNodeModules` plus `watchFolders` for `@repo/public-contracts` and
`@repo/domain` — rather than through node resolution. The version policy preferred keeping mobile
inside the workspace with targeted `public-hoist-pattern` entries and isolating only as a last
resort; isolation is what shipped, on measured Metro/pnpm friction, and the removed document already
recorded the swap. What the policy actually wanted out of it — that adding mobile cannot perturb the
root `pnpm install` or any web, api or worker build — now holds by construction rather than by a
gate: no CI job asserts it, because after the exclusion there is nothing left to assert.
(from ADR-021 §5, "mobile stack")

**MapLibre Native is the renderer, and the self-hosted-PMTiles half of that decision is optional and
off by default.** `@maplibre/maplibre-react-native` (locked at 11.3.10) is the binding, wired through
its own config plugin in `app.config.ts` with `ios.useFrameworks: 'static'` and the OpenGL Android
location engine. The decision paired it with the same self-hosted Protomaps PMTiles archive the web
map reads. That is not what runs: `apps/mobile/src/features/map/mapConfig.ts` defaults to OpenFreeMap
vector TileJSON (`DEFAULT_OPENFREEMAP_TILE_SOURCE_URL`) and attaches a `pmtiles://` source only when
`extra.map.pmtilesUrl` is configured, with `MAP_BASEMAP_ENABLED` as a kill switch that degrades to
entity points over a flat dark canvas and zero tile egress. Do not read a citation of this decision
as evidence the mobile map is on our own tiles. The fixed dark "archive of record" register did
survive and is the tested half: `mapStyle.ts` takes every color from the generated brand tokens and
never from a parallel hex, the register does not follow the device light/dark setting, and
`assertNoHeatmapRegister` is exercised by `mapStyle.test.ts`. (from ADR-021 §2, "mobile stack")

**No Firebase SDK and no analytics SDK reaches the client at all, and a test enforces it.** The
decision allowed exactly one Firebase surface, `@react-native-firebase/app` plus `/app-check`, and
banned every data module. The narrower thing is true today: `apps/mobile/package.json` carries no
`@react-native-firebase/*` dependency of any kind, App Check is retired repo-wide, and attestation
is the plain `X-BlackStory-Client` header (`apps/mobile/src/security/api-client.ts`'s
`CLIENT_VERSION_HEADER`), attached to every request. `apps/mobile/src/observability/
no-raw-sdk-imports.test.ts` is the live gate: it scans every non-test `.ts`/`.tsx` under
`apps/mobile/src` and fails on `@react-native-firebase/app`, `/app-check`, `/crashlytics`, `/perf`
and `/analytics`, and on Google Mobile Ads, Segment, Amplitude, Mixpanel and the App Tracking
Transparency prompt. So "no analytics SDK is even a dependency" is a checked claim, not an assertion.
Two consequences a reader should carry: the staged monitor-then-enforce App Check rollout this
decision specified is dead along with App Check and nothing implements it, and the companion
prohibition — never emit an attestation credential or any JWT-shaped value to a log sink — is stated
under "Security and abuse assumptions" in this file and is not restated here.
(from ADR-021 §3, "mobile stack")

**`expo-sqlite` is the cache engine and exactly one module imports it.** `openMobileDatabase()` in
`apps/mobile/src/data/db/sqlite-database.ts` is the only `expo-sqlite` import in the app; everything
above it is written against the `CacheStore` port in `db/store.ts`, which has a second in-memory
implementation used both by the unit tests and as the degraded fallback when the on-disk database
cannot be opened. What that cache may hold, how a release stamp invalidates it, and the 512-byte
SecureStore carve-out beside it belong to the cache decision, recovered under "Mobile cache and OTA
release" in this file, not to this one. (from ADR-021 §4, "mobile stack")

**`ios/` and `android/` stay out of git, and `apps/mobile/.gitignore` is the entire enforcement.**
Lines 56-57 of that file (`/ios`, `/android`) are it. Both directories exist on a working machine,
generated by `expo prebuild` from `app.config.ts` plus config plugins, and no CI job, lint rule or
script checks that they are absent from a commit. `app.config.ts` is the committed source of native
identity, as the decision requires. The live consequence is recorded in `apps/mobile/README.md`:
because `expo prebuild` bakes `PRODUCT_BUNDLE_IDENTIFIER` into the generated Xcode project and
`ios/` is gitignored, variant drift there is always a local-machine condition, fixed by
re-prebuilding rather than by hand-editing the project. (from ADR-021 §6, "mobile stack")

**The OS floors are iOS 16.4 and Android API 26, they live in one file, and nothing asserts them.**
`app.config.ts` sets `ios.deploymentTarget: '16.4'` and passes `android.minSdkVersion: 26` to
`expo-build-properties`. The decision proposed iOS 16.0 and API 26 and made the SDK's own platform
minimum govern wherever it was higher — "whichever SDK MOB-006 actually pins governs" — which is why
iOS reads 16.4 and not 16.0. Android's 26 is held deliberately above the platform minimum to shrink
the test matrix a solo maintainer carries, and lowering it was made evidence-gated on device-share
data rather than a default. Both numbers are config literals: no test, no schema check and no CI
assertion reads either anywhere in the repo. The comment justifying 16.4 was written against Expo
SDK 56 and the app now runs SDK 57, so the "re-verify at every SDK upgrade" half of the rule is a
habit, not a gate, and whether 16.4 is still the platform minimum is not something this recovery
verified. (from ADR-021 §7, "mobile stack")

**What is deliberately not restated.** The rejected alternatives (bare React Native, Flutter, native
Swift and Kotlin, Mapbox, Google Maps, AsyncStorage, MMKV, WatermelonDB, Realm, committing the native
folders), the per-decision reversal costs and the migration triggers are argument rather than
invariant; they are in git and nothing in the tree cites them. `apps/mobile/README.md`'s thirteen
ADR-020 citations were also left pointing at the old number by that pass. That file is a long
maintained document whose own stack table was stale on the SDK pin, and relabeling its citations
without correcting the numbers beside them would have put a fresh label on wrong content. It needed
the same read-the-code treatment, not a find-and-replace.

**Done 2026-09-13 (repo-7u17u).** That README now carries a header note saying its "ADR-020" means
this decision under its pre-rename number, and its stack table was re-read out of
`apps/mobile/package.json` and `package-lock.json`: Expo 57.0.20 declared `^57.0.0`, React Native
0.86.3, Expo Router 57.0.19, TypeScript 6.0.3. The table had been asserting Expo 56.0.16 as an exact
pin with no range, which is the §5 drift this section already describes, presented as if it still
held. The "pnpm workspace resolution" section was also asserting an unresolved root
frozen-lockfile failure; `pnpm-workspace.yaml` carries `'!apps/mobile'` and CI's mobile lane runs
`npm ci`, so that finding is now marked resolved above its own evidence rather than rewritten.

## Mobile data boundary (recovered 2026-09-13, repo-gtm2y)

`docs/adr/ADR-022-mobile-data-boundary.md` does not exist. Fifty-six source comments across
thirty-three files cite ADR-022 and only five of them mean this document — two of those only in
part — plus two more outside that census (`apps/mobile/README.md:201` and `.env.example:147`) that
mean it squarely. Forty-nine of the rest are the pre-2026-07-22 number for what is now ADR-023
(mobile state, cache and offline read), already recovered in this file under "Mobile cache and OTA
release"; their citations are repointed there, not here. The last two, in `features/map/mapCamera.ts`
and `features/corrections/receipt.ts`, name rules no mobile ADR ever contained at all — see the
final paragraph. The mirror-image error is larger and this
pass does NOT fix it: nearly every ADR-021 citation inside `packages/public-contracts`, plus the
client-floor block in `apps/api-public/src/http/handlers.ts` and several `apps/mobile` headers, is
the pre-renumbering number for THIS decision. Old ADR-020 was the mobile stack, old ADR-021 was the
data boundary, old ADR-022 was cache and offline; the mobile ADRs all shifted up by one. So an
"ADR-021 §1/§2/§3/§4" or "ADR-021 red-team resolution #1/#2/#3" citation anywhere near mobile
belongs to this section, and `apps/mobile/src/data/secure-store.ts:7`'s "ADR-020" means the mobile
stack, not the Supabase system-of-record decision that carries that number today. The 2026-09-12
addendum above already recovered one piece of this document under the ADR-021 heading ("App/API
compatibility policy"); that is the same rule as §2 below, not a second decision.

**`packages/public-contracts` is the only code the server and the client both import, and one real
gate keeps it client-safe.** The package may hold versioned wire types, zod schemas for those same
shapes, pure environment-neutral validators, and the version constants; it may not hold route
handlers, request-authenticated logic, secrets, `firebase-admin`, a Firestore import, a `node:`
built-in, or a dependency on `@repo/domain` / `@repo/security` / `@repo/observability`.
`packages/public-contracts/scripts/check-boundary.mjs` is the enforcement, and it is not a
convention: it scans every shipped `.ts` under `src/` for forbidden specifiers, then re-walks only
the files `package.json`'s "exports" map actually points at, following real import edges, and it
works from an ALLOWLIST — `ALLOWED_EXTERNAL_SPECIFIERS` is `{zod}`, so an unlisted dependency fails
even though it is on no denylist. It also refuses `zod` itself if `zod` ever declares a runtime
dependency. Run today it reports 21 files scanned, 21 reachable from exports, PASSED. It is the
package's own `test` script, so `pnpm -r --filter './packages/**' run test` picks it up inside the
`Workspace Tests` job, which `infra/github/rulesets/main-protection.json` does require. This half of
the boundary genuinely cannot merge broken. (from ADR-022 §1, "mobile data boundary")

**Nothing gates the mobile half, and the flat rule this file used to state is false today.**
`apps/mobile/package.json` declares `@repo/domain`, `@repo/domain-core` and `@repo/public-contracts`
as `file:` dependencies, and `apps/mobile/src/features/record-facts/record-facts.ts` imports
`deriveEraBuckets`, `filterDecadesAtOrBeforeCurrent` and `isDatePrecision` from `@repo/domain/era`.
That subpath is a re-export shim (`packages/domain/src/era.ts`) over `@repo/domain-core/era`, which
imports nothing at all, and `apps/mobile/metro.config.js` aliases both package roots so Metro
resolves them. What is true today is therefore narrower than the old bullet and wider than the ADR:
exactly one `@repo/domain` subpath is imported, it is a leaf, and `@repo/firebase`, `@repo/security`
and `firebase-admin` are imported nowhere in `apps/mobile` — and nothing enforces that it stays the
only one. `apps/mobile` is excluded from the pnpm workspace (`!apps/mobile` in
`pnpm-workspace.yaml`), so `pnpm -r` never reaches it; `scripts/validate-boundaries.mjs` does walk
`apps/mobile/src`, but its only rules are app-cannot-import-app, the `@repo/web` →
`@repo/data-access` file-level rule, and dependency cycles. None of them would notice a mobile
import of a non-leaf domain subpath. The one adversarial guard that does exist is narrower than the
boundary: `apps/mobile/src/observability/no-raw-sdk-imports.test.ts` fails on a Firebase or
ad/analytics SDK import, and it runs in the non-required `Mobile Checks` job. (from ADR-022 §4,
"mobile data boundary")

**"Types only" is shorthand, and taking it literally would be wrong.** `apps/mobile` imports real
runtime values from `@repo/public-contracts`: `mapSourceV1Schema` (`features/explore/map-source-client.ts`,
`features/entity/use-ordered-entity-ids.ts`), `evidenceLabel` / `evidenceMeterLabel` /
`recordConfidenceTier`, `ENTITY_KINDS` and `CLAIM_ROLES`, `stripInternalIds` / `containsInternalId`,
and the destinations catalog. The ADR's own normative reading of its dependency diagram allowed
exactly that — the contracts package's runtime footprint on the client is limited to pure zod
schemas and pure validators, with no shared runtime service, singleton or transport in it — so the
rule to hold onto is the absence of shared runtime machinery, not the word "types". Two module
headers currently claim the opposite and are simply stale:
`apps/mobile/src/features/entity/types.ts` and `features/content/content-types.ts` both say
`@repo/public-contracts` "cannot be imported here today" and then import it a dozen lines later.
(from ADR-022 §1/§4, "mobile data boundary")

**Every byte mobile reads comes over HTTP from `apps/api-public`, and the one write goes to a
different surface that cannot publish.** `dispatch` in `apps/api-public/src/http/router.ts` serves
`/v1/health`, `/v1/compatibility`, `/v1/bootstrap`, `/v1/search`, `/v1/search/nearest`, `/v1/map`
and `/v1/entity/{id}`, and rejects anything that is not GET or HEAD with a 404-shaped response
rather than a 405 that would advertise the route table. Corrections are the single exception the
decision allows, and they do not go here: `apps/mobile/src/features/corrections/client.ts` posts to
a separate `baseUrl`, the submissions surface, whose `apps/api-submissions/src/quarantine.ts` writes
only `submission_quarantine` records, refuses any record whose `canonicalWriteAllowed` is set, and
whose `guardPublishAttempt` is real — `apps/api-submissions/src/index.test.ts` asserts "submissions
compromise cannot publish". No client Supabase, Postgres or Firestore access exists anywhere in
`apps/mobile`; the only network origin is `extra.apiBaseUrl`. (from ADR-022 §3, "mobile data
boundary")

**The `/v1` URL prefix is the wire contract; `X-BlackStory-Client` is only the version floor, and it
fails open.** The constants live in `packages/public-contracts/src/version.ts`: `API_VERSION` and
`MIN_SUPPORTED_API_VERSION` are both `'v1'` today and `DEPRECATION_WINDOW_DAYS` is 90 (asserted by
`version.test.ts`). `enforceClientFloor` (`apps/api-public/src/http/handlers.ts`) parses
`X-BlackStory-Client: <platform>/<semver>; api=<n>` and returns `CLIENT_VERSION_UNSUPPORTED` with
HTTP 426 — the status is `CLIENT_VERSION_UNSUPPORTED_HTTP_STATUS` in
`packages/public-contracts/src/errors.ts`, asserted by `errors.test.ts` — ONLY when a caller
declares an api major below the floor. An absent or unparseable header parses to `undefined` and
serves normally: the floor is a forced-update affordance for honest clients, never an authorization
gate, and it is applied on five handlers (`handleBootstrap`, `handleEntity`, `handleMap`,
`handleSearch`, `handleVectorSearch`), not on `/v1/health`. `handleCompatibility` adds the soft
`Deprecation: true` header for a supported-but-not-current client. `evaluateClientCompatibility`
(`packages/domain/src/publication/mobile-bootstrap.ts`) is the manifest-side twin, returning
`app_build_below_floor` or `api_version_unsupported`. Note what has never been exercised: only one
major has ever existed, `KNOWN_API_VERSIONS` is `[API_VERSION]`, so no `/v2`, no N-1 coexistence and
no 90-day window has ever actually run. (from ADR-022 §2, "mobile data boundary")

**The contract closes the location PRECISION LABEL and nothing else — the coordinate itself is only
range-checked.** `entityV1Schema.locationPrecision` is a closed enum that cannot parse `'address'`
or `'exact'`, and `packages/public-contracts/src/v1/entity.test.ts` proves it. But
`geoAnchorV1Schema` is `lat`/`lng` bounded only to valid degree ranges plus a geohash and a match
method, so a raw residential coordinate is structurally expressible; what keeps one off the wire is
the server-side redaction chokepoint, not the contract type. The removed ADR's own wording — "the
contract types must not even be able to express a raw residential coordinate" — is stronger than the
code, and restating it as an invariant would be exactly the false binding law this recovery exists
to undo. The client adds its own defense rather than trusting that claim:
`apps/mobile/src/features/map/mapCamera.ts` carries `coordinateDecimals`, `coarsestDecimals`,
`isNoMorePreciseThan` and `coarsenTo` so a derived or cluster point is never more decimal-precise
than the coarsest input it summarizes. The other by-construction omissions do hold: no raw
notability or relevance score (`notabilityBasis` carries string leaves and evidence ids only), and
no reviewer identity, moderation state, abuse signal or internal source-lineage rollup.
(from ADR-022 §3, "mobile data boundary")

**SecureStore holds small opaque secrets, and only one of the "two guards" its own comment names is
a runtime control.** `apps/mobile/src/data/secure-store.ts` allows a correction receipt code and the
per-install search-key salt; bulk cached content belongs in SQLite. The byte cap is real:
`MAX_SECRET_BYTES` is 512 and `assertSmallSecret` throws `SecretTooLargeError` inside
`createSecretStore.set` before `backend.setItemAsync` is ever reached, tested in
`secure-store.test.ts`. The second guard — "a closed allow-list of secret keys (`SecretKey`) — there
is no API to stash arbitrary blobs under arbitrary keys" — is a TypeScript union over this module's
own API and nothing more. `apps/mobile/src/features/search/recent-searches.ts` writes
`RECENT_SEARCHES_SECRET_KEY`, which is deliberately not in `SECRET_KEYS`, straight to the same
narrow `SecretBackend` port, reusing only `assertSmallSecret`; that carve-out is recorded in the
2026-09-12 (repo-30k6) addendum above. The allow-list constrains one module, not the keychain.
(from ADR-022, "mobile data boundary")

**The bundled legal copy is DERIVED from these decisions rather than drafted as a promise, and one
sentence of it has drifted.** `apps/mobile/src/features/content/content-catalog.ts` ships the
privacy and terms pages inside the app binary, and its header states the editorial rule: legal copy
"states only what the program's own accepted invariants already establish ... rather than
fabricating legal commitments". That is a real invariant and worth keeping precise — the app may
state as policy only what the boundary and the cache policy already make true in code, so the page
is a description of the system, never a commitment the system does not keep, and it may not be
edited into a promise without the code moving first. Most of it still holds: "no advertising or
tracking SDKs" (`no-raw-sdk-imports.test.ts`), "a read-only reference app ... no user accounts, no
purchases, and no user-generated content beyond an opaque correction submission (reviewed before
anything is published)" (GET/HEAD-only dispatch, quarantine-only submissions), and "cached search
results are keyed by a salted hash of your query shape, never the raw text you typed"
(`hashSearchKey`). One sentence does not: "Query text you type, correction-submission content, and
precise device location are never written to on-device storage" is false as written, because up to
eight recent search terms are persisted to the Keychain/Keystore under the repo-30k6 carve-out and
that feature is wired into `SearchScreen`. Either re-scope that sentence to the SQLite cache or
change the feature; do not leave a shipped privacy page asserting something the app does not do.
(from ADR-022 §3, "mobile data boundary")

**Two citations attributed rules to this ADR that no mobile ADR ever contained, and they are
corrected rather than repointed.** `cameraMotion` in `apps/mobile/src/features/map/mapCamera.ts`
cited "the reduced-motion contract (ADR-022 / accessibility gate)"; none of ADR-021 through ADR-025
mentions reduced motion or accessibility anywhere. The contract itself is real —
`apps/mobile/src/ui/useReduceMotion.ts` reads the OS setting and `cameraMotion` collapses the
duration to `durationInstant`, asserted in `__tests__/mapCamera.test.ts` — it just was never an ADR
decision. `apps/mobile/src/features/corrections/receipt.ts` cited an "ADR-022 clear-deletion
posture"; that phrase appears in none of the removed documents. `clearStoredReceiptCode` and
`diagnostics.clearCache` both do what the comment implied, so the behavior stays and the invented
citations go.

## Small recovered decisions (2026-09-13, repo-gtm2y)

Six ADRs, thirteen citations, none previously restated here. Each is small enough for a short
paragraph rather than its own section, so they are grouped under one heading.

**ADR-006, GitHub Actions deployment model.** `docs/adr/ADR-006-github-actions-deployment.md`
does not exist. What it decided about the production pipeline shape is still true of what exists:
`.github/workflows/deploy-production.yml` is `workflow_dispatch`-only, requires the protected
`production` GitHub Environment, pins a full 40-character commit SHA before anything runs (the
`gate` job's regex check), and writes and validates deployment provenance
(`infra/github/release-pipeline/write-provenance.mjs`, `validate-provenance.mjs`). What did NOT
hold is the "explicit promote" requirement decision item 7 placed on public web:
`docs/runbooks/production-release.md` states plainly that Vercel's git integration auto-builds and
aliases every commit landed on `main` straight to Production, with no manual promote step in
between — merging the staging→main PR described in this repo's root `CLAUDE.md` under "Branching
& Release Policy" **is** the production release (confirmed 2026-08-05 on PR #116 and again
2026-08-12 on PR #130, repo-8ary/repo-h1b2). This does not contradict
`infra/github/release-pipeline/lib/auto-rollout-guard.mjs`'s `assertNoAutomaticRollouts`: that
guard only checks that no GitHub Actions *workflow* itself auto-triggers a deploy on push to
`main` (`deploy-staging.yml`, `deploy-production.yml`, `progressive-release.yml`) — Vercel's own
git-integration auto-deploy sits outside GitHub Actions entirely and was never in that guard's
scope. (from ADR-006, "GitHub Actions deployment model")

**ADR-012, production environment re-split.** `docs/adr/ADR-012-production-environment-resplit.md`
does not exist. Its three-project topology (production stays `black-book-efaaf`; new
`blackbook-staging` and `blackbook-internal` projects split off staging and research/admin) is
still only a design target: `docs/runbooks/legacy-gcp-project-id.md` confirms `black-book-efaaf`
is the only live project, and the two new projects were since renamed in the design itself, from
`blackbook-staging`/`blackbook-internal` to the functional ids `repo-staging`/`repo-internal`
(matching the BlackBook → BlackStory product rename). `packages/config/src/scheduled-jobs/types.ts`'s
`SCHEDULED_JOB_ENVIRONMENTS = ['repo-internal']` names that still-unprovisioned target by its
later id — it is not a live project, and (per the "Scheduled-job worker packages" recovery above)
nothing here runs against a Cloud Scheduler pointed at any GCP project split today; the roster's
real jobs dispatch through Corsair systemd or `discovery-campaigns.yml` instead. (from ADR-012,
"production environment re-split")

**ADR-018, Firebase scheduled Functions for discovery.**
`docs/adr/ADR-018-firebase-scheduled-functions-discovery.md` does not exist, and unlike the other
five ADRs in this group it was already dead before the 2026-07-24 purge — its own preserved text
records `Status: Superseded by ADR-028` and an archive note that "production discovery dispatch no
longer runs on Firebase scheduled Functions." Both citations here describe that same, correct
supersession and only need to stop pointing at a document that never survived it.
`apps/web/scripts/check-kill-switch.mjs` names `functions/src/kill-switch-env.ts` as the old
Firestore-reading code its Postgres query replaces, but that path is gone too — the whole
`functions/` package was deleted (`repo-348e.8`). `.github/workflows/discovery-campaigns.yml`
correctly calls itself that design's replacement: it is the live production discovery scheduler,
reading the same `bb_ops.kill_switches` row through `check-kill-switch.mjs` that the old Functions
code read from Firestore, fail-closed either way. This ADR is genuinely dead; both citations are
corrected to stop naming it, not restated. (from ADR-018, dead — superseded by ADR-028 before the
purge)

**ADR-026, PostgREST published-read surface.**
`docs/adr/ADR-026-postgrest-published-read-surface.md` does not exist, but the decision is live
and was checked against the running database, not just the migration file: migration
`20260721180000_postgrest_published_views.sql` is applied under this name in project
`twykhihqkcldpreuovay` (`blackstory-app`)'s migration history. It creates `public.published_entities`
and `public.published_search_index`, both `WITH (security_invoker = true)` — so the underlying
`bb_public` RLS stays the fail-closed gate, not the view — both filtered to
`bb_public.active_release`, and both granted `SELECT` to `anon`/`authenticated` only, never
`bb_canonical`, `bb_research`, or any write path. This is exactly the decision's core rule:
published-only views over active-release data, as a second surface alongside `apps/api-public` for
attested clients, not a replacement for it. `packages/operator-mcp`'s `get_law_timeline` stub
correctly names these views as the read source a follow-up bead will wire it to. (from ADR-026,
"PostgREST published-read surface")

**ADR-027, Vercel for public web hosting.**
`docs/adr/ADR-027-vercel-public-web-hosting.md` does not exist. Its live claims still hold: Vercel
git integration deploys `apps/web` (which now includes admin, per the 2026-09-11 addendum above)
from `main` for Production and from the `staging` branch for Preview, and there is no Firebase App
Hosting promote path for public web — the `black-book-web-production`/`black-book-web-staging`
backends were deleted. The one clause that changed is the promote model, and it is the same change
recorded under ADR-006 above: it is no longer "Production traffic moves only through explicit
promote," it is "the staging→main PR is the gate, and Vercel's git integration does the deploy
automatically once that PR merges." (from ADR-027, "Vercel for public web hosting")

**ADR-029, theme impact packets.** `docs/adr/ADR-029-theme-impact-packets.md` does not exist, but
the rule its one citation carries — juxtaposition, not causation — already has a live home:
`docs/methodology/juxtaposition-not-causation.md` exists and states that rule directly, so the ADR
half of the citation is the only dead half. The mechanical side of the decision is still enforced
at the schema level: `bb_reference.theme_impact_packets.method_stance` carries a `CHECK` constraint
restricting it to `juxtaposition` or `gated_causal_claim`. (from ADR-029, "theme impact packets")

## Native map render layer (recovered 2026-09-13, repo-urrta)

`docs/adr/ADR-025-mobile-map-data.md` does not exist; it was deleted in the 2026-07-24 purge and
recovers with `git show a2f559f8^:docs/adr/ADR-025-mobile-map-data.md`. This section covers the
RENDER half of that decision — style, attribution, failure modes, camera and clustering under
`apps/mobile/src/features/map/**` and `apps/mobile/src/features/explore/**`. The DATA half of the
same ADR (tile source, `GET /v1/map`, what "redacted" means on the wire) is already recovered above
under "Explore basemap and live map source" and is not repeated here. Recovered from the code; where
the code and the removed document disagree, the code is what is written down and the disagreement is
named.

**Nineteen source comments cite "ADR-024" and mean ADR-025, and they have been wrong since the
commit that wrote them.** `0ad45f80` ("Resolve mobile map data/PMTiles strategy and native map spike
(MOB-011)", 2026-07-19) added `docs/adr/ADR-025-mobile-map-data.md` while its own commit message
called the document "ADR-024" throughout, and `git ls-tree 0ad45f80^ -- docs/adr/` shows
`ADR-024-mobile-build-release.md` already present at that commit. Every map comment written in that
effort inherited the wrong number. This is NOT the same error recorded under "Mobile cache and OTA
release": there, citations carried a stale pre-renumbering number for a document that really was
ADR-024. Here the number was never right in the first place. The real ADR-024 (mobile build,
distribution, OTA update, release rollback) is recovered under "Mobile cache and OTA release" and
contains no map, tile, attribution or redaction content at all; fifteen genuine ADR-024 citations
under `apps/mobile/src/updates/**`, `apps/mobile/src/observability/report-context.ts` and the EAS
block of `apps/mobile/app.config.ts` were left untouched. One citation,
`apps/mobile/src/features/map/mapConfig.ts:8`, named the literal path
`docs/adr/ADR-024-mobile-map-data.md` — a filename that never existed under either number.
`git log --all --diff-filter=A -- 'docs/adr/ADR-024*' 'docs/adr/ADR-025*'` returns exactly two
additions: `ADR-024-mobile-build-release.md` (`3b365d44`) and `ADR-025-mobile-map-data.md`
(`0ad45f80`). (from ADR-025, "native map render layer")

**§7's degraded-failure rule is the strongest-held decision in this section: a tile failure degrades
the map and never strands the reader.** `MapScreen` (`apps/mobile/src/features/map/MapScreen.tsx`)
returns the shared `ErrorState` from an early branch on `engineFailed || loadState.kind === 'error'`,
so the native `<Map>` is genuinely not mounted in an error state rather than mounted-and-hidden. In
Explore the bottom sheet and records rail render outside every `mapLive` guard
(`features/explore/ExploreView.tsx`), and `ExploreView.test.tsx:412` asserts both at once: the
degraded map state and an interactive rail. That is the rule the ADR wrote and the code keeps.
(from ADR-025 §7, "native map render layer")

**But the classifier the code presents as the spine of §7 has no production caller.**
`classifyMapError` (`features/map/mapLoadState.ts`) is pure, well tested (`mapLoadState.test.ts`) and
called from nowhere outside that test and the `features/map` barrel. What actually produces a live
failure mode is `features/explore/useExploreMapSource.ts`, which assigns them literally from the
`GET /v1/map` fetch outcome: `offline-no-cache` becomes `offline-cold-start`, everything else becomes
`provider-outage`. `MapScreen`'s `onDidFailLoadingMap` sets a fourth mode, `map-canvas-unavailable`,
directly, passing the native reason text to nothing. So `corrupt-tiles` — the mode that exists for
a 416 or a collapsed range response, the whole point of §2's range-request requirement — is
unreachable at runtime today, and the live modes are classified from the POINT-DATA fetch, not from
tile loading at all. The union has four modes; the ADR named three. `MAP_FAILURE_COPY` and the
`MapLoadState` union are live; the classifier is an unused, correct implementation. (from ADR-025 §7,
"native map render layer")

**§8's attribution rule has drifted the furthest, and a test now asserts the opposite of what the
ADR wrote.** The license obligation is real (basemap geometry is OpenStreetMap, ODbL) and the part
that holds is that MapLibre's own attribution and logo are disabled (`attribution={false}`,
`logo={false}` on `<Map>`) so placement is ours. The rest has moved. `MapAttribution.tsx` renders
COLLAPSED by default: an info toggle with no license text on screen until a reader presses it, the
full lines living in the button's `accessibilityLabel`. Explore hides the element outright —
`attributionVisible = mapLive && sheetSnapIndex <= EXPLORE_SHEET_PEEK && !instrumentsOpen`
(`ExploreView.tsx:249`) — and `ExploreView.test.tsx:209` is named "hides map attribution when a
selection expands the sheet". The ADR said the element is always visible and that the narrative sheet
must not fully occlude it, with a device screenshot as a MOB-012 acceptance item. There is no
screenshot check and no Maestro suite anywhere in this repo. Anyone reasoning about ODbL compliance
should start from that paragraph, not from the word "Persistent" the module header used to open with.
(from ADR-025 §8, "native map render layer")

**§9's dignity invariant survives in the form that matters and is gone in the form it was written.**
What holds: `mapStyle.ts` binds `themeColors.dark` unconditionally, so the native plate does not
follow the OS theme; every color comes from the generated brand tokens through `DIGNITY_PALETTE` and
`@/ui`; there is no `heatmap` layer anywhere; and no point or cluster color is keyed to density or
count — `ENTITY_CLUSTER_LAYER_STYLE.circleColor` is the single flat `DIGNITY_PALETTE.point`, with
only the radius stepping on `point_count`. What is gone: "entity points are a single flat Copper Pin
color at a fixed radius". `entity-paint.ts` now encodes kind family as shade plus a glyph rim
signature, and `marker-size.ts` drives radius from evidence count, a confidence-tier modifier and a
zoom scale. That is a richer encoding than the ADR authorized, and it is deliberate v6 work; the
prohibition it must not cross is the color ramp, and it does not. Enforcement is a test only:
`assertNoHeatmapRegister` (`mapStyle.ts`) has no runtime caller — it is exported from the
`features/map` barrel and exercised by `mapStyle.test.ts`. Nothing stops a new heatmap layer at
build or run time. (from ADR-025 §9, "native map render layer")

**The camera privacy ceiling is real, and it is enforced by two overlapping mechanisms, not split
cleanly by preset name.** `MAP_MAX_ZOOM = 12` (`features/map/mapCamera.ts`) exists because the
redacted artifact tops out at city/neighborhood precision. `cameraForPreset` clamps the zoom on every
`center` target it returns (`mapCamera.test.ts:139` asserts no preset exceeds the ceiling for any of
the four presets) — and CORRECTION: `state`/`locality` are not always `bounds`. They return a
`center` target, with a zoom `cameraForPreset` itself clamps via `PRESET_ZOOM`/`clampZoom`, whenever
they are framing zero or one coordinate; that is the exact case `mapCamera.test.ts:139` exercises,
since it always passes a single point for every preset. Only `national` unconditionally returns a
`bounds` target with no zoom at all; `state`/`locality` return `bounds` only when framing TWO OR MORE
coordinates. Bounds targets are held by `<Camera minZoom={MAP_MIN_ZOOM} maxZoom={MAP_MAX_ZOOM}>` in
`MapScreen.tsx`, which also bounds the pinch gesture, the `+`/`-` buttons (`zoomBy` clamps again) and
`zoomAfterClusterExpand`. So the ceiling is not one clamp assigned to three named presets and a
second clamp assigned to the other one: `cameraForPreset`'s own clamp already covers every
single-point framing — including the common case of a state/locality view centered on one selected
entity — and the outer `<Camera>` clamp is the backstop for multi-coordinate bounds fits and for
anything `cameraForPreset` does not cover. Two independent clamps, both real, but not partitioned by
preset name. One stale detail: the module header cited `boundsForFeatures`, which does not exist; the
function is `boundsForCoordinates`, and it does return only the min/max envelope of what it was
given. (from ADR-025 §9, "native map render layer")

**Read the clustering privacy claim carefully: the module that coarsens is not the module that
draws.** `features/explore/clustering.ts` is a correct, tested implementation of aggregation-only
clustering — members keep their original redacted coordinates byte-for-byte, the cluster marker is
`coarsenTo(centroid, coarsestDecimals(members))`, and `assertClusterPrecisionSafe` throws if either
property is violated. None of it runs in the app. `clusterFeatures`, `resolveCluster` and
`assertClusterPrecisionSafe` have no caller outside `__tests__/clustering.test.ts` and the
`features/explore` barrel; the records rail takes `ExploreFeature[]` straight from
`explore-controller.ts`'s `visibleFeatures`, and the tap handler reads the native feature. What
actually clusters on device is MapLibre Native's built-in supercluster, enabled by
`cluster={clustering} clusterRadius={50} clusterMaxZoom={MAP_MAX_ZOOM}` on the `<GeoJSONSource>` in
`MapScreen.tsx`. Supercluster positions a bubble at the mean of its members, and that mean can carry
more decimal places than any member; nothing coarsens it. State the guarantee narrowly: no code path
in `apps/mobile` reverse-geocodes, jitters or sharpens an entity coordinate, and every per-entity
coordinate that reaches the native source is the one `GET /v1/map` served
(`explore-feature.ts`'s `toExploreFeature`/`toMapFeatureCollection` pass the array through
unchanged). The one derived coordinate on device is the cluster bubble's position. It is never
rendered as a number, and it is read back only by `clusterCenterFromFeature` to set a camera center
clamped to `MAP_MAX_ZOOM`. Averaging already-coarsened coordinates cannot recover a finer one, so
this is not a de-redaction — but it is not the coarsened marker `clustering.ts` describes either, and
`assertClusterPrecisionSafe` has never been run against it. (from ADR-025 §9/§10, "native map render
layer")

**§10's render-layer redaction regression exists and proves a narrower thing than its name
suggests.** `features/map/__tests__/MapScreen.redaction.test.tsx` renders `MapScreen`, captures the
GeoJSON handed to the mocked native source, and asserts that the raw living-person residential
coordinate and the street-label fragment (`RAW_LIVING_PERSON`) never appear, that the coarsened
city-precision value does, and that no feature carries a residential precision class. It runs against
`DEMO_MAP_SOURCE`, a bundled fixture — not against a live `/v1/map` payload. So what it proves is
that the render layer is a faithful, non-amplifying consumer of a source it is given. The
authoritative raw-to-redacted guarantee is upstream and unchanged:
`packages/domain/src/map/map-source.redaction.test.ts` wires the real `redactLocationForPublic` from
`@repo/security`, and "Explore basemap and live map source" above records the coarsening tiers and
where they are applied. The mobile app never sees an unredacted coordinate because it never fetches
one; that is a property of the API boundary, not of anything in `features/map`. (from ADR-025 §10,
"native map render layer")

**The §5 migration threshold and the §6 kill switch are recorded elsewhere in this file; only the
mobile render-side facts are added here.** The flat-GeoJSON-to-vector-tiles trigger
(`MAP_FLAT_GEOJSON_MAX_GZIP_BYTES = 2 MiB`, `MAP_FLAT_GEOJSON_MAX_FEATURE_COUNT = 50_000` in
`features/map/mapConfig.ts`) is exported and asserted against by nothing — see "Map stack": size
budgets for the one release-time gate that does fire. `MAP_BASEMAP_ENABLED` is covered under "Explore
basemap and live map source"; the render-side proof is `mapStyle.test.ts:95`, which asserts that
`buildBasemapStyle({ basemapEnabled: false })` returns zero sources and a single `background` layer,
so the kill switch really does produce points-over-dark-canvas with no tile egress rather than a
degraded tile fetch. Glyphs are the exception that still loads: `resolveGlyphsUrl` always returns an
HTTPS template even on the killed canvas, because a cluster-count symbol layer with no `glyphs` URL
fails natively with an unsupported-URL error. (from ADR-025 §5/§6, "native map render layer")

**The ADR's "Deferred" section is resolved, and one of its stated consequences is now moot.**
`@maplibre/maplibre-react-native` IS registered in `app.config.ts`'s `plugins` array today — the
package's own official plugin, exactly as the 2026-07-20 adversarial amendment prescribed, with no
bespoke `withMapLibre` authored here — and `expo-build-properties` carries
`ios.useFrameworks: 'static'`. The ADR recorded that static frameworks would have to be reconciled
with RN Firebase's identical requirement (MOB-010). There is no React Native Firebase dependency in
`apps/mobile` at all any more (`docs/data/firebase-wind-down.md`, the `repo-348e` epic), so
`useFrameworks: 'static'` now exists for MapLibre alone and the reconciliation that made this a
coordinated build-gate task no longer has a second party. (from ADR-025 "Deferred" and "Consequences",
"native map render layer")

**Nothing that can block a merge enforces any rule in this section.** Every test named above
(`mapStyle.test.ts`, `mapCamera.test.ts`, `mapLoadState.test.ts`, `MapScreen.test.tsx`,
`MapScreen.redaction.test.tsx`, `MapAttribution.test.tsx`, `clustering.test.ts`,
`ExploreView.test.tsx`) runs in the `Mobile Checks` job of `.github/workflows/ci.yml`, which is gated
on `changes.outputs.mobile` and is not in the required set —
`infra/github/rulesets/main-protection.json` requires only "Workspace Checks", "Workspace Tests",
"Unit Tests (Python)" and "Governance", and ci.yml's own header says "Mobile is not required". The
one piece of this decision behind a required check is upstream and belongs to another section:
`packages/domain/src/map/map-source.redaction.test.ts` runs in "Workspace Tests". On mobile, the
dignity guard, the precision guard, the zoom ceiling and the attribution behavior are all held by
tests a human has to choose to care about. (from ADR-025, "native map render layer")
