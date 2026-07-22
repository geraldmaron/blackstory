/**
 * Drug-policy theme packets (Q5–Q6) for Illinois/national spine.
 * Q6 uses Vera jail rate (Cook), corrected BJS imprisonment rates (IL), and
 * national SCF wealth medians — juxtaposition only.
 */
const USSC_RETRIEVED = '2026-07-22T21:40:54.731Z';
const USSC_SOURCE = 'ussc-quick-facts-drug';
const USSC_URL = 'https://www.ussc.gov/research/quick-facts';

const USSC_CRACK_2023 = {
  observationId: 'obs:ussc-average-sentence-months-crack-nation:nation:US:2023',
  metricId: 'ussc-average-sentence-months-crack-nation',
  estimate: 60,
  unit: 'months',
  referencePeriod: '2023',
  label: 'Federal average sentence — crack cocaine trafficking (FY2023)',
  provenance: {
    source: USSC_SOURCE,
    sourceUrl:
      'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY23.pdf',
    retrievedAt: USSC_RETRIEVED,
    contentHash: '2c33b76557c8e97050106138bbf7306c6b623fce468ed238cab3be3560e422ed',
    humanCitation:
      'U.S. Sentencing Commission Quick Facts — federal crack cocaine trafficking average sentence, FY2023.',
  },
};

const USSC_POWDER_2023 = {
  observationId: 'obs:ussc-average-sentence-months-powder-nation:nation:US:2023',
  metricId: 'ussc-average-sentence-months-powder-nation',
  estimate: 68,
  unit: 'months',
  referencePeriod: '2023',
  label: 'Federal average sentence — powder cocaine trafficking (FY2023)',
  provenance: {
    source: USSC_SOURCE,
    sourceUrl:
      'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Powder_Cocaine_FY23.pdf',
    retrievedAt: USSC_RETRIEVED,
    contentHash: 'd8d20debd719be2ad3c401810dae94f481763968e4b57844b9dd9329f57e7045',
    humanCitation:
      'U.S. Sentencing Commission Quick Facts — federal powder cocaine trafficking average sentence, FY2023.',
  },
};

const USSC_BLACK_SHARE_2023 = {
  observationId: 'obs:ussc-black-share-crack-offenders-nation:nation:US:2023',
  metricId: 'ussc-black-share-crack-offenders-nation',
  estimate: 78.9,
  unit: 'percent',
  referencePeriod: '2023',
  label: 'Black share of federal crack cocaine offenders (FY2023)',
  provenance: {
    source: USSC_SOURCE,
    sourceUrl:
      'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY23.pdf',
    retrievedAt: USSC_RETRIEVED,
    contentHash: '1bae98788c5fbaf66abcad6c41f64f42ea5d8d24fe4c1ec0ad72e16096f67dfd',
    humanCitation:
      'U.S. Sentencing Commission Quick Facts — race share among federal crack cocaine offenders, FY2023.',
  },
};

const NOW = '2026-07-22T23:00:00.000Z';
const METHOD =
  'Artifacts and indicators are juxtaposed for context. Juxtaposition is not causation. Contested investigative claims carry uncertainty labels.';

const VERA = {
  observationId: 'obs:vera-jail-population-rate-county:county:17031:2024',
  metricId: 'vera-jail-population-rate-county',
  estimate: 141.51,
  unit: 'per_100k',
  referencePeriod: '2024',
  label: 'Cook County jail incarceration rate (Vera)',
  provenance: {
    source: 'vera-incarceration-trends',
    sourceUrl: 'https://www.vera.org/projects/incarceration-trends',
    retrievedAt: '2026-07-22T03:26:00.774Z',
    contentHash: '7f7dc1c0ab51e8dcd7786aa685f50de0d95826826c414802588e7b4047086258',
    humanCitation:
      'Vera Institute of Justice, Incarceration Trends — Cook County jail population rate, 2024.',
  },
};

const SCF_BLACK = {
  observationId: 'obs:scf-median-wealth-black-nation:nation:US:2022',
  metricId: 'scf-median-wealth-black-nation',
  estimate: 44900,
  unit: 'USD',
  referencePeriod: '2022',
  label: 'Median family net worth — Black families (SCF, national)',
  provenance: {
    source: 'fed-survey-consumer-finances',
    sourceUrl: 'https://www.federalreserve.gov/econres/scfindex.htm',
    retrievedAt: '2026-07-22T00:00:00.000Z',
    contentHash: 'da1f82445013ef3896f9bbcdb514c1d4621bb3e6a7d21d5d0ea807cb8e277dab',
    humanCitation:
      'Board of Governors of the Federal Reserve System, Survey of Consumer Finances 2022 — median net worth, Black families (national).',
  },
};

const SCF_WHITE = {
  observationId: 'obs:scf-median-wealth-white-nation:nation:US:2022',
  metricId: 'scf-median-wealth-white-nation',
  estimate: 285000,
  unit: 'USD',
  referencePeriod: '2022',
  label: 'Median family net worth — White non-Hispanic families (SCF, national)',
  provenance: {
    source: 'fed-survey-consumer-finances',
    sourceUrl: 'https://www.federalreserve.gov/econres/scfindex.htm',
    retrievedAt: '2026-07-22T00:00:00.000Z',
    contentHash: 'a9a4e9a7b77b3ab241a43958cc93622d0f280cd6e9309ac5877ac0c3e16559b5',
    humanCitation:
      'Board of Governors of the Federal Reserve System, Survey of Consumer Finances 2022 — median net worth, White non-Hispanic families (national).',
  },
};

const BJS_BLACK = {
  observationId: 'obs:imprisonment-rate-black-state:state:17:2023',
  metricId: 'imprisonment-rate-black-state',
  estimate: 940,
  unit: 'per_100k',
  referencePeriod: '2023',
  label: 'Illinois Black imprisonment rate (BJS NPS, derived)',
  provenance: {
    source: 'bjs-national-prisoner-statistics',
    sourceUrl: 'https://bjs.ojp.gov/data-collection/national-prisoner-statistics-nps',
    retrievedAt: '2026-07-22T21:01:45.256Z',
    contentHash: '61a6f6b849e482d6f1caa2652e20fe28fbb7ec957e07e3d39a6afe69c1e29645',
    humanCitation:
      'Bureau of Justice Statistics, National Prisoner Statistics — Illinois Black imprisonment rate per 100,000, 2023 (derived from Appendix table 1 counts and Census race population).',
  },
};

const BJS_WHITE = {
  observationId: 'obs:imprisonment-rate-white-state:state:17:2023',
  metricId: 'imprisonment-rate-white-state',
  estimate: 129,
  unit: 'per_100k',
  referencePeriod: '2023',
  label: 'Illinois White imprisonment rate (BJS NPS, derived)',
  provenance: {
    source: 'bjs-national-prisoner-statistics',
    sourceUrl: 'https://bjs.ojp.gov/data-collection/national-prisoner-statistics-nps',
    retrievedAt: '2026-07-22T21:01:45.256Z',
    contentHash: '1c5f408297c1fca13e9658833723bc9104e0586ffbcb7a561b51e1f2aa2c9406',
    humanCitation:
      'Bureau of Justice Statistics, National Prisoner Statistics — Illinois White imprisonment rate per 100,000, 2023 (derived from Appendix table 1 counts and Census race population).',
  },
};

export const drugPolicyPilotPackets = [
  {
    id: 'tip_drug_policy_q5_national',
    question_id: 'Q5',
    theme_id: 'drug_policy_state',
    title: 'Documented federal drug-policy statutes and related artifacts',
    summary:
      'Primary federal statutes that structured drug scheduling and mandatory-minimum enforcement, plus a contested investigative package shown only with an uncertainty label. No causal claim that any statute alone produced later disparities.',
    policy_eras: [
      'pre_drug_war',
      'drug_war_escalation',
      'crack_cocaine_era',
      'sentencing_reform',
    ],
    geography: {
      geographyType: 'nation',
      jurisdictionId: 'nation:US',
      boundaryVersion: 'nation-2020',
      label: 'United States (federal statute spine)',
      scopeKey: 'national:drug_policy',
    },
    method_stance: 'juxtaposition',
    method_note: METHOD,
    observations: [],
    derived: [],
    artifacts: [
      {
        artifactId: 'art_csa_1970',
        artifactClass: 'primary_government_document',
        title: 'Controlled Substances Act (1970)',
        dated: '1970-10-27',
        citation: 'Pub. L. 91-513, Controlled Substances Act (1970).',
        sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-84/pdf/STATUTE-84-Pg1236.pdf',
        summary: 'Federal scheduling framework for controlled substances.',
      },
      {
        artifactId: 'art_adaa_1986',
        artifactClass: 'primary_government_document',
        title: 'Anti-Drug Abuse Act of 1986',
        dated: '1986-10-27',
        citation: 'Pub. L. 99-570, Anti-Drug Abuse Act of 1986.',
        sourceUrl: 'https://www.congress.gov/bill/99th-congress/house-bill/5484',
        summary:
          'Mandatory minimum framework including the crack-to-powder cocaine sentencing disparity later amended in 2010.',
      },
      {
        artifactId: 'art_fsa_2010',
        artifactClass: 'primary_government_document',
        title: 'Fair Sentencing Act of 2010',
        dated: '2010-08-03',
        citation: 'Pub. L. 111-220, Fair Sentencing Act of 2010.',
        sourceUrl: 'https://www.congress.gov/bill/111th-congress/senate-bill/1789',
        summary: 'Reduced the crack-to-powder cocaine quantity ratio used in federal sentencing.',
      },
      {
        artifactId: 'art_investigative_contested',
        artifactClass: 'investigative_foia_package',
        title: 'Investigative reporting on intelligence-linked drug-market claims (contested)',
        dated: '1990s',
        citation:
          'Investigative journalism and later reviews of alleged intelligence-community links to drug markets — treat as contested secondary material, not settled fact.',
        uncertaintyLabel:
          'Contested — public packet cites the existence of investigative/FOIA debate only; does not assert verified government distribution of drugs.',
        summary:
          'Placeholder for curated primary FOIA captures when editorial review clears individual documents.',
      },
    ],
    gap_states: ['insufficient_evidence'],
    status: 'published',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'tip_drug_policy_q6_il_spine',
    question_id: 'Q6',
    theme_id: 'drug_policy_state',
    title: 'Jail, imprisonment, and wealth indicators beside drug-policy eras (IL / national)',
    summary:
      'Cook County Vera jail rates, Illinois BJS imprisonment rates (2023), and national SCF wealth medians shown beside drug-policy eras for juxtaposition. Causation not asserted.',
    policy_eras: [
      'drug_war_escalation',
      'crack_cocaine_era',
      'sentencing_reform',
    ],
    geography: {
      geographyType: 'state',
      jurisdictionId: 'state:17',
      boundaryVersion: 'state-2020',
      label: 'Illinois spine (Cook jail + IL imprisonment + national wealth)',
      scopeKey: 'state:17:drug_policy',
    },
    method_stance: 'juxtaposition',
    method_note: METHOD,
    observations: [
      VERA,
      BJS_BLACK,
      BJS_WHITE,
      SCF_BLACK,
      SCF_WHITE,
      USSC_CRACK_2023,
      USSC_POWDER_2023,
      USSC_BLACK_SHARE_2023,
    ],
    derived: [
      {
        derivedId: 'der_scf_wealth_gap_2022',
        methodId: 'black_white_wealth_gap',
        value: -240100,
        unit: 'USD',
        status: 'derived',
        formula: 'scf-median-wealth-black-nation - scf-median-wealth-white-nation',
        inputObservationIds: [SCF_BLACK.observationId, SCF_WHITE.observationId],
        label: 'Black-White median family net worth gap (national SCF 2022)',
        provenance: {
          source: 'fed-survey-consumer-finances',
          sourceUrl: 'https://www.federalreserve.gov/econres/scfindex.htm',
          retrievedAt: '2026-07-22T00:00:00.000Z',
          contentHash: 'sha256:derived-scf-wealth-gap-2022',
          humanCitation:
            'Derived from Federal Reserve SCF 2022 median net worth (Black vs White non-Hispanic families).',
        },
      },
      {
        derivedId: 'der_il_imprisonment_rate_gap_2023',
        methodId: 'black_white_imprisonment_rate_gap',
        value: 811,
        unit: 'per_100k',
        status: 'derived',
        formula: 'imprisonment-rate-black-state - imprisonment-rate-white-state',
        inputObservationIds: [BJS_BLACK.observationId, BJS_WHITE.observationId],
        label: 'Illinois Black–White imprisonment rate gap (2023)',
        provenance: {
          source: 'bjs-national-prisoner-statistics',
          sourceUrl: 'https://bjs.ojp.gov/data-collection/national-prisoner-statistics-nps',
          retrievedAt: '2026-07-22T21:01:45.256Z',
          contentHash: 'sha256:derived-il-imprisonment-gap-2023',
          humanCitation:
            'Derived from BJS NPS Illinois Black (940) and White (129) imprisonment rates per 100,000, 2023.',
        },
      },
      {
        derivedId: 'der_ussc_crack_powder_sentence_gap_2023',
        methodId: 'crack_powder_sentence_gap',
        value: -8,
        unit: 'months',
        status: 'derived',
        formula:
          'ussc-average-sentence-months-crack-nation - ussc-average-sentence-months-powder-nation',
        inputObservationIds: [USSC_CRACK_2023.observationId, USSC_POWDER_2023.observationId],
        label: 'Federal crack minus powder average sentence gap (FY2023)',
        provenance: {
          source: USSC_SOURCE,
          sourceUrl: USSC_URL,
          retrievedAt: USSC_RETRIEVED,
          contentHash: 'sha256:derived-ussc-crack-powder-gap-2023',
          humanCitation:
            'Derived from USSC Quick Facts FY2023 crack (60 mo.) and powder (68 mo.) average sentences.',
        },
      },
    ],
    artifacts: [],
    gap_states: [],
    status: 'published',
    created_at: NOW,
    updated_at: NOW,
  },
] as const;
