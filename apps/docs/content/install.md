---
title: Install and bootstrap
description: Clone the monorepo and bring up a reproducible local environment.
nav: start
order: 1
---

# Install and bootstrap

BlackStory is a TypeScript and Python monorepo. Local development does not require
cloud credentials. If you want the product story first, start with
[Why BlackStory](./about.md).

## Prerequisites

- Node.js 22+ (`nvm use` from `.nvmrc`)
- [pnpm](https://pnpm.io/) 9.x
- [uv](https://docs.astral.sh/uv/) (Python 3.12+)
- Docker for isolated local Supabase database and migration checks

## Bootstrap

```bash
git clone https://github.com/geraldmaron/blackstory.git
cd blackstory
./scripts/bootstrap.sh
# or
pnpm bootstrap
```

Copy [`.env.example`](https://github.com/geraldmaron/blackstory/blob/main/.env.example)
for documented local configuration. Do not put production secrets in the
working tree.

## Validate

```bash
pnpm validate
pnpm test:preflight
pnpm test
```

Build and typecheck (APIs consume built package declarations):

```bash
pnpm build && pnpm typecheck
```

## Run the public web app

```bash
pnpm dev:web
# http://localhost:3048/
# http://localhost:3048/explore
```

Live catalog pages require Postgres and a released catalog. Configure `PUBLIC_DATA_SOURCE=postgres`
and a local `DATABASE_URL`; they do not silently fall back to sample records. Editorial pages
such as `/about` and `/methodology` can render without a database.

## This docs site

```bash
pnpm --filter @repo/docs dev
# http://localhost:3050/
```

Production-shaped static export for GitHub Pages:

```bash
DOCS_BASE_PATH=/blackstory pnpm --filter @repo/docs build
# or from the monorepo root:
pnpm docs:publish
```

## Next

- [Repository map](./repo-map.md)
- [Architecture](./architecture.md)
- [Commands cheat sheet](./commands.md)
