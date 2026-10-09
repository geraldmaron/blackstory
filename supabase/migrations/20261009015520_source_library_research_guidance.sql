-- Collection guidance belongs to immutable policy revisions, not repeated source rows.
ALTER TABLE evidence.source_policies ADD COLUMN collection_guidance jsonb;
ALTER TABLE evidence.source_policies ADD COLUMN sealed_at timestamptz;
ALTER TABLE evidence.source_items
  ADD COLUMN source_policy_id text,
  ADD COLUMN source_policy_version text,
  ADD CONSTRAINT source_items_policy_pair CHECK ((source_policy_id IS NULL) = (source_policy_version IS NULL)),
  ADD CONSTRAINT source_items_policy_fk FOREIGN KEY (source_policy_id,source_policy_version)
    REFERENCES evidence.source_policies(id,version);
CREATE INDEX source_items_policy_idx ON evidence.source_items(source_policy_id,source_policy_version)
  WHERE source_policy_id IS NOT NULL;

ALTER TABLE evidence.source_policy_claim_fitness
  ALTER COLUMN beta_prior_alpha DROP NOT NULL,
  ALTER COLUMN beta_prior_beta DROP NOT NULL,
  ALTER COLUMN calibration_version DROP NOT NULL,
  ADD CONSTRAINT fitness_legacy_prior_pair CHECK ((beta_prior_alpha IS NULL) = (beta_prior_beta IS NULL));
COMMENT ON COLUMN evidence.source_policy_claim_fitness.beta_prior_alpha IS
  'Optional historical scheduling heuristic; not a measured probability or publication authority.';
COMMENT ON COLUMN evidence.evidence_sources.research_guidance IS
  'Legacy item guidance retained for audit. Live consumers use versioned source_policies.collection_guidance.';

CREATE FUNCTION evidence.valid_collection_guidance(g jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; v jsonb;
BEGIN
  IF g IS NULL OR jsonb_typeof(g)<>'object' OR g->>'schemaVersion' IS DISTINCT FROM '1.0.0'
    OR coalesce(g->>'reviewStatus','') NOT IN ('unreviewed','reviewed','needs_recheck') THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(g) key WHERE key NOT IN (
    'schemaVersion','subjects','geography','periods','documentTypes','searchMethods',
    'suitableEvidenceNeeds','limitations','provenance','accessConditions','preservationConditions',
    'reviewStatus','reviewedAt','reviewedBy')) THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['subjects','geography','periods','documentTypes','searchMethods','suitableEvidenceNeeds','limitations','provenance'] LOOP
    IF jsonb_typeof(g->k) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    IF jsonb_array_length(g->k)>(CASE WHEN k='provenance' THEN 20 ELSE 30 END) THEN RETURN false; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(g->k))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(g->k)) THEN RETURN false; END IF;
    FOR v IN SELECT value FROM jsonb_array_elements(g->k) LOOP
      IF jsonb_typeof(v)<>'string' OR length(v#>>'{}') NOT BETWEEN 1 AND 2000 THEN RETURN false; END IF;
      IF k='provenance' AND ((v#>>'{}') !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:[^[:space:]]*$'
        OR (v#>>'{}') ~ '%($|[^0-9A-Fa-f]|[0-9A-Fa-f]($|[^0-9A-Fa-f]))') THEN RETURN false; END IF;
    END LOOP;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['accessConditions','preservationConditions'] LOOP
    IF jsonb_typeof(g->k) IS DISTINCT FROM 'string' OR length(g->>k) NOT BETWEEN 1 AND 2000 THEN RETURN false; END IF;
  END LOOP;
  IF NOT(g ? 'reviewedAt' AND g ? 'reviewedBy') OR jsonb_typeof(g->'reviewedAt') NOT IN ('null','string') OR jsonb_typeof(g->'reviewedBy') NOT IN ('null','string') THEN RETURN false; END IF;
  IF jsonb_typeof(g->'reviewedAt')='string' THEN
    IF (g->>'reviewedAt') !~ '^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$' THEN RETURN false; END IF;
    BEGIN
      PERFORM (g->>'reviewedAt')::timestamptz;
    EXCEPTION WHEN OTHERS THEN RETURN false;
    END;
  END IF;
  IF jsonb_typeof(g->'reviewedBy')='string' AND length(g->>'reviewedBy')=0 THEN RETURN false; END IF;
  IF g->>'reviewStatus'='reviewed' AND (jsonb_array_length(g->'provenance')=0 OR jsonb_typeof(g->'reviewedAt')<>'string' OR jsonb_typeof(g->'reviewedBy')<>'string') THEN RETURN false; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION evidence.valid_collection_guidance(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION evidence.valid_collection_guidance(jsonb) TO admin_app,service_role,research_worker,authenticated;
ALTER TABLE evidence.source_policies ADD CONSTRAINT collection_guidance_valid
  CHECK (collection_guidance IS NULL OR evidence.valid_collection_guidance(collection_guidance));

CREATE FUNCTION evidence.preserve_collection_policy_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.collection_guidance IS NOT NULL AND OLD.sealed_at IS NULL
    AND NEW.sealed_at IS NOT NULL AND (to_jsonb(NEW)-'sealed_at')=(to_jsonb(OLD)-'sealed_at') THEN
    RETURN NEW;
  END IF;
  IF OLD.collection_guidance IS NOT NULL AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Collection policy revisions are immutable; insert a new version';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION evidence.preserve_collection_policy_revision() FROM PUBLIC;
CREATE TRIGGER preserve_collection_policy_revision BEFORE UPDATE OR DELETE ON evidence.source_policies
  FOR EACH ROW EXECUTE FUNCTION evidence.preserve_collection_policy_revision();

-- Research gets read-only guidance, not wider publication authority.
GRANT SELECT ON evidence.source_policies,evidence.source_policy_claim_fitness,evidence.source_organizations TO research_worker;
CREATE POLICY collection_policies_research_read ON evidence.source_policies FOR SELECT TO research_worker USING (true);
CREATE POLICY collection_fitness_research_read ON evidence.source_policy_claim_fitness FOR SELECT TO research_worker USING (true);
CREATE POLICY collection_publishers_research_read ON evidence.source_organizations FOR SELECT TO research_worker USING (true);

ALTER TABLE evidence.source_organizations ADD COLUMN profile_review_status text NOT NULL DEFAULT 'unreviewed'
  CHECK (profile_review_status IN ('unreviewed','reviewed','needs_recheck'));
UPDATE evidence.source_organizations SET profile_review_status='needs_recheck' WHERE profile_reviewed_at IS NOT NULL;
COMMENT ON COLUMN evidence.source_organizations.profile_review_status IS
  'Current methodological review status. Old review dates remain historical; prestige and legacy tier are not claim acceptance.';
ALTER TABLE evidence.source_policy_claim_fitness ADD COLUMN assessment_basis text NOT NULL DEFAULT 'legacy_heuristic'
  CHECK (assessment_basis IN ('legacy_heuristic','qualitative_review'));

CREATE FUNCTION evidence.preserve_collection_fitness_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  IF TG_OP='INSERT' THEN
    IF EXISTS (SELECT 1 FROM evidence.source_policies WHERE id=NEW.source_policy_id
      AND version=NEW.source_policy_version AND collection_guidance IS NOT NULL AND sealed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Sealed collection fitness revisions are immutable; insert a new policy version';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM evidence.source_policies WHERE id=OLD.source_policy_id
    AND version=OLD.source_policy_version AND collection_guidance IS NOT NULL) THEN
    RAISE EXCEPTION 'Collection fitness revisions are immutable; insert a new policy version';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION evidence.preserve_collection_fitness_revision() FROM PUBLIC;
CREATE TRIGGER preserve_collection_fitness_revision BEFORE INSERT OR UPDATE OR DELETE ON evidence.source_policy_claim_fitness
  FOR EACH ROW EXECUTE FUNCTION evidence.preserve_collection_fitness_revision();
