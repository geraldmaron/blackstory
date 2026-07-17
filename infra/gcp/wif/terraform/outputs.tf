# Outputs for wiring GitHub Actions google-github-actions/auth (BB-010).

output "workload_identity_provider" {
  description = "Full resource name for google-github-actions/auth workload_identity_provider."
  value       = google_iam_workload_identity_pool_provider.github_actions.name
}

output "workload_identity_pool_name" {
  description = "Full workload identity pool resource name."
  value       = google_iam_workload_identity_pool.github.name
}

output "production_service_account_email" {
  description = "Production deploy SA email impersonated via WIF."
  value       = local.production_deploy_sa_email
}

output "staging_service_account_email" {
  description = "Optional blackbook-staging deploy SA email (null when disabled)."
  value = (
    var.enable_staging_deploy_identity
    ? google_service_account.github_deploy_staging[0].email
    : null
  )
}

output "internal_service_account_email" {
  description = "Optional blackbook-internal deploy SA email (null when disabled)."
  value = (
    var.enable_internal_deploy_identity
    ? google_service_account.github_deploy_internal[0].email
    : null
  )
}

output "github_ids_ready" {
  description = "True when numeric GitHub IDs and owner/repo names are set."
  value       = local.github_ids_ready
}

output "attribute_condition" {
  description = "Provider CEL attribute condition (redact in public logs if needed)."
  value       = local.attribute_condition
  sensitive   = false
}
