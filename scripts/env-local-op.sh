#!/usr/bin/env bash
# Refresh DATABASE_URL in apps/web/.env.local from 1Password after a password rotation.
#
# Scripts that `source apps/web/.env.local` (operator-cli, the catalog republish, one-off
# queries) read the copy there, which goes stale when the password is rotated. This rewrites
# that one line in place (ADMIN_DATABASE_URL below it expands $DATABASE_URL, so order matters)
# and keeps every other key. Never prints the value. Writes atomically, mode 600.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-$ROOT/apps/web/.env.local}"
# Same item as scripts/dev-web.sh.
REF="op://orsmn55mjwru7jkycit6p3cmne/3vvt7hah7xe5s6nclzyf5gdkvm/connection_string"

command -v op >/dev/null 2>&1 || { echo "env-local-op: 1Password CLI (op) is not installed" >&2; exit 1; }

umask 077
TMP="$(mktemp "$(dirname "$FILE")/.env.local.tmp.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

DB_VALUE="$(op read "$REF")"
# The file is shell-sourced unquoted, so refuse anything that is not a plain postgres URL.
PLAIN_URL='^postgres(ql)?://[^][:space:]$`"'"'"'\\[]+$'
if [[ ! "$DB_VALUE" =~ $PLAIN_URL ]]; then
  echo "env-local-op: 1Password value is not a plain postgres URL; $FILE left unchanged" >&2
  exit 1
fi

touch "$FILE"
DB_VALUE="$DB_VALUE" awk '
  /^DATABASE_URL=/ { print "DATABASE_URL=" ENVIRON["DB_VALUE"]; done = 1; next }
  { print }
  END { if (!done) print "DATABASE_URL=" ENVIRON["DB_VALUE"] }
' "$FILE" >"$TMP"
mv "$TMP" "$FILE"
chmod 600 "$FILE"
echo "env-local-op: DATABASE_URL refreshed in $FILE (value not printed)"
