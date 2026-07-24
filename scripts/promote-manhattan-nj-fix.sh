#!/usr/bin/env bash
# Promote NY/NJ map fix (06d3b8f0) to App Hosting staging + production.
# Run in a normal Terminal (Cursor agent sandbox blocks firebase promote).
set -euo pipefail
cd "$(dirname "$0")/.."
SHA=06d3b8f06b7665d56eb370e048b64e2ca23f1001
bash infra/github/release-pipeline/promote-app-hosting.sh "$SHA" staging
bash infra/github/release-pipeline/promote-app-hosting.sh "$SHA" production
echo "Promoted $SHA. Smoke:"
for id in ent_15th_st_church_001 ent_dunbar_school_001 ent_movement_harlem_renaissance; do
  echo "=== $id ==="
  curl -sS "https://blackstory.app/entity/$id" | rg -o 'seed-snapshot|rel_seed_001|New Jersey|New York City, New York' | sort | uniq -c || true
done
