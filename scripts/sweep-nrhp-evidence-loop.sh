#!/usr/bin/env bash
# repo-qauh — run the evidence sweep over the nrhp-black-heritage backlog in committing chunks.
#
# sweep-entity-evidence.ts accumulates a whole run in memory and writes it in ONE transaction at
# the end, so a single failure at --limit=2000 throws away hours of fetching. It is also
# deliberately sequential with a politeness delay against NPS, at roughly 24s/entity measured.
# Chunking is therefore not a style choice: it bounds the blast radius of a failure to one chunk
# and lets drafting start on captured evidence while later chunks are still fetching.
#
# The selector advances on its own — entities with fresh captured evidence are skipped on the next
# pass — so repeated fixed-size runs walk the backlog without bookkeeping here.
#
# A third argument re-sweeps an EXPLICIT id list instead of walking the backlog (repo-de8i). The
# selector cannot produce these: they already carry fresh captured evidence, which is exactly why
# it skips them, and the point of a re-sweep is to replace that evidence. The file is one entity id
# per line and is consumed in chunks of SIZE.
#
# Usage (from repo root):
#   set -a && source apps/web/.env.local && set +a
#   export DATABASE_SSL=1
#   bash scripts/sweep-nrhp-evidence-loop.sh <chunks> [chunk-size] [ids-file]
set -uo pipefail

CHUNKS="${1:-10}"
SIZE="${2:-50}"
IDS_FILE="${3:-}"
LOG_DIR=".cache/evidence-sweep"
mkdir -p "$LOG_DIR"

if [ -n "$IDS_FILE" ]; then
  total=$(grep -c . "$IDS_FILE")
  CHUNKS=$(( (total + SIZE - 1) / SIZE ))
  echo "=== re-sweeping $total explicit id(s) in $CHUNKS chunk(s) of $SIZE ==="
fi

for i in $(seq 1 "$CHUNKS"); do
  echo "=== chunk $i/$CHUNKS (size $SIZE) $(date -u +%H:%M:%S) ==="
  if [ -n "$IDS_FILE" ]; then
    # sed is 1-indexed and inclusive on both ends.
    from=$(( (i - 1) * SIZE + 1 ))
    to=$(( i * SIZE ))
    ids=$(sed -n "${from},${to}p" "$IDS_FILE" | paste -sd, -)
    [ -z "$ids" ] && { echo "no ids left, stopping"; break; }
    # --refetch is required: these entities all have fresh captured evidence, and without it the
    # sweep politely skips every one of them ("captured in the last 30 days").
    DRY_RUN=0 EVIDENCE_SWEEP_APPLY=1 node --conditions development --import tsx \
      packages/ops-data/scripts/sweep-entity-evidence.ts --entity-ids="$ids" --refetch 2>&1 | tail -4
  else
    DRY_RUN=0 EVIDENCE_SWEEP_APPLY=1 node --conditions development --import tsx \
      packages/ops-data/scripts/sweep-entity-evidence.ts \
      --lanes=nrhp-black-heritage --limit="$SIZE" 2>&1 | tail -4
  fi
  status=${PIPESTATUS[0]}
  # A chunk that dies must not kill the run: its own transaction rolled back, the selector will
  # offer the same entities again next pass, and the remaining chunks are still worth fetching.
  if [ "$status" -ne 0 ]; then
    echo "chunk $i FAILED (exit $status) — continuing to next chunk"
  fi
done
echo "=== sweep loop done $(date -u +%H:%M:%S) ==="
