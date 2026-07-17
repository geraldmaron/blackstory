# Terraform stubs for GitHub OIDC → GCP Workload Identity Federation (BB-010).
# Do not apply until GitHub numeric IDs exist, github-deploy SA exists, and a human reviews the plan.

These stubs create:

- Workload Identity Pool `black-book-github`
- OIDC provider `github-actions` (issuer `https://token.actions.githubusercontent.com`)
- `roles/iam.workloadIdentityUser` for the `production` environment principal set on `github-deploy`
- Optional ActAs on runtime SAs and project deploy roles (see `../deploy-roles.md`)
- Optional `github-deploy-staging` when `enable_staging_deploy_identity=true`

They do **not** create the BB-005 surface SAs (except optional staging deploy SA), App Hosting
backends, Cloud Run services, or GitHub Environments.

```bash
cd infra/gcp/wif/terraform
terraform init -backend=false
terraform validate

# Plan needs a real tfvars with numeric GitHub IDs and an existing github-deploy SA.
# Prefer the dry-run wrapper:
# ../../../../infra/github/scripts/apply-wif.sh --dry-run
```

Prefer `infra/github/scripts/apply-wif.sh` (dry-run default) over raw `terraform apply`.
