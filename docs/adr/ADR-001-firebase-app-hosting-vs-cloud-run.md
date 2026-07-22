# ADR-001: Firebase App Hosting versus separate Cloud Run services

- **Status:** Accepted
- **Date:** 2026-07-16
- **Bead:**
- **Deciders:** Execution beads platform choices; recorded against scaffold baseline

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| `apps/web` | Next.js scaffold; local `:3000` | Firebase App Hosting |
| `apps/admin` | Next.js scaffold; local `:3001` | Cloud Run + IAP |
| `apps/api-*` | Health stubs only | Separate Cloud Run services |
| Firebase / App Hosting / Cloud Run | Not configured (`infra/firebase`, `infra/gcp` placeholders) | Provisioned in  /  /  |

## Context

BlackStory needs a public Next.js site that can degrade to released snapshots, plus APIs and a private admin console that must not share public route handlers or credentials. Firebase App Hosting is optimized for Firebase-linked Next.js delivery; Cloud Run is the control plane for least-privilege APIs, IAP-protected admin, and private internal services.

## Decision

1. **Public web (`apps/web`)** production host target is **Vercel** (ADR-027). Firebase App Hosting remains the dual-run / rollback path until DNS hard cut.
2. **Admin (`apps/admin`)** and all **API surfaces** (`api-public`, `api-submissions`, `api-internal`) deploy on **Cloud Run**.
3. Automatic App Hosting rollouts are **disabled**; GitHub Actions triggers controlled rollouts (see ADR-006). Vercel production promote stays explicit (ADR-027).
4. Public page rendering does **not** open database connections or invoke models; it reads released projections/snapshots via the public API or static release artifacts (ADR-004).

> **Amendment (2026-07-22):** Decision §1 public-web host superseded by [ADR-027](./ADR-027-vercel-public-web-hosting.md). Admin/API Cloud Run boundaries unchanged.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| All Next.js apps on App Hosting | Admin must sit behind IAP and distinct credentials; App Hosting is the wrong trust boundary for privileged UI. |
| All surfaces on Cloud Run only | Loses App Hosting’s Firebase-native public web path and complicates App Check / Auth integration for the public site without benefit. |
| Single Cloud Run service for web + APIs | Collapses security domains; a public compromise could reach submission or publication paths. |
| Separate microservice per page/feature | Over-decomposition beyond bead security boundaries (ADR-005). |

## Consequences

- Distinct deploy pipelines and service accounts for web vs APIs vs admin.
- Public web can remain readable in degraded mode from release snapshots even when APIs throttle.
- Operators must manage both App Hosting and Cloud Run; complexity is intentional for isolation.
- Local development continues via `pnpm --filter @repo/web|admin|api-*` without requiring Firebase until .

## Migration triggers

- Move public web off App Hosting only if App Hosting cannot meet security, cache, or region requirements after  hardening.
- Split or merge Cloud Run services only when a security boundary change is approved (must still map to ADR-005 surfaces).
- Revisit if Firebase product changes deprecate App Hosting for this Next.js deployment model.

## Rollback considerations

- Keep `apps/web` buildable as a standard Next.js app so it can temporarily run on Cloud Run behind CDN if App Hosting is unavailable.
- Do not roll back by combining API and admin into the public web process; rollback is host change, not boundary collapse.
- Infrastructure-as-code and prior release tags must allow redeploy of the last known-good App Hosting and Cloud Run revisions independently.
