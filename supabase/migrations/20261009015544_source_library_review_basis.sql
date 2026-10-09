-- Qualitative assignments must explain fitness and exact support; legacy numbers remain history.
ALTER TABLE canonical.evidence_assignments
  ALTER COLUMN entailment_probability DROP NOT NULL,
  ALTER COLUMN entailment_calibration_version DROP NOT NULL,
  ADD COLUMN assessment_basis text NOT NULL DEFAULT 'legacy_heuristic'
    CHECK (assessment_basis IN ('legacy_heuristic','qualitative_review')),
  ADD COLUMN fitness_reason text,
  ADD COLUMN support_reason text,
  ADD CONSTRAINT qualitative_assignment_reasons CHECK
    (assessment_basis<>'qualitative_review' OR
      (nullif(btrim(fitness_reason),'') IS NOT NULL AND nullif(btrim(support_reason),'') IS NOT NULL));
COMMENT ON COLUMN canonical.evidence_assignments.entailment_probability IS
  'Optional legacy or measured assessment; qualitative review never requires an invented probability.';
ALTER TABLE evidence.lineage_clusters ALTER COLUMN confidence DROP NOT NULL;
-- Model family is provenance, not evidence that a reviewer worked independently.
ALTER TABLE research.review_decisions
  ADD COLUMN review_mode text NOT NULL DEFAULT 'legacy_unverified'
    CHECK (review_mode IN ('legacy_unverified','self_review','independent_review')),
  ADD COLUMN independence_basis text,
  ADD CONSTRAINT review_independence_basis CHECK
    (review_mode<>'independent_review' OR nullif(btrim(independence_basis),'') IS NOT NULL);
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='research.review_decisions'::regclass
    AND contype='c' AND pg_get_constraintdef(oid) LIKE '%reviewer_model_family%' LOOP
    EXECUTE format('ALTER TABLE research.review_decisions DROP CONSTRAINT %I',c.conname);
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION research.approve_artifact(
  p_review_id text,
  p_artifact_id text,
  p_reviewer_actor_id text,
  p_reviewer_model_family text,
  p_findings jsonb,
  p_benchmark_version text,
  p_review_mode text,
  p_independence_basis text
)
RETURNS research.review_decisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_review research.review_decisions;
  v_producer_actor_id text;
  v_producer_model_family text;
  v_role text := coalesce(access_control.current_role(), '');
  v_jwt_role text := CASE WHEN current_setting('role', true) = 'service_role' THEN 'service_role' ELSE coalesce(auth.jwt() ->> 'role', '') END;
BEGIN
  IF v_jwt_role <> 'service_role' AND v_role NOT IN ('admin', 'publication', 'security') THEN
    RAISE EXCEPTION 'approve_artifact denied';
  END IF;
  IF auth.uid() IS NOT NULL AND p_reviewer_actor_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'reviewer actor must match authenticated user';
  END IF;

  SELECT activity.actor_id, activity.model_family
  INTO STRICT v_producer_actor_id, v_producer_model_family
  FROM research.artifacts AS artifact
  JOIN research.agent_activities AS activity ON activity.id = artifact.activity_id
  WHERE artifact.id = p_artifact_id;

  IF p_reviewer_actor_id = v_producer_actor_id THEN
    RAISE EXCEPTION 'self-approval is prohibited';
  END IF;
  IF p_review_mode NOT IN ('independent_review','self_review','legacy_unverified')
     OR p_review_mode IS NULL THEN RAISE EXCEPTION 'Invalid review mode'; END IF;
  IF p_review_mode='independent_review' AND nullif(btrim(p_independence_basis),'') IS NULL THEN
    RAISE EXCEPTION 'Independent review requires an independence basis';
  END IF;

  INSERT INTO research.review_decisions (
    id, artifact_id, decision, reviewer_actor_id, reviewer_model_family,
    producer_actor_id, producer_model_family, findings, benchmark_version, review_mode, independence_basis
  ) VALUES (
    p_review_id, p_artifact_id, 'approve', p_reviewer_actor_id,
    p_reviewer_model_family, v_producer_actor_id, v_producer_model_family,
    coalesce(p_findings, '[]'::jsonb), p_benchmark_version, p_review_mode, p_independence_basis
  ) RETURNING * INTO v_review;

  UPDATE research.artifacts SET status = 'accepted' WHERE id = p_artifact_id;

  INSERT INTO ops.outbox_messages (
    id, event_id, topic, aggregate_type, aggregate_id, payload, status,
    correlation_id, idempotency_key
  ) VALUES (
    extensions.gen_random_uuid()::text,
    extensions.gen_random_uuid()::text,
    'research.artifact_approved',
    'artifact',
    p_artifact_id,
    jsonb_build_object('artifactId', p_artifact_id, 'reviewId', p_review_id),
    'pending',
    p_artifact_id,
    'artifact-approved:' || p_review_id
  );

  RETURN v_review;
END;
$$;
-- Preserve old callers as explicitly unverified review, without inventing independence.
CREATE OR REPLACE FUNCTION research.approve_artifact(
  p_review_id text,p_artifact_id text,p_reviewer_actor_id text,p_reviewer_model_family text,
  p_findings jsonb,p_benchmark_version text
) RETURNS research.review_decisions LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT research.approve_artifact(p_review_id,p_artifact_id,p_reviewer_actor_id,
    p_reviewer_model_family,p_findings,p_benchmark_version,'legacy_unverified',NULL);
$$;
REVOKE ALL ON FUNCTION research.approve_artifact(text,text,text,text,jsonb,text,text,text) FROM PUBLIC,anon,research_worker;
GRANT EXECUTE ON FUNCTION research.approve_artifact(text,text,text,text,jsonb,text,text,text) TO authenticated,service_role;

-- Keep database activation aligned with the canonical review loader.
CREATE OR REPLACE FUNCTION publication.activate_research_release(p_release_id text,p_release_decision_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_role text := coalesce(access_control.current_role(), '');
  v_jwt_role text := CASE WHEN current_setting('role', true) = 'service_role' THEN 'service_role' ELSE coalesce(auth.jwt() ->> 'role', '') END;
BEGIN
  IF v_jwt_role <> 'service_role' AND v_role NOT IN ('admin','publication') THEN
    RAISE EXCEPTION 'activate_research_release denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM publication.release_decisions d
    JOIN research.review_decisions r ON r.id=d.review_decision_id
    JOIN research.artifacts a ON a.id=d.artifact_id AND r.artifact_id=a.id
    WHERE d.id=p_release_decision_id AND d.release_id=p_release_id AND d.decision='activate'
      AND r.decision='approve' AND a.status='accepted'
      AND d.publisher_actor_id<>d.producer_actor_id AND r.reviewer_actor_id<>r.producer_actor_id
      AND r.review_mode='independent_review' AND nullif(btrim(r.independence_basis),'') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM research.review_decisions newer
        WHERE newer.artifact_id=a.id AND (newer.decided_at,newer.id)>(r.decided_at,r.id))
  ) THEN RAISE EXCEPTION 'release lacks a current independent accepted approval lineage'; END IF;
  PERFORM publication.activate_release(p_release_id);
END $$;

-- These are evidence revisions. New interpretations use new selector/lineage rows.
CREATE TRIGGER lineage_clusters_append_only BEFORE UPDATE OR DELETE ON evidence.lineage_clusters
 FOR EACH ROW EXECUTE FUNCTION ops.reject_append_only_mutation();
CREATE TRIGGER lineage_members_append_only BEFORE UPDATE OR DELETE ON evidence.lineage_cluster_members
 FOR EACH ROW EXECUTE FUNCTION ops.reject_append_only_mutation();

ALTER TABLE evidence.lineage_cluster_members ALTER COLUMN detected_at SET DEFAULT clock_timestamp();
