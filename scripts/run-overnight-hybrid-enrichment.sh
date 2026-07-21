#!/usr/bin/env bash
# Overnight hybrid discovery + enrichment on Corsair (OpenRouter free + Ollama).
#
# Phase 1 — SearXNG web-search against the Corsair query roster (preferred hosts
#   including blackwomenleadproject.org + open-web / authority site: queries).
#   SERP leads only; full HTML crawl of gated sources stays policy-blocked.
# Phase 2 — Multi-round Wikimedia discover-candidates (merge by id) until TARGET.
# Phase 3 — multithreaded enrichment-run with provider=hybrid (OpenRouter → Ollama).
# Prepare-only by default; set COMMIT_ENRICHMENT=1 only with ALLOW_ENRICHMENT_COMMIT=1.
#
# Safeties (fail-closed where noted):
#   - Never publishes / never enables HTML crawl or Playwright
#   - Hard caps on SearXNG queries, survivors, Wikimedia rounds/concurrency
#   - COMMIT_ENRICHMENT defaults 0; quarantine commit requires break-glass
#   - Honors DISCOVERY_KILL_SWITCH when SearXNG phase runs
#   - Stop: systemctl --user stop blackstory-overnight-enrichment.service
#
# Hosts:
#   - Corsair (preferred): Ollama + SearXNG local; OpenRouter key in enrichment.env
#   - Mac (dev): Tailscale Ollama URL + run-with-dev-secrets for OPENROUTER_API_KEY
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# --- Guardrails (apply before any live work) ---
# Absolute caps — env may lower these, never raise past the hard max.
HARD_MAX_SEARXNG_QUERIES=12
HARD_MAX_SURVIVORS=50
HARD_MAX_DISCOVERY_ROUNDS=6
HARD_MAX_DISCOVERY_CONCURRENCY=3
HARD_MAX_ENRICH_CONCURRENCY=6
HARD_MAX_DISCOVERY_LIMIT=60

refuse_forbidden_crawl() {
  local flag
  for flag in ENABLE_HTML_CRAWL ENABLE_PLAYWRIGHT ENABLE_SCRAPY_CRAWL \
    BLACKSTORY_HTML_CRAWL ALLOW_GATED_SOURCE_SCRAPE; do
    local val="${!flag:-}"
    if [[ "${val}" == "1" || "${val}" == "true" || "${val}" == "yes" ]]; then
      echo "Refusing overnight run: ${flag}=${val} enables gated HTML crawl (policy blocked)." >&2
      exit 40
    fi
  done
  if [[ "${ALLOW_PUBLIC_PUBLISH:-0}" == "1" || "${ALLOW_PUBLIC_PUBLISH:-}" == "true" ]]; then
    echo "Refusing overnight run: ALLOW_PUBLIC_PUBLISH is set — discovery/enrichment never publishes." >&2
    exit 41
  fi
}

cap_int() {
  # cap_int NAME VALUE HARD_MAX → echoes min(VALUE, HARD_MAX), at least 1 if VALUE>0
  local name="$1" value="$2" hard="$3"
  if ! [[ "${value}" =~ ^[0-9]+$ ]]; then
    echo "Invalid ${name}=${value} (must be integer)" >&2
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
fi
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi

# Same reason: uv (for the Trafilatura extraction bridge, lib/trafilatura.ts)
# installs to ~/.local/bin, which a systemd unit's PATH won't include.
if [[ -d "${HOME}/.local/bin" ]]; then
  export PATH="${HOME}/.local/bin:${PATH}"
fi

# Optional machine env (Postgres, OpenRouter key, pepper). Never commit this file.
ENV_FILE="${ENRICHMENT_ENV_FILE:-${HOME}/.config/blackstory/enrichment.env}"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "${ENV_FILE}"
  set +a
fi

# Prefer localhost Ollama on Corsair; else Tailscale peer.
if [[ -z "${OLLAMA_BASE_URL:-}" ]]; then
  if curl -fsS --max-time 2 "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
    export OLLAMA_BASE_URL="http://127.0.0.1:11434/v1"
  else
    export OLLAMA_BASE_URL="http://100.119.72.84:11434/v1"
  fi
fi

export EDITORIAL_LLM_PROVIDER="${EDITORIAL_LLM_PROVIDER:-hybrid}"
# Free-model rotation roster: on 429/5xx/empty the provider advances to the next
# model instead of retrying one rate-limited router. Set OPENROUTER_MODEL to pin
# a single model instead (an explicit pin wins over the roster).
export OPENROUTER_MODELS="${OPENROUTER_MODELS:-openai/gpt-oss-20b:free,nvidia/nemotron-3-nano-30b-a3b:free,google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free}"
export OPENROUTER_MODEL="${OPENROUTER_MODEL:-}"
export OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3:8b}"
export OPS_DATA_SOURCE=postgres
export RESEARCH_PROFILE_ID="${RESEARCH_PROFILE_ID:-black-history}"
export RESEARCH_PROFILE_VERSION="${RESEARCH_PROFILE_VERSION:-1.0.0}"
export RESEARCH_SCHEMA_VERSION="${RESEARCH_SCHEMA_VERSION:-1.0.0}"
export BLACKSTORY_ROOT="${ROOT}"

# Discovery kill switch + storage terms for SearXNG child script.
export DISCOVERY_KILL_SWITCH="${DISCOVERY_KILL_SWITCH:-disengaged}"
export DISCOVERY_STORAGE_TERMS_CONFIRMED="${DISCOVERY_STORAGE_TERMS_CONFIRMED:-true}"

TARGET_CANDIDATES="$(cap_int TARGET_CANDIDATES "${TARGET_CANDIDATES:-1000}" 2000)"
DISCOVERY_LIMIT="$(cap_int DISCOVERY_LIMIT "${DISCOVERY_LIMIT:-40}" "${HARD_MAX_DISCOVERY_LIMIT}")"
DISCOVERY_CONCURRENCY="$(cap_int DISCOVERY_CONCURRENCY "${DISCOVERY_CONCURRENCY:-2}" "${HARD_MAX_DISCOVERY_CONCURRENCY}")"
DISCOVERY_ROUNDS="$(cap_int DISCOVERY_ROUNDS "${DISCOVERY_ROUNDS:-3}" "${HARD_MAX_DISCOVERY_ROUNDS}")"
ENRICH_CONCURRENCY="$(cap_int ENRICH_CONCURRENCY "${ENRICH_CONCURRENCY:-4}" "${HARD_MAX_ENRICH_CONCURRENCY}")"
ENRICH_MAX_SUBJECTS="${ENRICH_MAX_SUBJECTS:-${TARGET_CANDIDATES}}"
SKIP_DISCOVERY="${SKIP_DISCOVERY:-0}"
SKIP_SEARXNG="${SKIP_SEARXNG:-0}"
SEARXNG_QUERIES_PER_NIGHT="$(cap_int SEARXNG_QUERIES_PER_NIGHT "${SEARXNG_QUERIES_PER_NIGHT:-8}" "${HARD_MAX_SEARXNG_QUERIES}")"
COMMIT_SURVIVORS="${COMMIT_SURVIVORS:-1}"
DRY_RUN="${DRY_RUN:-0}"
WIKIMEDIA_ROUND_PAUSE_SEC="$(cap_int WIKIMEDIA_ROUND_PAUSE_SEC "${WIKIMEDIA_ROUND_PAUSE_SEC:-15}" 120)"

# Enrichment commit is prepare-only unless break-glass is set.
COMMIT_ENRICHMENT="${COMMIT_ENRICHMENT:-0}"
if [[ "${COMMIT_ENRICHMENT}" == "1" || "${COMMIT_ENRICHMENT}" == "true" ]]; then
  if [[ "${ALLOW_ENRICHMENT_COMMIT:-0}" != "1" && "${ALLOW_ENRICHMENT_COMMIT:-}" != "true" ]]; then
    echo "Refusing COMMIT_ENRICHMENT=1 without ALLOW_ENRICHMENT_COMMIT=1 (quarantine break-glass)." >&2
    exit 43
  fi
fi

OPERATOR_ID="${ENRICHMENT_OPERATOR_ID:-overnight-hybrid-corsair}"
SESSION_ID="${ENRICHMENT_SESSION_ID:-sess_$(date -u +%Y%m%dT%H%M%SZ)}"
PRIVACY_PEPPER="${OPERATOR_CLI_PRIVACY_PEPPER:-${ENRICHMENT_PRIVACY_PEPPER:-}}"

LOG_DIR="${ROOT}/.cache/overnight-enrichment"
CANDIDATES_DIR="${ROOT}/.cache/discovery-candidates"
export DISCOVERY_CANDIDATES_DIR="${CANDIDATES_DIR}"
mkdir -p "$LOG_DIR"
mkdir -p "$CANDIDATES_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="${LOG_DIR}/run-${STAMP}.json"
SUBJECTS_FILE="${LOG_DIR}/subjects-${STAMP}.json"
SUMMARY_FILE="${LOG_DIR}/summary-${STAMP}.json"

echo "overnight hybrid start target=${TARGET_CANDIDATES} ollama=${OLLAMA_BASE_URL} provider=${EDITORIAL_LLM_PROVIDER} concurrency=${ENRICH_CONCURRENCY} commit_enrichment=${COMMIT_ENRICHMENT} kill_switch=${DISCOVERY_KILL_SWITCH}" >&2
echo "safeties: searxng_queries<=${SEARXNG_QUERIES_PER_NIGHT} discovery_rounds<=${DISCOVERY_ROUNDS} no_html_crawl no_publish" >&2

echo "Preflight: Postgres ledger, policy versions, SearXNG, Ollama, disk, and model credentials" >&2
node --conditions development --import tsx \
  "${ROOT}/packages/operator-cli/src/bin.ts" preflight

SEARXNG_SUMMARY="{}"
if [[ "${SKIP_SEARXNG}" != "1" && "${SKIP_SEARXNG}" != "true" ]]; then
  echo "Phase 1: SearXNG web-search roster queries_per_night=${SEARXNG_QUERIES_PER_NIGHT}" >&2
  if [[ "${DRY_RUN}" == "1" || "${DRY_RUN}" == "true" ]]; then
    echo "DRY_RUN=1 — skipping live SearXNG dispatch" >&2
    SEARXNG_SUMMARY='{"skipped":"dry_run"}'
  else
    DISCOVERY_QUERIES_PER_RUN="${SEARXNG_QUERIES_PER_NIGHT}" \
    DISCOVERY_MAX_SURVIVORS="${DISCOVERY_MAX_SURVIVORS:-25}" \
    COMMIT_SURVIVORS="${COMMIT_SURVIVORS}" \
    DISCOVERY_OPERATOR_ID="${OPERATOR_ID}" \
    DISCOVERY_SESSION_ID="${SESSION_ID}-searxng" \
      bash "${ROOT}/scripts/run-scheduled-searxng-discovery.sh"
    SEARXNG_SUMMARY="$(
      ROOT="${ROOT}" SEARXNG_QUERIES_PER_NIGHT="${SEARXNG_QUERIES_PER_NIGHT}" python3 - <<'PY'
import json, glob, os
root = os.environ["ROOT"]
n = int(os.environ["SEARXNG_QUERIES_PER_NIGHT"])
logs = sorted(glob.glob(os.path.join(root, ".cache/discovery-scheduled/web-search-run-*.jsonl")))
print(json.dumps({"runIndex": logs[-1] if logs else None, "queriesPerNight": n}))
PY
    )"
  fi
fi

candidate_count() {
  local latest
  latest="$(ls -1t "${CANDIDATES_DIR}"/run-*.json 2>/dev/null | head -1 || true)"
  if [[ -z "${latest}" ]]; then
    echo 0
    return
  fi
  python3 -c "import json; d=json.load(open('${latest}')); print(len(d.get('candidates') or []))"
}

DISCOVERY_SUMMARY="{}"
if [[ "${SKIP_DISCOVERY}" != "1" && "${SKIP_DISCOVERY}" != "true" ]]; then
  APPLY_FLAG=()
  if [[ "${DRY_RUN}" != "1" && "${DRY_RUN}" != "true" ]]; then
    APPLY_FLAG=(--apply)
  fi
  for ((round=1; round<=DISCOVERY_ROUNDS; round++)); do
    current="$(candidate_count)"
    echo "Phase 2 round ${round}/${DISCOVERY_ROUNDS}: have=${current} target=${TARGET_CANDIDATES} limit=${DISCOVERY_LIMIT} concurrency=${DISCOVERY_CONCURRENCY}" >&2
    if [[ "${current}" -ge "${TARGET_CANDIDATES}" ]]; then
      echo "Candidate pool already at target; stopping discovery rounds." >&2
      break
    fi
    MERGE_FLAG=()
    if [[ "${current}" -gt 0 ]]; then
      MERGE_FLAG=(--merge)
    fi
    DISCOVERY_OUT="$(
      node --conditions development --import tsx \
        "${ROOT}/packages/firebase/scripts/discover-candidates.ts" \
        --limit="${DISCOVERY_LIMIT}" \
        --concurrency="${DISCOVERY_CONCURRENCY}" \
        "${MERGE_FLAG[@]}" \
        "${APPLY_FLAG[@]}"
    )"
    echo "${DISCOVERY_OUT}" >&2
    DISCOVERY_SUMMARY="$(echo "${DISCOVERY_OUT}" | python3 -c '
import sys, json, re
text = sys.stdin.read()
objs = list(re.finditer(r"\{[^{}]*\"newCandidates\"[^{}]*\}", text))
print(objs[-1].group(0) if objs else "{}")
' 2>/dev/null || echo '{}')"
    # Pause between rounds to ease Wikimedia rate limits (429 observed under load).
    sleep "${WIKIMEDIA_ROUND_PAUSE_SEC}"
  done
fi

LATEST_CANDIDATES="$(ls -1t "${CANDIDATES_DIR}"/run-*.json 2>/dev/null | head -1 || true)"
if [[ -z "${LATEST_CANDIDATES}" ]]; then
  echo "No discovery-candidates run-*.json found; cannot enrich" >&2
  exit 3
fi

# Fetches each candidate's canonicalUrl into real page text instead of handing
# the judge a bare unfetched link — a stub summary + an unread URL is why the
# discovery lane's keep rate was low; see build-discovery-enrichment-subjects.ts.
node --conditions development --import tsx \
  "${ROOT}/packages/firebase/scripts/build-discovery-enrichment-subjects.ts" \
  --candidates "${LATEST_CANDIDATES}" \
  --out "${SUBJECTS_FILE}" \
  --max "${ENRICH_MAX_SUBJECTS}" \
  --concurrency "${DISCOVERY_CONCURRENCY}"

echo "Phase 3: enrichment-run provider=${EDITORIAL_LLM_PROVIDER} concurrency=${ENRICH_CONCURRENCY} commit=${COMMIT_ENRICHMENT}" >&2

ARGS=(
  enrichment-run
  --subjects "${SUBJECTS_FILE}"
  --provider "${EDITORIAL_LLM_PROVIDER}"
  --model "${OPENROUTER_MODEL}"
  --ollama-model "${OLLAMA_MODEL}"
  --concurrency "${ENRICH_CONCURRENCY}"
  --operator-id "${OPERATOR_ID}"
  --session-id "${SESSION_ID}"
  --identity-source cli
  --output "${LOG_FILE}"
  --omit-raw-model
)

if [[ "${COMMIT_ENRICHMENT}" == "1" || "${COMMIT_ENRICHMENT}" == "true" ]]; then
  ARGS+=(--commit)
  if [[ -n "${PRIVACY_PEPPER}" ]]; then
    ARGS+=(--privacy-pepper "${PRIVACY_PEPPER}")
  fi
fi

# Write the full result via --output (sync writeFile). Do NOT pipe multi-MB JSON through
# tee→journal: Node can exit before a large stdout buffer flushes into a 64KiB pipe,
# truncating run-*.json and yielding a false itemCount:0 summary (2026-07-19 Corsair).
node --conditions development --import tsx \
  "${ROOT}/packages/operator-cli/src/bin.ts" \
  "${ARGS[@]}" >&2

python3 - "${LOG_FILE}" "${SUMMARY_FILE}" "${DISCOVERY_SUMMARY}" "${SEARXNG_SUMMARY}" "${LATEST_CANDIDATES}" <<'PY'
import json, sys
log_path, summary_path, discovery_raw, searxng_raw, candidates_path = sys.argv[1:6]
parse_error = None
try:
    payload = json.load(open(log_path))
except Exception as e:
    parse_error = str(e)
    payload = {}
result = payload.get("result", payload) if isinstance(payload, dict) else {}
items = result.get("items") or [] if isinstance(result, dict) else []
served = {}
for it in items:
    key = it.get("servedBy") or (it.get("packet") or {}).get("model", {}).get("provider") or "unknown"
    served[key] = served.get(key, 0) + 1
try:
    discovery = json.loads(discovery_raw) if discovery_raw else {}
except Exception:
    discovery = {}
try:
    searxng = json.loads(searxng_raw) if searxng_raw else {}
except Exception:
    searxng = {}
try:
    cand_count = len(json.load(open(candidates_path)).get("candidates") or [])
except Exception:
    cand_count = None
enrichment = {
    "itemCount": len(items),
    "keepCount": result.get("keepCount") if isinstance(result, dict) else None,
    "rejectCount": result.get("rejectCount") if isinstance(result, dict) else None,
    "needsEvidenceCount": result.get("needsEvidenceCount") if isinstance(result, dict) else None,
    "errorCount": result.get("errorCount") if isinstance(result, dict) else None,
    "concurrency": result.get("concurrency") if isinstance(result, dict) else None,
    "servedBy": served,
}
if parse_error:
    enrichment["parseError"] = parse_error
    enrichment["logBytes"] = __import__("os").path.getsize(log_path) if __import__("os").path.exists(log_path) else 0
summary = {
    "searxng": searxng,
    "discovery": discovery,
    "candidatesFile": candidates_path,
    "candidatePoolSize": cand_count,
    "enrichment": enrichment,
}
json.dump(summary, open(summary_path, "w"), indent=2)
print(json.dumps(summary, indent=2))
if parse_error:
    print(f"enrichment run log is not valid JSON: {parse_error}", file=sys.stderr)
    sys.exit(4)
if len(items) == 0:
    print("enrichment produced 0 items (subjects may have been empty or judge failed closed)", file=sys.stderr)
    sys.exit(5)
PY

echo "Wrote ${LOG_FILE}" >&2
echo "Wrote ${SUMMARY_FILE}" >&2
echo "Stop this unit anytime: systemctl --user stop blackstory-overnight-enrichment.service" >&2
