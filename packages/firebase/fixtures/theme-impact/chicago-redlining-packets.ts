/**
 * Chicago redlining pilot packets (metro:chicago-il) for ThemeImpactPacket upsert.
 * Numbers from live bb_reference.statistical_observations (Cook County ACS 2020–2024).
 * HOLC geometry is cite-only on public surfaces (CC BY-NC-SA); grade counts from staff inventory.
 */
export const CHICAGO_REDLINING_SCOPE = 'metro:chicago-il' as const;
export const CHICAGO_COOK_JURISDICTION = 'county:17031' as const;

const ACS_RETRIEVED = '2026-07-22T03:05:50.014Z';
const ACS_SOURCE = 'acs-census-api';
const ACS_URL = 'https://www.census.gov/programs-surveys/acs';
const ACS_HUMAN =
  'U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL).';

const METHOD_NOTE =
  'Indicators and HOLC-era history are shown together for context. Juxtaposition is not causation.';

type Provenance = {
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  contentHash: string;
  humanCitation: string;
};

function acsProv(hash: string, human = ACS_HUMAN): Provenance {
  return {
    source: ACS_SOURCE,
    sourceUrl: ACS_URL,
    retrievedAt: ACS_RETRIEVED,
    contentHash: hash,
    humanCitation: human,
  };
}

const OBS = {
  blackShare: {
    observationId: 'obs:acs-black-population-share-county:county:17031:2020-2024',
    metricId: 'acs-black-population-share-county',
    estimate: 22.2,
    unit: 'percent',
    referencePeriod: '2020-2024',
    label: 'Black population share',
    provenance: acsProv('2d39628107fb015dbf6c71829c4dbe533ab4bbbf0a74f2967a82bb4661d29657'),
  },
  homeownership: {
    observationId: 'obs:acs-homeownership-rate-black-county:county:17031:2020-2024',
    metricId: 'acs-homeownership-rate-black-county',
    estimate: 41.5,
    unit: 'percent',
    referencePeriod: '2020-2024',
    label: 'Black homeownership rate',
    provenance: acsProv('a5401ce177953edcbb9f3349204243696d836ed7fffb3d96a0ed3946a771f0f3'),
  },
  incomeBlack: {
    observationId: 'obs:acs-median-hh-income-black-county:county:17031:2020-2024',
    metricId: 'acs-median-hh-income-black-county',
    estimate: 51523,
    unit: 'USD',
    referencePeriod: '2020-2024',
    label: 'Median household income (Black householders)',
    provenance: acsProv('64d710dd502f77b3f89ed7727b3b8915868311d675af55b930dcd2bd9c235a19'),
  },
  incomeWhite: {
    observationId: 'obs:acs-median-hh-income-white-county:county:17031:2020-2024',
    metricId: 'acs-median-hh-income-white-county',
    estimate: 102809,
    unit: 'USD',
    referencePeriod: '2020-2024',
    label: 'Median household income (White householders)',
    provenance: acsProv('a5ba0cb4f6fd2695b00f4fc5767e6cdf32fcd084377c27171b32f018bb330a42'),
  },
  poverty: {
    observationId: 'obs:acs-poverty-rate-black-county:county:17031:2020-2024',
    metricId: 'acs-poverty-rate-black-county',
    estimate: 23.9,
    unit: 'percent',
    referencePeriod: '2020-2024',
    label: 'Poverty rate (Black population)',
    provenance: acsProv('587a89b606a1dc77913822750b501ccb959d28a1bdc9690ddf5eaf4095a35bba'),
  },
  ba: {
    observationId: 'obs:acs-ba-attainment-black-county:county:17031:2020-2024',
    metricId: 'acs-ba-attainment-black-county',
    estimate: 26.8,
    unit: 'percent',
    referencePeriod: '2020-2024',
    label: 'Bachelor’s degree or higher (Black adults 25+)',
    provenance: acsProv('935f92f822e6ba27e58effde24aa7b3d9ad5e39f33b6e29ea3b5a9235490b22b'),
  },
} as const;

const NOW = '2026-07-22T20:00:00.000Z';

export const chicagoRedliningPilotPackets = [
  {
    id: 'tip_chicago_redlining_q1',
    question_id: 'Q1',
    theme_id: 'redlining',
    title: 'How federal redlining practices took shape',
    summary:
      'HOLC residential security maps and FHA underwriting in the 1930s graded neighborhoods and shaped mortgage access. This packet assembles dated artifacts for Chicago-metro context — not a causal model of later outcomes.',
    policy_eras: ['holc_fha'],
    geography: {
      geographyType: 'city',
      jurisdictionId: CHICAGO_COOK_JURISDICTION,
      boundaryVersion: 'county-2020',
      label: 'Chicago metro pilot (Cook County spine)',
      scopeKey: CHICAGO_REDLINING_SCOPE,
    },
    method_stance: 'juxtaposition',
    method_note: METHOD_NOTE,
    observations: [],
    derived: [],
    artifacts: [
      {
        artifactId: 'art_holc_program_origin',
        artifactClass: 'primary_government_document',
        title: 'Home Owners’ Loan Corporation residential security mapping (1935–1940)',
        dated: '1935-1940',
        citation:
          'Federal HOLC residential security maps (NARA holdings); overview via Mapping Inequality (University of Richmond DSL).',
        sourceUrl: 'https://dsl.richmond.edu/panorama/redlining/',
        uncertaintyLabel: 'Program history is national; local sheet dates vary by city.',
      },
      {
        artifactId: 'art_fha_underwriting',
        artifactClass: 'primary_government_document',
        title: 'FHA Underwriting Manual race and neighborhood risk language (1930s–1940s)',
        dated: '1938',
        citation:
          'Federal Housing Administration Underwriting Manual (period editions); cited in secondary historical syntheses of mortgage redlining.',
        uncertaintyLabel: 'Manual editions changed; quote from a specific edition when advancing a claim.',
      },
      {
        artifactId: 'art_fair_housing_1968',
        artifactClass: 'primary_government_document',
        title: 'Fair Housing Act (1968)',
        dated: '1968-04-11',
        citation: 'Civil Rights Act of 1968, Title VIII — Fair Housing Act, 42 U.S.C. §§ 3601 et seq.',
        sourceUrl: 'https://www.justice.gov/crt/fair-housing-act-1',
      },
    ],
    gap_states: [],
    status: 'published',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'tip_chicago_redlining_q2',
    question_id: 'Q2',
    theme_id: 'redlining',
    title: 'HOLC grades in Chicago (inventory counts)',
    summary:
      'Staff inventory of Mapping Inequality HOLC polygons tagged to Chicago: A 48, B 160, C 326, D 147 (703 areas). Public map polygons remain rights-gated (CC BY-NC-SA); this packet cites grade counts and attribution only.',
    policy_eras: ['holc_fha'],
    geography: {
      geographyType: 'city',
      boundaryVersion: 'mapping-inequality-holc-v1',
      label: 'Chicago HOLC sheets (Mapping Inequality inventory)',
      scopeKey: CHICAGO_REDLINING_SCOPE,
    },
    method_stance: 'juxtaposition',
    method_note: METHOD_NOTE,
    observations: [],
    derived: [],
    artifacts: [
      {
        artifactId: 'art_mapping_inequality_chicago',
        artifactClass: 'cartographic_grade_map',
        title: 'Mapping Inequality — Chicago HOLC maps',
        dated: '1935-1940',
        citation:
          'Nelson, Winling, et al., Mapping Inequality: Redlining in New Deal America. University of Richmond DSL. https://dsl.richmond.edu/panorama/redlining/',
        sourceUrl: 'https://dsl.richmond.edu/panorama/redlining/',
        summary:
          'Staff inventory of Chicago-tagged HOLC areas: A 48, B 160, C 326, D 147 (703 total). Inventory counts only — not a public polygon product.',
        uncertaintyLabel:
          'Vector derivatives are CC BY-NC-SA 4.0. Public commercial surfaces cite only; polygon map product awaits rights review.',
      },
    ],
    gap_states: ['insufficient_evidence'],
    status: 'published',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'tip_chicago_redlining_q3',
    question_id: 'Q3',
    theme_id: 'redlining',
    title: 'Cook County housing and income indicators beside redlining eras',
    summary:
      'ACS 2020–2024 Cook County readings for Black homeownership, income, poverty, and population share, shown across housing-credit policy eras for juxtaposition — not proof that HOLC grades alone caused present gaps.',
    policy_eras: ['holc_fha', 'fair_housing', 'cra_contemporary'],
    geography: {
      geographyType: 'county',
      jurisdictionId: CHICAGO_COOK_JURISDICTION,
      boundaryVersion: 'county-2020',
      label: 'Cook County, IL',
      scopeKey: CHICAGO_REDLINING_SCOPE,
    },
    method_stance: 'juxtaposition',
    method_note: METHOD_NOTE,
    observations: [
      OBS.homeownership,
      OBS.incomeBlack,
      OBS.incomeWhite,
      OBS.poverty,
      OBS.blackShare,
      OBS.ba,
    ],
    derived: [
      {
        derivedId: 'der_cook_black_white_income_gap_2020_2024',
        methodId: 'black_white_income_gap',
        value: -51286,
        unit: 'USD',
        status: 'derived',
        formula: 'acs-median-hh-income-black-county - acs-median-hh-income-white-county',
        inputObservationIds: [OBS.incomeBlack.observationId, OBS.incomeWhite.observationId],
        label: 'Black–White median household income gap (Cook County)',
        provenance: {
          source: ACS_SOURCE,
          sourceUrl: ACS_URL,
          retrievedAt: ACS_RETRIEVED,
          contentHash:
            'sha256:derived-cook-income-gap-64d710dd502f77b3-a5ba0cb4f6fd2695',
          humanCitation:
            'Derived from ACS 2020–2024 5-Year B19013B and B19013A for Cook County, IL.',
        },
      },
    ],
    artifacts: [
      {
        artifactId: 'art_hmda_gap',
        artifactClass: 'scholarly_partner_table',
        title: 'HMDA lending aggregates (not yet loaded for this pilot)',
        citation: 'Home Mortgage Disclosure Act aggregates — gap until county denial rates are ingested.',
        uncertaintyLabel: 'Series pending; see gap_states.',
      },
    ],
    gap_states: ['insufficient_evidence'],
    status: 'published',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'tip_chicago_redlining_q4',
    question_id: 'Q4',
    theme_id: 'redlining',
    title: 'What followed in Cook County for Black residents (place spine)',
    summary:
      'Place-level narrative spine for the Chicago pilot: contemporary ACS indicators for Cook County beside HOLC-era map citations. Entity bindings can attach graded neighborhoods as curation continues.',
    policy_eras: ['holc_fha', 'fair_housing', 'cra_contemporary'],
    geography: {
      geographyType: 'county',
      jurisdictionId: CHICAGO_COOK_JURISDICTION,
      boundaryVersion: 'county-2020',
      label: 'Cook County, IL (Chicago metro pilot spine)',
      scopeKey: CHICAGO_REDLINING_SCOPE,
    },
    method_stance: 'juxtaposition',
    method_note: METHOD_NOTE,
    observations: [OBS.homeownership, OBS.incomeBlack, OBS.poverty, OBS.blackShare, OBS.ba],
    derived: [],
    artifacts: [
      {
        artifactId: 'art_mapping_inequality_place',
        artifactClass: 'cartographic_grade_map',
        title: 'Mapping Inequality — Chicago (place context)',
        citation:
          'Nelson, Winling, et al., Mapping Inequality. University of Richmond DSL. https://dsl.richmond.edu/panorama/redlining/',
        sourceUrl: 'https://dsl.richmond.edu/panorama/redlining/',
        uncertaintyLabel: 'Cite-only on public surfaces pending NC rights review for polygon product.',
      },
    ],
    gap_states: ['insufficient_evidence'],
    status: 'published',
    created_at: NOW,
    updated_at: NOW,
  },
] as const;
