#!/usr/bin/env bash
# Mobile dev launcher (Path B): Metro hot reload for JS edits only.
#
# For prod-like local QA without Metro, use scripts/mobile-ios-release.sh instead.
# Usage:
#   ./scripts/dev-mobile.sh                 # interactive Expo foreground (default)
#   ./scripts/dev-mobile.sh --verify-only   # probe api-public + Metro; exit 0 only when bundle smoke passes
#   ./scripts/dev-mobile.sh --start         # ensure both services in background; print Metro URL; exit
#   pnpm dev:mobile                         # from repo root (interactive)
#   pnpm dev:mobile:verify                  # agent-safe completion gate
#
# Env:
#   SKIP_LOCAL_API_ENSURE=1 / SKIP_METRO_ENSURE=1 — skip respective ensure steps
#   METRO_DEVICE_HOST / REACT_NATIVE_PACKAGER_HOSTNAME — LAN IP for device bundle loads (auto-detected)
#   METRO_PORT — contract Metro port (default 8081)
#   CI=1 — passed through to ensure-metro background start (watch mode off)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="interactive"
case "${1:-}" in
  --verify-only | --check)
    MODE="verify"
    ;;
  --start)
    MODE="start"
    ;;
  "" | --)
    MODE="interactive"
    ;;
  -h | --help)
    cat <<'EOF'
dev-mobile.sh — api-public + Metro dev harness

  ./scripts/dev-mobile.sh                 Interactive Expo (ensure api-public, then foreground Metro)
  ./scripts/dev-mobile.sh --verify-only   Probe only; exit 0 when api-public + Metro bundle smoke pass
  ./scripts/dev-mobile.sh --start         Background Metro + verify; print Metro URL; exit

Agents must use --verify-only or --start and treat exit 0 plus bundle smoke JSON on the LAN
host:port contract (.local/metro-endpoint.json) as the only completion signal.
EOF
    exit 0
    ;;
  *)
    echo "dev-mobile: unknown argument: $1" >&2
    echo "  Try: --verify-only | --start | --help" >&2
    exit 2
    ;;
esac

load_metro_contract() {
  local endpoint_json
  endpoint_json="$(node "$ROOT/scripts/metro-endpoint.mjs")"
  METRO_PORT="$(node --input-type=module -e "process.stdout.write(String(JSON.parse(process.argv[1]).contractPort))" "$endpoint_json")"
  METRO_DEVICE_HOST="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).deviceHost)" "$endpoint_json")"
  METRO_LOOPBACK_HOST="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).loopbackHost)" "$endpoint_json")"
  METRO_HOST="$METRO_DEVICE_HOST"
  export METRO_PORT METRO_HOST METRO_DEVICE_HOST METRO_LOOPBACK_HOST
  export REACT_NATIVE_PACKAGER_HOSTNAME="$METRO_DEVICE_HOST"
}

load_metro_contract

run_api_ensure() {
  local api_mode="$1"
  if [[ "$api_mode" == "check" ]]; then
    "$ROOT/scripts/ensure-api-public.sh" --check
  else
    "$ROOT/scripts/ensure-api-public.sh"
  fi
}

run_metro_ensure() {
  local metro_mode="$1"
  if [[ "$metro_mode" == "check" ]]; then
    "$ROOT/scripts/ensure-metro.sh" --check
  else
    "$ROOT/scripts/ensure-metro.sh"
  fi
}

print_metro_proof() {
  local probe_json
  probe_json="$(node "$ROOT/scripts/probe-metro.mjs" --host "$METRO_DEVICE_HOST" --port "$METRO_PORT")"
  echo "dev-mobile: Metro probe → ${probe_json}"
}

case "$MODE" in
  verify)
    echo "dev-mobile: verify-only (api-public + Metro bundle smoke on ${METRO_DEVICE_HOST}:${METRO_PORT})…"
    run_api_ensure check
    run_metro_ensure check
    print_metro_proof
    echo "dev-mobile: verify ok — device must load http://${METRO_DEVICE_HOST}:${METRO_PORT}"
    echo "dev-mobile: contract → ${ROOT}/.local/metro-endpoint.json"
    exit 0
    ;;
  start)
    echo "dev-mobile: start (ensure api-public + background Metro on ${METRO_DEVICE_HOST}:${METRO_PORT})…"
    run_api_ensure ensure
    run_metro_ensure ensure
    print_metro_proof
    echo "dev-mobile: device must load http://${METRO_DEVICE_HOST}:${METRO_PORT}"
    echo "dev-mobile: contract → ${ROOT}/.local/metro-endpoint.json"
    exit 0
    ;;
  interactive)
    run_api_ensure ensure
    "$ROOT/scripts/ensure-metro.sh" --prepare
    node "$ROOT/scripts/metro-endpoint.mjs" --write >/dev/null
    "$ROOT/scripts/reset-ios-dev-client.sh" || true
    echo "dev-mobile: starting Expo dev client (Metro) on http://${METRO_DEVICE_HOST}:${METRO_PORT}…"
    cd "$ROOT/apps/mobile"
    exec env REACT_NATIVE_PACKAGER_HOSTNAME="$METRO_DEVICE_HOST" \
      pnpm exec expo start --dev-client --clear --port "$METRO_PORT" --host "${METRO_EXPO_HOST:-lan}"
    ;;
esac
