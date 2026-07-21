-- 0002_schemas_roles: private bb_* schemas + USAGE grants (ADR-020).
-- Product tables must not live in public.

CREATE SCHEMA IF NOT EXISTS bb_auth;
COMMENT ON SCHEMA bb_auth IS 'Auth helpers for Supabase JWT app_metadata.bb_role';

CREATE SCHEMA IF NOT EXISTS bb_public;
COMMENT ON SCHEMA bb_public IS 'Released public projections and active release pointer';

CREATE SCHEMA IF NOT EXISTS bb_submissions;
COMMENT ON SCHEMA bb_submissions IS 'Quarantined intake only';

CREATE SCHEMA IF NOT EXISTS bb_research;
COMMENT ON SCHEMA bb_research IS 'Research cases; cannot publish';

CREATE SCHEMA IF NOT EXISTS bb_evidence;
COMMENT ON SCHEMA bb_evidence IS 'Evidence metadata and source provenance';

CREATE SCHEMA IF NOT EXISTS bb_canonical;
COMMENT ON SCHEMA bb_canonical IS 'Canonical entities, claims, relationships';

CREATE SCHEMA IF NOT EXISTS bb_publication;
COMMENT ON SCHEMA bb_publication IS 'Release records and activation RPCs';

CREATE SCHEMA IF NOT EXISTS bb_reference;
COMMENT ON SCHEMA bb_reference IS 'Jurisdictions and published statistics';

CREATE SCHEMA IF NOT EXISTS bb_ops;
COMMENT ON SCHEMA bb_ops IS 'Policy, kill switches, outbox, catalog ops';

CREATE SCHEMA IF NOT EXISTS bb_audit;
COMMENT ON SCHEMA bb_audit IS 'Append-only audit trail';

GRANT USAGE ON SCHEMA bb_auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA bb_public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA bb_submissions TO authenticated, service_role;
GRANT USAGE ON SCHEMA bb_research TO authenticated, service_role;
GRANT USAGE ON SCHEMA bb_evidence TO authenticated, service_role;
GRANT USAGE ON SCHEMA bb_canonical TO service_role;
GRANT USAGE ON SCHEMA bb_publication TO authenticated, service_role;
GRANT USAGE ON SCHEMA bb_reference TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA bb_ops TO service_role;
GRANT USAGE ON SCHEMA bb_audit TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA bb_public
  GRANT SELECT ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA bb_reference
  GRANT SELECT ON TABLES TO authenticated, service_role;
