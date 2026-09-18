# BlackStory documentation

Operating docs for the BlackStory monorepo: architecture, decisions, security, testing, research, and runbooks.

**Public docs site:** [geraldmaron.github.io/blackstory](https://geraldmaron.github.io/blackstory/), built from `apps/docs` and synced here via `pnpm docs:publish` (`index.html`, `_next/`, `guides/`, `brand/`). Start with the public *Why BlackStory* guide for the human project story. The markdown below stays the source of truth for operators; do not delete it when republishing the site.

## Read first

| Doc | Contents |
|-----|----------|
| [Public docs site](https://geraldmaron.github.io/blackstory/) | GitHub Pages homepage from `apps/docs` |
| [`architecture.md`](./architecture.md) | Current stack (Vercel + Supabase) and invariants |
| [`decisions-carryover.md`](./decisions-carryover.md) | Current engineering contract, with executable owners |
| [`research/README.md`](./research/README.md) | Research method, capability limits, reuse, and challenge procedure |
| [`security/README.md`](./security/README.md) | Threat model, abuse corpus, environment isolation |
| [`testing/README.md`](./testing/README.md) | Test layers, CI check names, harnesses |
| [`ui/README.md`](./ui/README.md) | Design system tokens, components, fixtures |
| [`ui/brand.md`](./ui/brand.md) | Brand usage contract |
| [`research/`](./research/) | Discovery, adapters, query packs, relevance, confidence, research cases |
| [`admin/research-console.md`](./admin/research-console.md) | Administration and research console |
| [`../infra/github/README.md`](../infra/github/README.md) | GitHub governance and deployment controls |
| [`../SECURITY.md`](../SECURITY.md) | Security policy and private vulnerability reporting |
| [`../README.md`](../README.md) | Project overview and developer commands |
| Product constitution | `packages/schemas/constitution/` (shared TypeScript and Python) |

## What's here

| Path | Contents |
|------|----------|
| `architecture.md` | Current stack and invariants (Vercel + Supabase `blackstory-app`) |

| `security/` | Threat model, abuse corpus, isolation design |
| `testing/` | Test layers, CI check names, guarded harness docs |
| `ui/` | Design system usage, fixtures, accessibility notes |
| `research/` | Discovery pipeline, adapters, query packs, relevance, confidence |
| `admin/` | Administration and research console |
| `data/` | Postgres schema, storage and retired-provider boundary |
| `methodology/` | Public methodology notes |
| `runbooks/` | Operational procedures |
| `launch/` | Launch checklists |
| `ds-001/` | Early baseline reconnaissance notes |
| `../packages/schemas/constitution/` | Versioned product policy JSON and fixtures |

## Upkeep

When work changes project reality, update this file and/or `architecture.md` so the docs match what ships.
