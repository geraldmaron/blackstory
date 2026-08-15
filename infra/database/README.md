# Database infrastructure — SUPERSEDED FOR PRODUCT SoR (ADR-020)

> **ADR-020 (2026-07-20, removed 2026-07-24):** Product system-of-record design and DDL now target
> **Supabase Postgres** project **`blackstory-app`** (`twykhihqkcldpreuovay`). See
> `docs/data/postgres-schema.md`, `docs/data/firebase-wind-down.md`, and `supabase/migrations/`.
>
> **Cloud SQL / PostGIS / Firebase SQL Connect** under this directory remain **parked /
> non-production**. Do **not** provision a paid Cloud SQL instance for the current phase.
>
> **2026-08-14 correction:** the line below originally read "Firestore on `black-book-efaaf`
> remains the live store until a separate cutover bead" — that cutover is now complete. Per
> `docs/data/firebase-wind-down.md`: "Structured SoR is Postgres (ADR-020); Firestore has no live
> database, rules, or indexes left — repo-side config is fully removed, not just export/rollback
> only." Supabase Postgres is the live store; `infra/firebase/` is retained only as bounded
> history/backup-tooling reference (firebase-wind-down.md), not a live deploy target.

Historical BB-012 notes below remain accurate as a description of the parked artifacts.

---

# Database infrastructure (BB-012) — parked

Local PostGIS, role/grant foundation, pool budgets, Cloud SQL design, and Firebase
**SQL Connect** (CLI namespace `dataconnect:*`; formerly Data Connect) templates.

## Status

| Path | Status |
|------|--------|
| Supabase DDL / schema design | **Live** — `supabase/`, ADR-020 |
| Firestore model / rules | **Retired (2026-08-14 correction)** — no live database, rules, or indexes left; `infra/firebase/` retained as history/backup reference only |
| Local PostGIS compose / init | Optional / deferred experiments |
| SQL Connect templates | Parked; do not block beads or CI |
| Cloud SQL instance | **Do not create** (cost gate; superseded by Supabase target) |

## Product naming (parked SQL Connect)

| Name in docs / PDF | Firebase CLI / config today |
|--------------------|-----------------------------|
| Firebase SQL Connect | Help text + product docs (`firebase.google.com/docs/sql-connect`) |
| Firebase Data Connect | Historical name; npm packages / some Admin SDK paths still say `data-connect` |
| CLI commands | `firebase dataconnect:*`, `firebase init dataconnect` |

Verified locally with Firebase CLI **15.17.0** (`firebase-tools` in repo). Commands used:

- `firebase dataconnect:compile`
- `firebase dataconnect:sdk:generate`
- `firebase dataconnect:sql:setup` (Cloud SQL — blocked / deferred)
- `firebase dataconnect:services:list`

## Local PostGIS (optional)

```bash
pnpm db:up
pnpm db:status
# First boot runs infra/database/init/* via docker-entrypoint.
# If the volume already existed before BB-012, apply manually:
pnpm db:init
pnpm db:verify
pnpm db:down
```

Credentials in compose / `.env.example` are **local-only**. Optional pooler:

```bash
docker compose -f infra/database/docker-compose.yml --profile pool up -d
```

## Roles and isolation (parked)

See [ROLE_MATRIX.md](./ROLE_MATRIX.md). SQL:

| Script | Purpose |
|--------|---------|
| `init/00-extensions.sql` | PostGIS, pg_trgm, pgcrypto, uuid-ossp |
| `init/10-schemas.sql` | `bb_*` schemas |
| `init/20-roles.sh` | Login roles |
| `init/25-boundary-stubs.sql` | Stub tables for grant tests |
| `init/30-grants.sql` | Least-privilege grants + revokes |
| `init/40-timeouts-and-limits.sql` | statement/lock/idle timeouts + CONNECTION LIMIT |
| `init/90-verify.sql` | Extension/role presence |
| `init/91-isolation-checks.sql` | Privilege negative/positive tests |

## Cloud SQL

Design only — **do not provision**: [cloud-sql/PRODUCTION.md](./cloud-sql/PRODUCTION.md).

## SQL Connect templates (parked)

Self-contained Firebase config (does not modify BB-011 `infra/firebase/`):

```bash
pnpm db:sql-connect:compile
pnpm db:sql-connect:sdk
```

Connectors live under `sql-connect/dataconnect/connectors/*`. Every operation uses
`@auth(level: NO_ACCESS)` and generates **Admin Node SDK only** (no browser SDK).

## Package

`@repo/data-access` — Firestore access guards (primary) + parked Postgres/SQL Connect
helpers. Public web cannot depend on it (`pnpm validate:boundaries`). See
`packages/data-access/DEFERRED.md`.
