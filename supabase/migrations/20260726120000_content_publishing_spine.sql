-- Content publishing spine: release projection for theme-impact packets.
-- Implements the ADR-004 promote target from
-- docs/research/theme-impact-packet-system.md §4.1. bb_reference.theme_impact_packets
-- stays the authoring table (draft/review/published); bb_public carries frozen,
-- release-scoped projections that anon reads through the active-release RLS pattern.
-- The theme catalog deliberately stays in code: theme ids are structurally coupled
-- to the domain enum, question registry, and routes, so a catalog table would be a
-- second source of truth, not a decoupling.

CREATE TABLE IF NOT EXISTS bb_public.release_theme_impact_packets (
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  packet_id text NOT NULL,
  theme_id text NOT NULL,
  question_id text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, packet_id)
);

CREATE INDEX IF NOT EXISTS release_theme_impact_packets_theme_idx
  ON bb_public.release_theme_impact_packets (release_id, theme_id, question_id);

COMMENT ON TABLE bb_public.release_theme_impact_packets IS
  'Frozen ThemeImpactPacket projections per release. payload is the full public '
  'packet document; content_hash guards drift audits against '
  'bb_reference.theme_impact_packets.';

ALTER TABLE bb_public.release_theme_impact_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY release_theme_impact_packets_select_active
  ON bb_public.release_theme_impact_packets
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

REVOKE UPDATE, DELETE ON bb_public.release_theme_impact_packets
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON bb_public.release_theme_impact_packets TO anon, authenticated;
