#!/usr/bin/env bash
# Run role isolation verification SQL (BB-012). Requires apply-init first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${DATABASE_URL:-${BLACK_BOOK_TEST_DATABASE_URL:-postgresql://blackbook:blackbook@127.0.0.1:5432/blackbook}}"

psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/init/91-isolation-checks.sql"
echo "Isolation checks passed."
