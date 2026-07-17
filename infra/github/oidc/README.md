# GitHub OIDC / WIF operator docs (BB-010)

Companion to [`../../gcp/wif/`](../../gcp/wif/). This directory holds GitHub-side environment
stubs, SA-key removal notes, and pointers to apply/check scripts.

## Artifacts

| Path | Role |
|------|------|
| `environments/production.json` | Declarative protected `production` environment (required reviewers) |
| `environments/staging.json` | Optional same-project staging environment stub |
| `sa-key-removal.md` | Path to remove any JSON SA keys if they ever appear |
| `../scripts/apply-wif.sh` | Terraform dry-run by default; `--apply` mutates GCP |
| `../scripts/check-wif.sh` | Read-only WIF inventory via `gcloud` |
| `../release-metadata/` | Deployment provenance schema + stub (BB-062 handoff) |
| `../../../.github/workflows/deploy-production.yml` | Example OIDC deploy workflow (`workflow_dispatch` only) |

## Create protected production environment (after remote exists)

GitHub Environments are not fully expressible as checked-in config for all plans. After the remote
exists:

```bash
# Create environment (idempotent-ish via API)
gh api --method PUT "repos/OWNER/REPO/environments/production" \
  --input infra/github/oidc/environments/production.json

# Confirm protection rules
gh api "repos/OWNER/REPO/environments/production" --jq '{name,protection_rules,deployment_branch_policy}'
```

Required reviewers must be real users/teams — update the JSON placeholders before apply.

## Wire Actions secrets/vars (names only — no SA keys)

After `apply-wif.sh --apply`, set repository or environment variables (not JSON keys):

| Name | Value source |
|------|----------------|
| `GCP_PROJECT_ID` | `black-book-efaaf` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Terraform output `workload_identity_provider` |
| `GCP_SERVICE_ACCOUNT` | `github-deploy@black-book-efaaf.iam.gserviceaccount.com` |

Prefer GitHub Environment `production` variables so only that environment's jobs can see them.

## Relationship to BB-009 / BB-062

- BB-009 rulesets must be applied before treating WIF as production-ready.
- This bead does **not** enable deploy as a required status check.
- BB-062 builds the full release pipeline on top of this OIDC identity and provenance schema.
