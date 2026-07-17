# Workload Identity Pool + GitHub OIDC provider for production deploys (BB-010).
# Attribute conditions encode ADR-006 trust (numeric IDs, main, workflow, environment).

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = var.wif_pool_id
  display_name              = "Black Book GitHub Actions"
  description               = "OIDC federation for GitHub Actions deploy identities (BB-010)."
  disabled                  = false
}

resource "google_iam_workload_identity_pool_provider" "github_actions" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = var.wif_provider_id
  display_name                       = "GitHub Actions OIDC"
  description                        = "Trusts token.actions.githubusercontent.com with numeric repo/owner + protected environment."
  disabled                           = false

  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.actor"               = "assertion.actor"
    "attribute.repository"          = "assertion.repository"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
    "attribute.ref"                 = "assertion.ref"
    "attribute.workflow"            = "assertion.workflow"
    "attribute.workflow_ref"        = "assertion.workflow_ref"
    "attribute.environment"         = "assertion.environment"
    "attribute.event_name"          = "assertion.event_name"
  }

  attribute_condition = local.attribute_condition

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

// Optional blackbook-staging deploy SA (ADR-012: distinct project, real isolation boundary
// from blackbook-prod - unlike the pre-ADR-012 same-project optional identity this replaces).
resource "google_service_account" "github_deploy_staging" {
  count = var.enable_staging_deploy_identity ? 1 : 0

  project      = var.staging_project_id
  account_id   = var.staging_deploy_sa_id
  display_name = "GitHub Actions blackbook-staging deploy (WIF)"
  description  = "ADR-012 blackbook-staging deploy identity. Synthetic data only; still not a security-critical identity, but now project-isolated from blackbook-prod."
}

// Optional blackbook-internal deploy SA (ADR-012: research pipeline + admin project).
resource "google_service_account" "github_deploy_internal" {
  count = var.enable_internal_deploy_identity ? 1 : 0

  project      = var.internal_project_id
  account_id   = var.internal_deploy_sa_id
  display_name = "GitHub Actions blackbook-internal deploy (WIF)"
  description  = "ADR-012 blackbook-internal deploy identity for research/publication/security/admin. Never has any IAM in blackbook-prod."
}
