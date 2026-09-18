-- Durable execution extends the canonical research ledger; no separate job store or scheduler.
ALTER TABLE research.runs
  ADD COLUMN execution_plan jsonb,
  ADD COLUMN manifest_hash text,
  ADD COLUMN max_cost_usd numeric CHECK (max_cost_usd >= 0),
  ADD COLUMN reserved_cost_usd numeric NOT NULL DEFAULT 0 CHECK (reserved_cost_usd >= 0),
  ADD COLUMN deadline_at timestamptz,
  ADD CONSTRAINT execution_budget CHECK (max_cost_usd IS NULL OR reserved_cost_usd <= max_cost_usd),
  ADD CONSTRAINT execution_manifest_complete CHECK (execution_plan IS NULL OR (manifest_hash IS NOT NULL AND max_cost_usd IS NOT NULL AND deadline_at IS NOT NULL));

-- Unassigned work requires explicit reconciliation; never guess a run or discard pending tasks.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM research.frontier_tasks) THEN
    RAISE EXCEPTION 'Assign existing frontier tasks to research runs before applying the execution contract';
  END IF;
END $$;

ALTER TABLE research.frontier_tasks
  ADD COLUMN run_id text NOT NULL REFERENCES research.runs(id),
  ADD COLUMN input jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN output_contract text NOT NULL DEFAULT 'ResearchTaskReport',
  ADD COLUMN max_cost_usd_per_attempt numeric NOT NULL DEFAULT 0 CHECK (max_cost_usd_per_attempt >= 0),
  ADD COLUMN result_artifact_id text REFERENCES research.artifacts(id),
  ADD CONSTRAINT frontier_run_identity UNIQUE (id, run_id);

CREATE INDEX frontier_run_status_idx ON research.frontier_tasks(run_id, status, available_at);
CREATE TABLE research.frontier_task_dependencies (
  task_id text NOT NULL,
  run_id text NOT NULL,
  depends_on_task_id text NOT NULL,
  PRIMARY KEY (task_id, depends_on_task_id),
  FOREIGN KEY (task_id, run_id) REFERENCES research.frontier_tasks(id, run_id),
  FOREIGN KEY (depends_on_task_id, run_id) REFERENCES research.frontier_tasks(id, run_id),
  CHECK (task_id <> depends_on_task_id)
);
CREATE INDEX frontier_dependency_target_idx ON research.frontier_task_dependencies(depends_on_task_id);
ALTER TABLE research.frontier_task_dependencies ENABLE ROW LEVEL SECURITY;
GRANT ALL ON research.frontier_task_dependencies TO service_role;
GRANT SELECT ON research.frontier_task_dependencies TO authenticated;
CREATE POLICY frontier_dependencies_staff_select ON research.frontier_task_dependencies
  FOR SELECT TO authenticated USING ((SELECT access_control.is_staff()));

-- Native workers authenticate with a database role; HTTP callers use verified JWT metadata.
DO $$
DECLARE routine record; definition text;
BEGIN
  FOR routine IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = 'research' AND p.proname IN (
      'heartbeat_frontier_task', 'finish_frontier_task', 'submit_artifact', 'approve_artifact'
    )) OR (n.nspname = 'publication' AND p.proname = 'activate_research_release')
  LOOP
    definition := pg_get_functiondef(routine.oid);
    definition := replace(definition,
      'v_jwt_role text := coalesce(auth.jwt() ->> ''role'', '''');',
      'v_jwt_role text := CASE WHEN current_setting(''role'', true) = ''service_role'' THEN ''service_role'' ELSE coalesce(auth.jwt() ->> ''role'', '''') END;');
    IF position('heartbeat_frontier_task' IN definition) > 0 THEN
      definition := replace(definition,
        'leased_until = now() + make_interval(secs => p_extend_seconds),',
        'leased_until = least((SELECT deadline_at FROM research.runs WHERE id = frontier_tasks.run_id), clock_timestamp() + make_interval(secs => p_extend_seconds)),');
    END IF;
    IF position('heartbeat_frontier_task' IN definition)>0 OR position('finish_frontier_task' IN definition)>0 THEN
      definition := replace(definition,'leased_until >= now()',
        'leased_until >= clock_timestamp() AND EXISTS (SELECT 1 FROM research.runs run WHERE run.id=run_id AND run.status IN (''pending'',''running'') AND run.deadline_at>clock_timestamp())');
    END IF;
    EXECUTE definition;
  END LOOP;
END $$;

DROP FUNCTION research.claim_frontier_task(text, integer);
CREATE FUNCTION research.claim_frontier_task(
  p_run_id text, p_worker_actor_id text, p_lease_seconds integer DEFAULT 300
)
RETURNS SETOF research.frontier_tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_run research.runs;
  v_task research.frontier_tasks;
  v_role text := coalesce(access_control.current_role(), '');
  v_service boolean := coalesce(current_setting('role', true), '') = 'service_role'
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role';
BEGIN
  IF NOT v_service AND v_role NOT IN ('admin', 'research') THEN
    RAISE EXCEPTION 'claim_frontier_task denied';
  END IF;
  IF p_worker_actor_id IS NULL OR length(trim(p_worker_actor_id)) = 0 THEN
    RAISE EXCEPTION 'worker actor is required';
  END IF;
  IF auth.uid() IS NOT NULL AND p_worker_actor_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'worker actor must match authenticated user';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'lease seconds must be between 30 and 3600';
  END IF;
  SELECT * INTO v_run FROM research.runs WHERE id = p_run_id FOR UPDATE;
  IF v_run.id IS NULL OR v_run.execution_plan IS NULL THEN RAISE EXCEPTION 'Unknown execution run'; END IF;
  IF v_run.status NOT IN ('pending', 'running') OR v_run.deadline_at <= clock_timestamp() THEN RETURN; END IF;

  UPDATE research.frontier_tasks SET status = 'dead_letter', leased_to = NULL,
    lease_token = NULL, leased_until = NULL, last_error = 'Lease expired with no remaining attempts'
  WHERE run_id = p_run_id AND status = 'leased' AND leased_until < clock_timestamp()
    AND attempt_count >= max_attempts;

  SELECT task.* INTO v_task FROM research.frontier_tasks task
  WHERE task.run_id = p_run_id AND task.available_at <= clock_timestamp()
    AND task.attempt_count < task.max_attempts
    AND (task.status IN ('pending', 'failed') OR (task.status = 'leased' AND task.leased_until < clock_timestamp()))
    AND v_run.reserved_cost_usd + task.max_cost_usd_per_attempt <= v_run.max_cost_usd
    AND NOT EXISTS (
      SELECT 1 FROM research.frontier_task_dependencies dependency
      JOIN research.frontier_tasks parent ON parent.id = dependency.depends_on_task_id
      WHERE dependency.task_id = task.id AND parent.status <> 'completed'
    )
  ORDER BY task.priority DESC, task.score DESC, task.id
  LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF v_task.id IS NULL THEN RETURN; END IF;

  -- Charge the worst-case reservation before the external call. Uncertain attempts retain it.
  UPDATE research.runs SET status = 'running', heartbeat_at = clock_timestamp(),
    reserved_cost_usd = reserved_cost_usd + v_task.max_cost_usd_per_attempt
  WHERE id = p_run_id;
  RETURN QUERY UPDATE research.frontier_tasks task SET status = 'leased',
    leased_to = p_worker_actor_id, lease_token = extensions.gen_random_uuid()::text,
    leased_until = least(v_run.deadline_at, clock_timestamp() + make_interval(secs => p_lease_seconds)),
    heartbeat_at = clock_timestamp(), attempt_count = task.attempt_count + 1, updated_at = clock_timestamp()
  WHERE task.id = v_task.id RETURNING task.*;
END $$;
REVOKE ALL ON FUNCTION research.claim_frontier_task(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION research.claim_frontier_task(text, text, integer) TO authenticated, service_role;
ALTER TABLE research.agent_activities
  ADD COLUMN frontier_task_id text REFERENCES research.frontier_tasks(id),
  ADD COLUMN frontier_attempt integer CHECK (frontier_attempt > 0),
  ADD CONSTRAINT activity_frontier_attempt UNIQUE (frontier_task_id, frontier_attempt);
ALTER TABLE research.artifacts ADD CONSTRAINT artifact_run_identity UNIQUE (id, run_id);
ALTER TABLE research.frontier_tasks
  ADD CONSTRAINT frontier_result_same_run FOREIGN KEY (result_artifact_id, run_id) REFERENCES research.artifacts(id, run_id),
  ADD CONSTRAINT frontier_completed_artifact CHECK (status <> 'completed' OR result_artifact_id IS NOT NULL);
