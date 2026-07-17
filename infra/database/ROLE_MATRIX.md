# Role ↔ service-account matrix (BB-012)

Aligns Postgres roles with single-project identities in
`infra/gcp/service-accounts.matrix.md` (`black-book-efaaf`).

| Postgres role | GCP SA | Surfaces | Allowed schemas | Forbidden |
|---------------|--------|----------|-----------------|-----------|
| `role_public_read` | `api-public@…` | `apps/api-public` | `bb_public` SELECT | evidence, research, publication write, migrations |
| `role_submissions_write` | `api-submissions@…` | `apps/api-submissions` | `bb_submissions` write | public/evidence/publication/migrations |
| `role_admin_app` | `admin@…` | `apps/admin` | `bb_admin` write; public/publication/audit read | migrate; raw evidence write; release activation (use publication) |
| `role_research` | `research@…` | `workers/research` | `bb_research`, `bb_evidence` write | `bb_public`, `bb_publication` |
| `role_publication` | `publication@…`, `api-internal@…` | `workers/publication`, `apps/api-internal` | `bb_publication`, `bb_public` write; `bb_evidence` SELECT | `bb_evidence` write; `bb_research` |
| `role_security` | `security@…` | `workers/security` | submissions + evidence scan/write paths | publish/release activation |
| `role_migrations` | `migrations@…` | migration jobs | DDL on application schemas | long-lived runtime attachment |
| `role_backup_readonly` | `backup@…` | backup/PITR | SELECT across app schemas | any write |
| — | `web-runtime@…` | `apps/web` | **none** | any DB credential / SQL Connect client |

Isolation SQL: `init/91-isolation-checks.sql`.
Pool budgets: `pool/pool-config.json`.
