#!/usr/bin/env bash
# Brand-agnostic codemod: @blap -> @repo, ds-/--ds- -> ds-/--ds-, APP_ -> APP_
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# File types to touch (exclude node_modules, .git, dist, .next, beads, brand masters)
mapfile -t FILES < <(rg -l --glob '!**/node_modules/**' --glob '!**/.git/**' --glob '!**/dist/**' --glob '!**/.next/**' --glob '!**/.beads/**' --glob '!**/embeddeddolt/**' --glob '!**/plan.md' -e '@blap|APP_|--ds-|ds-|PACKAGE_SCOPE = .@blap' . 2>/dev/null || true)

echo "Touching ${#FILES[@]} files for brand-agnostic renames"

for f in "${FILES[@]}"; do
  # Skip binary
  if file "$f" | grep -qi 'image\|binary\|PNG\|JPEG'; then
    continue
  fi
  perl -i -pe '
    s/\@repo\//\@repo\//g;
    s/"\@repo\//"\@repo\//g;
    s/'\''\@repo\//'\''\@repo\//g;
    s/APP_/APP_/g;
    s/--ds-/--ds-/g;
    s/\bbp-/ds-/g;
    s/\.ds-/.ds-/g;
  ' "$f"
done

# package.json name fields that are exactly "@repo/..."
mapfile -t PKGS < <(rg -l --glob '**/package.json' '"name": "@repo/' . 2>/dev/null || true)
for f in "${PKGS[@]}"; do
  perl -i -pe 's/"name": "@repo\//"name": "@repo\//g' "$f"
done

echo "Done package/CSS/env renames"
