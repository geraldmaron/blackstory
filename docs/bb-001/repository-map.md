# BB-001 — Repository map (quick reference)

Verified tree as of 2026-07-16. Depth shows scaffold presence, not product completeness.

```
black-book/
├── apps/
│   ├── web/                 Next.js public shell (placeholder)
│   ├── admin/               Next.js admin shell (placeholder)
│   ├── api-public/          Health stub + node:test
│   ├── api-submissions/     Health stub + node:test
│   └── api-internal/        Health stub + node:test
├── packages/
│   ├── config/              Zod env helpers (minimal)
│   ├── domain/              EntityId + living-status helper
│   ├── schemas/             Stub export
│   ├── ui/                  Stub (BB-007)
│   ├── firebase/            Stub (BB-011)
│   ├── data-access/         Stub
│   ├── security/            Stub
│   ├── observability/       Stub
│   ├── testing/             Stub
│   ├── eslint-config/       EMPTY
│   └── typescript-config/   EMPTY
├── workers/
│   ├── research/            uv package + pytest health
│   ├── publication/         uv package + pytest health
│   └── security/            uv package + pytest health
├── infra/
│   ├── database/            docker-compose PostGIS 16
│   ├── firebase/            README only
│   ├── gcp/                 README only
│   └── github/workflows/    stub.yml (not under .github/)
├── docs/
│   ├── architecture.md
│   ├── README.md
│   ├── runbooks/            .gitkeep
│   └── bb-001/              this bead
├── scripts/bootstrap.sh
├── package.json             pnpm workspace root scripts
├── pnpm-workspace.yaml      apps/* + packages/*
├── pyproject.toml           uv workspace → workers/*
├── tsconfig.base.json
├── plan.md                  bead tracker
└── README.md
```

**Missing (expected):** `.github/`, `firebase.json`, `.firebaserc`, `apphosting.yaml`, remote git origin.

**Present after bootstrap:** `pnpm-lock.yaml`, `uv.lock`.
