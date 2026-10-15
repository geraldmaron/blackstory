#!/usr/bin/env bash
# Public documentation is deployed only from the curated static export, never repo-root docs/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DOCS_BASE_PATH=/blackstory pnpm --filter @repo/docs build
printf '%s\n' 'Built apps/docs/out. Publish with the GitHub Pages workflow after merging to main.'
