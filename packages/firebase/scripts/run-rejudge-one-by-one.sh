#!/usr/bin/env bash
# Durable driver for DC keep one-by-one rejudge — survives agent/session exit.
# Resumes from rejudge-progress.ndjson (skips pass=one-by-one). Tail:
#   tail -f .cache/dc-enrichment/rejudge-progress.ndjson
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOCAL_ENV="${LOCAL_ENV_FILE:-${ROOT}/apps/web/.env.local}"
LOG="${ROOT}/.cache/dc-enrichment/rejudge-one-by-one.log"
PIDFILE="${ROOT}/.cache/dc-enrichment/rejudge-one-by-one.pid"

mkdir -p "${ROOT}/.cache/dc-enrichment"

if [[ ! -f "${LOCAL_ENV}" ]]; then
  echo "Missing ${LOCAL_ENV}" >&2
  exit 1
fi

if [[ -f "${PIDFILE}" ]]; then
  OLD_PID="$(cat "${PIDFILE}")"
  if kill -0 "${OLD_PID}" 2>/dev/null; then
    echo "Rejudge driver already running (pid ${OLD_PID}). Log: ${LOG}" >&2
    exit 0
  fi
fi

set -a
# shellcheck source=/dev/null
. "${LOCAL_ENV}"
set +a

export OPS_DATA_SOURCE="${OPS_DATA_SOURCE:-postgres}"
export DATABASE_SSL="${DATABASE_SSL:-true}"
export RESEARCH_PROFILE_ID="${RESEARCH_PROFILE_ID:-black-history}"
export RESEARCH_PROFILE_VERSION="${RESEARCH_PROFILE_VERSION:-1.0.0}"
export RESEARCH_SCHEMA_VERSION="${RESEARCH_SCHEMA_VERSION:-1.0.0}"

cd "${ROOT}"
echo "$$" > "${PIDFILE}"
echo "=== rejudge one-by-one start $(date -u +%Y-%m-%dT%H:%M:%SZ) pid=$$ ===" >> "${LOG}"

node --conditions development --import tsx \
  "${ROOT}/packages/firebase/scripts/rejudge-dc-keeps-one-by-one.ts" \
  >> "${LOG}" 2>&1
EXIT=$?
rm -f "${PIDFILE}"
echo "=== rejudge one-by-one exit ${EXIT} $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "${LOG}"
exit "${EXIT}"
