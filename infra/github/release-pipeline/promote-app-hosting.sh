#!/usr/bin/env bash
# Explicit App Hosting promote for a pinned commit SHA (ADR-006).
#
# Automatic rollouts stay disabled — this is the only allowed path to move traffic.
# Default is LIVE (creates a rollout). Set DRY_RUN=1 to print commands without mutating.
#
# Usage:
#   promote-app-hosting.sh <40-char-commit-sha> [staging|production]
#
# Requires (live mode): Firebase CLI auth (user ADC or GOOGLE_APPLICATION_CREDENTIALS
# from GitHub OIDC) and Firebase project access for the App Hosting backend.
set -euo pipefail

COMMIT_SHA="${1:-}"
ENVIRONMENT="${2:-production}"
PROJECT="${FIREBASE_PROJECT_ID:-black-book-efaaf}"
DRY_RUN="${DRY_RUN:-0}"

if [[ ! "$COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: promote-app-hosting.sh <40-char-commit-sha> [staging|production]" >&2
  exit 1
fi

case "$ENVIRONMENT" in
  staging)
    BACKEND="${APP_HOSTING_BACKEND:-black-book-web-staging}"
    ;;
  production)
    BACKEND="${APP_HOSTING_BACKEND:-black-book-web-production}"
    ;;
  *)
    echo "Environment must be staging or production (got: ${ENVIRONMENT})" >&2
    exit 1
    ;;
esac

CMD=(firebase apphosting:rollouts:create "${BACKEND}"
  --project="${PROJECT}"
  --git-commit="${COMMIT_SHA}"
  --force)

echo "Explicit App Hosting promote for ${ENVIRONMENT}"
echo "  backend: ${BACKEND}"
echo "  project: ${PROJECT}"
echo "  commit:  ${COMMIT_SHA}"
echo "  mode:    $([[ "$DRY_RUN" == "1" ]] && echo DRY-RUN || echo LIVE)"
echo ""

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[DRY-RUN] Would execute:"
  printf '  %q' "${CMD[@]}"
  echo
  echo "Preconditions (live):"
  echo "  - Automatic App Hosting rollouts DISABLED in Firebase console"
  echo "  - Firestore rules/indexes migrated for this commit when schema changed"
  echo "  - Staging smoke + security scans green for this SHA (production)"
  exit 0
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI not found. Install firebase-tools before live promote." >&2
  exit 1
fi

echo "Creating App Hosting rollout (auto-rollouts must remain disabled)…"
"${CMD[@]}"
echo "Promote requested for ${BACKEND} @ ${COMMIT_SHA}"
