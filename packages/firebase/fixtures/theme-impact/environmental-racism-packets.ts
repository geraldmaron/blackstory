/**
 * Environmental racism theme packets (Q9) for Cook County / Chicago metro pilot.
 * Observations from live bb_reference.statistical_observations (ACS, CDC EJI, EPA TRI).
 */
export const CHICAGO_ENVIRONMENTAL_SCOPE = 'metro:chicago-il' as const;
export const CHICAGO_COOK_JURISDICTION = 'county:17031' as const;

const METHOD_NOTE =
  'Environmental burden indicators and demographic share are shown together for context. Juxtaposition is not causation. TRI facility counts describe reporting presence, not ambient risk.';

const ACS_RETRIEVED = '2026-07-22T03:05:50.014Z';
const ACS_SOURCE = 'acs-census-api';
const ACS_URL = 'https://www.census.gov/programs-surveys/acs';

const EJI_RETRIEVED = '2026-07-22T22:44:24.642Z';
const EJI_SOURCE = 'cdc-eji';
const EJI_URL = 'https://www.atsdr.cdc.gov/placeandhealth/eji/eji-data-download.html';

const TRI_RETRIEVED = '2026-07-22T22:44:24.649Z';
const TRI_SOURCE = 'epa-tri';
const TRI_URL = 'https://www.epa.gov/toxics-release-inventory-tri-program';

const NOW = '2026-07-22T23:00:00.000Z';

export const environmentalRacismPilotPackets = [
  {
    id: 'tip_environmental_racism_q9_cook',
    question_id: 'Q9',
    theme_id: 'environmental_racism',
    title: 'Environmental burden beside Black population share (Cook County)',
    summary:
      'Cook County ACS Black population share beside CDC Environmental Justice Index burden score and EPA TRI facility counts. Indicators are juxtaposed — not proof that demographic share alone causes burden concentration.',
    policy_eras: [],
    geography: {
      geographyType: 'county',
      jurisdictionId: CHICAGO_COOK_JURISDICTION,
      boundaryVersion: 'county-2020',
      label: 'Cook County, IL',
      scopeKey: CHICAGO_ENVIRONMENTAL_SCOPE,
    },
    method_stance: 'juxtaposition',
    method_note: METHOD_NOTE,
    observations: [
      {
        observationId: 'obs:acs-black-population-share-county:county:17031:2020-2024',
        metricId: 'acs-black-population-share-county',
        estimate: 22.2,
        unit: 'percent',
        referencePeriod: '2020-2024',
        label: 'Black population share',
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
        observationId: 'obs:cdc-eji-environmental-burden-score-county:county:17031:2024',
        metricId: 'cdc-eji-environmental-burden-score-county',
        estimate: 0.7469,
        unit: 'index',
        referencePeriod: '2024',
        label: 'Environmental burden score (CDC EJI county mean)',
        provenance: {
          source: EJI_SOURCE,
          sourceUrl: EJI_URL,
          retrievedAt: EJI_RETRIEVED,
          contentHash: '9086f1dc907741c2210195fcfe3f8939433ca7133b9b9a9fa2b0f3a9b31badb5',
          humanCitation:
            'CDC/ATSDR Environmental Justice Index 2024 — mean tract RPL_EBM percentile rank for Cook County, IL (0–1 scale).',
        },
      },
      {
        observationId: 'obs:epa-tri-facility-count-county:county:17031:2023',
        metricId: 'epa-tri-facility-count-county',
        estimate: 305,
        unit: 'count',
        referencePeriod: '2023',
        label: 'TRI-reporting facility count',
        provenance: {
          source: TRI_SOURCE,
          sourceUrl: TRI_URL,
          retrievedAt: TRI_RETRIEVED,
          contentHash: '65ddcef4a26b8eddabf5dc38d0d40c3ec14aa3b54c0137db743e01d6856c9e95',
          humanCitation:
            'EPA Toxics Release Inventory — distinct reporting facilities in Cook County, IL, 2023.',
        },
      },
    ],
    derived: [],
    artifacts: [],
    gap_states: [],
    status: 'published',
    created_at: NOW,
    updated_at: NOW,
  },
] as const;
