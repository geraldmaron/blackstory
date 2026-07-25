-- Chicago redlining pilot: Bronzeville entity ↔ Cook County ACS metrics.
-- Juxtaposition only — not causal. Replay-safe upsert.

INSERT INTO bb_reference.entity_context_bindings (id, entity_id, metric_id, purpose, jurisdiction_id, notes) VALUES
('ecb_bronzeville_homeownership_map', 'ent_bronzeville_001', 'acs-homeownership-rate-black-county', 'map_panel', 'county:17031', 'Chicago redlining pilot: Bronzeville juxtaposed with Cook County Black homeownership (ACS). Not causal.'),
('ecb_bronzeville_homeownership_story', 'ent_bronzeville_001', 'acs-homeownership-rate-black-county', 'story', 'county:17031', 'Chicago redlining pilot: story-surface binding for Cook County Black homeownership beside Bronzeville.'),
('ecb_bronzeville_income_map', 'ent_bronzeville_001', 'acs-median-hh-income-black-county', 'map_panel', 'county:17031', 'Chicago redlining pilot: Cook County Black median HH income context for Bronzeville map panel.'),
('ecb_bronzeville_income_story', 'ent_bronzeville_001', 'acs-median-hh-income-black-county', 'story', 'county:17031', 'Chicago redlining pilot: story-surface income context for Bronzeville.'),
('ecb_bronzeville_popshare_map', 'ent_bronzeville_001', 'acs-black-population-share-county', 'map_panel', 'county:17031', 'Chicago redlining pilot: Cook County Black population share beside Bronzeville.'),
('ecb_bronzeville_poverty_story', 'ent_bronzeville_001', 'acs-poverty-rate-black-county', 'story', 'county:17031', 'Chicago redlining pilot: Cook County Black poverty rate beside Bronzeville narrative.')
ON CONFLICT (entity_id, metric_id, purpose, jurisdiction_id) DO UPDATE SET
  notes = EXCLUDED.notes,
  updated_at = now();

UPDATE bb_reference.theme_impact_packets
SET entity_id = 'ent_bronzeville_001',
    binding_purpose = 'story',
    updated_at = now()
WHERE id = 'tip_chicago_redlining_q4';
