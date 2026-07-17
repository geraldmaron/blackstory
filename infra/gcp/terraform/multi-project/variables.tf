// Inputs for the ADR-012 (BB-078) three-project re-split. Defaults describe the target
// topology; nothing here is applied by this bead. blackbook-prod's own service accounts,
// buckets, and same-project IAM stay owned by ../*.tf (the original BB-005 single-project
// stubs, unchanged) since blackbook-prod is the retained black-book-efaaf project. This
// module adds only what's new: blackbook-staging, blackbook-internal, the named Firestore
// databases inside blackbook-internal, and the cross-project IAM asymmetry between them.

variable "prod_project_id" {
  description = "blackbook-prod GCP project ID. Retained as black-book-efaaf (ADR-012); not recreated by this module."
  type        = string
  default     = "black-book-efaaf"

  validation {
    condition     = var.prod_project_id == "black-book-efaaf"
    error_message = "blackbook-prod keeps the existing project_id = black-book-efaaf (ADR-012)."
  }
}

variable "staging_project_id" {
  description = "blackbook-staging GCP project ID (ADR-012; new project, TBD until BB-079 creates it)."
  type        = string
  default     = "blackbook-staging"
}

variable "internal_project_id" {
  description = "blackbook-internal GCP project ID (ADR-012; new project, TBD until BB-079 creates it)."
  type        = string
  default     = "blackbook-internal"
}

variable "region" {
  description = "Primary resource location (approved US region)."
  type        = string
  default     = "us-central1"
}

variable "org_id" {
  description = "GCP organization ID for the new projects, if one exists. Empty when there is no org yet (see README - matches BB-010's documented no-org pattern)."
  type        = string
  default     = ""
}

variable "billing_account" {
  description = "Billing account ID to link blackbook-staging/blackbook-internal to. Also gates budget creation."
  type        = string
  default     = ""
}

variable "create_new_projects" {
  description = "When true, this module creates blackbook-staging/blackbook-internal as new GCP projects. Fails closed (false) so a bare `terraform plan` cannot accidentally provision live projects."
  type        = bool
  default     = false
}

variable "provision_internal_databases" {
  description = "When true, create the raw-ingest and curated named Firestore databases in blackbook-internal. Requires blackbook-internal to already exist."
  type        = bool
  default     = false
}

variable "provision_staging_service_accounts" {
  description = "When true, create the mirrored blackbook-staging service accounts. Requires blackbook-staging to already exist."
  type        = bool
  default     = false
}

variable "provision_internal_service_accounts" {
  description = "When true, create the blackbook-internal service accounts (research, publication, security, admin-app, promotion, submissions-puller). Requires blackbook-internal to already exist."
  type        = bool
  default     = false
}

variable "apply_cross_project_iam" {
  description = "When true, apply the ADR-012 one-way promotion IAM asymmetry (promotion/security/submissions-puller grants into blackbook-prod). Requires both projects and the blackbook-internal service accounts above to already exist."
  type        = bool
  default     = false
}

variable "manage_org_policies" {
  description = "Whether this workspace manages per-project org policies (requires the projects to sit under a GCP organization). Matches the no-org pattern already documented in ../wif/terraform and ../iam.tf."
  type        = bool
  default     = false
}

variable "billing_budget_amount_units" {
  description = "Monthly budget amount (whole currency units, e.g. USD) per project. Only used when billing_account is set."
  type = object({
    prod     = number
    staging  = number
    internal = number
  })
  default = {
    prod     = 0
    staging  = 0
    internal = 0
  }
}

variable "internal_billing_kill_switch" {
  description = "ADR-012: an automatic hard budget stop is acceptable on blackbook-internal (and optionally blackbook-staging) only. This variable exists so it can never accidentally be true for blackbook-prod - there is deliberately no prod_billing_kill_switch variable."
  type        = bool
  default     = false
}
