#!/usr/bin/env bash
# Apply Black Book database foundation SQL (BB-012/013) to a reachable Postgres.
# Usage: DATABASE_URL=postgresql://... bash infra/database/scripts/apply-init.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INIT_DIR="$ROOT/init"
URL="${DATABASE_URL:-${BLACK_BOOK_TEST_DATABASE_URL:-postgresql://blackbook:blackbook@127.0.0.1:5432/blackbook}}"

export DATABASE_URL="$URL"

echo "Applying extensions/schemas..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$INIT_DIR/00-extensions.sql"
psql "$URL" -v ON_ERROR_STOP=1 -f "$INIT_DIR/10-schemas.sql"
echo "Creating roles..."
bash "$INIT_DIR/20-roles.sh"
echo "Stubs, grants, timeouts..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$INIT_DIR/25-boundary-stubs.sql"
psql "$URL" -v ON_ERROR_STOP=1 -f "$INIT_DIR/30-grants.sql"
psql "$URL" -v ON_ERROR_STOP=1 -f "$INIT_DIR/40-timeouts-and-limits.sql"
echo "Verify..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$INIT_DIR/90-verify.sql"
echo "Database foundation applied."
