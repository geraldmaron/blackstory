# Release pipeline helpers (BB-062)

Scripts and schemas used by `.github/workflows/deploy-staging.yml`,
`.github/workflows/deploy-production.yml`, and `.github/workflows/progressive-release.yml`.

No live cloud mutations — dry-run commands and validation only until a human operator applies
WIF, disables automatic App Hosting rollouts in the Firebase console, and runs the documented
steps in `docs/runbooks/production-release.md`.

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
| `promote-app-hosting-dry-run.sh` | Explicit App Hosting promote (no auto rollout) |
| `rollback-dry-run.sh` | Production rollback rehearsal (no writes) |
| `health-check-dry-run.mjs` | Post-deploy health gate (dry-run or live URL) |
| `release-pipeline.test.mjs` | Unit tests for helpers above |

Schema source of truth remains `infra/github/release-metadata/deployment-provenance.schema.json`.
