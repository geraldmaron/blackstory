-- A review binds immutable claim/evidence inputs. Corrections require new records and review.
CREATE TRIGGER claim_confidence_assessments_append_only
  BEFORE UPDATE OR DELETE ON bb_canonical.claim_confidence_assessments
  FOR EACH ROW EXECUTE FUNCTION bb_ops.reject_append_only_mutation();
CREATE TRIGGER evidence_selectors_append_only
  BEFORE UPDATE OR DELETE ON bb_evidence.evidence_selectors
  FOR EACH ROW EXECUTE FUNCTION bb_ops.reject_append_only_mutation();

CREATE FUNCTION bb_research.protect_reviewed_artifact_claims()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bb_research.review_decisions r
    WHERE (TG_OP <> 'INSERT' AND r.artifact_id = OLD.artifact_id)
       OR (TG_OP <> 'DELETE' AND r.artifact_id = NEW.artifact_id)
  ) THEN
    RAISE EXCEPTION 'Reviewed artifact claim membership is immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER reviewed_artifact_claims_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON bb_research.artifact_claims
  FOR EACH ROW EXECUTE FUNCTION bb_research.protect_reviewed_artifact_claims();

-- Transaction-start timestamps cannot distinguish evidence added after a review in one transaction.
ALTER TABLE bb_canonical.evidence_assignments ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE bb_canonical.claim_confidence_assessments ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE bb_research.review_decisions ALTER COLUMN decided_at SET DEFAULT clock_timestamp();
