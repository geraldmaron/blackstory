-- Approval hashes remain immutable; expired private research text does not.
ALTER TABLE research.management_work_proposals ALTER COLUMN proposal DROP NOT NULL;
ALTER TABLE research.management_work_proposals ADD COLUMN payload_disposed_at timestamptz;

CREATE FUNCTION research.management_proposal_retention_current(p_proposal jsonb, p_created timestamptz)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
  SELECT p_proposal IS NOT NULL AND p_created > clock_timestamp()-interval '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(coalesce(p_proposal->'researchRunIds','[]'::jsonb)) requested(id)
      LEFT JOIN research.runs r ON r.id=requested.id
      WHERE r.id IS NULL OR r.execution_plan IS NULL OR r.payload_retention_until IS NULL
        OR r.payload_retention_until<=clock_timestamp()
        OR EXISTS (SELECT 1 FROM research.artifacts a WHERE a.run_id=r.id
          AND (a.payload_disposed_at IS NOT NULL OR a.retention_until<=clock_timestamp()))
    )
$$;
REVOKE ALL ON FUNCTION research.management_proposal_retention_current(jsonb,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION research.management_proposal_retention_current(jsonb,timestamptz)
  TO admin_app,research_worker,service_role;

CREATE FUNCTION research.guard_management_proposal_retention() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.proposal IS NOT NULL AND NEW.proposal IS NULL
    AND NEW.payload_disposed_at IS NOT NULL
    AND (to_jsonb(NEW)-'proposal'-'payload_disposed_at')=(to_jsonb(OLD)-'proposal'-'payload_disposed_at')
    AND NOT research.management_proposal_retention_current(OLD.proposal,OLD.created_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Management proposal content and identity are immutable';
END $$;
REVOKE ALL ON FUNCTION research.guard_management_proposal_retention() FROM PUBLIC;
DROP TRIGGER management_proposals_append_only ON research.management_work_proposals;
CREATE TRIGGER management_proposals_append_only BEFORE UPDATE OR DELETE ON research.management_work_proposals
  FOR EACH ROW EXECUTE FUNCTION research.guard_management_proposal_retention();

CREATE FUNCTION research.dispose_expired_management_proposals(p_commit boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
  SELECT count(*) INTO affected FROM research.management_work_proposals
    WHERE proposal IS NOT NULL AND NOT research.management_proposal_retention_current(proposal,created_at);
  IF p_commit THEN
    -- Serialize with approvals/publication before disposing either copy of a proposal.
    PERFORM w.id FROM research.management_work w
      WHERE EXISTS (SELECT 1 FROM research.management_work_proposals p WHERE p.work_id=w.id
        AND p.proposal IS NOT NULL AND NOT research.management_proposal_retention_current(p.proposal,p.created_at))
      ORDER BY w.id FOR UPDATE;
    UPDATE research.management_work w SET proposal=NULL,approved_entity_ids='{}',
      state=CASE WHEN w.state IN ('published','verification_failed') THEN w.state ELSE 'held' END,
      error='The supporting research expired. Request fresh research before publication.',
      lease_token=NULL,lease_until=NULL,updated_at=now()
      FROM research.management_work_proposals p WHERE p.work_id=w.id AND p.version=w.version
        AND NOT research.management_proposal_retention_current(p.proposal,p.created_at);
    UPDATE research.management_work_proposals SET proposal=NULL,payload_disposed_at=clock_timestamp()
      WHERE proposal IS NOT NULL AND NOT research.management_proposal_retention_current(proposal,created_at);
  END IF;
  RETURN affected;
END $$;
REVOKE ALL ON FUNCTION research.dispose_expired_management_proposals(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION research.dispose_expired_management_proposals(boolean) TO admin_app,service_role;
