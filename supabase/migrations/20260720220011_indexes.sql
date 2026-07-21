-- 0011_indexes: natural keys, geo, vectors, outbox, search helpers.

CREATE INDEX IF NOT EXISTS outbox_messages_status_available_at_idx
  ON bb_ops.outbox_messages (status, available_at);

CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx
  ON bb_audit.events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_entity_id_idx
  ON bb_audit.events (entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS research_cases_state_updated_at_idx
  ON bb_research.cases (state, updated_at DESC);

CREATE INDEX IF NOT EXISTS case_history_case_id_occurred_at_idx
  ON bb_research.case_history_events (case_id, occurred_at);

CREATE INDEX IF NOT EXISTS entities_kind_idx ON bb_canonical.entities (kind);
CREATE INDEX IF NOT EXISTS entities_display_name_trgm_idx
  ON bb_canonical.entities USING gin (display_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS entity_locations_entity_id_idx
  ON bb_canonical.entity_locations (entity_id);

CREATE INDEX IF NOT EXISTS entity_locations_geog_idx
  ON bb_canonical.entity_locations USING gist (location);

CREATE INDEX IF NOT EXISTS entity_locations_geohash_idx
  ON bb_canonical.entity_locations (geohash);

CREATE INDEX IF NOT EXISTS claims_entity_id_publication_status_idx
  ON bb_canonical.claims (entity_id, publication_status);

CREATE INDEX IF NOT EXISTS claim_versions_claim_id_idx
  ON bb_canonical.claim_versions (claim_id);

CREATE INDEX IF NOT EXISTS claim_evidence_links_claim_id_role_idx
  ON bb_canonical.claim_evidence_links (claim_id, role);

CREATE INDEX IF NOT EXISTS claim_evidence_links_lineage_root_role_idx
  ON bb_canonical.claim_evidence_links (lineage_root_id, role)
  WHERE lineage_root_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS entity_relationships_from_idx
  ON bb_canonical.entity_relationships (from_entity_id);

CREATE INDEX IF NOT EXISTS entity_relationships_to_idx
  ON bb_canonical.entity_relationships (to_entity_id);

CREATE INDEX IF NOT EXISTS source_items_source_stable_idx
  ON bb_evidence.source_items (source_id, stable_identifier);

CREATE INDEX IF NOT EXISTS source_captures_hash_idx
  ON bb_evidence.source_captures (content_hash_algorithm, content_hash_digest);

CREATE INDEX IF NOT EXISTS evidence_records_source_item_idx
  ON bb_evidence.evidence_records (source_item_id);

CREATE INDEX IF NOT EXISTS evidence_lineage_root_idx
  ON bb_evidence.evidence_lineage (lineage_root_id);

CREATE INDEX IF NOT EXISTS release_entities_geohash_idx
  ON bb_public.release_entities (release_id, geohash);

CREATE INDEX IF NOT EXISTS search_index_release_name_lower_idx
  ON bb_public.search_index (release_id, name_lower);

CREATE INDEX IF NOT EXISTS search_index_release_geohash_idx
  ON bb_public.search_index (release_id, geohash);

CREATE INDEX IF NOT EXISTS search_index_release_kind_idx
  ON bb_public.search_index (release_id, kind);

CREATE INDEX IF NOT EXISTS entity_embeddings_hnsw_idx
  ON bb_canonical.entity_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS census_county_decades_fips_decade_idx
  ON bb_reference.census_county_decades (fips5, decade);

CREATE INDEX IF NOT EXISTS hate_crime_county_years_fips_year_idx
  ON bb_reference.hate_crime_county_years (fips5, year);

CREATE INDEX IF NOT EXISTS jurisdictions_parent_id_idx
  ON bb_reference.jurisdictions (parent_id);

CREATE INDEX IF NOT EXISTS intake_items_created_by_idx
  ON bb_submissions.intake_items (created_by);

CREATE INDEX IF NOT EXISTS story_packet_reviews_submission_id_idx
  ON bb_ops.story_packet_reviews (submission_id);
