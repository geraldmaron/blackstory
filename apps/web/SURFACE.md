# Public web surface contract

This app is the **public UI** surface. It is deployed via **Vercel**, not Cloud Run or App Hosting.

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

`apps/admin` is a **separate Next.js deployable** on port 3001 locally. Do not add admin route
handlers or research console pages to this app. Shared UI belongs in `packages/ui`; shared domain
logic belongs in `packages/domain`. Admin interim host is App Hosting (`black-book-admin-production`);
target is Cloud Run + IAP.

## References

- [ADR-005](../../docs/adr/ADR-005-service-surface-separation.md)
- [ADR-027](../../docs/adr/ADR-027-vercel-public-web-hosting.md)
- [Service surfaces](../../docs/security/service-surfaces.md)
- [Surface matrix](../../infra/gcp/surfaces/surface-matrix.json)
