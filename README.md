# BlackStory

Place-connected Black history research platform. TypeScript + Python monorepo.

**Product name:** BlackStory. **Code scope:** `@repo/*` (brand-agnostic — do not rename packages for a product rebrand). Design tokens: `ds-*`. Env break-glass: `APP_*`.

Operating docs: [`docs/README.md`](./docs/README.md), [`docs/architecture.md`](./docs/architecture.md), brand contract: [`docs/ui/brand.md`](./docs/ui/brand.md).  
Architecture decisions: [`docs/adr/`](./docs/adr/README.md).

## Repository map

| Path | Role |
|------|------|
| `apps/web` | Public Next.js app (Firebase App Hosting) |
| `apps/admin` | Private Next.js admin/research console (Cloud Run + IAP) |
| `apps/api-public` | Public read/search/location API |
| `apps/api-submissions` | Corrections / contribution intake API |
| `apps/api-internal` | Publication / internal control API (private) |
| `workers/*` | Python research, publication, and security workers |
| `packages/*` | Shared TypeScript libraries |
| `infra/*` | Firebase, GCP, GitHub, database scaffolding |
| `docs/` | Human docs, ADRs (`docs/adr/`), and bead reports |

## Prerequisites

- Node.js 22+ (`nvm use` from `.nvmrc`)
- [pnpm](https://pnpm.io/) 9.x
- [uv](https://docs.astral.sh/uv/) (Python 3.12+)
- Docker (optional only — local PostGIS is **deferred** / not required; ADR-011)

## Commands

```bash
# Fresh clone → reproducible JS + Python environments from pnpm-lock.yaml and uv.lock
./scripts/bootstrap.sh
# or
pnpm bootstrap

# Validation and tests
pnpm validate      # dependency boundaries, cycle detection, lint, and GitHub governance policy
pnpm validate:governance
pnpm format:check
pnpm test:preflight # fail closed if production identifiers/endpoints are present
pnpm test          # preflight + JS packages/apps + Python pytest
pnpm test:js
pnpm test:py
pnpm test:unit
pnpm test:contract
pnpm test:security
pnpm test:a11y
pnpm test:integration
pnpm test:migration
pnpm test:e2e
pnpm test:coverage

# Build
pnpm build

# Typecheck (run after `pnpm build` — API apps consume built package declarations)
pnpm build && pnpm typecheck

# Local PostGIS (deferred / optional — not production path; ADR-011)
pnpm db:up
pnpm db:status
pnpm db:init
pnpm db:verify
pnpm db:down

# Parked Firebase SQL Connect templates (do not provision Cloud SQL)
pnpm db:sql-connect:compile
pnpm db:sql-connect:sdk

# Local Firebase Auth + Firestore + Storage emulators (demo project; no cloud credentials)
pnpm firebase:emulators
# Firestore rules + converters tests (requires emulators; CI sets CI_REQUIRE_FIREBASE=1)
pnpm firebase:test:rules
```

**Data plane (current phase):** Cloud Firestore + Storage. See [`infra/firebase/FIRESTORE_MODEL.md`](./infra/firebase/FIRESTORE_MODEL.md) and [ADR-011](./docs/adr/ADR-011-firestore-system-of-record.md). Do not provision Cloud SQL.
BB-018 audit/outbox helpers atomically commit state + immutable audit + pending delivery with
idempotency, bounded retry/dead-letter handling, and publication-history reconstruction.
Bootstrap uses frozen pnpm and uv lockfiles. Local tests default to `NODE_ENV=development` and
`LOG_LEVEL=info`; no production environment variables or cloud credentials are required.
Copy [`.env.example`](./.env.example) for local emulator-oriented Firebase placeholders.

Internal `@repo/*` packages expose a `development` export condition that
points at TypeScript source, so `pnpm test`/`pnpm test:js` run against source with
no prior build. `pnpm build` compiles each package to `dist/`, and `pnpm typecheck`
resolves cross-package types from those built declarations (hence build-first).

The five deployables remain independently buildable:

```bash
pnpm --filter @repo/web build
pnpm --filter @repo/admin build
pnpm --filter @repo/api-public build
pnpm --filter @repo/api-submissions build
pnpm --filter @repo/api-internal build
```

Shared TypeScript and ESLint policy lives in `packages/typescript-config` and
`packages/eslint-config`. `scripts/validate-boundaries.mjs` rejects app-to-app dependencies,
shared-package imports of deployable apps, and workspace dependency cycles.

PostGIS runs from the pinned image in `infra/database/docker-compose.yml` on
`postgresql://blackbook:blackbook@localhost:5432/blackbook`. These credentials are local-only.
Foundation SQL (extensions, `bb_*` schemas, roles/grants/timeouts): `pnpm db:init` /
`pnpm db:verify`. Server-only helpers: `@repo/data-access`. SQL Connect templates:
`infra/database/sql-connect/` (`pnpm db:sql-connect:compile`). Cloud SQL is designed but
**not** provisioned — see `infra/database/cloud-sql/PRODUCTION.md`.
Firebase config (BB-011): `infra/firebase/` + `@repo/firebase`. App Hosting templates:
`apps/web/apphosting*.yaml`. Root `.firebaserc` maps to production `black-book-efaaf`. Isolation
design (per-surface SAs / buckets / DB roles): `infra/gcp/` and
`docs/security/environment-isolation.md`.

## Current status

BB-001 through BB-010 (BB-009/010 local; cloud/remote apply pending), **BB-007** design system,
**BB-011** Firebase bootstrap, **BB-012** database foundation (local roles + SQL Connect
templates; Cloud SQL instance not provisioned), and **BB-048** public application shell are in
place. **BB-024** adds monitor/enforce App Check guards for public and submissions APIs, with
replay consumption on submissions. **BB-029** validates corrections and abuse reports into an
immutable, privacy-restricted quarantine with spam, duplicate, and coordinated-campaign detection;
the submissions surface still cannot write canonical/public data. Public web (unique port): `http://localhost:3048/` — design fixtures at
`http://localhost:3048/design-system` (`docs/ui/README.md`). Production `black-book-efaaf` has
Hosting plus registered **Blap Web** / **Blap Admin** apps. Still blocked/deferred:
Blaze/App Hosting backends, Firestore database enablement, GCP class buckets/SAs/IAM, Auth
provider choice, App Check provider registration/console enforcement, GitHub remote rulesets + live WIF apply, Cloud
SQL create — see `docs/ds-001/`, `docs/adr/`, `docs/security/`, `docs/testing/`, `docs/ui/`,
`infra/firebase/`, `infra/gcp/` (incl. `wif/`), `infra/github/`, `infra/database/`.

```bash
pnpm --filter @repo/web exec next dev --port 3048
# or: pnpm --filter @repo/web dev
# http://localhost:3048/
# http://localhost:3048/design-system

# Location accuracy (Census geocode, cached, no LLM) — see docs/runbooks/data-ingestion-methodology.md
node --conditions development --import tsx packages/firebase/scripts/qa-catalog-fixtures.ts
node --conditions development --import tsx packages/firebase/scripts/audit-entity-locations.ts
# Named-place enrichment (Wikidata P625) → git-durable overrides
node --conditions development --import tsx packages/firebase/scripts/enrich-entity-locations.ts --apply
# Optional: snap high-confidence street pins only
# node --conditions development --import tsx packages/firebase/scripts/audit-entity-locations.ts --apply-street-corrections
node --conditions development --import tsx packages/operator-cli/src/bin.ts locate \
  --entity-id ent_example_001 --address "123 Main St, City, State" \
  --jurisdiction "City, State" --precision institution \
  --operator-id "$USER" --session-id "locate-$(date +%s)" --identity-source cli

# Community-feed obscurity dry-run (private candidates only; weekly schedule declared, GCP apply is human)
# See docs/research/discovery-pipeline.md
node --conditions development --import tsx packages/operator-cli/src/bin.ts community-obscurity-run \
  --feed-xml feed_the_american_blackstory=packages/domain/src/adapters/rss/fixtures/the-american-blackstory.trimmed.rss.xml \
  --catalog-titles "Rosa Parks|Martin Luther King Jr.|Buffalo Soldiers|Harriet Tubman"

# Generic RSS discovery dry-run (excludes curated ABS by default; use --include-curated to opt in)
node --conditions development --import tsx packages/operator-cli/src/bin.ts rss-campaign-run \
  --feed-xml feed_historical_society=packages/domain/src/adapters/rss/fixtures/historical-society-feed.rss.xml

# Discovery automation dispatcher (fixture; GHA workflow_dispatch also available)
node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-dispatch \
  --job discovery-campaign-wikimedia-federal --mode fixture
# Scheduled Functions (ADR-018): pnpm --filter @repo/functions-discovery start
# See docs/runbooks/discovery-campaign-automation.md and functions/README.md

# Editorial enrichment (LLM stage-only; --provider mock|openrouter|ollama; --catalog-from=firestore)
# OPERATOR_CLI_PRIVACY_PEPPER=dev node --conditions development --import tsx \
#   packages/operator-cli/src/bin.ts editorial-run --subjects /tmp/subjects.json \
#   --catalog-from=firestore --provider mock \
#   --operator-id "$USER" --session-id "sess-$(date +%s)" --identity-source cursor_session
# Embedding backfill (needs GEMINI_API_KEY): packages/firebase/src/embeddings/backfill-cli.ts \
#   --source=publicSearchIndex --max-items 600 --max-cost-usd 1

# Story research (citation-gated /stories drafts; staging only — human approve before seed)
# See .claude/skills/black-book/story-craft/SKILL.md
# Review UI: apps/admin → http://localhost:3001/login then /stories/review
# (Firebase Google auth; allowlist geraldmarondagher@gmail.com only)
# OPERATOR_CLI_PRIVACY_PEPPER=dev node --conditions development --import tsx \
#   packages/operator-cli/src/bin.ts story-research-run --topics /tmp/story-topics.json \
#   --provider mock \
#   --operator-id "$USER" --session-id "sess-$(date +%s)" --identity-source cursor_session
```

## Product constitution (policy)

Versioned policy values live in one place and are loaded by TypeScript and Python:

- Values: `packages/schemas/constitution/policy.v1.json`
- JSON Schema: `packages/schemas/constitution/product-constitution.schema.json`
- TS: `import { loadProductConstitution, evaluateLivingStatus } from '@repo/schemas'`
- Python: `from black_book_constitution import load_product_constitution, evaluate_living_status`

Policy is read-only in both packages (no public mutation API). Changes ship as a new `policyVersion`, not via HTTP.

## Security (threat model + isolation)

- Index: [`docs/security/README.md`](./docs/security/README.md)
- Threat model: [`docs/security/threat-model.md`](./docs/security/threat-model.md)
- Abuse cases: [`docs/security/abuse-cases.md`](./docs/security/abuse-cases.md)
- Submission quarantine: [`docs/security/submission-quarantine.md`](./docs/security/submission-quarantine.md)
- Environment isolation (single-project production; BB-005/D-013): [`docs/security/environment-isolation.md`](./docs/security/environment-isolation.md)
- Isolation matrices / Terraform stubs: [`infra/gcp/`](./infra/gcp/)
- Corpus tests: `pnpm --filter @repo/testing test`

## Testing (BB-008), governance (BB-009), OIDC (BB-010)

- Guide: [`docs/testing/README.md`](./docs/testing/README.md)
- CI workflow: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
- OIDC deploy stub: [`.github/workflows/deploy-production.yml`](./.github/workflows/deploy-production.yml) (`workflow_dispatch` only)
- WIF design: [`infra/gcp/wif/`](./infra/gcp/wif/) — dry-run: `./infra/github/scripts/apply-wif.sh --dry-run`
- Builders / guards / harnesses: `@repo/testing`
- Quarantine registry: `packages/testing/quarantine.json` (owner + deadline required)
- Governance: [`infra/github/README.md`](./infra/github/README.md), [`SECURITY.md`](./SECURITY.md), `pnpm validate:governance`
- Remote ruleset apply (after GitHub remote + admin auth): `./infra/github/scripts/apply-governance.sh --dry-run`

## Design system (BB-007)

- Guide: [`docs/ui/README.md`](./docs/ui/README.md)
- Package: `@repo/ui`
- Fixture gallery: `/design-system` on the public web app

## Invariants (summary)

Anonymous clients never write canonical history. Public pages read only released projections/snapshots. Research workers and LLMs cannot publish. Living residential addresses are never returned publicly; unknown living status is treated as living.
