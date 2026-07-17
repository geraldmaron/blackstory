#!/usr/bin/env bash
# Revoke compromised deploy identity dry-run stub (BB-061). Print-only WIF/SA steps.
set -euo pipefail

COMPROMISED_SA="${1:-github-deploy@black-book-efaaf.iam.gserviceaccount.com}"
PROJECT="${2:-black-book-efaaf}"

echo "[DRY-RUN] Revoke compromised deploy identity — no IAM mutations"
echo "Compromised (do NOT use for recovery): ${COMPROMISED_SA}"
echo "Break-glass: human-platform-admin via IAP"
echo ""
echo "# Human steps (review before any apply):"
echo "gcloud iam service-accounts disable ${COMPROMISED_SA} --project=${PROJECT}"
echo "# Remove WIF provider binding for github-deploy pool (see infra/gcp/wif/)"
echo "# Verify GitHub Actions deploy fails closed"
echo ""
echo "node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step revoke-compromised-deploy-identity"
