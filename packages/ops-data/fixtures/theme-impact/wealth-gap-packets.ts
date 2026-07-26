/**
 * "The gap that never closed" (theme_id: wealth_gap) era-immersion packet for
 * ThemeImpactPacket upsert. National spine series only; every figure resolves to
 * a bb_reference.spine_observations_v spine_id or a statistical_observations obs id
 * (listed in each observation row). method_stance: juxtaposition throughout; the
 * two wealth series are placed side by side across eras, never spliced into one line
 * and never presented as one causing the next. Lands at status='review'.
 *
 * Source of record for packages/ops-data/fixtures/theme-impact/upsert-wealth-gap-packets.sql.
 */
export const WEALTH_GAP_SCOPE = 'nation:us-wealth-gap' as const;
export const NATION_JURISDICTION = 'nation:US' as const;

const NOW = '2026-07-25T12:00:00.000Z';

const DKKS_SOURCE = 'derenoncourt-wealth-of-two-nations';
const DKKS_URL = 'https://www.elloraderenoncourt.com/us-inequality-data';
const DKKS_HUMAN =
  'Derenoncourt, Kim, Kuhn & Schularick, "Wealth of Two Nations: The U.S. Racial Wealth Gap, 1860–2020": benchmark-year mean per-capita white-to-Black wealth ratio.';

const SCF_SOURCE = 'fed-survey-consumer-finances';
const SCF_URL = 'https://www.federalreserve.gov/econres/scfindex.htm';
const SCF_HUMAN =
  'Federal Reserve Board, Survey of Consumer Finances: median household net worth by race/ethnicity.';

const CENSUS_HOMEOWN_SOURCE = 'Census Bureau Historical Census of Housing Tables';
const CENSUS_HOMEOWN_URL =
  'https://www.census.gov/topics/housing/homeownership/data/historical.html';

const CENSUS_INCOME_SOURCE = 'U.S. Census Bureau';
const CENSUS_INCOME_URL =
  'https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx';

type Provenance = {
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  contentHash: string;
  humanCitation: string;
};

/**
 * Every number the packet asserts, each bound to a verified obs id or spine id.
 * observationId uses the real statistical_observations id where one exists; where a
 * figure lives only in the spine view (white-householder income), the spine_id is
 * cited in observationId so the claim still resolves to a canonical row.
 */
const OBS = {
  dkks1860: {
    observationId: 'obs:dkks-wealth-ratio-white-black-nation:nation:US:1860',
    spineId: 'spine-wealth-ratio-white-black-us',
    metricId: 'dkks-wealth-ratio-white-black-nation',
    estimate: 56.343502,
    unit: 'ratio',
    referencePeriod: '1860',
    label: 'White-to-Black per-capita wealth ratio (last pre-war benchmark)',
    provenance: {
      source: DKKS_SOURCE,
      sourceUrl: DKKS_URL,
      retrievedAt: NOW,
      contentHash: '070aedc44301b712c6ebb00c9bf2db0500559934da8b290eac04d512b9d9b019',
      humanCitation: `${DKKS_HUMAN} 1860 benchmark.`,
    },
  },
  dkks1870: {
    observationId: 'obs:dkks-wealth-ratio-white-black-nation:nation:US:1870',
    spineId: 'spine-wealth-ratio-white-black-us',
    metricId: 'dkks-wealth-ratio-white-black-nation',
    estimate: 21.376862,
    unit: 'ratio',
    referencePeriod: '1870',
    label: 'White-to-Black per-capita wealth ratio (first post-slavery benchmark)',
    provenance: {
      source: DKKS_SOURCE,
      sourceUrl: DKKS_URL,
      retrievedAt: NOW,
      contentHash: '271431ae37c1cd77e3ddc71eca8044f07446ebe3f2b01236aa0c1a186394f978',
      humanCitation: `${DKKS_HUMAN} 1870 benchmark.`,
    },
  },
  dkks1922: {
    observationId: 'obs:dkks-wealth-ratio-white-black-nation:nation:US:1922',
    spineId: 'spine-wealth-ratio-white-black-us',
    metricId: 'dkks-wealth-ratio-white-black-nation',
    estimate: 10.64677,
    unit: 'ratio',
    referencePeriod: '1922',
    label: 'White-to-Black per-capita wealth ratio (1920s benchmark, national)',
    provenance: {
      source: DKKS_SOURCE,
      sourceUrl: DKKS_URL,
      retrievedAt: NOW,
      contentHash: 'b251ec2982aebe04c2a8b7c2d94bc0941e4f50aeb7adec7fff17777a0a4b8a84',
      humanCitation: `${DKKS_HUMAN} 1922 benchmark (nearest to 1921).`,
    },
  },
  dkks2019: {
    observationId: 'obs:dkks-wealth-ratio-white-black-nation:nation:US:2019',
    spineId: 'spine-wealth-ratio-white-black-us',
    metricId: 'dkks-wealth-ratio-white-black-nation',
    estimate: 6.581615,
    unit: 'ratio',
    referencePeriod: '2019',
    label: 'White-to-Black per-capita wealth ratio (latest DKKS benchmark)',
    provenance: {
      source: DKKS_SOURCE,
      sourceUrl: DKKS_URL,
      retrievedAt: NOW,
      contentHash: '3d14a3b861aca9ab71b023fb27f343e10f3dcb4fedad52b38de6bd045a9567df',
      humanCitation: `${DKKS_HUMAN} 2019 benchmark (series ends 2019; no 2020 point).`,
    },
  },
  homeownBlack1970: {
    observationId: 'obs:census-decennial-homeownership-black-nation:nation:US:1970',
    spineId: 'spine-homeownership-black-us',
    metricId: 'census-decennial-homeownership-black-nation',
    estimate: 42.0,
    unit: 'percent',
    referencePeriod: '1970',
    label: 'Black homeownership rate (1970 decennial)',
    provenance: {
      source: CENSUS_HOMEOWN_SOURCE,
      sourceUrl: CENSUS_HOMEOWN_URL,
      retrievedAt: NOW,
      contentHash: '26f5415a3722dbc0ee681dacbeba9aa6cc399d4657be92835d9071d1b7d1855e',
      humanCitation:
        'U.S. Census Bureau, Historical Census of Housing Tables, homeownership by race, Black householders, 1970.',
    },
  },
  homeownWhite1970: {
    observationId: 'obs:census-decennial-homeownership-white_nh-nation:nation:US:1970',
    spineId: 'spine-homeownership-white-us',
    metricId: 'census-decennial-homeownership-white_nh-nation',
    estimate: 65.3,
    unit: 'percent',
    referencePeriod: '1970',
    label: 'White homeownership rate (1970 decennial)',
    provenance: {
      source: CENSUS_HOMEOWN_SOURCE,
      sourceUrl: CENSUS_HOMEOWN_URL,
      retrievedAt: NOW,
      contentHash: '041766ac41853d97eda300ec7cee104fb28edda1a07dbaa4a5bc5f37f42b91c1',
      humanCitation:
        'U.S. Census Bureau, Historical Census of Housing Tables, homeownership by race, White householders, 1970.',
    },
  },
  incomeBlack1972: {
    observationId: 'census-h5-median-hh-income-black-nation:nation:US:1972',
    spineId: 'spine-median-hh-income-black-us',
    metricId: 'census-h5-median-hh-income-black-nation',
    estimate: 37250,
    unit: 'USD',
    referencePeriod: '1972',
    label: 'Median household income, Black householders (1972, 2023 dollars)',
    provenance: {
      source: CENSUS_INCOME_SOURCE,
      sourceUrl: CENSUS_INCOME_URL,
      retrievedAt: NOW,
      contentHash: '23170bebf08194faf9ecd7320af877f57d1f0353414f42dea1ec519284685f2b',
      humanCitation:
        'U.S. Census Bureau, Historical Household Income Tables H-5, Black householders, 1972.',
    },
  },
  incomeWhite1972: {
    // White-householder income lives only in the spine view; cite the spine_id.
    observationId: 'spine:spine-median-hh-income-white-us:1972',
    spineId: 'spine-median-hh-income-white-us',
    metricId: 'census-h5-median-hh-income-white-nation',
    estimate: 64730,
    unit: 'USD',
    referencePeriod: '1972',
    label: 'Median household income, White householders (1972, 2023 dollars)',
    provenance: {
      source: CENSUS_INCOME_SOURCE,
      sourceUrl: CENSUS_INCOME_URL,
      retrievedAt: NOW,
      // Spine refs carry no canonical content_hash of their own; bind to the
      // underlying source row (census-h5-median-hh-income-white-nh-nation:1972,
      // estimate 64730), the real content this spliced spine value derives from.
      contentHash: 'a813fa452ea4b0d5072b6a80e1fe17d05f200a4b60be47a4561f7f4746729ff8',
      humanCitation:
        'U.S. Census Bureau, Historical Household Income Tables H-5, White householders, 1972 (spine series spine-median-hh-income-white-us; series begins 1972).',
    },
  },
  scfBlack2022: {
    observationId: 'obs:scf-median-wealth-black-nation:nation:US:2022',
    spineId: 'spine-wealth-ratio-median-hh-white-black-us',
    metricId: 'scf-median-wealth-black-nation',
    estimate: 44900,
    unit: 'USD',
    referencePeriod: '2022',
    label: 'Median household net worth, Black families (2022 SCF)',
    provenance: {
      source: SCF_SOURCE,
      sourceUrl: SCF_URL,
      retrievedAt: NOW,
      contentHash: 'dba83f29e70701e9cf3a71a0a9a53e4c523734e9b13175ca0f6b60925a0b1896',
      humanCitation: `${SCF_HUMAN} Black families, 2022.`,
    },
  },
  scfWhite2022: {
    observationId: 'obs:scf-median-wealth-white-nation:nation:US:2022',
    spineId: 'spine-wealth-ratio-median-hh-white-black-us',
    metricId: 'scf-median-wealth-white-nation',
    estimate: 285000,
    unit: 'USD',
    referencePeriod: '2022',
    label: 'Median household net worth, White (non-Hispanic) families (2022 SCF)',
    provenance: {
      source: SCF_SOURCE,
      sourceUrl: SCF_URL,
      retrievedAt: NOW,
      contentHash: 'c0888ae94b6f822d748087894e2949525a81a3bfc90477786ddc2013bb299c99',
      humanCitation: `${SCF_HUMAN} White non-Hispanic families, 2022.`,
    },
  },
  scfRatio2022: {
    observationId: 'obs:scf-wealth-ratio-white-black-nation:nation:US:2022',
    spineId: 'spine-wealth-ratio-median-hh-white-black-us',
    metricId: 'scf-wealth-ratio-white-black-nation',
    estimate: 6.34743875278396,
    unit: 'ratio',
    referencePeriod: '2022',
    label: 'White-to-Black median household wealth ratio (2022 SCF)',
    provenance: {
      source: SCF_SOURCE,
      sourceUrl:
        'https://www.federalreserve.gov/econres/notes/feds-notes/greater-wealth-greater-uncertainty-changes-in-racial-inequality-in-the-survey-of-consumer-finances-accessible-20231018.htm',
      retrievedAt: NOW,
      contentHash: '0289da9876d532e28c4e7fa87a0a3310c95c7286d0de108b54f197ce6865dc9b',
      humanCitation: `${SCF_HUMAN} White-to-Black median ratio, 2022.`,
    },
  },
} as const;

const SUMMARY = [
  'You are freed in 1863 with what the law lets you keep, which is nothing. Land, tools, a house: none of it comes with emancipation. At the last count taken before the war the distance is almost total. For every dollar of wealth a Black person holds, a white person holds about fifty-six. The first count taken after slavery, in 1870, still reads about twenty-one to one.',
  '1921. In [[ent_greenwood_district_001|Greenwood]], thirty-five blocks on the north side of Tulsa, you have built something: banks, theaters, doctors, a grocery you own. Over two days the [[disc_tulsa_race_massacre_q1824714|Tulsa Race Massacre]] burns it to the ground. The national wealth ledger that decade reads about eleven to one. The series is national and the place is Greenwood; the number is not Greenwood’s alone.',
  '1968. You are reaching for the ladder everyone says is there. Two years later the census counts about forty-two Black families owning their home for every hundred, against about sixty-five white families, a gap of more than twenty homes in every hundred. When the household-income tape first measures both groups side by side, in 1972, a white family’s median sits close to one and three-quarter times a Black family’s.',
  '2022. You check your accounts. The Survey of Consumer Finances puts a typical Black family’s net worth at $44,900 against a typical white family’s $285,000, still about six to one. Counted per person rather than per household, the long benchmark series lands near seven to one. Either way the ratio has barely moved in four decades.',
  'Closing chart: the white-to-Black wealth ratio from 1860 to 2022, drawn as two distinguished segments (the per-capita mean back to 1860 and the household median from 1989), kept apart rather than spliced into one line. The century-long fall halts around 1980 and the post-1980 stall is marked where it flattens.',
  'Sources: Derenoncourt, Kim, Kuhn & Schularick per-capita wealth ratios; Federal Reserve Survey of Consumer Finances household medians and ratio; U.S. Census historical homeownership and household-income tables. The series sit next to one another across eras. Co-movement is context, not proof that one year’s rule set the next century’s gap.',
].join('\n\n');

const METHOD_NOTE = [
  'Two wealth series appear together and are kept visually distinct rather than spliced. The per-capita mean ratio (Derenoncourt, Kim, Kuhn & Schularick; spine-wealth-ratio-white-black-us) runs on benchmark years from 1860 to 2019. The emancipation-era readings (about fifty-six to one in 1860, about twenty-one to one in 1870) sit over a denominator near zero and are benchmark points, not annual figures.',
  'The household-median ratio (Survey of Consumer Finances; spine-wealth-ratio-median-hh-white-black-us) runs triennially from 1989 to 2022 and measures a different construct (median household net worth, not per-capita mean), so the two segments are never averaged or joined.',
  'The 1921 figure is the national 1922 benchmark; no Greenwood-specific wealth series exists, so the place is named while the number stays national. Homeownership is the 1970 decennial (nearest to 1968). The white-householder household-income series in this spine begins in 1972, so the income comparison uses 1972 rather than 1968. The per-capita benchmark series ends at 2019, so the most recent per-capita point is 2019, not 2020.',
  'The DKKS convergence-dynamics literature is cited for method context only; nothing in the narrative claims one era’s policy caused a later gap.',
].join(' ');

export const wealthGapPackets = [
  {
    id: 'tip_wealth_gap_gap_that_never_closed',
    question_id: 'Q13',
    theme_id: 'wealth_gap',
    title: 'The gap that never closed',
    summary: SUMMARY,
    policy_eras: [
      'emancipation',
      'black_wall_street',
      'civil_rights_era',
      'post_1980_stall',
    ],
    geography: {
      geographyType: 'nation',
      jurisdictionId: NATION_JURISDICTION,
      boundaryVersion: 'nation-us',
      label: 'United States (national spine)',
      scopeKey: WEALTH_GAP_SCOPE,
    },
    method_stance: 'juxtaposition',
    method_note: METHOD_NOTE,
    observations: [
      OBS.dkks1860,
      OBS.dkks1870,
      OBS.dkks1922,
      OBS.dkks2019,
      OBS.homeownBlack1970,
      OBS.homeownWhite1970,
      OBS.incomeBlack1972,
      OBS.incomeWhite1972,
      OBS.scfBlack2022,
      OBS.scfWhite2022,
      OBS.scfRatio2022,
    ],
    derived: [],
    artifacts: [],
    gap_states: ['insufficient_evidence'],
    entity_id: 'ent_greenwood_district_001',
    binding_purpose: 'story',
    status: 'review',
    created_at: NOW,
    updated_at: NOW,
  },
] as const;
