# Service surface separation (BB-021)

**Status:** Design + runtime contracts implemented in-repo. Cloud ingress, IAP, and per-surface deploy
jobs remain human provisioning steps (see [`infra/gcp/surfaces/README.md`](../../infra/gcp/surfaces/README.md)).

**ADR:** [ADR-005](../adr/ADR-005-service-surface-separation.md)  
**Data store:** Firestore system of record ([ADR-011](../adr/ADR-011-firestore-system-of-record.md))

## Threat model summary

| Compromise scenario | Must not gain |
|---------------------|---------------|
| Anonymous / public API traffic | Canonical writes, publication, quarantine reads |
| Submissions API | Publication, canonical writes, evidence reads |
| Public web bundle | Admin routes, internal APIs, publish helpers |
| End-user Firebase token on internal API | Any internal publication call |
| Admin session without IAP | Console access |

## Deployable surfaces

### Public web (`apps/web`)

- **Hosting:** Firebase App Hosting (`apps/web/apphosting.yaml`)
- **Posture:** `public-cdn` — serves released public projections only
- **SA:** `web-runtime@black-book-efaaf.iam.gserviceaccount.com`
- **Contract:** [`apps/web/SURFACE.md`](../../apps/web/SURFACE.md)

### Public read API (`apps/api-public`)

- **Hosting:** Cloud Run, public ingress with Armor
- **Posture:** `public-read` — read/search/location only
- **Runtime guards:** `apps/api-public/src/posture.ts`
- **Health contract:** `health()` returns `surface`, `networkPosture`, `allowedOperations`

### Submissions API (`apps/api-submissions`)

- **Hosting:** Cloud Run, public ingress with strict rate limits
- **Posture:** `public-rate-limited` — quarantine writes + submission metadata only
- **Invariant:** cannot call `publish:projection` or `promote:release` (typed deny)
- **Runtime guards:** `apps/api-submissions/src/posture.ts`

### Internal publication API (`apps/api-internal`)

- **Hosting:** Cloud Run, **no public internet ingress**
- **Posture:** `private-network` — publication and promotion
- **Auth:** `service-identity` only; **rejects** `end-user-token` and `anonymous`
- **Runtime guards:** `apps/api-internal/src/posture.ts`

### Admin console (`apps/admin`)

- **Hosting:** Cloud Run behind IAP + app-level authorization
- **Posture:** `iap-protected` — separate Next.js app from `apps/web`
- **Invariant:** no imports from `apps/web` handlers (see `apps/admin/src/surface.test.ts`)
- **SA:** `admin@black-book-efaaf.iam.gserviceaccount.com`

## Typed capability matrix

Source of truth:

- **Runtime TypeScript:** `packages/config/src/surfaces.ts`
- **Infra JSON:** `infra/gcp/surfaces/surface-matrix.json`
- **IAM / SA names:** `infra/gcp/isolation-matrix.json`, `infra/gcp/service-accounts.matrix.md`

Each API `health()` response includes:

```json
{
  "service": "api-public",
  "surface": "api-public",
  "networkPosture": "public-read",
  "allowedOperations": ["read:public-projections", "read:search", "read:location"],
  "status": "ok",
  "env": "production"
}
```

Fail-closed helpers throw `SurfaceCapabilityError` when a surface attempts a forbidden operation or
accepts a forbidden auth mode.

## Acceptance mapping

| Criterion | Evidence |
|-----------|----------|
| Submissions cannot publish | `packages/config/src/surfaces.test.ts`, `apps/api-submissions/src/index.test.ts` |
| Public API cannot write canonical data | `packages/config/src/surfaces.test.ts`, `apps/api-public/src/index.test.ts` |
| Admin separate from public web | `apps/admin/src/surface.test.ts`, distinct app path + SA in matrix |
| Internal API rejects end-user tokens | `packages/config/src/surfaces.test.ts`, `apps/api-internal/src/index.test.ts` |

## Related docs

- [Environment isolation](./environment-isolation.md) (BB-005)
- [GCP isolation matrices](../../infra/gcp/README.md)
- [WIF deploy identity](../../infra/gcp/wif/README.md)
