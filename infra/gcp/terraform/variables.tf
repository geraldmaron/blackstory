// Inputs for the BB-005 single-project production isolation stubs.
// These defaults identify the existing project; no secret values belong here.

variable "environment" {
  description = "Configuration namespace inside the production project."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be one of: development, staging, production."
  }
}

variable "project_id" {
  description = "Existing production GCP/Firebase project ID."
  type        = string
  default     = "black-book-efaaf"

  validation {
    condition     = var.project_id == "black-book-efaaf"
    error_message = "Current single-project mode requires project_id = black-book-efaaf."
  }
}

variable "region" {
  description = "Primary resource location (approved US region)."
  type        = string
  default     = "us-central1"
}

variable "org_id" {
  description = "GCP organization ID (for org policies; optional in stubs)."
  type        = string
  default     = ""
}

variable "billing_account" {
  description = "Billing account ID to link projects to (optional in stubs)."
  type        = string
  default     = ""
}

variable "github_repository_id" {
  description = "Numeric GitHub repository ID used in WIF trust conditions (ADR-006)."
  type        = string
  default     = ""
}

variable "github_owner_id" {
  description = "Numeric GitHub owner/org ID used in WIF trust conditions (ADR-006)."
  type        = string
  default     = ""
}

variable "manage_org_policies" {
  description = "Whether this workspace manages org policies (requires org-level permissions)."
  type        = bool
  default     = false
}

variable "public_media_public_read" {
  description = "Grant allUsers read on public-media instead of serving via CDN. Prefer false (CDN-fronted)."
  type        = bool
  default     = false
}
