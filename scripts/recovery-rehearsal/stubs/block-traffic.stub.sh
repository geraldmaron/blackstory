#!/usr/bin/env bash
# Block malicious traffic dry-run stub (BB-061). Print Cloud Armor emergency deny commands.
set -euo pipefail

PROJECT="${1:-black-book-efaaf}"

echo "[DRY-RUN] Block malicious traffic — no Armor mutations"
echo "Break-glass: human-platform-admin"
echo "See infra/gcp/armor/emergency-deny-runbook.md"
echo ""
for POLICY in black-book-api-public-armor black-book-api-submissions-armor; do
  echo "gcloud compute security-policies rules update 10 \\"
  echo "  --security-policy=${POLICY} \\"
  echo "  --action=deny-403 \\"
  echo "  --project=${PROJECT}"
done
echo ""
echo "node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step block-malicious-traffic"
