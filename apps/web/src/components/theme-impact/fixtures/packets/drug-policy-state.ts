/**
 * Drug policy & the state theme-impact packet fixtures (Q5–Q6) for the public shell.
 * Q5: federal statute artifact timeline (juxtaposition). Q6: Illinois/national spine
 * with Vera Cook County jail rate, corrected BJS imprisonment rates, and national SCF
 * wealth medians.
 */

import type { ThemeImpactPacketFixture } from '../types';

const VERA_RETRIEVED_AT = '2026-07-22T03:26:00.774Z';
const VERA_SOURCE_URL = 'https://www.vera.org/projects/incarceration-trends';
const SCF_RETRIEVED_AT = '2026-07-22T00:00:00.000Z';
const SCF_SOURCE_URL = 'https://www.federalreserve.gov/econres/scfindex.htm';
const CSA_SOURCE_URL =
  'https://www.govinfo.gov/content/pkg/STATUTE-84/pdf/STATUTE-84-Pg1236.pdf';
const ADAA_SOURCE_URL = 'https://www.congress.gov/bill/99th-congress/house-bill/5484';
const FSA_SOURCE_URL = 'https://www.congress.gov/bill/111th-congress/senate-bill/1789';

export const DRUG_POLICY_PACKET_FIXTURES: readonly ThemeImpactPacketFixture[] = [
  {
    questionId: 'Q5',
    themeId: 'drug_policy_state',
    question:
      'What documented government actions and artifacts describe state involvement in drug markets or drug-war enforcement affecting Black communities?',
    policyEras: [
      {
        id: 'pre_drug_war',
        label: 'Pre–drug-war enforcement baseline',
        span: 'through circa 1970',
      },
      {
        id: 'drug_war_escalation',
        label: 'Escalation & scheduling',
        span: 'circa 1971–1985',
      },
      {
        id: 'crack_cocaine_era',
        label: 'Crack / mandatory-minimum peak',
        span: 'circa 1986–2000s',
      },
      {
        id: 'sentencing_reform',
        label: 'Reform & partial rollback',
        span: 'circa 2010–present',
      },
    ],
    geography: {
      unit: 'national',
      label: 'United States — federal statute and investigative artifact spine',
    },
    methodStance: 'juxtaposition',
    methodNote:
      'Primary statutes and investigative packages are placed beside one another for context. Juxtaposition is not causation. Contested investigative claims carry uncertainty labels; this packet does not assert verified government distribution of drugs.',
    observationsSummary:
      'Federal scheduling (1970), mandatory-minimum escalation (1986), and partial sentencing rollback (2010) form a documented statute spine. A contested investigative package on intelligence-linked drug-market claims is cited only with an explicit uncertainty label.',
    observations: [],
    derived: [],
    artifacts: [
      {
        id: 'csa-1970',
        title: 'Controlled Substances Act (1970)',
        artifactClass: 'primary_government_document',
        dateLabel: '1970',
        summary:
          'Federal scheduling framework for controlled substances — the statutory basis for later drug-war enforcement and mandatory minimum statutes.',
        provenance: {
          source: 'primary-government-documents',
          source_url: CSA_SOURCE_URL,
          retrieved_at: '2026-07-22T00:00:00.000Z',
          content_hash: 'sha256:fixture-csa-1970-govinfo',
          humanCitation: 'Pub. L. 91-513, Controlled Substances Act (1970).',
        },
      },
      {
        id: 'anti-drug-abuse-1986',
        title: 'Anti-Drug Abuse Act of 1986',
        artifactClass: 'primary_government_document',
        dateLabel: '1986',
        summary:
          'Mandatory minimum framework including the crack-to-powder cocaine sentencing disparity later amended in 2010.',
        provenance: {
          source: 'primary-government-documents',
          source_url: ADAA_SOURCE_URL,
          retrieved_at: '2026-07-22T00:00:00.000Z',
          content_hash: 'sha256:fixture-adaa-1986-congress',
          humanCitation: 'Pub. L. 99-570, Anti-Drug Abuse Act of 1986.',
        },
      },
      {
        id: 'fair-sentencing-2010',
        title: 'Fair Sentencing Act of 2010',
        artifactClass: 'primary_government_document',
        dateLabel: '2010',
        summary:
          'Reduced the crack-to-powder cocaine quantity ratio used in federal sentencing.',
        provenance: {
          source: 'primary-government-documents',
          source_url: FSA_SOURCE_URL,
          retrieved_at: '2026-07-22T00:00:00.000Z',
          content_hash: 'sha256:fixture-fsa-2010-congress',
          humanCitation: 'Pub. L. 111-220, Fair Sentencing Act of 2010.',
        },
      },
      {
        id: 'investigative-contested-drug-market',
        title: 'Investigative reporting on intelligence-linked drug-market claims (contested)',
        artifactClass: 'investigative_foia_package',
        dateLabel: '1990s',
        summary:
          'Investigative journalism and later reviews of alleged intelligence-community links to drug markets — secondary material shown for debate context only, not as settled government action.',
        uncertaintyLabel:
          'Contested — public packet cites the existence of investigative and FOIA debate only; does not assert verified government distribution of drugs.',
        provenance: {
          source: 'investigative-foia-packages',
          source_url: 'https://www.nytimes.com/',
          retrieved_at: '2026-07-22T00:00:00.000Z',
          content_hash: 'sha256:fixture-investigative-contested-drug-market',
          humanCitation:
            'Investigative journalism and subsequent peer-reviewed and congressional responses to alleged intelligence-community drug-market links — treat as contested secondary material.',
        },
      },
    ],
    gapStates: ['insufficient_evidence'],
  },
  {
    questionId: 'Q6',
    themeId: 'drug_policy_state',
    question:
      'Across drug-policy eras, how did Black imprisonment / jail rates and related justice indicators change?',
    policyEras: [
      {
        id: 'drug_war_escalation',
        label: 'Escalation & scheduling',
        span: 'circa 1971–1985',
      },
      {
        id: 'crack_cocaine_era',
        label: 'Crack / mandatory-minimum peak',
        span: 'circa 1986–2000s',
      },
      {
        id: 'sentencing_reform',
        label: 'Reform & partial rollback',
        span: 'circa 2010–present',
      },
    ],
    geography: {
      unit: 'state',
      label:
        'Illinois spine — Cook County jail (Vera) + IL imprisonment rates (BJS) + national wealth (SCF)',
      boundaryVersion: 'state-2020',
    },
    methodStance: 'juxtaposition',
    methodNote:
      'Cook County jail rate (Vera), Illinois BJS imprisonment rates, and national SCF wealth medians are shown beside drug-policy eras for juxtaposition — not as proof that any statute alone caused later disparities.',
    observationsSummary:
      'Cook County jail incarceration rate stood at 141.51 per 100,000 residents in 2024 (Vera). Illinois 2023 imprisonment rates were 940 per 100,000 for Black residents and 129 for White residents (BJS NPS, derived) — a gap of 811 per 100,000. National SCF 2022 median family net worth was $44,900 for Black families and $285,000 for White non-Hispanic families — a derived gap of −$240,100.',
    observations: [
      {
        id: 'obs:vera-jail-population-rate-county:county:17031:2024',
        label: 'Cook County jail incarceration rate (Vera)',
        value: '141.51 per 100,000 residents',
        referencePeriod: '2024',
        provenance: {
          source: 'vera-incarceration-trends',
          source_url: VERA_SOURCE_URL,
          retrieved_at: VERA_RETRIEVED_AT,
          content_hash:
            'sha256:7f7dc1c0ab51e8dcd7786aa685f50de0d95826826c414802588e7b4047086258',
          humanCitation:
            'Vera Institute of Justice, Incarceration Trends — Cook County jail population rate, 2024.',
        },
      },
      {
        id: 'obs:imprisonment-rate-black-state:state:17:2023',
        label: 'Illinois Black imprisonment rate (BJS NPS, derived)',
        value: '940 per 100,000 residents',
        referencePeriod: '2023',
        provenance: {
          source: 'bjs-national-prisoner-statistics',
          source_url: 'https://bjs.ojp.gov/data-collection/national-prisoner-statistics-nps',
          retrieved_at: '2026-07-22T21:01:45.256Z',
          content_hash:
            'sha256:61a6f6b849e482d6f1caa2652e20fe28fbb7ec957e07e3d39a6afe69c1e29645',
          humanCitation:
            'Bureau of Justice Statistics, National Prisoner Statistics — Illinois Black imprisonment rate per 100,000, 2023 (derived from Appendix table 1 counts and Census race population).',
        },
      },
      {
        id: 'obs:imprisonment-rate-white-state:state:17:2023',
        label: 'Illinois White imprisonment rate (BJS NPS, derived)',
        value: '129 per 100,000 residents',
        referencePeriod: '2023',
        provenance: {
          source: 'bjs-national-prisoner-statistics',
          source_url: 'https://bjs.ojp.gov/data-collection/national-prisoner-statistics-nps',
          retrieved_at: '2026-07-22T21:01:45.256Z',
          content_hash:
            'sha256:1c5f408297c1fca13e9658833723bc9104e0586ffbcb7a561b51e1f2aa2c9406',
          humanCitation:
            'Bureau of Justice Statistics, National Prisoner Statistics — Illinois White imprisonment rate per 100,000, 2023 (derived from Appendix table 1 counts and Census race population).',
        },
      },
      {
        id: 'obs:scf-median-wealth-black-nation:nation:US:2022',
        label: 'Median family net worth — Black families (SCF, national)',
        value: '$44,900',
        referencePeriod: 'SCF 2022',
        provenance: {
          source: 'fed-survey-consumer-finances',
          source_url: SCF_SOURCE_URL,
          retrieved_at: SCF_RETRIEVED_AT,
          content_hash:
            'sha256:da1f82445013ef3896f9bbcdb514c1d4621bb3e6a7d21d5d0ea807cb8e277dab',
          humanCitation:
            'Board of Governors of the Federal Reserve System, Survey of Consumer Finances 2022 — median net worth, Black families (national).',
        },
      },
      {
        id: 'obs:scf-median-wealth-white-nation:nation:US:2022',
        label: 'Median family net worth — White non-Hispanic families (SCF, national)',
        value: '$285,000',
        referencePeriod: 'SCF 2022',
        provenance: {
          source: 'fed-survey-consumer-finances',
          source_url: SCF_SOURCE_URL,
          retrieved_at: SCF_RETRIEVED_AT,
          content_hash:
            'sha256:a9a4e9a7b77b3ab241a43958cc93622d0f280cd6e9309ac5877ac0c3e16559b5',
          humanCitation:
            'Board of Governors of the Federal Reserve System, Survey of Consumer Finances 2022 — median net worth, White non-Hispanic families (national).',
        },
      },
    ],
    derived: [
      {
        id: 'derived:black-white-wealth-gap:nation:US:2022',
        methodId: 'black_white_wealth_gap',
        label: 'Black − White median family net worth gap (national SCF 2022)',
        value: '−$240,100',
        provenance: {
          source: 'derived:black_white_wealth_gap',
          source_url: SCF_SOURCE_URL,
          retrieved_at: SCF_RETRIEVED_AT,
          content_hash: 'sha256:derived-scf-wealth-gap-2022',
          humanCitation:
            'Derived (status: derived): Black median ($44,900) minus White median ($285,000) = −$240,100. Inputs: obs:scf-median-wealth-black-nation:nation:US:2022 and obs:scf-median-wealth-white-nation:nation:US:2022.',
        },
      },
      {
        id: 'derived:il-imprisonment-rate-gap:state:17:2023',
        methodId: 'black_white_imprisonment_rate_gap',
        label: 'Illinois Black − White imprisonment rate gap (2023)',
        value: '811 per 100,000 residents',
        provenance: {
          source: 'derived:black_white_imprisonment_rate_gap',
          source_url: 'https://bjs.ojp.gov/data-collection/national-prisoner-statistics-nps',
          retrieved_at: '2026-07-22T21:01:45.256Z',
          content_hash: 'sha256:derived-il-imprisonment-gap-2023',
          humanCitation:
            'Derived from BJS NPS Illinois Black (940) and White (129) imprisonment rates per 100,000, 2023.',
        },
      },
    ],
    artifacts: [],
    gapStates: [],
  },
] as const;
