-- 0007_research: cases with normalized history and checklist.

CREATE TABLE bb_research.cases (
  id text PRIMARY KEY,
  state text NOT NULL CHECK (state IN (
    'candidate', 'relevance_review', 'relevance_confirmed', 'minimum_record',
    'partial_enrichment', 'substantial_enrichment', 'insufficient_evidence',
    'excluded', 'merged', 'retracted'
  )),
  candidate_id text NOT NULL,
  title text NOT NULL,
  relevance_assessment jsonb,
  assignment jsonb,
  publication jsonb,
  retraction jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.case_history_events (
  id bigserial PRIMARY KEY,
  case_id text NOT NULL REFERENCES bb_research.cases (id) ON DELETE CASCADE,
  from_state text NOT NULL,
  to_state text NOT NULL,
  reason_code text NOT NULL,
  reason text,
  actor_id text NOT NULL,
  evidence_ids text[] NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE bb_research.case_checklist_items (
  id bigserial PRIMARY KEY,
  case_id text NOT NULL REFERENCES bb_research.cases (id) ON DELETE CASCADE,
  key text NOT NULL,
  complete boolean NOT NULL DEFAULT false,
  evidence_ids text[] NOT NULL DEFAULT '{}',
  note text,
  UNIQUE (case_id, key)
);
