# `apps/api-public` — bounded public read API v1 (MOB-004)

Real HTTP entrypoint for the single public read surface (ADR-005). Adds an explicit, versioned
`/v1` contract (ADR-021) on top of the guard/rate-limit/App-Check/search primitives already in
`apps/api-public/src`. No new deployable; no new microservice.

## Framework choice — native `node:http` + a tiny switch router

Per the bead ("keep API framework choice minimal and documented; do not adopt a framework solely
for aesthetics"), this uses the Node standard-library `http` module and a hand-written switch in
`router.ts`. Reasons:

- **No precedent for a web framework in this repo's `apps/*`.** The other server surfaces do not
  depend on Express/Fastify/Koa. Introducing one here would add a dependency and a transitive
  supply-chain surface (threat model T8) for no functional gain.
- **The surface is five bounded GET routes.** A `switch` over an enumerated path table is smaller,
  more auditable, and easier to reason about for cache/redaction than a middleware stack.
- **All the hard parts already exist as reusable helpers** — App Check (`app-check.ts`), rate
  limits (`rate-limits.ts`), query guardrails (`search-guardrails.ts`), version/error/DTO contracts
  (`@repo/public-contracts`). The framework would only wrap them.

Every dependency (data access, App Check guard, rate limiter, search guard) is **injected** into
`createPublicApiServer`, matching the factory-injection style of `createFindNearestEndpoint`.

## Endpoints

| Route | Purpose | Contract schema | App Check | Rate-limit class | Cache-Control |
|-------|---------|-----------------|-----------|------------------|---------------|
| `GET /v1/health` | Surface posture (`health()`) | — (surface-health shape) | no | none | `no-store` |
| `GET /v1/compatibility` | Client-version floor check (ADR-021 §2) | `CompatibilityCheckV1` | no | none | `no-store` |
| `GET /v1/bootstrap` | Active release + version floor | `bootstrapResponseV1Schema` | signal (fail-open) | none | `max-age=30, swr=120` |
| `GET /v1/entity/:id` | One published entity | `entityV1Schema` | signal (fail-open, `static_read`) | `entityRetrieval` | `max-age=60, swr=300` |
| `GET /v1/search` | Bounded search | `searchResponseV1Schema` | REQUIRED (`expensive_read`) | `search` | `max-age=60, swr=300` |

Every `200` body is validated against its `@repo/public-contracts` zod schema before it is written.

## App Check posture (threat model T1/T2, ADR-010)

App Check is an **abuse signal, never an authorization gate** for reads. Implications, encoded in
`handlers.ts`:

- **The App Check GUARD never hard-denies a read.** In monitor mode a missing/forged token still
  returns `allowed: true` (only `verified` differs); the guard's decision alone never blocks a read
  (invariant 6; T1 "identical data with/without token"). This is the fail-OPEN property of the
  guard.
- **`static_read` endpoints (`entity`, `bootstrap`) fully fail open.** Their rate-limit cost tier
  does not require App Check, so an unverified/absent token returns the SAME data — only the rate
  bucket differs. This satisfies T2 for the corpus reads.
- **`search` is an `expensive_read` and the rate-limiter REQUIRES App Check for anonymous callers.**
  `DEFAULT_ENDPOINT_QUOTA_MATRIX` denies `app_check_required` (surfaced as `429 RATE_LIMITED`) when
  an anonymous caller hits an `expensive_read`/`mutation` tier without a verified token (ADR-010:
  App Check gates expensive reads). A real mobile client always attests, so this is transparent to
  it. This hard-deny is the **enumeration/abuse defense during normal operation** — relaxing it
  unconditionally would make expensive search free enumeration for any tokenless caller.
- **App Check OUTAGE carve-out (repo-uqmm — resolved).** The prior T2 tension (a hard-deny of
  unattested `search` even during an App Check *outage*) is resolved in `@repo/security`, not
  overridden in the handler. `evaluateQuota` now takes an explicit `appCheckAvailability` signal:
  under `'outage'` the expensive-read hard-deny relaxes to a **bounded degraded quota**
  (`deriveOutageDegradedPolicy`, ~¼ of the anonymous caps, single-concurrency) rather than a hard
  deny — fail-open for availability without becoming free enumeration. `risk_score_exceeded` still
  fails closed on a genuine abuse spike even during an outage. This handler samples the signal via
  the optional `HandlerDeps.appCheckAvailability` provider (defaults to `'available'`, so normal
  operation is unchanged); wire it to a **systemic** operator kill-switch flag or an App Check
  verification circuit breaker — never a single caller's missing token. Distinguishing a genuine
  outage from an individually-unverified caller currently requires an operator/circuit input because
  the `@repo/firebase` App Check guard maps a verifier throw to `invalid_token` (it does not yet
  surface an "outage" reason); auto-detection is a follow-up in that package's scope.
- **`health` and `compatibility` do NOT invoke the guard** — trivial operational / version-math
  endpoints with no corpus data and no meaningful cost.
- **`bootstrap` is an intentionally-unauthenticated immutable artifact** (the active-release
  pointer, ADR-004). It invokes the guard as a courtesy signal but is servable without any token.

The version floor (`X-BlackStory-Client` → `CLIENT_VERSION_UNSUPPORTED` / `426`) is **orthogonal**
to App Check and is a UX affordance for honest clients, not a security control (ADR-021 red-team
resolution #2): a valid attestation on a below-floor client still gets `426`, and a spoofed version
gains nothing because every parameter is re-validated server-side and there is no write path.

## Data access & what is DEFERRED

Handlers depend on the `PublicDataAccess` port (`data-access.ts`). Two adapters ship:

- `createInMemoryPublicDataAccess` — real, fully tested; also usable as the ADR-004
  degraded/immutable-snapshot source.
- `createFirestorePublicDataAccess` — binds the port to injected `@repo/firebase` public-projection
  readers + the domain projection→`EntityV1` mapper (same access pattern as
  `apps/web/src/lib/public-data/firestore-readers.ts`).

**Deferred (honestly, not stubbed green):** wiring `createFirestorePublicDataAccess` to the live
`@repo/firebase` readers and running the Firebase-emulator integration tests the bead lists. This
sandbox has no emulator credentials, so the live binding + emulator lane is left as a documented
seam (owned alongside MOB-005 live-release wiring). Everything else — routing, guards, redaction,
pagination, ETag/caching, compatibility, error envelopes, and the adversarial cases below — is real
and exercised by `node --test`.

## Adversarial coverage (see `*.test.ts`)

Genuinely tested: ID enumeration (unpublished vs nonexistent → byte-identical 404), forged/omitted
App Check on a read (served identically, fail-open), oversized query string (414), oversized request
body (413), JSON depth bomb (`parseJsonWithDepthLimit` rejects), malformed entity id (400), search
query injection (SQL/regex/field-selection denied via the shared guardrail), unbounded-array defense
(response schema caps), and negative redaction snapshots (internal/ranking/precise-geo fields absent).

Deferred: real Firestore-backed enumeration **timing** attacks, live load / Firestore-read-budget
tests, and SSRF-through-citation/media-URL checks (no live media fetch path exists in this pass).
