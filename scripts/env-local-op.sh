#!/usr/bin/env bash
# Refresh DATABASE_URL in apps/web/.env.local from 1Password after a password rotation.
#
# Scripts that `source apps/web/.env.local` (operator-cli, the catalog republish, one-off
# queries) read the copy there, which goes stale when the password is rotated. This rewrites
# that one line in place (ADMIN_DATABASE_URL below it expands $DATABASE_URL, so order matters)
# and keeps every other key. Never prints the value. Writes atomically, mode 600.
#
# DATABASE_URL is the web role, which cannot read research.* or evidence.*. The research and
# claim-review scripts need the write-capable `blackstory_admin` login. To also set
# ADMIN_DATABASE_URL, built from the web URL plus the admin password stored on the same item:
#   WITH_ADMIN=1 pnpm env:local:op
# or from another item holding a full URL:
#   ADMIN_REF="op://<vault-id>/<item-id>/connection_string" pnpm env:local:op
# then run those scripts with DATABASE_URL="$ADMIN_DATABASE_URL" for that command only.
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

ADMIN_VALUE=""
if [[ -z "${ADMIN_REF:-}" && "${WITH_ADMIN:-}" == "1" ]]; then
  # The web item also stores the blackstory_admin password ("Least-privilege roles" section).
  # Same host, port and database as the web URL; only the login and password differ.
  ADMIN_PASSWORD="$(op read "op://orsmn55mjwru7jkycit6p3cmne/3vvt7hah7xe5s6nclzyf5gdkvm/3evojduuy76oh4ddt67lu23lsy")"
  ENCODED=""
  LC_ALL=C
  for ((i = 0; i < ${#ADMIN_PASSWORD}; i++)); do
    ch="${ADMIN_PASSWORD:i:1}"
    case "$ch" in
      [A-Za-z0-9._~-]) ENCODED+="$ch" ;;
      *) ENCODED+="$(printf '%%%02X' "'$ch")" ;;
    esac
  done
  REST="${DB_VALUE#*://}"
  WEB_USER="${REST%%:*}"
  SUFFIX=""
  [[ "$WEB_USER" == *.* ]] && SUFFIX=".${WEB_USER#*.}"
  ADMIN_VALUE="${DB_VALUE%%://*}://blackstory_admin${SUFFIX}:${ENCODED}@${REST##*@}"
  ADMIN_REF="the web item's blackstory_admin password"
elif [[ -n "${ADMIN_REF:-}" ]]; then
  ADMIN_VALUE="$(op read "$ADMIN_REF")"
fi
if [[ -n "$ADMIN_VALUE" ]]; then
  if [[ ! "$ADMIN_VALUE" =~ $PLAIN_URL ]]; then
    echo "env-local-op: ADMIN_REF value is not a plain postgres URL; $FILE left unchanged" >&2
    exit 1
  fi
  # The login name is not secret; a wrong item (the web role again) should fail here, not later.
  ADMIN_USER="${ADMIN_VALUE#*://}"
  ADMIN_USER="${ADMIN_USER%%:*}"
  if [[ "$ADMIN_USER" != blackstory_admin* && "$ADMIN_USER" != blackstory_operator* ]]; then
    echo "env-local-op: ADMIN_REF logs in as '$ADMIN_USER', not blackstory_admin or blackstory_operator; $FILE left unchanged" >&2
    exit 1
  fi
fi

# WITH_STORAGE=1 also refreshes SUPABASE_SECRET_KEY (capture-backfill and the catalog upload send
# it to Supabase Storage; a stale copy fails with 403 "Invalid Compact JWS").
STORAGE_VALUE=""
if [[ "${WITH_STORAGE:-}" == "1" ]]; then
  STORAGE_VALUE="$(op read "op://Private/7jhjw3akucs4ew2wt4xwrp765q/mqq5ii2a4xxltabvakpokxcvxa")"
  if [[ ! "$STORAGE_VALUE" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "env-local-op: stored secret_key is empty or not a plain key; $FILE left unchanged" >&2
    exit 1
  fi
fi

touch "$FILE"
DB_VALUE="$DB_VALUE" ADMIN_VALUE="$ADMIN_VALUE" STORAGE_VALUE="$STORAGE_VALUE" awk '
  /^DATABASE_URL=/ { print "DATABASE_URL=" ENVIRON["DB_VALUE"]; done = 1; next }
  /^ADMIN_DATABASE_URL=/ && ENVIRON["ADMIN_VALUE"] != "" { print "ADMIN_DATABASE_URL=" ENVIRON["ADMIN_VALUE"]; adone = 1; next }
  /^SUPABASE_SECRET_KEY=/ && ENVIRON["STORAGE_VALUE"] != "" { print "SUPABASE_SECRET_KEY=" ENVIRON["STORAGE_VALUE"]; sdone = 1; next }
  { print }
  END {
    if (!done) print "DATABASE_URL=" ENVIRON["DB_VALUE"]
    if (!adone && ENVIRON["ADMIN_VALUE"] != "") print "ADMIN_DATABASE_URL=" ENVIRON["ADMIN_VALUE"]
    if (!sdone && ENVIRON["STORAGE_VALUE"] != "") print "SUPABASE_SECRET_KEY=" ENVIRON["STORAGE_VALUE"]
  }
' "$FILE" >"$TMP"
mv "$TMP" "$FILE"
chmod 600 "$FILE"
echo "env-local-op: DATABASE_URL refreshed in $FILE (value not printed)"
[[ -z "$ADMIN_VALUE" ]] || echo "env-local-op: ADMIN_DATABASE_URL set for $ADMIN_USER (value not printed)"
[[ -z "$STORAGE_VALUE" ]] || echo "env-local-op: SUPABASE_SECRET_KEY refreshed (value not printed)"
