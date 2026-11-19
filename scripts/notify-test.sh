#!/usr/bin/env bash
# Sends one test email through the real intake mail path (apps/web/src/lib/notify/notify.ts),
# with the Resend key pulled from 1Password by reference. Same pattern as dev-web.sh: the key
# exists only inside the `op run` child, and op masks it in output. Prints only the send status.
#
# Usage:
#   pnpm notify:test                  # to the owner mailbox (SUPPORT_CONTACT)
#   pnpm notify:test you@example.org  # to another address
#   pnpm notify:test --all            # every template, to see them all in an inbox
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Item "Resend · BlackStory intake email · Production". A rotation changes the value, never this.
RESEND_API_KEY_OP_REF="op://orsmn55mjwru7jkycit6p3cmne/yirf4w6t5qbpdalvb4zvuml7r4/credential"
if [[ -z "${RESEND_API_KEY:-}" && -z "${BLACKSTORY_DEV_NO_OP:-}" ]]; then
  command -v op >/dev/null 2>&1 || { echo "notify-test: 1Password CLI (op) is not installed" >&2; exit 1; }
  RESEND_API_KEY="$RESEND_API_KEY_OP_REF" exec op run -- "$0" "$@"
fi

# Same sender as Vercel production.
export NOTIFY_FROM_EMAIL="${NOTIFY_FROM_EMAIL:-BlackStory <notify@mail.blackstory.app>}"
# Links and the logo point at the live site, as they will in production mail.
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://blackstory.app}"
cd "$ROOT/apps/web"
exec node --conditions development --import tsx scripts/send-test-notification.mts "$@"
