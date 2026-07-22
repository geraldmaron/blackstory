# ADR-006: GitHub Actions deployment model

- **Status:** Accepted
- **Date:** 2026-07-16
- **Amended:** 2026-07-22
- **Depends on:** ADR-001, ADR-005
- **Implements toward:** , , ,

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| Workflows | PR CI: `.github/workflows/ci.yml`; OIDC deploy stub: `.github/workflows/deploy-production.yml` (, `workflow_dispatch` only) | Full release pipeline under  |
| Git remote / branch protection | **Absent** (local declarative ruleset + policy checker present; not applied on GitHub) |  apply via `infra/github/` |
| OIDC / WIF deploy identities | **Designed, not applied** — `infra/gcp/wif/`, `infra/github/oidc/`, apply/check scripts dry-run by default | Applied pool/provider + protected `production` environment after remote + numeric IDs |
| Production release pipeline | **Absent** (provenance schema stub only) |  |
| Public web deploy | **Vercel** git-connected deploy from `main`; Production promote explicit (ADR-027) | Same |
| Admin / API deploy | Explicit App Hosting promote (admin only) + Cloud Run when WIF live | Same pinned-SHA doctrine |

## Context

Production deploy must pass security, test, migration, and rollback checks (invariant 19). Deployments must use short-lived cloud credentials, not long-lived keys in GitHub secrets. App Hosting must not auto-roll untested commits to admin. Public web must not auto-promote to Production on every push without explicit operator intent (ADR-027). Migrations must complete before incompatible code receives traffic.

## Decision

1. **GitHub Actions** is the sole CI/CD orchestrator for validation, migration, deployment, and release promotion.
2. Authentication to Google Cloud uses **GitHub OIDC + Workload Identity Federation** (no standing deploy JSON keys).
3. Trust conditions bind to **numeric repository ID, owner ID, branch, workflow, and protected GitHub environment** (IDs TBD until a GitHub remote exists; see `infra/gcp/wif/trust-conditions.md`).
4. Dedicated deployment identity for **production** (`github-deploy`); optional same-project **staging** identity (`github-deploy-staging`) is gated and is not a security boundary.
5. Workflows deploy **only the tested commit** (immutable SHA).
6. **Automatic App Hosting rollouts are disabled** for admin; Actions triggers admin App Hosting rollout explicitly when WIF is live.
7. **Public web (`apps/web`)** deploys via **Vercel** git integration. Production traffic requires explicit promote or pinned redeploy — not unattended auto-prod without amending ADR-027.
8. **Production** requires a **protected environment approval** for Cloud Run / admin App Hosting workflows.
9. Pipeline shape: PR validation → (optional Vercel Preview) → staging → migrations → API/admin deploy → admin App Hosting rollout (when applicable) → security scans → e2e smoke → production approval → progressive release → health-check rollback. Public web Production promote is a separate Vercel step.
10. Allowed Actions are limited to **approved publishers or pinned versions** (; see `infra/github/allowed-actions.json` + SHA pins in workflows).
11.  establishes PR validation under `.github/workflows/ci.yml`;  delivers OIDC/WIF design + deploy stub; release promotion remains .
12.  checks in local governance artifacts and a **Governance** CI job; repository rulesets are applied with `infra/github/scripts/apply-governance.sh` once a remote + admin token exist. Stable check names: `docs/testing/README.md`.
13. Deployment provenance is written to release metadata (`infra/github/release-metadata/`) when deploy jobs run.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Firebase Console / gcloud manual prod deploys as primary path | Unauditable; skips gates; violates invariant 19. |
| Long-lived GCP service account keys in GitHub secrets | Key leak risk; beads require OIDC/WIF. |
| Automatic App Hosting on every main push | Untested commits can reach admin users. |
| App Hosting promote as live path for public web | Public web host is Vercel (ADR-027); configs retired in-repo. |
| Deploy from developer laptops with user ADC | No environment protection or provenance. |
| Separate CD product (e.g., extra deploy SaaS) for v1 | Extra trust boundary; Actions + WIF already mandated. |

## Consequences

- Remote repository and governance still block **live** OIDC apply;  delivers declarative WIF + workflow stubs until remote + `gh` + `gcloud` exist.
- Migration jobs need careful ordering and expand/contract discipline (ADR-002).
- Release provenance and changelog become first-class artifacts (`infra/github/release-metadata/`).
- Local `pnpm build`/`test` remain developer gates; Actions is the authority for prod.
- Public web operators use Vercel dashboard/CLI for Production promote; admin operators use
  `firebase apphosting:rollouts:create black-book-admin-production --project=black-book-efaaf
  --git-commit=<sha> --force` (local Firebase CLI after `firebase login`).

## Migration triggers

- Add environment-specific workflows when staging/prod projects exist.
- Change deploy tool only if GitHub Actions cannot meet OIDC or approval requirements.
- Pin/update Actions when security advisories require; treat unpinning as an ADR amendment.

## Rollback considerations

- Prefer progressive release + automatic rollback on failed health checks.
- Redeploy previous known-good commit SHA via the same workflows (Cloud Run/admin) or Vercel promote/redeploy (public web).
- Database: roll forward with compensating migration or activate prior public release (ADR-004); avoid destructive down-migrations in prod without rehearsal.
- Disable broken workflow by environment protection; do not bypass with local force-deploy.
