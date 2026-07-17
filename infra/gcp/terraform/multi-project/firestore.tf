// Named Firestore databases (GA feature) inside blackbook-internal: raw-ingest and curated.
// Per-database IAM conditions live in iam-cross-project.tf. Gated behind
// provision_internal_databases (default false); requires blackbook-internal to already exist.
// PITR is a separate gate, internal_firestore_pitr_enabled (default false, like every other
// provisioning switch in this module) - flip only after a human reviews cost/RPO tradeoffs.
//
// blackbook-prod and blackbook-staging keep a single (default) database each - unchanged from
// the original BB-005 single-database design - so no google_firestore_database resource is
// needed for them here.

resource "google_firestore_database" "internal" {
  for_each = var.provision_internal_databases ? local.internal_named_databases : {}

  project     = var.internal_project_id
  name        = each.key
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  concurrency_mode                  = "OPTIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  delete_protection_state           = "DELETE_PROTECTION_ENABLED"
  point_in_time_recovery_enablement = var.internal_firestore_pitr_enabled ? "POINT_IN_TIME_RECOVERY_ENABLED" : "POINT_IN_TIME_RECOVERY_DISABLED"
}
