-- Black Book logical schemas (BB-012 foundation; full tables land in BB-013).
-- These schemas encode the publication / research / public boundary.

CREATE SCHEMA IF NOT EXISTS bb_public;
COMMENT ON SCHEMA bb_public IS 'Released public projections and views only; public API read role.';

CREATE SCHEMA IF NOT EXISTS bb_submissions;
COMMENT ON SCHEMA bb_submissions IS 'Intake / quarantine tables; submissions write role only.';

CREATE SCHEMA IF NOT EXISTS bb_research;
COMMENT ON SCHEMA bb_research IS 'Research staging; research role writes; cannot publish.';

CREATE SCHEMA IF NOT EXISTS bb_evidence;
COMMENT ON SCHEMA bb_evidence IS 'Canonical raw evidence; research/security write; publication read-only.';

CREATE SCHEMA IF NOT EXISTS bb_publication;
COMMENT ON SCHEMA bb_publication IS 'Projection build and release metadata; publication role writes.';

CREATE SCHEMA IF NOT EXISTS bb_admin;
COMMENT ON SCHEMA bb_admin IS 'Admin application tables; not public.';

CREATE SCHEMA IF NOT EXISTS bb_audit;
COMMENT ON SCHEMA bb_audit IS 'Append-oriented audit trail.';

CREATE SCHEMA IF NOT EXISTS bb_migrations;
COMMENT ON SCHEMA bb_migrations IS 'Migration bookkeeping owned by role_migrations.';

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;
