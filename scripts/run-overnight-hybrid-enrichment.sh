#!/usr/bin/env bash
# Overnight hybrid discovery + enrichment on Corsair (OpenRouter free + Ollama).
#
# Phase 1 — SearXNG web-search against the Corsair query roster (preferred hosts
#   including blackwomenleadproject.org + open-web / authority site: queries).
#   SERP leads only; full HTML crawl of gated sources stays policy-blocked.
# Phase 2 — Multi-round Wikimedia discover-candidates (merge by id) until TARGET.
# Phase 3 — multithreaded enrichment-run with provider=hybrid (OpenRouter → Ollama).
# Prepare-only by default; set COMMIT_ENRICHMENT=1 to stage quarantine packets.
#
# Hosts:
#   - Corsair (preferred): Ollama + SearXNG local; OpenRouter key in enrichment.env
#   - Mac (dev): Tailscale Ollama URL + run-with-dev-secrets for OPENROUTER_API_KEY
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

# Optional machine env (OpenRouter key, pepper, Firebase). Never commit this file.
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
export OPENROUTER_MODEL="${OPENROUTER_MODEL:-openrouter/free}"
export OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3:8b}"

TARGET_CANDIDATES="${TARGET_CANDIDATES:-1000}"
DISCOVERY_LIMIT="${DISCOVERY_LIMIT:-40}"
DISCOVERY_CONCURRENCY="${DISCOVERY_CONCURRENCY:-2}"
DISCOVERY_ROUNDS="${DISCOVERY_ROUNDS:-3}"
ENRICH_CONCURRENCY="${ENRICH_CONCURRENCY:-4}"
ENRICH_MAX_SUBJECTS="${ENRICH_MAX_SUBJECTS:-${TARGET_CANDIDATES}}"
SKIP_DISCOVERY="${SKIP_DISCOVERY:-0}"
SKIP_SEARXNG="${SKIP_SEARXNG:-0}"
SEARXNG_QUERIES_PER_NIGHT="${SEARXNG_QUERIES_PER_NIGHT:-8}"
COMMIT_ENRICHMENT="${COMMIT_ENRICHMENT:-0}"
COMMIT_SURVIVORS="${COMMIT_SURVIVORS:-1}"
DRY_RUN="${DRY_RUN:-0}"

OPERATOR_ID="${ENRICHMENT_OPERATOR_ID:-overnight-hybrid-corsair}"
SESSION_ID="${ENRICHMENT_SESSION_ID:-sess_$(date -u +%Y%m%dT%H%M%SZ)}"
PRIVACY_PEPPER="${OPERATOR_CLI_PRIVACY_PEPPER:-${ENRICHMENT_PRIVACY_PEPPER:-}}"

LOG_DIR="${ROOT}/.cache/overnight-enrichment"
CANDIDATES_DIR="${ROOT}/packages/firebase/fixtures/discovery-candidates"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="${LOG_DIR}/run-${STAMP}.json"
SUBJECTS_FILE="${LOG_DIR}/subjects-${STAMP}.json"
SUMMARY_FILE="${LOG_DIR}/summary-${STAMP}.json"

echo "overnight hybrid start target=${TARGET_CANDIDATES} ollama=${OLLAMA_BASE_URL} provider=${EDITORIAL_LLM_PROVIDER} concurrency=${ENRICH_CONCURRENCY}" >&2

if [[ -z "${OPENROUTER_API_KEY:-}" && "${EDITORIAL_LLM_PROVIDER}" != "ollama" && "${EDITORIAL_LLM_PROVIDER}" != "mock" ]]; then
  echo "OPENROUTER_API_KEY missing — set via enrichment.env or run-with-dev-secrets" >&2
  exit 2
fi

SEARXNG_SUMMARY="{}"
if [[ "${SKIP_SEARXNG}" != "1" && "${SKIP_SEARXNG}" != "true" ]]; then
  echo "Phase 1: SearXNG web-search roster queries_per_night=${SEARXNG_QUERIES_PER_NIGHT}" >&2
  if [[ "${DRY_RUN}" == "1" || "${DRY_RUN}" == "true" ]]; then
    echo "DRY_RUN=1 — skipping live SearXNG dispatch" >&2
    SEARXNG_SUMMARY='{"skipped":"dry_run"}'
  else
    DISCOVERY_QUERIES_PER_RUN="${SEARXNG_QUERIES_PER_NIGHT}" \
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
    # Brief pause between rounds to ease Wikimedia rate limits.
    sleep 5
  done
fi

LATEST_CANDIDATES="$(ls -1t "${CANDIDATES_DIR}"/run-*.json 2>/dev/null | head -1 || true)"
if [[ -z "${LATEST_CANDIDATES}" ]]; then
  echo "No discovery-candidates run-*.json found; cannot enrich" >&2
  exit 3
fi

python3 - "${LATEST_CANDIDATES}" "${SUBJECTS_FILE}" "${ENRICH_MAX_SUBJECTS}" <<'PY'
import json, sys
src, dest, max_n = sys.argv[1], sys.argv[2], int(sys.argv[3])
data = json.load(open(src))
cands = data.get("candidates") or []
subjects = []
for c in cands[:max_n]:
    subjects.append({
        "subjectId": c["id"],
        "title": c.get("displayName") or c["id"],
        "kind": c.get("kind"),
        "existingSummary": (c.get("summary") or "")[:400] or None,
        "sourceSnippets": [s for s in [c.get("summary"), c.get("canonicalUrl")] if s],
    })
clean = []
for s in subjects:
    clean.append({k: v for k, v in s.items() if v is not None})
json.dump({"subjects": clean, "source": src, "count": len(clean)}, open(dest, "w"), indent=2)
print(f"Wrote {len(clean)} subjects → {dest}", file=sys.stderr)
PY

echo "Phase 3: enrichment-run provider=${EDITORIAL_LLM_PROVIDER} concurrency=${ENRICH_CONCURRENCY}" >&2

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
)

if [[ "${COMMIT_ENRICHMENT}" == "1" || "${COMMIT_ENRICHMENT}" == "true" ]]; then
  ARGS+=(--commit)
  if [[ -n "${PRIVACY_PEPPER}" ]]; then
    ARGS+=(--privacy-pepper "${PRIVACY_PEPPER}")
  fi
fi

node --conditions development --import tsx \
  "${ROOT}/packages/operator-cli/src/bin.ts" \
  "${ARGS[@]}" | tee "${LOG_FILE}"

python3 - "${LOG_FILE}" "${SUMMARY_FILE}" "${DISCOVERY_SUMMARY}" "${SEARXNG_SUMMARY}" "${LATEST_CANDIDATES}" <<'PY'
import json, sys
log_path, summary_path, discovery_raw, searxng_raw, candidates_path = sys.argv[1:6]
try:
    payload = json.load(open(log_path))
except Exception as e:
    payload = {"parseError": str(e)}
result = payload.get("result", payload)
items = result.get("items") or []
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
summary = {
    "searxng": searxng,
    "discovery": discovery,
    "candidatesFile": candidates_path,
    "candidatePoolSize": cand_count,
    "enrichment": {
        "itemCount": len(items),
        "keepCount": result.get("keepCount"),
        "rejectCount": result.get("rejectCount"),
        "needsEvidenceCount": result.get("needsEvidenceCount"),
        "errorCount": result.get("errorCount"),
        "concurrency": result.get("concurrency"),
        "servedBy": served,
    },
}
json.dump(summary, open(summary_path, "w"), indent=2)
print(json.dumps(summary, indent=2))
PY

echo "Wrote ${LOG_FILE}" >&2
echo "Wrote ${SUMMARY_FILE}" >&2
