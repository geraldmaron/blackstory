# Testing foundation (BB-008)

Automated quality layers for Blap. Production services are fail-closed; flaky tests are quarantined with owner + deadline (never infinite retries).

## Layers and commands

| Layer | Command | What runs |
|-------|---------|-----------|
| Preflight | `pnpm test:preflight` | Production identifier guard + quarantine registry health |
| Unit | `pnpm test:unit` | Package/app unit tests + Python pytest |
| Contract | `pnpm test:contract` | API health contract helpers |
| Security | `pnpm test:security` | Threat corpus (BB-004) + production guards + BB-059 load/abuse scenarios (`docs/testing/load-abuse.md`) + BB-060 adversarial integrity (`docs/testing/adversarial-integrity.md`) |
| Accessibility | `pnpm test:a11y` | HTML landmark/alt smoke fixtures + BB-057 journey audits (`docs/testing/a11y-seo-perf-privacy.md`) |
| Release gates | `pnpm --filter @repo/testing test:release-gates` | Performance budgets + public degraded-mode contracts |
| Integration | `pnpm test:integration` | Postgres disposable schema + Firebase emulator probes |
| Migration | `pnpm test:migration` | Forward-only `schema_migrations` harness on disposable DB |
| E2E | `pnpm test:e2e` | Harness; live fetch only when `E2E_BASE_URL` is local |
| Coverage | `pnpm test:coverage` | Node test coverage thresholds for `@repo/testing` |
| Full | `pnpm test` | Preflight + all package/app tests + pytest |

## Determinism and builders

Import from `@repo/testing`:

- Clocks: `fixedClock`, `steppingClock`
- IDs: `createIdFactory`, `defaultIdFactories`
- Builders: `buildEntity`, `buildClaim`, `buildEvidence`, `buildSource`, `buildPublicationRelease`, `buildSubmission`

## Production fail-closed

Tests refuse to run when environment values look like production (project ids, Cloud SQL connection names, non-local `DATABASE_URL`, non-loopback emulator hosts). See `packages/testing/src/guards/production.ts`.

## Quarantine

Flaky tests belong in `packages/testing/quarantine.json` with `owner`, `deadline` (`YYYY-MM-DD`), and `reason`. Expired entries fail CI. Do not add Actions `retry` loops for flaky suites.

## Guarded harnesses (local vs CI)

### PostgreSQL (deferred / optional)

- Local: `pnpm db:up`, then `pnpm db:init` / `pnpm db:verify` for parked role foundation (BB-012).
- Integration: `pnpm test:integration` / `pnpm test:migration` (skips if Docker/Postgres down).
- Role isolation unit tests still run in `@repo/data-access`; runtime isolation via
  `pnpm test:db:integration` is **optional**.
- CI job **Integration Postgres** is **skipped by default** (set repo variable
  `ENABLE_POSTGRES_CI=true` to enable). Not a required status check (ADR-011).

### Firebase emulators (primary data path)

- Local: Java runtime (Homebrew `openjdk@21` is the default `JAVA_HOME` in `pnpm firebase:emulators`) + `pnpm firebase:emulators`, then `pnpm test:integration` (skips if emulators/Java unavailable).
- Firestore security rules + converters: `pnpm firebase:test:rules` (or `@repo/firebase` tests); skips locally unless emulators are up; set `CI_REQUIRE_FIREBASE=1` to fail closed.
- CI job **Integration Firebase** installs Temurin 21, starts demo emulators, runs harness + **Firestore rules tests**, sets `CI_REQUIRE_FIREBASE=1`. Missing emulators fails the job.

### E2E

- Default CI run exercises the harness skip path (no browser stack yet).
- Optional: set `E2E_BASE_URL=http://127.0.0.1:3048` and `CI_REQUIRE_E2E=1` when a full browser suite exists.

## CI check names (ruleset-stable)

Workflow: `.github/workflows/ci.yml` (`name: CI`)

| Check name |
|------------|
| Validate |
| Unit Tests (JS Packages) |
| Unit Tests (JS Apps) |
| Unit Tests (Python) |
| Contract Security Accessibility |
| Coverage |
| Integration Firebase |
| Build and Typecheck |
| E2E Harness |
| Governance |

Permissions are `contents: read`. Third-party actions are pinned to immutable SHAs. `pull_request_target` is not used.

Governance policy (BB-009): `pnpm validate:governance` checks workflow pins/permissions/events plus checked-in ruleset/CODEOWNERS/Dependabot/SECURITY artifacts. Remote ruleset application is documented in `infra/github/README.md` (blocked until a GitHub remote + admin `gh` auth exist).
