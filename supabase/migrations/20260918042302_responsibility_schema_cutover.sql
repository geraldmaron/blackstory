-- Atomic namespace/auth cutover. Deploy matching clients and refresh staff JWTs together.
-- Built-in auth/public schemas and applied migration history retain their identities.
CREATE TEMP TABLE schema_cutover_names (old_name text PRIMARY KEY, new_name text NOT NULL);
INSERT INTO schema_cutover_names VALUES
  ('bb_auth', 'access_control'), ('bb_audit', 'audit'), ('bb_canonical', 'canonical'),
  ('bb_evidence', 'evidence'), ('bb_ops', 'ops'), ('bb_public', 'published'),
  ('bb_publication', 'publication'), ('bb_reference', 'reference'),
  ('bb_research', 'research'), ('bb_submissions', 'submissions');

-- PostgreSQL rewrites parsed dependencies by OID, but not SQL/PLpgSQL function source text.
CREATE TEMP TABLE schema_cutover_functions AS
SELECT p.oid, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN (SELECT old_name FROM schema_cutover_names) AND p.prokind IN ('f', 'p');

DO $$
DECLARE mapping record; routine record; definition text;
BEGIN
  FOR mapping IN SELECT * FROM schema_cutover_names LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = mapping.old_name)
      OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = mapping.new_name) THEN
      RAISE EXCEPTION 'Schema cutover precondition failed for % -> %', mapping.old_name, mapping.new_name;
    END IF;
  END LOOP;
  FOR mapping IN SELECT * FROM schema_cutover_names LOOP
    EXECUTE format('ALTER SCHEMA %I RENAME TO %I', mapping.old_name, mapping.new_name);
  END LOOP;
  FOR routine IN SELECT * FROM schema_cutover_functions LOOP
    definition := routine.definition;
    FOR mapping IN SELECT * FROM schema_cutover_names LOOP
      definition := regexp_replace(definition, '\m' || mapping.old_name || '\M', mapping.new_name, 'g');
    END LOOP;
    definition := regexp_replace(definition, '\mbb_role\M', 'app_role', 'g');
    EXECUTE definition;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE raw_app_meta_data ? 'bb_role'
      AND raw_app_meta_data ? 'app_role'
      AND raw_app_meta_data->'bb_role' IS DISTINCT FROM raw_app_meta_data->'app_role'
  ) THEN
    RAISE EXCEPTION 'Conflicting auth role metadata requires reconciliation';
  END IF;
END;
$$;

UPDATE auth.users
SET raw_app_meta_data = (raw_app_meta_data - 'bb_role') ||
    jsonb_build_object('app_role', raw_app_meta_data->'bb_role')
WHERE raw_app_meta_data ? 'bb_role';

COMMENT ON SCHEMA access_control IS 'Auth helpers for trusted JWT app_metadata.app_role';
COMMENT ON FUNCTION access_control.current_role() IS
  'Returns app_metadata.app_role. Never reads user_metadata.';

ALTER ROLE authenticator SET pgrst.db_schemas TO 'public,published,submissions';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
DROP TABLE schema_cutover_functions;
DROP TABLE schema_cutover_names;
