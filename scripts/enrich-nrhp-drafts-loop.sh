#!/usr/bin/env bash
# repo-qauh / repo-n7p6.4 — run the WS4 drafting harness over the nrhp-black-heritage backlog in
# committing chunks, the same shape as scripts/sweep-nrhp-evidence-loop.sh.
#
# enrich-entities-llm.ts advances the ledger itself (pending -> enriched|quarantined), so repeated
# fixed-size runs walk the backlog with no bookkeeping here. Chunking still matters for the same
# reason it does in the sweep: a chunk that dies loses one chunk, not the whole night.
#
# It is safe to run this WHILE sweep-nrhp-evidence-loop.sh is still fetching. The two compose:
# the sweep adds pending rows, this drains them, and the ledger is the handoff. The pending pool
# genuinely grows under the drafter — that is the sweep working, not a bug.
#
# Cost: measured $0.0017/entity on the free-or-ollama tier (2026-08-11, 10-entity batch,
# deepseek-v3.2). The harness's own ENRICH_ENTITIES_LLM_SPEND_CEILING_USD (default $3) is a
# PER-INVOCATION ceiling, so a loop of N chunks can spend up to N x ceiling. Set the ceiling for
# the chunk size you are running, not for the whole night.
#
# This never writes to bb_public. Publishing an accepted draft is WS5 and stays a separate,
# reviewed step.
#
# Usage (from repo root):
#   set -a && source apps/web/.env.local && set +a
#   export DATABASE_SSL=1
#   bash scripts/enrich-nrhp-drafts-loop.sh <chunks> [chunk-size]
set -uo pipefail

CHUNKS="${1:-10}"
SIZE="${2:-25}"
LOG_DIR=".cache/entity-enrichment-llm"
mkdir -p "$LOG_DIR"

for i in $(seq 1 "$CHUNKS"); do
  echo "=== chunk $i/$CHUNKS (size $SIZE) $(date -u +%H:%M:%S) ==="
  DRY_RUN=0 ENRICH_ENTITIES_LLM_APPLY=1 \
  ENRICH_ENTITIES_LLM_PROVIDER="${ENRICH_ENTITIES_LLM_PROVIDER:-tiered}" \
  ENRICH_ENTITIES_LLM_SPEND_CEILING_USD="${ENRICH_ENTITIES_LLM_SPEND_CEILING_USD:-1}" \
    node --conditions development --import tsx \
    packages/ops-data/scripts/enrich-entities-llm.ts \
    --lanes=nrhp-black-heritage --limit="$SIZE" 2>&1 | tail -8
  status=${PIPESTATUS[0]}
  # A failed chunk must not kill the run: its ledger rows stay 'pending' and the next pass picks
  # the same entities up again.
  if [ "$status" -ne 0 ]; then
    echo "chunk $i FAILED (exit $status) — continuing to next chunk"
  fi
done
echo "=== enrichment loop done $(date -u +%H:%M:%S) ==="
