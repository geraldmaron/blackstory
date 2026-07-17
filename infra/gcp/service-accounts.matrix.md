# Service-account matrix (BB-005)

All identities are designed in the single production project `black-book-efaaf`; none is considered
provisioned until BB-011 verifies it. Email pattern:
`<id>@black-book-efaaf.iam.gserviceaccount.com`.

| SA | Surface | Postgres role (BB-012/013) | Bucket access | Must not have |
|----|---------|----------------------------|---------------|---------------|
| `web-runtime` | `apps/web` | — | public-media read | private-evidence/quarantine/exports; DB write; publish |
| `api-public` | `apps/api-public` | `role_public_read` | public-media read | private-evidence/quarantine; canonical write; publish/migrate |
| `api-submissions` | `apps/api-submissions` | `role_submissions_write` | quarantine create only | object read; evidence/public-media; canonical write; publish |
| `api-internal` | `apps/api-internal` | `role_publication` | private-evidence read; public-media/exports write | public ingress; raw-evidence write; end-user invocation |
| `admin` | `apps/admin` | `role_admin_app` | public-media/private-evidence/quarantine read | ingress without IAP; release-workflow bypass |
| `migrations` | migration job | `role_migrations` | none | long-running runtime attachment; publish; bucket reads |
| `research` | `workers/research` | `role_research` | private-evidence admin | public-media write; projections/releases; deploy/impersonation |
| `publication` | `workers/publication` | `role_publication` | private-evidence read; public-media/exports admin | raw-evidence write; public ingress |
| `security` | `workers/security` | `role_security` | quarantine/private-evidence admin; public-media create | publish/release activation; public ingress |
| `backup` | backup/PITR | `role_backup_readonly` | none initially | canonical write; publish; unrelated storage |
| `github-deploy` | GitHub Actions WIF | — | none at runtime | keys; runtime attachment; unprotected-context trust |

## Binding rules

1. Runtime identities never hold deploy/admin roles.
2. No SA receives Owner, Editor, project-wide Storage Admin/Viewer, Token Creator, or broad Service
   Account User.
3. Secret access is per named secret, not project-wide.
4. `github-deploy` may impersonate only the exact runtime SAs required for a reviewed deployment and
   only through WIF bound to numeric repository/owner IDs plus protected production context
   ([`wif/trust-conditions.md`](./wif/trust-conditions.md)).
5. Research and publication remain different identities and database roles even though the project
   is shared.
6. The backup identity gains storage access only if BB-020 adds a separately reviewed backup export
   bucket; managed Cloud SQL backup/PITR permissions are handled separately.
7. Optional `github-deploy-staging` (same project) is configuration separation only and is disabled
   by default in WIF Terraform (`enable_staging_deploy_identity=false`).

The former per-environment SA copies are deferred with the multi-project migration. Configuration
names such as staging do not justify duplicate identities unless permissions differ and the new
identity has an explicit threat-model purpose.
