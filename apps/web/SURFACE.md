# Public web surface contract (BB-021)

This app is the **public UI** surface. It is deployed via Firebase App Hosting, not Cloud Run.

## Binding

| Item | Value |
|------|-------|
| Surface id | `web` |
| Runtime | Firebase App Hosting |
| Config | `apphosting.yaml`, `apphosting.production.yaml`, `apphosting.staging.yaml` |
| Proposed backend | `black-book-web-production` |
| Runtime SA | `web-runtime@black-book-efaaf.iam.gserviceaccount.com` |
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
logic belongs in `packages/domain`.

## References

- [ADR-005](../../docs/adr/ADR-005-service-surface-separation.md)
- [Service surfaces](../../docs/security/service-surfaces.md)
- [Surface matrix](../../infra/gcp/surfaces/surface-matrix.json)
