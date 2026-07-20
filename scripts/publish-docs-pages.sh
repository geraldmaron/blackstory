#!/usr/bin/env bash
# Build the Next.js docs site and sync the static export into repo-root docs/
# for GitHub Pages (Settings → Pages → Deploy from a branch → /docs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="$ROOT/apps/docs/out"
DEST="$ROOT/docs"

echo "Building docs site (DOCS_BASE_PATH=/blackstory)…"
DOCS_BASE_PATH=/blackstory pnpm --filter @repo/docs build

if [[ ! -d "$OUT" ]]; then
  echo "error: missing build output at $OUT" >&2
  exit 1
fi

echo "Syncing static export into docs/ (keeps operating markdown)…"
# Site assets — safe to replace on every publish
rm -rf "$DEST/_next" "$DEST/guides" "$DEST/brand" "$DEST/404" "$DEST/_not-found"
mkdir -p "$DEST"

# Copy generated tree; do not delete markdown / adr / research / etc.
cp -f "$OUT/index.html" "$DEST/index.html"
cp -f "$OUT/404.html" "$DEST/404.html" 2>/dev/null || true
cp -rf "$OUT/_next" "$DEST/_next"
cp -rf "$OUT/guides" "$DEST/guides"
cp -rf "$OUT/brand" "$DEST/brand"
# Optional Next export extras
if [[ -d "$OUT/404" ]]; then cp -rf "$OUT/404" "$DEST/404"; fi
if [[ -d "$OUT/_not-found" ]]; then cp -rf "$OUT/_not-found" "$DEST/_not-found"; fi

# Disable Jekyll so _next/ and dotted paths are served as-is
touch "$DEST/.nojekyll"

echo "Published to docs/. Commit docs/ (including _next/) and push to main for Pages."
