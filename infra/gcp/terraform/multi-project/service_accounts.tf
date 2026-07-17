// blackbook-staging and blackbook-internal service accounts. blackbook-prod's identities stay
// owned by ../*.tf (the original single-project stubs, corrected to drop the four
// ADR-012-relocated identities created here instead) - not duplicated here.

resource "google_service_account" "staging" {
  for_each = var.provision_staging_service_accounts ? local.staging_service_accounts : {}

  project      = var.staging_project_id
  account_id   = each.key
  display_name = "blackbook-staging: ${each.value}"
}

resource "google_service_account" "internal" {
  for_each = var.provision_internal_service_accounts ? local.internal_service_accounts : {}

  project      = var.internal_project_id
  account_id   = each.key
  display_name = "blackbook-internal: ${each.value}"
}
