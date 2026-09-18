-- Theme-impact packets: composable public answers to canonical questions (Q1–Q9).
-- Stores presentation + refs over shared bb_reference stats / evidence — not duplicate
-- observation rows. Juxtaposition ≠ causation; anon reads published rows only.

CREATE TABLE IF NOT EXISTS bb_reference.theme_impact_packets (
  id text PRIMARY KEY,
  question_id text NOT NULL,
  theme_id text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  policy_eras text[] NOT NULL DEFAULT '{}'::text[],
  geography jsonb NOT NULL,
  method_stance text NOT NULL CHECK (method_stance IN ('juxtaposition', 'gated_causal_claim')),
  method_note text NOT NULL,
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  derived jsonb NOT NULL DEFAULT '[]'::jsonb,
  artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  gap_states text[] NOT NULL DEFAULT '{}'::text[],
  entity_id text,
  binding_purpose text CHECK (
    binding_purpose IS NULL
    OR binding_purpose IN ('map_panel', 'story', 'research', 'mcp')
  ),
  status text NOT NULL CHECK (status IN ('draft', 'review', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theme_impact_packets_entity_binding_chk CHECK (
    (entity_id IS NULL AND binding_purpose IS NULL)
    OR (entity_id IS NOT NULL AND binding_purpose IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS theme_impact_packets_theme_id_idx
  ON bb_reference.theme_impact_packets (theme_id);

CREATE INDEX IF NOT EXISTS theme_impact_packets_question_id_idx
  ON bb_reference.theme_impact_packets (question_id);

CREATE INDEX IF NOT EXISTS theme_impact_packets_status_idx
  ON bb_reference.theme_impact_packets (status);

CREATE INDEX IF NOT EXISTS theme_impact_packets_entity_id_idx
  ON bb_reference.theme_impact_packets (entity_id);

COMMENT ON TABLE bb_reference.theme_impact_packets IS
  'ThemeImpactPacket rows: canonical question answers composing stats/evidence refs. '
  'method_stance defaults to juxtaposition in product code; gated_causal_claim requires claim ids. '
  'Juxtaposition ≠ causation — see docs/methodology/juxtaposition-not-causation.md and ADR-029.';

ALTER TABLE bb_reference.theme_impact_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY theme_impact_packets_select_published
  ON bb_reference.theme_impact_packets
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY theme_impact_packets_select_staff
  ON bb_reference.theme_impact_packets
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));
