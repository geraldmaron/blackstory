# Inputs for GitHub Actions Workload Identity Federation (BB-010).
# Numeric GitHub IDs stay empty until a remote exists; plan fails closed without them.

variable "project_id" {
  description = "Existing production GCP/Firebase project ID."
  type        = string
  default     = "black-book-efaaf"

  validation {
    condition     = var.project_id == "black-book-efaaf"
    error_message = "Current single-project mode requires project_id = black-book-efaaf."
  }
}

variable "project_number" {
  description = "Numeric GCP project number for principalSet URIs."
  type        = string
  default     = "332234323945"
}

variable "region" {
  description = "Primary region (WIF pool is global; used for provider default)."
  type        = string
  default     = "us-central1"
}

variable "github_owner" {
  description = "GitHub owner/org login (name, not ID). TBD until remote exists."
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "GitHub repository name (without owner). TBD until remote exists."
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

variable "wif_pool_id" {
  description = "Workload Identity Pool ID."
  type        = string
  default     = "black-book-github"
}

variable "wif_provider_id" {
  description = "OIDC provider ID inside the pool."
  type        = string
  default     = "github-actions"
}

variable "production_workflow_file" {
  description = "Path to the production deploy workflow under the repo root."
  type        = string
  default     = ".github/workflows/deploy-production.yml"
}

variable "production_environment" {
  description = "Protected GitHub Environment name required for production deploy."
  type        = string
  default     = "production"
}

variable "production_deploy_sa_id" {
  description = "Account ID of the production deploy service account (BB-005)."
  type        = string
  default     = "github-deploy"
}

variable "enable_staging_deploy_identity" {
  description = "When true, create optional same-project staging deploy SA + WIF binding (not a security boundary)."
  type        = bool
  default     = false
}

variable "staging_environment" {
  description = "GitHub Environment name for optional staging deploys."
  type        = string
  default     = "staging"
}

variable "staging_deploy_sa_id" {
  description = "Account ID for optional staging deploy SA."
  type        = string
  default     = "github-deploy-staging"
}

variable "runtime_sa_ids" {
  description = "Runtime SAs that github-deploy may ActAs at deploy time."
  type        = list(string)
  default = [
    "web-runtime",
    "api-public",
    "api-submissions",
    "api-internal",
    "admin",
    "migrations",
    "publication",
    "security",
    "research",
    "backup",
  ]
}

variable "manage_deploy_project_roles" {
  description = "Grant project-level deploy roles to github-deploy (set false if roles are managed elsewhere)."
  type        = bool
  default     = true
}
