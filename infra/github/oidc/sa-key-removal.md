# Removing long-lived Google SA keys from GitHub (BB-010)

Black Book must authenticate deploys with GitHub OIDC + Workload Identity Federation only.
There should be **no** JSON service-account keys in GitHub Actions secrets today.

## Inventory (do this first)

```bash
# List Actions secrets (names only)
gh secret list
gh secret list --env production
gh secret list --env staging

# Search common anti-patterns in workflows (should find none for credentials_json)
rg -n "credentials_json|GOOGLE_APPLICATION_CREDENTIALS|GCP_SA_KEY|service.account.*json" \
  .github/workflows infra/github || true
```

Suspicious secret names to remove if present:

- `GCP_SA_KEY` / `GOOGLE_CREDENTIALS` / `FIREBASE_TOKEN` used for production deploy
- Any secret whose value is a Google service-account JSON document

## Removal path

1. Confirm WIF is applied and the production deploy workflow authenticates via
   `google-github-actions/auth` with `workload_identity_provider` + `service_account` (no
   `credentials_json`).
2. Delete the GitHub secret(s):

   ```bash
   gh secret delete SECRET_NAME
   gh secret delete SECRET_NAME --env production
   ```

3. In GCP, list and delete any user-managed keys on `github-deploy` (should be zero):

   ```bash
   gcloud iam service-accounts keys list \
     --iam-account=github-deploy@black-book-efaaf.iam.gserviceaccount.com \
     --project=black-book-efaaf
   # Only delete USER_MANAGED keys after confirming they are unused:
   # gcloud iam service-accounts keys delete KEY_ID --iam-account=...
   ```

4. Prefer org policy `constraints/iam.disableServiceAccountKeyCreation` (designed in BB-005).
5. Re-run `./infra/github/scripts/check-wif.sh` and a `workflow_dispatch` dry auth job.

## Policy

- Never commit SA JSON to the repo, `.env`, or App Hosting yaml.
- Never add `credentials_json` to deploy workflows.
- Use `firebase login` / `gcloud auth login` for human operators; CI uses OIDC only.
