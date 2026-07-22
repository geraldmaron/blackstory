#!/usr/bin/env bash
# Sources gitignored local env (default apps/web/.env.local) and runs operator-cli
# enrichment-run with Postgres OPS vars — no 1Password `op run` required for agents.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOCAL_ENV="${LOCAL_ENV_FILE:-${ROOT}/apps/web/.env.local}"

if [[ ! -f "${LOCAL_ENV}" ]]; then
  echo "Missing ${LOCAL_ENV}. Add OPENROUTER_API_KEY and DATABASE_URL (never commit)." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
. "${LOCAL_ENV}"
set +a

export OPS_DATA_SOURCE="${OPS_DATA_SOURCE:-postgres}"
export RESEARCH_PROFILE_ID="${RESEARCH_PROFILE_ID:-black-history}"
export RESEARCH_PROFILE_VERSION="${RESEARCH_PROFILE_VERSION:-1.0.0}"
export RESEARCH_SCHEMA_VERSION="${RESEARCH_SCHEMA_VERSION:-1.0.0}"
export BLACKSTORY_ROOT="${ROOT}"

cd "${ROOT}"
exec node --conditions development --import tsx \
  "${ROOT}/packages/operator-cli/src/bin.ts" enrichment-run "$@"
