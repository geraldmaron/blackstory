#!/usr/bin/env bash
# Prod-like iOS simulator launch: embedded JS bundle (Release), no Metro.
#
# Production binaries never talk to a packager. Use this for local smoke QA that
# matches store/preview behavior. Hot reload still requires Path B (dev:mobile).
#
# Usage:
#   ./scripts/mobile-ios-release.sh              # ensure api-public + build/install/launch Release
#   ./scripts/mobile-ios-release.sh --verify-only  # api-public + Release binary present; no Metro
#   ./scripts/mobile-ios-release.sh --launch-only    # relaunch installed Release app (skip build)
#
# Env:
#   APP_VARIANT=development (default) — must match apps/mobile/.env.local
#   API_BASE_URL — baked at build time via app.config.ts / .env.local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="release"
case "${1:-}" in
  --verify-only | --check) MODE="verify" ;;
  --launch-only) MODE="launch" ;;
  -h | --help)
    cat <<'EOF'
mobile-ios-release.sh — prod-like iOS (embedded bundle, no Metro)

  ./scripts/mobile-ios-release.sh            Build/install/launch Release on booted Simulator
  ./scripts/mobile-ios-release.sh --verify-only   Agent gate: api-public + Release app installed
  ./scripts/mobile-ios-release.sh --launch-only   Relaunch installed Release app only

Agents validating "mobile works like prod" must use --verify-only (or root pnpm mobile:ios:verify).
Do NOT use Metro /status or 127.0.0.1:8081 as the completion signal for this path.
EOF
    exit 0
    ;;
esac

IOS_BUNDLE_ID="app.blackbook.mobile.dev"
MOBILE_DIR="$ROOT/apps/mobile"
ENV_LOCAL="$MOBILE_DIR/.env.local"

load_mobile_env() {
  export APP_VARIANT="${APP_VARIANT:-development}"
  if [[ -f "$ENV_LOCAL" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_LOCAL"
    set +a
  fi
  export APP_VARIANT
}

booted_simulator_udid() {
  xcrun simctl list devices booted -j 2>/dev/null | node --input-type=module -e "
    const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
    for (const devices of Object.values(payload.devices ?? {})) {
      for (const device of devices) {
        if (device.state === 'Booted') process.stdout.write(device.udid);
      }
    }
  " 2>/dev/null || true
}

release_app_installed() {
  local udid
  udid="$(booted_simulator_udid)"
  if [[ -z "$udid" ]]; then
    echo "mobile-ios-release: no booted iOS Simulator" >&2
    return 1
  fi
  if xcrun simctl get_app_container booted "$IOS_BUNDLE_ID" data 2>/dev/null | grep -q .; then
    return 0
  fi
  echo "mobile-ios-release: ${IOS_BUNDLE_ID} not installed on booted Simulator" >&2
  return 1
}

launch_release_app() {
  local udid
  udid="$(booted_simulator_udid)"
  if [[ -z "$udid" ]]; then
    echo "mobile-ios-release: ERROR — boot an iOS Simulator first" >&2
    exit 1
  fi
  echo "mobile-ios-release: launching ${IOS_BUNDLE_ID} (embedded bundle; Metro not required)…"
  xcrun simctl terminate booted "$IOS_BUNDLE_ID" 2>/dev/null || true
  sleep 0.5
  xcrun simctl launch booted "$IOS_BUNDLE_ID"
}

case "$MODE" in
  verify)
    echo "mobile-ios-release: verify-only (api-public + Release app; no Metro)…"
    "$ROOT/scripts/ensure-api-public.sh" --check
    release_app_installed
    echo "mobile-ios-release: verify ok — Release app installed; Metro not required"
    exit 0
    ;;
  launch)
    load_mobile_env
    "$ROOT/scripts/ensure-api-public.sh" --check
    launch_release_app
    exit 0
    ;;
  release)
    load_mobile_env
    echo "mobile-ios-release: ensuring api-public (local data for ${API_BASE_URL:-http://127.0.0.1:8080})…"
    "$ROOT/scripts/ensure-api-public.sh"
    if [[ ! -d "$MOBILE_DIR/ios" ]]; then
      echo "mobile-ios-release: ios/ missing — run once: cd apps/mobile && npx expo prebuild --platform ios" >&2
      exit 1
    fi
    echo "mobile-ios-release: building Release (embedded JS bundle; no Metro)…"
    (
      cd "$MOBILE_DIR"
      npx expo run:ios --configuration Release --no-bundler
    )
    # expo run:ios opens a dev-client deep link after install; Release uses the embedded
    # bundle on a direct launch. Relaunch cleanly so we never stick on a stale packager port.
    launch_release_app
    echo "mobile-ios-release: Release build installed — app uses embedded bundle (prod-like)"
    echo "mobile-ios-release: api-public → http://127.0.0.1:8080 (simulator)"
    echo "mobile-ios-release: Metro is NOT required. Rebuild after JS changes: pnpm mobile:ios:release"
    exit 0
    ;;
esac
