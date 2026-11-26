#!/usr/bin/env bash
# Run one command with DATABASE_URL set to the database owner login, held in memory only.
#
# For DDL and other owner-only work. The claim-review ledger no longer needs it: since migration
# 20261125053757 the admin login writes the ledger. The owner password is read from 1Password for
# this one process and is never written to apps/web/.env.local or printed.
#
#   scripts/with-owner-db.sh node --conditions development --import tsx <script> [args]
set -euo pipefail

WEB_REF="op://orsmn55mjwru7jkycit6p3cmne/3vvt7hah7xe5s6nclzyf5gdkvm/connection_string"
OWNER_PASSWORD_REF="op://Private/7jhjw3akucs4ew2wt4xwrp765q/password"

[[ $# -gt 0 ]] || { echo "with-owner-db: give the command to run" >&2; exit 1; }
command -v op >/dev/null 2>&1 || { echo "with-owner-db: 1Password CLI (op) is not installed" >&2; exit 1; }

WEB_URL="$(op read "$WEB_REF")"
PASSWORD="$(op read "$OWNER_PASSWORD_REF")"
ENCODED=""
LC_ALL=C
for ((i = 0; i < ${#PASSWORD}; i++)); do
  ch="${PASSWORD:i:1}"
  case "$ch" in
    [A-Za-z0-9._~-]) ENCODED+="$ch" ;;
    *) ENCODED+="$(printf '%%%02X' "'$ch")" ;;
  esac
done
# Same host, port and database as the web URL; only the login and password differ.
REST="${WEB_URL#*://}"
WEB_USER="${REST%%:*}"
SUFFIX=""
[[ "$WEB_USER" == *.* ]] && SUFFIX=".${WEB_USER#*.}"
export DATABASE_URL="${WEB_URL%%://*}://postgres${SUFFIX}:${ENCODED}@${REST##*@}"
export DATABASE_SSL=1
unset WEB_URL PASSWORD ENCODED REST
exec "$@"
