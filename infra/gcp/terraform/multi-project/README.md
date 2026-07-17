# Three-project re-split Terraform stubs (ADR-012, BB-078)

Unapplied Terraform for the [ADR-012](../../../../docs/adr/ADR-012-production-environment-resplit.md)
target topology: `blackbook-prod` (retained `black-book-efaaf`), `blackbook-staging` (new),
`blackbook-internal` (new). This module is additive to, and does **not** duplicate,
[`../`](../) (the original BB-005 single-project stubs, which keep owning `blackbook-prod`'s own
service accounts, buckets, and same-project IAM). `../locals.tf` and `../buckets.tf` were
corrected to drop the four ADR-012-relocated identities (`admin`, `publication`, `security`,
`research`) and the `private-evidence` bucket, so there is no overlap between `../` and this
module's `blackbook-internal` resources.

## What this module creates (all gated, all `false`/empty by default)

| Resource | File | Gate variable |
|----------|------|----------------|
| `blackbook-staging`, `blackbook-internal` projects | `projects.tf` | `create_new_projects` |
| Named Firestore databases `raw-ingest`, `curated` in `blackbook-internal` | `firestore.tf` | `provision_internal_databases` (PITR separately gated by `internal_firestore_pitr_enabled`, default `false`) |
| `blackbook-staging` mirrored service accounts | `service_accounts.tf` | `provision_staging_service_accounts` |
| `blackbook-internal` service accounts (`research`, `publication`, `security`, `admin-app`, `promotion`, `submissions-puller`) | `service_accounts.tf` | `provision_internal_service_accounts` |
| `private-evidence` bucket in `blackbook-internal` (relocated from the original BB-005 stub) + same-project IAM (research/security write, admin-app/publication read) | `buckets.tf` | `provision_internal_buckets` (IAM also requires `provision_internal_service_accounts`) |
| One-way promotion cross-project IAM (`promotion`/`security`/`submissions-puller` into `blackbook-prod`; per-database IAM conditions inside `blackbook-internal`) | `iam-cross-project.tf` | `apply_cross_project_iam` |
| Per-project org policy backstops (`iam.disableServiceAccountKeyCreation`, `sql.restrictPublicIp`) | `iam-org-policies.tf` | `manage_org_policies` |
| Per-project billing budgets (notify-only for prod; kill-switch-eligible label only for internal) | `budgets.tf` | `billing_account != ""` |

## What this module deliberately does NOT create

- `blackbook-prod`'s own service accounts, buckets, or same-project IAM (other than the
  cross-project grants in `iam-cross-project.tf`) — see `../*.tf`.
- Any IAM grant from a `blackbook-prod` identity into `blackbook-internal`, in either direction.
  There is no resource anywhere in this module that does this; that absence is the ADR-012
  invariant, not an oversight (see `iam-cross-project.tf`'s header comment).
- The actual `workers/submissions-puller` implementation, or the automated budget-triggered
  shutdown for `blackbook-internal` — both are out of scope for BB-078 (declarative identity/IAM
  only; see ADR-012 Consequences).
- A VPC Service Controls perimeter — documented in ADR-012 as optional hardening, not built here
  (no GCP org exists yet to host the Access Context Manager policy it requires).

## Apply order (human, after BB-079 review — not run by this bead)

1. `create_new_projects = true` — creates `blackbook-staging`, `blackbook-internal`. Requires
   `billing_account` and, if an org exists, `org_id`.
2. `provision_internal_databases`, `provision_staging_service_accounts`,
   `provision_internal_service_accounts = true` — requires step 1's projects to exist.
3. `provision_internal_buckets = true` — requires step 1's `blackbook-internal` project to
   exist; requires step 2's `provision_internal_service_accounts` for the bucket's IAM members.
4. `apply_cross_project_iam = true` — requires step 2's `blackbook-internal` service accounts to
   exist (references them by Terraform resource, not by string).
5. Set `billing_account` and `billing_budget_amount_units` after human review to create budgets.

Flip these independently, in order, reviewing each `terraform plan` before applying — do not set
all gates to `true` in one apply.

## Validate (local, no cloud)

```bash
cd infra/gcp/terraform/multi-project
terraform init -backend=false
terraform validate
terraform fmt -check -recursive
# Plan requires real project/billing/org IDs; empty defaults fail closed intentionally:
# terraform plan -var-file=envs/prod.tfvars.example
```

## Related

- [ADR-012](../../../../docs/adr/ADR-012-production-environment-resplit.md) — decision record
- [`../../isolation-matrix.json`](../../isolation-matrix.json) — `productionResplitTarget` +
  `crossProjectGrants` machine encoding
- [`../../wif/`](../../wif/) — per-project GitHub Actions deploy identities (BB-010, extended)
- [`../../../../docs/security/environment-isolation.md`](../../../../docs/security/environment-isolation.md)
- [`../../../../docs/runbooks/production-environment-resplit-migration.md`](../../../../docs/runbooks/production-environment-resplit-migration.md)
- [`tests/isolation-invariants.test.mjs`](./tests/isolation-invariants.test.mjs) — asserts
  `infra/gcp/isolation-matrix.json` encodes the AC-ISO-1..5 cross-project restatement
