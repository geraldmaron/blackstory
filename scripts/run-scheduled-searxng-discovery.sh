#!/usr/bin/env bash
# Scheduled web-search discovery against self-hosted SearXNG, then queue survivors
# into private Postgres research cases for admin approval (never publishes).
#
# Rotates through packages/config/.../corsair-web-search-queries.json so Corsair
# covers preferred authority/community hosts (including blackwomenleadproject.org)
# plus open-web intents — not a single hardcoded Tulsa query.
#
# Hosts:
#   - Corsair (preferred): SEARXNG_BASE_URL=http://127.0.0.1:8888 + systemd timer
#   - Mac (fallback): Tailscale URL to Corsair + launchd
#
# SERP snippets only. Full HTML crawl of gated sources (e.g. BWLP) stays off until
# source-policy approval.
#
# Safeties:
#   - Hard caps on queries/survivors; refuse HTML-crawl / Playwright / publish flags
#   - Requires DISCOVERY_STORAGE_TERMS_CONFIRMED=true for live mode
#   - Honors DISCOVERY_KILL_SWITCH (engaged → dispatcher skips)
#   - Pause between queries (DISCOVERY_QUERY_PAUSE_SEC, default 4)
#   - Stop overnight parent: systemctl --user stop blackstory-overnight-enrichment.service
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${DISCOVERY_ENV_FILE:-${HOME}/.config/blackstory/enrichment.env}"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "${ENV_FILE}"
  set +a
fi

# DATABASE_URL lives in postgres.env (same as overnight enrichment). Source after
# enrichment.env so scheduled/manual runs share one credential layout.
POSTGRES_ENV_FILE="${DISCOVERY_POSTGRES_ENV_FILE:-${HOME}/.config/blackstory/postgres.env}"
if [[ -f "${POSTGRES_ENV_FILE}" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "${POSTGRES_ENV_FILE}"
  set +a
fi

HARD_MAX_QUERIES_PER_RUN=12
HARD_MAX_SURVIVORS=50

refuse_forbidden_crawl() {
  local flag
  for flag in ENABLE_HTML_CRAWL ENABLE_PLAYWRIGHT ENABLE_SCRAPY_CRAWL \
    BLACKSTORY_HTML_CRAWL ALLOW_GATED_SOURCE_SCRAPE ALLOW_PUBLIC_PUBLISH; do
    local val="${!flag:-}"
    if [[ "${val}" == "1" || "${val}" == "true" || "${val}" == "yes" ]]; then
      echo "Refusing SearXNG discovery: ${flag}=${val} is forbidden on this path." >&2
      exit 40
    fi
  done
}

cap_int() {
  local name="$1" value="$2" hard="$3"
  if ! [[ "${value}" =~ ^[0-9]+$ ]]; then
    echo "Invalid ${name}=${value}" >&2
    exit 42
  fi
  if (( value > hard )); then
    echo "Capping ${name}=${value} → ${hard}" >&2
    echo "${hard}"
  else
    echo "${value}"
  fi
}

refuse_forbidden_crawl

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
export OPS_DATA_SOURCE=postgres
export RESEARCH_PROFILE_ID="${RESEARCH_PROFILE_ID:-black-history}"
export RESEARCH_PROFILE_VERSION="${RESEARCH_PROFILE_VERSION:-1.0.0}"
export RESEARCH_SCHEMA_VERSION="${RESEARCH_SCHEMA_VERSION:-1.0.0}"
export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434/v1}"
export OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3:8b}"
export EDITORIAL_LLM_PROVIDER="${EDITORIAL_LLM_PROVIDER:-hybrid}"
export BLACKSTORY_ROOT="${ROOT}"

echo "Preflight: Postgres ledger, policy versions, SearXNG, Ollama, disk, and model credentials" >&2
node --conditions development --import tsx \
  "${ROOT}/packages/operator-cli/src/bin.ts" preflight

# Fail-closed for live: storage terms must be explicitly confirmed.
if [[ "${DISCOVERY_MODE}" == "live" ]]; then
  if [[ "${DISCOVERY_STORAGE_TERMS_CONFIRMED:-}" != "true" ]]; then
    echo "Refusing live SearXNG: set DISCOVERY_STORAGE_TERMS_CONFIRMED=true after engine-policy review." >&2
    exit 44
  fi
else
  export DISCOVERY_STORAGE_TERMS_CONFIRMED="${DISCOVERY_STORAGE_TERMS_CONFIRMED:-true}"
fi

QUERY_FILE="${DISCOVERY_SEARXNG_QUERY_FILE:-${ROOT}/packages/config/src/scheduled-jobs/data/corsair-web-search-queries.json}"
QUERIES_PER_RUN="$(cap_int DISCOVERY_QUERIES_PER_RUN "${DISCOVERY_QUERIES_PER_RUN:-3}" "${HARD_MAX_QUERIES_PER_RUN}")"
QUERY_PAUSE_SEC="$(cap_int DISCOVERY_QUERY_PAUSE_SEC "${DISCOVERY_QUERY_PAUSE_SEC:-4}" 60)"
export QUERIES_PER_RUN

# Survivor → admin researchCases (private). Set COMMIT_SURVIVORS=0 to prepare-only.
COMMIT_SURVIVORS="${COMMIT_SURVIVORS:-1}"
OPERATOR_ID="${DISCOVERY_OPERATOR_ID:-scheduled-discovery}"
SESSION_BASE="${DISCOVERY_SESSION_ID:-sess_$(date -u +%Y%m%dT%H%M%SZ)}"
MAX_SURVIVORS="$(cap_int DISCOVERY_MAX_SURVIVORS "${DISCOVERY_MAX_SURVIVORS:-25}" "${HARD_MAX_SURVIVORS}")"
PRIVACY_PEPPER="${OPERATOR_CLI_PRIVACY_PEPPER:-${DISCOVERY_PRIVACY_PEPPER:-}}"

LOG_DIR="${ROOT}/.cache/discovery-scheduled"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
RUN_LOG="${LOG_DIR}/web-search-run-${STAMP}.jsonl"

QUERY_LIST_FILE="${LOG_DIR}/queries-${STAMP}.txt"
DISCOVERY_SEARXNG_QUERY="${DISCOVERY_SEARXNG_QUERY:-}" \
QUERY_FILE="${QUERY_FILE}" \
QUERIES_PER_RUN="${QUERIES_PER_RUN}" \
QUERY_LIST_FILE="${QUERY_LIST_FILE}" \
python3 - <<'PY'
import json, os, sys
from datetime import datetime, timezone

override = os.environ.get("DISCOVERY_SEARXNG_QUERY", "").strip()
out_path = os.environ["QUERY_LIST_FILE"]
if override:
    open(out_path, "w", encoding="utf-8").write(override + "\n")
    print(f"1 override query → {out_path}", file=sys.stderr)
    sys.exit(0)

path = os.environ["QUERY_FILE"]
n = max(1, int(os.environ.get("QUERIES_PER_RUN", "3")))
with open(path, encoding="utf-8") as f:
    doc = json.load(f)
queries = [q["text"].strip() for q in doc.get("queries", []) if q.get("text", "").strip()]
if not queries:
    print("corsair-web-search-queries.json has no queries", file=sys.stderr)
    sys.exit(2)

# Stable daily rotation: start index from UTC day-of-year so timers cover the roster.
doy = datetime.now(timezone.utc).timetuple().tm_yday
start = (doy - 1) % len(queries)
selected = [queries[(start + i) % len(queries)] for i in range(min(n, len(queries)))]
open(out_path, "w", encoding="utf-8").write("\n".join(selected) + "\n")
print(f"{len(selected)} queries from roster → {out_path}", file=sys.stderr)
PY

QUERY_COUNT="$(grep -c . "${QUERY_LIST_FILE}" || true)"
echo "Running ${DISCOVERY_JOB_ID} mode=${DISCOVERY_MODE} searxng=${SEARXNG_BASE_URL} queries=${QUERY_COUNT} queue=1 commit=${COMMIT_SURVIVORS}" >&2
echo "query_file=${QUERY_FILE}" >&2

: >"${RUN_LOG}"
qi=0
while IFS= read -r QUERY || [[ -n "${QUERY}" ]]; do
  [[ -z "${QUERY}" ]] && continue
  qi=$((qi + 1))
  export DISCOVERY_SEARXNG_QUERY="${QUERY}"
  SESSION_ID="${SESSION_BASE}-q${qi}"
  LOG_FILE="${LOG_DIR}/web-search-${STAMP}-q${qi}.json"

  echo "Query ${qi}/${QUERY_COUNT}: ${QUERY}" >&2

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

  python3 -c 'import json,sys; print(json.dumps({"query":sys.argv[1],"log":sys.argv[2]}))' \
    "${QUERY}" "${LOG_FILE}" >>"${RUN_LOG}"

  echo "Wrote ${LOG_FILE}" >&2

  if [[ "${qi}" -lt "${QUERY_COUNT}" ]]; then
    sleep "${QUERY_PAUSE_SEC}"
  fi
done < "${QUERY_LIST_FILE}"

echo "Wrote run index ${RUN_LOG}" >&2
