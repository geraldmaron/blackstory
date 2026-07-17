#!/usr/bin/env bash
# Restore deleted public object dry-run stub (BB-061). Print GCS generation restore commands.
set -euo pipefail

BUCKET="${1:-black-book-efaaf-public}"
OBJECT="${2:-public/releases/release-001/entities/entity-a.json}"
GENERATION="${3:-1234567880}"
PROJECT="${4:-black-book-efaaf}"

echo "[DRY-RUN] Restore deleted public object — no GCS mutations"
echo "Identity: backup-restore-sa / human-platform-admin (NOT compromised deploy SA)"
echo ""
echo "# Human step — restore specific object generation:"
echo "gcloud storage cp \\"
echo "  gs://${BUCKET}/${OBJECT}#${GENERATION} \\"
echo "  gs://${BUCKET}/${OBJECT} \\"
echo "  --project=${PROJECT}"
echo ""
echo "Spot-check snapshotHash against BB-019 manifest entry"
echo "node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step restore-deleted-public-object"
