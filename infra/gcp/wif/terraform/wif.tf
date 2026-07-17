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

// Optional staging deploy SA (same project; configuration separation only).
resource "google_service_account" "github_deploy_staging" {
  count = var.enable_staging_deploy_identity ? 1 : 0

  project      = var.project_id
  account_id   = var.staging_deploy_sa_id
  display_name = "GitHub Actions staging deploy (WIF, non-isolated)"
  description  = "Optional same-project staging deploy identity. Not a security boundary."
}
