-- Missing JWT staff roles must evaluate as denial, not SQL's unknown truth value.
DO $$
DECLARE routine record; definition text;
BEGIN
  FOR routine IN
    SELECT p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = 'research' AND p.proname IN (
      'claim_frontier_task', 'heartbeat_frontier_task', 'finish_frontier_task',
      'submit_artifact', 'approve_artifact'
    )) OR (n.nspname = 'publication' AND p.proname = 'activate_research_release')
  LOOP
    definition := pg_get_functiondef(routine.oid);
    IF position('v_role text := access_control.current_role();' IN definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected authorization definition for %.%', routine.nspname, routine.proname;
    END IF;
    definition := replace(definition,
      'v_role text := access_control.current_role();',
      'v_role text := coalesce(access_control.current_role(), '''');');
    EXECUTE definition;
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      routine.nspname, routine.proname, routine.arguments);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
      routine.nspname, routine.proname, routine.arguments);
  END LOOP;
END;
$$;
