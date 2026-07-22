# BlackStory

BlackStory is a place-connected Black history research platform. The product line is *History, pinned to place.* People, places, evidence, and context, pinned to geography you can explore.

This repository is the TypeScript and Python monorepo behind the public site, admin console, APIs, research workers, and shared libraries. Live product: [blackstory.app](https://blackstory.app).

**Product name:** BlackStory. Package scope stays brand-agnostic: `@repo/*` packages, `ds-*` design tokens, and `APP_*` break-glass env vars. Do not rename those prefixes for a product rebrand.

## What we build

- A **public map and catalog** of historical records, with precision and evidence visible
- **Stories and methodology** grounded in cited sources, not sweeping claims
- An **admin and research console** for intake, review, and publication
- **APIs** for public reads, corrections intake, and private publication control
- Shared **domain, security, and data** packages so surfaces stay consistent

Public clients read released projections only. Anonymous clients never write canonical history. Living residential addresses are never exposed; unknown living status is treated as living. Research workers and LLMs cannot publish.

## Repository map

| Path | Role |
|------|------|
| `apps/web` | Public Next.js app (Vercel; see ADR-027) |
| `apps/admin` | Private admin and research console |
| `apps/api-public` | Public read, search, and location API |
| `apps/api-submissions` | Corrections and contribution intake |
| `apps/api-internal` | Publication and internal control API |
| `apps/docs` | Public docs site (GitHub Pages export) |
| `apps/mobile` | Expo mobile app (isolated npm lockfile) |
| `workers/*` | Python research, publication, and security workers |
| `packages/*` | Shared TypeScript libraries |
| `supabase/` | Postgres migrations and Supabase project config |
| `infra/*` | Firebase, GCP, GitHub, and database scaffolding |
| `docs/` | Architecture, ADRs, security, testing, and runbooks |
| `brand/` | Brand masters (lockups, symbols, tokens, guide) |

Architecture overview: [`docs/architecture.md`](./docs/architecture.md). Decisions: [`docs/adr/`](./docs/adr/README.md). Brand contract: [`docs/ui/brand.md`](./docs/ui/brand.md). Docs index: [`docs/README.md`](./docs/README.md).

**Docs site:** [geraldmaron.github.io/blackstory](https://geraldmaron.github.io/blackstory/), built from `apps/docs` and published into the repo `docs/` folder on `main`.

```bash
pnpm --filter @repo/docs dev   # local preview (http://localhost:3050/)
pnpm docs:publish              # build and sync into docs/ (then commit and push)
```

GitHub Pages: Deploy from branch `main`, folder `/docs`. That folder also holds operating markdown (ADRs, architecture), so the site homepage is `docs/index.html` and guides live under `/guides/…`.

## Prerequisites

- Node.js 22+ (`nvm use` from `.nvmrc`)
- [pnpm](https://pnpm.io/) 9.x
- [uv](https://docs.astral.sh/uv/) (Python 3.12+)
- Docker optional for the parked local PostGIS under `infra/database/` (product system of record is Supabase; see ADR-020)

## Getting started

```bash
# Fresh clone: install JS and Python from lockfiles
./scripts/bootstrap.sh
# or
pnpm bootstrap

# Copy local env placeholders (emulator-oriented; no production secrets required)
cp -f .env.example .env.local

# Public web (preferred launcher sets data-source env coherently)
pnpm dev:web
# http://localhost:3048/
# http://localhost:3048/explore   # live catalog needs postgres + DATABASE_URL
# Without those env vars you get the small Dunbar seed catalog
```

## Common commands

```bash
pnpm validate           # boundaries, cycles, lint, governance policy
pnpm validate:governance
pnpm format:check
pnpm test:preflight     # fail closed if production identifiers leak into tests
pnpm test               # preflight + JS + Python
pnpm test:js
pnpm test:py
pnpm build
pnpm build && pnpm typecheck   # typecheck needs built package declarations

# Local Firebase Auth + Firestore + Storage emulators (demo project)
pnpm firebase:emulators
pnpm firebase:test:rules

# Parked local PostGIS (not product SoR)
pnpm db:up && pnpm db:init && pnpm db:verify
pnpm db:down
```

Independent deployable builds:

```bash
pnpm --filter @repo/web build
pnpm --filter @repo/admin build
pnpm --filter @repo/api-public build
pnpm --filter @repo/api-submissions build
pnpm --filter @repo/api-internal build
```

Internal `@repo/*` packages expose a `development` export condition that points at TypeScript source, so tests run against source without a prior build. `pnpm build` writes `dist/`; `pnpm typecheck` resolves cross-package types from those declarations.

Shared TypeScript and ESLint policy lives in `packages/typescript-config` and `packages/eslint-config`. `scripts/validate-boundaries.mjs` rejects app-to-app dependencies, shared-package imports of deployable apps, and workspace dependency cycles.

## Data plane

Product system of record is Supabase Postgres (`blackstory-app`). Schema and migrations: [`docs/data/postgres-schema.md`](./docs/data/postgres-schema.md), [`supabase/migrations/`](./supabase/migrations/). Decision: [ADR-020](./docs/adr/ADR-020-supabase-postgres-system-of-record.md).

Context indicators (justice, wealth, housing) live in `bb_reference.statistical_*`. Catalog: [`docs/research/context-data-source-matrix.md`](./docs/research/context-data-source-matrix.md). Juxtaposition rules: [`docs/methodology/juxtaposition-not-causation.md`](./docs/methodology/juxtaposition-not-causation.md).

Firestore-to-Postgres ETL: [`packages/migrate-firestore-postgres`](./packages/migrate-firestore-postgres/). Hosted apps use `PUBLIC_DATA_SOURCE=postgres` / `ADMIN_DATA_SOURCE=postgres` with Secret Manager `DATABASE_URL`. Blobs cut over to Supabase Storage (`public-media`, `raw-sources`) with dual-serve during migration: [`docs/data/supabase-storage-cutover.md`](./docs/data/supabase-storage-cutover.md). Firestore remains until the wind-down checklist in [`docs/data/firebase-wind-down.md`](./docs/data/firebase-wind-down.md) is complete.

Audit and outbox helpers commit state, immutable audit, and pending delivery together, with idempotency, bounded retry, and publication-history reconstruction.

Firebase config: `infra/firebase/` and `@repo/firebase`. Isolation design: `infra/gcp/` and [`docs/security/environment-isolation.md`](./docs/security/environment-isolation.md).

## Product constitution

Versioned policy values live in one place and are loaded by TypeScript and Python:

- Values: `packages/schemas/constitution/policy.v1.json`
- JSON Schema: `packages/schemas/constitution/product-constitution.schema.json`
- TypeScript: `import { loadProductConstitution, evaluateLivingStatus } from '@repo/schemas'`
- Python: `from black_book_constitution import load_product_constitution, evaluate_living_status`

Policy is read-only in both packages. Changes ship as a new `policyVersion`, not via HTTP.

## Security, testing, and design

- Security index: [`docs/security/README.md`](./docs/security/README.md)
- Threat model: [`docs/security/threat-model.md`](./docs/security/threat-model.md)
- Abuse cases: [`docs/security/abuse-cases.md`](./docs/security/abuse-cases.md)
- Testing guide: [`docs/testing/README.md`](./docs/testing/README.md)
- CI: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
- Governance: [`infra/github/README.md`](./infra/github/README.md), [`SECURITY.md`](./SECURITY.md)
- Design system: [`docs/ui/README.md`](./docs/ui/README.md), package `@repo/ui`, gallery at `/design-system`

## Operator tooling (local)

Discovery, enrichment, locate, and story-research CLIs live under `packages/operator-cli` and `packages/firebase/scripts`. Runbooks: [`docs/runbooks/`](./docs/runbooks/), discovery pipeline: [`docs/research/discovery-pipeline.md`](./docs/research/discovery-pipeline.md). Prefer the documented launchers so env vars stay coherent with the data plane.

## Invariants

- Anonymous clients never write canonical history
- Public pages read only released projections and snapshots
- Research workers and LLMs cannot publish
- Living residential addresses are never returned publicly
- Unknown living status is treated as living
