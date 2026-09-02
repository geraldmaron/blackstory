#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" for the monorepo's two Vercel projects.
#
# WHY THIS EXISTS (Vercel bill, Aug 2026). Build CPU Minutes were $64.68 of a $234 invoice —
# 12d 23h of build machine time, the second-largest line after the uncached `/` payload. Both
# Vercel projects rebuild on every push to `staging`, but most pushes cannot change either
# deployed bundle: of 437 commits in Aug 2026, only 143 touched `apps/web`'s build graph and
# only 62 touched `apps/admin`'s. The rest were beads bookkeeping, ops-data scripts, docs,
# research packages and mobile — none of which ship in a Vercel deployment.
#
# CONTRACT (Vercel's, not ours, and it is backwards from what you expect):
#   exit 0  -> SKIP the build
#   exit 1  -> RUN the build
#
# FAIL OPEN, ALWAYS. Every uncertain branch below exits 1. A build that runs when it did not
# need to costs a few cents. A build that is skipped when it was needed means production
# silently does not get the fix, and nothing reports it — the failure is invisible until
# someone notices the site is stale. Those are not symmetric, so this script only ever skips
# when it is certain, and treats "I could not tell" as "build".
#
# SKIP LIST, NOT TRIGGER LIST. The decision is inverted on purpose: we enumerate the paths that
# are *known* not to reach a deployed bundle, and build for anything else. A trigger list would
# have to name every workspace package in the app's dependency graph, and would silently go
# stale the moment `apps/web` gains a dependency — producing exactly the invisible skipped-build
# failure above. With a skip list, a new dependency defaults to "build", which is safe.
#
# We cannot ask pnpm for the real dependency graph here: Vercel runs the ignore step *before*
# `installCommand`, so there are no node_modules and no pnpm.
#
# Usage (from vercel.json, which runs it with CWD = the project's Root Directory):
#   "ignoreCommand": "bash ../../scripts/vercel-ignore-build.sh web"
#
# Local check against real history:
#   scripts/vercel-ignore-build.sh web --explain <base-sha> <head-sha>
set -uo pipefail

APP="${1:-}"
if [[ "$APP" != "web" && "$APP" != "admin" ]]; then
  echo "vercel-ignore-build: expected 'web' or 'admin' as \$1, got '${APP}'. Building." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Paths that can never change a deployed Vercel bundle for EITHER project.
#
# Deliberately NOT on this list, even though it is tempting:
#   scripts/**   — root build tooling; cheap to rebuild, expensive to be wrong about.
#   *.json at the repo root, package.json anywhere, pnpm-lock.yaml, pnpm-workspace.yaml,
#                — any dependency change must rebuild.
#   packages/testing/**, packages/*-config/**
#                — not shipped, but a lockfile-adjacent change here is not worth the risk.
# ---------------------------------------------------------------------------
SHARED_SKIP=(
  '.beads/'
  '.claude/'
  '.github/'
  '.cursor/'
  'docs/'
  'infra/'
  'apps/mobile/'
  'apps/docs/'
  'apps/api-internal/'
  'apps/api-public/'
  'apps/api-submissions/'
  'packages/ops-data/'
  'packages/operator-cli/'
  'packages/operator-mcp/'
  'packages/research-harness/'
  'packages/research-kernel/'
  'packages/migrate-firestore-postgres/'
  'packages/firebase/'
)

# Each project is also unaffected by the other project's app directory.
if [[ "$APP" == "web" ]]; then
  SKIP=("${SHARED_SKIP[@]}" 'apps/admin/')
else
  SKIP=("${SHARED_SKIP[@]}" 'apps/web/')
fi

EXPLAIN=0
if [[ "${2:-}" == "--explain" ]]; then
  EXPLAIN=1
  BASE_SHA="${3:-}"
  HEAD_SHA="${4:-HEAD}"
else
  # `VERCEL_GIT_PREVIOUS_SHA` is the last commit Vercel built for this project, which is the
  # correct base: a push can batch many commits, so `HEAD^` would miss everything but the last.
  # It is empty on a project's first deploy.
  BASE_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"
  HEAD_SHA="${VERCEL_GIT_COMMIT_SHA:-HEAD}"
fi

fail_open() {
  echo "vercel-ignore-build[$APP]: $1 — building." >&2
  exit 1
}

# Production deploys are rare, deliberate and workflow_dispatch-gated (see
# .github/workflows/deploy-production.yml). Never let this script stand between an operator and
# a production rollout, whatever the diff says.
if [[ "${VERCEL_ENV:-}" == "production" && "$EXPLAIN" -eq 0 ]]; then
  fail_open "VERCEL_ENV=production"
fi

[[ -n "$BASE_SHA" ]] || fail_open "no VERCEL_GIT_PREVIOUS_SHA (first deploy?)"

# Vercel shallow-clones, so the base commit may not be in the local history. Try to deepen;
# if it still is not reachable, we cannot compute a diff and must build.
if ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
  git fetch --depth=100 origin "$BASE_SHA" >/dev/null 2>&1 || true
fi
git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null || fail_open "base commit $BASE_SHA unreachable"
git cat-file -e "${HEAD_SHA}^{commit}" 2>/dev/null || fail_open "head commit $HEAD_SHA unreachable"

CHANGED="$(git diff --name-only "$BASE_SHA" "$HEAD_SHA" 2>/dev/null)" || fail_open "git diff failed"

# An empty diff means Vercel is redeploying the same tree (a retry, or a settings change).
# Build: the operator asked for a deployment and the diff is not evidence they did not.
[[ -n "$CHANGED" ]] || fail_open "empty diff between $BASE_SHA and $HEAD_SHA"

RELEVANT=()
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  skip=0
  for prefix in "${SKIP[@]}"; do
    if [[ "$file" == "$prefix"* ]]; then
      skip=1
      break
    fi
  done
  # Markdown never reaches a bundle, wherever it lives — including inside apps/web.
  if [[ "$skip" -eq 0 && "$file" == *.md ]]; then
    skip=1
  fi
  [[ "$skip" -eq 1 ]] || RELEVANT+=("$file")
done <<<"$CHANGED"

if [[ "$EXPLAIN" -eq 1 ]]; then
  echo "app=$APP base=$BASE_SHA head=$HEAD_SHA changed=$(wc -l <<<"$CHANGED") relevant=${#RELEVANT[@]}"
  printf '  %s\n' "${RELEVANT[@]:0:20}"
fi

if [[ "${#RELEVANT[@]}" -eq 0 ]]; then
  echo "vercel-ignore-build[$APP]: no file in this diff can reach the deployed bundle — skipping."
  exit 0
fi

echo "vercel-ignore-build[$APP]: ${#RELEVANT[@]} relevant file(s), e.g. ${RELEVANT[0]} — building."
exit 1
