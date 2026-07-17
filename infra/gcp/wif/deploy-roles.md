# Deploy identity roles (BB-010)

Least-privilege Google IAM for the GitHub Actions deploy identity in `black-book-efaaf`.
Aligns with [`../service-accounts.matrix.md`](../service-accounts.matrix.md) and
[`../isolation-matrix.json`](../isolation-matrix.json).

## Primary identity: `github-deploy`

Email: `github-deploy@black-book-efaaf.iam.gserviceaccount.com`

| Role | Purpose | Scope notes |
|------|---------|-------------|
| `roles/run.admin` | Deploy/update Cloud Run services and jobs | Prefer resource-scoped bindings when services exist (BB-021+) |
| `roles/firebaseapphosting.admin` | Trigger App Hosting rollouts (automatic rollouts stay disabled) | Requires Blaze + App Hosting API (BB-011 blocker) |
| `roles/iam.serviceAccountUser` | ActAs runtime SAs at deploy time only | Bind **only** to exact runtime SAs listed below |
| `roles/artifactregistry.writer` | Push images used by Cloud Run | Limit to deploy registries once created |
| `roles/iam.serviceAccountTokenCreator` | Optional; prefer WIF impersonation path only | Do **not** grant broadly; omit unless a reviewed tool requires it |

### Allowed ActAs targets (serviceAccountUser)

Only these runtime identities (when provisioned), and only when the GCP account ID is 6–30
characters (Google requirement):

- `web-runtime`
- `api-public`
- `api-submissions`
- `api-internal`
- `migrations`
- `publication`
- `security`
- `research` (worker deploy only; still cannot publish via its own roles)
- `backup`

Logical surface `admin` is listed in the BB-005 matrix as account ID `admin` (5 chars). GCP rejects
that ID length; Terraform ActAs bindings skip IDs shorter than 6 characters until the matrix uses a
valid account ID (for example `admin-app`). Do not widen trust to work around this.

Never grant `github-deploy` ActAs on itself in a way that widens trust, and never grant it
`roles/owner`, `roles/editor`, project-wide Storage Admin, or Token Creator on unrelated SAs.

### Must not have

- Exported / downloadable service-account keys
- Runtime attachment to an application process
- Trust from unprotected branches, pull requests, forks, or unapproved environments
- Bucket object IAM (deploy identity is not a data plane principal)

## Optional staging identity: `github-deploy-staging`

Same project only. Configuration separation — **not** an isolation or blast-radius boundary.
Enabled only when Terraform `enable_staging_deploy_identity=true`.

Intended differences vs production:

- GitHub Environment `staging` (optional reviewers; still not fork/PR trust)
- Same role classes with staging-prefixed backends/services when they exist
- Must not be used for destructive testing against production data

## Terraform encoding

Project-level role members and `roles/iam.workloadIdentityUser` bindings live in
`terraform/iam.tf`. Resource-scoped Run/App Hosting bindings are left for BB-062 once services exist.
