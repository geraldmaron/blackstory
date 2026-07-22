# BlackStory documentation

Operating docs for the BlackStory monorepo: architecture, decisions, security, testing, research, and runbooks.

**Public docs site:** [geraldmaron.github.io/blackstory](https://geraldmaron.github.io/blackstory/), built from `apps/docs` and synced here via `pnpm docs:publish` (`index.html`, `_next/`, `guides/`, `brand/`). Start with the public *Why BlackStory* guide for the human project story. The markdown below stays the source of truth for operators; do not delete it when republishing the site.

## Read first

| Doc | Contents |
|-----|----------|
| [Public docs site](https://geraldmaron.github.io/blackstory/) | GitHub Pages homepage from `apps/docs` |
| [`architecture.md`](./architecture.md) | Target architecture and invariants |
| [`adr/README.md`](./adr/README.md) | Architecture decision records |
| [`security/README.md`](./security/README.md) | Threat model, abuse corpus, environment isolation |
| [`testing/README.md`](./testing/README.md) | Test layers, CI check names, harnesses |
| [`ui/README.md`](./ui/README.md) | Design system tokens, components, fixtures |
| [`ui/brand.md`](./ui/brand.md) | Brand usage contract |
| [`research/`](./research/) | Discovery, adapters, query packs, relevance, confidence, research cases |
| [`admin/research-console.md`](./admin/research-console.md) | Administration and research console |
| [`../infra/github/README.md`](../infra/github/README.md) | GitHub governance and OIDC/WIF operator docs |
| [`../infra/database/README.md`](../infra/database/README.md) | Parked PostGIS / SQL Connect (Cloud SQL deferred; see ADR-011) |
| [`../infra/firebase/FIRESTORE_MODEL.md`](../infra/firebase/FIRESTORE_MODEL.md) | Firestore collection map and rules |
| [`../SECURITY.md`](../SECURITY.md) | Security policy and private vulnerability reporting |
| [`../README.md`](../README.md) | Project overview and developer commands |
| Product constitution | `packages/schemas/constitution/` (shared TypeScript and Python) |
| Env isolation | `infra/gcp/`, `infra/firebase/` |

## What's here

| Path | Contents |
|------|----------|
| `architecture.md` | Canonical architecture and invariants |
| `adr/` | Formal ADRs (scaffold vs target noted; cloud not provisioned from these alone) |
| `security/` | Threat model, abuse corpus, isolation design |
| `testing/` | Test layers, CI check names, guarded harness docs |
| `ui/` | Design system usage, fixtures, accessibility notes |
| `research/` | Discovery pipeline, adapters, query packs, relevance, confidence |
| `admin/` | Administration and research console |
| `data/` | Postgres schema, storage cutover, Firebase wind-down |
| `methodology/` | Public methodology notes |
| `runbooks/` | Operational procedures |
| `launch/` | Launch checklists |
| `ds-001/` | Early baseline reconnaissance notes |
| `../packages/schemas/constitution/` | Versioned product policy JSON and fixtures |
| `../infra/gcp/` | Isolation matrices and Terraform stubs (including WIF under `wif/`) |
| `../infra/firebase/` | Firebase config, Firestore model/rules, App Hosting templates |
| `../infra/database/` | Parked local PostGIS / SQL Connect (not the production path) |

## Upkeep

When work changes project reality, update this file and/or `architecture.md` so the docs match what ships.
