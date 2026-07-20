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
apps/web                 Public Next.js
apps/admin               Private admin / research
apps/api-public          Public read / search / location
apps/api-submissions     Corrections / contribution intake
apps/api-internal        Publication / promotion (private)
workers/*                Research, publication, security
packages/*               Shared libraries
```

## Data plane

**Cloud Firestore** is the system of record, with blobs in Firebase Storage /
GCS. Local PostGIS and SQL Connect scaffolding under `infra/database/` are
parked — not the production path.

## Boundaries

| Concern | Rule |
|---------|------|
| Canonical write | Never from anonymous or public clients |
| Public read | Released projections / immutable snapshots only |
| Promotion | Required before any submission becomes public |
| Research / LLM | Cannot publish; public render never calls an LLM |
| Living persons | No public residential addresses; unknown living status ⇒ living |
| External URLs | Untrusted; no synchronous fetch in user requests |

Formal decisions live in the repository under `docs/adr/`.
