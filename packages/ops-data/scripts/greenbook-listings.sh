#!/usr/bin/env bash
# Green Book listing records, one command: stage -> capture the two NYPL sources -> registry-exact
# claim review. Dry run by default (reads only); --apply writes the staged rows, the captures and
# the approvals. Run from the repo root.
#
#   packages/ops-data/scripts/greenbook-listings.sh [--apply] [--limit=N] [--state-cap=N]
#
# Needs the owner's preservation decisions for the two NYPL files (default: the vault copy approved
# 2026-11-08). Publishing still needs a new signed release (docs/runbooks/production-release.md).
set -euo pipefail
APPLY=0; LIMIT=1000; CAP=1000
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --limit=*) LIMIT="${arg#*=}" ;;
    --state-cap=*) CAP="${arg#*=}" ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done
DECISIONS="${GREENBOOK_PRESERVATION_DECISIONS:-$HOME/Documents/Backpack/Agent Memory/blackstory-claim-review/greenbook-preservation-decisions.json}"
BASE="https://raw.githubusercontent.com/NYPL-publicdomain/greenbooks/45328936f4984830f6916922238ed5e8c4e024b6"
SCRIPTS=packages/ops-data/scripts
[ -f "$DECISIONS" ] || { echo "missing preservation decisions: $DECISIONS" >&2; exit 1; }
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

set -a; . apps/web/.env.local; set +a; export DATABASE_SSL=1
run() { fnm exec --using=22 -- node --conditions development --import tsx "$@"; }
curl -fsS -m 120 -o "$WORK/1947.geojson" "$BASE/geojson/1947.geojson"
curl -fsS -m 120 -o "$WORK/greenbook_1956.json" "$BASE/web/public/data/greenbook_1956.json"

echo "== stage =="
if [ "$APPLY" = 1 ]; then DRY_RUN=0 run $SCRIPTS/stage-greenbook-listings.ts --source-dir="$WORK" --limit="$LIMIT" --state-cap="$CAP" | head -30
else run $SCRIPTS/stage-greenbook-listings.ts --source-dir="$WORK" --limit="$LIMIT" --state-cap="$CAP" | head -30; fi

echo "== capture =="
if [ "$APPLY" = 1 ]; then
  IDS="$(run $SCRIPTS/review-greenbook-registry-exact.ts --print-ids)"
  for FILE in geojson/1947.geojson web/public/data/greenbook_1956.json; do
    run packages/operator-cli/src/bin.ts capture-backfill --landscape-ids "$IDS" --url "$BASE/$FILE" \
      --preservation-decisions "$DECISIONS" --commit | grep -E '"(captured|deduped|failed)"' | tr -d '\n'; echo
  done
else
  echo "(dry run) would capture the two NYPL files"
fi

echo "== review =="
if [ "$APPLY" = 1 ]; then DRY_RUN=0 CLAIM_REVIEW_APPLY=1 run $SCRIPTS/review-greenbook-registry-exact.ts
else run $SCRIPTS/review-greenbook-registry-exact.ts; fi
