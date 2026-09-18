# BlackStory

BlackStory is a place-connected Black history research platform. The product line is *History, pinned to place.* People, places, evidence, and context, pinned to geography you can explore.

This repository is the TypeScript and Python monorepo behind the public site, admin console, APIs, research workers, and shared libraries. Live product: [blackstory.app](https://blackstory.app).

**Product name:** BlackStory. Package scope stays brand-agnostic: `@repo/*` packages, `ds-*` design tokens, and `APP_*` break-glass env vars. Do not rename those prefixes for a product rebrand.

## Architecture and research

The supported stack is Vercel for the web app, Cloudflare at the edge, and Supabase Postgres,
Auth, and Storage for data, identity, and media. Firebase and Firestore runtime paths are removed.
The repository does not establish the state of old remote accounts or current billing.

Start with [architecture](./docs/architecture.md), the [engineering contract](./docs/decisions-carryover.md),
and the [research framework](./docs/research/README.md). These are current, challengeable contracts.
Git and Beads retain investigation history. No ADR or PRD overrides observed behavior without review.

The research kernel supports domain profiles, a durable task ledger, evidence-attached proposals,
private passage retrieval, and rights-aware preservation. [Operations](./docs/research/research-operations.md)
explains headless commands and their verification limits. Scheduling remains available but uninstalled.

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
| `apps/web` | Public Next.js app on **Vercel** (live at blackstory.app); private admin/research console at `/admin`, staff-gated |
| `apps/api-public` | Public read, search, and location API (in-repo; Cloud Run deploy unverified) |
| `apps/api-submissions` | Corrections and contribution intake (in-repo; Cloud Run deploy unverified) |
| `apps/api-internal` | Publication and internal control API (in-repo; Cloud Run deploy unverified) |
| `apps/docs` | Public docs site (GitHub Pages export) |
| `apps/mobile` | Expo mobile app (isolated npm lockfile) |
| `workers/*` | Python research, publication, and security workers |
| `packages/*` | Shared TypeScript libraries |
| `supabase/` | Postgres migrations and Supabase project config for `blackstory-app` |
| `infra/*` | GitHub governance and optional service-control configuration |
| `docs/` | Current architecture, research, security, testing, and runbooks |
| `brand/` | Brand masters (lockups, symbols, tokens, guide) |

Brand contract: [`docs/ui/brand.md`](./docs/ui/brand.md). Docs index: [`docs/README.md`](./docs/README.md).

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
- Docker optional for an isolated local Supabase rehearsal (`supabase start`).

## Getting started

```bash
# Fresh clone: install JS and Python from lockfiles
./scripts/bootstrap.sh
# or
pnpm bootstrap

# Copy local env placeholders (no production secrets required)
cp -f .env.example .env.local

# Public web (preferred launcher sets data-source env coherently)
pnpm dev:web
# http://localhost:3048/
# http://localhost:3048/explore   # live catalog (Explore) needs postgres + DATABASE_URL
# Catalog pages require Postgres; editorial pages can render without it.

# Mobile — prod-like local QA (embedded bundle, no Metro; **agent default**)
pnpm mobile:ios:release      # build/install/launch Release on booted Simulator
pnpm mobile:ios:verify       # **agent gate** — api-public + Release app; Metro NOT checked
pnpm mobile:ios:launch       # relaunch installed Release app only

# Mobile — hot reload dev client (Metro required; Path B only when editing JS)
pnpm dev:mobile
pnpm dev:mobile:verify       # LAN :8081 bundle + stale packager port check (NOT the agent default)
# Needs apps/mobile/.env.local with API_BASE_URL=http://127.0.0.1:8080 (simulator)
# See apps/mobile/README.md for physical-device LAN setup and stale-port recovery
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

```

Independent deployable builds:

```bash
pnpm --filter @repo/web build
pnpm --filter @repo/api-public build
pnpm --filter @repo/api-submissions build
pnpm --filter @repo/api-internal build
```

Internal `@repo/*` packages expose a `development` export condition that points at TypeScript source, so tests run against source without a prior build. `pnpm build` writes `dist/`; `pnpm typecheck` resolves cross-package types from those declarations.

Shared TypeScript and ESLint policy lives in `packages/typescript-config` and `packages/eslint-config`. `scripts/validate-boundaries.mjs` rejects app-to-app dependencies, shared-package imports of deployable apps, and workspace dependency cycles.

## Data plane

Product system of record is Supabase Postgres on `blackstory-app` (`https://twykhihqkcldpreuovay.supabase.co`). Schema and migrations: [`docs/data/postgres-schema.md`](./docs/data/postgres-schema.md), [`supabase/migrations/`](./supabase/migrations/). Decision: ADR-020 (removed 2026-07-24, see [`docs/decisions-carryover.md`](./docs/decisions-carryover.md)).

Hosted public web reads `PUBLIC_DATA_SOURCE=postgres` with server-only `DATABASE_URL` on Vercel. The admin console at `/admin` uses `ADMIN_DATA_SOURCE=postgres` with a separate `ADMIN_DATABASE_URL` credential in the same Vercel project — a distinct env var, not a distinct deployment. Public media is Supabase Storage (`public-media`). Storage writers target Supabase; external image sources must satisfy the media policy.

Firebase, Firestore, and the parked database stack are removed. The [storage contract](./docs/data/supabase-storage-cutover.md) defines the current media and capture boundary.

Context indicators (justice, wealth, housing) live in `reference.statistical_*`. Catalog: [`docs/research/context-data-source-matrix.md`](./docs/research/context-data-source-matrix.md). Juxtaposition rules: [`docs/methodology/juxtaposition-not-causation.md`](./docs/methodology/juxtaposition-not-causation.md).

Audit and outbox helpers commit state, immutable audit, and pending delivery together, with idempotency, bounded retry, and publication-history reconstruction.

Provider retirement does not imply remote account deletion. See the [retirement boundary](./docs/data/firebase-wind-down.md).

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

Discovery, enrichment, locate, and story-research CLIs live under `packages/operator-cli`. Operator data utilities live in `packages/ops-data/scripts`. Runbooks: [`docs/runbooks/`](./docs/runbooks/), discovery pipeline: [`docs/research/discovery-pipeline.md`](./docs/research/discovery-pipeline.md). Prefer the documented launchers so env vars stay coherent with the data plane.

## Invariants

- Anonymous clients never write canonical history
- Public pages read only released projections and snapshots
- Research workers and LLMs cannot publish
- Living residential addresses are never returned publicly
- Unknown living status is treated as living
