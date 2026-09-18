-- Production's first eight history rows were recorded after their SQL had been
-- applied manually, so their versions sort before their extension/schema/auth
-- prerequisites. This bootstrap exists only to make a clean migration replay
-- executable. Existing old-namespace and post-cutover databases are strict no-ops.

DO $bootstrap$
DECLARE
  old_schemas text[] := ARRAY[
    'bb_auth', 'bb_audit', 'bb_canonical', 'bb_evidence', 'bb_ops',
    'bb_public', 'bb_publication', 'bb_reference', 'bb_research', 'bb_submissions'
  ];
  current_schemas text[] := ARRAY[
    'access_control', 'audit', 'canonical', 'evidence', 'ops',
    'published', 'publication', 'reference', 'research', 'submissions'
  ];
  old_count integer;
  current_count integer;
BEGIN
  SELECT count(*) INTO old_count
  FROM pg_namespace
  WHERE nspname = ANY (old_schemas);

  SELECT count(*) INTO current_count
  FROM pg_namespace
  WHERE nspname = ANY (current_schemas);

  IF (old_count = cardinality(old_schemas) AND current_count = 0)
     OR (current_count = cardinality(current_schemas) AND old_count = 0) THEN
    -- Known existing install. Do not recreate helpers or reset grants/default privileges.
    RETURN;
  END IF;

  IF old_count <> 0 OR current_count <> 0 THEN
    RAISE EXCEPTION
      'Fresh bootstrap refuses partial or mixed responsibility schemas (old %, current %)',
      old_count,
      current_count;
  END IF;

  EXECUTE 'CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions';
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions';
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions';
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions';
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions';

  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_auth';
  EXECUTE $sql$COMMENT ON SCHEMA bb_auth IS 'Auth helpers for Supabase JWT app_metadata.bb_role'$sql$;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_public';
  EXECUTE $sql$COMMENT ON SCHEMA bb_public IS 'Released public projections and active release pointer'$sql$;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_submissions';
  EXECUTE $sql$COMMENT ON SCHEMA bb_submissions IS 'Quarantined intake only'$sql$;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_research';
  EXECUTE $sql$COMMENT ON SCHEMA bb_research IS 'Research cases; cannot publish'$sql$;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_evidence';
  EXECUTE $sql$COMMENT ON SCHEMA bb_evidence IS 'Evidence metadata and source provenance'$sql$;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_canonical';
  EXECUTE $sql$COMMENT ON SCHEMA bb_canonical IS 'Canonical entities, claims, relationships'$sql$;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_publication';
  EXECUTE $sql$COMMENT ON SCHEMA bb_publication IS 'Release records and activation RPCs'$sql$;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_reference';
  EXECUTE $sql$COMMENT ON SCHEMA bb_reference IS 'Jurisdictions and published statistics'$sql$;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_ops';
  EXECUTE $sql$COMMENT ON SCHEMA bb_ops IS 'Policy, kill switches, outbox, catalog ops'$sql$;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS bb_audit';
  EXECUTE $sql$COMMENT ON SCHEMA bb_audit IS 'Append-only audit trail'$sql$;

  EXECUTE 'GRANT USAGE ON SCHEMA bb_auth TO anon, authenticated, service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA bb_public TO anon, authenticated, service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA bb_submissions TO authenticated, service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA bb_research TO authenticated, service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA bb_evidence TO authenticated, service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA bb_canonical TO service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA bb_publication TO authenticated, service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA bb_reference TO anon, authenticated, service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA bb_ops TO service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA bb_audit TO authenticated, service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA bb_public GRANT SELECT ON TABLES TO anon, authenticated, service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA bb_reference GRANT SELECT ON TABLES TO authenticated, service_role';

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION bb_auth.current_role()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $function$
      SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'bb_role', '');
    $function$
  $sql$;
  EXECUTE $sql$COMMENT ON FUNCTION bb_auth.current_role() IS 'Returns app_metadata.bb_role. Never reads user_metadata.'$sql$;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION bb_auth.has_role(expected text)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $function$
      SELECT bb_auth.current_role() IS NOT DISTINCT FROM expected;
    $function$
  $sql$;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION bb_auth.has_any_role(VARIADIC expected text[])
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $function$
      SELECT bb_auth.current_role() = ANY (expected);
    $function$
  $sql$;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION bb_auth.is_staff()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $function$
      SELECT bb_auth.has_any_role('admin', 'research', 'publication', 'security');
    $function$
  $sql$;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION bb_auth.can_publish()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $function$
      SELECT bb_auth.has_any_role('admin', 'publication');
    $function$
  $sql$;

  EXECUTE 'GRANT EXECUTE ON FUNCTION bb_auth.current_role() TO anon, authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION bb_auth.has_role(text) TO anon, authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION bb_auth.has_any_role(text[]) TO anon, authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION bb_auth.is_staff() TO anon, authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION bb_auth.can_publish() TO anon, authenticated, service_role';
END;
$bootstrap$;
