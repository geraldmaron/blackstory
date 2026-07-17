// Derived data for the ADR-012 three-project topology. Mirrors
// docs/adr/ADR-012-production-environment-resplit.md and infra/gcp/isolation-matrix.json's
// productionResplitTarget / crossProjectGrants; keep the three in sync.

locals {
  // blackbook-staging mirrors blackbook-prod's runtime surface shape exactly (ADR-012:
  // "mirror of prod shape"). Same set as the updated ../../wif/terraform runtime_sa_ids.
  staging_service_accounts = {
    "web-runtime"     = "Public web (App Hosting) runtime - staging mirror"
    "api-public"      = "Public read/search/location API - staging mirror"
    "api-submissions" = "Corrections / contribution intake API - staging mirror"
    "api-internal"    = "Private internal control API - staging mirror"
    "migrations"      = "Database migration runner - staging mirror"
    "backup"          = "Backup / PITR / export runner - staging mirror"
  }

  // blackbook-internal hosts the research pipeline, admin console, and the cross-project
  // promotion/pull identities. "admin" (5 chars) is invalid as a GCP account ID; use
  // "admin-app" (see infra/gcp/wif/deploy-roles.md).
  internal_service_accounts = {
    "admin-app"          = "Admin / research console runtime identity (Cloud Run + IAP, direct attach - no load balancer)"
    "research"           = "Research worker; writes the raw-ingest named database only"
    "publication"        = "Curation worker; reads raw-ingest, writes curated"
    "security"           = "Quarantine / validation / integrity worker; cross-project into blackbook-prod quarantine + public-media"
    "promotion"          = "Cross-project promotion identity; reads curated, is the ONLY writer of blackbook-prod public/** projections"
    "submissions-puller" = "Cross-project puller; read-only on blackbook-prod's create-only submissions collection"
  }

  // Named Firestore databases inside blackbook-internal (GA feature). Per-database IAM
  // conditions in iam-cross-project.tf enforce that research writes raw-ingest only and
  // promotion reads curated only.
  internal_named_databases = {
    "raw-ingest" = "High-volume research ingestion writes; isolated hotspot, own IAM/billing visibility."
    "curated"    = "Reviewed/normalized data staged for promotion; distinct IAM from raw-ingest."
  }

  // Buckets inside blackbook-internal. private-evidence relocates here from the original
  // BB-005 single-project stub (../buckets.tf) because both of its writers - research and
  // security - move to blackbook-internal under ADR-012; colocating the bucket with its only
  // writers is the more defensible default now that it need not be same-project with
  // publication/admin/api-internal (which read it, but under ADR-012 only admin-app and
  // publication remain reachable without a new cross-project grant - see buckets.tf).
  internal_buckets = {
    "private-evidence" = "enforced"
  }

  // The entire ADR-012 cross-project grant list (internal -> prod only; zero prod -> internal).
  // Mirrors infra/gcp/isolation-matrix.json's crossProjectGrants array.
  cross_project_grants = {
    promotion_firestore = {
      member    = "promotion"
      role      = "roles/datastore.user"
      condition = "resource.name.startsWith(\"projects/${var.prod_project_id}/databases/(default)/documents/public/\")"
      title     = "adr012-promotion-public-projections-only"
    }
    submissions_puller_firestore = {
      member    = "submissions-puller"
      role      = "roles/datastore.viewer"
      condition = "resource.name.startsWith(\"projects/${var.prod_project_id}/databases/(default)/documents/submissions/\")"
      title     = "adr012-puller-submissions-only"
    }
  }
}
