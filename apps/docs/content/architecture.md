---
title: Architecture
description: Current stack, surfaces, and non-negotiable boundaries.
nav: concepts
order: 1
---

# Architecture

BlackStory is a place-connected Black history research platform. Public surfaces
serve only released historical projections. Research, evidence, and promotion
stay behind private APIs, workers, and admin tools.

## Current stack (verified 2026-08-28)

Checked against live [blackstory.app](https://blackstory.app/) headers and CSP.
This is the current story. Older notes that still name Firebase App Hosting or
Firestore as the system of record are leftover.

| Layer | Current | Leftover |
|-------|---------|----------|
| Public web | **Vercel** (`x-vercel-id`, `x-vercel-cache`, Vercel Analytics). Cloudflare in front. | Firebase App Hosting, Cloud Run for `apps/web` |
| Data / media | **Supabase** project `blackstory-app`, host `https://twykhihqkcldpreuovay.supabase.co`. Postgres is the product system of record. Public media is Supabase Storage. | Firestore, Firebase Storage as SoR, parked PostGIS |
| Media CSP | Live `img-src` allows the Supabase host **and** `https://storage.googleapis.com` | GCS dual-serve / rollback |

**Live** [blackstory.app](https://blackstory.app/) (verified 2026-08-28) is still
the old catalog filter board (Kind / Tone / Era / Theme / Status / Confidence /
Where), about 4,100 released records. That is production today. It is not yet the
first-run sat below.

**Intended first-run**, sat 2026-08-28 on isolated branch
`cursor/first-paint-local-119c` at localhost:3048 (commit `0dfc8f5a`): Greenwood
first; header rooms are Atlas and Library only; no Journey room; no Grade A; no
"2 sources"; `/?atlas=1` 308s home. That chrome is not live until that isolated
work lands. This site does not invent a Journey page.

`/journey` is not a live room. Apex and www return HTTP 404 (verified 2026-08-28).
Do not list Journey as a room. `/about` already omits unfinished rooms. There is
no public Journey source beyond that 404.

`/records/42Cb1758` is not a published record (HTTP 404, verified 2026-08-28).
Public record pages live at `/entity/<id>`. Live production can still show that
id as a list title. Intended first-run does not. Do not invent the page.

This repository only configures Supabase project `blackstory-app`. Other org Pro
projects are not named in repo config, so unused is not proven here. Aligning
docs on Vercel + Supabase does not close overages or standing bills.

## Surfaces

```
apps/web                 Public Next.js on Vercel (live: blackstory.app)
apps/admin               Private admin / research console (separate Vercel project)
apps/api-public          Public read / search / location (in-repo; Cloud Run deploy unverified)
apps/api-submissions     Corrections / contribution intake (in-repo; Cloud Run deploy unverified)
apps/api-internal        Publication / promotion (in-repo; Cloud Run deploy unverified)
apps/mobile              Expo mobile app (isolated lockfile)
apps/docs                This GitHub Pages site
workers/*                Research, publication, security
packages/*               Shared libraries (@repo/*)
supabase/                Postgres migrations for blackstory-app
infra/*                  Leftover Firebase / GCP scaffolding, parked PostGIS
```

Do not add deployable microservices beyond this set. Historical decision text
is in git (`git log -- docs/adr/`).

## Data plane

**Product system of record** is Supabase Postgres (`blackstory-app`), with
schema and migrations under `supabase/migrations/` and
`docs/data/postgres-schema.md`.

Public and admin apps read with `PUBLIC_DATA_SOURCE=postgres` /
`ADMIN_DATA_SOURCE=postgres` and a server-only `DATABASE_URL`. Published
developer reads may use PostgREST views. Blobs: Supabase Storage for
`public-media`. GCS dual-serve and Firestore export tools are leftover
(`docs/data/firebase-wind-down.md`).

Local PostGIS under `infra/database/` is parked leftover scaffolding, not the
production path. Cloud SQL and SQL Connect are permanently non-path.

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

Architecture decision records were removed from the repository 2026-07-24.
History is in git. Still-binding invariants live in
`docs/decisions-carryover.md`.
