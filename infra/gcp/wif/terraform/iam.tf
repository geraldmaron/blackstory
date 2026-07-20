# IAM bindings for WIF impersonation and least-privilege deploy roles (BB-010, extended by
# ADR-012/BB-078 for the three-project split). Each github-deploy* identity must never receive
# exported keys or unprotected-context trust, and must never hold IAM in a project other than
# its own (that asymmetry is the point of ADR-012's CI/CD identity split).
# Production SA must already exist (BB-005/011); this module does not create it.
# GCP service-account IDs must be 6-30 chars; logical "admin" (5) is omitted from ActAs lists
# until the matrix uses a valid account_id (see deploy-roles.md; internal list uses "admin-app").

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
  # deploy_project_roles (run.admin, firebaseapphosting.admin, artifactregistry.writer) is the
  # minimum set a CD identity needs to deploy Cloud Run + App Hosting; scoped to this project
  # only, mirrored for staging/internal below.
  #trivy:ignore:AVD-GCP-0007
  role   = each.value
  member = "serviceAccount:${local.production_deploy_sa_email}"
}

# --- blackbook-staging (ADR-012: distinct project, not a same-project namespace) ---

resource "google_service_account_iam_member" "github_deploy_staging_wif_user" {
  count = var.enable_staging_deploy_identity ? 1 : 0

  service_account_id = google_service_account.github_deploy_staging[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.staging_principal_set
}

resource "google_service_account_iam_member" "github_deploy_staging_act_as_runtime" {
  for_each = (
    var.enable_staging_deploy_identity
    ? toset([for id in var.staging_runtime_sa_ids : id if length(id) >= 6])
    : toset([])
  )

  service_account_id = "projects/${var.staging_project_id}/serviceAccounts/${each.key}@${var.staging_project_id}.iam.gserviceaccount.com"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_deploy_staging[0].email}"
}

resource "google_project_iam_member" "github_deploy_staging_roles" {
  for_each = (
    var.enable_staging_deploy_identity && var.manage_deploy_project_roles
    ? local.deploy_project_roles
    : toset([])
  )

  project = var.staging_project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_deploy_staging[0].email}"
}

# --- blackbook-internal (ADR-012: research pipeline + admin project) ---

resource "google_service_account_iam_member" "github_deploy_internal_wif_user" {
  count = var.enable_internal_deploy_identity ? 1 : 0

  service_account_id = google_service_account.github_deploy_internal[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.internal_principal_set
}

resource "google_service_account_iam_member" "github_deploy_internal_act_as_runtime" {
  for_each = (
    var.enable_internal_deploy_identity
    ? toset([for id in var.internal_runtime_sa_ids : id if length(id) >= 6])
    : toset([])
  )

  service_account_id = "projects/${var.internal_project_id}/serviceAccounts/${each.key}@${var.internal_project_id}.iam.gserviceaccount.com"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_deploy_internal[0].email}"
}

resource "google_project_iam_member" "github_deploy_internal_roles" {
  for_each = (
    var.enable_internal_deploy_identity && var.manage_deploy_project_roles
    ? local.deploy_project_roles
    : toset([])
  )

  project = var.internal_project_id
  #trivy:ignore:AVD-GCP-0007
  role   = each.value
  member = "serviceAccount:${google_service_account.github_deploy_internal[0].email}"
}
