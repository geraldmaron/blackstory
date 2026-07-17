# Inputs for GitHub Actions Workload Identity Federation (BB-010).
# Numeric GitHub IDs stay empty until a remote exists; plan fails closed without them.

variable "project_id" {
  description = "blackbook-prod GCP/Firebase project ID (ADR-012; retained as black-book-efaaf, not recreated). Also hosts the WIF pool/provider - one pool serves all three projects (ADR-012 CI/CD identity split)."
  type        = string
  default     = "black-book-efaaf"

  validation {
    condition     = var.project_id == "black-book-efaaf"
    error_message = "blackbook-prod keeps the existing project_id = black-book-efaaf (ADR-012)."
  }
}

variable "project_number" {
  description = "Numeric GCP project number for blackbook-prod (black-book-efaaf), used in the WIF pool's principalSet URIs."
  type        = string
  default     = "332234323945"
}

variable "staging_project_id" {
  description = "blackbook-staging GCP project ID (ADR-012; new project, TBD until created). Deploy SA and IAM bindings target this project even though the WIF pool itself lives in blackbook-prod."
  type        = string
  default     = "blackbook-staging"
}

variable "internal_project_id" {
  description = "blackbook-internal GCP project ID (ADR-012; new project, TBD until created). Hosts research/admin/promotion deploy identity."
  type        = string
  default     = "blackbook-internal"
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
  description = "When true, create the optional blackbook-staging deploy SA + WIF binding (ADR-012: separate project, not a same-project namespace; still not a substitute for reviewing staging deploys)."
  type        = bool
  default     = false
}

variable "staging_environment" {
  description = "GitHub Environment name for optional staging deploys."
  type        = string
  default     = "staging"
}

variable "staging_deploy_sa_id" {
  description = "Account ID for optional staging deploy SA (created in staging_project_id, ADR-012)."
  type        = string
  default     = "github-deploy-staging"
}

variable "enable_internal_deploy_identity" {
  description = "When true, create the optional blackbook-internal deploy SA + WIF binding (ADR-012: research/admin/promotion project)."
  type        = bool
  default     = false
}

variable "internal_environment" {
  description = "GitHub Environment name for optional internal (research/admin) deploys."
  type        = string
  default     = "internal"
}

variable "internal_deploy_sa_id" {
  description = "Account ID for optional internal deploy SA (created in internal_project_id, ADR-012)."
  type        = string
  default     = "github-deploy-internal"
}

variable "runtime_sa_ids" {
  description = "blackbook-prod runtime SAs that github-deploy may ActAs at deploy time (ADR-012: prod keeps only the public-serving surfaces; admin/research/publication/security move to blackbook-internal)."
  type        = list(string)
  default = [
    "web-runtime",
    "api-public",
    "api-submissions",
    "api-internal",
    "migrations",
    "backup",
  ]
}

variable "staging_runtime_sa_ids" {
  description = "blackbook-staging runtime SAs that github-deploy-staging may ActAs at deploy time (ADR-012: mirrors blackbook-prod's shape)."
  type        = list(string)
  default = [
    "web-runtime",
    "api-public",
    "api-submissions",
    "api-internal",
    "migrations",
    "backup",
  ]
}

variable "internal_runtime_sa_ids" {
  description = "blackbook-internal runtime SAs that github-deploy-internal may ActAs at deploy time (ADR-012: research pipeline + admin + cross-project promotion identities)."
  type        = list(string)
  default = [
    "admin-app",
    "publication",
    "security",
    "research",
    "promotion",
    "submissions-puller",
  ]
}

variable "manage_deploy_project_roles" {
  description = "Grant project-level deploy roles to each github-deploy* identity in its own project (set false if roles are managed elsewhere)."
  type        = bool
  default     = true
}
