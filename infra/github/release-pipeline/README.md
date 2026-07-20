# Release pipeline helpers (BB-062)

Scripts and schemas used by `.github/workflows/deploy-staging.yml`,
`.github/workflows/deploy-production.yml`, and `.github/workflows/progressive-release.yml`.

**App Hosting promote is live** via `promote-app-hosting.sh` when GitHub Environment WIF vars
are set (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`). Automatic App Hosting
rollouts stay disabled — traffic only moves through that explicit promote (or the same script
run locally with Firebase CLI auth).

Firestore migrate / surface deploy / rollback helpers remain dry-run until separately promoted.
WIF apply: `infra/github/scripts/apply-wif.sh` (see `docs/runbooks/production-release.md`).

## Layout

| Path | Role |
|------|------|
| `lib/provenance.mjs` | Build + validate deployment provenance JSON |
| `lib/changelog.mjs` | Generate changelog from `git log` / conventional commits |
| `lib/auto-rollout-guard.mjs` | Assert automatic App Hosting rollouts stay disabled |
| `validate-provenance.mjs` | CLI: validate provenance against schema |
| `generate-changelog.mjs` | CLI: write `CHANGELOG.md` fragment for a SHA range |
| `write-provenance.mjs` | CLI: emit provenance for staging/production |
| `migrate-firestore-dry-run.sh` | Firestore rules/indexes sequencing (before traffic) |
| `promote-app-hosting.sh` | Explicit App Hosting promote (live; `DRY_RUN=1` for print-only) |
| `promote-app-hosting-dry-run.sh` | Thin wrapper: `DRY_RUN=1` → `promote-app-hosting.sh` |
| `rollback-dry-run.sh` | Production rollback rehearsal (no writes) |
| `health-check-dry-run.mjs` | Post-deploy health gate (dry-run or live URL) |
| `release-pipeline.test.mjs` | Unit tests for helpers above |

Schema source of truth remains `infra/github/release-metadata/deployment-provenance.schema.json`.
