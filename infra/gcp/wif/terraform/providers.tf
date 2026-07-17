# Google provider for WIF stubs targeting black-book-efaaf (BB-010).
# Uses Application Default Credentials when planning/applying locally.

provider "google" {
  project = var.project_id
  region  = var.region
}
