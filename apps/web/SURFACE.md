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

Denied at this surface:

- Canonical Firestore writes
- Quarantine or submission writes (use `api-submissions`)
- Publication or release activation (use `api-internal` via service identity)
- Admin or research console routes (use `apps/admin` behind IAP)

Typed definitions: `packages/config/src/surfaces.ts` (`web` entry).

## Separation from admin

`apps/admin` is a **separate Next.js deployable** on port 3001 locally and a separate Vercel
project in production. Do not add admin route handlers or research console pages to this app.
Shared UI belongs in `packages/ui`; shared domain logic belongs in `packages/domain`. Firebase
App Hosting `black-book-admin-production` and its Cloud Run twin were deleted; do not recreate
them.

## Maintenance mode

The whole surface can be parked behind an edge-served 503 with `MAINTENANCE_MODE=1` on the Vercel
Production environment plus a redeploy — no function boots and no `bb_public` query runs while it
is up. Procedure, bypass, and limits: [maintenance mode runbook](../../docs/runbooks/maintenance-mode.md).

## References

- ADR-005 (service surface separation) and ADR-027 (Vercel public web hosting) — removed
  2026-07-24, see `docs/decisions-carryover.md` and `git log -- docs/adr/`
- [Service surfaces](../../docs/security/service-surfaces.md)
- [Surface matrix](../../infra/gcp/surfaces/surface-matrix.json)
