// blackbook-prod is referenced, never created or recreated (ADR-012: retained black-book-efaaf).
// A data source needs no create permission and does not appear in `terraform plan` as a change;
// it only resolves during `terraform plan`/`apply` (not `validate`, which needs no live credentials).
data "google_project" "prod" {
  project_id = var.prod_project_id
}

// Data sources for staging/internal project numbers (used by budgets.tf only, hence gated the
// same way budgets.tf is - billing_account set - so a plan run before those projects exist
// does not fail trying to look up a nonexistent project). Resolve at plan/apply time; do not
// require live credentials to pass `terraform validate`.
data "google_project" "staging" {
  count = var.billing_account != "" ? 1 : 0

  project_id = var.staging_project_id
}

data "google_project" "internal" {
  count = var.billing_account != "" ? 1 : 0

  project_id = var.internal_project_id
}

// blackbook-staging and blackbook-internal are new projects. Gated behind create_new_projects
// (default false) so a bare plan/apply cannot provision live projects. org_id is optional to
// match the documented "no GCP org yet" situation (see README.md and ../../wif/terraform).
resource "google_project" "staging" {
  count = var.create_new_projects ? 1 : 0

  project_id      = var.staging_project_id
  name            = "blackbook-staging"
  org_id          = var.org_id != "" ? var.org_id : null
  billing_account = var.billing_account != "" ? var.billing_account : null

  labels = {
    "adr"          = "adr-012"
    "bb078-target" = "true"
    "tier"         = "nonprod"
  }
}

resource "google_project" "internal" {
  count = var.create_new_projects ? 1 : 0

  project_id      = var.internal_project_id
  name            = "blackbook-internal"
  org_id          = var.org_id != "" ? var.org_id : null
  billing_account = var.billing_account != "" ? var.billing_account : null

  labels = {
    "adr"          = "adr-012"
    "bb078-target" = "true"
    "tier"         = "internal"
  }
}
