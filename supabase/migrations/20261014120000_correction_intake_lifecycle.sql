BEGIN;

-- Keep receipt state consistent for every staff writer, including batch triage. The public
-- connection retains UPDATE(payload) only; it cannot choose an intake status directly.
CREATE FUNCTION submissions.synchronize_correction_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD.receipt_digest IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.payload->'appeals' IS DISTINCT FROM OLD.payload->'appeals' THEN
    IF coalesce(OLD.payload->'appeals', '[]'::jsonb) <> '[]'::jsonb
       OR jsonb_typeof(NEW.payload->'appeals') IS DISTINCT FROM 'array'
       OR jsonb_array_length(NEW.payload->'appeals') <> 1
       OR NOT coalesce(
         OLD.payload->>'closureReason' = 'rejected'
         OR (OLD.payload->>'classificationDispute' = 'true'
             AND OLD.payload->>'moderationState' IN ('blocked', 'resolved')), false)
       OR (NEW.payload - ARRAY['appeals','closureReason','updatedAt','moderationState','intakeStatus'])
          IS DISTINCT FROM
          (OLD.payload - ARRAY['appeals','closureReason','updatedAt','moderationState','intakeStatus'])
    THEN
      RAISE EXCEPTION 'Correction appeal is not eligible' USING ERRCODE = '23514';
    END IF;
    NEW.status := 'quarantined';
    NEW.payload := (NEW.payload - 'closureReason') || jsonb_build_object(
      'moderationState', 'pending_review', 'intakeStatus', 'quarantined',
      'updatedAt', statement_timestamp());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.payload := NEW.payload || jsonb_build_object(
      'intakeStatus', NEW.status, 'updatedAt', statement_timestamp());
    IF NEW.status IN ('rejected', 'spam') THEN
      NEW.payload := NEW.payload || jsonb_build_object(
        'moderationState', 'blocked', 'closureReason', 'rejected');
    ELSIF NEW.status IN ('promoted', 'quarantined') THEN
      NEW.payload := (NEW.payload - 'closureReason') || jsonb_build_object(
        'moderationState', 'pending_review');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION submissions.synchronize_correction_intake() FROM PUBLIC;
CREATE TRIGGER synchronize_correction_intake
BEFORE UPDATE OF status, payload ON submissions.intake_items
FOR EACH ROW EXECUTE FUNCTION submissions.synchronize_correction_intake();

COMMIT;
