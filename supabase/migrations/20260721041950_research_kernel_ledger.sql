-- Evidence-first research kernel: normalized research semantics and scoped worker RPCs.
-- Existing source/entity/claim/release tables remain the canonical roots from ADR-020.

-- ---------------------------------------------------------------------------
-- Versioned profiles and claim-relative source policy
-- ---------------------------------------------------------------------------
CREATE TABLE bb_research.research_profiles (
  id text NOT NULL,
  version text NOT NULL,
  schema_version text NOT NULL,
  checksum text NOT NULL,
  profile jsonb NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version),
  CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);

CREATE UNIQUE INDEX research_profiles_one_active_idx
  ON bb_research.research_profiles (id)
  WHERE active;

CREATE TABLE bb_evidence.source_policies (
  id text NOT NULL,
  version text NOT NULL,
  profile_id text NOT NULL,
  profile_version text NOT NULL,
  display_name text NOT NULL,
  source_class text NOT NULL,
  rights jsonb NOT NULL DEFAULT '{}'::jsonb,
  retrieval jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version),
  FOREIGN KEY (profile_id, profile_version)
    REFERENCES bb_research.research_profiles (id, version)
);

CREATE TABLE bb_evidence.source_policy_claim_fitness (
  source_policy_id text NOT NULL,
  source_policy_version text NOT NULL,
  claim_class text NOT NULL,
  fitness text NOT NULL CHECK (fitness IN (
    'authoritative', 'strong', 'conditional', 'lead_only', 'unfit'
  )),
  limitations text[] NOT NULL DEFAULT '{}',
  beta_prior_alpha numeric NOT NULL CHECK (beta_prior_alpha > 0),
  beta_prior_beta numeric NOT NULL CHECK (beta_prior_beta > 0),
  calibration_version text NOT NULL,
  PRIMARY KEY (source_policy_id, source_policy_version, claim_class),
  FOREIGN KEY (source_policy_id, source_policy_version)
    REFERENCES bb_evidence.source_policies (id, version)
);

-- ---------------------------------------------------------------------------
-- Exact selectors, lineage clusters, and claim-relative evidence
-- ---------------------------------------------------------------------------
CREATE TABLE bb_evidence.evidence_selectors (
  id text PRIMARY KEY,
  capture_id text NOT NULL REFERENCES bb_evidence.source_captures (id),
  selector_type text NOT NULL CHECK (selector_type IN (
    'TextQuoteSelector', 'TextPositionSelector', 'FragmentSelector',
    'PageSelector', 'TimeSelector'
  )),
  conforms_to text NOT NULL,
  exact_text text,
  prefix_text text,
  suffix_text text,
  start_offset bigint CHECK (start_offset IS NULL OR start_offset >= 0),
  end_offset bigint CHECK (end_offset IS NULL OR end_offset >= start_offset),
  page_number integer CHECK (page_number IS NULL OR page_number >= 1),
  time_start_seconds numeric CHECK (time_start_seconds IS NULL OR time_start_seconds >= 0),
  time_end_seconds numeric CHECK (
    time_end_seconds IS NULL OR time_end_seconds >= time_start_seconds
  ),
  fragment text,
  selector_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capture_id, selector_hash)
);

CREATE TABLE bb_evidence.lineage_clusters (
  id text PRIMARY KEY,
  root_capture_id text NOT NULL REFERENCES bb_evidence.source_captures (id),
  method_version text NOT NULL,
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_evidence.lineage_cluster_members (
  cluster_id text NOT NULL REFERENCES bb_evidence.lineage_clusters (id) ON DELETE CASCADE,
  capture_id text NOT NULL REFERENCES bb_evidence.source_captures (id),
  relationship text NOT NULL CHECK (relationship IN (
    'root', 'exact_duplicate', 'near_duplicate', 'quotation', 'syndication',
    'attribution', 'shared_upstream'
  )),
  similarity numeric CHECK (similarity IS NULL OR similarity BETWEEN 0 AND 1),
  detected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cluster_id, capture_id)
);

CREATE TABLE bb_evidence.capture_attributions (
  id text PRIMARY KEY,
  from_capture_id text NOT NULL REFERENCES bb_evidence.source_captures (id),
  upstream_source_item_id text NOT NULL REFERENCES bb_evidence.source_items (id),
  selector_id text REFERENCES bb_evidence.evidence_selectors (id),
  attribution_type text NOT NULL CHECK (attribution_type IN (
    'quoted', 'cited', 'republished', 'syndicated', 'named_upstream'
  )),
  published_chronology_consistent boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_capture_id, upstream_source_item_id, attribution_type)
);

CREATE TABLE bb_canonical.claim_qualifiers (
  id text PRIMARY KEY,
  claim_version_id text NOT NULL REFERENCES bb_canonical.claim_versions (id),
  qualifier_type text NOT NULL CHECK (qualifier_type IN (
    'temporal', 'geographic', 'jurisdictional', 'procedural', 'uncertainty'
  )),
  property text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_version_id, qualifier_type, property)
);

CREATE TABLE bb_canonical.claim_tombstones (
  id text PRIMARY KEY,
  claim_version_id text NOT NULL REFERENCES bb_canonical.claim_versions (id),
  action text NOT NULL CHECK (action IN (
    'superseded', 'corrected', 'retracted', 'deleted'
  )),
  replacement_claim_version_id text REFERENCES bb_canonical.claim_versions (id),
  reason text NOT NULL,
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (replacement_claim_version_id IS NULL OR replacement_claim_version_id <> claim_version_id)
);

CREATE TABLE bb_canonical.evidence_assignments (
  id text PRIMARY KEY,
  claim_version_id text NOT NULL REFERENCES bb_canonical.claim_versions (id),
  selector_id text NOT NULL REFERENCES bb_evidence.evidence_selectors (id),
  role text NOT NULL CHECK (role IN (
    'supporting', 'contradicting', 'contextual', 'lead_only'
  )),
  fitness text NOT NULL CHECK (fitness IN (
    'authoritative', 'strong', 'conditional', 'lead_only', 'unfit'
  )),
  entailment_probability numeric NOT NULL CHECK (entailment_probability BETWEEN 0 AND 1),
  entailment_calibration_version text NOT NULL,
  lineage_cluster_id text NOT NULL REFERENCES bb_evidence.lineage_clusters (id),
  derived_from_assignment_id text REFERENCES bb_canonical.evidence_assignments (id),
  reviewer_actor_id text,
  status text NOT NULL CHECK (status IN (
    'proposed', 'accepted', 'rejected', 'superseded'
  )),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_canonical.claim_confidence_assessments (
  id text PRIMARY KEY,
  claim_version_id text NOT NULL REFERENCES bb_canonical.claim_versions (id),
  acceptance_probability numeric NOT NULL CHECK (acceptance_probability BETWEEN 0 AND 1),
  interval_low numeric NOT NULL CHECK (interval_low BETWEEN 0 AND 1),
  interval_high numeric NOT NULL CHECK (interval_high BETWEEN 0 AND 1),
  source_reliability numeric NOT NULL CHECK (source_reliability BETWEEN 0 AND 1),
  entailment numeric NOT NULL CHECK (entailment BETWEEN 0 AND 1),
  independence numeric NOT NULL CHECK (independence BETWEEN 0 AND 1),
  identity_confidence numeric NOT NULL CHECK (identity_confidence BETWEEN 0 AND 1),
  relevance numeric NOT NULL CHECK (relevance BETWEEN 0 AND 1),
  research_completeness numeric NOT NULL CHECK (research_completeness BETWEEN 0 AND 1),
  calibration_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (interval_low <= acceptance_probability AND acceptance_probability <= interval_high)
);

-- ---------------------------------------------------------------------------
-- Cases, questions, hypotheses, evidence needs, and leased frontier
-- ---------------------------------------------------------------------------
ALTER TABLE bb_research.cases
  ADD COLUMN profile_id text,
  ADD COLUMN profile_version text,
  ADD COLUMN risk_class text,
  ADD CONSTRAINT cases_profile_fk
    FOREIGN KEY (profile_id, profile_version)
    REFERENCES bb_research.research_profiles (id, version);

CREATE TABLE bb_research.research_questions (
  id text PRIMARY KEY,
  case_id text NOT NULL REFERENCES bb_research.cases (id) ON DELETE CASCADE,
  question text NOT NULL,
  priority numeric NOT NULL DEFAULT 0 CHECK (priority >= 0),
  status text NOT NULL CHECK (status IN ('open', 'answered', 'deferred', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.hypotheses (
  id text PRIMARY KEY,
  question_id text NOT NULL REFERENCES bb_research.research_questions (id) ON DELETE CASCADE,
  statement text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'open', 'supported', 'contradicted', 'mixed', 'rejected'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.evidence_needs (
  id text PRIMARY KEY,
  question_id text NOT NULL REFERENCES bb_research.research_questions (id) ON DELETE CASCADE,
  claim_class text NOT NULL,
  description text NOT NULL,
  mandatory boolean NOT NULL DEFAULT true,
  contradiction_search boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('open', 'satisfied', 'blocked', 'waived')),
  satisfied_by_assignment_id text REFERENCES bb_canonical.evidence_assignments (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.frontier_tasks (
  id text PRIMARY KEY,
  case_id text NOT NULL REFERENCES bb_research.cases (id) ON DELETE CASCADE,
  evidence_need_id text REFERENCES bb_research.evidence_needs (id),
  parent_task_id text REFERENCES bb_research.frontier_tasks (id),
  task_type text NOT NULL CHECK (task_type IN (
    'query', 'capture', 'extract', 'verify', 'resolve_entity',
    'expand_relationship', 'contradiction_search', 'rights_review'
  )),
  target_id text,
  risk_weight numeric NOT NULL CHECK (risk_weight >= 0),
  expected_entropy_reduction numeric NOT NULL CHECK (expected_entropy_reduction >= 0),
  source_novelty numeric NOT NULL CHECK (source_novelty >= 0),
  contradiction_value numeric NOT NULL CHECK (contradiction_value >= 0),
  normalized_cost numeric NOT NULL CHECK (normalized_cost > 0),
  score numeric GENERATED ALWAYS AS (
    risk_weight * (expected_entropy_reduction + source_novelty + contradiction_value)
    / normalized_cost
  ) STORED,
  hop integer NOT NULL DEFAULT 0 CHECK (hop >= 0),
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'leased', 'completed', 'failed', 'dead_letter', 'cancelled'
  )),
  idempotency_key text NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  leased_to text,
  lease_token text,
  leased_until timestamptz,
  heartbeat_at timestamptz,
  available_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'leased') = (leased_to IS NOT NULL AND lease_token IS NOT NULL AND leased_until IS NOT NULL))
);

-- ---------------------------------------------------------------------------
-- Probabilistic entity linkage and typed relationship qualifiers
-- ---------------------------------------------------------------------------
CREATE TABLE bb_canonical.entity_aliases (
  id text PRIMARY KEY,
  entity_id text NOT NULL REFERENCES bb_canonical.entities (id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  language text,
  script text,
  valid_from date,
  valid_to date,
  alias_type text NOT NULL CHECK (alias_type IN (
    'name', 'former_name', 'transliteration', 'role_qualified', 'abbreviation'
  )),
  selector_id text REFERENCES bb_evidence.evidence_selectors (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_canonical.entity_identifiers (
  id text PRIMARY KEY,
  entity_id text NOT NULL REFERENCES bb_canonical.entities (id) ON DELETE CASCADE,
  namespace text NOT NULL,
  value text NOT NULL,
  trusted boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_to date,
  selector_id text REFERENCES bb_evidence.evidence_selectors (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (namespace, value)
);

CREATE TABLE bb_research.entity_candidates (
  id text PRIMARY KEY,
  case_id text NOT NULL REFERENCES bb_research.cases (id) ON DELETE CASCADE,
  mention text NOT NULL,
  entity_kind text NOT NULL,
  source_selector_id text NOT NULL REFERENCES bb_evidence.evidence_selectors (id),
  active_from date,
  active_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.entity_candidate_names (
  candidate_id text NOT NULL REFERENCES bb_research.entity_candidates (id) ON DELETE CASCADE,
  normalized_name text NOT NULL,
  term_frequency numeric CHECK (term_frequency IS NULL OR term_frequency > 0),
  PRIMARY KEY (candidate_id, normalized_name)
);

CREATE TABLE bb_research.entity_candidate_identifiers (
  candidate_id text NOT NULL REFERENCES bb_research.entity_candidates (id) ON DELETE CASCADE,
  namespace text NOT NULL,
  value text NOT NULL,
  trusted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (candidate_id, namespace, value)
);

CREATE TABLE bb_research.entity_candidate_blocking_keys (
  candidate_id text NOT NULL REFERENCES bb_research.entity_candidates (id) ON DELETE CASCADE,
  key_type text NOT NULL CHECK (key_type IN (
    'identifier', 'normalized_name', 'entity_kind', 'jurisdiction', 'geohash', 'active_span'
  )),
  key_value text NOT NULL,
  PRIMARY KEY (candidate_id, key_type, key_value)
);

CREATE TABLE bb_research.resolution_decisions (
  id text PRIMARY KEY,
  candidate_id text NOT NULL REFERENCES bb_research.entity_candidates (id),
  entity_id text REFERENCES bb_canonical.entities (id),
  decision text NOT NULL CHECK (decision IN ('match', 'no_match', 'defer', 'reject')),
  match_probability numeric NOT NULL CHECK (match_probability BETWEEN 0 AND 1),
  cluster_consistent boolean NOT NULL,
  reversible boolean NOT NULL CHECK (reversible),
  model_version text NOT NULL,
  reviewer_actor_id text,
  reversed_by_decision_id text REFERENCES bb_research.resolution_decisions (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.resolution_decision_hard_stops (
  decision_id text NOT NULL REFERENCES bb_research.resolution_decisions (id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'trusted_identifier_conflict', 'impossible_lifespan',
    'incompatible_kind', 'exclusive_geography_time'
  )),
  detail text,
  PRIMARY KEY (decision_id, reason)
);

CREATE TABLE bb_canonical.relationship_qualifiers (
  id text PRIMARY KEY,
  relationship_id text NOT NULL REFERENCES bb_canonical.entity_relationships (id) ON DELETE CASCADE,
  qualifier_type text NOT NULL CHECK (qualifier_type IN (
    'temporal', 'geographic', 'jurisdictional', 'procedural', 'uncertainty'
  )),
  property text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relationship_id, qualifier_type, property)
);

-- Allow the live public catalog vocabulary plus research-kernel typed predicates.
-- A narrower CHECK would fail on existing production rows (cites, part_of, employed_by, …).
ALTER TABLE bb_canonical.entity_relationships
  ADD CONSTRAINT entity_relationships_typed_predicate
  CHECK (relationship_type IN (
    'served_as', 'located_at', 'succeeded', 'challenged_law',
    'participated_in', 'funded_by', 'founded', 'member_of',
    'published', 'occurred_at', 'related_to',
    'attended', 'employed_by', 'depicts', 'cites', 'governed_by',
    'part_of', 'successor_of', 'caused', 'enabled', 'influenced',
    'overturned', 'commemorates', 'authored', 'other'
  ));

-- ---------------------------------------------------------------------------
-- PROV runs, model invocations, quarantine, artifacts, and approvals
-- ---------------------------------------------------------------------------
CREATE TABLE bb_research.runs (
  id text PRIMARY KEY,
  case_id text NOT NULL REFERENCES bb_research.cases (id),
  profile_id text NOT NULL,
  profile_version text NOT NULL,
  policy_version text NOT NULL,
  mode text NOT NULL CHECK (mode IN (
    'deterministic', 'local-triage', 'free-batch', 'paid-research',
    'quality-prose', 'independent-review', 'trusted-session'
  )),
  status text NOT NULL CHECK (status IN (
    'pending', 'running', 'succeeded', 'failed', 'cancelled', 'escalated'
  )),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  heartbeat_at timestamptz,
  cost_usd numeric NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  query_count integer NOT NULL DEFAULT 0 CHECK (query_count >= 0),
  candidate_url_count integer NOT NULL DEFAULT 0 CHECK (candidate_url_count >= 0),
  capture_count integer NOT NULL DEFAULT 0 CHECK (capture_count >= 0),
  relationship_hop_count integer NOT NULL DEFAULT 0 CHECK (relationship_hop_count >= 0),
  terminal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (profile_id, profile_version)
    REFERENCES bb_research.research_profiles (id, version)
);

CREATE TABLE bb_research.agent_activities (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES bb_research.runs (id) ON DELETE CASCADE,
  prov_type text NOT NULL DEFAULT 'prov:Activity' CHECK (prov_type = 'prov:Activity'),
  actor_id text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN (
    'human', 'model', 'service', 'trusted_session'
  )),
  model_family text,
  activity_type text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.model_invocations (
  id text PRIMARY KEY,
  activity_id text NOT NULL REFERENCES bb_research.agent_activities (id),
  provider text NOT NULL,
  model_id text NOT NULL,
  model_family text NOT NULL,
  provider_route jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_hash text NOT NULL,
  output_schema_id text NOT NULL,
  output_schema_version text NOT NULL,
  benchmark_version text NOT NULL,
  raw_response text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'valid', 'invalid', 'failed')),
  repair_of_invocation_id text REFERENCES bb_research.model_invocations (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (repair_of_invocation_id IS NULL OR repair_of_invocation_id <> id)
);

CREATE TABLE bb_research.model_output_quarantine (
  id text PRIMARY KEY,
  invocation_id text NOT NULL UNIQUE REFERENCES bb_research.model_invocations (id),
  raw_output text NOT NULL,
  validation_errors text[] NOT NULL CHECK (cardinality(validation_errors) > 0),
  quarantined_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz NOT NULL,
  legal_hold boolean NOT NULL DEFAULT false
);

CREATE TABLE bb_research.artifacts (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES bb_research.runs (id),
  activity_id text NOT NULL REFERENCES bb_research.agent_activities (id),
  artifact_type text NOT NULL,
  content_hash text NOT NULL,
  schema_id text NOT NULL,
  schema_version text NOT NULL,
  storage_uri text NOT NULL,
  extensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN (
    'proposed', 'accepted', 'rejected', 'quarantined', 'superseded'
  )),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.artifact_dependencies (
  artifact_id text NOT NULL REFERENCES bb_research.artifacts (id) ON DELETE CASCADE,
  used_artifact_id text NOT NULL REFERENCES bb_research.artifacts (id),
  PRIMARY KEY (artifact_id, used_artifact_id),
  CHECK (artifact_id <> used_artifact_id)
);

CREATE TABLE bb_research.artifact_claims (
  artifact_id text NOT NULL REFERENCES bb_research.artifacts (id) ON DELETE CASCADE,
  claim_version_id text NOT NULL REFERENCES bb_canonical.claim_versions (id),
  PRIMARY KEY (artifact_id, claim_version_id)
);

CREATE TABLE bb_research.review_decisions (
  id text PRIMARY KEY,
  artifact_id text NOT NULL REFERENCES bb_research.artifacts (id),
  decision text NOT NULL CHECK (decision IN ('approve', 'reject', 'request_changes')),
  reviewer_actor_id text NOT NULL,
  reviewer_model_family text,
  producer_actor_id text NOT NULL,
  producer_model_family text,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  benchmark_version text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reviewer_actor_id <> producer_actor_id),
  CHECK (
    reviewer_model_family IS NULL OR producer_model_family IS NULL
    OR reviewer_model_family <> producer_model_family
  )
);

CREATE TABLE bb_publication.release_decisions (
  id text PRIMARY KEY,
  artifact_id text NOT NULL REFERENCES bb_research.artifacts (id),
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  review_decision_id text NOT NULL REFERENCES bb_research.review_decisions (id),
  decision text NOT NULL CHECK (decision IN ('stage', 'activate', 'rollback', 'block')),
  publisher_actor_id text NOT NULL,
  producer_actor_id text NOT NULL,
  policy_version text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (publisher_actor_id <> producer_actor_id)
);

-- ---------------------------------------------------------------------------
-- Story packets and sentence-level cite maps
-- ---------------------------------------------------------------------------
CREATE TABLE bb_research.story_packets (
  id text PRIMARY KEY,
  case_id text NOT NULL REFERENCES bb_research.cases (id),
  title text NOT NULL,
  prose_draft_artifact_id text NOT NULL REFERENCES bb_research.artifacts (id),
  producer_activity_id text NOT NULL REFERENCES bb_research.agent_activities (id),
  factual_sentence_count integer NOT NULL CHECK (factual_sentence_count >= 0),
  supported_factual_sentence_count integer NOT NULL CHECK (
    supported_factual_sentence_count >= 0
    AND supported_factual_sentence_count <= factual_sentence_count
  ),
  distinct_lineage_checked boolean NOT NULL DEFAULT false,
  rights_checked boolean NOT NULL DEFAULT false,
  entity_links_checked boolean NOT NULL DEFAULT false,
  legal_status_checked boolean NOT NULL DEFAULT false,
  plagiarism_checked boolean NOT NULL DEFAULT false,
  style_checked boolean NOT NULL DEFAULT false,
  approval_lineage_complete boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN (
    'draft', 'audit_ready', 'awaiting_approval', 'approved',
    'rejected', 'released', 'retracted'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.story_packet_claims (
  story_packet_id text NOT NULL REFERENCES bb_research.story_packets (id) ON DELETE CASCADE,
  claim_version_id text NOT NULL REFERENCES bb_canonical.claim_versions (id),
  PRIMARY KEY (story_packet_id, claim_version_id)
);

CREATE TABLE bb_research.story_packet_relationships (
  story_packet_id text NOT NULL REFERENCES bb_research.story_packets (id) ON DELETE CASCADE,
  relationship_id text NOT NULL REFERENCES bb_canonical.entity_relationships (id),
  PRIMARY KEY (story_packet_id, relationship_id)
);

CREATE TABLE bb_research.story_sentences (
  id text PRIMARY KEY,
  story_packet_id text NOT NULL REFERENCES bb_research.story_packets (id) ON DELETE CASCADE,
  sentence_order integer NOT NULL CHECK (sentence_order >= 0),
  sentence_text text NOT NULL,
  factual boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_packet_id, sentence_order)
);

CREATE TABLE bb_research.story_sentence_claims (
  sentence_id text NOT NULL REFERENCES bb_research.story_sentences (id) ON DELETE CASCADE,
  claim_version_id text NOT NULL REFERENCES bb_canonical.claim_versions (id),
  PRIMARY KEY (sentence_id, claim_version_id)
);

CREATE TABLE bb_research.story_sentence_evidence (
  sentence_id text NOT NULL REFERENCES bb_research.story_sentences (id) ON DELETE CASCADE,
  evidence_assignment_id text NOT NULL REFERENCES bb_canonical.evidence_assignments (id),
  PRIMARY KEY (sentence_id, evidence_assignment_id)
);

CREATE TABLE bb_research.story_packet_reviews (
  story_packet_id text NOT NULL REFERENCES bb_research.story_packets (id) ON DELETE CASCADE,
  review_decision_id text NOT NULL REFERENCES bb_research.review_decisions (id),
  PRIMARY KEY (story_packet_id, review_decision_id)
);

-- ---------------------------------------------------------------------------
-- Index every foreign key and the actual worker/reviewer query paths
-- ---------------------------------------------------------------------------
CREATE INDEX source_policies_profile_idx
  ON bb_evidence.source_policies (profile_id, profile_version);
CREATE INDEX evidence_selectors_capture_idx ON bb_evidence.evidence_selectors (capture_id);
CREATE INDEX lineage_clusters_root_capture_idx ON bb_evidence.lineage_clusters (root_capture_id);
CREATE INDEX lineage_cluster_members_capture_idx ON bb_evidence.lineage_cluster_members (capture_id);
CREATE INDEX capture_attributions_capture_idx ON bb_evidence.capture_attributions (from_capture_id);
CREATE INDEX capture_attributions_upstream_idx ON bb_evidence.capture_attributions (upstream_source_item_id);
CREATE INDEX capture_attributions_selector_idx ON bb_evidence.capture_attributions (selector_id) WHERE selector_id IS NOT NULL;
CREATE INDEX claim_qualifiers_claim_version_idx ON bb_canonical.claim_qualifiers (claim_version_id);
CREATE INDEX claim_tombstones_claim_version_idx ON bb_canonical.claim_tombstones (claim_version_id, created_at DESC);
CREATE INDEX claim_tombstones_replacement_idx ON bb_canonical.claim_tombstones (replacement_claim_version_id) WHERE replacement_claim_version_id IS NOT NULL;
CREATE INDEX evidence_assignments_claim_role_idx ON bb_canonical.evidence_assignments (claim_version_id, role, status);
CREATE INDEX evidence_assignments_selector_idx ON bb_canonical.evidence_assignments (selector_id);
CREATE INDEX evidence_assignments_lineage_idx ON bb_canonical.evidence_assignments (lineage_cluster_id, role);
CREATE INDEX evidence_assignments_derived_idx ON bb_canonical.evidence_assignments (derived_from_assignment_id) WHERE derived_from_assignment_id IS NOT NULL;
CREATE INDEX claim_confidence_claim_version_idx ON bb_canonical.claim_confidence_assessments (claim_version_id, created_at DESC);
CREATE INDEX cases_profile_idx ON bb_research.cases (profile_id, profile_version) WHERE profile_id IS NOT NULL;
CREATE INDEX research_questions_case_status_idx ON bb_research.research_questions (case_id, status, priority DESC);
CREATE INDEX hypotheses_question_idx ON bb_research.hypotheses (question_id, status);
CREATE INDEX evidence_needs_question_status_idx ON bb_research.evidence_needs (question_id, status);
CREATE INDEX evidence_needs_assignment_idx ON bb_research.evidence_needs (satisfied_by_assignment_id) WHERE satisfied_by_assignment_id IS NOT NULL;
CREATE INDEX frontier_tasks_case_status_idx ON bb_research.frontier_tasks (case_id, status, score DESC);
CREATE INDEX frontier_tasks_need_idx ON bb_research.frontier_tasks (evidence_need_id) WHERE evidence_need_id IS NOT NULL;
CREATE INDEX frontier_tasks_parent_idx ON bb_research.frontier_tasks (parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX frontier_tasks_ready_idx ON bb_research.frontier_tasks (priority DESC, score DESC, available_at, created_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX frontier_tasks_lease_idx ON bb_research.frontier_tasks (leased_until)
  WHERE status = 'leased';
CREATE INDEX entity_aliases_entity_idx ON bb_canonical.entity_aliases (entity_id);
CREATE INDEX entity_aliases_normalized_trgm_idx ON bb_canonical.entity_aliases USING gin (normalized_alias extensions.gin_trgm_ops);
CREATE INDEX entity_aliases_selector_idx ON bb_canonical.entity_aliases (selector_id) WHERE selector_id IS NOT NULL;
CREATE INDEX entity_identifiers_entity_idx ON bb_canonical.entity_identifiers (entity_id);
CREATE INDEX entity_identifiers_selector_idx ON bb_canonical.entity_identifiers (selector_id) WHERE selector_id IS NOT NULL;
CREATE INDEX entity_candidates_case_idx ON bb_research.entity_candidates (case_id, entity_kind);
CREATE INDEX entity_candidates_selector_idx ON bb_research.entity_candidates (source_selector_id);
CREATE INDEX entity_candidate_names_name_idx ON bb_research.entity_candidate_names (normalized_name);
CREATE INDEX entity_candidate_identifiers_lookup_idx ON bb_research.entity_candidate_identifiers (namespace, value);
CREATE INDEX entity_candidate_blocking_lookup_idx ON bb_research.entity_candidate_blocking_keys (key_type, key_value);
CREATE INDEX resolution_decisions_candidate_idx ON bb_research.resolution_decisions (candidate_id, created_at DESC);
CREATE INDEX resolution_decisions_entity_idx ON bb_research.resolution_decisions (entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX resolution_decisions_reversed_idx ON bb_research.resolution_decisions (reversed_by_decision_id) WHERE reversed_by_decision_id IS NOT NULL;
CREATE INDEX relationship_qualifiers_relationship_idx ON bb_canonical.relationship_qualifiers (relationship_id);
CREATE INDEX runs_case_status_idx ON bb_research.runs (case_id, status, started_at DESC);
CREATE INDEX runs_profile_idx ON bb_research.runs (profile_id, profile_version);
CREATE INDEX agent_activities_run_idx ON bb_research.agent_activities (run_id, started_at);
CREATE INDEX model_invocations_activity_idx ON bb_research.model_invocations (activity_id);
CREATE INDEX model_invocations_repair_idx ON bb_research.model_invocations (repair_of_invocation_id) WHERE repair_of_invocation_id IS NOT NULL;
CREATE INDEX model_invocations_model_benchmark_idx ON bb_research.model_invocations (model_id, benchmark_version, status);
CREATE INDEX model_output_quarantine_retention_idx ON bb_research.model_output_quarantine (retention_until) WHERE NOT legal_hold;
CREATE INDEX artifacts_run_idx ON bb_research.artifacts (run_id, status);
CREATE INDEX artifacts_activity_idx ON bb_research.artifacts (activity_id);
CREATE INDEX artifact_dependencies_used_idx ON bb_research.artifact_dependencies (used_artifact_id);
CREATE INDEX artifact_claims_claim_idx ON bb_research.artifact_claims (claim_version_id);
CREATE INDEX review_decisions_artifact_idx ON bb_research.review_decisions (artifact_id, decided_at DESC);
CREATE INDEX release_decisions_artifact_idx ON bb_publication.release_decisions (artifact_id);
CREATE INDEX release_decisions_release_idx ON bb_publication.release_decisions (release_id, decided_at DESC);
CREATE INDEX release_decisions_review_idx ON bb_publication.release_decisions (review_decision_id);
CREATE INDEX story_packets_case_idx ON bb_research.story_packets (case_id, status);
CREATE INDEX story_packets_artifact_idx ON bb_research.story_packets (prose_draft_artifact_id);
CREATE INDEX story_packets_activity_idx ON bb_research.story_packets (producer_activity_id);
CREATE INDEX story_packet_claims_claim_idx ON bb_research.story_packet_claims (claim_version_id);
CREATE INDEX story_packet_relationships_relationship_idx ON bb_research.story_packet_relationships (relationship_id);
CREATE INDEX story_sentences_packet_idx ON bb_research.story_sentences (story_packet_id, sentence_order);
CREATE INDEX story_sentence_claims_claim_idx ON bb_research.story_sentence_claims (claim_version_id);
CREATE INDEX story_sentence_evidence_assignment_idx ON bb_research.story_sentence_evidence (evidence_assignment_id);
CREATE INDEX story_packet_reviews_review_idx ON bb_research.story_packet_reviews (review_decision_id);
CREATE UNIQUE INDEX outbox_messages_idempotency_key_idx ON bb_ops.outbox_messages (idempotency_key);

-- ---------------------------------------------------------------------------
-- Append-only protection. Corrections and retractions are new rows/tombstones.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bb_ops.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; add a superseding decision or tombstone', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER claim_versions_append_only
  BEFORE UPDATE OR DELETE ON bb_canonical.claim_versions
  FOR EACH ROW EXECUTE FUNCTION bb_ops.reject_append_only_mutation();
CREATE TRIGGER evidence_assignments_append_only
  BEFORE UPDATE OR DELETE ON bb_canonical.evidence_assignments
  FOR EACH ROW EXECUTE FUNCTION bb_ops.reject_append_only_mutation();
CREATE TRIGGER review_decisions_append_only
  BEFORE UPDATE OR DELETE ON bb_research.review_decisions
  FOR EACH ROW EXECUTE FUNCTION bb_ops.reject_append_only_mutation();
CREATE TRIGGER release_decisions_append_only
  BEFORE UPDATE OR DELETE ON bb_publication.release_decisions
  FOR EACH ROW EXECUTE FUNCTION bb_ops.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Scoped worker/reviewer/release RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bb_research.claim_frontier_task(
  p_worker_actor_id text,
  p_lease_seconds integer DEFAULT 300
)
RETURNS SETOF bb_research.frontier_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text := bb_auth.current_role();
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  v_uid text := auth.uid()::text;
BEGIN
  IF v_jwt_role <> 'service_role' AND v_role NOT IN ('admin', 'research') THEN
    RAISE EXCEPTION 'claim_frontier_task denied';
  END IF;
  IF v_uid IS NOT NULL AND p_worker_actor_id <> v_uid THEN
    RAISE EXCEPTION 'worker actor must match authenticated user';
  END IF;
  IF p_lease_seconds < 30 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'lease seconds must be between 30 and 3600';
  END IF;

  RETURN QUERY
  UPDATE bb_research.frontier_tasks AS task
  SET status = 'leased',
      leased_to = p_worker_actor_id,
      lease_token = extensions.gen_random_uuid()::text,
      leased_until = now() + make_interval(secs => p_lease_seconds),
      heartbeat_at = now(),
      attempt_count = task.attempt_count + 1,
      updated_at = now()
  WHERE task.id = (
    SELECT candidate.id
    FROM bb_research.frontier_tasks AS candidate
    WHERE candidate.available_at <= now()
      AND candidate.attempt_count < candidate.max_attempts
      AND (
        candidate.status IN ('pending', 'failed')
        OR (candidate.status = 'leased' AND candidate.leased_until < now())
      )
    ORDER BY candidate.priority DESC, candidate.score DESC, candidate.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING task.*;
END;
$$;

CREATE OR REPLACE FUNCTION bb_research.heartbeat_frontier_task(
  p_task_id text,
  p_worker_actor_id text,
  p_lease_token text,
  p_extend_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
  v_role text := bb_auth.current_role();
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF v_jwt_role <> 'service_role' AND v_role NOT IN ('admin', 'research') THEN
    RAISE EXCEPTION 'heartbeat_frontier_task denied';
  END IF;
  IF auth.uid() IS NOT NULL AND p_worker_actor_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'worker actor must match authenticated user';
  END IF;
  IF p_extend_seconds < 30 OR p_extend_seconds > 3600 THEN
    RAISE EXCEPTION 'extension seconds must be between 30 and 3600';
  END IF;

  UPDATE bb_research.frontier_tasks
  SET heartbeat_at = now(),
      leased_until = now() + make_interval(secs => p_extend_seconds),
      updated_at = now()
  WHERE id = p_task_id
    AND status = 'leased'
    AND leased_to = p_worker_actor_id
    AND lease_token = p_lease_token
    AND leased_until >= now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION bb_research.submit_artifact(
  p_artifact_id text,
  p_run_id text,
  p_activity_id text,
  p_artifact_type text,
  p_content_hash text,
  p_schema_id text,
  p_schema_version text,
  p_storage_uri text,
  p_extensions jsonb,
  p_idempotency_key text
)
RETURNS bb_research.artifacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_artifact bb_research.artifacts;
  v_role text := bb_auth.current_role();
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF v_jwt_role <> 'service_role' AND v_role NOT IN ('admin', 'research') THEN
    RAISE EXCEPTION 'submit_artifact denied';
  END IF;

  INSERT INTO bb_research.artifacts (
    id, run_id, activity_id, artifact_type, content_hash, schema_id,
    schema_version, storage_uri, extensions, status, idempotency_key
  ) VALUES (
    p_artifact_id, p_run_id, p_activity_id, p_artifact_type, p_content_hash,
    p_schema_id, p_schema_version, p_storage_uri, coalesce(p_extensions, '{}'::jsonb),
    'proposed', p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO STRICT v_artifact
  FROM bb_research.artifacts
  WHERE idempotency_key = p_idempotency_key;

  INSERT INTO bb_ops.outbox_messages (
    id, event_id, topic, aggregate_type, aggregate_id, payload, status,
    correlation_id, idempotency_key
  ) VALUES (
    extensions.gen_random_uuid()::text,
    extensions.gen_random_uuid()::text,
    'research.artifact_submitted',
    'artifact',
    v_artifact.id,
    jsonb_build_object('artifactId', v_artifact.id, 'runId', v_artifact.run_id),
    'pending',
    v_artifact.run_id,
    'artifact-submitted:' || p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN v_artifact;
END;
$$;

CREATE OR REPLACE FUNCTION bb_research.finish_frontier_task(
  p_task_id text,
  p_worker_actor_id text,
  p_lease_token text,
  p_succeeded boolean,
  p_error text DEFAULT NULL
)
RETURNS bb_research.frontier_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task bb_research.frontier_tasks;
  v_role text := bb_auth.current_role();
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF v_jwt_role <> 'service_role' AND v_role NOT IN ('admin', 'research') THEN
    RAISE EXCEPTION 'finish_frontier_task denied';
  END IF;
  IF auth.uid() IS NOT NULL AND p_worker_actor_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'worker actor must match authenticated user';
  END IF;

  UPDATE bb_research.frontier_tasks AS task
  SET status = CASE
        WHEN p_succeeded THEN 'completed'
        WHEN task.attempt_count >= task.max_attempts THEN 'dead_letter'
        ELSE 'failed'
      END,
      available_at = CASE
        WHEN p_succeeded OR task.attempt_count >= task.max_attempts THEN task.available_at
        ELSE now() + make_interval(secs => least(task.attempt_count * 30, 900))
      END,
      leased_to = NULL,
      lease_token = NULL,
      leased_until = NULL,
      heartbeat_at = now(),
      last_error = CASE WHEN p_succeeded THEN NULL ELSE p_error END,
      updated_at = now()
  WHERE task.id = p_task_id
    AND task.status = 'leased'
    AND task.leased_to = p_worker_actor_id
    AND task.lease_token = p_lease_token
    AND task.leased_until >= now()
  RETURNING task.* INTO v_task;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task lease is missing, expired, or owned by another worker';
  END IF;

  INSERT INTO bb_ops.outbox_messages (
    id, event_id, topic, aggregate_type, aggregate_id, payload, status,
    correlation_id, idempotency_key
  ) VALUES (
    extensions.gen_random_uuid()::text,
    extensions.gen_random_uuid()::text,
    CASE WHEN p_succeeded THEN 'research.frontier_task_completed'
         ELSE 'research.frontier_task_failed' END,
    'frontier_task',
    v_task.id,
    jsonb_build_object('taskId', v_task.id, 'status', v_task.status, 'attemptCount', v_task.attempt_count),
    'pending',
    v_task.case_id,
    'frontier-finished:' || v_task.id || ':' || v_task.attempt_count::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION bb_research.approve_artifact(
  p_review_id text,
  p_artifact_id text,
  p_reviewer_actor_id text,
  p_reviewer_model_family text,
  p_findings jsonb,
  p_benchmark_version text
)
RETURNS bb_research.review_decisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_review bb_research.review_decisions;
  v_producer_actor_id text;
  v_producer_model_family text;
  v_role text := bb_auth.current_role();
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF v_jwt_role <> 'service_role' AND v_role NOT IN ('admin', 'publication', 'security') THEN
    RAISE EXCEPTION 'approve_artifact denied';
  END IF;
  IF auth.uid() IS NOT NULL AND p_reviewer_actor_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'reviewer actor must match authenticated user';
  END IF;

  SELECT activity.actor_id, activity.model_family
  INTO STRICT v_producer_actor_id, v_producer_model_family
  FROM bb_research.artifacts AS artifact
  JOIN bb_research.agent_activities AS activity ON activity.id = artifact.activity_id
  WHERE artifact.id = p_artifact_id;

  IF p_reviewer_actor_id = v_producer_actor_id THEN
    RAISE EXCEPTION 'self-approval is prohibited';
  END IF;
  IF p_reviewer_model_family IS NOT NULL
     AND v_producer_model_family IS NOT NULL
     AND p_reviewer_model_family = v_producer_model_family THEN
    RAISE EXCEPTION 'review model family must differ from producer family';
  END IF;

  INSERT INTO bb_research.review_decisions (
    id, artifact_id, decision, reviewer_actor_id, reviewer_model_family,
    producer_actor_id, producer_model_family, findings, benchmark_version
  ) VALUES (
    p_review_id, p_artifact_id, 'approve', p_reviewer_actor_id,
    p_reviewer_model_family, v_producer_actor_id, v_producer_model_family,
    coalesce(p_findings, '[]'::jsonb), p_benchmark_version
  ) RETURNING * INTO v_review;

  UPDATE bb_research.artifacts SET status = 'accepted' WHERE id = p_artifact_id;

  INSERT INTO bb_ops.outbox_messages (
    id, event_id, topic, aggregate_type, aggregate_id, payload, status,
    correlation_id, idempotency_key
  ) VALUES (
    extensions.gen_random_uuid()::text,
    extensions.gen_random_uuid()::text,
    'research.artifact_approved',
    'artifact',
    p_artifact_id,
    jsonb_build_object('artifactId', p_artifact_id, 'reviewId', p_review_id),
    'pending',
    p_artifact_id,
    'artifact-approved:' || p_review_id
  );

  RETURN v_review;
END;
$$;

CREATE OR REPLACE FUNCTION bb_publication.activate_research_release(
  p_release_id text,
  p_release_decision_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text := bb_auth.current_role();
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF v_jwt_role <> 'service_role' AND v_role NOT IN ('admin', 'publication') THEN
    RAISE EXCEPTION 'activate_research_release denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM bb_publication.release_decisions AS release_decision
    JOIN bb_research.review_decisions AS review
      ON review.id = release_decision.review_decision_id
    JOIN bb_research.artifacts AS artifact
      ON artifact.id = release_decision.artifact_id
    WHERE release_decision.id = p_release_decision_id
      AND release_decision.release_id = p_release_id
      AND release_decision.decision = 'activate'
      AND review.decision = 'approve'
      AND artifact.status = 'accepted'
      AND release_decision.publisher_actor_id <> release_decision.producer_actor_id
      AND review.reviewer_actor_id <> review.producer_actor_id
      AND (
        review.reviewer_model_family IS NULL OR review.producer_model_family IS NULL
        OR review.reviewer_model_family <> review.producer_model_family
      )
  ) THEN
    RAISE EXCEPTION 'release lacks an independent accepted approval lineage';
  END IF;

  PERFORM bb_publication.activate_release(p_release_id);
END;
$$;

REVOKE ALL ON FUNCTION bb_research.claim_frontier_task(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bb_research.heartbeat_frontier_task(text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bb_research.finish_frontier_task(text, text, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bb_research.submit_artifact(text, text, text, text, text, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bb_research.approve_artifact(text, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bb_publication.activate_research_release(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION bb_research.claim_frontier_task(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_research.heartbeat_frontier_task(text, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_research.finish_frontier_task(text, text, text, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_research.submit_artifact(text, text, text, text, text, text, text, text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_research.approve_artifact(text, text, text, text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_publication.activate_research_release(text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS and least-privilege grants for every new table
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname IN ('bb_research', 'bb_evidence', 'bb_canonical', 'bb_publication')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schema_name, r.table_name);
  END LOOP;
END $$;

CREATE POLICY research_profiles_staff_select ON bb_research.research_profiles
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY research_questions_staff_select ON bb_research.research_questions
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY hypotheses_staff_select ON bb_research.hypotheses
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY evidence_needs_staff_select ON bb_research.evidence_needs
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY frontier_tasks_staff_select ON bb_research.frontier_tasks
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY entity_candidates_staff_select ON bb_research.entity_candidates
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY entity_candidate_names_staff_select ON bb_research.entity_candidate_names
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY entity_candidate_identifiers_staff_select ON bb_research.entity_candidate_identifiers
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY entity_candidate_blocking_staff_select ON bb_research.entity_candidate_blocking_keys
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY resolution_decisions_staff_select ON bb_research.resolution_decisions
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY resolution_hard_stops_staff_select ON bb_research.resolution_decision_hard_stops
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY runs_staff_select ON bb_research.runs
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY agent_activities_staff_select ON bb_research.agent_activities
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY model_invocations_staff_select ON bb_research.model_invocations
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.has_any_role('admin', 'research', 'security')));
CREATE POLICY model_quarantine_security_select ON bb_research.model_output_quarantine
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.has_any_role('admin', 'security')));
CREATE POLICY artifacts_staff_select ON bb_research.artifacts
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY artifact_dependencies_staff_select ON bb_research.artifact_dependencies
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY artifact_claims_staff_select ON bb_research.artifact_claims
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY review_decisions_staff_select ON bb_research.review_decisions
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY story_packets_staff_select ON bb_research.story_packets
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY story_packet_claims_staff_select ON bb_research.story_packet_claims
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY story_packet_relationships_staff_select ON bb_research.story_packet_relationships
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY story_sentences_staff_select ON bb_research.story_sentences
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY story_sentence_claims_staff_select ON bb_research.story_sentence_claims
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY story_sentence_evidence_staff_select ON bb_research.story_sentence_evidence
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));
CREATE POLICY story_packet_reviews_staff_select ON bb_research.story_packet_reviews
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));

CREATE POLICY source_policies_staff_select ON bb_evidence.source_policies
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY source_policy_fitness_staff_select ON bb_evidence.source_policy_claim_fitness
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY evidence_selectors_staff_select ON bb_evidence.evidence_selectors
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY lineage_clusters_staff_select ON bb_evidence.lineage_clusters
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY lineage_members_staff_select ON bb_evidence.lineage_cluster_members
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY capture_attributions_staff_select ON bb_evidence.capture_attributions
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));

CREATE POLICY claim_qualifiers_staff_select ON bb_canonical.claim_qualifiers
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY claim_tombstones_staff_select ON bb_canonical.claim_tombstones
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY evidence_assignments_staff_select ON bb_canonical.evidence_assignments
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY claim_confidence_staff_select ON bb_canonical.claim_confidence_assessments
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY entity_aliases_staff_select ON bb_canonical.entity_aliases
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY entity_identifiers_staff_select ON bb_canonical.entity_identifiers
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));
CREATE POLICY relationship_qualifiers_staff_select ON bb_canonical.relationship_qualifiers
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));

CREATE POLICY release_decisions_staff_select ON bb_publication.release_decisions
  FOR SELECT TO authenticated USING ((SELECT bb_auth.is_staff()));

GRANT SELECT ON bb_research.research_profiles, bb_research.research_questions,
  bb_research.hypotheses, bb_research.evidence_needs, bb_research.frontier_tasks,
  bb_research.entity_candidates, bb_research.entity_candidate_names,
  bb_research.entity_candidate_identifiers, bb_research.entity_candidate_blocking_keys,
  bb_research.resolution_decisions, bb_research.resolution_decision_hard_stops,
  bb_research.runs, bb_research.agent_activities, bb_research.model_invocations,
  bb_research.model_output_quarantine, bb_research.artifacts,
  bb_research.artifact_dependencies, bb_research.artifact_claims,
  bb_research.review_decisions, bb_research.story_packets,
  bb_research.story_packet_claims, bb_research.story_packet_relationships,
  bb_research.story_sentences, bb_research.story_sentence_claims,
  bb_research.story_sentence_evidence, bb_research.story_packet_reviews
TO authenticated;

GRANT SELECT ON bb_evidence.source_policies, bb_evidence.source_policy_claim_fitness,
  bb_evidence.evidence_selectors, bb_evidence.lineage_clusters,
  bb_evidence.lineage_cluster_members, bb_evidence.capture_attributions
TO authenticated;

GRANT SELECT ON bb_canonical.claim_qualifiers, bb_canonical.claim_tombstones,
  bb_canonical.evidence_assignments, bb_canonical.claim_confidence_assessments,
  bb_canonical.entity_aliases, bb_canonical.entity_identifiers,
  bb_canonical.relationship_qualifiers
TO authenticated;

GRANT SELECT ON bb_publication.release_decisions TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA bb_research TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA bb_evidence TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA bb_canonical TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA bb_publication TO service_role;

REVOKE INSERT, UPDATE, DELETE ON bb_research.research_profiles,
  bb_research.research_questions, bb_research.hypotheses, bb_research.evidence_needs,
  bb_research.frontier_tasks, bb_research.entity_candidates,
  bb_research.entity_candidate_names, bb_research.entity_candidate_identifiers,
  bb_research.entity_candidate_blocking_keys, bb_research.resolution_decisions,
  bb_research.resolution_decision_hard_stops, bb_research.runs,
  bb_research.agent_activities, bb_research.model_invocations,
  bb_research.model_output_quarantine, bb_research.artifacts,
  bb_research.artifact_dependencies, bb_research.artifact_claims,
  bb_research.review_decisions, bb_research.story_packets,
  bb_research.story_packet_claims, bb_research.story_packet_relationships,
  bb_research.story_sentences, bb_research.story_sentence_claims,
  bb_research.story_sentence_evidence, bb_research.story_packet_reviews
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON bb_publication.release_decisions FROM authenticated;
REVOKE UPDATE, DELETE ON bb_canonical.claim_versions,
  bb_canonical.evidence_assignments, bb_research.review_decisions,
  bb_publication.release_decisions
FROM PUBLIC, anon, authenticated;
