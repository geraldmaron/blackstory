# GitHub Actions Workload Identity Federation (BB-010)

Declarative Google Cloud WIF design for GitHub Actions against production project
`black-book-efaaf` (number `332234323945`). Resources are **not applied** by default.

## Status (verified 2026-07-16)

| Item | State |
|------|--------|
| Design + Terraform stubs | Present under `infra/gcp/wif/terraform/` |
| Trust conditions / deploy roles docs | Present |
| Cloud WIF pool / provider / bindings | **Not created** (no apply; IDs TBD until GitHub remote exists) |
| GitHub remote / numeric repo + owner IDs | **Absent** — placeholders in tfvars |
| `gcloud` Application Default Credentials | Often absent locally — apply scripts dry-run without mutating |
| Long-lived SA JSON keys in GitHub | **None** (must stay that way; removal path documented) |

## Trust model (ADR-006)

GitHub OIDC tokens are federated into GCP. Impersonation of `github-deploy` requires **all** of:

1. Numeric `repository_id` (TBD until remote exists)
2. Numeric `repository_owner_id` (TBD until remote exists)
3. Branch `refs/heads/main` only
4. Exact production deploy workflow path/ref
5. Protected GitHub Environment named `production`

Unauthorized branches, forked PRs, and non-`production` environments cannot satisfy the provider
attribute condition or the principal-set IAM binding. Credentials are short-lived per job via OIDC
(`id-token: write`); no exported SA keys.

See [`trust-conditions.md`](./trust-conditions.md) and [`deploy-roles.md`](./deploy-roles.md).

## Layout

| Path | Role |
|------|------|
| `terraform/` | Unapplied WIF pool, OIDC provider, SA impersonation bindings |
| `trust-conditions.md` | CEL / principal-set contract |
| `deploy-roles.md` | Least-privilege roles for `github-deploy` |
| `../../github/oidc/` | GitHub environment stubs, apply/check scripts, workflow notes |
| `../../github/release-metadata/` | Deployment provenance schema + stub |

## Validate (local, no cloud)

```bash
cd ~/Developer/Projects/black-book/infra/gcp/wif/terraform
terraform init -backend=false
terraform validate
# Plan requires numeric GitHub IDs; empty defaults fail closed intentionally:
# terraform plan -var-file=envs/prod.tfvars.example
```

## Apply path (human, after remote + gcloud)

Prerequisites:

1. GitHub remote exists; BB-009 rulesets applied (`infra/github/scripts/apply-governance.sh --apply`).
2. Record numeric IDs: `gh api repos/OWNER/REPO --jq '{repository_id:.id, owner_id:.owner.id}'`.
3. `gcloud auth login` and `gcloud auth application-default login` with permission to manage IAM WIF.
4. Surface SA `github-deploy@black-book-efaaf.iam.gserviceaccount.com` exists (BB-011 / BB-005 stubs).
5. Create protected GitHub Environment `production` (required reviewers) — see `infra/github/oidc/`.

Then:

```bash
# Dry-run (default)
./infra/github/scripts/apply-wif.sh --dry-run

# Mutating apply only after review
./infra/github/scripts/apply-wif.sh --apply

# Read-only check
./infra/github/scripts/check-wif.sh
```

Optional same-project staging identity is gated by `enable_staging_deploy_identity` (default false).
Staging is configuration separation, not a security boundary
([`docs/security/environment-isolation.md`](../../../docs/security/environment-isolation.md)).

## Related

- Workflow example: `.github/workflows/deploy-production.yml` (`workflow_dispatch` only; not a required check)
- Full pipeline: BB-062
- Isolation matrix: [`../isolation-matrix.json`](../isolation-matrix.json)
