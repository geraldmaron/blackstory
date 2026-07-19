// Inputs for the ADR-012 three-project re-split. Defaults describe the target topology;
// nothing here is applied automatically. BlackStory prod (black-book-efaaf) service accounts,
// buckets, and same-project IAM stay owned by ../*.tf (the original single-project stubs,
// corrected to drop the four ADR-012-relocated identities) since prod is the retained
// black-book-efaaf project. This module adds only what's new: repo-staging, repo-internal,
// the named Firestore databases and private-evidence bucket inside repo-internal, and the
// cross-project IAM asymmetry between them.

variable "prod_project_id" {
  description = "BlackStory production GCP project ID. Retained as black-book-efaaf (ADR-012); not recreated by this module."
  type        = string
  default     = "black-book-efaaf"

  validation {
    condition     = var.prod_project_id == "black-book-efaaf"
    error_message = "BlackStory prod keeps the existing project_id = black-book-efaaf (ADR-012)."
  }
}

variable "staging_project_id" {
  description = "repo-staging GCP project ID (ADR-012; new project, created when create_new_projects is true)."
  type        = string
  default     = "repo-staging"
}

variable "internal_project_id" {
  description = "repo-internal GCP project ID (ADR-012; new project, created when create_new_projects is true)."
  type        = string
  default     = "repo-internal"
}

variable "region" {
  description = "Primary resource location (approved US region)."
  type        = string
  default     = "us-central1"
}

variable "org_id" {
  description = "GCP organization ID for the new projects, if one exists. Empty when there is no org yet (see README - matches the documented no-org pattern)."
  type        = string
  default     = ""
}

variable "billing_account" {
  description = "Billing account ID to link repo-staging/repo-internal to. Also gates budget creation."
  type        = string
  default     = ""
}

variable "create_new_projects" {
  description = "When true, this module creates repo-staging/repo-internal as new GCP projects. Fails closed (false) so a bare `terraform plan` cannot accidentally provision live projects."
  type        = bool
  default     = false
}

variable "provision_internal_databases" {
  description = "When true, create the raw-ingest and curated named Firestore databases in repo-internal. Requires repo-internal to already exist."
  type        = bool
  default     = false
}

variable "internal_firestore_pitr_enabled" {
  description = "When true, enable Point-in-Time Recovery on the raw-ingest/curated named Firestore databases in repo-internal. Defaults to disabled, matching every other provisioning switch in this module (opt-in only, flipped by a human at apply time after reviewing cost and RPO/RTO targets - see docs/runbooks/production-cloud-apply-checklist.md's 'Gaps found during consolidation' #4)."
  type        = bool
  default     = false
}

variable "provision_staging_service_accounts" {
  description = "When true, create the mirrored repo-staging service accounts. Requires repo-staging to already exist."
  type        = bool
  default     = false
}

variable "provision_internal_service_accounts" {
  description = "When true, create the repo-internal service accounts (research, publication, security, admin-app, promotion, submissions-puller). Requires repo-internal to already exist."
  type        = bool
  default     = false
}

variable "provision_internal_buckets" {
  description = "When true, create the repo-internal buckets (private-evidence). Requires repo-internal to already exist. Bucket IAM (research/security write, admin-app/publication read) additionally requires provision_internal_service_accounts=true."
  type        = bool
  default     = false
}

variable "apply_cross_project_iam" {
  description = "When true, apply the ADR-012 one-way promotion IAM asymmetry (promotion/security/submissions-puller grants into BlackStory prod). Requires both projects and the repo-internal service accounts above to already exist."
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
  description = "ADR-012: an automatic hard budget stop is acceptable on repo-internal (and optionally repo-staging) only. This variable exists so it can never accidentally be true for BlackStory prod - there is deliberately no prod_billing_kill_switch variable."
  type        = bool
  default     = false
}
