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

## Data access

Handlers depend on the `PublicDataAccess` port (`data-access.ts`). Two adapters ship:

- `createInMemoryPublicDataAccess` — real, fully tested; also usable as the ADR-004
  degraded/immutable-snapshot source. Used when `./live-policy.ts`'s gate is false (emulators,
  missing break-glass, explicit `PUBLIC_DATA_SOURCE=fixtures|seed`, or `PUBLIC_READ_API_DISABLED`).
- `createFirestorePublicDataAccess` — binds the port to injected `@repo/firebase` public-projection
  readers + the domain projection→`EntityV1` mapper (same access pattern as
  `apps/web/src/lib/public-data/firestore-readers.ts`). Selected at boot by
  `createProductionHandlerDeps` (`./compose.ts`) when the live gate is true.

**Live wiring gaps (honest, tracked in repo-rw1p):** index-backed search/facet filters (live search
scans up to `MAX_LIVE_SEARCH_SCAN` entities; no `publicSearchIndex` query yet), timeline hydration
(projection has no timeline field — always `[]` until release builder adds one), Firebase-emulator
integration tests, timing-attack tests, load/read-budget tests, and SSRF-via-media-URL tests.

**Fixed in MOB-004 live-data pass:** inline `claims` on `publicEntityProjectionSchema` map through
when present (bootstrap stubs with `claimIds` only still emit `claims: []`; no N+1 claim reads).
`jurisdictionLabel`, `locationLabel`, `researchCoverage`, and revision timestamps map from the
projection when present, with the same coordinate-derived jurisdiction fallback as
`apps/web`'s `map-projection.ts`.

## Local run against live Firebase (production project)

Same convention as `apps/web` / `apps/admin`: Application Default Credentials (ADC), an explicit
production break-glass flag, and optional `run-with-dev-secrets` for any `op://` references in
`~/.env.1password` (never commit secrets; never print resolved values).

**Prerequisites**

1. `gcloud auth application-default login` (user ADC — no service-account JSON in the repo).
2. Quota project for Google APIs App Check / Identity Toolkit calls over ADC:
   `gcloud auth application-default set-quota-project black-book-efaaf`, or set
   `GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf` in the environment.
3. Production break-glass: `BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1` (required for local
   `NODE_ENV=development`; Cloud Run production omits this).

**Start the server**

```bash
cd apps/api-public

# Inject any 1Password-backed env refs (GOOGLE_APPLICATION_CREDENTIALS op://, etc.) without
# writing secrets to disk. Confirm injection with `env | rg '^[A-Z_]+='` — never echo key values.
run-with-dev-secrets -- env \
  BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1 \
  FIREBASE_PROJECT_ID=black-book-efaaf \
  GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf \
  APP_CHECK_MODE=monitor \
  pnpm dev
```

Smoke (no App Check token required for bootstrap/entity in monitor mode):

```bash
curl -sS 'http://127.0.0.1:8080/v1/health' | jq .
curl -sS 'http://127.0.0.1:8080/v1/bootstrap' | jq .
```

**Environment reference**

| Variable | Role |
|----------|------|
| `BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1` | Break-glass for local reads against `black-book-efaaf` |
| `FIREBASE_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` | Must resolve to `black-book-efaaf` unless `PUBLIC_DATA_SOURCE=firestore` |
| `GOOGLE_CLOUD_QUOTA_PROJECT` | ADC quota project for App Check verifier API calls |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional; ADC is preferred. If set via `op://`, use `run-with-dev-secrets` |
| `PUBLIC_READ_API_DISABLED=1` | Kill-switch — forces empty in-memory adapter |
| `PUBLIC_DATA_SOURCE=fixtures\|seed` | Force in-memory adapter |
| `APP_CHECK_MODE` | `monitor` (default) or `enforce` — see `app-check.ts` |
| `APP_CHECK_OUTAGE_OVERRIDE=outage` | Operator systemic signal for repo-uqmm degraded search quota (never per-request) |

Gate logic lives in `./live-policy.ts` (mirrors `apps/web/src/lib/public-data/live-policy.ts`).
Auto-detecting App Check verifier failures as an outage signal is tracked separately as repo-vdnm
(`@repo/firebase` scope); this app wires the operator flag half via `./app-check-availability.ts`.

## Adversarial coverage (see `*.test.ts`)

Genuinely tested: ID enumeration (unpublished vs nonexistent → byte-identical 404), forged/omitted
App Check on a read (served identically, fail-open), oversized query string (414), oversized request
body (413), JSON depth bomb (`parseJsonWithDepthLimit` rejects), malformed entity id (400), search
query injection (SQL/regex/field-selection denied via the shared guardrail), unbounded-array defense
(response schema caps), and negative redaction snapshots (internal/ranking/precise-geo fields absent).

Deferred: real Firestore-backed enumeration **timing** attacks, live load / Firestore-read-budget
tests, and SSRF-through-citation/media-URL checks (no live media fetch path exists in this pass).
