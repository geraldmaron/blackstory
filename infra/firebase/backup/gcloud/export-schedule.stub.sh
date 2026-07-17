#!/usr/bin/env bash
# Prints Firestore export and scheduler commands for human review. Does not execute gcloud apply.
# Usage: ./export-schedule.stub.sh [--apply]
# Default: dry-run (print only). --apply still requires interactive human confirmation in terminal.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-black-book-efaaf}"
BACKUP_BUCKET="${BACKUP_BUCKET:-black-book-efaaf-firestore-backups}"
DATABASE_ID="${DATABASE_ID:-(default)}"
DRY_RUN=1

if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN=0
  echo "WARNING: --apply will execute gcloud commands. Confirm project ${PROJECT_ID}." >&2
fi

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '# %s\n' "$*"
  else
    eval "$@"
  fi
}

DATE_PREFIX="$(date -u +%Y/%m/%d)"
WEEK_PREFIX="$(date -u +%Y/Week-%V)"

echo "# BB-020 Firestore export stubs — project ${PROJECT_ID}"
echo "# Backup bucket: gs://${BACKUP_BUCKET}/"
echo ""

# Daily tier exports (metadata tag written by post-export hook)
for TIER in canonical evidence audit publication public; do
  OUTPUT_URI="gs://${BACKUP_BUCKET}/exports/daily/${DATE_PREFIX}/${TIER}/"
  run "gcloud firestore export ${OUTPUT_URI} --project=${PROJECT_ID} --database=${DATABASE_ID} --async"
  echo "# Post-export: write metadata/${TIER}-$(date -u +%Y%m%d).json with tier=${TIER}"
  echo ""
done

# Weekly full
run "gcloud firestore export gs://${BACKUP_BUCKET}/exports/weekly/${WEEK_PREFIX}/full/ --project=${PROJECT_ID} --database=${DATABASE_ID} --async"
echo ""

# PITR enable (when database exists)
run "gcloud firestore databases update --project=${PROJECT_ID} --database=${DATABASE_ID} --enable-pitr"
echo ""

# Cloud Scheduler examples (require existing App Engine app or HTTP target)
SCHEDULES=(
  "0 2 * * *:firestore-export-canonical-daily"
  "30 2 * * *:firestore-export-evidence-daily"
  "0 3 * * *:firestore-export-audit-daily"
  "30 3 * * *:firestore-export-publication-daily"
  "0 4 * * *:firestore-export-public-daily"
  "0 5 * * 0:firestore-export-weekly-full"
)

for ENTRY in "${SCHEDULES[@]}"; do
  CRON="${ENTRY%%:*}"
  JOB="${ENTRY##*:}"
  run "gcloud scheduler jobs create http ${JOB} --project=${PROJECT_ID} --schedule='${CRON}' --uri='https://REGION-PROJECT.cloudfunctions.net/triggerFirestoreExport?tier=${JOB}' --oidc-service-account-email=backup@${PROJECT_ID}.iam.gserviceaccount.com"
done

echo ""
echo "# On-release export (Pub/Sub): publication worker publishes release.activated -> backup job"
run "gcloud firestore export gs://${BACKUP_BUCKET}/exports/releases/RELEASE_ID/TIMESTAMP/ --project=${PROJECT_ID} --database=${DATABASE_ID} --async"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo "Dry-run complete. Re-run with --apply only after human approval."
fi
