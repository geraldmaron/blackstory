BEGIN;
-- A login provisioned outside this migration can inherit this research-only capability set.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='research_worker') THEN
    CREATE ROLE research_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='research_worker'
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Existing research_worker role exceeds the research capability boundary';
  END IF;
  -- Inherited or SET ROLE access can bypass an otherwise narrow direct grant set.
  IF EXISTS (SELECT 1 FROM pg_auth_members
    WHERE member=(SELECT oid FROM pg_roles WHERE rolname='research_worker')) THEN
    RAISE EXCEPTION 'research_worker must not be a member of another role';
  END IF;
END $$;
GRANT research_worker TO postgres;
GRANT USAGE ON SCHEMA research,evidence,extensions TO research_worker;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'research_profiles','cases','research_questions','evidence_needs','runs','frontier_tasks',
    'frontier_task_dependencies','agent_activities','artifacts','artifact_dependencies',
    'model_invocations','model_output_quarantine','preservation_jobs'
  ] LOOP
    EXECUTE format('GRANT SELECT,INSERT ON research.%I TO research_worker',table_name);
    EXECUTE format('CREATE POLICY research_worker_access ON research.%I TO research_worker USING (true) WITH CHECK (true)',table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY[
    'evidence_sources','source_items','source_captures','retrieval_events','capture_origins','retrieval_passages'
  ] LOOP
    EXECUTE format('GRANT SELECT,INSERT ON evidence.%I TO research_worker',table_name);
    EXECUTE format('CREATE POLICY research_worker_access ON evidence.%I TO research_worker USING (true) WITH CHECK (true)',table_name);
  END LOOP;
END $$;
GRANT UPDATE(status,heartbeat_at,reserved_cost_usd,completed_at,terminal_reason) ON research.runs TO research_worker;
GRANT UPDATE(status,last_error,result_artifact_id) ON research.frontier_tasks TO research_worker;
GRANT UPDATE(ended_at,actor_type,model_family) ON research.agent_activities TO research_worker;
GRANT UPDATE(state,job_id,result,updated_at) ON research.preservation_jobs TO research_worker;
GRANT UPDATE(storage_object,observed_at,final_url) ON evidence.capture_origins TO research_worker;
GRANT UPDATE(embedding,embedding_model,embedding_text_hash,withdrawn_at,retention_decision,retention_expires_at) ON evidence.retrieval_passages TO research_worker;
DO $$
DECLARE routine record; definition text;
BEGIN
  FOR routine IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='research' AND p.proname IN ('claim_frontier_task','heartbeat_frontier_task','finish_frontier_task')
  LOOP
    definition:=pg_get_functiondef(routine.oid);
    definition:=replace(definition,
      'coalesce(current_setting(''role'', true), '''') = ''service_role''',
      'coalesce(current_setting(''role'', true), '''') IN (''service_role'',''research_worker'')');
    definition:=replace(definition,
      'current_setting(''role'', true) = ''service_role''',
      'current_setting(''role'', true) IN (''service_role'',''research_worker'')');
    EXECUTE definition;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION research.claim_frontier_task(text,text,integer),
  research.heartbeat_frontier_task(text,text,text,integer),
  research.finish_frontier_task(text,text,text,boolean,text) TO research_worker;
COMMENT ON ROLE research_worker IS 'Private research proposals and acquisition only. No approval, canonical decision, or publication privileges.';
COMMIT;
