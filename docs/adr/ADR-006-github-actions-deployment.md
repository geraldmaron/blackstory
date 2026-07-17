# ADR-006: GitHub Actions deployment model

- **Status:** Accepted
- **Date:** 2026-07-16
- **Bead:** BB-002
- **Depends on:** ADR-001, ADR-005
- **Implements toward:** BB-008, BB-009, BB-010, BB-062

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| Workflows | PR CI: `.github/workflows/ci.yml` (BB-008); OIDC deploy stub: `.github/workflows/deploy-production.yml` (BB-010, `workflow_dispatch` only) | Full release pipeline under BB-062 |
| Git remote / branch protection | **Absent** (local declarative ruleset + policy checker present; not applied on GitHub) | BB-009 apply via `infra/github/` |
| OIDC / WIF deploy identities | **Designed, not applied** — `infra/gcp/wif/`, `infra/github/oidc/`, apply/check scripts dry-run by default | Applied pool/provider + protected `production` environment after remote + numeric IDs |
| Production release pipeline | **Absent** (provenance schema stub only) | BB-062 |

## Context

Production deploy must pass security, test, migration, and rollback checks (invariant 19). Deployments must use short-lived cloud credentials, not long-lived keys in GitHub secrets. App Hosting must not auto-roll untested commits. Migrations must complete before incompatible code receives traffic.

## Decision

1. **GitHub Actions** is the sole CI/CD orchestrator for validation, migration, deployment, and release promotion.
2. Authentication to Google Cloud uses **GitHub OIDC + Workload Identity Federation** (no standing deploy JSON keys).
3. Trust conditions bind to **numeric repository ID, owner ID, branch, workflow, and protected GitHub environment** (IDs TBD until a GitHub remote exists; see `infra/gcp/wif/trust-conditions.md`).
4. Dedicated deployment identity for **production** (`github-deploy`); optional same-project **staging** identity (`github-deploy-staging`) is gated and is not a security boundary.
5. Workflows deploy **only the tested commit** (immutable SHA).
6. **Automatic App Hosting rollouts are disabled**; Actions triggers App Hosting rollout explicitly.
7. **Production** requires a **protected environment approval**.
8. Pipeline shape (BB-062): PR validation → (optional Firebase preview) → staging → migrations → API/admin deploy → App Hosting rollout → security scans → e2e smoke → production approval → progressive release → health-check rollback.
9. Allowed Actions are limited to **approved publishers or pinned versions** (BB-009; see `infra/github/allowed-actions.json` + SHA pins in workflows).
10. BB-008 establishes PR validation under `.github/workflows/ci.yml`; BB-010 delivers OIDC/WIF design + deploy stub; release promotion remains BB-062.
11. BB-009 checks in local governance artifacts and a **Governance** CI job; repository rulesets are applied with `infra/github/scripts/apply-governance.sh` once a remote + admin token exist. Stable check names: `docs/testing/README.md`.
12. Deployment provenance is written to release metadata (`infra/github/release-metadata/`) when deploy jobs run.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Firebase Console / gcloud manual prod deploys as primary path | Unauditable; skips gates; violates invariant 19. |
| Long-lived GCP service account keys in GitHub secrets | Key leak risk; beads require OIDC/WIF. |
| Automatic App Hosting on every main push | Untested commits can reach public users. |
| Deploy from developer laptops with user ADC | No environment protection or provenance. |
| Separate CD product (e.g., extra deploy SaaS) for v1 | Extra trust boundary; Actions + WIF already mandated. |

## Consequences

- Remote repository and governance (BB-009) still block **live** OIDC apply; BB-010 delivers declarative WIF + workflow stubs until remote + `gh` + `gcloud` exist.
- Migration jobs need careful ordering and expand/contract discipline (ADR-002).
- Release provenance and changelog become first-class artifacts (`infra/github/release-metadata/`).
- Local `pnpm build`/`test` remain developer gates; Actions is the authority for prod.

## Migration triggers

- Add environment-specific workflows when staging/prod projects exist (BB-005).
- Change deploy tool only if GitHub Actions cannot meet OIDC or approval requirements.
- Pin/update Actions when security advisories require; treat unpinning as an ADR amendment.

## Rollback considerations

- Prefer progressive release + automatic rollback on failed health checks (BB-062).
- Redeploy previous known-good commit SHA via the same workflows.
- Database: roll forward with compensating migration or activate prior public release (ADR-004); avoid destructive down-migrations in prod without rehearsal (BB-061).
- Disable broken workflow by environment protection; do not bypass with local force-deploy.
