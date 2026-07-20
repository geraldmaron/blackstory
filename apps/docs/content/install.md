---
title: Install and bootstrap
description: Clone the monorepo and bring up a reproducible local environment.
nav: start
order: 1
---

# Install and bootstrap

BlackStory is a TypeScript + Python monorepo. Local development does not require
cloud credentials.

## Prerequisites

- Node.js 22+ (`nvm use` from `.nvmrc`)
- [pnpm](https://pnpm.io/) 9.x
- [uv](https://docs.astral.sh/uv/) (Python 3.12+)

## Bootstrap

```bash
git clone https://github.com/geraldmaron/blackstory.git
cd blackstory
./scripts/bootstrap.sh
# or
pnpm bootstrap
```

Copy [`.env.example`](https://github.com/geraldmaron/blackstory/blob/main/.env.example)
for local emulator-oriented Firebase placeholders.

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

## This docs site

```bash
pnpm --filter @repo/docs dev
```

Production-shaped static export:

```bash
DOCS_BASE_PATH=/blackstory pnpm --filter @repo/docs build
```
