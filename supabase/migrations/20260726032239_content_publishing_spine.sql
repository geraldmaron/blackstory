-- Content publishing spine: DB-driven theme catalog + release projections for
-- theme-impact packets. bb_reference.theme_impact_packets stays the authoring table;
-- bb_public carries frozen, release-scoped projections behind active-release RLS.

CREATE TABLE IF NOT EXISTS bb_reference.themes (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  title text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'archived')),
  presentation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bb_reference.themes IS
  'Theme catalog (authoring). Projected into bb_public.release_themes on publish; the app never reads this table directly.';

ALTER TABLE bb_reference.themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY themes_select_staff ON bb_reference.themes
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE TABLE IF NOT EXISTS bb_public.release_themes (
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  theme_id text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, theme_id)
);

COMMENT ON TABLE bb_public.release_themes IS
  'Frozen theme-catalog projection per release. Insert-only per release; rollback switches the active_release pointer.';

ALTER TABLE bb_public.release_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY release_themes_select_active ON bb_public.release_themes
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

REVOKE UPDATE, DELETE ON bb_public.release_themes FROM PUBLIC, anon, authenticated;

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
  'Frozen ThemeImpactPacket projections per release. payload is the full public packet document; content_hash guards drift audits against bb_reference.theme_impact_packets.';

ALTER TABLE bb_public.release_theme_impact_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY release_theme_impact_packets_select_active
  ON bb_public.release_theme_impact_packets
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

REVOKE UPDATE, DELETE ON bb_public.release_theme_impact_packets
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON bb_public.release_themes,
                bb_public.release_theme_impact_packets TO anon, authenticated;
