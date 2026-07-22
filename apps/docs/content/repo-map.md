---
title: Repository map
description: Where apps, packages, workers, and infra live in the monorepo.
nav: start
order: 2
---

# Repository map

BlackStory ships as one monorepo so public surfaces, private research tools, and
shared libraries stay on the same contracts.

| Path | Role |
|------|------|
| `apps/web` | Public Next.js app (Vercel; live at blackstory.app) |
| `apps/admin` | Private Next.js admin and research console |
| `apps/api-public` | Public read, search, and location API |
| `apps/api-submissions` | Corrections and contribution intake |
| `apps/api-internal` | Publication and internal control API |
| `apps/docs` | This GitHub Pages site (static export) |
| `apps/mobile` | Expo mobile app (isolated npm lockfile) |
| `workers/*` | Python research, publication, and security workers |
| `packages/*` | Shared TypeScript libraries (`@repo/*`) |
| `supabase/` | Postgres migrations and Supabase project config |
| `functions/` | Firebase Functions schedules for discovery |
| `infra/*` | Firebase, GCP, GitHub, and database scaffolding |
| `docs/` | Operating docs, ADRs, methodology, and runbooks |
| `brand/` | Brand masters (lockups, symbols, tokens, guide) |

## Stable code prefixes

Package scope is brand-agnostic so a product rename does not rewrite the
monorepo:

| Layer | Stable value |
|-------|--------------|
| npm packages | `@repo/*` |
| CSS / tokens | `ds-*` / `--ds-*` |
| Env break-glass | `APP_*` |

User-visible strings and assets come from identity helpers and
`apps/web/public/brand/` role-based paths.

## Where the depth lives

This docs site is the orientation layer. Deeper operating notes stay in the
repository:

- Architecture and ADRs: `docs/architecture.md`, `docs/adr/`
- Methodology: `docs/methodology/`
- Research pipeline: `docs/research/`
- Security: `docs/security/`
- Runbooks: `docs/runbooks/`
