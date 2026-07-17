#!/usr/bin/env bash
# Prints Firestore import into staging. Never uses production Secret Manager material.
# Usage: ./staging-import.stub.sh EXPORT_URI [STAGING_PROJECT]
# Default: dry-run print only.
set -euo pipefail

EXPORT_URI="${1:?Usage: staging-import.stub.sh gs://bucket/path/ [staging-project]}"
STAGING_PROJECT="${2:-black-book-staging-restore}"
PROD_PROJECT="${PROD_PROJECT:-black-book-efaaf}"
DRY_RUN="${DRY_RUN:-1}"

echo "# BB-020 staging import stub"
echo "# Source export: ${EXPORT_URI}"
echo "# Target project: ${STAGING_PROJECT} (NOT ${PROD_PROJECT})"
echo "# Credentials: staging-only WIF or SA keyless impersonation — never prod web-runtime secrets"
echo ""

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "gcloud firestore import ${EXPORT_URI} --project=${STAGING_PROJECT} --database=(default) --async"
  echo ""
  echo "After import completes, run verification:"
  echo "  node scripts/backup-restore/verify-restore.mjs --metadata scripts/backup-restore/fixtures/sample-export-metadata.json --dry-run"
else
  gcloud firestore import "${EXPORT_URI}" --project="${STAGING_PROJECT}" --async
fi
