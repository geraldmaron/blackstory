#!/usr/bin/env bash
# Disable submissions dry-run stub (BB-061). Print kill-switch + Armor steps.
set -euo pipefail

PROJECT="${1:-black-book-efaaf}"

echo "[DRY-RUN] Disable submissions — no Firestore or Armor mutations"
echo "Break-glass: human-platform-admin"
echo ""
echo "1. Engage killSwitches/corrections-submissions in Firestore"
echo "2. Mirror kill_switch_corrections_submissions in Remote Config"
echo "3. Optional scoped Armor deny on black-book-api-submissions-armor (priority 15)"
echo ""
echo "node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step disable-submissions"
