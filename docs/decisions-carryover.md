# Decisions carryover

Still-binding invariants extracted from ADR/decision docs removed 2026-07-24
(`repo-xez5.11` docs purge). History is preserved in git (`git log -- docs/adr/`,
`docs/prds/`, `docs/memos/`, `docs/meetings/`, `docs/notes/`, `docs/bb-001/`,
`docs/mobile/decisions/`). Only rules not already stated in a surviving doc are
listed here; most invariants from the removed ADRs were already restated in
`docs/data/`, `docs/security/`, `docs/mobile/security/threat-model.md`, and
`docs/relationship-taxonomy.md`, and did not need duplication.

- **Mobile client never imports server-only packages.** `apps/mobile` must never import
  `packages/domain` or `packages/firebase` directly — those packages carry Node/`firebase-admin`
  dependencies and are server-side only. The mobile app reads exclusively through
  `apps/api-public`, sharing only environment-neutral wire types from `packages/public-contracts`.
  (from ADR-022, "mobile data boundary")

- **Admin never edits active public projections directly.** Changes to what the public site
  serves must go through the publication workflow (preview → promote / release activation), never
  a direct write to the active public projection tables. (from ADR-004, "public projection and
  immutable publication snapshot model")

## Addendum, 2026-07-24 (repo-xez5.10): entity source-of-truth precedence

Entities historically existed in four places (git fixtures, Firestore `canonicalEntities`,
Supabase `bb_canonical.entities`, in-code hand-curated tables). This restates the ADR-020
precedence rule. Firestore is leftover, not a current write path:

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

**This recovery is PARTIAL, and deliberately so.** The two invariants above are the ones whose
citations were load-bearing enough to mislead (the dependency direction was treated as binding in
three files while being enforced nowhere) and whose current behavior could be read straight out of
the code. ADR-021 was a much larger document: its remaining citations reference at least §1 (the
`@repo/public-contracts` zero-runtime-dependency boundary, gated by
`packages/public-contracts/scripts/check-boundary.mjs`), §3 (public-response redaction discipline
and the submissions surface), §4 (mobile reaches the server over HTTP only, types-only from
`public-contracts`), and a set of numbered "red-team resolutions" — of which #1 (the deprecation
window) and #2 (`X-BlackStory-Client` / `CLIENT_VERSION_UNSUPPORTED` is a UX affordance for honest
clients, never a security control) are cited by name.

Those are NOT restated here, and their citations are left pointing at ADR-021 rather than
rewritten. Each needs the same treatment these two got — read the code, state what is true now —
and that is per-site topic judgment, not a find-and-replace. The precedent is the 2026-09-11
addendum above, which corrected only the sites feeding its own decision and filed the rest.
A blind sweep would restate rules nobody verified, which is how the dependency direction became
binding-but-unwritten in the first place.

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

**Bounded and static-first.** Map sources are generated statically rather than served from a live
query path (`packages/domain/src/map/generate-demo-map-source.ts`), and state attribution in
`findUsStateForPoint` is a bounded local computation. The doctrine is that a reader-facing surface
should not depend on a live third-party call it cannot bound. (from ADR-008, "search and
geocoding")

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
census undercounted.** The file contains a literal NUL byte at byte 4149 (line 94), used as a hash
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
