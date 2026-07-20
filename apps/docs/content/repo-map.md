---
title: Repository map
description: Where apps, packages, workers, and infra live in the monorepo.
nav: start
order: 2
---

# Repository map

| Path | Role |
|------|------|
| `apps/web` | Public Next.js app (Firebase App Hosting) |
| `apps/admin` | Private Next.js admin/research console |
| `apps/api-public` | Public read/search/location API |
| `apps/api-submissions` | Corrections / contribution intake API |
| `apps/api-internal` | Publication / internal control API |
| `apps/docs` | This GitHub Pages site (static export) |
| `workers/*` | Python research, publication, and security workers |
| `packages/*` | Shared TypeScript libraries (`@repo/*`) |
| `infra/*` | Firebase, GCP, GitHub, database scaffolding |
| `docs/` | Operating docs, ADRs, and research notes |

Code package scope is brand-agnostic: npm packages stay `@repo/*`, design tokens
`ds-*`, env break-glass `APP_*`. Product rename does not rewrite the monorepo.
