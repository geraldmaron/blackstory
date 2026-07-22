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
- Docker optional for the parked local PostGIS under `infra/database/`

## Bootstrap

```bash
git clone https://github.com/geraldmaron/blackstory.git
cd blackstory
./scripts/bootstrap.sh
# or
pnpm bootstrap
```

Copy [`.env.example`](https://github.com/geraldmaron/blackstory/blob/main/.env.example)
for local emulator-oriented placeholders. Do not put production secrets in the
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

The preferred launcher keeps `PUBLIC_DATA_SOURCE` and `DATABASE_URL` coherent.
Without a Postgres URL you get the small Dunbar seed catalog. With Postgres
configured you see the live released catalog.

## Firebase emulators (optional)

```bash
pnpm firebase:emulators
pnpm firebase:test:rules
```

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
