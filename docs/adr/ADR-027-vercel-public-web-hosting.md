<!--
  ADR-027: Move public apps/web hosting from Firebase App Hosting to Vercel.
  Prepares hard cutover; DNS/domain flip is a follow-up operator step, not this ADR.
-->

# ADR-027: Vercel for public web hosting

- **Status:** Accepted (prep; production DNS cutover deferred)
- **Date:** 2026-07-22
- **Bead:** repo-gm3w
- **Depends on:** ADR-004, ADR-005, ADR-006, ADR-010, ADR-020
- **Amends / partially supersedes:** ADR-001 §Decision.1 (public web host target)
- **Does not supersede:** ADR-001 for admin/API Cloud Run boundaries; ADR-006 controlled promote model (adapted to Vercel Preview → Production promote)

## Scaffold vs target

| Aspect | Today (verified) | Target (this decision) |
|--------|------------------|------------------------|
| Public web host | Firebase App Hosting (`apps/web/apphosting*.yaml`) | **Vercel** project `blackstory` (Root Directory `apps/web`) |
| Admin console | Cloud Run + IAP | Unchanged (not on the public Vercel project) |
| Public/read APIs | Cloud Run | Unchanged |
| Production DNS (`blackstory.app`) | App Hosting | Flip only after Preview soak + explicit hard-cut step |

## Context

ADR-001 chose Firebase App Hosting for Next.js delivery beside Firebase-linked surfaces. Product SoR and auth have moved toward Supabase (ADR-020); App Hosting remains operational but is no longer the only credible Next host. Owner direction: prepare Vercel for `apps/web` and hard-cut when Preview is proven — without collapsing admin/API trust boundaries onto the public project.

Migration trigger in ADR-001 (“Move public web off App Hosting only if…”) is satisfied by owner host preference plus dual-run readiness (standard Next build still runs on App Hosting via conditional `standalone`).

## Decision

1. **Public web (`apps/web`) production host target is Vercel** (team `geraldmarons-projects`, project `blackstory`, Root Directory `apps/web`, Node 22).
2. **Admin and all `api-*` surfaces stay off this Vercel project** — Cloud Run (+ IAP for admin) remains binding (ADR-001 / ADR-005).
3. **Dual-run until hard cut:** App Hosting configs remain; Next `output: 'standalone'` applies only when `VERCEL` is unset so App Hosting images keep working during soak.
4. **Controlled promotion:** Preview deployments are the default validation surface. Production promote / domain assignment is explicit (CLI/`vercel promote` or dashboard), analogous to ADR-006’s no-auto-prod rule — do not enable “deploy production on every `main` push” without a separate ADR amendment.
5. **Secrets** (`DATABASE_URL`, `SENTRY_DSN`, …) live in Vercel project env (Preview vs Production scopes). No secret values in git. Local continues via `apps/web/.env.local` / 1Password.
6. **Hard cutover** (point `blackstory.app` / apex DNS at Vercel; freeze App Hosting traffic) is **out of scope** for landing this ADR — tracked as operator runbook + follow-up bead.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Host admin on the same Vercel project | Collapses IAP / privileged trust boundary onto the public web surface |
| Big-bang DNS flip before Preview soak | No rollback evidence; violates controlled-release posture |
| Delete App Hosting configs immediately | Removes dual-run rollback during soak |
| Root Directory `apps/admin` | Wrong surface; public product is `@repo/web` |

## Consequences

- Operators manage Vercel env + App Hosting until DNS cut.
- GitHub App Hosting promote scripts remain valid rollback until wind-down.
- MCP (`https://mcp.vercel.com`) is the preferred agent read path for deployments/logs once OAuth is complete.
- README / architecture tables must list Vercel as public-web target.

## Rollback

1. Keep App Hosting backend serving last-known-good revision.
2. Repoint DNS to App Hosting / prior records.
3. Leave Vercel Preview project intact for diagnosis; do not delete until soak window closes.
