---
title: Architecture
description: Surfaces, data plane, and non-negotiable boundaries.
nav: concepts
order: 1
---

# Architecture

BlackStory is a place-connected Black history research platform. Public surfaces
serve only released historical projections. Research, evidence, and promotion
stay behind private APIs, workers, and admin tools.

## Surfaces

```
apps/web                 Public Next.js (Vercel; see ADR-027)
apps/admin               Private admin / research console
apps/api-public          Public read / search / location
apps/api-submissions     Corrections / contribution intake
apps/api-internal        Publication / promotion (private)
apps/mobile              Expo mobile app (isolated lockfile)
apps/docs                This GitHub Pages site
workers/*                Research, publication, security
functions/               Tombstone (discovery schedules: ADR-028)
packages/*               Shared libraries (@repo/*)
supabase/                Postgres migrations and project config
infra/*                  Firebase wind-down, GCP, GitHub scaffolding
```

Do not add deployable microservices beyond this set. See ADR-005 in the
repository.

## Data plane

**Product system of record** is Supabase Postgres (`blackstory-app`), with
schema and migrations under `supabase/migrations/` and
`docs/data/postgres-schema.md`. Decision record: ADR-020.

Public and admin apps read with `PUBLIC_DATA_SOURCE=postgres` /
`ADMIN_DATA_SOURCE=postgres`. Published developer reads may use PostgREST views
(ADR-026). Blobs: Supabase Storage for `public-media` with GCS dual-serve during
wind-down. Firestore is export/rollback only
(`docs/data/firebase-wind-down.md`).

Local PostGIS under `infra/database/` is parked scaffolding, not the production
path. Cloud SQL and SQL Connect are permanently non-path (ADR-002 / ADR-003
superseded).

## Boundaries

| Concern | Rule |
|---------|------|
| Canonical write | Never from anonymous or public clients |
| Public read | Released projections / immutable snapshots only |
| Promotion | Required before any submission becomes public |
| Research / LLM | Cannot publish; public render never calls an LLM |
| Living persons | No public residential addresses; unknown living status treated as living |
| External URLs | Untrusted; no synchronous fetch in user requests |
| Product policy | Versioned constitution only; not mutable via public endpoints |

## Product constitution

Shared policy lives in `packages/schemas/constitution/policy.v1.json`. TypeScript
loads it through `@repo/schemas`. Python workers load the same JSON through
`black_book_constitution`. Thresholds and living-person rules change by version
bump, not by an HTTP write API.

## Formal decisions

Architecture decision records live in the repository under `docs/adr/`. This
site's [Architecture decisions](./adrs.md) guide lists selected topics.
