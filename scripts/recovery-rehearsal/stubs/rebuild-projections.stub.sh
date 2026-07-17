#!/usr/bin/env bash
# Rebuild public projections dry-run stub (BB-061). Print publication worker replay steps.
set -euo pipefail

PRIOR_RELEASE="${1:-release-000}"
PROJECT="${2:-black-book-efaaf}"

echo "[DRY-RUN] Rebuild public projections — no worker execution"
echo "Break-glass: human-platform-admin (NOT api-internal if compromised)"
echo ""
echo "1. Confirm canonical data from on-release export or verified restore"
echo "2. Engage publication kill switch"
echo "3. Replay publication worker for release ${PRIOR_RELEASE}"
echo "4. Verify projection hashes against signed manifest entries"
echo ""
echo "node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step rebuild-public-projections"
