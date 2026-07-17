// Org policy backstops per project. Gated behind manage_org_policies (default false) because
// there is currently no GCP organization wrapping these projects - the same "no org yet"
// situation already documented for github-deploy in ../../wif/terraform and ../iam.tf.
// google_project_organization_policy only requires the target project (not org_id) to exist
// within an org for the API to accept it; when no org exists, leave manage_org_policies=false
// and rely on the convention-level controls documented in docs/security/environment-isolation.md
// and infra/gcp/wif/deploy-roles.md ("must not have: exported keys") instead. Flip this to true
// per project the moment an org exists - no other Terraform change is required.

resource "google_project_organization_policy" "disable_sa_keys" {
  for_each = var.manage_org_policies ? toset([var.prod_project_id, var.staging_project_id, var.internal_project_id]) : toset([])

  project    = each.value
  constraint = "iam.disableServiceAccountKeyCreation"

  boolean_policy {
    enforced = true
  }
}

resource "google_project_organization_policy" "restrict_public_ip" {
  for_each = var.manage_org_policies ? toset([var.prod_project_id, var.staging_project_id, var.internal_project_id]) : toset([])

  project    = each.value
  constraint = "sql.restrictPublicIp"

  boolean_policy {
    enforced = true
  }
}
