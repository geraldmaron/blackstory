# Runbook: Production environment re-split migration ( → )

**Scope:** Human-executed migration from the single production project `black-book-efaaf` to the
[ADR-012](../adr/ADR-012-production-environment-resplit.md) three-project topology
(`blackbook-prod` = retained `black-book-efaaf`, `blackbook-staging`, `blackbook-internal`).
**Not executed by  or by this document.** Tracked as  (Production cloud apply). No
`gcloud`, `firebase deploy`, or `terraform apply` command in this runbook has been run by any
agent session.

**System of record:** Firestore (ADR-011). **Not in scope:** application code changes in
`apps/admin`, `workers/*` (owned by other beads); this runbook only covers infra/project
migration steps and points at where those follow-on beads pick up.

## When to run

- Once, as , after this runbook and the underlying Terraform have been reviewed by whoever
  holds billing/org authority on the Google Cloud account.
- Before any Blaze upgrade, App Hosting backend creation, or production data/traffic exists —
  this is the cheapest point in the project's life for this migration (ADR-012 Context).

## Prerequisites

- `gcloud` and `firebase` CLI, authenticated with an identity that can create projects and link
  billing (human break-glass identity, not `github-deploy`).
- A real billing account ID. An org ID if a GCP organization exists (optional — see
  "No GCP org yet" below).
- GitHub remote exists with numeric `repository_id`/`repository_owner_id` recorded (
  prerequisite, `infra/gcp/wif/trust-conditions.md`).
- `terraform >= 1.6.0` and the `hashicorp/google` provider (already used by
  `infra/gcp/terraform/multi-project/`).
- Read [ADR-012](../adr/ADR-012-production-environment-resplit.md) in full before starting —
  this runbook assumes its decisions (project names, cross-project grant list, admin-console
  IAP mechanism) without re-deriving them.

## No GCP org yet

If there is still no GCP organization when this runbook runs, skip every `manage_org_policies`
step below and rely on the convention-level controls already documented (no SA key is ever
created for any identity; `infra/gcp/wif/deploy-roles.md` and `service-accounts.matrix.md` list
"no exported keys" as a hard must-not-have). Flip `manage_org_policies = true` per project the
moment an org exists — no other Terraform change is required (see
`infra/gcp/terraform/multi-project/iam-org-policies.tf`).

## Migration checklist

Execute in order. Each Terraform step should be a reviewed `terraform plan` before `apply` — do
not flip every gate variable to `true` in one apply.

| # | Step | Where | Command / action |
|---|------|-------|-------------------|
| 1 | Create `blackbook-staging`, `blackbook-internal` projects; link billing (and org, if any) | `infra/gcp/terraform/multi-project/` | `terraform apply -var-file=envs/prod.tfvars -var create_new_projects=true -var billing_account=<ACCOUNT_ID> [-var org_id=<ORG_ID>]` |
| 2 | Enable required APIs per new project | `gcloud` (human) | `gcloud services enable firestore.googleapis.com run.googleapis.com iap.googleapis.com secretmanager.googleapis.com --project=blackbook-internal` (repeat relevant subset for `blackbook-staging`) |
| 3 | Create named Firestore databases `raw-ingest`, `curated` in `blackbook-internal` | `infra/gcp/terraform/multi-project/` | `terraform apply ... -var provision_internal_databases=true` |
| 4 | Create `blackbook-staging` mirrored service accounts | `infra/gcp/terraform/multi-project/` | `terraform apply ... -var provision_staging_service_accounts=true` |
| 5 | Create `blackbook-internal` service accounts (`research`, `publication`, `security`, `admin-app`, `promotion`, `submissions-puller`) | `infra/gcp/terraform/multi-project/` | `terraform apply ... -var provision_internal_service_accounts=true` |
| 6 | Apply the one-way promotion cross-project IAM asymmetry | `infra/gcp/terraform/multi-project/` | `terraform apply ... -var apply_cross_project_iam=true` |
| 7 | Verify the negative case: no `blackbook-prod` principal resolves any role in `blackbook-internal` | `gcloud` (human) | `gcloud projects get-iam-policy blackbook-internal --format=json \| grep -i 'black-book-efaaf'` — must return nothing |
| 8 | Verify the cross-project grants match exactly the ADR-012 list | repo | `node --test infra/gcp/terraform/multi-project/tests/isolation-invariants.test.mjs` |
| 9 | Create protected GitHub Environments `staging` and `internal` (if not already present alongside `production`) | GitHub (human) | See `infra/github/oidc/` |
| 10 | Extend WIF: enable `github-deploy-staging` (now targeting `blackbook-staging`) and `github-deploy-internal` | `infra/gcp/wif/terraform/` | `terraform apply -var-file=envs/prod.tfvars -var enable_staging_deploy_identity=true -var enable_internal_deploy_identity=true -var staging_project_id=blackbook-staging -var internal_project_id=blackbook-internal` |
| 11 | Move `apps/admin` deploy target: Cloud Run service in `blackbook-internal`, IAP attached **directly to the Cloud Run service** (no load balancer) | `gcloud` (human) | `gcloud run services update black-book-admin --project=blackbook-internal --region=<region> --iap` (exact flag/console step depends on current `gcloud`/console IAP-for-Cloud-Run UI at execution time — verify against current GCP docs, not this runbook, before running) |
| 12 | Grant `roles/iap.httpsResourceAccessor` only to the administrator access group on the `blackbook-internal` admin service | `gcloud` (human) | See `infra/gcp/iap/README.md` for the accessor-group pattern (mechanism section needs a follow-up rewrite for direct-attach IAP — see "Known follow-up" below) |
| 13 | Move `workers/research`, `workers/publication`, `workers/security` deploy targets to `blackbook-internal` | CI workflows (out of scope for ; follow-up bead) | Update `.github/workflows/*` to deploy against `blackbook-internal` using `github-deploy-internal` |
| 14 | Update the **root** `.firebaserc` to add `staging`/`internal` aliases (root `.firebaserc` is outside 's file ownership — `infra/firebase/.firebaserc.example` already shows the target shape) | repo (human) | Mirror `infra/firebase/.firebaserc.example` into `.firebaserc` |
| 15 | Re-register `apps/admin`'s Firebase app under `blackbook-internal`; update admin's runtime Firebase config (outside 's file ownership — `apps/admin` source) | repo (human, follow-up bead) | Firebase console / `firebase apps:create` against `blackbook-internal` |
| 16 | Set real per-project budgets | `infra/gcp/terraform/multi-project/` | `terraform apply ... -var billing_account=<ACCOUNT_ID> -var billing_budget_amount_units='{prod=..., staging=..., internal=...}'` — confirm `blackbook-prod`'s budget has no automated action wired (notify-only; see `budgets.tf` header) |
| 17 | Confirm `black-book-efaaf` (`blackbook-prod`) still has zero IAM binding for any `blackbook-internal` identity, and zero resource left over from the old same-project research/admin design | `gcloud` (human) | Cross-check against `infra/gcp/service-accounts.matrix.md`'s historical list; there should be nothing to decommission since nothing was ever applied |
| 18 | Run the full AC-ISO-1..5 verification (below) and record a findings note (pattern: `infra/gcp/recovery-rehearsal/findings-template.md`) | repo + `gcloud` | See "Verification" section |
| 19 | Flip `infra/gcp/isolation-matrix.json`'s `productionResplitTarget.status` from `design-not-applied` to `applied`, and update `docs/security/environment-isolation.md`'s "Verified live vs. designed" table | repo (follow-up doc bead once step 1–18 are live-verified) | Do not flip this before live verification — it is the single source other docs trust for "is this real yet" |

## Known follow-up (flagged, not fixed by this runbook)

`infra/gcp/iap/README.md` and `infra/gcp/iap/admin-iap-policy.json` still describe the
external-HTTPS-load-balancer + serverless NEG IAP pattern. Step 11–12 above use the newer direct
Cloud-Run-attached IAP integration per ADR-012. That directory needs its own rewrite pass before
step 11 is executed for real — file a follow-up bead rather than provisioning against a stale
design doc. `docs/security/admin-identity.md`'s application-authorization layer (IAP JWT +
Firebase MFA) is unaffected either way.

## Verification (AC-ISO-1..5 restated invariants)

| Check | Command | Pass criteria |
|-------|---------|-----------------|
| Matrix encodes the ADR-012 topology and grant list | `node --test infra/gcp/terraform/multi-project/tests/isolation-invariants.test.mjs` | All tests pass |
| `isolation-matrix.json` still schema-valid | `cd infra/gcp && uv run --with jsonschema python -c "import json,sys; from jsonschema import Draft7Validator; s=json.load(open('isolation-matrix.schema.json')); d=json.load(open('isolation-matrix.json')); errs=list(Draft7Validator(s).iter_errors(d)); print('OK' if not errs else '\n'.join(e.message for e in errs)); sys.exit(1 if errs else 0)"` | `OK` |
| Multi-project Terraform still valid | `cd infra/gcp/terraform/multi-project && terraform validate` | `Success!` |
| WIF Terraform still valid | `cd infra/gcp/wif/terraform && terraform validate` | `Success!` |
| Zero `blackbook-prod` principal has IAM in `blackbook-internal` (AC-ISO-2/3 negative case) | `gcloud projects get-iam-policy blackbook-internal --format=json` inspected for any `black-book-efaaf`-suffixed member | No match |
| `promotion` is the only prod-public/** writer (AC-ISO-2) | `gcloud projects get-iam-policy black-book-efaaf --format=json` filtered to `roles/datastore.user` on the `public/` condition | Only `promotion@blackbook-internal...` present |
| `private-evidence` bucket has zero `blackbook-prod` reader/writer (AC-ISO-3) | `gcloud storage buckets get-iam-policy gs://blackbook-internal-private-evidence` | No `black-book-efaaf`-suffixed member |
| Quarantine object-create stays `api-submissions`-only (AC-ISO-4) | `gcloud storage buckets get-iam-policy gs://black-book-efaaf-quarantine` | Only `api-submissions@...` (create) and `security@blackbook-internal...` (admin) |
| No callable path prod → internal exists (AC-ISO-5) | Manual review: confirm no Cloud Run service in `blackbook-prod` has an outbound call target in `blackbook-internal` | None found |

## Rollback considerations

- **Before step 6 (cross-project IAM applied):** two-way door. Delete the new projects; nothing
  in `blackbook-prod` has changed. Cheapest possible rollback.
- **Between step 6 and step 15 (identities/IAM exist, no traffic moved):** still cheap — no
  production data or traffic depends on the new projects yet. Revert by disabling the gate
  variables (`terraform apply` with gates back to `false` does not un-create already-applied
  resources; use `terraform destroy -target=...` for the specific resources, reviewed).
- **After production serving actually moves ( completion):** expensive. Reversing means
  either a live data migration back into one project or accepting permanent three-project
  overhead — this matches ADR-012's Reversibility section. Do not attempt without a dedicated
  incident-level review; use `docs/runbooks/incident-response.md` and
  `docs/runbooks/recovery-rollback-rehearsal.md` patterns instead of ad hoc rollback.

## References

- [ADR-012](../adr/ADR-012-production-environment-resplit.md) — decision record this runbook executes
- [`docs/security/environment-isolation.md`](../security/environment-isolation.md) — current design + AC-ISO restatement
- [`infra/gcp/terraform/multi-project/`](../../infra/gcp/terraform/multi-project/) — Terraform for steps 1, 3–6, 16
- [`infra/gcp/wif/`](../../infra/gcp/wif/) — Terraform for step 10
- [`infra/gcp/isolation-matrix.json`](../../infra/gcp/isolation-matrix.json) — machine source of truth
- [`recovery-rollback-rehearsal.md`](./recovery-rollback-rehearsal.md) — rollback pattern this runbook follows
- [`incident-response.md`](./incident-response.md) — kill switches and containment order
