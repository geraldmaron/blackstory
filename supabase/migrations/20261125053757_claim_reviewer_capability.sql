-- Let the claim-review ledger be written without the database-owner login.
--
-- research.submit_artifact and research.approve_artifact admitted a direct connection only after
-- `SET LOCAL ROLE service_role`, which the owner login alone may assume, so every ledger write
-- needed the owner password. The admin login already holds DML on every table the ledger touches,
-- so that step guarded nothing against it. `claim_reviewer` is a marker capability: a direct
-- login that is a member, and has not switched to another role, passes the same gate. PostgREST
-- callers always carry a role (authenticated, anon, service_role) and are unaffected, and a
-- session that drops to research_worker or authenticated is still refused.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'claim_reviewer') THEN
    CREATE ROLE claim_reviewer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'claim_reviewer'
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'claim_reviewer exceeds its capability boundary';
  END IF;
END $$;
GRANT claim_reviewer TO admin_app;
COMMENT ON ROLE claim_reviewer IS 'Marker: a direct login holding it may record claim-review artifacts and decisions. Carries no table privileges.';

DO $$
DECLARE
  routine record;
  definition text;
  old_gate constant text :=
    'CASE WHEN current_setting(''role'', true) = ''service_role'' THEN ''service_role''';
  new_gate constant text :=
    'CASE WHEN current_setting(''role'', true) = ''service_role'' OR (coalesce(nullif(current_setting(''role'', true), ''''), ''none'') = ''none'' AND pg_catalog.pg_has_role(session_user, ''claim_reviewer'', ''member'')) THEN ''service_role''';
BEGIN
  FOR routine IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'research'
      AND p.oid IN (
        'research.submit_artifact(text,text,text,text,text,text,text,text,jsonb,text)'::regprocedure,
        'research.approve_artifact(text,text,text,text,jsonb,text,text,text)'::regprocedure)
  LOOP
    definition := pg_get_functiondef(routine.oid);
    IF position(old_gate IN definition) = 0 THEN
      RAISE EXCEPTION 'gate not found in %', routine.oid::regprocedure;
    END IF;
    EXECUTE replace(definition, old_gate, new_gate);
  END LOOP;
END $$;

COMMIT;
