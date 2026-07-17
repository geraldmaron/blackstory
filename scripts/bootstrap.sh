# Bootstrap helper for fresh clones.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for command_name in node pnpm uv; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

node_major="$(node --version | tr -d 'v' | cut -d. -f1)"
if [ "$node_major" -lt 22 ]; then
  echo "Node.js 22 or newer is required (found $(node --version))." >&2
  exit 1
fi

echo "==> Node/pnpm install"
pnpm install --frozen-lockfile

echo "==> Python/uv sync"
uv sync --all-packages --frozen

echo "==> Done. Useful next commands:"
echo "  pnpm test"
echo "  pnpm build"
echo "  pnpm validate"
echo "  pnpm db:up   # requires Docker"
