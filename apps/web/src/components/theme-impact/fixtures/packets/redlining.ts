/**
 * Redlining theme-impact packet fixtures (Q1–Q4) for metro:chicago-il — Cook County
 * indicators from live ACS observations; HOLC context cite-only per DSL rights posture.
 */

import type { ThemeImpactPacketFixture } from '../types';

const ACS_RETRIEVED_AT = '2026-07-22T03:05:50.014Z';
const ACS_SOURCE_URL = 'https://www.census.gov/programs-surveys/acs';
const ACS_REFERENCE_PERIOD = 'ACS 2020–2024 5-year';
const HOLC_RETRIEVED_AT = '2026-07-22T00:00:00Z';
const HOLC_SOURCE_URL = 'https://dsl.richmond.edu/panorama/redlining/';
const HOLC_HUMAN_CITATION =
  'Mapping Inequality: Redlining in New Deal America, Digital Scholarship Lab, University of Richmond, https://dsl.richmond.edu/panorama/redlining/ (CC BY-NC-SA 4.0 on vector derivatives; NARA source scans public domain).';

export const REDLINING_PACKET_FIXTURES: readonly ThemeImpactPacketFixture[] = [
  {
    questionId: 'Q1',
    themeId: 'redlining',
    question: 'How did federal and local redlining practices come about?',
    policyEras: [
      {
        id: 'holc_fha',
        label: 'HOLC / FHA grading & federal mortgage gatekeeping',
        span: 'circa 1933–1968',
      },
    ],
    geography: {
      unit: 'national',
      label: 'United States — federal policy origins (Chicago metro packets below)',
    },
    methodStance: 'juxtaposition',
    methodNote:
      'This timeline binds primary federal documents and peer-reviewed synthesis. It documents how grading practices emerged; it does not claim that any single manual caused later neighborhood outcomes in Chicago or elsewhere.',
    observationsSummary:
      'Congress chartered HOLC in 1933 to refinance distressed mortgages; field agents produced color-coded security maps and area descriptions. FHA underwriting manuals from 1938 onward reinforced neighborhood grading that local lenders and appraisers applied unevenly across cities including Chicago.',
    observations: [],
    derived: [],
    artifacts: [
      {
        id: 'holc-manual-1936',
        title: 'HOLC Residential Security Map and area description procedures',
        artifactClass: 'primary_government_document',
        dateLabel: '1936',
        summary:
          'Federal guidance instructing field agents how to grade neighborhoods, record racial composition, and file area descriptions used in security maps.',
        provenance: {
          source: 'primary-government-documents',
          source_url: 'https://www.archives.gov/',
          retrieved_at: '2026-07-22T00:00:00Z',
          content_hash: 'sha256:fixture-holc-manual-1936-nara',
          humanCitation:
            'Home Owners\' Loan Corporation, Residential Security Map and Area Description files, Record Group 195, U.S. National Archives and Records Administration (public domain).',
        },
      },
      {
        id: 'fha-underwriting-1938',
        title: 'FHA underwriting manual — racial occupancy guidance',
        artifactClass: 'primary_government_document',
        dateLabel: '1938',
        summary:
          'Federal Housing Administration guidance discouraging mortgage insurance in areas with “inharmonious” racial groups — language local appraisers cited when denying credit.',
        provenance: {
          source: 'primary-government-documents',
          source_url: 'https://www.huduser.gov/portal/publications/fairhousing.html',
          retrieved_at: '2026-07-22T00:00:00Z',
          content_hash: 'sha256:fixture-fha-underwriting-1938',
          humanCitation:
            'Federal Housing Administration, Underwriting Manual (1938), as reproduced and analyzed in Rothstein, The Color of Law (2017).',
        },
      },
      {
        id: 'rothstein-color-of-law-2017',
        title: 'The Color of Law — federal housing segregation synthesis',
        artifactClass: 'peer_reviewed_synthesis',
        dateLabel: '2017',
        summary:
          'Peer-reviewed legal history tracing how federal mortgage programs and local enforcement encoded racial segregation in housing markets.',
        provenance: {
          source: 'peer-reviewed-synthesis',
          source_url: 'https://www.epi.org/books/the-color-of-law/',
          retrieved_at: '2026-07-22T00:00:00Z',
          content_hash: 'sha256:fixture-rothstein-color-of-law-2017',
          humanCitation: 'Richard Rothstein, The Color of Law: A Forgotten History of How Our Government Segregated America (Liveright, 2017).',
        },
      },
    ],
    gapStates: [],
  },
  {
    questionId: 'Q2',
    themeId: 'redlining',
    question:
      'Where was HOLC grading applied, and how were Black neighborhoods graded?',
    policyEras: [
      {
        id: 'holc_fha',
        label: 'HOLC / FHA grading & federal mortgage gatekeeping',
        span: 'circa 1935–1940',
      },
    ],
    geography: {
      unit: 'metro',
      label: 'Chicago metropolitan area · metro:chicago-il',
      boundaryVersion: 'holc-survey-chicago-1940',
    },
    methodStance: 'juxtaposition',
    methodNote:
      'Grade counts summarize staff inventory of Chicago-tagged HOLC survey areas — descriptive geography only. A D or C grade beside a high Black population share is juxtaposition, not proof that grading alone caused later displacement or wealth gaps. Public map polygons remain rights-gated (CC BY-NC-SA); this packet cites the map, it does not ship geometry.',
    observationsSummary:
      'Staff inventory lists 703 Chicago-tagged HOLC survey areas: 48 graded A, 160 B, 326 C, and 147 D. Neighborhoods with higher Black population shares were more often graded C or D in mapped cities; polygon-derived share metrics stay off public surfaces until rights review clears them.',
    observations: [
      {
        id: 'obs-holc-grade-a-count-chicago',
        label: 'HOLC areas graded A (Chicago-tagged inventory)',
        value: '48',
        referencePeriod: 'HOLC survey vintage, circa 1940',
        provenance: {
          source: 'mapping-inequality-holc',
          source_url: HOLC_SOURCE_URL,
          retrieved_at: HOLC_RETRIEVED_AT,
          content_hash: 'sha256:fixture-holc-grade-a-count-chicago-703',
          humanCitation: `${HOLC_HUMAN_CITATION} Staff inventory of Chicago-tagged survey areas.`,
        },
      },
      {
        id: 'obs-holc-grade-b-count-chicago',
        label: 'HOLC areas graded B (Chicago-tagged inventory)',
        value: '160',
        referencePeriod: 'HOLC survey vintage, circa 1940',
        provenance: {
          source: 'mapping-inequality-holc',
          source_url: HOLC_SOURCE_URL,
          retrieved_at: HOLC_RETRIEVED_AT,
          content_hash: 'sha256:fixture-holc-grade-b-count-chicago-703',
          humanCitation: `${HOLC_HUMAN_CITATION} Staff inventory of Chicago-tagged survey areas.`,
        },
      },
      {
        id: 'obs-holc-grade-c-count-chicago',
        label: 'HOLC areas graded C (Chicago-tagged inventory)',
        value: '326',
        referencePeriod: 'HOLC survey vintage, circa 1940',
        provenance: {
          source: 'mapping-inequality-holc',
          source_url: HOLC_SOURCE_URL,
          retrieved_at: HOLC_RETRIEVED_AT,
          content_hash: 'sha256:fixture-holc-grade-c-count-chicago-703',
          humanCitation: `${HOLC_HUMAN_CITATION} Staff inventory of Chicago-tagged survey areas.`,
        },
      },
      {
        id: 'obs-holc-grade-d-count-chicago',
        label: 'HOLC areas graded D (Chicago-tagged inventory)',
        value: '147',
        referencePeriod: 'HOLC survey vintage, circa 1940',
        provenance: {
          source: 'mapping-inequality-holc',
          source_url: HOLC_SOURCE_URL,
          retrieved_at: HOLC_RETRIEVED_AT,
          content_hash: 'sha256:fixture-holc-grade-d-count-chicago-703',
          humanCitation: `${HOLC_HUMAN_CITATION} Staff inventory of Chicago-tagged survey areas.`,
        },
      },
    ],
    derived: [],
    artifacts: [
      {
        id: 'holc-map-chicago',
        title: 'Chicago HOLC security map',
        artifactClass: 'cartographic_grade_map',
        dateLabel: 'circa 1940',
        summary:
          'Color-coded residential security map for Chicago neighborhoods surveyed by HOLC — cited for context; georectified vector derivatives are noncommercial (CC BY-NC-SA) and are not rendered on this public surface.',
        uncertaintyLabel:
          'Survey boundaries reflect 1935–1940 footprints; modern streets and jurisdictions differ. Public polygon layers remain rights-gated.',
        provenance: {
          source: 'mapping-inequality-holc',
          source_url: HOLC_SOURCE_URL,
          retrieved_at: HOLC_RETRIEVED_AT,
          content_hash: 'sha256:fixture-holc-map-chicago-cite-only',
          humanCitation: HOLC_HUMAN_CITATION,
        },
      },
    ],
    gapStates: ['insufficient_evidence'],
  },
  {
    questionId: 'Q3',
    themeId: 'redlining',
    question:
      'Across housing-credit policy eras, how did Black homeownership, income, poverty, and wealth change in places with redlining history?',
    policyEras: [
      {
        id: 'holc_fha',
        label: 'HOLC / FHA grading & federal mortgage gatekeeping',
        span: 'circa 1933–1968',
      },
      {
        id: 'fair_housing',
        label: 'Fair Housing & early enforcement',
        span: 'circa 1968–1980s',
      },
      {
        id: 'cra_contemporary',
        label: 'CRA / contemporary lending disparity',
        span: 'circa 1977–present',
      },
    ],
    geography: {
      unit: 'county',
      label: 'Cook County, Illinois · county:17031 · metro:chicago-il',
      boundaryVersion: 'county-2020',
    },
    methodStance: 'juxtaposition',
    methodNote:
      'Indicators are shown beside policy eras for Cook County. Co-movement of homeownership, income, poverty, and attainment does not establish that redlining alone caused later gaps — crosswalk uncertainty, migration, and confounders remain explicit. HMDA county denial rates (2022–2023) are loaded where warehouse ingest has run; decennial era deltas and national wealth series remain gap-labeled.',
    observationsSummary:
      'In Cook County (ACS 2020–2024), Black residents are 22.2% of the population; Black homeownership is 41.5%; Black median household income is $51,523 against $102,809 for White householders; Black poverty rate is 23.9%; bachelor\'s attainment among Black adults is 26.8%.',
    observations: [
      {
        id: 'obs:acs-black-population-share-county:county:17031:2020-2024',
        label: 'Black population share',
        value: '22.2%',
        referencePeriod: ACS_REFERENCE_PERIOD,
        provenance: {
          source: 'acs-census-api',
          source_url: ACS_SOURCE_URL,
          retrieved_at: ACS_RETRIEVED_AT,
          content_hash:
            'sha256:2d39628107fb015dbf6c71829c4dbe533ab4bbbf0a74f2967a82bb4661d29657',
          humanCitation:
            'U.S. Census Bureau, American Community Survey 2020–2024 5-year estimates, Cook County, Illinois (FIPS 17031).',
        },
      },
      {
        id: 'obs:acs-homeownership-rate-black-county:county:17031:2020-2024',
        label: 'Black homeownership rate',
        value: '41.5%',
        referencePeriod: ACS_REFERENCE_PERIOD,
        provenance: {
          source: 'acs-census-api',
          source_url: ACS_SOURCE_URL,
          retrieved_at: ACS_RETRIEVED_AT,
          content_hash:
            'sha256:a5401ce177953edcbb9f3349204243696d836ed7fffb3d96a0ed3946a771f0f3',
          humanCitation:
            'U.S. Census Bureau, American Community Survey Table B25003B (Black alone householder), Cook County, Illinois (FIPS 17031), 2020–2024 5-year.',
        },
      },
      {
        id: 'obs:acs-median-hh-income-black-county:county:17031:2020-2024',
        label: 'Black median household income',
        value: '$51,523',
        referencePeriod: ACS_REFERENCE_PERIOD,
        provenance: {
          source: 'acs-census-api',
          source_url: ACS_SOURCE_URL,
          retrieved_at: ACS_RETRIEVED_AT,
          content_hash:
            'sha256:64d710dd502f77b3f89ed7727b3b8915868311d675af55b930dcd2bd9c235a19',
          humanCitation:
            'U.S. Census Bureau, American Community Survey Table B19013B (Black alone householder), Cook County, Illinois (FIPS 17031), 2020–2024 5-year.',
        },
      },
      {
        id: 'obs:acs-median-hh-income-white-county:county:17031:2020-2024',
        label: 'White median household income',
        value: '$102,809',
        referencePeriod: ACS_REFERENCE_PERIOD,
        provenance: {
          source: 'acs-census-api',
          source_url: ACS_SOURCE_URL,
          retrieved_at: ACS_RETRIEVED_AT,
          content_hash:
            'sha256:a5ba0cb4f6fd2695b00f4fc5767e6cdf32fcd084377c27171b32f018bb330a42',
          humanCitation:
            'U.S. Census Bureau, American Community Survey Table B19013H (White alone, not Hispanic or Latino householder), Cook County, Illinois (FIPS 17031), 2020–2024 5-year.',
        },
      },
      {
        id: 'obs:acs-poverty-rate-black-county:county:17031:2020-2024',
        label: 'Black poverty rate',
        value: '23.9%',
        referencePeriod: ACS_REFERENCE_PERIOD,
        provenance: {
          source: 'acs-census-api',
          source_url: ACS_SOURCE_URL,
          retrieved_at: ACS_RETRIEVED_AT,
          content_hash:
            'sha256:587a89b606a1dc77913822750b501ccb959d28a1bdc9690ddf5eaf4095a35bba',
          humanCitation:
            'U.S. Census Bureau, American Community Survey poverty status (Black alone), Cook County, Illinois (FIPS 17031), 2020–2024 5-year.',
        },
      },
      {
        id: 'obs:acs-ba-attainment-black-county:county:17031:2020-2024',
        label: 'Black bachelor\'s degree attainment (age 25+)',
        value: '26.8%',
        referencePeriod: ACS_REFERENCE_PERIOD,
        provenance: {
          source: 'acs-census-api',
          source_url: ACS_SOURCE_URL,
          retrieved_at: ACS_RETRIEVED_AT,
          content_hash:
            'sha256:935f92f822e6ba27e58effde24aa7b3d9ad5e39f33b6e29ea3b5a9235490b22b',
          humanCitation:
            'U.S. Census Bureau, American Community Survey educational attainment (Black alone, age 25+), Cook County, Illinois (FIPS 17031), 2020–2024 5-year.',
        },
      },
    ],
    derived: [
      {
        id: 'derived:black-white-income-gap:county:17031:2020-2024',
        methodId: 'black_white_income_gap',
        label: 'Black − White median household income gap',
        value: '−$51,286',
        provenance: {
          source: 'derived:black_white_income_gap',
          source_url: ACS_SOURCE_URL,
          retrieved_at: ACS_RETRIEVED_AT,
          content_hash:
            'sha256:derived-black-white-income-gap-county-17031-2020-2024',
          humanCitation:
            'Derived (status: derived): Black median ($51,523) minus White median ($102,809) = −$51,286. Inputs: obs:acs-median-hh-income-black-county:county:17031:2020-2024 and obs:acs-median-hh-income-white-county:county:17031:2020-2024.',
        },
      },
    ],
    artifacts: [],
    gapStates: ['insufficient_evidence'],
  },
  {
    questionId: 'Q4',
    themeId: 'redlining',
    question:
      'For a specific formerly graded place, what followed for the people who lived there?',
    policyEras: [
      {
        id: 'holc_fha',
        label: 'HOLC / FHA grading & federal mortgage gatekeeping',
        span: 'circa 1935–1940',
      },
      {
        id: 'fair_housing',
        label: 'Fair Housing & early enforcement',
        span: 'circa 1968–1980s',
      },
      {
        id: 'cra_contemporary',
        label: 'CRA / contemporary lending disparity',
        span: 'circa 1977–present',
      },
    ],
    geography: {
      unit: 'county',
      label: 'Cook County, Illinois — Chicago and suburbs · county:17031',
      boundaryVersion: 'county-2020',
    },
    methodStance: 'juxtaposition',
    methodNote:
      'This place narrative binds Cook County indicators to documented Chicago HOLC grading context. It invites further reading at neighborhood scale; it does not assign sole causation to a 1940 grade or map line.',
    observationsSummary:
      'Chicago was among the cities HOLC surveyed circa 1940 — 147 areas received D grades in staff inventory. Today in Cook County, Black homeownership stands at 41.5% and Black median household income at $51,523 (ACS 2020–2024), read beside the cited security map rather than overlaid on public polygon geometry.',
    observations: [
      {
        id: 'obs:acs-homeownership-rate-black-county:county:17031:2020-2024',
        label: 'Black homeownership rate (Cook County)',
        value: '41.5%',
        referencePeriod: ACS_REFERENCE_PERIOD,
        provenance: {
          source: 'acs-census-api',
          source_url: ACS_SOURCE_URL,
          retrieved_at: ACS_RETRIEVED_AT,
          content_hash:
            'sha256:a5401ce177953edcbb9f3349204243696d836ed7fffb3d96a0ed3946a771f0f3',
          humanCitation:
            'U.S. Census Bureau, American Community Survey Table B25003B (Black alone householder), Cook County, Illinois (FIPS 17031), 2020–2024 5-year.',
        },
      },
      {
        id: 'obs:acs-median-hh-income-black-county:county:17031:2020-2024',
        label: 'Black median household income (Cook County)',
        value: '$51,523',
        referencePeriod: ACS_REFERENCE_PERIOD,
        provenance: {
          source: 'acs-census-api',
          source_url: ACS_SOURCE_URL,
          retrieved_at: ACS_RETRIEVED_AT,
          content_hash:
            'sha256:64d710dd502f77b3f89ed7727b3b8915868311d675af55b930dcd2bd9c235a19',
          humanCitation:
            'U.S. Census Bureau, American Community Survey Table B19013B (Black alone householder), Cook County, Illinois (FIPS 17031), 2020–2024 5-year.',
        },
      },
    ],
    derived: [],
    artifacts: [
      {
        id: 'holc-map-chicago',
        title: 'Chicago HOLC security map',
        artifactClass: 'cartographic_grade_map',
        dateLabel: 'circa 1940',
        summary:
          'Color-coded residential security map for Chicago neighborhoods surveyed by HOLC — cited for place context; georectified vectors are CC BY-NC-SA and not rendered here.',
        uncertaintyLabel:
          'County indicators span modern Cook boundaries; 1940 survey footprints differ. Neighborhood-scale narrative requires entity bindings not yet published.',
        provenance: {
          source: 'mapping-inequality-holc',
          source_url: HOLC_SOURCE_URL,
          retrieved_at: HOLC_RETRIEVED_AT,
          content_hash: 'sha256:fixture-holc-map-chicago-cite-only',
          humanCitation: HOLC_HUMAN_CITATION,
        },
      },
    ],
    gapStates: ['insufficient_evidence'],
  },
] as const;
