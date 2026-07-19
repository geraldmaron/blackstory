#!/usr/bin/env bash
# Scheduled web-search discovery against self-hosted SearXNG, then queue survivors
# into private Firestore researchCases for admin approval (never publishes).
#
# Hosts:
#   - Corsair (preferred): SEARXNG_BASE_URL=http://127.0.0.1:8888 + systemd timer
#   - Mac (fallback): Tailscale URL to Corsair + launchd
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# User systemd units often lack interactive PATH — prefer nvm Node 22 when present.
if [[ -z "${NVM_DIR:-}" && -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || true
fi

# Prefer localhost when SearXNG is on this machine (Corsair); else Tailscale peer.
if [[ -z "${SEARXNG_BASE_URL:-}" ]]; then
  if curl -fsS --max-time 2 "http://127.0.0.1:8888/healthz" >/dev/null 2>&1 \
    || curl -fsS --max-time 2 "http://127.0.0.1:8888/" >/dev/null 2>&1; then
    export SEARXNG_BASE_URL="http://127.0.0.1:8888"
  else
    export SEARXNG_BASE_URL="http://100.119.72.84:8888"
  fi
fi

export DISCOVERY_KILL_SWITCH="${DISCOVERY_KILL_SWITCH:-disengaged}"
export DISCOVERY_MODE="${DISCOVERY_MODE:-live}"
export DISCOVERY_JOB_ID="${DISCOVERY_JOB_ID:-discovery-campaign-web-search}"
export DISCOVERY_SEARXNG_QUERY="${DISCOVERY_SEARXNG_QUERY:-Black Wall Street Greenwood Tulsa African American history}"
export DISCOVERY_STORAGE_TERMS_CONFIRMED="${DISCOVERY_STORAGE_TERMS_CONFIRMED:-true}"

# Survivor → admin researchCases (private). Set COMMIT_SURVIVORS=0 to prepare-only.
COMMIT_SURVIVORS="${COMMIT_SURVIVORS:-1}"
OPERATOR_ID="${DISCOVERY_OPERATOR_ID:-scheduled-discovery}"
SESSION_ID="${DISCOVERY_SESSION_ID:-sess_$(date -u +%Y%m%dT%H%M%SZ)}"
MAX_SURVIVORS="${DISCOVERY_MAX_SURVIVORS:-25}"
PRIVACY_PEPPER="${OPERATOR_CLI_PRIVACY_PEPPER:-${DISCOVERY_PRIVACY_PEPPER:-}}"

LOG_DIR="${ROOT}/.cache/discovery-scheduled"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="${LOG_DIR}/web-search-${STAMP}.json"

echo "Running ${DISCOVERY_JOB_ID} mode=${DISCOVERY_MODE} searxng=${SEARXNG_BASE_URL} queue=1 commit=${COMMIT_SURVIVORS}" >&2

ARGS=(
  discovery-dispatch
  --job "${DISCOVERY_JOB_ID}"
  --mode "${DISCOVERY_MODE}"
  --kill-switch "${DISCOVERY_KILL_SWITCH}"
  --queue-survivors
  --max-survivors "${MAX_SURVIVORS}"
  --operator-id "${OPERATOR_ID}"
  --session-id "${SESSION_ID}"
  --identity-source cli
)

if [[ "${COMMIT_SURVIVORS}" == "1" || "${COMMIT_SURVIVORS}" == "true" ]]; then
  ARGS+=(--commit)
fi

if [[ -n "${PRIVACY_PEPPER}" ]]; then
  ARGS+=(--privacy-pepper "${PRIVACY_PEPPER}")
fi

# Same entry path as operator dry-runs; Functions stay fixture-only on GCP.
node --conditions development --import tsx \
  "${ROOT}/packages/operator-cli/src/bin.ts" \
  "${ARGS[@]}" | tee "${LOG_FILE}"

echo "Wrote ${LOG_FILE}" >&2
