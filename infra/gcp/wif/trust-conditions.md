# WIF trust conditions (BB-010)

Attribute conditions and IAM principal sets that prevent unauthorized branches, forks, and
unprotected environments from obtaining production deploy credentials.

## GitHub OIDC claims used

| Claim | Purpose |
|-------|---------|
| `repository_id` | Bind to this repo only (numeric; immune to rename) |
| `repository_owner_id` | Bind to this owner/org only (numeric) |
| `ref` | Production deploys only from `refs/heads/main` |
| `workflow_ref` | Exact production workflow file on `main` |
| `environment` | Must equal protected GitHub Environment `production` |
| `event_name` | Workflow should only run on `workflow_dispatch` / later BB-062 events — never `pull_request` |

IDs are **TBD** until a GitHub remote exists. Do not invent values. Fill
`infra/gcp/wif/terraform/envs/prod.tfvars` after:

```bash
gh api repos/OWNER/REPO --jq '{repository_id: (.id|tostring), owner_id: (.owner.id|tostring), full_name: .full_name}'
```

## Provider attribute condition (CEL)

Encoded in `terraform/wif.tf`. Logical contract:

```text
assertion.repository_id == "<GITHUB_REPOSITORY_ID>"
&& assertion.repository_owner_id == "<GITHUB_OWNER_ID>"
&& assertion.ref == "refs/heads/main"
&& assertion.environment == "production"
&& assertion.workflow_ref.startsWith("<OWNER>/<REPO>/.github/workflows/deploy-production.yml@refs/heads/main")
```

Effects:

- **Unauthorized branches** — `ref` is not `refs/heads/main` → federation denied at the provider.
- **Forked PRs** — deploy workflow is not triggered on `pull_request`; even if a token were issued
  from another workflow, it would lack `environment=production` and the exact `workflow_ref`.
- **Wrong workflow** — only the pinned production deploy workflow path on `main` is trusted.
- **Unprotected context** — missing or non-`production` environment claim → denied.

## IAM principal set (Workload Identity User)

On `github-deploy@black-book-efaaf.iam.gserviceaccount.com` (blackbook-prod):

```text
principalSet://iam.googleapis.com/projects/332234323945/locations/global/workloadIdentityPools/black-book-github/attribute.environment/production
```

Combined with the provider condition, only tokens that already cleared the CEL filter and carry
`environment=production` may impersonate the deploy SA.

### Per-project deploy identities (ADR-012)

The pool and provider stay hosted in `blackbook-prod` (a WIF pool is a project-scoped resource), but
the principal sets it mints are granted IAM in whichever project each deploy SA actually lives in:

| Environment claim | Deploy SA | Deploy SA's project | Enabled by |
|--------------------|-----------|----------------------|------------|
| `production` | `github-deploy` | `blackbook-prod` (`black-book-efaaf`) | always (required) |
| `staging` | `github-deploy-staging` | `blackbook-staging` | `enable_staging_deploy_identity=true` |
| `internal` | `github-deploy-internal` | `blackbook-internal` | `enable_internal_deploy_identity=true` |

A token minted with `environment=staging` satisfies only the `staging` principal set and can
therefore only impersonate `github-deploy-staging`, which itself can only `ActAs` runtime SAs inside
`blackbook-staging` (see `deploy-roles.md`). It has no path to `blackbook-prod` or
`blackbook-internal` credentials. Same isolation applies to `internal`. This is the concrete
mechanism behind ADR-012's "cross-environment deploys fail at IAM, not convention."

## Short-lived credentials

GitHub Actions requests an OIDC ID token per job (`permissions.id-token: write`). Google STS
exchanges it for a short-lived access token for `github-deploy`. No JSON key is created or stored
in GitHub secrets.

## Acceptance mapping

| Acceptance | Enforcement |
|------------|-------------|
| Unauthorized branches cannot obtain production credentials | Provider `ref` + `workflow_ref` condition |
| Forked PRs cannot access deployment credentials | No PR trigger; environment + workflow_ref required |
| Production deploy requires protected production environment | GitHub Environment protection + `environment` claim |
| Short-lived per-job credentials | OIDC → STS; no exported keys |
| Remove JSON SA secrets if any appear | See `infra/github/oidc/sa-key-removal.md` |
