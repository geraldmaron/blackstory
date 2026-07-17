// A single default (unaliased) Google provider. Each resource sets its own `project`
// argument explicitly (prod/staging/internal) rather than using per-project provider
// aliases - the same pattern already used in ../../wif/terraform for cross-project
// deploy identities. Application Default Credentials must have permission in all three
// projects to actually apply; `terraform validate` needs none.

provider "google" {
  region = var.region
}
