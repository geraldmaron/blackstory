// Derived isolation data. Mirrors infra/gcp/isolation-matrix.json; keep the two in sync.

locals {
  prefix = var.environment == "production" ? var.project_id : "${var.project_id}-${var.environment}"

  // One least-privilege service account per surface retained in blackbook-prod
  // (black-book-efaaf) under ADR-012. admin, publication, security, and research are
  // intentionally absent here, not an oversight: infra/gcp/wif/deploy-roles.md's "ADR-012
  // change" note and infra/gcp/terraform/multi-project/locals.tf's internal_service_accounts
  // both place those four identities in blackbook-internal instead. See
  // docs/adr/ADR-012-production-environment-resplit.md and
  // infra/gcp/terraform/multi-project/service_accounts.tf.
  service_accounts = {
    "web-runtime"     = "Public web (App Hosting) runtime"
    "api-public"      = "Public read/search/location API"
    "api-submissions" = "Corrections / contribution intake API"
    "api-internal"    = "Private publication / internal control API"
    "migrations"      = "Database migration runner"
    "backup"          = "Backup / PITR / export runner"
    "github-deploy"   = "GitHub Actions deploy identity (WIF)"
  }

  // Three disjoint buckets in the same project; IAM remains bucket-scoped. private-evidence
  // is intentionally absent here: ADR-012 relocates it to blackbook-internal because both of
  // its writers (research, security) move there too - see
  // infra/gcp/terraform/multi-project/buckets.tf.
  buckets = {
    "public-media" = "inherited"
    "exports"      = "enforced"
    "quarantine"   = "enforced"
  }
}
