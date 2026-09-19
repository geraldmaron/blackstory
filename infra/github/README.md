# GitHub governance

Local policy is checked by `pnpm validate:governance`. Remote settings are a separate system:
inspect them with `infra/github/scripts/check-governance.sh` before claiming they are applied.

The policy files under `.github/` and `infra/github/` define path ownership, allowed actions,
branch rules and security settings. `scripts/apply-governance.sh --dry-run` previews changes;
`--apply` requires an authenticated repository administrator. Never recreate retired cloud
identity infrastructure to satisfy an obsolete runbook.

## Validation and cost

Required CI names are `Workspace Checks`, `Workspace Tests`, `Unit Tests (Python)` and
`Governance`. Keep those aligned with `.github/workflows/ci.yml` and the ruleset. Run
`fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging` before pushing. Consolidate
related work and avoid repeated pushes solely to discover failures that can be checked locally.

Production deployment is governed by [the release runbook](../../docs/runbooks/production-release.md).
Vercel Git integration can deploy independently of Actions. Manual workflow capability does not
mean a deployment or schedule is enabled. No research schedule is intended.

The public documentation site uses the branch `/docs` export produced by `pnpm docs:publish`.
Its source is `apps/docs`; retain operating Markdown when rebuilding generated assets.

## Remote changes

Use `scripts/apply-governance.sh --dry-run` and inspect its proposed repository target and diff.
After an authorized apply, run `scripts/check-governance.sh`. Secret scanning and push protection
availability depend on the repository's GitHub plan; absence must not be reported as success.
Deployment credentials and secret-removal procedure are documented under `oidc/`.
