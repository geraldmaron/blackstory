// Per-project budgets and alerts (ADR-012 deliverable: "Secret Manager per project; budgets +
// alerts per project"). Gated behind billing_account != "" so a bare plan/apply cannot create
// budgets against an unset billing account. Secret Manager itself needs no Terraform here - it
// is per-project by construction once the projects are split; named secrets are created only
// when a consumer exists, per the existing convention (see docs/security/environment-isolation.md).
//
// billing kill-switch asymmetry (ADR-012, load-bearing): BlackStory prod gets threshold alerts
// ONLY - there is no automated action wired to its budget, and no Terraform resource in this
// file (or anywhere in this module) attaches a Pub/Sub-triggered shutdown to prod's budget.
// repo-internal (and optionally repo-staging) MAY wire an automated hard-stop; that automation
// itself (Cloud Function / Pub/Sub consumer that disables Cloud Run services) is out of scope
// for this module - see docs/runbooks/production-environment-resplit-migration.md and
// infra/gcp/cost-controls/ for the existing kill-switch pattern this should eventually plug
// into for repo-internal only.

resource "google_billing_budget" "prod" {
  count = var.billing_account != "" ? 1 : 0

  billing_account = var.billing_account
  display_name    = "BlackStory monthly budget (notify-only - no kill switch, ADR-012)"

  budget_filter {
    projects = ["projects/${data.google_project.prod.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = var.billing_budget_amount_units.prod
    }
  }

  threshold_rules { threshold_percent = 0.5 }
  threshold_rules { threshold_percent = 0.9 }
  threshold_rules { threshold_percent = 1.0 }

  # Deliberately no all_updates_rule / Pub/Sub topic: a budget event here notifies only and
  # never triggers an automated action that could take public serving dark.
}

resource "google_billing_budget" "staging" {
  count = var.billing_account != "" ? 1 : 0

  billing_account = var.billing_account
  display_name    = "BlackStory Staging monthly budget"

  budget_filter {
    projects = ["projects/${data.google_project.staging[0].number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = var.billing_budget_amount_units.staging
    }
  }

  threshold_rules { threshold_percent = 0.5 }
  threshold_rules { threshold_percent = 1.0 }
}

resource "google_billing_budget" "internal" {
  count = var.billing_account != "" ? 1 : 0

  billing_account = var.billing_account
  display_name    = "BlackStory Internal monthly budget (kill-switch eligible, ADR-012)"

  budget_filter {
    projects = ["projects/${data.google_project.internal[0].number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = var.billing_budget_amount_units.internal
    }
  }

  threshold_rules { threshold_percent = 0.5 }
  threshold_rules { threshold_percent = 0.9 }
  threshold_rules { threshold_percent = 1.0 }

  # internal_billing_kill_switch documents intent only in this stub; the actual Pub/Sub +
  # automated-shutdown wiring is a follow-up (kept out of this module to avoid speculative
  # Terraform against notification channels that do not exist yet).
}
