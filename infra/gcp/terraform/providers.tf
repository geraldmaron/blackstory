// Google provider for the existing single production project.

provider "google" {
  project = var.project_id
  region  = var.region
}
