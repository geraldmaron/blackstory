#!/usr/bin/env bash
# Applies GitHub Actions WIF Terraform for black-book-efaaf (BB-010).
# Default mode is dry-run (terraform plan). Mutating apply requires --apply.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${ROOT}/infra/gcp/wif/terraform"
TFVARS_EXAMPLE="${TF_DIR}/envs/prod.tfvars.example"
TFVARS="${WIF_TFVARS:-${TF_DIR}/envs/prod.tfvars}"

APPLY=0

usage() {
  cat <<'EOF'
Usage: apply-wif.sh [--dry-run] [--apply]

  --dry-run   terraform init + validate + plan (default). Never mutates cloud.
  --apply     terraform apply after plan confirmation requirements are met.

Environment:
  WIF_TFVARS   Path to tfvars (default: infra/gcp/wif/terraform/envs/prod.tfvars).
               Falls back to prod.tfvars.example for dry-run validate-only when missing.

Prerequisites for a meaningful plan/apply:
  - gcloud auth application-default login
  - github-deploy SA exists in black-book-efaaf
  - prod.tfvars filled with numeric GitHub repository_id and owner_id
  - BB-009 remote governance applied (recommended before production trust)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) APPLY=0 ;;
    --apply) APPLY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required." >&2
  exit 1
fi

cd "$TF_DIR"

echo "==> terraform init -backend=false"
terraform init -backend=false -input=false

echo "==> terraform validate"
terraform validate

VAR_FILE="$TFVARS"
if [[ ! -f "$VAR_FILE" ]]; then
  echo "No ${VAR_FILE}; using example tfvars for local validate/plan shape."
  VAR_FILE="$TFVARS_EXAMPLE"
fi

echo "==> Checking GitHub ID readiness in ${VAR_FILE}"
if ! grep -Eq 'github_repository_id\s*=\s*"[1-9][0-9]*"' "$VAR_FILE"; then
  echo "WARN: github_repository_id is unset/TBD — provider attribute_condition fails closed."
  echo "      Fill numeric IDs after the GitHub remote exists before --apply."
fi

echo "==> terraform plan -var-file=${VAR_FILE}"
set +e
terraform plan -var-file="$VAR_FILE" -input=false -out="${TF_DIR}/.wif.tfplan" 2>&1 | tee /tmp/black-book-wif-plan.log
PLAN_STATUS=${PIPESTATUS[0]}
set -e

if [[ "$PLAN_STATUS" -ne 0 ]]; then
  echo "Plan failed (expected until github-deploy SA exists and IDs are set)."
  echo "Dry-run default treats this as a non-mutating check; see /tmp/black-book-wif-plan.log"
  if [[ "$APPLY" -eq 1 ]]; then
    exit "$PLAN_STATUS"
  fi
  echo "Dry-run complete: terraform validate OK; plan not applicable yet."
  exit 0
fi

if [[ "$APPLY" -eq 0 ]]; then
  echo "Dry-run complete. Re-run with --apply to mutate GCP (requires human review of the plan)."
  rm -f "${TF_DIR}/.wif.tfplan"
  exit 0
fi

if ! grep -Eq 'github_repository_id\s*=\s*"[1-9][0-9]*"' "$VAR_FILE"; then
  echo "Refusing --apply: github_repository_id is unset. Fill numeric IDs in ${VAR_FILE} first." >&2
  rm -f "${TF_DIR}/.wif.tfplan"
  exit 1
fi

if grep -q 'assertion.repository_id == \\"0\\" && false' /tmp/black-book-wif-plan.log 2>/dev/null; then
  echo "Refusing --apply: attribute_condition is fail-closed (IDs not ready)." >&2
  rm -f "${TF_DIR}/.wif.tfplan"
  exit 1
fi

echo "==> terraform apply (mutating)"
terraform apply -input=false "${TF_DIR}/.wif.tfplan"
rm -f "${TF_DIR}/.wif.tfplan"
echo "Apply complete. Record outputs for GitHub Environment variables (see infra/github/oidc/README.md)."
