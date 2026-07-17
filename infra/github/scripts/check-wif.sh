#!/usr/bin/env bash
# Read-only verification of GitHub Actions WIF resources in black-book-efaaf (BB-010).
# Does not mutate cloud. Exits 0 with SKIP notes when gcloud/auth/pool are unavailable.
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-black-book-efaaf}"
POOL_ID="${WIF_POOL_ID:-black-book-github}"
PROVIDER_ID="${WIF_PROVIDER_ID:-github-actions}"
DEPLOY_SA="${DEPLOY_SA:-github-deploy@${PROJECT_ID}.iam.gserviceaccount.com}"
ALLOW_MISSING=0

usage() {
  cat <<'EOF'
Usage: check-wif.sh [--allow-missing]

  Read-only gcloud inventory of the WIF pool/provider and deploy SA key posture.

  --allow-missing   Exit 0 when gcloud auth or WIF resources are absent (local default).

Environment:
  GCP_PROJECT_ID   Default black-book-efaaf
  WIF_POOL_ID      Default black-book-github
  WIF_PROVIDER_ID  Default github-actions
  DEPLOY_SA        Default github-deploy@black-book-efaaf.iam.gserviceaccount.com
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-missing) ALLOW_MISSING=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

skip_or_fail() {
  local message="$1"
  if [[ "$ALLOW_MISSING" -eq 1 ]]; then
    echo "SKIP: $message"
    exit 0
  fi
  echo "FAIL: $message" >&2
  exit 1
}

if ! command -v gcloud >/dev/null 2>&1; then
  skip_or_fail "gcloud CLI not installed"
fi

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  skip_or_fail "no active gcloud account (run gcloud auth login)"
fi

echo "==> Project ${PROJECT_ID}"
if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  skip_or_fail "cannot describe project ${PROJECT_ID}"
fi

echo "==> Workload Identity Pool ${POOL_ID}"
if ! gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --format='yaml(name,state)' 2>/dev/null; then
  skip_or_fail "WIF pool ${POOL_ID} not found (declarative only until apply-wif.sh --apply)"
fi

echo "==> Provider ${PROVIDER_ID}"
gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --format='yaml(name,state,oidc.issuerUri,attributeCondition)'

echo "==> Deploy SA keys (expect zero USER_MANAGED)"
if gcloud iam service-accounts describe "$DEPLOY_SA" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts keys list \
    --iam-account="$DEPLOY_SA" \
    --project="$PROJECT_ID" \
    --format='table(name.basename(),keyType,validAfterTime)'
  USER_KEYS="$(gcloud iam service-accounts keys list \
    --iam-account="$DEPLOY_SA" \
    --project="$PROJECT_ID" \
    --filter='keyType=USER_MANAGED' \
    --format='value(name)' | wc -l | tr -d ' ')"
  if [[ "$USER_KEYS" != "0" ]]; then
    echo "FAIL: ${USER_KEYS} USER_MANAGED key(s) on ${DEPLOY_SA}; see infra/github/oidc/sa-key-removal.md" >&2
    exit 1
  fi
  echo "OK: no USER_MANAGED keys on ${DEPLOY_SA}"
else
  echo "WARN: deploy SA ${DEPLOY_SA} not found yet (BB-005/011 provisioning)"
fi

echo "WIF check complete."
