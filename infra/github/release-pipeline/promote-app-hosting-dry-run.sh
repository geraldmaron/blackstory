#!/usr/bin/env bash
# Backward-compatible dry-run wrapper — delegates to promote-app-hosting.sh with DRY_RUN=1.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=1 exec bash "${ROOT}/promote-app-hosting.sh" "$@"
