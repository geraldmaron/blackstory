#!/usr/bin/env bash
# Production rollback dry-run (BB-062 AC #5). No cloud writes — operator rehearsal only.
set -euo pipefail

PRIOR_SHA="${1:-}"
BAD_SHA="${2:-}"
ENVIRONMENT="${3:-production}"

if [[ ! "$PRIOR_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: rollback-dry-run.sh <prior-good-sha> [bad-sha] [environment]" >&2
  exit 1
fi

echo "[DRY-RUN] Production rollback rehearsal — no live mutations"
echo "Environment: ${ENVIRONMENT}"
echo "Rollback target (known-good): ${PRIOR_SHA}"
if [[ -n "$BAD_SHA" ]]; then
  echo "Failed release SHA: ${BAD_SHA}"
fi
echo ""
echo "Procedure:"
echo "  1. Engage publication kill switch (human-platform-admin) — see docs/runbooks/incidents/"
echo "  2. Re-run deploy-production.yml with commit_sha=${PRIOR_SHA} and confirm=deploy"
echo "  3. Promote prior App Hosting rollout (promote-app-hosting-dry-run.sh ${PRIOR_SHA})"
echo "  4. Repoint publicMeta/activeRelease if publication metadata changed (BB-061 rehearsal)"
echo "  5. Run health-check-dry-run.mjs with HEALTH_CHECK_URL set"
echo "  6. Run canary-uptime.yml with reset_baseline=true after verified good state"
echo ""
echo "Verification (local):"
echo "  bash infra/github/release-pipeline/rollback-dry-run.sh ${PRIOR_SHA} ${BAD_SHA:-0000000000000000000000000000000000000000}"
echo "  node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step active-release-rollback"
