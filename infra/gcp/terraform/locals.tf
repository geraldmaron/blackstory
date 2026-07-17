// Derived isolation data. Mirrors infra/gcp/isolation-matrix.json; keep the two in sync.

locals {
  prefix = var.environment == "production" ? var.project_id : "${var.project_id}-${var.environment}"

  // One least-privilege service account per surface in black-book-efaaf.
  service_accounts = {
    "web-runtime"     = "Public web (App Hosting) runtime"
    "api-public"      = "Public read/search/location API"
    "api-submissions" = "Corrections / contribution intake API"
    "api-internal"    = "Private publication / internal control API"
    "admin"           = "Admin / research console (IAP)"
    "publication"     = "Projection / snapshot / release worker"
    "security"        = "Quarantine / validation / integrity worker"
    "migrations"      = "Database migration runner"
    "backup"          = "Backup / PITR / export runner"
    "github-deploy"   = "GitHub Actions deploy identity (WIF)"
    "research"        = "Research worker (non-publishing)"
  }

  // Four disjoint buckets in the same project; IAM remains bucket-scoped.
  buckets = {
    "public-media"     = "inherited"
    "private-evidence" = "enforced"
    "exports"          = "enforced"
    "quarantine"       = "enforced"
  }
}
