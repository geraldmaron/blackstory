# Release pipeline helpers (BB-062)

Scripts and schemas used by `.github/workflows/deploy-staging.yml`,
`.github/workflows/deploy-production.yml`, and `.github/workflows/progressive-release.yml`.

**Public web** deploys via **Vercel** git integration; Production promote is explicit (ADR-027).
Deploy workflows record Vercel expectations, run migrate/health/smoke gates, and write provenance —
they do **not** promote Firebase App Hosting.

**Admin** interim host is App Hosting (`black-book-admin-production`, root `apphosting.admin.yaml`).
Automatic App Hosting rollouts stay disabled — admin traffic moves only through explicit Firebase CLI
rollouts at a pinned SHA:

```bash
firebase apphosting:rollouts:create black-book-admin-production \
  --project=black-book-efaaf \
  --git-commit=<sha> \
  --force
```

(`promote-app-hosting.sh` / `promote-app-hosting-dry-run.sh` were removed; they only ever targeted
retired public-web backends.)

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
| `rollback-dry-run.sh` | Production rollback rehearsal (no writes) |
| `health-check-dry-run.mjs` | Post-deploy health gate (dry-run or live URL) |
| `release-pipeline.test.mjs` | Unit tests for helpers above |

Schema source of truth remains `infra/github/release-metadata/deployment-provenance.schema.json`.

Public web rollback: Vercel promote/redeploy prior Production deployment SHA — not App Hosting.
Admin rollback: `firebase apphosting:rollouts:create black-book-admin-production` at prior good SHA.
