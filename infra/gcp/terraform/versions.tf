// Provider and Terraform version constraints for the BB-005 isolation stubs.
// These configs are NOT applied; they document a reproducible baseline for later beads.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0, < 7.0.0"
    }
  }

  // A remote backend (per environment) is configured in BB-010/BB-011, e.g.:
  // backend "gcs" { bucket = "blackbook-<env>-tfstate" prefix = "gcp-isolation" }
}
