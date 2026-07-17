-- Role grants enforcing publication / research / public invariants (BB-012).
-- Re-runnable: REVOKEs first, then GRANT least privilege.

-- Drop default public privileges on application schemas.
REVOKE ALL ON SCHEMA bb_public FROM PUBLIC;
REVOKE ALL ON SCHEMA bb_submissions FROM PUBLIC;
REVOKE ALL ON SCHEMA bb_research FROM PUBLIC;
REVOKE ALL ON SCHEMA bb_evidence FROM PUBLIC;
REVOKE ALL ON SCHEMA bb_publication FROM PUBLIC;
REVOKE ALL ON SCHEMA bb_admin FROM PUBLIC;
REVOKE ALL ON SCHEMA bb_audit FROM PUBLIC;
REVOKE ALL ON SCHEMA bb_migrations FROM PUBLIC;

-- Migrations owns DDL on application schemas.
GRANT USAGE, CREATE ON SCHEMA bb_public TO role_migrations;
GRANT USAGE, CREATE ON SCHEMA bb_submissions TO role_migrations;
GRANT USAGE, CREATE ON SCHEMA bb_research TO role_migrations;
GRANT USAGE, CREATE ON SCHEMA bb_evidence TO role_migrations;
GRANT USAGE, CREATE ON SCHEMA bb_publication TO role_migrations;
GRANT USAGE, CREATE ON SCHEMA bb_admin TO role_migrations;
GRANT USAGE, CREATE ON SCHEMA bb_audit TO role_migrations;
GRANT USAGE, CREATE ON SCHEMA bb_migrations TO role_migrations;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bb_migrations TO role_migrations;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bb_migrations TO role_migrations;
ALTER DEFAULT PRIVILEGES IN SCHEMA bb_migrations
  GRANT ALL PRIVILEGES ON TABLES TO role_migrations;

-- Public API: read released projections only.
GRANT USAGE ON SCHEMA bb_public TO role_public_read;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_public TO role_public_read;
ALTER DEFAULT PRIVILEGES IN SCHEMA bb_public
  GRANT SELECT ON TABLES TO role_public_read;

-- Submissions: quarantine write path only.
GRANT USAGE ON SCHEMA bb_submissions TO role_submissions_write;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA bb_submissions TO role_submissions_write;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bb_submissions TO role_submissions_write;
ALTER DEFAULT PRIVILEGES IN SCHEMA bb_submissions
  GRANT SELECT, INSERT, UPDATE ON TABLES TO role_submissions_write;

-- Research: staging + evidence write; never public/publication.
GRANT USAGE ON SCHEMA bb_research TO role_research;
GRANT USAGE ON SCHEMA bb_evidence TO role_research;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bb_research TO role_research;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA bb_evidence TO role_research;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bb_research TO role_research;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bb_evidence TO role_research;
ALTER DEFAULT PRIVILEGES IN SCHEMA bb_research
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_research;
ALTER DEFAULT PRIVILEGES IN SCHEMA bb_evidence
  GRANT SELECT, INSERT, UPDATE ON TABLES TO role_research;

-- Publication: projections/releases; read evidence; cannot modify raw evidence.
GRANT USAGE ON SCHEMA bb_publication TO role_publication;
GRANT USAGE ON SCHEMA bb_public TO role_publication;
GRANT USAGE ON SCHEMA bb_evidence TO role_publication;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bb_publication TO role_publication;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bb_public TO role_publication;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_evidence TO role_publication;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bb_publication TO role_publication;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bb_public TO role_publication;
ALTER DEFAULT PRIVILEGES IN SCHEMA bb_publication
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_publication;
ALTER DEFAULT PRIVILEGES IN SCHEMA bb_public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_publication;
ALTER DEFAULT PRIVILEGES IN SCHEMA bb_evidence
  GRANT SELECT ON TABLES TO role_publication;

-- Admin app: admin + selected reads; no evidence write, no migrations, no release activation beyond publication role.
GRANT USAGE ON SCHEMA bb_admin TO role_admin_app;
GRANT USAGE ON SCHEMA bb_public TO role_admin_app;
GRANT USAGE ON SCHEMA bb_publication TO role_admin_app;
GRANT USAGE ON SCHEMA bb_audit TO role_admin_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA bb_admin TO role_admin_app;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_public TO role_admin_app;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_publication TO role_admin_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA bb_audit TO role_admin_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bb_admin TO role_admin_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bb_audit TO role_admin_app;

-- Security: quarantine + evidence for scanning.
GRANT USAGE ON SCHEMA bb_submissions TO role_security;
GRANT USAGE ON SCHEMA bb_evidence TO role_security;
GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA bb_submissions TO role_security;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA bb_evidence TO role_security;

-- Backup: read-only across application schemas.
GRANT USAGE ON SCHEMA bb_public TO role_backup_readonly;
GRANT USAGE ON SCHEMA bb_submissions TO role_backup_readonly;
GRANT USAGE ON SCHEMA bb_research TO role_backup_readonly;
GRANT USAGE ON SCHEMA bb_evidence TO role_backup_readonly;
GRANT USAGE ON SCHEMA bb_publication TO role_backup_readonly;
GRANT USAGE ON SCHEMA bb_admin TO role_backup_readonly;
GRANT USAGE ON SCHEMA bb_audit TO role_backup_readonly;
GRANT USAGE ON SCHEMA bb_migrations TO role_backup_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_public TO role_backup_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_submissions TO role_backup_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_research TO role_backup_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_evidence TO role_backup_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_publication TO role_backup_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_admin TO role_backup_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_audit TO role_backup_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_migrations TO role_backup_readonly;

-- Explicit denials (defense in depth; PostgreSQL has no DENY, so revoke any accidental grants).
REVOKE ALL ON SCHEMA bb_public FROM role_research;
REVOKE ALL ON SCHEMA bb_publication FROM role_research;
REVOKE ALL ON ALL TABLES IN SCHEMA bb_public FROM role_research;
REVOKE ALL ON ALL TABLES IN SCHEMA bb_publication FROM role_research;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA bb_evidence FROM role_publication;
REVOKE ALL ON SCHEMA bb_research FROM role_publication;
REVOKE ALL ON ALL TABLES IN SCHEMA bb_research FROM role_publication;

REVOKE ALL ON SCHEMA bb_evidence FROM role_public_read;
REVOKE ALL ON SCHEMA bb_research FROM role_public_read;
REVOKE ALL ON SCHEMA bb_publication FROM role_public_read;
REVOKE ALL ON SCHEMA bb_submissions FROM role_public_read;
REVOKE ALL ON SCHEMA bb_migrations FROM role_public_read;

REVOKE ALL ON SCHEMA bb_public FROM role_submissions_write;
REVOKE ALL ON SCHEMA bb_evidence FROM role_submissions_write;
REVOKE ALL ON SCHEMA bb_publication FROM role_submissions_write;
REVOKE ALL ON SCHEMA bb_migrations FROM role_submissions_write;
