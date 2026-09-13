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

Where domain restates a rule rather than importing it — `highestClaimConfidenceTier` in
`release-builder.ts`, which copies `recordConfidenceTier` from
`@repo/public-contracts/evidence`; the `ReleaseRevisionMetadata` shape in `mobile-bootstrap.ts`
— the restatement is the consequence of this rule, and the two copies must be kept in agreement
by test rather than by type. (from ADR-021, "dependency direction")

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
