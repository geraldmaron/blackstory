// Bucket IAM bindings that encode the isolation invariants. These are representative
// least-privilege grants; runtime/project role bindings live in later beads. Anything
// not granted here is denied by default.

// --- public-media: writers = api-internal (same project) + promotion/security (cross-project,
//     blackbook-internal, see infra/gcp/terraform/multi-project/iam-cross-project.tf); readers =
//     public serving SAs. publication and security no longer live in this project under ADR-012
//     (see locals.tf); their former public-media grants here are replaced by the cross-project
//     grants promotion-write-prod-buckets and security-quarantine-prod. ---

resource "google_storage_bucket_iam_member" "public_media_api_internal" {
  bucket = google_storage_bucket.boundary["public-media"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.surface["api-internal"].email}"
}

resource "google_storage_bucket_iam_member" "public_media_readers" {
  for_each = toset(["web-runtime", "api-public"])

  bucket = google_storage_bucket.boundary["public-media"].name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.surface[each.key].email}"
}

// Optional direct public read; prefer CDN-fronted delivery (default false).
resource "google_storage_bucket_iam_member" "public_media_all_users" {
  count = var.public_media_public_read ? 1 : 0

  bucket = google_storage_bucket.boundary["public-media"].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

// --- quarantine: api-submissions may CREATE only; security scans cross-project from
//     blackbook-internal (see infra/gcp/terraform/multi-project/iam-cross-project.tf's
//     security_admins_prod_quarantine, ADR-012). No public, no read-back. ---

resource "google_storage_bucket_iam_member" "quarantine_submissions_create" {
  bucket = google_storage_bucket.boundary["quarantine"].name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.surface["api-submissions"].email}"
}

// --- exports: api-internal writes (same project); promotion writes cross-project from
//     blackbook-internal (see multi-project/iam-cross-project.tf's promotion_writes_prod_exports).
//     Delivery is via short-TTL signed URLs only. ---

resource "google_storage_bucket_iam_member" "exports_writers" {
  for_each = toset(["api-internal"])

  bucket = google_storage_bucket.boundary["exports"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.surface[each.key].email}"
}

// --- private-evidence bucket removed from this project under ADR-012: both of its writers
//     (research, security) relocate to blackbook-internal, so the bucket and its IAM now live
//     in infra/gcp/terraform/multi-project/buckets.tf instead of here. See locals.tf's buckets
//     map and docs/adr/ADR-012-production-environment-resplit.md. ---

// --- Organization policy backstops (only when this workspace manages org policies). ---

resource "google_project_organization_policy" "disable_sa_keys" {
  count = var.manage_org_policies ? 1 : 0

  project    = var.project_id
  constraint = "iam.disableServiceAccountKeyCreation"

  boolean_policy {
    enforced = true
  }
}

resource "google_project_organization_policy" "restrict_public_ip" {
  count = var.manage_org_policies ? 1 : 0

  project    = var.project_id
  constraint = "sql.restrictPublicIp"

  boolean_policy {
    enforced = true
  }
}

// Public Access Prevention is enforced org-wide via constraints/storage.publicAccessPrevention;
// the only documented exception is black-book-efaaf-public-media. Manage that policy during
// production bootstrap after confirming the chosen CDN/public-serving topology.
