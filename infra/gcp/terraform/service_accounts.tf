// Least-privilege service accounts, one per surface. Project-level roles are
// intentionally minimal here; runtime role bindings (Cloud SQL client, secret
// accessor on named secrets, etc.) are attached in BB-011/BB-012/BB-021+.

resource "google_service_account" "surface" {
  for_each = local.service_accounts

  project      = var.project_id
  account_id   = each.key
  display_name = "${var.environment}: ${each.value}"
}
