-- RLS permits anon/authenticated reads of published packets, but PostgreSQL
-- table privileges are a separate gate. The table was created after the
-- schema-wide reference grants, so grant its intended read privilege directly.

GRANT SELECT ON bb_reference.theme_impact_packets
  TO anon, authenticated, service_role;
