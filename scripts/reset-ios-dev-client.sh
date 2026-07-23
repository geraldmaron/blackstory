#!/usr/bin/env bash
# Point a booted iOS Simulator dev client at the repo Metro contract (.local/metro-endpoint.json).
#
# Usage:
#   ./scripts/reset-ios-dev-client.sh          # patch UserDefaults + open deep link
#   ./scripts/reset-ios-dev-client.sh --check  # exit 0 only when client targets contract host:port
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="reset"
if [[ "${1:-}" == "--check" ]]; then
  MODE="check"
fi

endpoint_json="$(node "$ROOT/scripts/metro-endpoint.mjs")"
METRO_PORT="$(node --input-type=module -e "process.stdout.write(String(JSON.parse(process.argv[1]).contractPort))" "$endpoint_json")"
METRO_DEVICE_HOST="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).deviceHost)" "$endpoint_json")"
export METRO_PORT METRO_DEVICE_HOST REACT_NATIVE_PACKAGER_HOSTNAME="$METRO_DEVICE_HOST"

if [[ "$MODE" == "check" ]]; then
  node "$ROOT/scripts/ios-dev-client-target.mjs" check
  exit $?
fi

result_json="$(node "$ROOT/scripts/ios-dev-client-target.mjs" reset)"
echo "reset-ios-dev-client: ${result_json}"

ok="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).ok ? '1' : '0')" "$result_json")"
if [[ "$ok" != "1" ]]; then
  reason="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).reason ?? 'unknown')" "$result_json")"
  echo "reset-ios-dev-client: skipped (${reason})" >&2
  exit 0
fi

packager_url="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).packagerUrl)" "$result_json")"
echo "reset-ios-dev-client: simulator dev client now targets ${packager_url}"
