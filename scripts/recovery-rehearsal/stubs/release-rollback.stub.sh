#!/usr/bin/env bash
# Active release rollback dry-run stub (BB-061). Prints BB-019 operator steps only.
set -euo pipefail

PRIOR_RELEASE="${1:-release-000}"
BAD_RELEASE="${2:-release-001}"
PROJECT="${3:-black-book-efaaf}"

echo "[DRY-RUN] Active release rollback — no Firestore writes"
echo "1. Engage publication kill switch (human-platform-admin)"
echo "2. Verify prior signed manifest for ${PRIOR_RELEASE}"
echo "3. Atomically repoint publicMeta/activeRelease away from ${BAD_RELEASE}"
echo "4. Purge affected CDN cache keys; verify manifest hashes"
echo "5. Keep publication disabled until incident review"
echo ""
echo "# Verification (local fixtures):"
echo "node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step active-release-rollback"
