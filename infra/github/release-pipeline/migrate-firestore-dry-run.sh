#!/usr/bin/env bash
# Firestore rules/indexes deploy sequencing dry-run (ADR-011). Runs BEFORE App Hosting traffic.
# Human operator replaces echo lines with live firebase deploy after Blaze + remote exist.
set -euo pipefail

COMMIT_SHA="${1:-}"
PROJECT="${FIREBASE_PROJECT_ID:-black-book-efaaf}"
CONFIG="${FIREBASE_CONFIG:-infra/firebase/firebase.json}"

if [[ ! "$COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: migrate-firestore-dry-run.sh <40-char-commit-sha>" >&2
  exit 1
fi

echo "[DRY-RUN] Firestore migration gate for commit ${COMMIT_SHA}"
echo "Order (must complete before incompatible App Hosting / API traffic):"
echo "  1. Deploy Firestore security rules (all named databases)"
echo "  2. Deploy Firestore indexes (wait until index builds complete)"
echo "  3. Deploy Storage rules if changed"
echo "  4. Verify rules in emulator + staging before production promote"
echo ""
echo "# Commands for human operator (not executed in CI):"
echo "git checkout ${COMMIT_SHA}"
echo "firebase deploy --only firestore:rules,firestore:indexes --project=${PROJECT} --config=${CONFIG}"
echo "firebase deploy --only storage --project=${PROJECT} --config=${CONFIG}"
echo ""
echo "Postgres/SQL-Connect migrations are parked (ADR-011). Re-enable only with vars.ENABLE_POSTGRES_CI."
