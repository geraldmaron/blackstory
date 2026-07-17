# Terraform version constraints for GitHub Actions WIF stubs (BB-010).
# These configs are NOT applied by default; use apply-wif.sh after review.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0, < 7.0.0"
    }
  }

  // Remote state is optional until a GCS state bucket exists, e.g.:
  // backend "gcs" { bucket = "black-book-efaaf-tfstate" prefix = "wif" }
}
