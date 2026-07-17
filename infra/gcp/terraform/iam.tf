// Bucket IAM bindings that encode the isolation invariants. These are representative
// least-privilege grants; runtime/project role bindings live in later beads. Anything
// not granted here is denied by default.

// --- public-media: writers = publication/security/api-internal; readers = public serving SAs ---

resource "google_storage_bucket_iam_member" "public_media_publication" {
  bucket = google_storage_bucket.boundary["public-media"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.surface["publication"].email}"
}

resource "google_storage_bucket_iam_member" "public_media_api_internal" {
  bucket = google_storage_bucket.boundary["public-media"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.surface["api-internal"].email}"
}

resource "google_storage_bucket_iam_member" "public_media_security_write" {
  bucket = google_storage_bucket.boundary["public-media"].name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.surface["security"].email}"
}

resource "google_storage_bucket_iam_member" "public_media_readers" {
  for_each = toset(["web-runtime", "api-public", "admin"])

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

// --- quarantine: api-submissions may CREATE only; security scans (admin). No public, no read-back. ---

resource "google_storage_bucket_iam_member" "quarantine_submissions_create" {
  bucket = google_storage_bucket.boundary["quarantine"].name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.surface["api-submissions"].email}"
}

resource "google_storage_bucket_iam_member" "quarantine_security" {
  bucket = google_storage_bucket.boundary["quarantine"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.surface["security"].email}"
}

// --- exports: publication/api-internal write; delivery is via short-TTL signed URLs only. ---

resource "google_storage_bucket_iam_member" "exports_writers" {
  for_each = toset(["publication", "api-internal"])

  bucket = google_storage_bucket.boundary["exports"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.surface[each.key].email}"
}

// --- private evidence: research/security write; publication/admin/api-internal read.
//     Public serving SAs (web-runtime, api-public) are intentionally absent. ---

resource "google_storage_bucket_iam_member" "private_evidence_research_write" {
  bucket = google_storage_bucket.boundary["private-evidence"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.surface["research"].email}"
}

resource "google_storage_bucket_iam_member" "private_evidence_security_write" {
  bucket = google_storage_bucket.boundary["private-evidence"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.surface["security"].email}"
}

resource "google_storage_bucket_iam_member" "private_evidence_readers" {
  for_each = toset(["publication", "admin", "api-internal"])

  bucket = google_storage_bucket.boundary["private-evidence"].name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.surface[each.key].email}"
}

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
