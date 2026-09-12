#!/usr/bin/env bash
# Runs the CI quality gates locally, the way CI runs them.
#
# The point is not "run the tests" — `pnpm test` already does that. The point is that CI decides
# WHICH lanes run from the changed paths, and two of those predicates are counter-intuitive:
# touching packages/public-contracts fires the whole mobile lane (it is the mobile token source),
# and touching packages/research-kernel fires the Python lane (no .py file required). A session
# that runs `pnpm test` and declares itself green has not checked either one.
#
# So this mirrors .github/workflows/ci.yml job for job, computes the lanes with the same predicates
# as .github/actions/detect-changes/action.yml, and exports the same env block. Lanes that cannot
# run on a laptop are listed rather than quietly omitted.
#
# Usage:
#   scripts/ci-local.sh                      # lanes implied by the diff against origin/main
#   scripts/ci-local.sh --base origin/staging
#   scripts/ci-local.sh --all                # every lane regardless of the diff
#   scripts/ci-local.sh --lane validate --lane build-typecheck
#   scripts/ci-local.sh --skip mobile        # skip a lane by name
#   scripts/ci-local.sh --list               # show lanes and what they would run
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO_ROOT="$PWD"

BASE_REF="origin/main"
FORCE_ALL=false
LIST_ONLY=false
declare -a ONLY_LANES=()
declare -a SKIP_LANES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE_REF="${2:?--base needs a ref}"; shift 2 ;;
    --all) FORCE_ALL=true; shift ;;
    --list) LIST_ONLY=true; shift ;;
    --lane) ONLY_LANES+=("${2:?--lane needs a name}"); shift 2 ;;
    --skip) SKIP_LANES+=("${2:?--skip needs a name}"); shift 2 ;;
    -h|--help) sed -n '2,28p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# Same block as ci.yml's `env:`. Omitting it is a real source of pass-locally-fail-in-CI, because
# code that branches on NODE_ENV behaves differently under a bare shell.
export NODE_ENV=test
export LOG_LEVEL=info
export FIREBASE_PROJECT_ID=demo-repo
export BLACK_BOOK_TEST_DATABASE_URL=postgresql://blackbook:blackbook@127.0.0.1:5432/blackbook

# ---------------------------------------------------------------------------
# Toolchain fidelity. CI pins Node from .nvmrc and pnpm from setup-node-pnpm;
# a different local major is a real source of green-here-red-there, and the
# node:test reporter output even changes format between 22 and 24.
# ---------------------------------------------------------------------------
check_toolchain() {
  local want_node local_node want_pnpm local_pnpm
  want_node="$(tr -dc '0-9.' < .nvmrc)"
  local_node="$(node -v | tr -d 'v')"
  want_pnpm="$(node -e "process.stdout.write((require('./package.json').packageManager||'').split('@')[1]||'')")"
  local_pnpm="$(pnpm -v)"

  if [[ "${local_node%%.*}" != "${want_node%%.*}" ]]; then
    echo
    echo "  Node major mismatch: .nvmrc wants ${want_node}, this shell has ${local_node}." >&2
    if command -v fnm >/dev/null; then
      echo "  Re-run under the pinned major:  fnm exec --using=${want_node%%.*} -- scripts/ci-local.sh $*" >&2
    else
      echo "  Install Node ${want_node%%.*} and re-run; CI will not use ${local_node}." >&2
    fi
    [[ "${CI_LOCAL_ALLOW_NODE_MISMATCH:-}" == "1" ]] || return 1
    echo "  CI_LOCAL_ALLOW_NODE_MISMATCH=1 set — continuing on the wrong major." >&2
  fi
  if [[ -n "$want_pnpm" && "$local_pnpm" != "$want_pnpm" ]]; then
    echo "  pnpm mismatch: packageManager wants ${want_pnpm}, this shell has ${local_pnpm}." >&2
    [[ "${CI_LOCAL_ALLOW_NODE_MISMATCH:-}" == "1" ]] || return 1
  fi
  return 0
}

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
dim() { printf '\033[2m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
# Lane gating — mirrors .github/actions/detect-changes/action.yml
# ---------------------------------------------------------------------------
CODE=false
MOBILE=false
PYTHON=false
SECURITY_CODE=false
CHANGED_COUNT=0

is_noise() { [[ "$1" =~ ^(docs/|\.beads/|brand/) || "$1" =~ \.md$ || "$1" == LICENSE* ]]; }
is_mobile() { [[ "$1" =~ ^(apps/mobile/|packages/public-contracts/|brand/) ]]; }
is_python() {
  [[ "$1" == pyproject.toml || "$1" == uv.lock || "$1" == uv.toml ]] && return 0
  [[ "$1" =~ \.py$ ]] && return 0
  [[ "$1" =~ (^|/)python/ ]] && return 0
  [[ "$1" =~ ^workers/(research|security|publication)/ ]] && return 0
  [[ "$1" =~ ^packages/(research-kernel|constitution)/(.*/)?(pyproject\.toml|uv\.lock|uv\.toml)$ ]] && return 0
  return 1
}
is_security_extra() {
  [[ "$1" =~ ^(\.github/workflows/security\.yml|infra/github/security|packages/security/|SECURITY\.md) ]]
}

compute_lanes() {
  if [[ "$FORCE_ALL" == true ]]; then
    CODE=true; MOBILE=true; PYTHON=true; SECURITY_CODE=true
    dim "lanes: --all → every lane"
    return
  fi
  if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
    echo "base ref '$BASE_REF' not found; run: git fetch origin" >&2
    exit 2
  fi
  local files
  # Three-dot: compare against the merge base, which is what a pull request diffs.
  mapfile -t files < <(git diff --name-only "${BASE_REF}...HEAD")
  CHANGED_COUNT=${#files[@]}
  if [[ $CHANGED_COUNT -eq 0 ]]; then
    CODE=true; MOBILE=true; PYTHON=true; SECURITY_CODE=true
    dim "lanes: empty diff → CI fails open and runs everything"
    return
  fi
  local f
  for f in "${files[@]}"; do
    [[ -z "$f" ]] && continue
    is_mobile "$f" && MOBILE=true
    is_python "$f" && PYTHON=true
    is_security_extra "$f" && SECURITY_CODE=true
    is_noise "$f" && continue
    [[ "$f" =~ ^apps/mobile/ ]] && continue
    CODE=true
    SECURITY_CODE=true
  done
}

# ---------------------------------------------------------------------------
# Lanes. Name, the CI job it stands for, its gate, and the commands.
# ---------------------------------------------------------------------------
lane_gate() {
  case "$1" in
    install|validate|unit-js-packages|unit-js-apps|contract-security-a11y|coverage|build-typecheck|e2e) echo "$CODE" ;;
    mobile) echo "$MOBILE" ;;
    unit-py) [[ "$CODE" == true && "$PYTHON" == true ]] && echo true || echo false ;;
    governance) echo true ;;  # ungated in ci.yml
    # security.yml gates this on security_code, which every code path and packages/security set.
    security-policy) echo "$SECURITY_CODE" ;;
    *) echo false ;;
  esac
}

lane_ci_job() {
  case "$1" in
    install) echo "(every JS job's setup-node-pnpm step)" ;;
    # The lanes below stay separate so a developer can run one of them alone; several
    # now report under one CI job because ci.yml stopped giving each its own runner.
    validate) echo "Workspace Checks (validate step)" ;;
    unit-js-packages) echo "Workspace Tests (package tests step)" ;;
    unit-js-apps) echo "Workspace Tests (app tests step)" ;;
    mobile) echo "Mobile Checks" ;;
    unit-py) echo "Unit Tests (Python)" ;;
    contract-security-a11y) echo "Workspace Tests (contract/security/a11y steps)" ;;
    coverage) echo "Workspace Tests (coverage step)" ;;
    build-typecheck) echo "Workspace Checks (build + typecheck steps)" ;;
    e2e) echo "Workspace Tests (e2e step)" ;;
    governance) echo "Governance" ;;
    security-policy) echo "security.yml: Security / Policy and API Security" ;;
  esac
}

run_lane() {
  case "$1" in
    install)
      pnpm install --frozen-lockfile ;;
    validate)
      pnpm validate && pnpm format:check ;;
    unit-js-packages)
      pnpm test:preflight && pnpm -r --filter './packages/**' run --if-present test ;;
    unit-js-apps)
      pnpm test:preflight && pnpm -r --filter './apps/**' run --if-present test ;;
    mobile)
      # apps/mobile is outside the pnpm workspace and owns an npm lockfile; expo-env.d.ts is
      # gitignored, so a clean checkout (and CI) must recreate it before tsc can resolve expo/types.
      ( cd apps/mobile \
        && npm ci --no-audit --no-fund \
        && printf '/// <reference types="expo/types" />\n' > expo-env.d.ts \
        && npm run typecheck \
        && npm run lint \
        && npm test -- --ci ) ;;
    unit-py)
      command -v uv >/dev/null || { echo "uv not installed — CI installs it; see ci.yml unit-py" >&2; return 127; }
      uv sync --all-packages --frozen && pnpm test:preflight && uv run pytest ;;
    contract-security-a11y)
      pnpm test:contract && pnpm test:security && pnpm test:a11y ;;
    coverage)
      pnpm test:coverage ;;
    build-typecheck)
      pnpm build && pnpm typecheck ;;
    e2e)
      pnpm test:e2e ;;
    governance)
      node scripts/validate-github-governance.mjs ;;
    security-policy)
      # security.yml's "Policy and API Security" job. The only lane in that workflow that needs no
      # GitHub token, so it is the one that must not be left out of a local check.
      pnpm --filter @repo/testing test:security \
        && pnpm --filter @repo/testing exec node --import tsx --test \
          src/security-gates/security-gates.test.ts \
        && pnpm exec tsc --noEmit --strict --exactOptionalPropertyTypes \
          --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck \
          packages/testing/src/security-gates/contracts.ts \
          packages/testing/src/security-gates/fixtures.ts \
          packages/testing/src/security-gates/index.ts ;;
  esac
}

ALL_LANES=(install validate unit-js-packages unit-js-apps mobile unit-py contract-security-a11y coverage build-typecheck e2e governance security-policy)

if ! check_toolchain "$@"; then
  echo >&2
  echo "Refusing to run: the local toolchain does not match what CI uses." >&2
  exit 2
fi

compute_lanes

bold "Toolchain: node $(node -v)  pnpm $(pnpm -v)   (CI pins .nvmrc=$(tr -dc '0-9.' < .nvmrc))"
bold "CI lane gating for ${BASE_REF}...HEAD  (${CHANGED_COUNT} changed files)"
printf '  code=%s  mobile=%s  python=%s  security_code=%s\n\n' "$CODE" "$MOBILE" "$PYTHON" "$SECURITY_CODE"

selected=()
for lane in "${ALL_LANES[@]}"; do
  if [[ ${#ONLY_LANES[@]} -gt 0 ]]; then
    printf '%s\n' "${ONLY_LANES[@]}" | grep -qx "$lane" || continue
  fi
  if [[ ${#SKIP_LANES[@]} -gt 0 ]] && printf '%s\n' "${SKIP_LANES[@]}" | grep -qx "$lane"; then
    printf '  SKIP (--skip)  %-24s %s\n' "$lane" "$(lane_ci_job "$lane")"
    continue
  fi
  if [[ "$(lane_gate "$lane")" != true ]]; then
    printf '  SKIP (gated)   %-24s %s\n' "$lane" "$(lane_ci_job "$lane")"
    continue
  fi
  selected+=("$lane")
  printf '  RUN            %-24s %s\n' "$lane" "$(lane_ci_job "$lane")"
done

cat <<'NOTE'

Not reproducible locally — these run in CI only, so a green run here is not a green PR:
  * security.yml: CodeQL (javascript-typescript and python), SBOM generation, gitleaks secret scan,
    dependency review. They need GitHub tokens, the Actions runner image, and full fetch history.
    security.yml's Policy and API Security job DOES run here — it is the security-policy lane below.
  * security.yml's Filesystem Vulnerabilities, Image and Signature, and DAST Staging are
    workflow_dispatch-only, so they do not gate a pull request at all.
  * Integration Postgres (ci.yml): gated on the repo variable ENABLE_POSTGRES_CI and needs the
    postgis service container. Not a required check. Run it with `pnpm db:up` first if wanted.
  * Ubuntu-vs-macOS differences: case-sensitive filesystem, glibc, and the pinned runner Node.
NOTE

if [[ "$LIST_ONLY" == true ]]; then exit 0; fi
if [[ ${#selected[@]} -eq 0 ]]; then bold "No lanes selected."; exit 0; fi

declare -a results=()
overall=0
for lane in "${selected[@]}"; do
  echo
  bold "───── ${lane}  (CI job: $(lane_ci_job "$lane"))"
  start=$SECONDS
  if run_lane "$lane"; then
    took=$((SECONDS - start))
    results+=("PASS ${lane} ${took}s")
    bold "PASS ${lane} (${took}s)"
  else
    code=$?
    took=$((SECONDS - start))
    results+=("FAIL ${lane} ${took}s exit=${code}")
    bold "FAIL ${lane} (${took}s, exit ${code})"
    overall=1
  fi
done

echo
bold "───── summary"
for line in "${results[@]}"; do echo "  $line"; done
echo
if [[ $overall -eq 0 ]]; then
  bold "All selected lanes passed."
else
  bold "At least one lane FAILED — do not open the promotion PR."
fi
exit $overall
