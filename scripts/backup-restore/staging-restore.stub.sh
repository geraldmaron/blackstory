#!/usr/bin/env bash
# Staging restore wrapper — prints commands by default (DRY_RUN=1).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORT_URI="${1:-gs://black-book-efaaf-firestore-backups/exports/weekly/2026/Week-29/full/}"
STAGING_PROJECT="${2:-black-book-staging-restore}"

exec bash "${SCRIPT_DIR}/../../infra/firebase/backup/gcloud/staging-import.stub.sh" \
  "${EXPORT_URI}" "${STAGING_PROJECT}"
