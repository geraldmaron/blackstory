// ADR-012 one-way promotion IAM asymmetry. Every resource in this file that grants an
// internal identity access to a blackbook-prod resource is gated behind
// apply_cross_project_iam (default false). There is intentionally no resource anywhere in
// this module that grants a blackbook-prod identity any IAM in blackbook-internal - that
// absence is the invariant, not an omission. See docs/adr/ADR-012-production-environment-resplit.md
// and infra/gcp/isolation-matrix.json (crossProjectGrants).

// --- internal -> prod: promotion writes public/** projections (Firestore) ---

resource "google_project_iam_member" "promotion_writes_prod_firestore" {
  count = var.apply_cross_project_iam ? 1 : 0

  project = var.prod_project_id
  role    = local.cross_project_grants.promotion_firestore.role
  member  = "serviceAccount:${google_service_account.internal["promotion"].email}"

  condition {
    title       = local.cross_project_grants.promotion_firestore.title
    description = "ADR-012: promotion may write only blackbook-prod's public/** Firestore projections, never raw canonical/internal paths."
    expression  = local.cross_project_grants.promotion_firestore.condition
  }
}

// --- internal -> prod: promotion writes public-media/exports buckets ---
// Bucket names/resources are owned by ../*.tf (the original single-project stubs); referenced
// here by name only, not created or imported into this module's state.

resource "google_storage_bucket_iam_member" "promotion_writes_prod_public_media" {
  count = var.apply_cross_project_iam ? 1 : 0

  bucket = "${var.prod_project_id}-public-media"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.internal["promotion"].email}"
}

resource "google_storage_bucket_iam_member" "promotion_writes_prod_exports" {
  count = var.apply_cross_project_iam ? 1 : 0

  bucket = "${var.prod_project_id}-exports"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.internal["promotion"].email}"
}

// --- internal -> prod: security scans/promotes quarantine + public-media (post-scan) ---

resource "google_storage_bucket_iam_member" "security_admins_prod_quarantine" {
  count = var.apply_cross_project_iam ? 1 : 0

  bucket = "${var.prod_project_id}-quarantine"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.internal["security"].email}"
}

resource "google_storage_bucket_iam_member" "security_creates_prod_public_media" {
  count = var.apply_cross_project_iam ? 1 : 0

  bucket = "${var.prod_project_id}-public-media"
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.internal["security"].email}"
}

// --- internal -> prod: submissions-puller reads the create-only submissions collection ---

resource "google_project_iam_member" "puller_reads_prod_submissions" {
  count = var.apply_cross_project_iam ? 1 : 0

  project = var.prod_project_id
  role    = local.cross_project_grants.submissions_puller_firestore.role
  member  = "serviceAccount:${google_service_account.internal["submissions-puller"].email}"

  condition {
    title       = local.cross_project_grants.submissions_puller_firestore.title
    description = "ADR-012: submissions-puller may read only blackbook-prod's create-only submissions collection. No write grant exists for this identity in either direction."
    expression  = local.cross_project_grants.submissions_puller_firestore.condition
  }
}

// --- within blackbook-internal: per-database IAM conditions (hotspot isolation) ---
// research writes raw-ingest only; publication (curation worker) reads raw-ingest and writes
// curated; promotion reads curated only (its prod write grant is above, not here); admin-app
// gets read-only visibility across both for the research console.

resource "google_project_iam_member" "research_writes_raw_ingest" {
  count = var.apply_cross_project_iam ? 1 : 0

  project = var.internal_project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.internal["research"].email}"

  condition {
    title       = "adr012-research-raw-ingest-only"
    description = "research writes the raw-ingest named database only; never curated."
    expression  = "resource.name.startsWith(\"projects/${var.internal_project_id}/databases/raw-ingest\")"
  }
}

resource "google_project_iam_member" "publication_reads_raw_ingest" {
  count = var.apply_cross_project_iam ? 1 : 0

  project = var.internal_project_id
  role    = "roles/datastore.viewer"
  member  = "serviceAccount:${google_service_account.internal["publication"].email}"

  condition {
    title       = "adr012-publication-reads-raw-ingest"
    description = "Curation worker reads raw-ingest to produce curated; read-only on raw-ingest."
    expression  = "resource.name.startsWith(\"projects/${var.internal_project_id}/databases/raw-ingest\")"
  }
}

resource "google_project_iam_member" "publication_writes_curated" {
  count = var.apply_cross_project_iam ? 1 : 0

  project = var.internal_project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.internal["publication"].email}"

  condition {
    title       = "adr012-publication-writes-curated"
    description = "Curation worker writes curated only; never raw-ingest, never blackbook-prod directly."
    expression  = "resource.name.startsWith(\"projects/${var.internal_project_id}/databases/curated\")"
  }
}

resource "google_project_iam_member" "promotion_reads_curated" {
  count = var.apply_cross_project_iam ? 1 : 0

  project = var.internal_project_id
  role    = "roles/datastore.viewer"
  member  = "serviceAccount:${google_service_account.internal["promotion"].email}"

  condition {
    title       = "adr012-promotion-reads-curated-only"
    description = "promotion reads curated only and has no write access to raw-ingest - a compromised research adapter writing raw-ingest cannot reach promotion's blackbook-prod write grant through a shared database."
    expression  = "resource.name.startsWith(\"projects/${var.internal_project_id}/databases/curated\")"
  }
}

resource "google_project_iam_member" "admin_reads_internal_databases" {
  count = var.apply_cross_project_iam ? 1 : 0

  project = var.internal_project_id
  role    = "roles/datastore.viewer"
  member  = "serviceAccount:${google_service_account.internal["admin-app"].email}"

  condition {
    title       = "adr012-admin-reads-both-internal-databases"
    description = "Admin console read-only visibility into both named databases for the research console. No write grant; no blackbook-prod grant of any kind."
    expression  = "resource.name.startsWith(\"projects/${var.internal_project_id}/databases/raw-ingest\") || resource.name.startsWith(\"projects/${var.internal_project_id}/databases/curated\")"
  }
}
