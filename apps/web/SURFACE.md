# Web surface contract

`apps/web` hosts the public site and the staff workbench on Vercel. The project root directory
is `apps/web`; runtime configuration comes from Vercel environment variables and `next.config.ts`.
Production origin: `https://blackstory.app`.

## Data and authorization

Public routes read active released projections through server-side Postgres readers, release
artifacts and the public API. They cannot mutate canonical entities, research or publication state.
Private source captures are never public merely because a record cites their source.

Staff pages live under `src/app/admin`; staff auth, data access and components live under
`src/admin`. `src/proxy.ts` checks the Supabase session and `app_metadata.app_role`.
Server mutations must independently authorize the operation. `ADMIN_DATABASE_URL` is a separate
credential restricted to `src/admin`, enforced by `canonical-write-boundary.test.ts`.
Shared UI belongs in `packages/ui`; shared domain behavior belongs in `packages/domain`.

## Operations

`MAINTENANCE_MODE=1` returns an edge-served 503 after redeployment. See the
[maintenance runbook](../../docs/runbooks/maintenance-mode.md) for bypass and limits.
A production branch merge can trigger Vercel deployment. Coordinate database and application
changes before merging an incompatible schema change.

- [Architecture](../../docs/architecture.md)
- [Service boundaries](../../docs/security/service-surfaces.md)
- [Vercel deployment](../../docs/runbooks/vercel-public-web-cutover.md)
