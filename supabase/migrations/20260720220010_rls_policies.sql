-- 0010_rls_policies: enable RLS + policies. Research cannot publish (ADR-020).

-- ---------------------------------------------------------------------------
-- Enable RLS on all application tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schemaname, c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname IN (
        'bb_public', 'bb_submissions', 'bb_research', 'bb_evidence',
        'bb_canonical', 'bb_publication', 'bb_reference', 'bb_ops', 'bb_audit'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- bb_public: SELECT active release surfaces for anon/authenticated
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW bb_public.v_active_release_id
WITH (security_invoker = true) AS
SELECT release_id FROM bb_public.active_release WHERE id = 'active';

CREATE POLICY active_release_select ON bb_public.active_release
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY materialized_snapshots_select ON bb_public.materialized_snapshots
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY release_entities_select_active ON bb_public.release_entities
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

CREATE POLICY release_stories_select_active ON bb_public.release_stories
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

CREATE POLICY release_graph_adjacency_select_active ON bb_public.release_graph_adjacency
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

CREATE POLICY release_graph_decades_select_active ON bb_public.release_graph_decades
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

CREATE POLICY release_graph_all_time_select_active ON bb_public.release_graph_all_time
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

CREATE POLICY search_index_select_active ON bb_public.search_index
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

-- No INSERT/UPDATE/DELETE policies for anon/authenticated on bb_public
-- (service_role bypasses RLS).

-- ---------------------------------------------------------------------------
-- bb_submissions: create quarantined as self; read own or staff
-- ---------------------------------------------------------------------------
CREATE POLICY intake_insert_quarantined ON bb_submissions.intake_items
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND status = 'quarantined'
  );

CREATE POLICY intake_select_own_or_staff ON bb_submissions.intake_items
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR bb_auth.has_any_role('admin', 'security')
  );

-- ---------------------------------------------------------------------------
-- bb_research: research/admin read+write cases; never touches active_release
-- ---------------------------------------------------------------------------
CREATE POLICY research_cases_staff ON bb_research.cases
  FOR ALL TO authenticated
  USING (bb_auth.has_any_role('admin', 'research'))
  WITH CHECK (bb_auth.has_any_role('admin', 'research'));

CREATE POLICY research_history_staff ON bb_research.case_history_events
  FOR ALL TO authenticated
  USING (bb_auth.has_any_role('admin', 'research'))
  WITH CHECK (bb_auth.has_any_role('admin', 'research'));

CREATE POLICY research_checklist_staff ON bb_research.case_checklist_items
  FOR ALL TO authenticated
  USING (bb_auth.has_any_role('admin', 'research'))
  WITH CHECK (bb_auth.has_any_role('admin', 'research'));

-- ---------------------------------------------------------------------------
-- bb_evidence / bb_canonical: no authenticated write policies (service_role only).
-- Staff SELECT for research/admin on evidence; canonical SELECT for research/admin.
-- ---------------------------------------------------------------------------
CREATE POLICY evidence_select_staff ON bb_evidence.evidence_records
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication', 'security'));

CREATE POLICY source_items_select_staff ON bb_evidence.source_items
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication', 'security'));

CREATE POLICY evidence_sources_select_staff ON bb_evidence.evidence_sources
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication', 'security'));

CREATE POLICY source_orgs_select_staff ON bb_evidence.source_organizations
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication', 'security'));

CREATE POLICY source_domains_select_staff ON bb_evidence.source_domains
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication', 'security'));

CREATE POLICY source_captures_select_staff ON bb_evidence.source_captures
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication', 'security'));

CREATE POLICY retrieval_events_select_staff ON bb_evidence.retrieval_events
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication', 'security'));

CREATE POLICY evidence_lineage_select_staff ON bb_evidence.evidence_lineage
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication', 'security'));

-- Canonical: grant USAGE was service_role-only; also allow authenticated staff SELECT via
-- schema grant added here.
GRANT USAGE ON SCHEMA bb_canonical TO authenticated;

CREATE POLICY entities_select_staff ON bb_canonical.entities
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY entity_locations_select_staff ON bb_canonical.entity_locations
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY claims_select_staff ON bb_canonical.claims
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY claim_versions_select_staff ON bb_canonical.claim_versions
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY claim_evidence_links_select_staff ON bb_canonical.claim_evidence_links
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY entity_relationships_select_staff ON bb_canonical.entity_relationships
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY entity_relationship_evidence_select_staff ON bb_canonical.entity_relationship_evidence
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY entity_merges_select_staff ON bb_canonical.entity_merges
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY entity_merge_absorbed_select_staff ON bb_canonical.entity_merge_absorbed
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY entity_merge_evidence_select_staff ON bb_canonical.entity_merge_evidence
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY entity_embeddings_select_staff ON bb_canonical.entity_embeddings
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY claim_promotions_select_staff ON bb_canonical.claim_promotions
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY publication_candidates_select_staff ON bb_canonical.publication_candidates
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

-- ---------------------------------------------------------------------------
-- bb_publication: staff SELECT; no authenticated UPDATE of releases
-- ---------------------------------------------------------------------------
CREATE POLICY releases_select_staff ON bb_publication.releases
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

-- Explicit deny path for research mutating active_release: no policy for UPDATE/DELETE
-- for authenticated on active_release (only service_role bypass).

-- ---------------------------------------------------------------------------
-- bb_reference: public-ish SELECT on open series; closed tables staff-only
-- ---------------------------------------------------------------------------
CREATE POLICY jurisdictions_select ON bb_reference.jurisdictions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY census_county_decades_select ON bb_reference.census_county_decades
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY census_national_decades_select ON bb_reference.census_national_decades
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY census_state_decades_select ON bb_reference.census_state_decades
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY acs_county_profiles_select ON bb_reference.acs_county_profiles
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY ucr_agencies_select ON bb_reference.ucr_agencies
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY ucr_state_participation_select ON bb_reference.ucr_state_participation
  FOR SELECT TO anon, authenticated USING (true);

-- Closed: historical county, tracts, hate crime, holc, opportunity atlas
CREATE POLICY census_county_historical_select_staff ON bb_reference.census_county_historical_decades
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY acs_tract_profiles_select_staff ON bb_reference.acs_tract_profiles
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY hate_crime_select_staff ON bb_reference.hate_crime_county_years
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY holc_areas_select_staff ON bb_reference.holc_areas
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY opportunity_atlas_select_staff ON bb_reference.opportunity_atlas_tracts
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

-- ---------------------------------------------------------------------------
-- bb_audit: staff SELECT; no client UPDATE/DELETE
-- ---------------------------------------------------------------------------
CREATE POLICY audit_select_staff ON bb_audit.events
  FOR SELECT TO authenticated
  USING (bb_auth.is_staff());

-- ---------------------------------------------------------------------------
-- Table grants (RLS still applies)
-- ---------------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA bb_public TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON bb_submissions.intake_items TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA bb_submissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bb_research TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA bb_research TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_evidence TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA bb_evidence TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_canonical TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA bb_canonical TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_publication TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA bb_publication TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_reference TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA bb_reference TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA bb_ops TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA bb_audit TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA bb_audit TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bb_research TO authenticated, service_role;

-- Append-only claim_versions: revoke UPDATE/DELETE from authenticated (none granted);
-- also revoke from PUBLIC just in case.
REVOKE UPDATE, DELETE ON bb_canonical.claim_versions FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON bb_audit.events FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, INSERT ON bb_public.active_release FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON bb_public.release_entities FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON bb_public.release_stories FROM PUBLIC, anon, authenticated;
