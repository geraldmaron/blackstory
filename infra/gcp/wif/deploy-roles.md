# Deploy identity roles (BB-010, extended by ADR-012/BB-078)

Least-privilege Google IAM for the GitHub Actions deploy identities across the three ADR-012
projects. Aligns with [`../service-accounts.matrix.md`](../service-accounts.matrix.md) and
[`../isolation-matrix.json`](../isolation-matrix.json) (both still describe the live single-project
state; this file describes the target per-project deploy identities).

## Primary identity: `github-deploy` (`blackbook-prod`)

Email: `github-deploy@black-book-efaaf.iam.gserviceaccount.com`

| Role | Purpose | Scope notes |
|------|---------|-------------|
| `roles/run.admin` | Deploy/update Cloud Run services and jobs | Prefer resource-scoped bindings when services exist (BB-021+) |
| `roles/firebaseapphosting.admin` | Trigger App Hosting rollouts (automatic rollouts stay disabled) | Requires Blaze + App Hosting API (BB-011 blocker) |
| `roles/iam.serviceAccountUser` | ActAs runtime SAs at deploy time only | Bind **only** to exact runtime SAs listed below |
| `roles/artifactregistry.writer` | Push images used by Cloud Run | Limit to deploy registries once created |
| `roles/iam.serviceAccountTokenCreator` | Optional; prefer WIF impersonation path only | Do **not** grant broadly; omit unless a reviewed tool requires it |

### Allowed ActAs targets (serviceAccountUser)

Only these `blackbook-prod` runtime identities (when provisioned), and only when the GCP account ID
is 6–30 characters (Google requirement):

- `web-runtime`
- `api-public`
- `api-submissions`
- `api-internal`
- `migrations`
- `backup`

**ADR-012 change:** `publication`, `security`, `research`, and `admin` are no longer in
`github-deploy`'s (blackbook-prod) `ActAs` list — those surfaces move to `blackbook-internal` and are
deployed by `github-deploy-internal` instead (see below). `github-deploy` (blackbook-prod) has no
`ActAs` grant on any `blackbook-internal` identity.

Logical surface `admin` is listed in the BB-005 matrix as account ID `admin` (5 chars). GCP rejects
that ID length; Terraform ActAs bindings skip IDs shorter than 6 characters until the matrix uses a
valid account ID (for example `admin-app`, used for the `blackbook-internal` list below). Do not
widen trust to work around this.

Never grant `github-deploy` ActAs on itself in a way that widens trust, and never grant it
`roles/owner`, `roles/editor`, project-wide Storage Admin, or Token Creator on unrelated SAs.

### Must not have

- Exported / downloadable service-account keys
- Runtime attachment to an application process
- Trust from unprotected branches, pull requests, forks, or unapproved environments
- Bucket object IAM (deploy identity is not a data plane principal)

## Optional identity: `github-deploy-staging` (`blackbook-staging`, ADR-012)

A **distinct project**, not same-project configuration separation (this changed under ADR-012 —
previously this was a same-project identity). Still gated by Terraform
`enable_staging_deploy_identity=true`; still synthetic-data-only and must not be used for
destructive testing against production data.

Intended differences vs production:

- GitHub Environment `staging` (optional reviewers; still not fork/PR trust)
- Deploy roles bound in `blackbook-staging` only (`google_project_iam_member.github_deploy_staging_roles`)
- `ActAs` scoped to `var.staging_runtime_sa_ids`, resolved against `blackbook-staging` service accounts

## Optional identity: `github-deploy-internal` (`blackbook-internal`, ADR-012)

New identity for the research pipeline + admin project. Gated by Terraform
`enable_internal_deploy_identity=true`.

- GitHub Environment `internal`
- Deploy roles bound in `blackbook-internal` only (`google_project_iam_member.github_deploy_internal_roles`)
- `ActAs` scoped to `var.internal_runtime_sa_ids` (`admin-app`, `publication`, `security`, `research`,
  `promotion`, `submissions-puller`), resolved against `blackbook-internal` service accounts
- Must never receive any grant in `blackbook-prod` — that asymmetry is enforced by construction: this
  module never references `var.project_id` when building `github-deploy-internal`'s bindings

### Allowed ActAs targets, per project

| Project | Deploy SA | `ActAs` targets (`var.*_runtime_sa_ids`, filtered to >=6 chars) |
|---------|-----------|-------------------------------------------------------------|
| `blackbook-prod` | `github-deploy` | `web-runtime`, `api-public`, `api-submissions`, `api-internal`, `migrations`, `backup` |
| `blackbook-staging` | `github-deploy-staging` | same list, mirrored in `blackbook-staging` |
| `blackbook-internal` | `github-deploy-internal` | `admin-app`, `publication`, `security`, `research`, `promotion`, `submissions-puller` |

Logical surface `admin` is listed in the BB-005 matrix as account ID `admin` (5 chars). GCP rejects
that ID length; the `blackbook-internal` runtime SA list therefore uses `admin-app` (see
`variables.tf`, `internal_runtime_sa_ids`) rather than widening the length filter.

## Terraform encoding

Project-level role members and `roles/iam.workloadIdentityUser` bindings for all three deploy
identities live in `terraform/iam.tf`. Resource-scoped Run/App Hosting bindings are left for BB-062
once services exist.
