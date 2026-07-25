-- Refresh Q3 Cook redlining packet: attach warehouse HMDA denial-rate observations
-- (Cook County 17031, 2022–2023) and remove the HMDA gap placeholder artifact.
-- Run after ingest-phase1-hmda-aggregates has loaded statistical_observations.
-- Juxtaposition only — gap_states retains insufficient_evidence for NHGIS/wealth/era deltas.

UPDATE bb_reference.theme_impact_packets
SET
  method_note = 'Indicators and HOLC-era history are shown together for context. HMDA county denial rates (2022–2023) are loaded from warehouse aggregates; decennial era deltas, national wealth series, and rights-gated map metrics remain gap-labeled. Juxtaposition is not causation.',
  observations = observations || '[
    {"observationId":"obs:hmda-denial-rate-black-county:county:17031:2022","metricId":"hmda-denial-rate-black-county","estimate":10.9,"unit":"percent","referencePeriod":"2022","label":"HMDA denial rate (Black applicants, Cook County)","provenance":{"source":"hmda-loan-level","sourceUrl":"https://ffiec.cfpb.gov/data-browser/","retrievedAt":"2026-07-22T22:00:00.000Z","contentHash":"8987278807a8b37cdad0289e0f6c45ce0e95511f6698914cc0cae668a935d7da","humanCitation":"FFIEC HMDA Data Browser county aggregations (derived_race), Cook County IL, 2022."}},
    {"observationId":"obs:hmda-denial-rate-white-county:county:17031:2022","metricId":"hmda-denial-rate-white-county","estimate":6.5,"unit":"percent","referencePeriod":"2022","label":"HMDA denial rate (White applicants, Cook County)","provenance":{"source":"hmda-loan-level","sourceUrl":"https://ffiec.cfpb.gov/data-browser/","retrievedAt":"2026-07-22T22:00:00.000Z","contentHash":"7ae3c1be6745b19e640c124d8ae1610fbf75f0025beaca73f6cd74073ce8553b","humanCitation":"FFIEC HMDA Data Browser county aggregations (derived_race), Cook County IL, 2022."}},
    {"observationId":"obs:hmda-denial-rate-gap-black-white-county:county:17031:2022","metricId":"hmda-denial-rate-gap-black-white-county","estimate":4.4,"unit":"percent","referencePeriod":"2022","label":"HMDA Black–White denial rate gap (Cook County)","provenance":{"source":"hmda-loan-level","sourceUrl":"https://ffiec.cfpb.gov/data-browser/","retrievedAt":"2026-07-22T22:00:00.000Z","contentHash":"76b897581ff7e2c7f3a45fa306de1142867e9dc06ed0cd6cba44d76f1ae6e2d5","humanCitation":"Derived from HMDA county aggregations: Black minus White denial rate, Cook County IL, 2022."}},
    {"observationId":"obs:hmda-denial-rate-black-county:county:17031:2023","metricId":"hmda-denial-rate-black-county","estimate":11.1,"unit":"percent","referencePeriod":"2023","label":"HMDA denial rate (Black applicants, Cook County)","provenance":{"source":"hmda-loan-level","sourceUrl":"https://ffiec.cfpb.gov/data-browser/","retrievedAt":"2026-07-22T22:00:00.000Z","contentHash":"7b6da63ecb1272f5dd76ac599f789df9e8068b99c8a1d52bd1222a2be259ae9b","humanCitation":"FFIEC HMDA Data Browser county aggregations (derived_race), Cook County IL, 2023."}},
    {"observationId":"obs:hmda-denial-rate-white-county:county:17031:2023","metricId":"hmda-denial-rate-white-county","estimate":7.2,"unit":"percent","referencePeriod":"2023","label":"HMDA denial rate (White applicants, Cook County)","provenance":{"source":"hmda-loan-level","sourceUrl":"https://ffiec.cfpb.gov/data-browser/","retrievedAt":"2026-07-22T22:00:00.000Z","contentHash":"b4217e3949df806482a3c57d02c489e6d632e1bfd4c6049ebbd95db398333a9a","humanCitation":"FFIEC HMDA Data Browser county aggregations (derived_race), Cook County IL, 2023."}},
    {"observationId":"obs:hmda-denial-rate-gap-black-white-county:county:17031:2023","metricId":"hmda-denial-rate-gap-black-white-county","estimate":3.9,"unit":"percent","referencePeriod":"2023","label":"HMDA Black–White denial rate gap (Cook County)","provenance":{"source":"hmda-loan-level","sourceUrl":"https://ffiec.cfpb.gov/data-browser/","retrievedAt":"2026-07-22T22:00:00.000Z","contentHash":"34ccc28a3375e30cc7dddd3cfa60f63c522d700b661ad4605280f21961cb7f51","humanCitation":"Derived from HMDA county aggregations: Black minus White denial rate, Cook County IL, 2023."}}
  ]'::jsonb,
  artifacts = COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(artifacts) AS elem
      WHERE elem->>'artifactId' <> 'art_hmda_gap'
    ),
    '[]'::jsonb
  ) || '[{"artifactId":"art_hmda_cook_aggregates","artifactClass":"scholarly_partner_table","title":"HMDA county denial aggregates (Cook County)","citation":"FFIEC HMDA Data Browser /view/aggregations — derived_race denial rates; loan-level rows not stored.","sourceUrl":"https://ffiec.cfpb.gov/data-browser/","summary":"County-level denial rates for Black and White applicants, 2022–2023, juxtaposed beside housing-credit policy eras."}]'::jsonb,
  gap_states = ARRAY['insufficient_evidence']::text[],
  updated_at = now()
WHERE id = 'tip_chicago_redlining_q3'
RETURNING id, jsonb_array_length(observations) AS observation_count;
