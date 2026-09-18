BEGIN;

-- A roleless authenticated identity cannot enter privileged research functions.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","user_metadata":{"app_role":"admin"}}';
DO $$
DECLARE probe record;
BEGIN
  FOR probe IN SELECT * FROM (VALUES
    ('claim_frontier_task', 'SELECT research.claim_frontier_task(''missing-run'', ''roleless'', 30)'),
    ('heartbeat_frontier_task', 'SELECT research.heartbeat_frontier_task(''missing'', ''roleless'', ''token'', 30)'),
    ('finish_frontier_task', 'SELECT research.finish_frontier_task(''missing'', ''roleless'', ''token'', true, NULL)'),
    ('submit_artifact', 'SELECT research.submit_artifact(''a'', ''r'', ''act'', ''proposal'', ''hash'', ''schema'', ''1'', ''uri'', ''{}''::jsonb, ''key'')'),
    ('approve_artifact', 'SELECT research.approve_artifact(''review'', ''artifact'', ''roleless'', NULL, ''{}''::jsonb, ''v1'')'),
    ('activate_research_release', 'SELECT publication.activate_research_release(''release'', ''decision'')')
  ) AS probes(name, statement) LOOP
    BEGIN
      EXECUTE probe.statement;
      RAISE EXCEPTION 'Roleless caller entered %', probe.name;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> probe.name || ' denied' THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;
RESET ROLE;

SET LOCAL request.jwt.claims = '{"role":"service_role"}';

INSERT INTO research.research_profiles (
  id, version, schema_version, checksum, profile, active
) VALUES (
  'black-history', '1.0.0', '1.0.0', repeat('a', 64), '{}'::jsonb, true
);

INSERT INTO research.cases (id, state, candidate_id, title, profile_id, profile_version, risk_class)
VALUES ('case-test', 'candidate', 'candidate-test', 'Research kernel verification', 'black-history', '1.0.0', 'standard');

INSERT INTO research.runs (id,case_id,profile_id,profile_version,policy_version,mode,status,started_at,execution_plan,manifest_hash,max_cost_usd,deadline_at)
VALUES ('frontier-run-test','case-test','black-history','1.0.0','1.0.0','deterministic','pending',now(),'{}',repeat('f',64),0,now()+interval '1 hour');

INSERT INTO research.frontier_tasks (
  id, case_id, run_id, task_type, risk_weight, expected_entropy_reduction,
  source_novelty, contradiction_value, normalized_cost, idempotency_key
) VALUES (
  'task-test', 'case-test', 'frontier-run-test', 'query', 1, 0.2, 0.1, 0.3, 2, 'task-test-v1'
);

INSERT INTO research.agent_activities (id,run_id,actor_id,actor_type,activity_type,started_at)
VALUES ('frontier-activity-test','frontier-run-test','service-worker','service','query',now());
INSERT INTO research.artifacts (id,run_id,activity_id,artifact_type,content_hash,schema_id,schema_version,storage_uri,status,idempotency_key)
VALUES ('frontier-artifact-test','frontier-run-test','frontier-activity-test','task-proposal',repeat('f',64),'ResearchTaskReport','1.0.0','test:query','proposed','frontier-artifact-test');
UPDATE research.frontier_tasks SET result_artifact_id='frontier-artifact-test' WHERE id='task-test';

DO $$
DECLARE
  claimed research.frontier_tasks;
  finished research.frontier_tasks;
BEGIN
  SELECT * INTO STRICT claimed FROM research.claim_frontier_task('frontier-run-test', 'service-worker', 300);
  IF claimed.id <> 'task-test' OR claimed.status <> 'leased' OR claimed.lease_token IS NULL THEN
    RAISE EXCEPTION 'frontier claim did not atomically lease the expected task';
  END IF;
  IF NOT research.heartbeat_frontier_task(
    claimed.id, claimed.leased_to, claimed.lease_token, 300
  ) THEN
    RAISE EXCEPTION 'frontier heartbeat did not renew the lease';
  END IF;
  SELECT * INTO STRICT finished FROM research.finish_frontier_task(
    claimed.id, claimed.leased_to, claimed.lease_token, true, NULL
  );
  IF finished.status <> 'completed' OR finished.lease_token IS NOT NULL THEN
    RAISE EXCEPTION 'frontier completion did not clear the lease';
  END IF;
END;
$$;

INSERT INTO canonical.entities (id, kind, entity_class, display_name)
VALUES ('entity-test', 'person', 'person', 'Verification subject');
INSERT INTO canonical.claims (id, entity_id, claim_class, workflow_status)
VALUES ('claim-test', 'entity-test', 'standard', 'proposed');
INSERT INTO canonical.claim_versions (id, claim_id, predicate, object)
VALUES ('claim-version-test', 'claim-test', 'served_as', '{"value":"role"}'::jsonb);

DO $$
BEGIN
  BEGIN
    UPDATE canonical.claim_versions
    SET predicate = 'located_at'
    WHERE id = 'claim-version-test';
    RAISE EXCEPTION 'append-only claim version unexpectedly allowed mutation';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
  END;
END;
$$;

INSERT INTO research.runs (
  id, case_id, profile_id, profile_version, policy_version, mode, status, started_at
) VALUES (
  'run-test', 'case-test', 'black-history', '1.0.0', '1.0.0',
  'quality-prose', 'running', now()
);
INSERT INTO research.agent_activities (
  id, run_id, actor_id, actor_type, model_family, activity_type, started_at
) VALUES (
  'activity-test', 'run-test', 'producer-test', 'model', 'kimi', 'story-draft', now()
);

SELECT research.submit_artifact(
  'artifact-test', 'run-test', 'activity-test', 'story-draft', repeat('b', 64),
  'StoryResearchPacket', '1.0.0', 'storage://artifact-test', '{}'::jsonb,
  'artifact-test-v1'
);

DO $$
BEGIN
  BEGIN
    PERFORM research.approve_artifact(
      'review-self', 'artifact-test', 'producer-test', 'qwen', '[]'::jsonb, 'review-1'
    );
    RAISE EXCEPTION 'self-approval unexpectedly succeeded';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%self-approval%' THEN RAISE; END IF;
  END;
END;
$$;

SELECT research.approve_artifact(
  'review-test', 'artifact-test', 'reviewer-test', 'qwen', '[]'::jsonb, 'review-1'
);

INSERT INTO publication.releases (id, status, signed_manifest, created_by)
VALUES (
  'release-test', 'preview', '{"manifestHash":"verification"}'::jsonb, 'publisher-test'
);
INSERT INTO publication.release_decisions (
  id, artifact_id, release_id, review_decision_id, decision,
  publisher_actor_id, producer_actor_id, policy_version
) VALUES (
  'release-decision-test', 'artifact-test', 'release-test', 'review-test', 'activate',
  'publisher-test', 'producer-test', '1.0.0'
);

SELECT publication.activate_research_release('release-test', 'release-decision-test');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM published.active_release
    WHERE id = 'active' AND release_id = 'release-test'
  ) THEN
    RAISE EXCEPTION 'independently approved release was not activated';
  END IF;
END;
$$;

SET LOCAL request.jwt.claims = '{"role":"authenticated","app_metadata":{"app_role":"research"}}';

DO $$
BEGIN
  BEGIN
    PERFORM publication.activate_research_release('release-test', 'release-decision-test');
    RAISE EXCEPTION 'research role unexpectedly activated a release';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%denied%' THEN RAISE; END IF;
  END;
END;
$$;

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO research.research_questions (id, case_id, question, status)
    VALUES ('question-direct-write', 'case-test', 'Should direct writes be possible?', 'open');
    RAISE EXCEPTION 'authenticated research unexpectedly bypassed the scoped RPC boundary';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

RESET ROLE;

ROLLBACK;

-- The native worker role can write proposals, but cannot review or publish them.
BEGIN;
SET LOCAL ROLE research_worker;
DO $$ BEGIN
  IF has_table_privilege(current_user,'research.review_decisions','INSERT') THEN
    RAISE EXCEPTION 'worker must not write review decisions';
  END IF;
  IF has_table_privilege(current_user,(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='published' AND c.relname='release_entities'),'INSERT') THEN
    RAISE EXCEPTION 'worker must not write public projections';
  END IF;
  BEGIN
    PERFORM research.approve_artifact('denied-review','nonexistent','worker',NULL,'{}'::jsonb,'none');
    RAISE EXCEPTION 'worker approval should be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
