BEGIN;

SET LOCAL request.jwt.claims = '{"role":"service_role"}';

INSERT INTO bb_research.research_profiles (
  id, version, schema_version, checksum, profile, active
) VALUES (
  'black-history', '1.0.0', '1.0.0', repeat('a', 64), '{}'::jsonb, true
);

INSERT INTO bb_research.cases (id, state, candidate_id, title, profile_id, profile_version, risk_class)
VALUES ('case-test', 'candidate', 'candidate-test', 'Research kernel verification', 'black-history', '1.0.0', 'standard');

INSERT INTO bb_research.frontier_tasks (
  id, case_id, task_type, risk_weight, expected_entropy_reduction,
  source_novelty, contradiction_value, normalized_cost, idempotency_key
) VALUES (
  'task-test', 'case-test', 'query', 1, 0.2, 0.1, 0.3, 2, 'task-test-v1'
);

DO $$
DECLARE
  claimed bb_research.frontier_tasks;
  finished bb_research.frontier_tasks;
BEGIN
  SELECT * INTO STRICT claimed FROM bb_research.claim_frontier_task('service-worker', 300);
  IF claimed.id <> 'task-test' OR claimed.status <> 'leased' OR claimed.lease_token IS NULL THEN
    RAISE EXCEPTION 'frontier claim did not atomically lease the expected task';
  END IF;
  IF NOT bb_research.heartbeat_frontier_task(
    claimed.id, claimed.leased_to, claimed.lease_token, 300
  ) THEN
    RAISE EXCEPTION 'frontier heartbeat did not renew the lease';
  END IF;
  SELECT * INTO STRICT finished FROM bb_research.finish_frontier_task(
    claimed.id, claimed.leased_to, claimed.lease_token, true, NULL
  );
  IF finished.status <> 'completed' OR finished.lease_token IS NOT NULL THEN
    RAISE EXCEPTION 'frontier completion did not clear the lease';
  END IF;
END;
$$;

INSERT INTO bb_canonical.entities (id, kind, entity_class, display_name)
VALUES ('entity-test', 'person', 'person', 'Verification subject');
INSERT INTO bb_canonical.claims (id, entity_id, claim_class, workflow_status)
VALUES ('claim-test', 'entity-test', 'standard', 'proposed');
INSERT INTO bb_canonical.claim_versions (id, claim_id, predicate, object)
VALUES ('claim-version-test', 'claim-test', 'served_as', '{"value":"role"}'::jsonb);

DO $$
BEGIN
  BEGIN
    UPDATE bb_canonical.claim_versions
    SET predicate = 'located_at'
    WHERE id = 'claim-version-test';
    RAISE EXCEPTION 'append-only claim version unexpectedly allowed mutation';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
  END;
END;
$$;

INSERT INTO bb_research.runs (
  id, case_id, profile_id, profile_version, policy_version, mode, status, started_at
) VALUES (
  'run-test', 'case-test', 'black-history', '1.0.0', '1.0.0',
  'quality-prose', 'running', now()
);
INSERT INTO bb_research.agent_activities (
  id, run_id, actor_id, actor_type, model_family, activity_type, started_at
) VALUES (
  'activity-test', 'run-test', 'producer-test', 'model', 'kimi', 'story-draft', now()
);

SELECT bb_research.submit_artifact(
  'artifact-test', 'run-test', 'activity-test', 'story-draft', repeat('b', 64),
  'StoryResearchPacket', '1.0.0', 'storage://artifact-test', '{}'::jsonb,
  'artifact-test-v1'
);

DO $$
BEGIN
  BEGIN
    PERFORM bb_research.approve_artifact(
      'review-self', 'artifact-test', 'producer-test', 'qwen', '[]'::jsonb, 'review-1'
    );
    RAISE EXCEPTION 'self-approval unexpectedly succeeded';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%self-approval%' THEN RAISE; END IF;
  END;
END;
$$;

SELECT bb_research.approve_artifact(
  'review-test', 'artifact-test', 'reviewer-test', 'qwen', '[]'::jsonb, 'review-1'
);

INSERT INTO bb_publication.releases (id, status, signed_manifest, created_by)
VALUES (
  'release-test', 'preview', '{"manifestHash":"verification"}'::jsonb, 'publisher-test'
);
INSERT INTO bb_publication.release_decisions (
  id, artifact_id, release_id, review_decision_id, decision,
  publisher_actor_id, producer_actor_id, policy_version
) VALUES (
  'release-decision-test', 'artifact-test', 'release-test', 'review-test', 'activate',
  'publisher-test', 'producer-test', '1.0.0'
);

SELECT bb_publication.activate_research_release('release-test', 'release-decision-test');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bb_public.active_release
    WHERE id = 'active' AND release_id = 'release-test'
  ) THEN
    RAISE EXCEPTION 'independently approved release was not activated';
  END IF;
END;
$$;

SET LOCAL request.jwt.claims = '{"role":"authenticated","app_metadata":{"bb_role":"research"}}';

DO $$
BEGIN
  BEGIN
    PERFORM bb_publication.activate_research_release('release-test', 'release-decision-test');
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
    INSERT INTO bb_research.research_questions (id, case_id, question, status)
    VALUES ('question-direct-write', 'case-test', 'Should direct writes be possible?', 'open');
    RAISE EXCEPTION 'authenticated research unexpectedly bypassed the scoped RPC boundary';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

RESET ROLE;

ROLLBACK;
