-- 0012_advisor_remediation: search_path, RLS initplan, bb_ops deny policies, FK indexes.
-- Applied to blackstory-app after initial DDL (ADR-020).

CREATE OR REPLACE FUNCTION bb_auth.current_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = bb_auth, public
AS $$
  SELECT NULLIF(
    auth.jwt() -> 'app_metadata' ->> 'bb_role',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION bb_auth.has_role(expected text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = bb_auth, public
AS $$
  SELECT bb_auth.current_role() IS NOT DISTINCT FROM expected;
$$;

CREATE OR REPLACE FUNCTION bb_auth.has_any_role(VARIADIC expected text[])
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = bb_auth, public
AS $$
  SELECT bb_auth.current_role() = ANY (expected);
$$;

CREATE OR REPLACE FUNCTION bb_auth.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = bb_auth, public
AS $$
  SELECT bb_auth.has_any_role('admin', 'research', 'publication', 'security');
$$;

CREATE OR REPLACE FUNCTION bb_auth.can_publish()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = bb_auth, public
AS $$
  SELECT bb_auth.has_any_role('admin', 'publication');
$$;

DROP POLICY IF EXISTS intake_insert_quarantined ON bb_submissions.intake_items;
CREATE POLICY intake_insert_quarantined ON bb_submissions.intake_items
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND status = 'quarantined'
  );

DROP POLICY IF EXISTS intake_select_own_or_staff ON bb_submissions.intake_items;
CREATE POLICY intake_select_own_or_staff ON bb_submissions.intake_items
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT bb_auth.has_any_role('admin', 'security'))
  );

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'policy_versions','policy_active','kill_switches','discovery_campaign_runs',
    'outbox_messages','idempotency_keys','outbox_consumer_receipts','catalog_decisions',
    'story_packet_reviews','external_datasets','external_dataset_versions',
    'dataset_subscriptions','import_batches','import_validation_findings','import_quarantines'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON bb_ops.%I',
      'deny_authenticated_' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON bb_ops.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      'deny_authenticated_' || t, t
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS claim_evidence_links_claim_version_id_idx ON bb_canonical.claim_evidence_links (claim_version_id);
CREATE INDEX IF NOT EXISTS claim_evidence_links_evidence_id_idx ON bb_canonical.claim_evidence_links (evidence_id);
CREATE INDEX IF NOT EXISTS claim_promotions_claim_id_idx ON bb_canonical.claim_promotions (claim_id);
CREATE INDEX IF NOT EXISTS claims_current_version_id_idx ON bb_canonical.claims (current_version_id);
CREATE INDEX IF NOT EXISTS entity_merge_absorbed_absorbed_id_idx ON bb_canonical.entity_merge_absorbed (absorbed_id);
CREATE INDEX IF NOT EXISTS entity_merge_evidence_evidence_id_idx ON bb_canonical.entity_merge_evidence (evidence_id);
CREATE INDEX IF NOT EXISTS entity_merges_survivor_id_idx ON bb_canonical.entity_merges (survivor_id);
CREATE INDEX IF NOT EXISTS entity_relationship_evidence_evidence_id_idx ON bb_canonical.entity_relationship_evidence (evidence_id);
CREATE INDEX IF NOT EXISTS publication_candidates_claim_id_idx ON bb_canonical.publication_candidates (claim_id);
CREATE INDEX IF NOT EXISTS publication_candidates_promotion_id_idx ON bb_canonical.publication_candidates (promotion_id);
CREATE INDEX IF NOT EXISTS evidence_lineage_from_idx ON bb_evidence.evidence_lineage (from_evidence_id);
CREATE INDEX IF NOT EXISTS evidence_lineage_to_idx ON bb_evidence.evidence_lineage (to_evidence_id);
CREATE INDEX IF NOT EXISTS evidence_sources_organization_id_idx ON bb_evidence.evidence_sources (organization_id);
CREATE INDEX IF NOT EXISTS retrieval_events_source_id_idx ON bb_evidence.retrieval_events (source_id);
CREATE INDEX IF NOT EXISTS source_captures_dedup_idx ON bb_evidence.source_captures (dedup_of_capture_id);
CREATE INDEX IF NOT EXISTS source_captures_source_item_id_idx ON bb_evidence.source_captures (source_item_id);
CREATE INDEX IF NOT EXISTS source_domains_organization_id_idx ON bb_evidence.source_domains (organization_id);
CREATE INDEX IF NOT EXISTS dataset_subscriptions_dataset_id_idx ON bb_ops.dataset_subscriptions (dataset_id);
CREATE INDEX IF NOT EXISTS import_batches_dataset_version_id_idx ON bb_ops.import_batches (dataset_version_id);
CREATE INDEX IF NOT EXISTS import_quarantines_batch_id_idx ON bb_ops.import_quarantines (batch_id);
CREATE INDEX IF NOT EXISTS import_validation_findings_batch_id_idx ON bb_ops.import_validation_findings (batch_id);
CREATE INDEX IF NOT EXISTS outbox_consumer_receipts_message_id_idx ON bb_ops.outbox_consumer_receipts (message_id);
CREATE INDEX IF NOT EXISTS active_release_release_id_idx ON bb_public.active_release (release_id);
