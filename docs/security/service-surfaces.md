# Service surface separation

**Status:** Design + runtime contracts implemented in-repo. Cloud ingress, IAP, and per-surface deploy
jobs remain human provisioning steps (see [`infra/gcp/surfaces/README.md`](../../infra/gcp/surfaces/README.md)).

**ADR:** [ADR-005](../adr/ADR-005-service-surface-separation.md)
**Data store:** Firestore system of record ([ADR-011](../adr/ADR-011-firestore-system-of-record.md))

## Threat model summary

| Compromise scenario | Must not gain |
|---------------------|---------------|
| Anonymous / public API traffic | Canonical writes, publication, quarantine reads |
| Submissions API | Publication, canonical writes, evidence reads |
| A bug in public (non-`/admin`) code inside the `apps/web` bundle | The `ADMIN_DATABASE_URL` write-capable credential, internal APIs, publish helpers |
| End-user Firebase token on internal API | Any internal publication call |
| `/admin` request without a valid Supabase session + staff `app_metadata.bb_role` | Console access |

Admin moved from a separate Vercel deployable into `/admin` routes inside `apps/web` (2026-09-11;
see `docs/decisions-carryover.md`). "Public web bundle must not gain admin routes" is no longer
the boundary — admin routes are now *in* that bundle by design. What still has to hold is
credential scope: `apps/web/src/admin/lib/canonical-postgres-client.ts` reads a distinct
`ADMIN_DATABASE_URL`, never the public `DATABASE_URL`, and nothing outside
`apps/web/src/admin/**` may import it —
enforced by `apps/web/src/admin/canonical-write-boundary.test.ts`.

## Deployable surfaces

### Public web (`apps/web`)

- **Hosting:** Vercel (project `blackstory`, Root Directory `apps/web`) — ADR-027
- **Posture:** `public-cdn` — serves released public projections only
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

### Admin console (`/admin` inside `apps/web`)

- **Hosting:** Vercel, same project (`blackstory`) and deployment as the public site — folded in 2026-09-11. Was previously a standalone Vercel project (`apps/admin`, since 2026-07-25 — see [firebase wind-down](../data/firebase-wind-down.md)) kept separate specifically for DB credential isolation; that isolation is now enforced by credential scope instead of by process — see the threat model above.
- **Posture:** staff-gated route group — `apps/web/src/middleware.ts` matches only `/admin/:path*` and requires a valid Supabase session with `app_metadata.bb_role` set (`apps/web/src/admin/proxy.ts`). `/admin/api/**` authenticates by bearer token instead (`apps/web/src/admin/auth/request-auth.ts`).
- **Invariant:** only `apps/web/src/admin/**` may import the write-capable `canonical-postgres-client.ts` / `canonical-write.ts` (see `apps/web/src/admin/canonical-write-boundary.test.ts`). The old "no imports from apps/web" invariant is retired — admin routes are now part of apps/web by design.
- **SA:** N/A — Vercel serverless, same as `apps/web` (see that entry above); the `admin@black-book-efaaf.iam.gserviceaccount.com` GCP service account predates the Vercel move and is not used by this surface.

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
| Admin write-capable credential scoped to `/admin` code only | `apps/web/src/admin/canonical-write-boundary.test.ts`, `apps/web/src/middleware.ts` matcher |
| Internal API rejects end-user tokens | `packages/config/src/surfaces.test.ts`, `apps/api-internal/src/index.test.ts` |

## Related docs

- [Environment isolation](./environment-isolation.md)
- [GCP isolation matrices](../../infra/gcp/README.md)
- [WIF deploy identity](../../infra/gcp/wif/README.md)
