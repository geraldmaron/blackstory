#!/usr/bin/env bash
# Ensure local api-public on :8080 serves live Postgres map data before mobile dev.
#
# Safe port handling:
#   - Reuses a healthy api-public already listening
#   - Restarts only processes whose cmdline matches api-public / tsx src/main.ts
#   - Refuses when :8080 is held by Firestore emulator or an unknown process
#
# Usage:
#   ./scripts/ensure-api-public.sh           # ensure (start if needed)
#   ./scripts/ensure-api-public.sh --check   # probe only; exit 0 when healthy
#
# Env (optional):
#   API_PUBLIC_HOST / API_PUBLIC_PORT — override probe target (default 127.0.0.1:8080)
#   SKIP_LOCAL_API_ENSURE=1             — no-op (CI / prod-default mobile runs)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="ensure"
if [[ "${1:-}" == "--check" ]]; then
  MODE="check"
fi

if [[ "${SKIP_LOCAL_API_ENSURE:-}" == "1" ]]; then
  echo "ensure-api-public: SKIP_LOCAL_API_ENSURE=1 — skipping"
  exit 0
fi

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
    echo "ensure-api-public: loaded env from $file (values not printed)"
  fi
}

read_mobile_api_base_url() {
  local env_file="$ROOT/apps/mobile/.env.local"
  if [[ ! -f "$env_file" ]]; then
    return 0
  fi
  local line
  line="$(grep -E '^[[:space:]]*API_BASE_URL=' "$env_file" | tail -1 || true)"
  if [[ -z "$line" ]]; then
    return 0
  fi
  line="${line#API_BASE_URL=}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  line="${line#\"}"
  line="${line%\"}"
  line="${line#\'}"
  line="${line%\'}"
  printf '%s' "$line"
}

configured_api_url="$(read_mobile_api_base_url || true)"
if [[ -z "$configured_api_url" ]]; then
  echo "ensure-api-public: no API_BASE_URL in apps/mobile/.env.local — skipping local api-public"
  echo "  Set API_BASE_URL=http://127.0.0.1:8080 for simulator dev, then rerun pnpm dev:mobile"
  exit 0
fi

if [[ "$configured_api_url" == https://api.blackbook.app* ]]; then
  echo "ensure-api-public: API_BASE_URL points at production — skipping local api-public"
  exit 0
fi

resolve_probe_target() {
  local configured="$configured_api_url"
  node --input-type=module -e "
    const raw = process.argv[1];
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') process.exit(2);
      process.stdout.write(JSON.stringify({ host: url.hostname, port: url.port || (url.protocol === 'https:' ? '443' : '80') }));
    } catch { process.exit(2); }
  " "$configured"
}

TARGET_JSON="$(resolve_probe_target || printf '{"host":"127.0.0.1","port":"8080"}')"
API_PUBLIC_HOST="${API_PUBLIC_HOST:-$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).host)" "$TARGET_JSON")}"
API_PUBLIC_PORT="${API_PUBLIC_PORT:-$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).port)" "$TARGET_JSON")}"

if [[ "$API_PUBLIC_HOST" != "127.0.0.1" && "$API_PUBLIC_HOST" != "localhost" ]]; then
  echo "ensure-api-public: API_BASE_URL host is ${API_PUBLIC_HOST} (LAN device dev)."
  echo "  This script auto-starts api-public on the Mac loopback only."
  echo "  Start api-public manually on the Mac, then open the app on your device."
  if [[ "$MODE" == "check" ]]; then
    node "$ROOT/scripts/probe-api-public.mjs" --host "$API_PUBLIC_HOST" --port "$API_PUBLIC_PORT" >/dev/null
    exit $?
  fi
  exit 0
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  load_env_file "$ROOT/apps/web/.env.local"
fi
if [[ -z "${DATABASE_URL:-}" && -n "${BLACKSTORY_DATABASE_ENV_FILE:-}" ]]; then
  load_env_file "$BLACKSTORY_DATABASE_ENV_FILE"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  load_env_file "${HOME}/Developer/Projects/blackstory/.env.migrate.local"
fi

export PUBLIC_DATA_SOURCE="${PUBLIC_DATA_SOURCE:-postgres}"
export DATABASE_SSL="${DATABASE_SSL:-1}"

LOG_DIR="$ROOT/.local"
PID_FILE="$LOG_DIR/api-public.pid"
LOG_FILE="$LOG_DIR/api-public.log"
mkdir -p "$LOG_DIR"

probe_api() {
  node "$ROOT/scripts/probe-api-public.mjs" --host "$API_PUBLIC_HOST" --port "$API_PUBLIC_PORT" 2>/dev/null || true
}

port_listen_pid() {
  lsof -nP -iTCP:"$API_PUBLIC_PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true
}

process_cmdline() {
  ps -p "$1" -o command= 2>/dev/null | sed 's/^[[:space:]]*//' || true
}

process_cwd() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1 || true
}

is_api_public_cmdline() {
  local cmd="$1"
  [[ "$cmd" == *"apps/api-public"* ]] || [[ "$cmd" == *"@repo/api-public"* ]] || \
    [[ "$cmd" == *"api-public"* && "$cmd" == *"main.ts"* ]] || \
    [[ "$cmd" == *"api-public"* && "$cmd" == *"pnpm dev"* ]] || \
    [[ "$cmd" == *"api-public"* && "$cmd" == *"tsx"* ]] || \
    [[ "$cmd" == *"import tsx src/main.ts"* ]]
}

is_api_public_pid() {
  local pid="$1"
  if [[ -f "$PID_FILE" ]] && [[ "$(cat "$PID_FILE" 2>/dev/null)" == "$pid" ]]; then
    return 0
  fi
  local cmd cwd
  cmd="$(process_cmdline "$pid")"
  if is_api_public_cmdline "$cmd"; then
    return 0
  fi
  cwd="$(process_cwd "$pid")"
  [[ "$cwd" == *"/apps/api-public" ]]
}

is_firestore_emulator_cmdline() {
  local cmd="$1"
  [[ "$cmd" == *"cloud-firestore-emulator"* ]] || \
    [[ "$cmd" == *"Firestore Emulator"* ]] || \
    [[ "$cmd" == *"firebase"* && "$cmd" == *"emulator"* && "$cmd" == *"firestore"* ]]
}

describe_port_blocker() {
  local pid="$1"
  local cmd
  cmd="$(process_cmdline "$pid")"
  if is_firestore_emulator_cmdline "$cmd"; then
    echo "Firestore emulator holds :${API_PUBLIC_PORT} (firebase.json default)."
    echo "  Stop it: quit \`pnpm firebase:emulators\` or reconfigure the emulator port in infra/firebase/firebase.json."
    echo "  api-public and the Firestore emulator cannot share :8080."
    return
  fi
  if is_api_public_pid "$pid"; then
    echo "api-public on :${API_PUBLIC_PORT} (pid ${pid})."
    return
  fi
  echo "Unknown process on :${API_PUBLIC_PORT} (pid ${pid})."
  echo "  Cmd: ${cmd:-<unreadable>}"
  echo "  Refusing to kill — free the port manually or set a different API_PUBLIC_PORT + apps/mobile/.env.local API_BASE_URL."
}

stop_api_public_pid() {
  local pid="$1"
  echo "ensure-api-public: sending SIGTERM to api-public pid ${pid}…"
  kill -TERM "$pid" 2>/dev/null || true
  local i
  for i in $(seq 1 20); do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.25
  done
  echo "ensure-api-public: ERROR — api-public pid ${pid} did not exit after SIGTERM." >&2
  exit 1
}

start_api_public() {
  if [[ -z "${DATABASE_URL:-}" && -z "${APP_DATABASE_URL:-}" ]]; then
    if command -v run-with-dev-secrets >/dev/null 2>&1; then
      echo "ensure-api-public: no DATABASE_URL in shell — starting via run-with-dev-secrets"
      (
        cd "$ROOT/apps/api-public"
        nohup run-with-dev-secrets env PUBLIC_DATA_SOURCE=postgres DATABASE_SSL=1 pnpm dev >>"$LOG_FILE" 2>&1 &
        echo $! >"$PID_FILE"
      )
      return 0
    fi
    echo "ensure-api-public: ERROR — PUBLIC_DATA_SOURCE=postgres requires DATABASE_URL." >&2
    echo "  Copy apps/web/.env.example → apps/web/.env.local, or use run-with-dev-secrets." >&2
    exit 1
  fi

  echo "ensure-api-public: starting api-public on :${API_PUBLIC_PORT} (postgres, DATABASE_SSL=1)…"
  (
    cd "$ROOT/apps/api-public"
    nohup env PUBLIC_DATA_SOURCE=postgres DATABASE_SSL=1 pnpm dev >>"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
  )
}

wait_for_healthy() {
  local timeout="${1:-180}"
  local i probe_json status
  for i in $(seq 1 "$timeout"); do
    probe_json="$(probe_api)"
    if [[ -z "$probe_json" ]]; then
      probe_json='{"status":"unreachable"}'
    fi
    status="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).status)" "$probe_json")"
    if [[ "$status" == "healthy" ]]; then
      local features release
      features="$(node --input-type=module -e "process.stdout.write(String(JSON.parse(process.argv[1]).featureCount ?? ''))" "$probe_json")"
      release="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).releaseId ?? '')" "$probe_json")"
      echo "ensure-api-public: ready — release ${release}, ${features} map features"
      return 0
    fi
    if [[ "$i" == 1 || $((i % 10)) -eq 0 ]]; then
      echo "ensure-api-public: waiting for live api-public (${i}s, last=${status})…"
    fi
    sleep 1
  done
  echo "ensure-api-public: ERROR — api-public did not become healthy within ${timeout}s." >&2
  echo "  Log: ${LOG_FILE}" >&2
  exit 1
}

probe_json="$(probe_api)"
if [[ -z "$probe_json" ]]; then
  probe_json='{"status":"unreachable"}'
fi
probe_status="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).status)" "$probe_json")"

if [[ "$probe_status" == "healthy" ]]; then
  features="$(node --input-type=module -e "process.stdout.write(String(JSON.parse(process.argv[1]).featureCount ?? ''))" "$probe_json")"
  release="$(node --input-type=module -e "process.stdout.write(JSON.parse(process.argv[1]).releaseId ?? '')" "$probe_json")"
  echo "ensure-api-public: reusing healthy api-public on http://${API_PUBLIC_HOST}:${API_PUBLIC_PORT} (${features} features, ${release})"
  exit 0
fi

if [[ "$MODE" == "check" ]]; then
  echo "ensure-api-public: not healthy (${probe_status})" >&2
  node --input-type=module -e "const p=JSON.parse(process.argv[1]); if(p.reason) console.error('  reason:', p.reason);" "$probe_json" >&2 || true
  exit 1
fi

listen_pid="$(port_listen_pid)"
if [[ -n "$listen_pid" ]]; then
  cmd="$(process_cmdline "$listen_pid")"
  if is_firestore_emulator_cmdline "$cmd"; then
    echo "ensure-api-public: ERROR — port :${API_PUBLIC_PORT} blocked." >&2
    describe_port_blocker "$listen_pid" >&2
    exit 1
  fi
  if is_api_public_pid "$listen_pid"; then
    if [[ "$probe_status" == "stale" || "$probe_status" == "wrong_service" ]]; then
      echo "ensure-api-public: stale api-public on :${API_PUBLIC_PORT} — restarting with postgres env…"
      stop_api_public_pid "$listen_pid"
      rm -f "$PID_FILE"
      sleep 1
    else
      echo "ensure-api-public: port :${API_PUBLIC_PORT} busy (pid ${listen_pid}) but not yet healthy — waiting…"
      wait_for_healthy 120
      exit 0
    fi
  else
    echo "ensure-api-public: ERROR — port :${API_PUBLIC_PORT} blocked." >&2
    describe_port_blocker "$listen_pid" >&2
    exit 1
  fi
fi

start_api_public
echo "ensure-api-public: log → ${LOG_FILE}"
wait_for_healthy 180
