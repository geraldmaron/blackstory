---
title: Commands cheat sheet
description: Everyday pnpm and bootstrap commands for contributors.
nav: reference
order: 1
---

# Commands cheat sheet

```bash
pnpm bootstrap          # reproducible JS + Python envs
pnpm validate           # boundaries, lint, governance
pnpm format:check
pnpm test:preflight     # fail closed on production identifiers
pnpm test               # preflight + JS + Python
pnpm build
pnpm build && pnpm typecheck

pnpm --filter @repo/web build
pnpm --filter @repo/docs dev
DOCS_BASE_PATH=/blackstory pnpm --filter @repo/docs build

pnpm firebase:emulators
pnpm firebase:test:rules
```

Full command list: repository root `README.md`.
