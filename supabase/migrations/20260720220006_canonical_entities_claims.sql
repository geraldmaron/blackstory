-- 0006_canonical_entities_claims: entities, locations, relationships, merges, claims, embeddings.

CREATE TABLE bb_canonical.entities (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN (
    'person', 'place', 'school', 'organization', 'institution', 'event',
    'law', 'case', 'publication', 'artifact', 'movement', 'other'
  )),
  entity_class text CHECK (entity_class IN (
    'person', 'place', 'organization', 'event', 'legal', 'work', 'movement'
  )),
  display_name text NOT NULL,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  identifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  living_status text NOT NULL DEFAULT 'unknown'
    CHECK (living_status IN ('living', 'deceased', 'unknown', 'not_applicable')),
  living_status_derived jsonb,
  merge_state jsonb,
  status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  notability_basis jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensitivity jsonb NOT NULL DEFAULT '[]'::jsonb,
  kind_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_canonical.entity_locations (
  id text PRIMARY KEY,
  entity_id text NOT NULL REFERENCES bb_canonical.entities (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('historical', 'current', 'approximate')),
  geometry_type text CHECK (geometry_type IN ('Point', 'Polygon', 'BBox')),
  geometry jsonb,
  location geography(Point, 4326),
  lat double precision,
  lng double precision,
  geohash text,
  geohash_prefixes text[],
  precision text,
  match_method text,
  valid_from date,
  valid_to date,
  jurisdiction_ids text[] NOT NULL DEFAULT '{}',
  modern_zip jsonb,
  label text,
  evidence_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_canonical.entity_relationships (
  id text PRIMARY KEY,
  from_entity_id text NOT NULL REFERENCES bb_canonical.entities (id),
  to_entity_id text NOT NULL REFERENCES bb_canonical.entities (id),
  relationship_type text NOT NULL,
  role text,
  valid_from date,
  valid_to date,
  geographic jsonb,
  workflow_status text,
  publication_status text,
  confidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_entity_id <> to_entity_id)
);

CREATE TABLE bb_canonical.entity_relationship_evidence (
  relationship_id text NOT NULL REFERENCES bb_canonical.entity_relationships (id) ON DELETE CASCADE,
  evidence_id text NOT NULL REFERENCES bb_evidence.evidence_records (id),
  PRIMARY KEY (relationship_id, evidence_id)
);

CREATE TABLE bb_canonical.entity_merges (
  id text PRIMARY KEY,
  survivor_id text NOT NULL REFERENCES bb_canonical.entities (id),
  status text NOT NULL CHECK (status IN ('active', 'reversed')),
  reason text NOT NULL,
  actor_id text,
  reversed_at timestamptz,
  reverse_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_canonical.entity_merge_absorbed (
  merge_id text NOT NULL REFERENCES bb_canonical.entity_merges (id) ON DELETE CASCADE,
  absorbed_id text NOT NULL REFERENCES bb_canonical.entities (id),
  PRIMARY KEY (merge_id, absorbed_id)
);

CREATE TABLE bb_canonical.entity_merge_evidence (
  merge_id text NOT NULL REFERENCES bb_canonical.entity_merges (id) ON DELETE CASCADE,
  evidence_id text NOT NULL REFERENCES bb_evidence.evidence_records (id),
  PRIMARY KEY (merge_id, evidence_id)
);

CREATE TABLE bb_canonical.entity_embeddings (
  entity_id text PRIMARY KEY REFERENCES bb_canonical.entities (id) ON DELETE CASCADE,
  kind text NOT NULL,
  state text,
  era_bucket text,
  embedding extensions.vector(768) NOT NULL,
  dims integer NOT NULL DEFAULT 768 CHECK (dims = 768),
  model text NOT NULL,
  source_text_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_canonical.claims (
  id text PRIMARY KEY,
  entity_id text NOT NULL REFERENCES bb_canonical.entities (id),
  current_version_id text,
  claim_class text,
  workflow_status text,
  publication_status text,
  procedural_status text,
  confidence jsonb,
  relevance jsonb,
  connection_strength jsonb,
  research_coverage jsonb,
  preserved_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_canonical.claim_versions (
  id text PRIMARY KEY,
  claim_id text NOT NULL REFERENCES bb_canonical.claims (id) ON DELETE CASCADE,
  predicate text NOT NULL,
  object jsonb NOT NULL,
  workflow_status text,
  publication_status text,
  confidence jsonb,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

-- Append-only: current pointer may update on claims; versions rows are immutable.
ALTER TABLE bb_canonical.claims
  ADD CONSTRAINT claims_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES bb_canonical.claim_versions (id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE bb_canonical.claim_evidence_links (
  id text PRIMARY KEY,
  claim_id text NOT NULL REFERENCES bb_canonical.claims (id),
  claim_version_id text NOT NULL REFERENCES bb_canonical.claim_versions (id),
  evidence_id text NOT NULL REFERENCES bb_evidence.evidence_records (id),
  role text NOT NULL CHECK (role IN ('supporting', 'contradicting', 'contextual')),
  lineage_root_id text,
  quality jsonb,
  asserted_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_canonical.claim_promotions (
  id text PRIMARY KEY,
  claim_id text NOT NULL REFERENCES bb_canonical.claims (id),
  status text NOT NULL,
  proposed_by text NOT NULL,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (approved_by IS NULL OR approved_by <> proposed_by)
);

CREATE TABLE bb_canonical.publication_candidates (
  id text PRIMARY KEY,
  claim_id text NOT NULL REFERENCES bb_canonical.claims (id),
  promotion_id text REFERENCES bb_canonical.claim_promotions (id),
  status text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
