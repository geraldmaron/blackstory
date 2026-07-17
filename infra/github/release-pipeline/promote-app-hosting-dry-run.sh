#!/usr/bin/env bash
# Explicit App Hosting promote dry-run — automatic rollouts must stay disabled (ADR-006).
set -euo pipefail

COMMIT_SHA="${1:-}"
ENVIRONMENT="${2:-production}"
BACKEND="${APP_HOSTING_BACKEND:-black-book-web-production}"
PROJECT="${FIREBASE_PROJECT_ID:-black-book-efaaf}"
REGION="${APP_HOSTING_REGION:-us-central1}"

if [[ ! "$COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: promote-app-hosting-dry-run.sh <40-char-commit-sha> [staging|production]" >&2
  exit 1
fi

if [[ "$ENVIRONMENT" == "staging" ]]; then
  BACKEND="${APP_HOSTING_BACKEND:-black-book-web-staging}"
fi

echo "[DRY-RUN] Explicit App Hosting promote for ${ENVIRONMENT} @ ${COMMIT_SHA}"
echo "Preconditions:"
echo "  - Automatic App Hosting rollouts DISABLED in Firebase console (human step)"
echo "  - Firestore rules/indexes migrated for this commit (migrate-firestore-dry-run.sh)"
echo "  - Staging smoke + security scans green for this SHA"
echo ""
echo "# Human operator commands (not executed in CI):"
echo "git checkout ${COMMIT_SHA}"
echo "# Create rollout from pinned commit (Firebase CLI / App Hosting API):"
echo "firebase apphosting:rollouts:create ${BACKEND} --project=${PROJECT} --git-commit=${COMMIT_SHA}"
echo "# Or via gcloud when backend exists:"
echo "gcloud firebase apphosting rollouts create ${BACKEND} --project=${PROJECT} --location=${REGION} --git-commit=${COMMIT_SHA}"
echo ""
echo "Do NOT enable GitHub → Firebase automatic deploy hooks."
