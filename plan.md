# Black Book — Execution Plan

Tracks the Execution Beads (BB-001–BB-066) from *Black Book Web Application Execution Beads*. Update status as work completes. Delete this file when the plan is fully executed or superseded by durable project docs.

**Source:** `/Users/geralddagher/Downloads/Black Book Web Application Execution Beads.pdf`  
**Workspace:** `/Users/geralddagher/Developer/Projects/black-book` (greenfield as of 2026-07-16)  
**Active focus:** Wave 6 complete (BB-047/056). BB-048 remains partial; next public product beads still blocked.

## Multi-agent coordination (2026-07-17 wave 6)

| Bead | Model tier | Exclusive ownership (do not cross) | Status |
|------|------------|------------------------------------|--------|
| BB-047 | stronger (eval) | `packages/testing/src/gold-corpus/`, `packages/schemas/gold-corpus/`, `docs/research/gold-corpus.md`, `scripts/gold-corpus/` | `done` |
| BB-056 | stronger (admin UI) | `apps/admin/` (pages/components beyond existing auth), `docs/admin/research-console.md` | `done` |

**Shared (parent only):** `plan.md`, `packages/testing/src/index.ts`, root `README.md`. Do not touch `apps/web/**` (BB-048).

## Multi-agent coordination (2026-07-17 wave 5 — complete except BB-048)

| Bead | Model tier | Exclusive ownership (do not cross) | Status |
|------|------------|------------------------------------|--------|
| BB-036 | stronger (security CI) | `.github/workflows/security*.yml`, `docs/security/tests/`, `infra/github/security-gates/`, `packages/testing/src/security-gates*` | `done` |
| BB-061 | fast | `docs/runbooks/recovery-rollback-rehearsal.md`, `scripts/recovery-rehearsal/`, `infra/gcp/recovery-rehearsal/` | `done` |
| BB-043 | stronger (confidence) | `packages/domain/src/confidence-engine/`, `packages/domain/src/confidence-engine.test.ts`, `workers/research/**/confidence_engine/`, `packages/schemas/confidence-engine/`, `docs/research/confidence-lineage.md` | `done` |
| BB-044 | stronger (workflow) | `packages/domain/src/research-case/`, `packages/domain/src/research-case.test.ts`, `packages/firebase/src/firestore/research-case*.ts`, `packages/schemas/research-case/`, `docs/research/research-case-workflow.md` | `done` |

**Shared (parent only):** `plan.md`, package root barrels, root `README.md`, `.github/workflows/ci.yml` (agents may add sibling workflow files only).

## Multi-agent coordination (2026-07-17 wave 4)

| Bead | Model tier | Exclusive ownership (do not cross) | Status |
|------|------------|------------------------------------|--------|
| BB-030 | stronger (SSRF) | `packages/security/src/url-safety/`, `workers/security/src/black_book_security/url_fetch/`, `docs/security/url-ssrf.md`, `packages/schemas/url-safety/` | `done` |
| BB-032 | stronger (promotion) | `packages/domain/src/promotion/`, `packages/domain/src/promotion.test.ts`, `packages/schemas/promotion/`, `docs/security/promotion-controls.md`, `packages/firebase/src/firestore/promotion*.ts` | `done` |
| BB-035 | stronger (incident) | `packages/config/src/kill-switches*.ts`, `infra/gcp/kill-switches/`, `docs/runbooks/incident-response.md`, `docs/runbooks/incidents/` | `done` |
| BB-042 | stronger (extraction) | `packages/domain/src/extraction/`, `packages/domain/src/extraction.test.ts`, `workers/research/**/extraction/`, `packages/schemas/extraction/` | `done` |
| BB-045 | fast | `packages/domain/src/adapters/wikimedia/`, `workers/research/**/adapters/wikimedia/`, `packages/schemas/adapters/wikimedia/` | `done` |
| BB-046 | fast | `packages/domain/src/adapters/federal/`, `workers/research/**/adapters/federal/`, `packages/schemas/adapters/federal/` | `done` |

**Shared (parent only):** `plan.md`, `packages/*/src/index.ts`, `packages/domain/src/adapters/index.ts`, `workers/*/src/*/__init__.py`, root `README.md`.

**Rules:** one writer per path; agents export from local barrels only; parent merges `export *` after validation; fix exactOptionalPropertyTypes via conditional spreads; no live GCP/Firebase apply; close when repo acceptance met; launch newly unblocked beads immediately.

## Multi-agent coordination (2026-07-17 wave 3 — complete)

| Bead | Model tier | Exclusive ownership (do not cross) | Status |
|------|------------|------------------------------------|--------|
| BB-027 | stronger (authz) | `packages/firebase/src/admin-auth*.ts` / claims helpers, `apps/admin/src/auth/`, `docs/security/admin-identity.md`, `infra/gcp/iap/` | `done` |
| BB-028 | fast | `apps/web/src/lib/web-security/`, security headers in `next.config.mjs` + compose into `middleware.ts` (re-read; preserve BB-022 query normalize) | `done` |
| BB-039 | fast | `packages/domain/src/discovery/`, `workers/research/**/discovery*`, schemas under `packages/schemas/discovery/` | `done` |

**Shared (parent only):** `plan.md`, `packages/domain/src/index.ts`, `packages/firebase/src/index.ts`.

**Rules:** one writer per path; no live IAP/Auth console apply; no secrets; client route checks never sole authz; discovery never creates public entities; parent merges barrels after finish.

## Multi-agent coordination (2026-07-17 wave 2)

| Bead | Model tier | Exclusive ownership (do not cross) | Status |
|------|------------|------------------------------------|--------|
| BB-020 | fast | `infra/firebase/backup/`, `scripts/backup-restore/`, `docs/runbooks/backup-restore.md` | `done` |
| BB-022 | fast | `apps/web/apphosting*.yaml`, `apps/web/next.config.mjs`, `apps/web/src/lib/runtime-hardening*` (not shell components) | `done` |
| BB-023 | fast | `infra/gcp/armor/`, `docs/security/ingress-armor.md` | `done` |
| BB-024 | stronger (enforcement) | `packages/firebase/src/app-check*.ts`, `apps/api-public|api-submissions` App Check middleware only | `done` |
| BB-038 | fast | `packages/domain/src/query-packs/`, `workers/research/**/query_packs*`, `packages/schemas/query-packs/` | `done` |

**Shared files (parent only):** `plan.md`, `packages/domain/src/index.ts`, `packages/firebase/src/index.ts`, root `README.md`.

**Rules:** one writer per path; no live GCP/Firebase console apply; no secrets; ADR-011 Firestore rescope for BB-020 (not Cloud SQL PITR); validate with package tests; parent merges barrels after agents finish.

## Multi-agent coordination (2026-07-17 wave 1 — complete)

| Bead | Model tier | Exclusive ownership (do not cross) | Status |
|------|------------|------------------------------------|--------|
| BB-019 | strong (release/security core) | `packages/domain/src/publication/`, `packages/firebase/src/firestore/release*.ts`, `workers/publication/` (beyond health), FIRESTORE_MODEL § BB-019, release tests | `done` |
| BB-021 | fast (scaffolding) | `apps/{api-public,api-submissions,api-internal,admin}/` surface contracts, `infra/gcp/surfaces/`, `docs/security/service-surfaces.md` | `done` |
| BB-037 | fast (contracts) | `packages/domain/src/adapters/`, `workers/research/` adapter modules, schema fixtures under `packages/schemas` for adapters only | `done` |
| BB-012 | hygiene | status only → `deferred` | `deferred` |

## Status legend

| Status | Meaning |
|--------|---------|
| `todo` | Not started |
| `in_progress` | Active |
| `blocked` | Waiting on dependency or decision |
| `done` | Acceptance criteria met |
| `deferred` | Intentionally later (Epic G / deferred list) |
| `cancelled` | Superseded / will not execute as originally scoped |
| `partial` | Delivered for original scope but superseded for production path |

## Progress summary

| Tranche | Focus | Beads | Done |
|---------|-------|-------|------|
| 1 | Secure foundation | BB-001–006, 008–010 | 9/9 |
| 2 | Data and publication boundary | BB-011–020 | 9/10 (BB-012 deferred) |
| 3 | Hostile-environment protection | BB-021–030, 032–036 | 13/15 (BB-021–030,032–036 done) |
| 4 | Research and evidence engine | BB-037–044, 047 | 9/9 |
| 5 | Public beta product | BB-048–050, 052–057 | 1/9 (BB-056 done; BB-048 partial) |
| 6 | Seed and launch | BB-045–046, 058–063 | 2/8 (045/046 done) |
| Deferred | Later capabilities | BB-012, 031, 051, 064–066 | 0/6 |

---

## Target architecture (reference)

```
apps/
  web/                 Public Next.js (Firebase App Hosting)
  admin/               Private Next.js admin/research (Cloud Run + IAP)
  api-public/          Public read/search/location API (Cloud Run)
  api-submissions/     Corrections / contribution intake (Cloud Run)
  api-internal/        Publication / promotion / internal control (Cloud Run, private)
workers/
  research/            Python source discovery & ingestion
  publication/         Projection, snapshot, indexing, release
  security/            Quarantine, content validation, integrity
packages/
  ui/ domain/ schemas/ firebase/ data-access/
  security/ observability/ testing/ config/
infra/
  firebase/ gcp/ github/ database/
```

**Platform choices (current phase — ADR-011 / D-014):** Next.js + TypeScript; Firebase App Hosting (public web); Cloud Run (APIs + admin); Firebase Auth + App Check (reCAPTCHA Enterprise); **Cloud Firestore** system of record; Firebase Storage / GCS for blobs; Cloud Armor / ALB / CDN; Cloud Tasks + Cloud Run Jobs; GitHub Actions + OIDC/WIF; OpenTelemetry + Sentry; **geohash + bounded Firestore queries** before a separate search platform (PostGIS / Cloud SQL **deferred**).

### Non-negotiable invariants

1. Anonymous users never write to canonical historical data.
2. Public clients never connect directly to canonical database tables **or canonical Firestore collections**.
3. A submission can never become public without the promotion workflow.
4. Research workers cannot publish.
5. LLMs cannot publish or approve their own claims.
6. Public rendering never invokes an LLM.
7. Public pages read only released publication projections or immutable snapshots.
8. Living residential addresses are never stored as ordinary person-location fields or publicly returned.
9. Unknown living status is treated as living.
10. External URLs and files are untrusted; submitted URLs are not fetched synchronously in a user request.
11. Public API credentials are read-only on **public projections**; research cannot modify public projections; publication cannot modify raw evidence.
12. Every public fact maps to accepted claim and evidence records; publication/retraction is auditable.
13. Every queue, worker, API, and model provider has bounded concurrency and cost limits.
14. Immediate read-only degraded mode is supported.
15. Production deploy requires security, test, migration, and rollback checks.
16. No mobile-specific assumptions; contracts remain portable to Expo later.

---

## Tranche 1: Secure foundation

| ID | Title | P | Size | Deps | Status | Notes |
|----|-------|---|------|------|--------|-------|
| BB-001 | Repository reconnaissance and implementation baseline | P0 | M | — | `done` | Report: `docs/bb-001/`; bootstrap/test/build/typecheck verified exit 0 |
| BB-002 | Architecture decision records | P0 | M | BB-001 | `done` | 10 ADRs in `docs/adr/`; index + `.cx/decisions/` |
| BB-003 | Machine-readable product constitution | P0 | M | BB-001 | `done` | Shared JSON + JSON Schema; TS `@black-book/schemas` + Python `black-book-constitution` |
| BB-004 | Threat model and abuse-case corpus | P0 | L | BB-001, BB-003 | `done` | `docs/security/` + `@black-book/testing` corpus tests |
| BB-005 | Environment and project isolation | P0 | L | BB-002, BB-004 | `done` | Delivered as single-project production design for live `black-book-efaaf`; per-SA/bucket/role isolation not yet provisioned; four-project split deferred (D-013) |
| BB-006 | Monorepo and shared package foundation | P0 | L | BB-001, BB-002 | `done` | Shared configs/helpers, frozen bootstrap, boundary/cycle checks, emulator + PostGIS local scaffolds |
| BB-008 | Automated quality and test foundation | P0 | M | BB-006 | `done` | Layers, builders, coverage, quarantine, production fail-closed, `.github/workflows/ci.yml` |
| BB-009 | GitHub repository governance | P0 | M | BB-001, BB-008 | `done` | Local artifacts + Governance CI; remote rulesets **not** applied (no remote; `gh` auth invalid) |
| BB-010 | GitHub OIDC deployment identities | P0 | M | BB-005, BB-009 | `done` | Declarative WIF + OIDC workflow stub; cloud not applied (no remote; IDs TBD) |

### BB-001 acceptance checklist

- [x] Current state and target state mapped → `docs/bb-001/baseline-report.md`, `repository-map.md`
- [x] Build/test commands executed or failures documented → `pnpm bootstrap`, `pnpm test`, `pnpm build`, `pnpm typecheck` after build verified exit 0 on 2026-07-16
- [x] Existing Firebase/GitHub integration understood (none yet → documented absence)
- [x] Subsequent beads adjusted for actual repo without weakening requirements → see baseline-report §7 + notes below

### Greenfield sequence adjustments (requirements unchanged)

- **BB-006:** Foundation completed; `pnpm bootstrap`, validation, tests, builds, and typecheck verified.
- **BB-007:** Schedule after BB-006 and **before BB-028** (not only before Tranche 5 UI). Tracked under Epic A remainder.
- **BB-008 / BB-009:** BB-008 CI under `.github/workflows/ci.yml`; BB-009 local governance is checked in (`infra/github/`, CODEOWNERS, Dependabot, SECURITY.md, Governance job). **GitHub remote rulesets/secret-scanning not applied** until a remote exists and `gh auth login` succeeds — see `infra/github/README.md`.
- **BB-010:** OIDC/WIF design delivered (`infra/gcp/wif/`, deploy stub workflow, provenance schema). **Cloud WIF not applied** until remote + numeric GitHub IDs + `gcloud` ADC + `github-deploy` SA exist.
- **Emulate / deploy commands:** Local demo Firebase emulators are scaffolded; real project linkage remains BB-011; production rollout pipeline is BB-062 (unblocked for design by BB-010).

### BB-006 acceptance checklist

- [x] Frozen `pnpm-lock.yaml` and `uv.lock` drive one-command bootstrap
- [x] Shared TypeScript, ESLint, formatting, environment, logging, error, and test utilities exist
- [x] All five deployable applications build independently
- [x] Boundary validation rejects app dependencies/imports and workspace dependency cycles
- [x] Local tests require no production environment variables
- [x] Firebase demo emulator and local PostgreSQL/PostGIS Compose scaffolds are documented

### BB-008 acceptance checklist

- [x] Unit, integration, contract, e2e, accessibility, migration, and security test layers exist with representative coverage
- [x] Test data builders for entities, claims, evidence, sources, publication releases, submissions
- [x] Coverage reporting via `pnpm test:coverage` (Node test coverage thresholds)
- [x] Deterministic clocks (`fixedClock` / `steppingClock`) and ID factories
- [x] CI sharding: JS packages vs apps unit jobs; dedicated Postgres / Firebase / coverage jobs
- [x] Emulator-backed Firebase harness + disposable Postgres/migration harnesses (guarded locally; required in CI)
- [x] PRs run appropriate suites via `.github/workflows/ci.yml`
- [x] Tests fail closed on production identifiers/endpoints (`pnpm test:preflight`)
- [x] Flaky quarantine registry requires owner + deadline (`packages/testing/quarantine.json`)
- [x] Required checks have stable names (see `docs/testing/README.md`)
- [x] Workflow permissions read-only; actions pinned to SHAs; no `pull_request_target`

### BB-009 acceptance checklist

- [x] Declarative main ruleset: PR required, required checks, block force-push/deletion, resolved conversations → `infra/github/rulesets/main-protection.json`
- [x] CODEOWNERS for security, infra, policies, database, publication → `.github/CODEOWNERS`
- [x] Dependabot updates config → `.github/dependabot.yml`
- [x] Secret scanning / push protection / private reporting declared → `infra/github/security-settings.json` + `SECURITY.md`
- [x] Allowed Actions restricted (selected patterns) → `infra/github/allowed-actions.json`
- [x] Workflow permissions default read-only; third-party actions SHA-pinned; no `pull_request_target` → enforced by `pnpm validate:governance` + CI **Governance** job
- [x] Automated policy check verifies branch-protection *declaration* + workflow policy locally
- [ ] Remote ruleset / Actions allowlist / secret scanning **applied on GitHub** → blocked: no git remote; `gh` token invalid (apply: `infra/github/README.md`)

---

## Tranche 2: Data and publication boundary

| ID | Title | P | Size | Deps | Status | Notes |
|----|-------|---|------|------|--------|-------|
| BB-011 | Firebase project bootstrap | P0 | M | BB-005, BB-006 | `done` | Apps registered; App Hosting/Blaze + Firestore DB + GCP buckets/IAM still blocked/deferred |
| BB-012 | Cloud SQL PostgreSQL, PostGIS, and SQL Connect | P0 | L | BB-005, BB-011 | `deferred` | ADR-011 / D-014 — Firestore SoR; Cloud SQL not provisioned this phase; scaffolds parked |
| BB-013 | Database schema boundaries and migrations | P0 | L | BB-011, D-014 | `done` | **Rescoped:** Firestore collections, rules, converters, seeds, emulator tests — not SQL migrations |
| BB-014 | Entity and geography domain model | P0 | L | BB-003, BB-013 | `done` | Firestore documents + geohash; `@black-book/domain` + converters/seeds |
| BB-015 | Living-person and sensitive-location enforcement | P0 | L | BB-003, BB-014 | `done` | Central redaction/serialization in `@black-book/security`; constitution `sensitivityRules`; observability + public converter wired |
| BB-016 | Sources, captures, rights, and provenance model | P0 | L | BB-013 | `done` | Evidence metadata in Firestore; blobs in Storage |
| BB-017 | Claims, contradictions, and confidence model | P0 | L | BB-003, BB-014, BB-016 | `done` | Deterministic confidence + claim publication statuses |
| BB-018 | Append-only audit and transactional outbox | P0 | M | BB-013, BB-017 | `done` | Atomic Firestore state/audit/outbox, idempotency, retry/DLQ, history |
| BB-019 | Public projection and immutable release model | P0 | L | BB-015, BB-017, BB-018 | `done` | Signed manifests + atomic activation/rollback; barrels wired |
| BB-020 | Backup, PITR, and restore verification | P0 | M | BB-013, BB-019 | `todo` | Firestore export / Storage versioning (not Cloud SQL PITR); unblocked after BB-019 |

### BB-013 acceptance checklist (Firestore rescope)

- [x] Decision record D-014 + ADR-011 (Cloud SQL deferred; Firestore SoR)
- [x] Collection map for policy, research, canonical, evidence, publication, public, submissions, audit, operations
- [x] Security rules: public read projections only; no client canonical write; quarantine submissions; staff claim separation
- [x] Emulator rules tests in `@black-book/firebase`
- [x] Typed paths/converters/seeds; `@black-book/data-access` Firestore guards
- [x] Postgres/SQL Connect parked (README banners; CI optional)

### BB-014 acceptance checklist (Firestore entity/geography)

- [x] Entities, aliases, identifiers, kinds, relationships (evidence + time/geo context)
- [x] Places/geometries (Firestore-friendly + geohash), jurisdictions, precision; ZIP = modern input only
- [x] Schools (names, campuses, status history); people/orgs/events/laws/cases/publications/artifacts/institutions
- [x] Historical and current locations coexist; geographic matches record method + precision
- [x] Duplicate/merge lineage reversible and audited (`entityMerges`)
- [x] Unknown living → treat as living at model level
- [x] Domain package + Firestore converters/seeds/tests; no Cloud SQL / PostGIS production path

### BB-018 acceptance checklist (append-only audit / outbox)

- [x] Controlled audit actions cover policy, source, research, moderation, publication, correction, retraction, authentication, and administrative activity
- [x] Actor, reason, request, release, correlation, entity, subject, and idempotency identifiers are modeled
- [x] `commitWithAudit` transaction atomically writes state + immutable audit + pending outbox + idempotency marker
- [x] Repeated idempotency keys return the original event/outbox ids without applying state again
- [x] Rules allow validated trusted-staff audit creates and deny every audit update/delete; outbox/idempotency/receipts remain client-denied
- [x] Consumer receipts make Firestore effects replay-safe; bounded exponential retries terminate in `dead_letter`
- [x] Entity publication/correction/retraction history reconstructs deterministically from append-only events
- [x] BB-018 package tests/build/typecheck, workspace tests/lint/boundaries, formatting, and Standard-edition emulator rules tests pass

---

## Tranche 3: Hostile-environment protection

| ID | Title | P | Size | Deps | Status |
|----|-------|---|------|------|--------|
| BB-021 | Separate public, submissions, internal, and admin surfaces | P0 | L | BB-005, BB-011, BB-013 | `done` |
| BB-022 | Public App Hosting runtime hardening | P0 | M | BB-011, BB-019, BB-021 | `todo` |
| BB-023 | Cloud Armor and protected public API ingress | P0 | L | BB-021 | `todo` |
| BB-024 | Firebase App Check enforcement | P0 | M | BB-011, BB-021 | `todo` |
| BB-025 | Endpoint rate limits and abuse quotas | P0 | L | BB-023, BB-024 | `todo` |
| BB-026 | Search and query resource guardrails | P0 | L | BB-019, BB-025 | `todo` |
| BB-027 | Administrator identity and authorization | P0 | L | BB-011, BB-021 | `todo` |
| BB-028 | Web application security controls | P0 | L | BB-007, BB-021 | `todo` |
| BB-029 | Corrections and submission quarantine | P0 | L | BB-015, BB-021, BB-025 | `todo` |
| BB-030 | Safe external URL handling and SSRF prevention | P0 | L | BB-004, BB-029 | `done` |
| BB-032 | Data-poisoning and promotion controls | P0 | L | BB-017–019, BB-029 | `done` |
| BB-033 | Cost and resource exhaustion controls | P0 | L | BB-022, BB-023, BB-025 | `todo` |
| BB-034 | Security telemetry and anomaly detection | P0 | L | BB-018, BB-023–025 | `todo` |
| BB-035 | Incident response and kill switches | P0 | L | BB-019, BB-033 | `done` |
| BB-036 | Security testing and CI gates | P0 | L | BB-008, BB-009, BB-028, BB-030 | `done` |

**Note:** BB-007 (design system) is Epic A but not listed in Tranche 1 sequence in the PDF; it is required before BB-028 and Tranche 5. Tracked below under Epic A remainder.

---

## Epic A remainder (design system)

| ID | Title | P | Size | Deps | Status | Notes |
|----|-------|---|------|------|--------|-------|
| BB-007 | Black Book design system | P0 | M | BB-006 | `done` | `@black-book/ui` tokens + components; fixtures at `/design-system`; a11y/contrast/motion tests |

### BB-007 acceptance checklist

- [x] Black/white/neutral primary palette with light and dark themes
- [x] Status colors reserved for warning, confidence, dispute, error (with non-color cues)
- [x] Editorial + restrained mono typography pairing
- [x] Grid, spacing, elevation, border, icon, motion, focus, data-viz tokens
- [x] Accessible cards, citations, confidence, timelines, maps, result lists, filters, dialogs, notices, empty states
- [x] WCAG contrast tests (AA minimum; AAA for primary ink/canvas)
- [x] Visible keyboard focus (`:focus-visible`) and reduced-motion support
- [x] Fixture gallery covers important states at `/design-system` (mobile→desktop CSS)
- [x] Avoid neon cyberpunk styling

---

## Tranche 4: Research and evidence engine

| ID | Title | P | Size | Deps | Status |
|----|-------|---|------|------|--------|
| BB-037 | Source registry and adapter contract | P0 | L | BB-016, BB-018 | `done` |
| BB-038 | Versioned historical query packs | P0 | M | BB-003, BB-037 | `todo` |
| BB-039 | Candidate discovery pipeline | P0 | L | BB-037, BB-038 | `todo` |
| BB-040 | Deterministic relevance engine | P0 | L | BB-003, BB-039 | `todo` |
| BB-041 | Entity and historical-location resolution | P0 | L | BB-014, BB-039 | `todo` |
| BB-042 | Atomic claim extraction and evidence registration | P0 | L | BB-016, BB-017, BB-041 | `done` |
| BB-043 | Confidence and source-lineage engine | P0 | L | BB-017, BB-042 | `done` |
| BB-044 | Research-case and publication workflow | P0 | L | BB-040–043 | `done` |
| BB-047 | Gold corpus and calibration harness | P0 | L | BB-040, BB-041, BB-043, BB-044 | `done` |

---

## Tranche 5: Public beta product

| ID | Title | P | Size | Deps | Status |
|----|-------|---|------|------|--------|
| BB-048 | Public application shell and navigation | P0 | L | BB-007, BB-019, BB-022 | `partial` |
| BB-049 | Search API and experience | P0 | L | BB-019, BB-025, BB-026, BB-048 | `todo` |
| BB-050 | U.S. address and current-location discovery | P0 | L | BB-015, BB-025, BB-049 | `todo` |
| BB-052 | Entity, place, school, event, and institution pages | P0 | L | BB-019, BB-048, BB-049 | `todo` |
| BB-053 | Evidence, confidence, dispute, and revision interface | P0 | L | BB-017, BB-019, BB-052 | `todo` |
| BB-054 | “Why this appears” and balanced historical storytelling | P0 | M | BB-003, BB-040, BB-052 | `todo` |
| BB-055 | Correction and challenge experience | P0 | L | BB-029, BB-032, BB-052 | `todo` |
| BB-056 | Administration and research console | P0 | XL | BB-027, BB-037, BB-044 | `done` |
| BB-057 | Accessibility, SEO, performance, and privacy review | P0 | L | BB-048–056 | `todo` |

---

## Tranche 6: Seed and launch

| ID | Title | P | Size | Deps | Status |
|----|-------|---|------|------|--------|
| BB-045 | Wikimedia discovery adapter | P1 | L | BB-037–039 | `done` |
| BB-046 | Federal archive and public-history adapters | P1 | L | BB-037, BB-039 | `done` |
| BB-058 | Initial high-confidence national seed | P1 | XL | BB-044–047, BB-052 | `todo` |
| BB-059 | Load, abuse, and cost testing | P0 | L | BB-023–026, BB-033, BB-049 | `todo` |
| BB-060 | Adversarial integrity exercise | P0 | L | BB-032, BB-043, BB-044, BB-055 | `todo` |
| BB-061 | Recovery and rollback rehearsal | P0 | M | BB-020, BB-035 | `done` |
| BB-062 | Production release pipeline | P0 | L | BB-010, BB-020, BB-036, BB-057 | `todo` |
| BB-063 | Beta launch gate | P0 | M | BB-047, BB-058–062 | `todo` |

---

## Deferred (Epic G + deferred list)

| ID | Title | P | Size | Deps | Status |
|----|-------|---|------|------|--------|
| BB-031 | Future file-upload quarantine boundary | P1 | M | BB-005, BB-029 | `deferred` |
| BB-051 | Results list and map | P1 | L | BB-049, BB-050 | `deferred` |
| BB-064 | LLM provider and research-mode framework | P2 | L | BB-042–044, BB-063 | `deferred` |
| BB-065 | Prompt-injection and model-tool isolation | P2 | L | BB-030, BB-064 | `deferred` |
| BB-066 | Mobile-ready shared contracts | P2 | M | BB-049–053 | `deferred` |

---

## Session log

### 2026-07-16

- Imported full bead backlog into this plan.
- Repo was empty (no git, no code) → BB-001 treated as greenfield baseline.
- Monorepo skeleton appeared in parallel (`apps/`, `packages/`, `workers/`, `infra/`, root pnpm + uv).
- BB-001 deliverables written:
  - `docs/bb-001/baseline-report.md` — current vs target, gaps, commands, Firebase/GitHub absence, bead adjustments
  - `docs/bb-001/repository-map.md` — quick tree map
- Bootstrap agent verified `pnpm bootstrap`, `pnpm test`, `pnpm build`, and `pnpm typecheck` after build all exit 0.
- Verification fixes applied: package `development` export conditions and root script `--if-present` placement.
- BB-001 marked `done`; Tranche 1 progress is now 1/9.
- Remaining gaps carried forward: Firebase (BB-011), real CI / workflow placement (BB-008/BB-009), Cloud SQL (BB-012), `format:check` style drift, typecheck build-order dependency, and local DB healthcheck not verified.
- Sequence notes recorded: BB-006 skeleton ≠ done; BB-007 before BB-028; CI path → `.github/`; emulate/deploy deferred to BB-011 / BB-062.
- BB-002 ADRs delivered under `docs/adr/` (ADR-001–010) with required sections; short summaries in `.cx/decisions/`.
- ADRs explicitly mark scaffold vs aspirational; Cloud SQL / Firebase / App Hosting / OIDC remain unprovisioned.
- No microservices beyond bead security boundaries (ADR-005). Tranche 1 progress was 2/9 after BB-002.
- BB-003 machine-readable product constitution:
  - Shared values: `packages/schemas/constitution/policy.v1.json` + `product-constitution.schema.json`
  - TS loaders/evaluators: `@black-book/schemas` (read-only; every evaluation returns `policyVersion`)
  - Python loaders/evaluators: `packages/constitution` (`black-book-constitution`), same JSON artifacts
  - Fixtures: included, excluded, disputed, sparse, sensitive, living-person
  - Domain `treatAsLiving` delegates to constitution (no duplicated thresholds)
  - Marked `done`; Tranche 1 progress was 3/9 (BB-001, BB-002, BB-003)
- BB-004 threat model and abuse-case corpus:
  - `docs/security/threat-model.md` — 19 P0 threats with preventive/detective/containment/recovery
  - `docs/security/abuse-cases.md` — AC-01–19 with bead mappings
  - `docs/security/threat-corpus.json` (+ schema) — machine-readable source of truth
  - `docs/security/tests/checklist.md` — security test scaffold toward BB-036
  - `@black-book/testing` validates corpus completeness (`pnpm --filter @black-book/testing test`)
  - Residual risk documented per threat + rollup; ADR-010 scaffold row updated
  - Marked `done`; Tranche 1 progress is now 4/9 (BB-001–004)
- Recommended next: **BB-005** (depends on BB-002, BB-004); BB-006 may proceed in parallel (deps BB-001, BB-002 only).
- BB-006 monorepo and shared package foundation:
  - Populated `@black-book/typescript-config` and `@black-book/eslint-config`; all TS workspaces consume the shared configs
  - Added structured logging / `AppError`, runtime environment defaults, and deterministic test utilities
  - Added `pnpm validate` boundary and cycle checks; deployable apps remain isolated
  - Frozen `pnpm bootstrap`, full tests, build, independent app builds, typecheck, lint, and formatting all verified exit 0
  - Added demo-only Firebase Auth/Firestore emulator config and documented local PostGIS; Compose config verified, runtime health deferred because Docker daemon was unavailable
  - Marked `done`; Tranche 1 progress is now 5/9
- Remaining foundation handoff: BB-008 adds real `.github/workflows` quality gates and fuller app tests; BB-011 links real Firebase projects and replaces deny-all placeholder rules.
- BB-005 environment and project isolation (design; cloud not provisioned):
  - Machine matrix: `infra/gcp/isolation-matrix.json` (+ schema) — 4 projects, 11 SAs, 5 bucket classes, 5 acceptance mappings
  - Human matrices: `projects.matrix.md`, `service-accounts.matrix.md`, `storage-buckets.matrix.md`, `iam-boundaries.md`
  - Terraform stubs under `infra/gcp/terraform/` (`terraform validate` Success against google provider; not applied)
  - Firebase aliases: `infra/firebase/.firebaserc.example`; App Hosting stubs: `apps/web/apphosting.yaml` (+ staging/production)
  - Design narrative + acceptance enforcement: `docs/security/environment-isolation.md`
  - ADR-005 / ADR-009 scaffold rows updated to “designed, not provisioned”
  - No production secrets in repo; no claim that GCP/Firebase projects exist
  - Marked `done`; Tranche 1 progress is now 6/9 (BB-001–006)
  - Still requires human org/console: create projects, billing, org policies, WIF (BB-010), Firebase bootstrap (BB-011), Cloud SQL (BB-012)
  - BB-006 completed in parallel; no conflict (BB-005 avoided eslint/typescript-config packages)
- BB-008 automated quality and test foundation:
  - `@black-book/testing` builders, deterministic IDs/clocks, production fail-closed guards, quarantine registry
  - Layer commands: `test:unit|contract|security|a11y|integration|migration|e2e|coverage` + `test:preflight`
  - Real CI: `.github/workflows/ci.yml` (read-only permissions, SHA-pinned actions, stable check names)
  - Guarded Postgres/Firebase/migration/e2e harnesses; CI requires Postgres service + Java emulators where applicable
  - Docs: `docs/testing/README.md`
  - Marked `done`; Tranche 1 progress was 7/9 (BB-001–006, BB-008)
  - Next was **BB-009** (GitHub rulesets using documented check names) or BB-007 design system
- Reconciled BB-005 to the authoritative single-project production reality (D-013):
  - Existing `black-book-efaaf` (`332234323945`; Hosting `black-book-efaaf.web.app`) is the only cloud project and is production.
  - Development stays on `demo-black-book` emulators; staging/research are same-project configuration scopes, not security boundaries.
  - Isolation matrix, human matrices, Terraform, Firebase aliases, App Hosting templates, ADR-005/009, and architecture docs now use the real project.
  - Per-surface SAs, four bucket boundaries, per-secret IAM, and later Postgres roles preserve research/public/submissions separation inside the project.
  - The four-project BB-005 topology remains a documented deferred migration triggered by cloud non-prod, research blast radius, or compliance/billing/recovery needs.
  - BB-011 must inventory before creating resources; no cloud resource was created or modified during reconciliation.
  - Read-only Firebase checks confirmed zero registered apps and the default Hosting site; App Hosting inventory is blocked until a human-approved Blaze upgrade enables its API.
- BB-009 GitHub repository governance (local done; remote partial):
  - `.github/CODEOWNERS`, `.github/dependabot.yml`, root `SECURITY.md`
  - Declarative ruleset + Actions allowlist + security settings under `infra/github/`
  - Dry-run apply / read-only check scripts: `infra/github/scripts/{apply,check}-governance.sh`
  - Policy checker: `pnpm validate:governance`; CI job **Governance**; wired into `pnpm validate`
  - Verified: no git remote; `gh auth` token invalid — **did not** mutate GitHub settings; apply commands in `infra/github/README.md`
  - Marked `done` locally; Tranche 1 progress was **8/9** (BB-001–006, BB-008, BB-009)
  - Next was create remote + `gh auth login` + apply rulesets (still required before live WIF)
- BB-007 Black Book design system:
  - `@black-book/ui`: light/dark tokens, editorial+mono typography, status-only hues, grid/spacing/elevation/border/icon/motion/focus/data-viz
  - Accessible components: Card, Citation, Confidence, Timeline, MapFrame, ResultList, FilterBar, Dialog, Notice, EmptyState (+ Button, ThemeToggle)
  - Fixture gallery (Storybook equivalent): `http://localhost:3000/design-system`
  - Tests: contrast (AA/AAA), reduced-motion CSS, focus rings, SSR semantic a11y smoke
  - Docs: `docs/ui/README.md`; public web imports styles + fonts
  - Marked `done`; Epic A remainder complete; Tranche 1 was **8/9** pending BB-010
  - Remaining UI gaps: BB-048 product shell, Storybook/Chromatic optional later, admin theming reuse
- BB-011 Firebase project bootstrap (partial cloud; repo complete):
  - External: created **Black Book Web** (`1:332234323945:web:17be349ebc9c029b3bfd78`) and
    **Black Book Admin** (`1:332234323945:web:e1b31c78e32d95943bfd78`) in `black-book-efaaf`
  - Blocked: Blaze/App Hosting backends; Firestore API/database not enabled; `gcloud` ADC absent
    (no SA/bucket provisioning); Auth providers not enabled (awaiting human choice)
  - Repo: `@black-book/firebase` env/guards/init + App Check scaffold; deny-all Firestore/Storage
    rules + emulator tests; Auth/App Check plan; minimal IAM doc; `.env.example`; App Hosting
    Secret Manager refs + public client identifiers
  - Marked `done` for bead acceptance with recorded blockers; Tranche 2 progress **1/10**
  - Next cloud: human Blaze upgrade → App Hosting backends; `gcloud auth login` → SAs/buckets;
    choose Auth providers; BB-012 Cloud SQL; BB-024 App Check enforcement
- BB-012 Cloud SQL / PostGIS / SQL Connect (repo foundation; cloud partial):
  - Product: Firebase **SQL Connect** (formerly Data Connect); CLI `dataconnect:*` (firebase-tools 15.x)
  - Local: `infra/database/init/` extensions, `bb_*` schemas, roles/grants/timeouts, isolation SQL;
    compose + optional PgBouncer profile; `pnpm db:init` / `db:verify`
  - SQL Connect templates: `infra/database/sql-connect/` — `@auth(level: NO_ACCESS)`, Admin SDK only
  - `@black-book/data-access`: server-only config, role matrix, pool exhaustion fail-closed, operation allowlist
  - Cloud SQL design: `infra/database/cloud-sql/PRODUCTION.md` — **not** created (no gcloud auth; cost gate)
  - Verified: unit/static tests + boundary browser denial; Docker daemon unavailable → no local runtime DB pass;
    CI Integration Postgres applies init + isolation
  - Marked `done` for repository acceptance with cloud blockers; Tranche 2 progress **2/10**
  - Next: **BB-013** schema boundaries/migrations; human Cloud SQL provision when Blaze/`gcloud` ready
- BB-010 GitHub OIDC deployment identities (declarative done; cloud not applied):
  - WIF Terraform stubs: `infra/gcp/wif/terraform/` (pool `black-book-github`, provider
    `github-actions`, trust CEL for numeric repo/owner IDs + `main` + workflow + `production`)
  - Docs: `infra/gcp/wif/{README,trust-conditions,deploy-roles}.md`;
    `infra/github/oidc/` (environment stubs + SA key removal path)
  - Scripts (dry-run default): `infra/github/scripts/{apply,check}-wif.sh`
  - Workflow stub: `.github/workflows/deploy-production.yml` (`workflow_dispatch` + Environment
    `production`; not a required check; no `credentials_json`)
  - Provenance schema: `infra/github/release-metadata/`
  - Allowed Actions pattern: `google-github-actions/auth@*`
  - Verified: no git remote; GitHub IDs TBD; WIF **not** created in GCP; no SA JSON secrets present
  - Marked `done` for bead acceptance (design + dry-run); Tranche 1 progress **9/9**
  - Unblocks BB-062 design/implementation once remote + WIF apply + App Hosting/SAs exist
  - Human next: create remote → `gh auth login` → apply BB-009 → fill numeric IDs →
    `gcloud auth login` → ensure `github-deploy` SA → `apply-wif.sh --apply`
- **D-014 / ADR-011 Firestore pivot + BB-013 rescoped (done):**
  - Authoritative decision: no Cloud SQL this phase; Firestore SoR; Storage/GCS for blobs
  - Decision docs: `.cx/decisions/D-014-*.md`, `docs/adr/ADR-011-*.md`; ADR-002 superseded; ADR-003 deferred; ADR-008 amended for geohash
  - Parked: `infra/database/` banners + Cloud SQL PRODUCTION deferral; Postgres CI optional (`ENABLE_POSTGRES_CI`)
  - Firestore foundation: rules, indexes, `FIRESTORE_MODEL.md`, `@black-book/firebase` converters/seeds, `@black-book/data-access` Firestore guards
  - BB-012 → `partial` (parked); BB-013 → `done` (Firestore, not SQL migrations); Tranche 2 progress **3/10**
  - Next recommended: **BB-014** entity + geography domain model on Firestore
- **BB-014 entity and geography domain model (done):**
  - `@black-book/domain`: kinds, aliases/ids, relationships, merge lineage, schools, specialized kinds, geohash + precision/ZIP policy
  - Firestore: expanded `canonicalEntities`, `locations` subcollection, `entityRelationships`, `entityMerges`; converters/seeds/unit tests
  - Geo without PostGIS: geohash fields + server radius filter path; ZIP modern-only
  - Tranche 2 progress **4/10**; next recommended: **BB-015** living-person / sensitive-location enforcement
- **BB-016 / BB-017 dependency handoff (done):**
  - Source/capture/rights/provenance records and deterministic claims/confidence/publication statuses are present in `@black-book/domain` and Firestore schemas.
- **BB-018 append-only audit and transactional outbox (done):**
  - Controlled audit vocabulary and full actor/reason/request/release/correlation/idempotency metadata
  - Firestore transaction helper commits state + audit + outbox + replay marker atomically
  - Consumer receipts, bounded exponential retry, dead letters, and deterministic entity publication history
  - Standard-edition emulator rules verified trusted create plus immutable update/delete denial; production API remains disabled
  - Full workspace build/typecheck currently stops in parallel `packages/testing` builder changes (`exactOptionalPropertyTypes`); BB-018 domain/firebase/data-access packages build and typecheck cleanly
  - Tranche 2 progress **6/10**; BB-019 may build immutable release activation on `commitWithAudit`
- **BB-015 living-person and sensitive-location enforcement (done):**
  - Constitution extended with `sensitivityRules` (classes, precision-reduction reasons, residential precision levels, living/occupied/sensitive-site public caps, deceased occupied-residence rule); JSON value + JSON Schema + Zod kept in sync; policyVersion unchanged (`1.0.0`); Python loader still validates
  - `@black-book/security` is the single public-serialization choke point:
    - `sensitivity.ts` — evidence/internal/public precision tiers + constitution-backed sensitivity/reason vocab
    - `redaction.ts` — `reducePublicPrecision` ladder (unknown⇒living), `redactLocationForPublic` (coarsens coords + geohash, strips address labels — protects maps), and `createSensitiveDataRedactor` deep scrubber for logs/telemetry/exports
    - `serialize.ts` — `toPublicEntityProjection` / `toPublicSearchDocument` / `redactForPublicExport` + fail-closed `assertPublicProjectionSafe` / `assertNoProhibitedPublicPrecision`
  - `@black-book/observability` logger gained a `redact` hook; security redactor keeps residential addresses + exact coordinates out of logs and error telemetry
  - `@black-book/firebase` public projection converter (`toFirestore`) now routes through `assertPublicProjectionSafe` (rejects prohibited precision, address fields, exact coords)
  - Tests: security 22 (living/unknown/deceased, residential reduction, prohibited precision, search/model/export/map/log paths, regression fixture proving stored exact address is reduced) + firebase 3 converter-wiring; observability/domain/schemas/Python suites still green
  - Validated: `pnpm validate`, targeted typechecks + builds (schemas→domain→observability→security→firebase); no Cloud SQL, no secrets, no commit
  - Coordinated with parallel BB-016/017/018/048 agents: kept edits in `packages/security`, redaction paths, `observability`, `converters.ts` (single converter line), and constitution — re-reading shared files before each edit
  - Tranche 2 progress **7/10**; BB-019 must build public projections/search index exclusively through `@black-book/security` serializers
