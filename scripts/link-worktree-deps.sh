#!/usr/bin/env bash
# Link an agent worktree's node_modules at the main checkout's, instead of re-installing.
#
# A `git worktree` is a bare source tree: no node_modules anywhere, so nothing runs in it until
# dependencies exist. `pnpm install` per worktree is the obvious answer and the wrong one — it
# costs minutes and gigabytes each, and a previous agent session left 58 worktrees holding
# roughly 26GB of duplicated dependency trees (repo-un17q).
#
# pnpm's layout makes linking safe: every node_modules directory it creates is already nothing
# but symlinks into the single content-addressed store under the ROOT node_modules/.pnpm. So
# pointing a worktree's node_modules directories at the main checkout's gives the worktree the
# same resolved graph, byte-for-byte, with no copy.
#
# The link is per-directory, not one link at the root: pnpm puts a node_modules beside every
# workspace package, and Node resolves upward from the importing file, so apps/web needs its own.
#
# CAVEAT, and it is the reason this is a script and not a habit: the worktree shares the main
# checkout's INSTALLED graph. If the worktree changes a package.json or a lockfile, it is running
# against the wrong dependencies and this script is the wrong tool — run a real install there.
set -euo pipefail

WORKTREE="${1:?usage: link-worktree-deps.sh <worktree-path> [main-checkout]}"
MAIN="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

[ -d "$WORKTREE" ] || { echo "no such worktree: $WORKTREE" >&2; exit 1; }
[ -d "$MAIN/node_modules" ] || { echo "main checkout has no node_modules: $MAIN" >&2; exit 1; }

linked=0
while IFS= read -r nm; do
  rel="${nm#"$MAIN"/}"
  target="$WORKTREE/$rel"
  [ -e "$target" ] && continue
  mkdir -p "$(dirname "$target")"
  ln -s "$nm" "$target"
  linked=$((linked + 1))
done < <(
  printf '%s\n' "$MAIN/node_modules"
  find "$MAIN/apps" "$MAIN/packages" -mindepth 2 -maxdepth 2 -type d -name node_modules 2>/dev/null
)

echo "linked $linked node_modules directories into $WORKTREE"
