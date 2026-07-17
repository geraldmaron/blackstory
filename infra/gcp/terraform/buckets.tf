// Four distinct same-project buckets with Uniform Bucket-Level Access. Every bucket
// except public-media has Public Access Prevention ENFORCED.

resource "google_storage_bucket" "boundary" {
  for_each = local.buckets

  project                     = var.project_id
  name                        = "${local.prefix}-${each.key}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = each.value == "enforced" ? "enforced" : "inherited"
  force_destroy               = false

  versioning {
    enabled = each.key == "private-evidence"
  }
}
