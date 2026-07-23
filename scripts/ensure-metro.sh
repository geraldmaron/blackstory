#!/usr/bin/env bash
# Ensure Expo/Metro on a stable dev port with bundle smoke verification.
#
# Contract:
#   - Metro always binds METRO_PORT (default 8081) on the Mac LAN IP for device clients
#   - Writes .local/metro-endpoint.json and probes bundle smoke on that LAN host:port
#   - Resets a booted iOS Simulator dev client BEFORE clearing stale sibling Metros
#   - Refuses "healthy" when the simulator still targets a stale sibling port (8082/8083)
#
# Usage:
#   ./scripts/ensure-metro.sh             # ensure (start in background if needed)
#   ./scripts/ensure-metro.sh --check     # probe only; exit 0 when bundle smoke passes
#   ./scripts/ensure-metro.sh --prepare   # stop stray Metros on scan ports; do not start
#
# Env (optional):
#   METRO_DEVICE_HOST / REACT_NATIVE_PACKAGER_HOSTNAME — LAN IP for device bundle loads
#   METRO_LOOPBACK_HOST — loopback alias (default 127.0.0.1; not used for completion gate)
#   METRO_PORT — contract port (default 8081)
#   METRO_SCAN_PORTS — duplicate scan list (default 8081,8082,8083)
#   SKIP_METRO_ENSURE=1 — no-op (CI / prod builds)
#   CI=1 — non-interactive Metro start (watch mode off in Expo)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="ensure"
case "${1:-}" in
  --check) MODE="check" ;;
  --prepare) MODE="prepare" ;;
esac

if [[ "${SKIP_METRO_ENSURE:-}" == "1" ]]; then
  echo "ensure-metro: SKIP_METRO_ENSURE=1 — skipping"
  exit 0
fi

LOG_DIR="$ROOT/.local"
PID_FILE="$LOG_DIR/metro.pid"
LOG_FILE="$LOG_DIR/metro.log"
ENDPOINT_FILE="$LOG_DIR/metro-endpoint.json"
mkdir -p "$LOG_DIR"

load_metro_contract() {
  local endpoint_json
  endpoint_json="$(node "$ROOT/scripts/metro-endpoint.mjs")"
  METRO_PORT="$(node --input-type=module -e "process.stdout.write(String(JSON.parse(process.argv[1]).contractPort))" "$endpoint_json")"
  METRO_DEVICE_HOST="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).deviceHost)" "$endpoint_json")"
  METRO_LOOPBACK_HOST="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).loopbackHost)" "$endpoint_json")"
  METRO_SCAN_PORTS="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).scanPorts.join(','))" "$endpoint_json")"
  METRO_HOST="$METRO_DEVICE_HOST"
  export METRO_PORT METRO_HOST METRO_DEVICE_HOST METRO_LOOPBACK_HOST METRO_SCAN_PORTS
  export REACT_NATIVE_PACKAGER_HOSTNAME="$METRO_DEVICE_HOST"
}

load_metro_contract

probe_metro() {
  node "$ROOT/scripts/probe-metro.mjs" \
    --host "$METRO_DEVICE_HOST" \
    --port "$METRO_PORT" \
    --scan-ports "$METRO_SCAN_PORTS" 2>/dev/null || true
}

write_endpoint_file() {
  node "$ROOT/scripts/metro-endpoint.mjs" --write >/dev/null
}

port_listen_pid() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true
}

process_cmdline() {
  ps -p "$1" -o command= 2>/dev/null | sed 's/^[[:space:]]*//' || true
}

process_cwd() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1 || true
}

is_metro_cmdline() {
  local cmd="$1"
  [[ "$cmd" == *"expo start"* ]] || [[ "$cmd" == *"@expo/cli"* && "$cmd" == *"start"* ]] || \
    [[ "$cmd" == *"metro"* && "$cmd" == *"apps/mobile"* ]] || \
    [[ "$cmd" == *"expo"* && "$cmd" == *"--dev-client"* ]]
}

is_metro_pid() {
  local pid="$1"
  if [[ -f "$PID_FILE" ]] && [[ "$(cat "$PID_FILE" 2>/dev/null)" == "$pid" ]]; then
    return 0
  fi
  local cmd cwd
  cmd="$(process_cmdline "$pid")"
  if is_metro_cmdline "$cmd"; then
    return 0
  fi
  cwd="$(process_cwd "$pid")"
  [[ "$cwd" == *"/apps/mobile" ]]
}

describe_port_blocker() {
  local port="$1"
  local pid="$2"
  local cmd
  cmd="$(process_cmdline "$pid")"
  if is_metro_pid "$pid"; then
    echo "Metro/Expo on :${port} (pid ${pid})."
    return
  fi
  echo "Unknown process on :${port} (pid ${pid})."
  echo "  Cmd: ${cmd:-<unreadable>}"
  echo "  Refusing to kill — free the port manually or set METRO_PORT."
}

stop_metro_pid() {
  local pid="$1"
  echo "ensure-metro: sending SIGTERM to Metro pid ${pid}…"
  kill -TERM "$pid" 2>/dev/null || true
  local i
  for i in $(seq 1 20); do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.25
  done
  echo "ensure-metro: ERROR — Metro pid ${pid} did not exit after SIGTERM." >&2
  exit 1
}

scan_port_array() {
  local IFS=','
  read -r -a _ports <<< "$METRO_SCAN_PORTS"
  printf '%s\n' "${_ports[@]}"
}

collect_metro_listen_pids() {
  local port pid
  while IFS= read -r port; do
    [[ -z "$port" ]] && continue
    pid="$(port_listen_pid "$port")"
    if [[ -n "$pid" ]] && is_metro_pid "$pid"; then
      echo "${port}:${pid}"
    fi
  done < <(scan_port_array)
}

stop_duplicate_metros() {
  local expected_port="$1"
  local entry port pid
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    port="${entry%%:*}"
    pid="${entry#*:}"
    if [[ "$port" != "$expected_port" ]]; then
      echo "ensure-metro: stopping duplicate Metro on :${port} (pid ${pid})…"
      stop_metro_pid "$pid"
    fi
  done < <(collect_metro_listen_pids)
}

stop_all_metros_in_scan_range() {
  local entry port pid seen_pids=""
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    port="${entry%%:*}"
    pid="${entry#*:}"
    if [[ " ${seen_pids} " == *" ${pid} "* ]]; then
      continue
    fi
    seen_pids="${seen_pids} ${pid}"
    echo "ensure-metro: stopping Metro on :${port} (pid ${pid})…"
    stop_metro_pid "$pid"
  done < <(collect_metro_listen_pids)
  rm -f "$PID_FILE"
}

start_metro() {
  local expo_host="${METRO_EXPO_HOST:-lan}"
  write_endpoint_file
  echo "ensure-metro: starting Expo Metro on http://${METRO_DEVICE_HOST}:${METRO_PORT} (--host ${expo_host})…"
  echo "ensure-metro: device must load ${ENDPOINT_FILE} → http://${METRO_DEVICE_HOST}:${METRO_PORT}"
  if [[ "${CI:-}" == "1" ]]; then
    echo "ensure-metro: CI=1 — Expo watch mode is off; use foreground dev-mobile for interactive reloads."
  fi
  (
    cd "$ROOT/apps/mobile"
    REACT_NATIVE_PACKAGER_HOSTNAME="$METRO_DEVICE_HOST" \
      nohup pnpm exec expo start --dev-client --port "$METRO_PORT" --host "$expo_host" >>"$LOG_FILE" 2>&1 &
    disown
  )
  local i listen_pid
  for i in $(seq 1 60); do
    listen_pid="$(port_listen_pid "$METRO_PORT")"
    if [[ -n "$listen_pid" ]]; then
      echo "$listen_pid" >"$PID_FILE"
      echo "ensure-metro: Metro listener pid ${listen_pid} on :${METRO_PORT}"
      return 0
    fi
    sleep 0.5
  done
  echo "ensure-metro: ERROR — Metro did not bind :${METRO_PORT} within 30s." >&2
  exit 1
}

finalize_healthy() {
  write_endpoint_file
  "$ROOT/scripts/reset-ios-dev-client.sh" || true
  stop_duplicate_metros "$METRO_PORT"
  sleep 1
  local probe_json status
  probe_json="$(probe_metro)"
  if [[ -z "$probe_json" ]]; then
    probe_json='{"status":"unreachable"}'
  fi
  status="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).status)" "$probe_json")"
  if [[ "$status" != "healthy" ]]; then
    report_probe_failure "$probe_json"
    exit 1
  fi
  local bundle_url device_url
  bundle_url="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).bundleUrl ?? '')" "$probe_json")"
  device_url="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).deviceMustLoadUrl ?? JSON.parse(process.argv[1]).bundleUrl ?? '')" "$probe_json")"
  echo "ensure-metro: ready — ${bundle_url}"
  echo "ensure-metro: device must load → ${device_url}"
  echo "ensure-metro: packager URL http://${METRO_DEVICE_HOST}:${METRO_PORT}"
  echo "ensure-metro: contract file → ${ENDPOINT_FILE}"
}

wait_for_healthy() {
  local timeout="${1:-180}"
  local i probe_json status
  for i in $(seq 1 "$timeout"); do
    probe_json="$(probe_metro)"
    if [[ -z "$probe_json" ]]; then
      probe_json='{"status":"unreachable"}'
    fi
    status="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).status)" "$probe_json")"
    if [[ "$status" == "healthy" ]]; then
      finalize_healthy
      return 0
    fi
    if [[ "$status" == "stale_client_port" ]]; then
      echo "ensure-metro: iOS dev client targets stale port — resetting…"
      "$ROOT/scripts/reset-ios-dev-client.sh" || true
    fi
    if [[ "$i" == 1 || $((i % 10)) -eq 0 ]]; then
      echo "ensure-metro: waiting for Metro bundle smoke (${i}s, last=${status})…"
    fi
    sleep 1
  done
  echo "ensure-metro: ERROR — Metro did not become healthy within ${timeout}s." >&2
  echo "  Log: ${LOG_FILE}" >&2
  exit 1
}

report_probe_failure() {
  local probe_json="$1"
  echo "ensure-metro: not healthy" >&2
  node --input-type=module -e "
    const p = JSON.parse(process.argv[1]);
    if (p.status) console.error('  status:', p.status);
    if (p.reason) console.error('  reason:', p.reason);
    if (p.port) console.error('  port:', p.port);
    if (p.deviceHost) console.error('  deviceHost:', p.deviceHost);
    if (p.packagerUrl) console.error('  packagerUrl:', p.packagerUrl);
    if (p.deviceMustLoadUrl) console.error('  deviceMustLoadUrl:', p.deviceMustLoadUrl);
    if (p.bundleUrl) console.error('  bundleUrl:', p.bundleUrl);
    if (p.bundleHttpStatus) console.error('  bundleHttpStatus:', p.bundleHttpStatus);
    if (p.clientTarget) console.error('  clientTarget:', JSON.stringify(p.clientTarget));
    if (Array.isArray(p.duplicatePorts) && p.duplicatePorts.length) {
      console.error('  duplicatePorts:', p.duplicatePorts.join(','));
    }
    if (p.clientResetCommand) console.error('  clientResetCommand:', p.clientResetCommand);
  " "$probe_json" >&2 || true
}

probe_json="$(probe_metro)"
if [[ -z "$probe_json" ]]; then
  probe_json='{"status":"unreachable"}'
fi
probe_status="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).status)" "$probe_json")"

if [[ "$probe_status" == "healthy" ]]; then
  dup_ports="$(node --input-type=module -e "
    const p = JSON.parse(process.argv[1]);
    process.stdout.write(Array.isArray(p.duplicatePorts) ? p.duplicatePorts.join(',') : '');
  " "$probe_json")"
  if [[ -n "$dup_ports" ]]; then
    echo "ensure-metro: duplicate Metro listeners on :${dup_ports} — clearing after client reset…"
    finalize_healthy
    exit 0
  fi
  finalize_healthy
  exit 0
fi

if [[ "$probe_status" == "stale_client_port" ]]; then
  if [[ "$MODE" == "check" ]]; then
    report_probe_failure "$probe_json"
    exit 1
  fi
  echo "ensure-metro: iOS dev client still targets stale port — resetting before Metro changes…"
  "$ROOT/scripts/reset-ios-dev-client.sh" || true
fi

if [[ "$MODE" == "check" ]]; then
  report_probe_failure "$probe_json"
  exit 1
fi

if [[ "$MODE" == "prepare" ]]; then
  if [[ -n "$(collect_metro_listen_pids)" ]]; then
    echo "ensure-metro: prepare — clearing Metro listeners in ${METRO_SCAN_PORTS}…"
    stop_all_metros_in_scan_range
    sleep 1
  else
    echo "ensure-metro: prepare — no Metro listeners in ${METRO_SCAN_PORTS}"
  fi
  write_endpoint_file
  exit 0
fi

listen_pid="$(port_listen_pid "$METRO_PORT")"
if [[ -n "$listen_pid" ]]; then
  if is_metro_pid "$listen_pid"; then
    if [[ "$probe_status" == "running_no_bundle" || "$probe_status" == "wrong_service" ]]; then
      echo "ensure-metro: stale Metro on :${METRO_PORT} — restarting…"
      stop_metro_pid "$listen_pid"
      rm -f "$PID_FILE"
      sleep 1
    else
      echo "ensure-metro: port :${METRO_PORT} busy (pid ${listen_pid}) but not yet healthy — waiting…"
      wait_for_healthy 120
      exit 0
    fi
  else
    echo "ensure-metro: ERROR — port :${METRO_PORT} blocked." >&2
    describe_port_blocker "$METRO_PORT" "$listen_pid" >&2
    exit 1
  fi
fi

# Do not clear sibling Metros until contract Metro is up and the dev client is repointed.
if [[ -n "$(collect_metro_listen_pids)" ]]; then
  sibling_ports="$(collect_metro_listen_pids | cut -d: -f1 | tr '\n' ',' | sed 's/,$//')"
  echo "ensure-metro: sibling Metro listeners (${sibling_ports}) remain until contract Metro is healthy."
fi

start_metro
echo "ensure-metro: log → ${LOG_FILE}"
wait_for_healthy 180
