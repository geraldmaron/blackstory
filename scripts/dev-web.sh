#!/usr/bin/env bash
# Local public-web dig launcher with fail-fast data-plane checks.
#
# Recurring failure: `pnpm --filter @repo/web dev` without PUBLIC_DATA_SOURCE=postgres
# + DATABASE_URL serves the 4-entity Dunbar seed — national dig looks empty and non-seed
# entity URLs 404. This script refuses that footgun and starts Next with a clear plane.
#
# Usage:
#   ./scripts/dev-web.sh              # default port 3048
#   PORT=3050 ./scripts/dev-web.sh    # alternate port (docs also claim :3050 — only one wins)
#
# Env loading (first match wins for DATABASE_URL if already unset):
#   1. Existing process env
#   2. apps/web/.env.local
#   3. $BLACKSTORY_DATABASE_ENV_FILE (optional path to a migrate/local env file)
#   4. Sibling ~/Developer/Projects/blackstory/.env.migrate.local (when present)
#
# Never prints DATABASE_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
    echo "dev-web: loaded env from $file (values not printed)"
  fi
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  load_env_file "$ROOT/apps/web/.env.local"
fi
if [[ -z "${DATABASE_URL:-}" && -n "${BLACKSTORY_DATABASE_ENV_FILE:-}" ]]; then
  load_env_file "$BLACKSTORY_DATABASE_ENV_FILE"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  load_env_file "${HOME}/Developer/Projects/blackstory/.env.migrate.local"
fi

PORT="${PORT:-3048}"
export PORT

# Prefer live catalog when a server DB URL is available.
if [[ -n "${DATABASE_URL:-}" && -z "${PUBLIC_DATA_SOURCE:-}" ]]; then
  export PUBLIC_DATA_SOURCE=postgres
  echo "dev-web: DATABASE_URL present → setting PUBLIC_DATA_SOURCE=postgres"
fi

if [[ "${PUBLIC_DATA_SOURCE:-}" == "postgres" ]]; then
  if [[ -z "${DATABASE_URL:-}" && -z "${APP_DATABASE_URL:-}" ]]; then
    echo "dev-web: ERROR — PUBLIC_DATA_SOURCE=postgres requires DATABASE_URL (or APP_DATABASE_URL)." >&2
    echo "  Without it the web app returns an EMPTY catalog (not the Dunbar seed)." >&2
    echo "  Copy apps/web/.env.example → apps/web/.env.local and set a server-only URL," >&2
    echo "  or export BLACKSTORY_DATABASE_ENV_FILE to a migrate env that defines DATABASE_URL." >&2
    exit 1
  fi
  export DATABASE_SSL="${DATABASE_SSL:-1}"
  echo "dev-web: data plane = postgres (live bb_public; expect ~1100 entities on rel_seed_001)"
elif [[ "${PUBLIC_DATA_SOURCE:-}" == "seed" ]]; then
  echo "dev-web: WARNING — PUBLIC_DATA_SOURCE=seed (4 Dunbar fixtures only; dig will look empty nationally)" >&2
else
  echo "dev-web: WARNING — PUBLIC_DATA_SOURCE unset and no DATABASE_URL → Dunbar seed snapshot (4 entities)." >&2
  echo "  For the live catalog: PUBLIC_DATA_SOURCE=postgres DATABASE_URL=… $0" >&2
  echo "  Continuing with seed so UI work still boots; set PUBLIC_DATA_SOURCE=seed to silence this." >&2
fi

echo "dev-web: starting @repo/web on http://localhost:${PORT}/"

exec pnpm --filter @repo/web dev
