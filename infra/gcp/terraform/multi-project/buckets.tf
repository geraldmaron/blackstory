// private-evidence bucket for blackbook-internal (ADR-012 gap fix, BB-078 course-correction).
// The original BB-005 single-project stub (../buckets.tf) created this bucket in
// blackbook-prod (black-book-efaaf); ADR-012 relocates it here because its only writers -
// research and security - both move to blackbook-internal too (see ../locals.tf's
// service_accounts map and infra/gcp/wif/deploy-roles.md's "ADR-012 change" note). Gated
// behind provision_internal_buckets (default false); requires blackbook-internal to already
// exist. This is a same-project bucket for blackbook-internal, not a cross-project grant, so
// it does not appear in iam-cross-project.tf or in isolation-matrix.json's crossProjectGrants
// array - moving the bucket here removes the need for any cross-project grant at all.

resource "google_storage_bucket" "internal" {
  for_each = var.provision_internal_buckets ? local.internal_buckets : {}

  project                     = var.internal_project_id
  name                        = "${var.internal_project_id}-${each.key}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = each.value == "enforced" ? "enforced" : "inherited"
  force_destroy               = false
}

// --- private-evidence: research/security write; admin-app/publication read - all four now
//     same-project in blackbook-internal. No blackbook-prod principal (api-internal,
//     web-runtime, ...) is granted access here: that would violate the ADR-012 "prod ->
//     internal: none" invariant (see iam-cross-project.tf's header comment and ADR-012's
//     "One-way promotion IAM asymmetry" table). Gated behind both provision_internal_buckets
//     and provision_internal_service_accounts, since the members referenced below only exist
//     once the latter is applied. ---

resource "google_storage_bucket_iam_member" "private_evidence_writers" {
  for_each = (var.provision_internal_buckets && var.provision_internal_service_accounts) ? toset(["research", "security"]) : toset([])

  bucket = google_storage_bucket.internal["private-evidence"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.internal[each.key].email}"
}

resource "google_storage_bucket_iam_member" "private_evidence_readers" {
  for_each = (var.provision_internal_buckets && var.provision_internal_service_accounts) ? toset(["admin-app", "publication"]) : toset([])

  bucket = google_storage_bucket.internal["private-evidence"].name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.internal[each.key].email}"
}
