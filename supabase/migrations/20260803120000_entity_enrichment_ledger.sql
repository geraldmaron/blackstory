-- repo-n7p6.2 (WS2): resumable/idempotent ledger for the entity-depth enrichment epic.
-- Later passes (WS3 evidence sweep, WS4 LLM enrichment harness) need to know, per entity,
-- what was last written and how fresh it is, so a re-run can skip anything already freshly
-- enriched and support "re-enrich anything older than N days" without re-touching everything.
--
-- entity_id join strategy: bb_canonical.entities.id, bb_research.landscape_candidates.id, and
-- bb_public.release_entities.entity_id are the SAME id space in this schema — landscape
-- publish (packages/ops-data/scripts/publish-release-entities-incremental.ts) carries
-- landscape_candidates.id straight through as both the canonical entity id
-- (canonicalUpsertParamsFromLandscape) and the release_entities.entity_id
-- (buildReleaseSourceFromLandscape / toReleaseEntityRow), so one id is stable and unique
-- across all three tables for any entity that has been published. entity_enrichment keys on
-- that shared id as a plain text column, not a FOREIGN KEY: bb_public.release_entities has no
-- unique constraint on entity_id alone (its PK is (release_id, entity_id), since an entity can
-- appear in more than one release row over time), and bb_canonical.entities can lag or diverge
-- from what is actually live in the active release. A soft reference keeps the ledger usable for
-- pre-publish candidates too (WS3 evidence fetch may run before an entity is ever released),
-- matching the no-hard-FK convention already used by bb_research.model_invocations.
CREATE TABLE bb_research.entity_enrichment (
  entity_id text PRIMARY KEY,
  lane text,
  enrichment_version integer NOT NULL DEFAULT 1,
  last_enriched_at timestamptz,
  evidence_digest text,
  model_id text,
  status text NOT NULL CHECK (status IN ('pending', 'enriched', 'quarantined', 'skipped')),
  fields_written text[] NOT NULL DEFAULT '{}',
  cost_usd numeric,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entity_enrichment_lane_idx ON bb_research.entity_enrichment (lane);
CREATE INDEX entity_enrichment_status_idx ON bb_research.entity_enrichment (status);
CREATE INDEX entity_enrichment_last_enriched_at_idx ON bb_research.entity_enrichment (last_enriched_at);

ALTER TABLE bb_research.entity_enrichment ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_enrichment_staff_select ON bb_research.entity_enrichment
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));

REVOKE INSERT, UPDATE, DELETE ON bb_research.entity_enrichment FROM authenticated;
GRANT SELECT ON bb_research.entity_enrichment TO authenticated;
GRANT ALL ON bb_research.entity_enrichment TO service_role;
