#!/usr/bin/env bash
# Database restore dry-run stub (BB-061). Prints BB-020 staging import commands only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORT_URI="${1:-gs://black-book-efaaf-firestore-backups/exports/weekly/2026/Week-29/full/}"
STAGING_PROJECT="${2:-black-book-staging-restore}"

echo "[DRY-RUN] Database restore rehearsal — no live import"
echo "Identity: backup@ (human executes gcloud; NOT github-deploy)"
exec bash "${SCRIPT_DIR}/../../backup-restore/staging-restore.stub.sh" "${EXPORT_URI}" "${STAGING_PROJECT}"
