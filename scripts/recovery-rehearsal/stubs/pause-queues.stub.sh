#!/usr/bin/env bash
# Queue pause dry-run stub (BB-061). Print-only Cloud Tasks pause commands.
set -euo pipefail

PROJECT="${1:-black-book-efaaf}"
REGION="${2:-us-central1}"

QUEUES=(publication-tasks research-tasks submissions-intake outbox-dispatch)

echo "[DRY-RUN] Pause queues without purge — no gcloud mutations"
echo "Break-glass: human-platform-admin"
echo ""
for q in "${QUEUES[@]}"; do
  echo "gcloud tasks queues pause ${q} --location=${REGION} --project=${PROJECT}"
done
echo ""
echo "Record depth/oldest age before resume. See infra/gcp/kill-switches/queue-pause.stub.json"
echo "node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step pause-queues"
