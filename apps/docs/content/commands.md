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

pnpm dev:web            # public web on :3048
pnpm --filter @repo/docs dev
pnpm docs:publish       # static export into repo docs/ for GitHub Pages

pnpm --filter @repo/web build
pnpm --filter @repo/admin build
pnpm --filter @repo/api-public build

pnpm firebase:emulators
pnpm firebase:test:rules
```

Full command list and project overview: repository root `README.md`.
