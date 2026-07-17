#!/usr/bin/env bash
# Secret rotation dry-run stub (BB-061). Print-only Secret Manager + 1Password steps.
set -euo pipefail

SECRET_ID="${1:-api-internal-runtime}"
PROJECT="${2:-black-book-efaaf}"

echo "[DRY-RUN] Rotate secrets — no Secret Manager writes"
echo "Break-glass: human-platform-admin + 1Password CLI (run-with-dev-secrets)"
echo ""
echo "# Human steps:"
echo "1. Engage matching workload kill switch"
echo "2. Disable exposed Secret Manager version for ${SECRET_ID}"
echo "3. Issue replacement via op:// Developer vault — never log value"
echo "4. Canary one consumer; re-enable workload after audit"
echo ""
echo "node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step rotate-secrets"
