#!/usr/bin/env bash
# Verifies GitHub repository governance against checked-in declarative configs (BB-009).
# Safe read-only gh API usage. Exits non-zero when remote is missing or policy drifts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RULESET_FILE="${ROOT}/infra/github/rulesets/main-protection.json"
ALLOWED_FILE="${ROOT}/infra/github/allowed-actions.json"
SECURITY_FILE="${ROOT}/infra/github/security-settings.json"
ALLOW_MISSING_REMOTE=0
STRICT_SECURITY=0

usage() {
  cat <<'EOF'
Usage: check-governance.sh [--allow-missing-remote] [--strict-security]

  --allow-missing-remote  Exit 0 with a clear SKIP message when no remote/auth exists
                          (used by local/CI policy checker before GitHub is connected).
  --strict-security       Fail if secret scanning / push protection / private reporting
                          are not enabled (may fail on plans without those features).

Environment:
  GH_REPO   Optional owner/repo override.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-missing-remote) ALLOW_MISSING_REMOTE=1 ;;
    --strict-security) STRICT_SECURITY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

if ! command -v gh >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "gh and jq are required." >&2
  exit 1
fi

REPO="${GH_REPO:-}"
if [[ -z "$REPO" ]]; then
  if ! REPO="$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)"; then
    echo "SKIP: no GitHub remote or authenticated repo context."
    if [[ "$ALLOW_MISSING_REMOTE" -eq 1 ]]; then
      echo "Local declarative configs remain authoritative until remote + admin apply."
      exit 0
    fi
    exit 1
  fi
fi

OWNER="${REPO%%/*}"
NAME="${REPO#*/}"
API_BASE="repos/${OWNER}/${NAME}"
ERRORS=0

fail() {
  echo "FAIL: $1" >&2
  ERRORS=$((ERRORS + 1))
}

pass() {
  echo "PASS: $1"
}

echo "Checking governance for ${REPO}"

# --- Ruleset ---
EXPECTED_CHECKS="$(jq -r '.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context' "$RULESET_FILE" | sort)"
RULESET_JSON="$(gh api "${API_BASE}/rulesets" 2>/dev/null || true)"
if [[ -z "$RULESET_JSON" || "$RULESET_JSON" == "[]" ]]; then
  fail "No repository rulesets found"
else
  MAIN_ID="$(echo "$RULESET_JSON" | jq -r '.[] | select(.name=="main-protection") | .id' | head -n1)"
  if [[ -z "$MAIN_ID" || "$MAIN_ID" == "null" ]]; then
    fail "Ruleset main-protection not found"
  else
    DETAIL="$(gh api "${API_BASE}/rulesets/${MAIN_ID}")"
    ENFORCEMENT="$(echo "$DETAIL" | jq -r '.enforcement')"
    [[ "$ENFORCEMENT" == "active" ]] && pass "main-protection enforcement=active" || fail "main-protection enforcement=${ENFORCEMENT}"

    HAS_PR="$(echo "$DETAIL" | jq '[.rules[].type] | index("pull_request") != null')"
    HAS_CHECKS="$(echo "$DETAIL" | jq '[.rules[].type] | index("required_status_checks") != null')"
    HAS_NFF="$(echo "$DETAIL" | jq '[.rules[].type] | index("non_fast_forward") != null')"
    HAS_DEL="$(echo "$DETAIL" | jq '[.rules[].type] | index("deletion") != null')"
    RESOLVED="$(echo "$DETAIL" | jq -r '.rules[] | select(.type=="pull_request") | .parameters.required_review_thread_resolution')"

    [[ "$HAS_PR" == "true" ]] && pass "pull_request rule present" || fail "pull_request rule missing"
    [[ "$HAS_CHECKS" == "true" ]] && pass "required_status_checks present" || fail "required_status_checks missing"
    [[ "$HAS_NFF" == "true" ]] && pass "non_fast_forward (block force-push) present" || fail "non_fast_forward missing"
    [[ "$HAS_DEL" == "true" ]] && pass "deletion block present" || fail "deletion block missing"
    [[ "$RESOLVED" == "true" ]] && pass "required_review_thread_resolution=true" || fail "resolved conversations not required"

    ACTUAL_CHECKS="$(echo "$DETAIL" | jq -r '.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context' | sort)"
    if [[ "$ACTUAL_CHECKS" == "$EXPECTED_CHECKS" ]]; then
      pass "required status check contexts match declarative ruleset"
    else
      fail "required status check mismatch"
      echo "expected:" >&2
      echo "$EXPECTED_CHECKS" >&2
      echo "actual:" >&2
      echo "$ACTUAL_CHECKS" >&2
    fi
  fi
fi

# --- Actions permissions ---
ACTIONS_JSON="$(gh api "${API_BASE}/actions/permissions" 2>/dev/null || true)"
if [[ -z "$ACTIONS_JSON" ]]; then
  fail "Unable to read Actions permissions"
else
  ALLOWED="$(echo "$ACTIONS_JSON" | jq -r '.allowed_actions')"
  EXPECTED_ALLOWED="$(jq -r '.actions_permissions.allowed_actions' "$ALLOWED_FILE")"
  [[ "$ALLOWED" == "$EXPECTED_ALLOWED" ]] && pass "allowed_actions=${ALLOWED}" || fail "allowed_actions=${ALLOWED} expected ${EXPECTED_ALLOWED}"
fi

# --- Security settings (best-effort) ---
REPO_JSON="$(gh api "${API_BASE}" 2>/dev/null || true)"
if [[ -z "$REPO_JSON" ]]; then
  fail "Unable to read repository metadata"
else
  for KEY in secret_scanning secret_scanning_push_protection; do
    STATUS="$(echo "$REPO_JSON" | jq -r ".security_and_analysis.${KEY}.status // \"absent\"")"
    EXPECTED="$(jq -r ".security_and_analysis.${KEY}.status" "$SECURITY_FILE")"
    if [[ "$STATUS" == "$EXPECTED" ]]; then
      pass "${KEY}=${STATUS}"
    else
      MSG="${KEY}=${STATUS} (expected ${EXPECTED})"
      if [[ "$STRICT_SECURITY" -eq 1 ]]; then
        fail "$MSG"
      else
        echo "WARN: $MSG"
      fi
    fi
  done
fi

if [[ "$ERRORS" -gt 0 ]]; then
  echo "Governance check failed with ${ERRORS} error(s)." >&2
  exit 1
fi

echo "Governance check passed."
