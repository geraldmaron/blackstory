-- Persist gated causal claim ids on theme-impact packets (round-trip with domain packets).

ALTER TABLE bb_reference.theme_impact_packets
  ADD COLUMN IF NOT EXISTS causal_claim_ids text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN bb_reference.theme_impact_packets.causal_claim_ids IS
  'Optional heritage/systemic claim ids required when method_stance = gated_causal_claim. '
  'Empty for juxtaposition packets.';
