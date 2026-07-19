# ADR-021: Mobile data boundary — public contracts package and API compatibility

- **Status:** Proposed
- **Date:** 2026-07-19
- **Bead:** MOB-002 (`black-book-mobile-002`) — architecture, threat model, contract boundary ADRs
- **Depends on:** ADR-004, ADR-005, ADR-011
- **Blocks:** MOB-003 (`packages/public-contracts`), MOB-004 (bounded public API v1)

> **Package scope note.** The workspace scope is `@repo` (verified: every live
> `packages/*/package.json` is `@repo/*`; `docs/mobile/decisions/mobile-identity.md`
> records the scope as `@repo` — "brand-agnostic, never renamed"). This ADR uses
> `@repo/public-contracts`. Any `@black-book/*` reference in program notes is not the
> live scope. Stray `@repo/*` strings under `dist/` or `.next/standalone` are not
> relevant here; the source-of-truth manifests are.

## Scaffold vs target

| Aspect | Today (verified) | Target (this ADR sets doctrine for) |
|--------|------------------|-------------------------------------|
| Public read surface | `apps/api-public` with App Check + rate-limit + search guardrails; routes already namespaced under `/v1/...` (`apps/api-public/src/rate-limits.ts`) | Same surface, formalized `/v1` wire contract consumed by web and mobile |
| Shared contract package | None; web imports `@repo/domain` subpaths directly | New `@repo/public-contracts` (MOB-003) — the only package `apps/mobile` may import from `packages/*` |
| Correction writes | `apps/api-submissions` (quarantine-only intake, App Check) | Same surface; mobile corrections (MOB-016) ride it, no new mobile-only service |
| Version negotiation | Implicit URL prefix only | `/vN` wire boundary + advisory client min-version header + below-floor error code |

## Context

The mobile program (MOB-EPIC) ships a native iOS/Android reader whose program
invariants require: `apps/api-public` is the only mobile read surface (invariant 2);
only environment-neutral contracts and pure behavior cross the web/mobile boundary, with
no app-to-app imports and no server-only transitive dependencies (invariant 3); and App
Check is attestation, not authorization (invariant 6). ADR-005 already anticipated this:
"Expo/mobile later consumes the same public/submissions contracts; do not invent
mobile-only services now." ADR-004 makes the public surface a set of immutable,
CDN-cacheable released projections/snapshots. ADR-011 keeps Firestore as the system of
record with public clients restricted to `public/**` released reads and never a canonical
write path.

Two forces make the mobile boundary sharper than the web boundary:

1. **Bundler strictness.** Next.js tolerates accidental `node:*` imports in many code
   paths (server components, its polyfill layer, tree-shaking of server-only branches).
   Metro (React Native) plus the Hermes engine does not: an accidentally-reachable
   `node:crypto`, `firebase-admin`, or `fs` import is not a lint warning — it is a broken
   or crashing app bundle. The failure surfaces on-device, after build.
2. **Irreversible distribution.** A leaked server-only dependency that ships in a store
   binary cannot be recalled. The fix rides the App Store / Play review and staged
   rollout cycle (days to weeks), during which every installed copy is affected. This is
   the asymmetric risk that shapes every decision below: the boundary must **fail closed
   at compile time in CI**, not depend on a reviewer remembering a convention.

`@repo/domain` already demonstrates the pattern in miniature: its root barrel pulls in
server-only modules, so it publishes **subpath exports** (`@repo/domain/map/geography`,
`@repo/domain/facts`, `@repo/domain/search`, …) so consumers can import a pure leaf
without dragging the server-only root. That is a convention a caller must remember. For a
target that detonates on-device, a remembered convention is not enough.

## Decision

### 1. A dedicated public-contracts package: `@repo/public-contracts` (MOB-003)

Create a new package `packages/public-contracts`, name `@repo/public-contracts`. It is the
**only** `packages/*` workspace member `apps/mobile` is permitted to import.

**It MAY contain, and nothing else:**

- Versioned TypeScript **types** for `/v1` API request and response shapes (the wire
  contract): entity read, evidence, timeline, search results/filters, location nearby,
  correction-submission request/receipt, bootstrap/version manifest.
- **Zod schemas** for those shapes and **pure client-side validation** built on them
  (parse/guard responses, validate a correction form before send).
- Pure, environment-neutral helpers over those shapes (e.g. narrowing a discriminated
  union, formatting a stable id) — no I/O, no ambient state.
- The wire-version constant(s) and the below-floor error-code contract from §2.

**It MUST NOT contain:**

- Any `firebase-admin`, Firestore, Admin SDK, or other server-only client.
- Any secret, credential, service-account reference, or privileged configuration.
- `node:crypto`, `node:fs`, `node:*` built-ins, or any dependency that transitively
  imports one. Validation and hashing use Web-standard / RN-safe APIs only
  (`globalThis.crypto` / WebCrypto where a digest is genuinely needed).
- Any import of `@repo/domain`, `@repo/firebase`, `@repo/data-access`,
  `@repo/security`, `@repo/config`, or any other server-carrying package. The package
  is a **leaf**: it depends on `zod` and nothing else in-repo.
- Any server-side behavior (query execution, projection assembly, promotion, ranking that
  needs the corpus). Those stay behind the HTTP boundary in `apps/api-public`.

**Why a separate package rather than reusing `@repo/domain` subpaths.** Subpath exports
make *individual* pure leaves reachable, but the package as a whole still carries
server-only code, and there is no compile-time guarantee that a mobile author imported
the safe subpath rather than the barrel — the safety is a convention, enforced only by
reviewer attention. A dedicated leaf package converts that convention into a **hard,
CI-gated, compile-time boundary**: the package has no server-only code *anywhere in its
dependency graph*, so any regression is a red build in the package's own typecheck/bundle
job, and any attempt to reach around it (a mobile import of `@repo/domain`) is a lint/CI
failure on a package-boundary rule. Given the on-device, store-cycle failure mode, the
boundary must be a wall the build enforces, not a note a human must recall.

**CI gate (fail closed).** MOB-003 must land with, and CI must block on:

- `@repo/public-contracts` typechecks and bundles under a Metro/Hermes-representative
  target (RN-safe module resolution), so a smuggled `node:*` or server dep fails the
  package's own build.
- A dependency-boundary lint rule (the `@repo/eslint-config` / import-restriction layer
  ADR-005 already assumes) forbidding `apps/mobile` from importing any `packages/*`
  except `@repo/public-contracts`, and forbidding `@repo/public-contracts` from importing
  any server-carrying workspace package or `node:*`.
- The check **fails closed**: if the boundary tooling cannot evaluate a change, the build
  is red, never green-by-default. A missing check is treated as a violation.

### 2. API versioning and N / N−1 compatibility

Two distinct mechanisms with two distinct jobs — do not conflate them:

- **Wire-contract boundary — URL prefix `/vN`.** The request/response contract is
  versioned in the path: `/v1/entities/...`, `/v1/search`, `/v1/locations/nearby`, etc.
  This is already the de-facto convention in `apps/api-public` (`rate-limits.ts` routes
  are all `^/v1/...`). URL versioning is chosen over header/content negotiation because it
  is **cacheable**: distinct versions are distinct cache keys, fitting ADR-004's
  immutable-snapshot / CDN model where `/v1/...` responses are edge-cacheable and a future
  `/v2/...` is a separate, independently-cacheable surface. It is also trivially
  inspectable in logs, traces, and store review.
  - **N / N−1 compatibility means:** when a breaking wire change ships as `/v2`, the
    server keeps serving `/v1` **unchanged** for the full deprecation window below. At
    most two adjacent major wire versions are live simultaneously (`N` and `N−1`).
    Additive, non-breaking changes (new optional response field, new endpoint) do **not**
    bump the version — clients must ignore unknown fields, and `@repo/public-contracts`
    schemas parse permissively for unknown keys so a v1 client tolerates additive server
    growth. Only a breaking change (removed/renamed field, changed type or semantics,
    removed endpoint) mints a new `/vN`.
  - **Deprecation window: 90 days.** From the day `/v(N+1)` is announced/activated,
    `/vN` continues to serve for at least 90 days before it may be retired. Retirement of
    a wire version is itself a release event (ADR-004) and must be paired with a
    minimum-supported-app floor (below) that no longer requires it.

- **Minimum-supported-app-version — client-asserted header, advisory only.** The client
  sends its build/contract version (e.g. `X-BlackStory-Client: mobile/1.4.0` and the
  `/vN` it speaks). The server compares against a server-controlled **minimum floor** and,
  for a below-floor request, returns a **specific machine-readable outcome**: HTTP `426
  Upgrade Required` with a stable body `{ "error": "client_below_minimum_version",
  "minimum": "<floor>", "upgradeUrl": "<store-listing>" }` (the error code string lives in
  `@repo/public-contracts` so client and server agree). The mobile client renders this as
  a **forced-update prompt** (blocking modal linking to the store), consistent with the
  release/rollback posture of the epic.
  - **This header is a UX signal, NOT a security control.** Per invariant 6, App Check
    attests that a genuine app instance is calling — it does **not** attest the *declared*
    version, which the client controls and can spoof. Therefore the version header gates
    only the update-nag experience; it must never be the basis of an authorization or
    trust decision. Anything security-relevant stays server-authoritative (posture guards,
    App Check, rate limits, `public/**`-only reads per ADR-011), exactly as today.

### 3. Explicitly OUT of the contracts package and the API v1 boundary

The v1 public contract and `@repo/public-contracts` expose the reader surface and nothing
more. Out of scope, permanently, absent a superseding ADR:

- **No admin/internal endpoints or shapes.** Nothing from `apps/admin`,
  `apps/api-internal`, or `workers/*` — no promotion, publication, release control, or
  operations shapes. ADR-005 keeps those network-private and off end-user tokens.
- **No research / raw-source data.** No canonical evidence, draft claims, research-case,
  discovery, or raw-source shapes. Public clients read only released projections/snapshots
  (ADR-004) under `public/**` (ADR-011). Research cannot reach the client.
- **No write endpoints** beyond the single correction-submission path that **MOB-016**
  adds via `apps/api-submissions` (quarantine-only intake, opaque receipt, App Check). No
  other mobile write exists. Corrections do not mutate any entity; they enqueue a
  quarantined submission that promotion (ADR-004/005) may later act on.
- **No direct entity mutation** and no canonical write path of any kind from the client
  (invariant 6; ADR-005 rule 3; ADR-011 clause 7). A compromised client gains no write
  power the server does not independently authorize.

### 4. Dependency direction

```
                 ┌─────────────────────────────────────────────┐
                 │                 apps/mobile                  │
                 │        (Expo / React Native / Hermes)        │
                 └───────────────┬───────────────┬─────────────┘
     import (TYPES / zod only)   │               │   HTTP only (no shared runtime)
                 ┌───────────────▼───┐   ┌────────▼─────────────────────────┐
                 │ @repo/public-     │   │  apps/api-public  (GET /v1/...)   │
                 │ contracts         │   │  apps/api-submissions (corrections│
                 │ (leaf: zod only,  │   │              → quarantine, MOB-016)│
                 │  RN-safe, no      │   └────────┬─────────────────────────┘
                 │  node:*, no       │            │  server-side import
                 │  server deps)     │            ▼
                 └───────────────────┘   ┌──────────────────────────────────┐
                     ▲                    │ @repo/domain, @repo/firebase,    │
                     │ MAY also import    │ @repo/security, @repo/config ... │
                     │ (optional)         │ (server-only; Firestore/Admin SDK│
              ┌──────┴──────┐             │  per ADR-011; released public/** │
              │  apps/web   │             │  projections per ADR-004)        │
              └─────────────┘             └──────────────────────────────────┘

FORBIDDEN (CI fails closed):
  apps/mobile ──✗──▶ @repo/domain
  apps/mobile ──✗──▶ @repo/firebase   (or any server-carrying package)
  @repo/public-contracts ──✗──▶ any server-carrying package, or node:*
```

- `apps/mobile` → `@repo/public-contracts`: **types and pure zod validation only**, no
  runtime coupling.
- `apps/mobile` → `apps/api-public` / `apps/api-submissions`: **HTTP only**. No shared
  process, no shared bundle, no imported handler code (ADR-005 rule 4 generalized).
- Only the API surfaces import `@repo/domain` / `@repo/firebase` — **server-side**.
- `apps/mobile` **NEVER** imports `@repo/domain` or `@repo/firebase` (or any other
  server-carrying package) directly. `apps/web` **MAY** optionally import
  `@repo/public-contracts` to share the same wire types, but is not required to.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Reuse `@repo/domain` subpath exports for mobile | Package still carries server-only code; safety is a remembered convention, not a compile-time wall. On-device/store-cycle failure mode demands a CI-gated leaf. |
| Header/content-negotiation versioning instead of `/vN` URL | Not cache-friendly; fights ADR-004's immutable-snapshot/CDN model; harder to inspect in logs and store review. |
| Version header as a security/authorization gate | Client controls the declared version; App Check attests the app, not the claimed version (invariant 6). Would be trivially spoofable security theater. |
| Ship one wire version, break clients in place | No N/N−1 window; every server change risks bricking installed binaries that cannot be recalled. |
| A mobile-specific API service | Violates ADR-005 ("do not invent mobile-only services"); duplicates posture/guardrails; widens attack surface. |
| Let mobile read Firestore `public/**` directly | Violates invariant 2 and ADR-011 clause 7; couples the app to storage schema and loses the API's guardrails/versioning. |

## Reversal cost

- **Changing the versioning scheme later (moderate, bounded).** Because both the URL
  prefix and the advisory header are explicit and observable, migrating (e.g. `/vN` →
  header negotiation) is a server-side additive change with a deprecation window: stand up
  the new scheme, dual-serve, move clients across store releases, retire the old after 90
  days. The cost is real (two live surfaces, cache-key changes, a client release) but
  planned-for and reversible — no installed binary is bricked because `/v1` keeps serving.

- **Retrofitting a violated contract boundary (severe, asymmetric — the load-bearing
  risk).** If `@repo/public-contracts` is not a genuine leaf and something server-only
  (a `node:crypto` transitive dep, a `firebase-admin` import) reaches `apps/mobile`, the
  failure is **not** caught by web CI and **not** recoverable by a server rollback. It
  detonates on-device — a broken or crashing Hermes bundle, or a smuggled server capability
  in a shipped binary — and the fix rides the App Store / Play review and staged-rollout
  cycle (days to weeks) while every installed copy stays broken; shipped binaries cannot be
  recalled. Retrofitting the boundary after mobile code already imports server-only code
  means auditing and rewriting call sites under release pressure, precisely when it is most
  expensive. This asymmetry is why the boundary must be enforced **at compile time in CI
  and fail closed**: a red build is cheap; a bad binary in users' hands is not. The cost of
  the CI gate is trivial next to the cost of its absence.

## Open question for red-team review

The advisory min-version header can be spoofed (that is why it is UX-only). Confirm no
*other* code path ever treats the declared client version as trusted input — e.g. feature
gating, response shaping, or rate-limit class selection keyed on declared version would
quietly turn a spoofable UX signal into a security-relevant one, contradicting invariant 6.
