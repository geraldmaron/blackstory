#!/usr/bin/env bash
# Gap-fill research pipeline on Corsair (OpenRouter free-model roster + Ollama).
# Single entry point so another agent/session/cron job can run this without
# reconstructing the command sequence from scratch — every step here (env
# sourcing, PATH bootstrap, phase order, throttled search, confidence-gated
# promotion) was hand-verified against real failures on 2026-07-20:
#   - OpenRouter model rotation must advance on ANY error, not just retryable
#     ones (llm-provider.ts)
#   - SafeHttpClient's shared malware check false-positives on any <script>
#     tag; this pipeline's text-only fetch uses lib/safe-fetch.ts's scoped
#     parser instead, not the shared one directly
#   - SearXNG's free engines rate-limit together under real load; Wikipedia's
#     own API is the primary lookup now, SearXNG is last-resort fallback
#   - uv (Trafilatura bridge) and nvm (Node 22) both install to paths a
#     systemd/cron PATH won't include
#
# Phases:
#   1. find-catalog-entity-gaps.ts   — scan published entities' claims for
#      mentioned-but-uncataloged entities (skipped if --candidates is passed;
#      this phase re-scans ALL published entities, expensive to run every
#      time nothing new has published).
#   2. build-gap-fill-enrichment-subjects.ts — real source material per
#      candidate (Wikipedia API primary, citation-trail + throttled SearXNG
#      for Tier-1 corroboration).
#   3. enrichment-run (operator-cli)  — LLM judge, hybrid provider.
#   4. auto-promote-corsair-keeps.ts  — confidence-gated staging fixture.
#
# Never publishes: step 4 only writes a national-catalog fixture file.
# Publishing requires the separate, explicit, human-run
# publish-national-catalog.ts (APP_FIREBASE_ALLOW_PRODUCTION=1).
#
# Usage:
#   ./scripts/run-gap-fill-research.sh                      # full pipeline
#   ./scripts/run-gap-fill-research.sh --candidates <path>   # skip phase 1
#   MIN_MENTIONS=3 MAX_CANDIDATES=100 ./scripts/run-gap-fill-research.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HARD_MAX_CANDIDATES=400
MIN_MENTIONS="${MIN_MENTIONS:-2}"
MAX_CANDIDATES="${MAX_CANDIDATES:-200}"
CONCURRENCY="${GAP_FILL_CONCURRENCY:-4}"
AUTO_PROMOTE_FLOOR_NOTE="auto-promote-corsair-keeps.ts enforces its own confidence floor; not overridable here"

if (( MAX_CANDIDATES > HARD_MAX_CANDIDATES )); then
  echo "Capping MAX_CANDIDATES=${MAX_CANDIDATES} -> ${HARD_MAX_CANDIDATES}" >&2
  MAX_CANDIDATES="${HARD_MAX_CANDIDATES}"
fi

CANDIDATES_PATH=""
if [[ "${1:-}" == "--candidates" ]]; then
  CANDIDATES_PATH="$2"
fi

# PATH bootstrap — systemd/cron units don't inherit an interactive shell's PATH.
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi
if [[ -d "${HOME}/.local/bin" ]]; then
  export PATH="${HOME}/.local/bin:${PATH}"
fi

ENV_FILE="${ENRICHMENT_ENV_FILE:-${HOME}/.config/blackstory/enrichment.env}"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "${ENV_FILE}"
  set +a
fi
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "OPENROUTER_API_KEY missing — set via ${ENV_FILE}" >&2
  exit 2
fi
export EDITORIAL_LLM_PROVIDER="${EDITORIAL_LLM_PROVIDER:-hybrid}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ 2>/dev/null || echo unstamped)"
OUT_DIR=".cache/gap-fill-enrichment"
mkdir -p "${OUT_DIR}"

if [[ -z "${CANDIDATES_PATH}" ]]; then
  echo "Phase 1: scanning published entities for gap-fill candidates" >&2
  node --conditions development --import tsx packages/firebase/scripts/find-catalog-entity-gaps.ts --apply
  CANDIDATES_PATH="$(ls -1t packages/firebase/fixtures/discovery-candidates/gap-fill-*.json | head -1)"
  echo "Using freshly generated candidates: ${CANDIDATES_PATH}" >&2
else
  echo "Phase 1 skipped — using provided candidates: ${CANDIDATES_PATH}" >&2
fi

SUBJECTS_FILE="${OUT_DIR}/subjects-${STAMP}.json"
echo "Phase 2: building subjects (min-mentions=${MIN_MENTIONS} max=${MAX_CANDIDATES} concurrency=${CONCURRENCY})" >&2
node --conditions development --import tsx packages/firebase/scripts/build-gap-fill-enrichment-subjects.ts \
  --candidates "${CANDIDATES_PATH}" \
  --out "${SUBJECTS_FILE}" \
  --min-mentions "${MIN_MENTIONS}" --max "${MAX_CANDIDATES}" --concurrency "${CONCURRENCY}"

RUN_FILE="${OUT_DIR}/run-${STAMP}.json"
echo "Phase 3: enrichment-run (provider=${EDITORIAL_LLM_PROVIDER})" >&2
node --conditions development --import tsx packages/operator-cli/src/bin.ts enrichment-run \
  --subjects "${SUBJECTS_FILE}" \
  --provider "${EDITORIAL_LLM_PROVIDER}" \
  --concurrency "${CONCURRENCY}" \
  --operator-id gap-fill-research --session-id "gap-fill-${STAMP}" --identity-source cli \
  --output "${RUN_FILE}" \
  --omit-raw-model

echo "Phase 4: confidence-gated auto-promotion (${AUTO_PROMOTE_FLOOR_NOTE})" >&2
node --conditions development --import tsx packages/firebase/scripts/auto-promote-corsair-keeps.ts \
  --run "${RUN_FILE}" \
  --subjects "${SUBJECTS_FILE}" \
  --stamp "gap-fill-${STAMP}"

echo "Done. Review packages/firebase/fixtures/national-catalog/auto-promoted-gap-fill-${STAMP}.json" >&2
echo "and .cache/auto-promotion/report-gap-fill-${STAMP}.json (held reasons) before publishing." >&2
echo "Publish (separate, explicit, human-run):" >&2
echo "  DRY_RUN=1 node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts" >&2
