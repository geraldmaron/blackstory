# Public web surface contract

This app is the **public UI** surface. It is deployed via **Vercel**, not Cloud Run or
Firebase App Hosting. Verified 2026-08-28 against live blackstory.app (`x-vercel-id`,
`x-vercel-cache`).

## Binding

| Item | Value |
|------|-------|
| Surface id | `web` |
| Runtime | Vercel (project `blackstory`, Root Directory `apps/web`) |
| Config | Vercel project env + `apps/web/next.config.*` |
| Production URL | `https://blackstory.app` |
| Runtime SA | N/A (Vercel serverless; DB via `DATABASE_URL` env) |
| Network posture | Public CDN |

## Capabilities

Allowed (via server components / BFF calls to `api-public`):

- Read released public projections
- Search and location discovery (delegated to public read API)

Denied at this surface, for every route outside `/admin`:

- Canonical Firestore writes
- Quarantine or submission writes (use `api-submissions`)
- Publication or release activation (use `api-internal` via service identity)
- Canonical Postgres writes (the `ADMIN_DATABASE_URL` credential is never read outside `src/admin/**` — see `canonical-write-boundary.test.ts`)

`/admin` is the one route group that is exempt from the list above: it is a staff-gated
workbench (entity canon, research cases, publication staging) behind `src/middleware.ts` and a
Supabase session + `app_metadata.bb_role` check. See "Separation from admin" below.

Typed definitions: `packages/config/src/surfaces.ts` (`web` entry).

## Admin (`/admin`)

As of 2026-09-11, admin routes live inside this app — `src/app/admin/**` for pages,
`src/admin/**` for everything else (auth, data access, components), namespaced under one
directory specifically so it stays legible as a distinct thing even though it's one app now.
It was a separate Next.js deployable on port 3001 with its own Vercel project before this; that
separation existed for DB credential isolation, which is now enforced by `ADMIN_DATABASE_URL`
being a distinct credential that only `src/admin/**` ever reads
(`src/admin/canonical-write-boundary.test.ts`), not by being a separate process. See
`docs/security/service-surfaces.md`.

Shared UI still belongs in `packages/ui`; shared domain logic still belongs in
`packages/domain`. Firebase App Hosting `black-book-admin-production` and its Cloud Run twin
were deleted before the Vercel move and were never recreated — don't recreate them now either.

## Maintenance mode

The whole surface can be parked behind an edge-served 503 with `MAINTENANCE_MODE=1` on the Vercel
Production environment plus a redeploy — no function boots and no `bb_public` query runs while it
is up. Procedure, bypass, and limits: [maintenance mode runbook](../../docs/runbooks/maintenance-mode.md).

## References

- ADR-005 (service surface separation) and ADR-027 (Vercel public web hosting) — removed
  2026-07-24, see `docs/decisions-carryover.md` and `git log -- docs/adr/`
- [Service surfaces](../../docs/security/service-surfaces.md)
- [Surface matrix](../../infra/gcp/surfaces/surface-matrix.json)
