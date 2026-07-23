/**
 * Urban renewal theme packets (Q7) for Chicago metro pilot.
 * DSL Renewing Inequality project attributes are cite-only (NC-SA); polygon product
 * remains gap-gated. NHGIS/ACS observations bind where warehouse rows exist.
 */
export const CHICAGO_URBAN_RENEWAL_SCOPE = 'metro:chicago-il' as const;
export const CHICAGO_COOK_JURISDICTION = 'county:17031' as const;

const METHOD_NOTE =
  'Federal urban renewal characteristics and later demographic indicators are juxtaposed for context. Juxtaposition is not causation. Project polygons remain cite-only on public surfaces.';

const ACS_RETRIEVED = '2026-07-22T03:05:50.014Z';
const ACS_SOURCE = 'acs-census-api';
const ACS_URL = 'https://www.census.gov/programs-surveys/acs';

const NHGIS_RETRIEVED = '2026-07-22T21:58:00.998Z';
const NHGIS_SOURCE = 'nhgis-county-race';
const NHGIS_URL = 'https://www.nhgis.org/';

const DSL_URL = 'https://dsl.richmond.edu/panorama/renewal/';

const NOW = '2026-07-22T23:00:00.000Z';

export const urbanRenewalPilotPackets = [
  {
    id: 'tip_urban_renewal_q7_chicago',
    question_id: 'Q7',
    theme_id: 'urban_renewal',
    title: 'Chicago urban renewal projects and demographic change (Cook County spine)',
    summary:
      'Federal urban renewal characteristics for selected Chicago projects (cite-only DSL attributes) beside NHGIS historical and ACS contemporary Black population share and homeownership in Cook County. Project polygons and full attribute ingest remain gated.',
    policy_eras: ['urban_renewal_federal'],
    geography: {
      geographyType: 'county',
      jurisdictionId: CHICAGO_COOK_JURISDICTION,
      boundaryVersion: 'county-2020',
      label: 'Cook County, IL (Chicago metro pilot)',
      scopeKey: CHICAGO_URBAN_RENEWAL_SCOPE,
    },
    method_stance: 'juxtaposition',
    method_note: METHOD_NOTE,
    observations: [
      {
        observationId: 'obs:nhgis-black-population-share-county:county:17031:1970',
        metricId: 'nhgis-black-population-share-county',
        estimate: 20.9,
        unit: 'percent',
        referencePeriod: '1970',
        label: 'Black population share (1970 decennial)',
        provenance: {
          source: NHGIS_SOURCE,
          sourceUrl: NHGIS_URL,
          retrievedAt: NHGIS_RETRIEVED,
          contentHash: '2dbbce63da2da8249fc6d9af93905e9b5976abdcb08cd864d7974215fcf8cdcf',
          humanCitation:
            'IPUMS NHGIS — Black population share, Cook County, IL, 1970 decennial census.',
        },
      },
      {
        observationId: 'obs:nhgis-black-population-share-county:county:17031:2010',
        metricId: 'nhgis-black-population-share-county',
        estimate: 25,
        unit: 'percent',
        referencePeriod: '2010',
        label: 'Black population share (2010 decennial)',
        provenance: {
          source: NHGIS_SOURCE,
          sourceUrl: NHGIS_URL,
          retrievedAt: NHGIS_RETRIEVED,
          contentHash: 'b30bc5d9e88c6f03bb524d0b76407128a7a8539672260b950119b92bd5d57a31',
          humanCitation:
            'IPUMS NHGIS — Black population share, Cook County, IL, 2010 decennial census.',
        },
      },
      {
        observationId: 'obs:acs-black-population-share-county:county:17031:2020-2024',
        metricId: 'acs-black-population-share-county',
        estimate: 22.2,
        unit: 'percent',
        referencePeriod: '2020-2024',
        label: 'Black population share (ACS 5-year)',
        provenance: {
          source: ACS_SOURCE,
          sourceUrl: ACS_URL,
          retrievedAt: ACS_RETRIEVED,
          contentHash: '2d39628107fb015dbf6c71829c4dbe533ab4bbbf0a74f2967a82bb4661d29657',
          humanCitation:
            'U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL).',
        },
      },
      {
        observationId: 'obs:acs-homeownership-rate-black-county:county:17031:2020-2024',
        metricId: 'acs-homeownership-rate-black-county',
        estimate: 41.5,
        unit: 'percent',
        referencePeriod: '2020-2024',
        label: 'Black homeownership rate',
        provenance: {
          source: ACS_SOURCE,
          sourceUrl: ACS_URL,
          retrievedAt: ACS_RETRIEVED,
          contentHash: 'a5401ce177953edcbb9f3349204243696d836ed7fffb3d96a0ed3946a771f0f3',
          humanCitation:
            'U.S. Census Bureau, American Community Survey 2020–2024 5-Year Estimates (Cook County, IL).',
        },
      },
    ],
    derived: [],
    artifacts: [
      {
        artifactId: 'art_dsl_hyde_park_kenwood',
        artifactClass: 'primary_government_document',
        title: 'Hyde Park–Kenwood urban renewal project (federal characteristics, 1966)',
        dated: '1966',
        citation:
          'Renewing Inequality: Urban Renewal and the American City, Digital Scholarship Lab, University of Richmond. Project 2466 — Hyde Park–Kenwood, Chicago, IL.',
        sourceUrl: DSL_URL,
        summary:
          'Cite-only federal characteristics attributes (1966): 2,333 non-white families; 5,940 substandard dwelling units; 111.6 acres proposed reuse. Inventory attributes only — not a public polygon product.',
        uncertaintyLabel:
          'Vector derivatives CC BY-NC-SA 4.0. Public commercial surfaces cite only; polygon map product awaits rights review.',
      },
      {
        artifactId: 'art_dsl_near_west_side',
        artifactClass: 'primary_government_document',
        title: 'Near West Side urban renewal project (federal characteristics, 1964)',
        dated: '1964',
        citation:
          'Renewing Inequality: Urban Renewal and the American City, Digital Scholarship Lab, University of Richmond. Project 2474 — Near West Side, Chicago, IL.',
        sourceUrl: DSL_URL,
        summary:
          'Cite-only federal characteristics attributes (1964): 126 non-white families; 741 substandard dwelling units; 54.3 acres proposed reuse. Inventory attributes only — not a public polygon product.',
        uncertaintyLabel:
          'Vector derivatives CC BY-NC-SA 4.0. Public commercial surfaces cite only; polygon map product awaits rights review.',
      },
      {
        artifactId: 'art_dsl_polygon_gap',
        artifactClass: 'cartographic_grade_map',
        title: 'Urban renewal project polygons (not yet published)',
        citation:
          'Renewing Inequality ur_projects.geojson — gated pending NC-SA rights review for commercial polygon surfaces.',
        uncertaintyLabel:
          'Project-level ur-* metric observations not yet ingested to bb_reference; polygons cite-only.',
      },
    ],
    gap_states: ['insufficient_evidence'],
    status: 'draft',
    created_at: NOW,
    updated_at: NOW,
  },
] as const;
