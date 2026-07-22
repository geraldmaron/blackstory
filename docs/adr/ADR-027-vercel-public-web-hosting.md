<!--
  ADR-027: Public apps/web hosting on Vercel. DNS hard-cut completed 2026-07-22;
  public web App Hosting configs retired in-repo; soak closed.
-->

# ADR-027: Vercel for public web hosting

- **Status:** Accepted (DNS hard-cut complete 2026-07-22)
- **Date:** 2026-07-22
- **Amended:** 2026-07-22
- **Depends on:** ADR-004, ADR-005, ADR-006, ADR-010, ADR-020
- **Amends / partially supersedes:** ADR-001 §Decision.1 (public web host target)
- **Does not supersede:** ADR-001 for admin/API Cloud Run boundaries; ADR-006 controlled promote model (adapted to Vercel Preview → Production promote)

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| Public web host | **Vercel** project `blackstory` (Root Directory `apps/web`) | Same |
| Production DNS (`blackstory.app`) | Points at Vercel | Same |
| App Hosting (`apps/web`) | **Retired** — backends `black-book-web-*` deleted 2026-07-22 | No public web App Hosting |
| Admin console | App Hosting (`black-book-admin-production`) until Cloud Run + IAP | Cloud Run + IAP |
| Public/read APIs | Cloud Run | Unchanged |

## Context

ADR-001 originally chose Firebase App Hosting for Next.js beside Firebase-linked surfaces.
Product SoR and auth moved to Supabase (ADR-020). Owner direction: Vercel for `apps/web`
without collapsing admin/API trust boundaries onto the public project. Preview soak completed;
DNS hard-cut landed 2026-07-22 (see `docs/runbooks/vercel-public-web-cutover.md`).
Public web App Hosting configs were removed from the repo after soak closed; Vercel is the sole
public web host.

## Decision

1. **Public web (`apps/web`) production host is Vercel** (team `geraldmarons-projects`, project
   `blackstory`, Root Directory `apps/web`, Node 22).
2. **Admin and all `api-*` surfaces stay off this Vercel project** — Cloud Run (+ IAP for admin)
   remains binding (ADR-001 / ADR-005). Admin may temporarily use App Hosting
   (`apphosting.admin.yaml`, backend `black-book-admin-production`) until Cloud Run + IAP cutover.
3. **Public web App Hosting is retired** (configs removed; Firebase backends deleted).
   `apps/web` builds for Vercel only (no `output: 'standalone'`).
4. **Controlled promotion:** Preview deployments are the default validation surface. Production
   promote is explicit (CLI/`vercel promote` or dashboard), analogous to ADR-006’s no-auto-prod
   rule. Git-connected Vercel deploys from `main` but Production traffic moves only through
   explicit promote or a pinned redeploy — not unattended auto-prod without amending ADR-006.
5. **Secrets** (`DATABASE_URL`, `SENTRY_DSN`, …) live in Vercel project env (Preview vs
   Production scopes). No secret values in git.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Host admin on the same Vercel project | Collapses IAP / privileged trust boundary onto the public web surface |
| Keep idle App Hosting rollback for public web | Soak closed; dual-run adds operator confusion and stale config drift |
| Root Directory `apps/admin` | Wrong surface; public product is `@repo/web` |

## Consequences

- Operators manage Vercel as the live public web host; no App Hosting promote path for `apps/web`.
- README / architecture tables list Vercel as public-web host.
- Firebase backends `black-book-web-production` and `black-book-web-staging` were deleted 2026-07-22;
  only admin App Hosting remains (see `docs/data/firebase-wind-down.md`).

## Rollback

1. **Vercel rollback (primary):** Promote or redeploy the prior known-good Production deployment
   SHA via Vercel dashboard or `vercel promote <deployment-url>`.
2. **Emergency host change:** Repoint DNS only if Vercel is unavailable; do not re-enable deleted
   App Hosting backends as the default path — rebuild on Cloud Run or a fresh Vercel deploy from
   a known-good git SHA instead.
3. Leave the Vercel project intact for log forensics during any incident.
