<!--
  ADR-027: Public apps/web hosting on Vercel. DNS hard-cut completed 2026-07-22;
  App Hosting remains idle rollback during soak/wind-down.
-->

# ADR-027: Vercel for public web hosting

- **Status:** Accepted (DNS hard-cut complete 2026-07-22)
- **Date:** 2026-07-22
- **Depends on:** ADR-004, ADR-005, ADR-006, ADR-010, ADR-020
- **Amends / partially supersedes:** ADR-001 §Decision.1 (public web host target)
- **Does not supersede:** ADR-001 for admin/API Cloud Run boundaries; ADR-006 controlled promote model (adapted to Vercel Preview → Production promote)

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| Public web host | **Vercel** project `blackstory` (Root Directory `apps/web`) | Same |
| Production DNS (`blackstory.app`) | Points at Vercel | Same |
| App Hosting (`apps/web`) | Idle rollback / soak | Retire after wind-down checklist |
| Admin console | Off public Vercel project | Unchanged |
| Public/read APIs | Cloud Run | Unchanged |

## Context

ADR-001 originally chose Firebase App Hosting for Next.js beside Firebase-linked surfaces.
Product SoR and auth moved to Supabase (ADR-020). Owner direction: Vercel for `apps/web`
without collapsing admin/API trust boundaries onto the public project. Preview soak completed;
DNS hard-cut landed 2026-07-22 (see `docs/runbooks/vercel-public-web-cutover.md`).

## Decision

1. **Public web (`apps/web`) production host is Vercel** (team `geraldmarons-projects`, project
   `blackstory`, Root Directory `apps/web`, Node 22).
2. **Admin and all `api-*` surfaces stay off this Vercel project** — Cloud Run (+ IAP for admin)
   remains binding (ADR-001 / ADR-005).
3. **App Hosting configs may remain** as idle rollback until the owner completes soak/wind-down.
   Next `output: 'standalone'` applies when `VERCEL` is unset so App Hosting images still build.
4. **Controlled promotion:** Preview deployments are the default validation surface. Production
   promote is explicit (CLI/`vercel promote` or dashboard), analogous to ADR-006’s no-auto-prod
   rule.
5. **Secrets** (`DATABASE_URL`, `SENTRY_DSN`, …) live in Vercel project env (Preview vs
   Production scopes). No secret values in git.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Host admin on the same Vercel project | Collapses IAP / privileged trust boundary onto the public web surface |
| Delete App Hosting configs immediately on cut day | Removes dual-run rollback during soak |
| Root Directory `apps/admin` | Wrong surface; public product is `@repo/web` |

## Consequences

- Operators manage Vercel as live public web; App Hosting only as rollback until retired.
- README / architecture tables list Vercel as public-web host.

## Rollback

1. Keep App Hosting backend able to serve last-known-good revision while it remains configured.
2. Repoint DNS to App Hosting / prior records if Vercel is unavailable.
3. Leave Vercel project intact for diagnosis; do not delete during soak.
