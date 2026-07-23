-- Consolidate overlapping permissive SELECT policies on bb_reference tables
-- (lint multiple_permissive_policies). Access model unchanged: open geographies /
-- published packets for anon+authenticated; staff roles also see tract rows /
-- draft-or-review packets.

DROP POLICY IF EXISTS statistical_observations_select_open
  ON bb_reference.statistical_observations;
DROP POLICY IF EXISTS statistical_observations_select_staff_tract
  ON bb_reference.statistical_observations;

CREATE POLICY statistical_observations_select
  ON bb_reference.statistical_observations
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bb_reference.statistical_series s
      WHERE s.metric_id = statistical_observations.metric_id
        AND s.geography_type IN ('county', 'state', 'nation')
    )
    OR (
      bb_auth.has_any_role('admin', 'research', 'publication')
      AND EXISTS (
        SELECT 1 FROM bb_reference.statistical_series s
        WHERE s.metric_id = statistical_observations.metric_id
          AND s.geography_type IN (
            'tract', 'block', 'blockgroup', 'address', 'facility', 'school', 'city'
          )
      )
    )
  );

DROP POLICY IF EXISTS theme_impact_packets_select_published
  ON bb_reference.theme_impact_packets;
DROP POLICY IF EXISTS theme_impact_packets_select_staff
  ON bb_reference.theme_impact_packets;

CREATE POLICY theme_impact_packets_select
  ON bb_reference.theme_impact_packets
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    OR bb_auth.has_any_role('admin', 'research', 'publication')
  );
