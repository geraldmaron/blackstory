# IAM bindings for WIF impersonation and least-privilege deploy roles (BB-010).
# github-deploy must never receive exported keys or unprotected-context trust.
# Production SA must already exist (BB-005/011); this module does not create it.
# GCP service-account IDs must be 6–30 chars; logical "admin" (5) is omitted from ActAs
# until the matrix uses a valid account_id (see deploy-roles.md).

resource "google_service_account_iam_member" "github_deploy_wif_user" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${local.production_deploy_sa_email}"
  role               = "roles/iam.workloadIdentityUser"
  member             = local.production_principal_set
}

resource "google_service_account_iam_member" "github_deploy_act_as_runtime" {
  for_each = toset([for id in var.runtime_sa_ids : id if length(id) >= 6])

  service_account_id = "projects/${var.project_id}/serviceAccounts/${each.key}@${var.project_id}.iam.gserviceaccount.com"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${local.production_deploy_sa_email}"
}

resource "google_project_iam_member" "github_deploy_roles" {
  for_each = var.manage_deploy_project_roles ? local.deploy_project_roles : toset([])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${local.production_deploy_sa_email}"
}

resource "google_service_account_iam_member" "github_deploy_staging_wif_user" {
  count = var.enable_staging_deploy_identity ? 1 : 0

  service_account_id = google_service_account.github_deploy_staging[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.staging_principal_set
}

resource "google_project_iam_member" "github_deploy_staging_roles" {
  for_each = (
    var.enable_staging_deploy_identity && var.manage_deploy_project_roles
    ? local.deploy_project_roles
    : toset([])
  )

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_deploy_staging[0].email}"
}
