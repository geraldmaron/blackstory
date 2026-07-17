#!/usr/bin/env bash
# Applies declarative GitHub governance (rulesets, Actions allowlist, secret scanning).
# Default mode is dry-run. Mutating calls require --apply and a working gh auth session.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RULESET_FILE="${ROOT}/infra/github/rulesets/main-protection.json"
ALLOWED_FILE="${ROOT}/infra/github/allowed-actions.json"
SECURITY_FILE="${ROOT}/infra/github/security-settings.json"

APPLY=0
FORCE=0

usage() {
  cat <<'EOF'
Usage: apply-governance.sh [--dry-run] [--apply] [--force]

  --dry-run   Print planned API calls only (default).
  --apply     Perform mutating GitHub API calls (requires admin + authenticated gh).
  --force     With --apply, update an existing ruleset named main-protection instead of failing.

Environment:
  GH_REPO   Optional owner/repo override. Default: gh repo view --json nameWithOwner.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) APPLY=0 ;;
    --apply) APPLY=1 ;;
    --force) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
}

require_file "$RULESET_FILE"
require_file "$ALLOWED_FILE"
require_file "$SECURITY_FILE"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

REPO="${GH_REPO:-}"
if [[ -z "$REPO" ]]; then
  if ! REPO="$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)"; then
    echo "No GitHub remote / authenticated repo context."
    echo "Create the remote, run gh auth login, then re-run."
    echo "Planned artifacts (not applied):"
    echo "  ruleset:  $RULESET_FILE"
    echo "  actions:  $ALLOWED_FILE"
    echo "  security: $SECURITY_FILE"
    if [[ "$APPLY" -eq 0 ]]; then
      echo "Dry-run cannot call GitHub APIs without a remote; local JSON remains the source of truth."
      exit 0
    fi
    exit 1
  fi
fi

OWNER="${REPO%%/*}"
NAME="${REPO#*/}"
API_BASE="repos/${OWNER}/${NAME}"

echo "Target repository: ${REPO}"
echo "Mode: $([[ "$APPLY" -eq 1 ]] && echo apply || echo dry-run)"

RULESET_BODY="$(jq 'del(.metadata, ."$schema_note")' "$RULESET_FILE")"
ACTIONS_PERMS="$(jq -c '.actions_permissions | {enabled, allowed_actions}' "$ALLOWED_FILE")"
SELECTED_ACTIONS="$(jq -c '.selected_actions' "$ALLOWED_FILE")"
SECURITY_BODY="$(jq -c '.security_and_analysis' "$SECURITY_FILE")"

plan() {
  echo
  echo "==> $1"
  echo "$2"
}

plan "PUT /${API_BASE}/actions/permissions" "$ACTIONS_PERMS"
plan "PUT /${API_BASE}/actions/permissions/selected-actions" "$SELECTED_ACTIONS"
plan "PATCH /${API_BASE}" "{\"security_and_analysis\": ${SECURITY_BODY}}"
plan "POST /${API_BASE}/rulesets (name=main-protection)" "$(echo "$RULESET_BODY" | jq -c '.')"

if [[ "$APPLY" -eq 0 ]]; then
  echo
  echo "Dry-run complete. Re-run with --apply to mutate GitHub settings."
  exit 0
fi

echo
echo "Applying governance settings..."

gh api --method PUT "${API_BASE}/actions/permissions" --input - <<<"$ACTIONS_PERMS" >/dev/null
gh api --method PUT "${API_BASE}/actions/permissions/selected-actions" --input - <<<"$SELECTED_ACTIONS" >/dev/null

# Private vulnerability reporting + secret scanning may 403/422 depending on plan/visibility.
set +e
gh api --method PATCH "${API_BASE}" --input - <<<"{\"security_and_analysis\": ${SECURITY_BODY}}"
SECURITY_STATUS=$?
set -e
if [[ "$SECURITY_STATUS" -ne 0 ]]; then
  echo "Warning: security_and_analysis patch failed (status ${SECURITY_STATUS}). Plan/visibility may block secret scanning or private reporting." >&2
fi

EXISTING_ID="$(gh api "${API_BASE}/rulesets" --jq '.[] | select(.name=="main-protection") | .id' 2>/dev/null | head -n1 || true)"
if [[ -n "$EXISTING_ID" ]]; then
  if [[ "$FORCE" -eq 1 ]]; then
    echo "Updating existing ruleset id=${EXISTING_ID}"
    echo "$RULESET_BODY" | gh api --method PUT "${API_BASE}/rulesets/${EXISTING_ID}" --input - >/dev/null
  else
    echo "Ruleset main-protection already exists (id=${EXISTING_ID}). Re-run with --force to update." >&2
    exit 1
  fi
else
  echo "$RULESET_BODY" | gh api --method POST "${API_BASE}/rulesets" --input - >/dev/null
fi

echo "Apply complete. Verify with: infra/github/scripts/check-governance.sh"
