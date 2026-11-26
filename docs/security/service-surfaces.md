# Service surface separation

**Status:** Runtime capability and authorization contracts are implemented in-repo. The product runs on Vercel,
Cloudflare, Supabase Auth, Supabase Postgres, and Supabase Storage.

**Authority:** [Architecture](../architecture.md) and the typed capability matrix below.
**Data store:** Supabase Postgres; see [architecture](../architecture.md).

## Threat model summary

| Compromise scenario | Must not gain |
|---------------------|---------------|
| Anonymous / public API traffic | Canonical writes, publication, quarantine reads |
| Submissions API | Publication, canonical writes, evidence reads |
| A bug in public (non-`/admin`) code inside the `apps/web` bundle | The `ADMIN_DATABASE_URL` write-capable credential, internal APIs, publish helpers |
| End-user token on internal API | Any internal publication call |
| `/admin` request without a valid Supabase session + staff `app_metadata.app_role` | Console access |

Admin moved from a separate Vercel deployable into `/admin` routes inside `apps/web` (2026-09-11;
see `docs/decisions-carryover.md`). "Public web bundle must not gain admin routes" is no longer
the boundary — admin routes are now *in* that bundle by design. What still has to hold is
credential scope: `apps/web/src/admin/lib/canonical-postgres-client.ts` reads a distinct
`ADMIN_DATABASE_URL`, never the public `DATABASE_URL`, and nothing outside
`apps/web/src/admin/**` may import it —
enforced by `apps/web/src/admin/canonical-write-boundary.test.ts`.

## Deployable surfaces

### Public web (`apps/web`)

- **Hosting:** Vercel (project `blackstory`, Root Directory `apps/web`) — `../decisions-carryover.md`, "Small recovered decisions", ADR-027 entry
- **Posture:** `public-cdn` — serves released public projections only
- **Contract:** [`apps/web/SURFACE.md`](../../apps/web/SURFACE.md)

### Public read API (`apps/api-public`)

- **Hosting:** Vercel function deployment (`apps/api-public/vercel.json`); any Cloud Run posture in
  optional GCP files is a design target, not a live-resource assertion
- **Posture:** `public-read` — read/search/location only
- **Runtime guards:** `apps/api-public/src/posture.ts`
- **Health contract:** `health()` returns `surface`, `networkPosture`, `allowedOperations`

### Submissions and internal surfaces

The standalone `apps/api-submissions` and `apps/api-internal` apps were never deployed and were
removed on 2026-11-18. Public intake runs as `apps/web` routes (`/corrections/api`, `/submit/api`)
that write to quarantine only; publication runs from `/admin` and the operator scripts. The
`api-submissions` and `api-internal` surface ids stay in `packages/config` as policy vocabulary.

### Admin console (`/admin` inside `apps/web`)

- **Hosting:** Vercel, shared `apps/web` deployment. Credential scope and server authorization separate public reads from staff writes.
- **Posture:** staff-gated route group — `apps/web/src/proxy.ts` matches only `/admin/:path*` and
  requires a valid Supabase session with trusted `app_metadata.app_role`
  (`apps/web/src/admin/admin-auth-gate.ts`). `/admin/api/**` authenticates by bearer token
  (`apps/web/src/admin/auth/request-auth.ts`). There is no Firebase or IAP requirement in the
  current route authorizer; MFA and recent reauthentication are also not enforced.
- **Invariant:** only `apps/web/src/admin/**` may import the write-capable `canonical-postgres-client.ts` / `canonical-write.ts` (see `apps/web/src/admin/canonical-write-boundary.test.ts`). The old "no imports from apps/web" invariant is retired — admin routes are now part of apps/web by design.

## Typed capability matrix

Source of truth for logical capability checks:

- **Runtime TypeScript:** `packages/config/src/surfaces.ts`

The active contract uses `staff-session` / `staff-authenticated` for administration and
`service-identity` / `service-authenticated` for internal operations. Neither value asserts
network isolation. Admin session verification and trusted role checks are described in
[admin identity](./admin-identity.md).

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
| Submissions cannot publish | `packages/config/src/surfaces.test.ts`, `apps/web/src/app/corrections/api/route.test.ts` |
| Public API cannot write canonical data | `packages/config/src/surfaces.test.ts`, `apps/api-public/src/index.test.ts` |
| Admin write-capable credential scoped to `/admin` code only | `apps/web/src/admin/canonical-write-boundary.test.ts`, `apps/web/src/proxy.ts` matcher |

## Related docs

- [Environment isolation](./environment-isolation.md)
