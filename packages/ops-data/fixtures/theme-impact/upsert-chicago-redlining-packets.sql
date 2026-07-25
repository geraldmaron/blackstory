INSERT INTO bb_reference.theme_impact_packets (
  id, question_id, theme_id, title, summary, policy_eras, geography,
  method_stance, method_note, observations, derived, artifacts, gap_states, status, created_at, updated_at
) VALUES (
  'tip_chicago_redlining_q1',
  'Q1',
  'redlining',
  'How federal redlining practices took shape',
  'HOLC residential security maps and FHA underwriting in the 1930s graded neighborhoods and shaped mortgage access. This packet assembles dated artifacts for Chicago-metro context — not a causal model of later outcomes.',
  ARRAY['holc_fha']::text[],
  '{"geographyType":"city","jurisdictionId":"county:17031","boundaryVersion":"county-2020","label":"Chicago metro pilot (Cook County spine)","scopeKey":"metro:chicago-il"}'::jsonb,
  'juxtaposition',
  'Indicators and HOLC-era history are shown together for context. Juxtaposition is not causation.',
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"artifactId":"art_holc_program_origin","artifactClass":"primary_government_document","title":"Home Owners’ Loan Corporation residential security mapping (1935–1940)","dated":"1935-1940","citation":"Federal HOLC residential security maps (NARA holdings); overview via Mapping Inequality (University of Richmond DSL).","sourceUrl":"https://dsl.richmond.edu/panorama/redlining/","uncertaintyLabel":"Program history is national; local sheet dates vary by city."},{"artifactId":"art_fha_underwriting","artifactClass":"primary_government_document","title":"FHA Underwriting Manual race and neighborhood risk language (1930s–1940s)","dated":"1938","citation":"Federal Housing Administration Underwriting Manual (period editions); cited in secondary historical syntheses of mortgage redlining.","uncertaintyLabel":"Manual editions changed; quote from a specific edition when advancing a claim."},{"artifactId":"art_fair_housing_1968","artifactClass":"primary_government_document","title":"Fair Housing Act (1968)","dated":"1968-04-11","citation":"Civil Rights Act of 1968, Title VIII — Fair Housing Act, 42 U.S.C. §§ 3601 et seq.","sourceUrl":"https://www.justice.gov/crt/fair-housing-act-1"}]'::jsonb,
  ARRAY[]::text[],
  'published',
  '2026-07-22T20:00:00.000Z'::timestamptz,
  '2026-07-22T20:00:00.000Z'::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  question_id = EXCLUDED.question_id,
  theme_id = EXCLUDED.theme_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  policy_eras = EXCLUDED.policy_eras,
  geography = EXCLUDED.geography,
  method_stance = EXCLUDED.method_stance,
  method_note = EXCLUDED.method_note,
  observations = EXCLUDED.observations,
  derived = EXCLUDED.derived,
  artifacts = EXCLUDED.artifacts,
  gap_states = EXCLUDED.gap_states,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

INSERT INTO bb_reference.theme_impact_packets (
  id, question_id, theme_id, title, summary, policy_eras, geography,
  method_stance, method_note, observations, derived, artifacts, gap_states, status, created_at, updated_at
) VALUES (
  'tip_chicago_redlining_q2',
  'Q2',
  'redlining',
  'HOLC grades in Chicago (inventory counts)',
  'Staff inventory of Mapping Inequality HOLC polygons tagged to Chicago: A 48, B 160, C 326, D 147 (703 areas). Public map polygons remain rights-gated (CC BY-NC-SA); this packet cites grade counts and attribution only.',
  ARRAY['holc_fha']::text[],
  '{"geographyType":"city","boundaryVersion":"mapping-inequality-holc-v1","label":"Chicago HOLC sheets (Mapping Inequality inventory)","scopeKey":"metro:chicago-il"}'::jsonb,
  'juxtaposition',
  'Indicators and HOLC-era history are shown together for context. Juxtaposition is not causation.',
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"artifactId":"art_mapping_inequality_chicago","artifactClass":"cartographic_grade_map","title":"Mapping Inequality — Chicago HOLC maps","dated":"1935-1940","citation":"Nelson, Winling, et al., Mapping Inequality: Redlining in New Deal America. University of Richmond DSL. https://dsl.richmond.edu/panorama/redlining/","sourceUrl":"https://dsl.richmond.edu/panorama/redlining/","summary":"Staff inventory of Chicago-tagged HOLC areas: A 48, B 160, C 326, D 147 (703 total). Inventory counts only — not a public polygon product.","uncertaintyLabel":"Vector derivatives are CC BY-NC-SA 4.0. Public commercial surfaces cite only; polygon map product awaits rights review."}]'::jsonb,
  ARRAY['insufficient_evidence']::text[],
  'published',
  '2026-07-22T20:00:00.000Z'::timestamptz,
  '2026-07-22T20:00:00.000Z'::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  question_id = EXCLUDED.question_id,
  theme_id = EXCLUDED.theme_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  policy_eras = EXCLUDED.policy_eras,
  geography = EXCLUDED.geography,
  method_stance = EXCLUDED.method_stance,
  method_note = EXCLUDED.method_note,
  observations = EXCLUDED.observations,
  derived = EXCLUDED.derived,
  artifacts = EXCLUDED.artifacts,
  gap_states = EXCLUDED.gap_states,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

INSERT INTO bb_reference.theme_impact_packets (
  id, question_id, theme_id, title, summary, policy_eras, geography,
  method_stance, method_note, observations, derived, artifacts, gap_states, status, created_at, updated_at
) VALUES (
  'tip_chicago_redlining_q3',
  'Q3',
  'redlining',
  'Cook County housing and income indicators beside redlining eras',
  'ACS 2020–2024 Cook County readings for Black homeownership, income, poverty, and population share, shown across housing-credit policy eras for juxtaposition — not proof that HOLC grades alone caused present gaps.',
  ARRAY['holc_fha','fair_housing','cra_contemporary']::text[],
  '{"geographyType":"county","jurisdictionId":"county:17031","boundaryVersion":"county-2020","label":"Cook County, IL","scopeKey":"metro:chicago-il"}'::jsonb,
  'juxtaposition',
  'Indicators and HOLC-era history are shown together for context. Juxtaposition is not causation.',
  '[{"observationId":"obs:acs-homeownership-rate-black-county:county:17031:2020-2024","metricId":"acs-homeownership-rate-black-county","estimate":41.5,"unit":"percent","referencePeriod":"2020-2024","label":"Black homeownership rate","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"a5401ce177953edcbb9f3349204243696d836ed7fffb3d96a0ed3946a771f0f3","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}},{"observationId":"obs:acs-median-hh-income-black-county:county:17031:2020-2024","metricId":"acs-median-hh-income-black-county","estimate":51523,"unit":"USD","referencePeriod":"2020-2024","label":"Median household income (Black householders)","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"64d710dd502f77b3f89ed7727b3b8915868311d675af55b930dcd2bd9c235a19","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}},{"observationId":"obs:acs-median-hh-income-white-county:county:17031:2020-2024","metricId":"acs-median-hh-income-white-county","estimate":102809,"unit":"USD","referencePeriod":"2020-2024","label":"Median household income (White householders)","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"a5ba0cb4f6fd2695b00f4fc5767e6cdf32fcd084377c27171b32f018bb330a42","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}},{"observationId":"obs:acs-poverty-rate-black-county:county:17031:2020-2024","metricId":"acs-poverty-rate-black-county","estimate":23.9,"unit":"percent","referencePeriod":"2020-2024","label":"Poverty rate (Black population)","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"587a89b606a1dc77913822750b501ccb959d28a1bdc9690ddf5eaf4095a35bba","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}},{"observationId":"obs:acs-black-population-share-county:county:17031:2020-2024","metricId":"acs-black-population-share-county","estimate":22.2,"unit":"percent","referencePeriod":"2020-2024","label":"Black population share","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"2d39628107fb015dbf6c71829c4dbe533ab4bbbf0a74f2967a82bb4661d29657","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}},{"observationId":"obs:acs-ba-attainment-black-county:county:17031:2020-2024","metricId":"acs-ba-attainment-black-county","estimate":26.8,"unit":"percent","referencePeriod":"2020-2024","label":"Bachelor’s degree or higher (Black adults 25+)","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"935f92f822e6ba27e58effde24aa7b3d9ad5e39f33b6e29ea3b5a9235490b22b","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}}]'::jsonb,
  '[{"derivedId":"der_cook_black_white_income_gap_2020_2024","methodId":"black_white_income_gap","value":-51286,"unit":"USD","status":"derived","formula":"acs-median-hh-income-black-county - acs-median-hh-income-white-county","inputObservationIds":["obs:acs-median-hh-income-black-county:county:17031:2020-2024","obs:acs-median-hh-income-white-county:county:17031:2020-2024"],"label":"Black–White median household income gap (Cook County)","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"sha256:derived-cook-income-gap-64d710dd502f77b3-a5ba0cb4f6fd2695","humanCitation":"Derived from ACS 2020–2024 5-Year B19013B and B19013A for Cook County, IL."}}]'::jsonb,
  '[{"artifactId":"art_hmda_gap","artifactClass":"scholarly_partner_table","title":"HMDA lending aggregates (not yet loaded for this pilot)","citation":"Home Mortgage Disclosure Act aggregates — gap until county denial rates are ingested.","uncertaintyLabel":"Series pending; see gap_states."}]'::jsonb,
  ARRAY['insufficient_evidence']::text[],
  'published',
  '2026-07-22T20:00:00.000Z'::timestamptz,
  '2026-07-22T20:00:00.000Z'::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  question_id = EXCLUDED.question_id,
  theme_id = EXCLUDED.theme_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  policy_eras = EXCLUDED.policy_eras,
  geography = EXCLUDED.geography,
  method_stance = EXCLUDED.method_stance,
  method_note = EXCLUDED.method_note,
  observations = EXCLUDED.observations,
  derived = EXCLUDED.derived,
  artifacts = EXCLUDED.artifacts,
  gap_states = EXCLUDED.gap_states,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

INSERT INTO bb_reference.theme_impact_packets (
  id, question_id, theme_id, title, summary, policy_eras, geography,
  method_stance, method_note, observations, derived, artifacts, gap_states, status, created_at, updated_at
) VALUES (
  'tip_chicago_redlining_q4',
  'Q4',
  'redlining',
  'What followed in Cook County for Black residents (place spine)',
  'Place-level narrative spine for the Chicago pilot: contemporary ACS indicators for Cook County beside HOLC-era map citations. Entity bindings can attach graded neighborhoods as curation continues.',
  ARRAY['holc_fha','fair_housing','cra_contemporary']::text[],
  '{"geographyType":"county","jurisdictionId":"county:17031","boundaryVersion":"county-2020","label":"Cook County, IL (Chicago metro pilot spine)","scopeKey":"metro:chicago-il"}'::jsonb,
  'juxtaposition',
  'Indicators and HOLC-era history are shown together for context. Juxtaposition is not causation.',
  '[{"observationId":"obs:acs-homeownership-rate-black-county:county:17031:2020-2024","metricId":"acs-homeownership-rate-black-county","estimate":41.5,"unit":"percent","referencePeriod":"2020-2024","label":"Black homeownership rate","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"a5401ce177953edcbb9f3349204243696d836ed7fffb3d96a0ed3946a771f0f3","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}},{"observationId":"obs:acs-median-hh-income-black-county:county:17031:2020-2024","metricId":"acs-median-hh-income-black-county","estimate":51523,"unit":"USD","referencePeriod":"2020-2024","label":"Median household income (Black householders)","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"64d710dd502f77b3f89ed7727b3b8915868311d675af55b930dcd2bd9c235a19","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}},{"observationId":"obs:acs-poverty-rate-black-county:county:17031:2020-2024","metricId":"acs-poverty-rate-black-county","estimate":23.9,"unit":"percent","referencePeriod":"2020-2024","label":"Poverty rate (Black population)","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"587a89b606a1dc77913822750b501ccb959d28a1bdc9690ddf5eaf4095a35bba","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}},{"observationId":"obs:acs-black-population-share-county:county:17031:2020-2024","metricId":"acs-black-population-share-county","estimate":22.2,"unit":"percent","referencePeriod":"2020-2024","label":"Black population share","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"2d39628107fb015dbf6c71829c4dbe533ab4bbbf0a74f2967a82bb4661d29657","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}},{"observationId":"obs:acs-ba-attainment-black-county:county:17031:2020-2024","metricId":"acs-ba-attainment-black-county","estimate":26.8,"unit":"percent","referencePeriod":"2020-2024","label":"Bachelor’s degree or higher (Black adults 25+)","provenance":{"source":"acs-census-api","sourceUrl":"https://www.census.gov/programs-surveys/acs","retrievedAt":"2026-07-22T03:05:50.014Z","contentHash":"935f92f822e6ba27e58effde24aa7b3d9ad5e39f33b6e29ea3b5a9235490b22b","humanCitation":"U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL)."}}]'::jsonb,
  '[]'::jsonb,
  '[{"artifactId":"art_mapping_inequality_place","artifactClass":"cartographic_grade_map","title":"Mapping Inequality — Chicago (place context)","citation":"Nelson, Winling, et al., Mapping Inequality. University of Richmond DSL. https://dsl.richmond.edu/panorama/redlining/","sourceUrl":"https://dsl.richmond.edu/panorama/redlining/","uncertaintyLabel":"Cite-only on public surfaces pending NC rights review for polygon product."}]'::jsonb,
  ARRAY['insufficient_evidence']::text[],
  'published',
  '2026-07-22T20:00:00.000Z'::timestamptz,
  '2026-07-22T20:00:00.000Z'::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  question_id = EXCLUDED.question_id,
  theme_id = EXCLUDED.theme_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  policy_eras = EXCLUDED.policy_eras,
  geography = EXCLUDED.geography,
  method_stance = EXCLUDED.method_stance,
  method_note = EXCLUDED.method_note,
  observations = EXCLUDED.observations,
  derived = EXCLUDED.derived,
  artifacts = EXCLUDED.artifacts,
  gap_states = EXCLUDED.gap_states,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;