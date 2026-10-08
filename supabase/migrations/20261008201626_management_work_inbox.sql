-- Durable management requests sit above, and reference, the existing research execution ledger.
CREATE TABLE research.management_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  idempotency_key text NOT NULL,
  request jsonb NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN
    ('queued','researching','awaiting_review','approved','publishing','published','held','failed','verification_failed')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  proposal jsonb,
  proposal_hash text,
  approved_entity_ids text[] NOT NULL DEFAULT '{}',
  outcome jsonb,
  error text,
  lease_token uuid,
  lease_until timestamptz,
  dispatch_status text NOT NULL DEFAULT 'pending' CHECK (dispatch_status IN ('pending','dispatching','accepted','failed')),
  dispatch_token uuid,
  dispatched_at timestamptz,
  dispatch_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,idempotency_key)
);
CREATE TABLE research.management_work_proposals (
  work_id uuid NOT NULL REFERENCES research.management_work(id),
  version integer NOT NULL,
  proposal_hash text NOT NULL,
  proposal jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(work_id,version)
);
CREATE TABLE research.management_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  client_id text NOT NULL,
  session_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE research.management_work_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES research.management_work(id),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  version integer NOT NULL,
  proposal_hash text NOT NULL,
  entity_ids text[] NOT NULL,
  action text NOT NULL CHECK (action IN ('approve','request_changes','hold')),
  basis text NOT NULL CHECK (basis IN ('direct_owner','agent_relay')),
  delegation_id uuid REFERENCES research.management_delegations(id),
  session_id text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,idempotency_key),
  FOREIGN KEY(work_id,version) REFERENCES research.management_work_proposals(work_id,version)
);
CREATE INDEX management_work_owner_updated ON research.management_work(owner_id,updated_at DESC);
CREATE INDEX management_work_pending ON research.management_work(state,lease_until);
ALTER TABLE research.management_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.management_work_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.management_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.management_work_decisions ENABLE ROW LEVEL SECURITY;
-- Access goes through the authenticated application service; no browser Data API grants.
REVOKE ALL ON research.management_work, research.management_work_proposals,
  research.management_delegations, research.management_work_decisions FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON research.management_work TO service_role;
GRANT SELECT,INSERT ON research.management_work_proposals, research.management_work_decisions TO service_role;
GRANT SELECT,INSERT,UPDATE ON research.management_delegations TO service_role;
CREATE POLICY management_work_service ON research.management_work TO service_role USING (true) WITH CHECK (true);
CREATE POLICY management_proposals_service ON research.management_work_proposals TO service_role USING (true) WITH CHECK (true);
CREATE POLICY management_decisions_service ON research.management_work_decisions TO service_role USING (true) WITH CHECK (true);
CREATE POLICY management_delegations_service ON research.management_delegations TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER management_proposals_append_only BEFORE UPDATE OR DELETE ON research.management_work_proposals
  FOR EACH ROW EXECUTE FUNCTION ops.reject_append_only_mutation();
CREATE TRIGGER management_decisions_append_only BEFORE UPDATE OR DELETE ON research.management_work_decisions
  FOR EACH ROW EXECUTE FUNCTION ops.reject_append_only_mutation();

-- Reuse the existing research-only database capability, with no publication grants.
GRANT SELECT ON research.management_work, research.management_work_proposals,
  research.management_work_decisions TO research_worker;
GRANT INSERT ON research.management_work_proposals TO research_worker;
GRANT UPDATE(state,version,proposal,proposal_hash,approved_entity_ids,lease_token,lease_until,error,updated_at)
  ON research.management_work TO research_worker;
GRANT USAGE ON SCHEMA canonical TO research_worker;
GRANT SELECT ON canonical.entities,canonical.entity_locations,canonical.claims,canonical.claim_versions TO research_worker;
CREATE POLICY management_work_research ON research.management_work TO research_worker USING(true) WITH CHECK(true);
CREATE POLICY management_proposals_research ON research.management_work_proposals TO research_worker USING(true) WITH CHECK(true);
CREATE POLICY management_decisions_research ON research.management_work_decisions FOR SELECT TO research_worker USING(true);
CREATE POLICY management_catalog_research ON canonical.entities FOR SELECT TO research_worker USING(true);
CREATE POLICY management_locations_research ON canonical.entity_locations FOR SELECT TO research_worker USING(true);
CREATE POLICY management_claims_research ON canonical.claims FOR SELECT TO research_worker USING(true);
CREATE POLICY management_versions_research ON canonical.claim_versions FOR SELECT TO research_worker USING(true);
CREATE FUNCTION research.guard_management_research_worker() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF pg_has_role(current_user,'research_worker','member') AND NOT pg_has_role(current_user,'admin_app','member') AND current_user<>'postgres' THEN
    IF NEW.state NOT IN ('queued','researching','awaiting_review','failed') OR
       OLD.state NOT IN ('queued','researching','awaiting_review','failed') OR
       NEW.approved_entity_ids IS DISTINCT FROM OLD.approved_entity_ids THEN
      RAISE EXCEPTION 'Research worker cannot authorize or publish work';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER management_research_boundary BEFORE UPDATE ON research.management_work
  FOR EACH ROW EXECUTE FUNCTION research.guard_management_research_worker();
REVOKE ALL ON FUNCTION research.guard_management_research_worker() FROM PUBLIC;

GRANT SELECT,INSERT,UPDATE ON research.management_work, research.management_delegations TO admin_app;
GRANT SELECT,INSERT ON research.management_work_proposals,research.management_work_decisions TO admin_app;

-- Return only current publishing eligibility; product credentials cannot read auth.users.
CREATE FUNCTION research.management_owner_can_publish(p_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE allowed boolean;
BEGIN
  SELECT raw_app_meta_data->>'app_role' IN ('admin','publication')
    AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<now()) INTO allowed
    FROM auth.users WHERE id=p_owner FOR SHARE;
  RETURN COALESCE(allowed,false);
END $$;
REVOKE ALL ON FUNCTION research.management_owner_can_publish(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION research.management_owner_can_publish(uuid) TO admin_app;
GRANT USAGE ON SCHEMA publication TO admin_app;
GRANT SELECT,INSERT,UPDATE ON publication.releases TO admin_app;
GRANT EXECUTE ON FUNCTION publication.activate_release(text) TO admin_app;

-- Collection guidance extends the existing source registry; exact-source retention decisions stay on source_items.
ALTER TABLE evidence.evidence_sources ADD COLUMN research_guidance jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(research_guidance)='object');
COMMENT ON COLUMN evidence.evidence_sources.research_guidance IS
  'Collection, coverage, suitableClaims, searchMethods, limitations, provenance, preservationConditions. Discovery guidance, never a truth whitelist or blanket retention grant.';

-- Native publication credentials use their database capability; no synthetic user JWT is minted.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('publication.activate_release(text)'::regprocedure) INTO definition;
  IF position('AND current_user IS DISTINCT FROM ''postgres''' IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected activation authority definition';
  END IF;
  definition:=replace(definition,'AND current_user IS DISTINCT FROM ''postgres''',
    'AND current_user IS DISTINCT FROM ''postgres'' AND NOT pg_has_role(session_user,''admin_app'',''member'')');
  EXECUTE definition;
END $$;
