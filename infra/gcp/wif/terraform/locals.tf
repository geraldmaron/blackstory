# Derived WIF locals. Trust conditions fail closed when GitHub IDs are unset.

locals {
  github_ids_ready = (
    var.github_repository_id != "" &&
    var.github_owner_id != "" &&
    var.github_owner != "" &&
    var.github_repository != ""
  )

  github_full_name = "${var.github_owner}/${var.github_repository}"

  production_workflow_ref_prefix = (
    "${local.github_full_name}/${var.production_workflow_file}@refs/heads/main"
  )

  staging_workflow_ref_prefix = (
    "${local.github_full_name}/.github/workflows/deploy-staging.yml@refs/heads/main"
  )

  // Provider-level CEL: numeric IDs + main + (production | optional staging) environment/workflow.
  // Empty IDs intentionally produce an impossible condition so plan/apply cannot
  // accidentally create a wide-open provider. IAM principal sets further bind each
  // environment claim to the matching deploy SA.
  production_trust = join(" && ", [
    "assertion.environment == \"${var.production_environment}\"",
    "assertion.workflow_ref.startsWith(\"${local.production_workflow_ref_prefix}\")",
  ])

  staging_trust = join(" && ", [
    "assertion.environment == \"${var.staging_environment}\"",
    "assertion.workflow_ref.startsWith(\"${local.staging_workflow_ref_prefix}\")",
  ])

  environment_trust = (
    var.enable_staging_deploy_identity
    ? "(${local.production_trust}) || (${local.staging_trust})"
    : "(${local.production_trust})"
  )

  attribute_condition = local.github_ids_ready ? join(" && ", [
    "assertion.repository_id == \"${var.github_repository_id}\"",
    "assertion.repository_owner_id == \"${var.github_owner_id}\"",
    "assertion.ref == \"refs/heads/main\"",
    "(${local.environment_trust})",
  ]) : "assertion.repository_id == \"0\" && false"

  pool_name = (
    "projects/${var.project_number}/locations/global/workloadIdentityPools/${var.wif_pool_id}"
  )

  production_principal_set = (
    "principalSet://iam.googleapis.com/${local.pool_name}/attribute.environment/${var.production_environment}"
  )

  staging_principal_set = (
    "principalSet://iam.googleapis.com/${local.pool_name}/attribute.environment/${var.staging_environment}"
  )

  deploy_project_roles = toset([
    "roles/run.admin",
    "roles/firebaseapphosting.admin",
    "roles/artifactregistry.writer",
  ])

  // Production deploy SA is created by BB-005/011 stubs; reference by email (no data source).
  production_deploy_sa_email = "${var.production_deploy_sa_id}@${var.project_id}.iam.gserviceaccount.com"
}
