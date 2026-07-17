// Provider and Terraform version constraints for the ADR-012 three-project re-split stubs
// (BB-078). These configs are NOT applied; they document a reproducible baseline for BB-079.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0, < 7.0.0"
    }
  }

  // A remote backend (per project) is configured in BB-079, e.g.:
  // backend "gcs" { bucket = "blackbook-prod-tfstate" prefix = "multi-project" }
}
