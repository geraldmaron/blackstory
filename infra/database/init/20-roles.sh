#!/usr/bin/env bash
# Creates least-privilege Postgres login roles for local/CI (BB-012).
# Passwords come from environment with local-only defaults — never production secrets.
set -euo pipefail

: "${POSTGRES_USER:=blackbook}"
: "${POSTGRES_DB:=blackbook}"

PUBLIC_PW="${BB_ROLE_PUBLIC_READ_PASSWORD:-local-public-read}"
SUBMISSIONS_PW="${BB_ROLE_SUBMISSIONS_WRITE_PASSWORD:-local-submissions-write}"
ADMIN_PW="${BB_ROLE_ADMIN_APP_PASSWORD:-local-admin-app}"
RESEARCH_PW="${BB_ROLE_RESEARCH_PASSWORD:-local-research}"
PUBLICATION_PW="${BB_ROLE_PUBLICATION_PASSWORD:-local-publication}"
MIGRATIONS_PW="${BB_ROLE_MIGRATIONS_PASSWORD:-local-migrations}"
BACKUP_PW="${BB_ROLE_BACKUP_READONLY_PASSWORD:-local-backup-readonly}"
SECURITY_PW="${BB_ROLE_SECURITY_PASSWORD:-local-security}"

PSQL=(psql -v ON_ERROR_STOP=1)
if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL+=("$DATABASE_URL")
elif [[ -n "${BLACK_BOOK_TEST_DATABASE_URL:-}" ]]; then
  PSQL+=("$BLACK_BOOK_TEST_DATABASE_URL")
else
  PSQL+=(--username "$POSTGRES_USER" --dbname "$POSTGRES_DB")
fi

"${PSQL[@]}" <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_public_read') THEN
    CREATE ROLE role_public_read LOGIN PASSWORD '${PUBLIC_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_submissions_write') THEN
    CREATE ROLE role_submissions_write LOGIN PASSWORD '${SUBMISSIONS_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_admin_app') THEN
    CREATE ROLE role_admin_app LOGIN PASSWORD '${ADMIN_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_research') THEN
    CREATE ROLE role_research LOGIN PASSWORD '${RESEARCH_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_publication') THEN
    CREATE ROLE role_publication LOGIN PASSWORD '${PUBLICATION_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_migrations') THEN
    CREATE ROLE role_migrations LOGIN PASSWORD '${MIGRATIONS_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_backup_readonly') THEN
    CREATE ROLE role_backup_readonly LOGIN PASSWORD '${BACKUP_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_security') THEN
    CREATE ROLE role_security LOGIN PASSWORD '${SECURITY_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
\$\$;

COMMENT ON ROLE role_public_read IS 'api-public: SELECT on bb_public only';
COMMENT ON ROLE role_submissions_write IS 'api-submissions: write quarantine/intake only';
COMMENT ON ROLE role_admin_app IS 'admin app: admin schema + selected reads; no migrate/publish';
COMMENT ON ROLE role_research IS 'research worker: research/evidence write; no public/publication write';
COMMENT ON ROLE role_publication IS 'publication/api-internal: projections/releases; no raw evidence write';
COMMENT ON ROLE role_migrations IS 'migration jobs only';
COMMENT ON ROLE role_backup_readonly IS 'backup/PITR read path';
COMMENT ON ROLE role_security IS 'security worker: quarantine + evidence scan';
EOSQL
