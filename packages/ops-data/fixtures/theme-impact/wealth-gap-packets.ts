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

const RETRIEVED = '2026-07-26T00:00:00.000Z';

/**
 * Mechanism-spine artifacts: primary-document-backed events the racial-wealth-gap
 * literature (Brookings, Urban Institute, Boston Fed, Darity & Mullen) treats as
 * central to how the gap was made and kept, placed beside the DKKS/SCF ratio rather
 * than asserted as its single cause (method_stance stays juxtaposition — no
 * causalClaimIds). Each carries a live, checkable T1-T3 sourceUrl and a real sha256
 * contentHash over {artifactId, title, sourceUrl, dated}. Figures inside the summaries
 * are quoted from the cited source, not the packet's DB-bound statistical_observations.
 */
const MECHANISM_ARTIFACTS = [
  {
    artifactId: 'art_savannah_colloquy_1865',
    artifactClass: 'primary_government_document',
    title:
      'Minutes of the meeting between Black religious leaders and Union authorities, Savannah (Jan. 12, 1865)',
    citation:
      'Minutes of an interview between the colored ministers and church officers at Savannah with the Secretary of War and Major-Gen. Sherman, Jan. 12, 1865; published in the New-York Daily Tribune, Feb. 13, 1865. Transcription: Freedmen and Southern Society Project, University of Maryland.',
    sourceUrl: 'https://www.freedmen.umd.edu/savmtg.htm',
    dated: '1865-01-12',
    summary:
      'Four days before Special Field Orders No. 15, Sherman and Secretary of War Stanton met twenty Black religious leaders at Sherman’s Savannah headquarters and asked what their people needed. The group’s spokesman, Garrison Frazier, a 67-year-old Baptist minister who had bought freedom for himself and his wife about eight years earlier for $1,000 in gold and silver, answered: "The way we can best take care of ourselves is to have land, and turn it and till it by our own labor." The order that followed traces directly to this recorded answer.',
    provenance: {
      source: 'freedmen-and-southern-society-project',
      sourceUrl: 'https://www.freedmen.umd.edu/savmtg.htm',
      retrievedAt: '2026-07-27T00:00:00.000Z',
      contentHash: '4a0308333c3eb6e677377cbdabefb095f088f09403830a1567e57fdb6df53dea',
      humanCitation:
        'Savannah Colloquy minutes (Jan. 12, 1865), Freedmen and Southern Society Project transcription; published New-York Daily Tribune, Feb. 13, 1865.',
    },
  },
  {
    artifactId: 'art_special_field_orders_15_1865',
    artifactClass: 'primary_government_document',
    title: 'Special Field Orders, No. 15 (Sherman, Jan. 16, 1865)',
    citation:
      'Special Field Orders, No. 15, Headquarters Military Division of the Mississippi, by Maj. Gen. W. T. Sherman, Jan. 16, 1865; William A. Gladstone Afro-American Military Collection, Library of Congress (mss83434256). Original in RG 94, Records of the Adjutant General’s Office, National Archives.',
    sourceUrl: 'https://www.loc.gov/item/mss83434256/',
    dated: '1865-01-16',
    summary:
      'The "forty acres" promise, and its reversal. Sherman’s order set aside the abandoned coastal rice lands from Charleston, South Carolina to the St. Johns River in Florida for settlement by freed families in plots "not more than forty acres of tillable ground." Within months roughly 40,000 freedpeople had settled on about 400,000 acres. Later in 1865 President Andrew Johnson rescinded the order and restored the land to its former Confederate owners, ending the one federal attempt to hand freed families a landed asset base. The 1870 benchmark that follows (about twenty-one to one) is the wealth ledger of a freed population that started with almost nothing to hold.',
    provenance: {
      source: 'library-of-congress',
      sourceUrl: 'https://www.loc.gov/item/mss83434256/',
      retrievedAt: RETRIEVED,
      contentHash: '422fb1ec9f5ad2406ffd37523dd66113d7c805a40ad8afde4acf943432c11024',
      humanCitation:
        'Special Field Orders, No. 15 (Jan. 16, 1865), Gladstone Afro-American Military Collection, Library of Congress; original in RG 94, National Archives.',
    },
  },
  {
    artifactId: 'art_freedmans_savings_bank_collapse_1874',
    artifactClass: 'primary_government_document',
    title: "Freedman's Savings and Trust Company failure, 1874",
    citation:
      "Office of the Comptroller of the Currency, “The Freedman’s Savings Bank: Good Intentions Were Not Enough,” OCC history; corroborated by the National Archives, Prologue, “Providing for the Freedmen’s Savings and Trust Company” (1997).",
    sourceUrl:
      'https://www.occ.gov/about/who-we-are/history/history-of-the-occ/1863-1865/1863-1865-freedmans-savings-bank.html',
    dated: '1874',
    summary:
      'When the Freedman’s Savings Bank closed on June 29, 1874, the OCC records "61,144 depositors" with "losses of nearly $3 million." The bank’s deposits were not federally guaranteed and Congress declined to make depositors whole; many petitioned for decades and, in the end, only about half of depositors recovered roughly three-fifths of their accounts (National Archives, Prologue). The first Black financial institution most freedpeople trusted erased much of the small savings they had managed to accumulate after emancipation.',
    provenance: {
      source: 'office-of-the-comptroller-of-the-currency',
      sourceUrl:
        'https://www.occ.gov/about/who-we-are/history/history-of-the-occ/1863-1865/1863-1865-freedmans-savings-bank.html',
      retrievedAt: RETRIEVED,
      contentHash: 'f085ba67c293f2dfc2bf22a68e4879b2327df184a9316b4dda98fb5ec6ce06a0',
      humanCitation:
        'OCC history, "The Freedman’s Savings Bank"; 61,144 depositors, losses of nearly $3 million at the 1874 failure.',
    },
  },
  {
    artifactId: 'art_tulsa_tribune_1921_nab_negro',
    artifactClass: 'newspaper_report',
    title: '"Nab Negro for Attacking Girl in an Elevator," Tulsa Tribune (May 31, 1921)',
    citation:
      'Tulsa Tribune, May 31, 1921, front page. The article was torn out of the bound city edition before microfilming; its text survives in Loren Gill’s 1946 transcription (reprinted in the 2001 Oklahoma Commission report, p. 58) and a duplicate printed in the Tribune’s June 1 State Edition (Library of Congress, Headlines & Heroes).',
    sourceUrl:
      'https://blogs.loc.gov/headlinesandheroes/2021/05/tulsa-race-massacre-newspaper-complicity-and-coverage/',
    dated: '1921-05-31',
    summary:
      'The afternoon story that put a crowd outside the Tulsa County Courthouse. It reported the arrest of Dick Rowland, a Black shoe shiner, "charged with attempting to assault the 17-year-old white elevator girl in the Drexel Building." No record survives of what Sarah Page actually told police, and the case against Rowland was dismissed that September when she did not appear. Whether the same edition also carried a lynching editorial is disputed: eyewitness recollection says yes; the surviving copies are missing the pages that could settle it.',
    provenance: {
      source: 'library-of-congress',
      sourceUrl:
        'https://blogs.loc.gov/headlinesandheroes/2021/05/tulsa-race-massacre-newspaper-complicity-and-coverage/',
      retrievedAt: '2026-07-27T00:00:00.000Z',
      contentHash: 'cbcafb2b447a3b228eb8fb7b238c21f1472ea70f8a0e0d4ddb676a3474b23f5d',
      humanCitation:
        'Tulsa Tribune, May 31, 1921 (text via Gill 1946 transcription and June 1 State Edition; Library of Congress, Headlines & Heroes, 2021).',
    },
  },
  {
    artifactId: 'art_social_security_act_1935_exclusions',
    artifactClass: 'primary_government_document',
    title: 'Social Security Act of 1935: exclusion of agricultural labor and domestic service',
    citation:
      'Social Security Act of 1935, Pub. L. 74-271 (full text, SSA history office); context in Larry DeWitt, "The Decision to Exclude Agricultural and Domestic Workers from the 1935 Social Security Act," Social Security Bulletin 70(4), 2010.',
    sourceUrl: 'https://www.ssa.gov/history/35act.html',
    dated: '1935',
    summary:
      'The Act that built old-age insurance excluded, in its definition of covered "employment," both "agricultural labor" and "domestic service in a private home." At the time a large majority of Black workers were employed in exactly those two categories, so the exclusion left most Black workers outside the new program. The SSA history office’s own review (DeWitt, 2010) argues the exclusion was driven by tax-collection feasibility rather than proven racial intent; whatever the motive, the disproportionate effect on Black workers is not disputed. Shown here as juxtaposition, not a claim that this one statute set the later gap.',
    provenance: {
      source: 'social-security-administration',
      sourceUrl: 'https://www.ssa.gov/history/35act.html',
      retrievedAt: RETRIEVED,
      contentHash: 'ec1bba24facc76587a3e6d4e5203439fa9eb515d6b16a5ac428b93aa87f38f31',
      humanCitation:
        'Social Security Act of 1935 (SSA history office full text); "agricultural labor" and "domestic service" excluded from covered employment.',
    },
  },
  {
    artifactId: 'art_gi_bill_1944_local_administration',
    artifactClass: 'peer_reviewed_synthesis',
    title:
      "Servicemen's Readjustment Act of 1944 (GI Bill): local administration and the racial benefit gap",
    citation:
      'Sarah E. Turner and John Bound, "Closing the Gap or Widening the Divide: The Effects of the G.I. Bill and World War II on the Educational Outcomes of Black Americans," NBER Working Paper 9044 (2002); published in Journal of Economic History 63(1), 2003.',
    sourceUrl: 'https://www.nber.org/papers/w9044',
    dated: '1944',
    summary:
      'The GI Bill promised veterans college tuition and low-cost home and business loans, but delivered them through local banks, colleges, and Veterans Administration offices. Turner and Bound find that for Black veterans confined to the segregated South, the bill "had little effect on collegiate outcomes" and, on balance, widened rather than closed the Black-white education gap, because the local institutions that administered it were segregated or would not serve Black applicants. The largest asset-building program of its generation reached Black families far more weakly than white ones. Juxtaposed with the gap series, not asserted as its sole cause.',
    provenance: {
      source: 'national-bureau-of-economic-research',
      sourceUrl: 'https://www.nber.org/papers/w9044',
      retrievedAt: RETRIEVED,
      contentHash: '315deac078427fd867d91d0644ac7acb9f70464d0f43378d61b18798ebe4c494',
      humanCitation:
        'Turner & Bound, "Closing the Gap or Widening the Divide," NBER WP 9044 (2002) / J. Econ. History 63(1), 2003.',
    },
  },
  {
    artifactId: 'art_fair_housing_act_1968',
    artifactClass: 'primary_government_document',
    title: 'Civil Rights Act of 1968, Title VIII (Fair Housing Act), § 801 (Apr. 11, 1968)',
    citation:
      'Pub. L. 90-284, title VIII, § 801, Apr. 11, 1968, 82 Stat. 81; codified at 42 U.S.C. § 3601 (govinfo, U.S. Code). Passage sequence: U.S. House of Representatives, History, Art & Archives, "The Fair Housing Act of 1968."',
    sourceUrl:
      'https://www.govinfo.gov/content/pkg/USCODE-2023-title42/html/USCODE-2023-title42-chap45-subchapI-sec3601.htm',
    dated: '1968-04-11',
    summary:
      'The statute that made housing discrimination illegal, signed April 11, 1968 — one week after Dr. King was assassinated and one day after the House passed it. Its declaration of policy reads in full: "It is the policy of the United States to provide, within constitutional limitations, for fair housing throughout the United States." The homeownership gap the 1970 census counted two years later (about 42 Black homeowning families per hundred against about 65 white) is juxtaposed with this text, not attributed to it.',
    provenance: {
      source: 'govinfo-us-code',
      sourceUrl:
        'https://www.govinfo.gov/content/pkg/USCODE-2023-title42/html/USCODE-2023-title42-chap45-subchapI-sec3601.htm',
      retrievedAt: '2026-07-27T00:00:00.000Z',
      contentHash: 'e4aa3b5955ffae26ecb41d32451828a72640a425e5533b18400149a51c77c20b',
      humanCitation:
        'Fair Housing Act, Pub. L. 90-284, title VIII, § 801 (Apr. 11, 1968), 82 Stat. 81; 42 U.S.C. § 3601.',
    },
  },
  {
    artifactId: 'art_tulsa_race_riot_commission_2001',
    artifactClass: 'primary_government_document',
    title: 'Oklahoma Commission to Study the Tulsa Race Riot of 1921, final report (Feb. 28, 2001)',
    citation:
      'Oklahoma Commission to Study the Tulsa Race Riot of 1921, "Tulsa Race Riot" (Feb. 28, 2001), Oklahoma Historical Society.',
    sourceUrl: 'https://www.okhistory.org/research/forms/freport.pdf',
    dated: '2001-02-28',
    summary:
      'The state’s own accounting, eighty years on. The commission preserved the Red Cross count of 1,256 houses burned, found nearly ten thousand people left homeless, and confronted a death toll it could not fix: an official contemporary count of 36, a forensic floor of 38 identified victims, and "credible evidence" that the dead "likely number[ed] between one and three hundred." It also documented what blocked recovery: a June 7, 1921 fire ordinance aimed at preventing rebuilding (struck down in court), insurance denials under riot exclusion clauses, and a grand jury that blamed the victims; no white Tulsan was ever sent to prison.',
    provenance: {
      source: 'oklahoma-historical-society',
      sourceUrl: 'https://www.okhistory.org/research/forms/freport.pdf',
      retrievedAt: '2026-07-27T00:00:00.000Z',
      contentHash: '719c8a22083bc3a577e3040b54ed2be7fd6db6504cf858258aa9066ebdf93df1',
      humanCitation:
        'Oklahoma Commission to Study the Tulsa Race Riot of 1921, final report (2001), Oklahoma Historical Society.',
    },
  },
] as const;

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
  dkks1880: {
    observationId: 'obs:dkks-wealth-ratio-white-black-nation:nation:US:1880',
    spineId: 'spine-wealth-ratio-white-black-us',
    metricId: 'dkks-wealth-ratio-white-black-nation',
    estimate: 19.031258,
    unit: 'ratio',
    referencePeriod: '1880',
    label: 'White-to-Black per-capita wealth ratio (1880 benchmark)',
    provenance: {
      source: DKKS_SOURCE,
      sourceUrl: DKKS_URL,
      retrievedAt: NOW,
      contentHash: '2aad7b5b3ffa492509ff4ce06a298354f5614320833d014035053118d29bbc29',
      humanCitation: `${DKKS_HUMAN} 1880 benchmark.`,
    },
  },
  dkks1890: {
    observationId: 'obs:dkks-wealth-ratio-white-black-nation:nation:US:1890',
    spineId: 'spine-wealth-ratio-white-black-us',
    metricId: 'dkks-wealth-ratio-white-black-nation',
    estimate: 14.90131,
    unit: 'ratio',
    referencePeriod: '1890',
    label: 'White-to-Black per-capita wealth ratio (1890 benchmark)',
    provenance: {
      source: DKKS_SOURCE,
      sourceUrl: DKKS_URL,
      retrievedAt: NOW,
      contentHash: '8b873ed1e88f066f4e51b02ca720e038dc902a234ee0f004aac82427a99abd52',
      humanCitation: `${DKKS_HUMAN} 1890 benchmark.`,
    },
  },
  dkks1900: {
    observationId: 'obs:dkks-wealth-ratio-white-black-nation:nation:US:1900',
    spineId: 'spine-wealth-ratio-white-black-us',
    metricId: 'dkks-wealth-ratio-white-black-nation',
    estimate: 11.366488,
    unit: 'ratio',
    referencePeriod: '1900',
    label: 'White-to-Black per-capita wealth ratio (1900 benchmark)',
    provenance: {
      source: DKKS_SOURCE,
      sourceUrl: DKKS_URL,
      retrievedAt: NOW,
      contentHash: '82d4fc91f9fdd3664c1ef8da1f203ab3871a4752d0f5007b377a822fd87bbec5',
      humanCitation: `${DKKS_HUMAN} 1900 benchmark.`,
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
  'You are freed in 1863 with what the law lets you keep, which is nothing. Land, tools, a house: none of it comes with emancipation. The one federal attempt to hand freed families land, Sherman’s Special Field Orders No. 15 in 1865, set aside coastal acres in forty-acre plots, then President Johnson rescinded it that same year and gave the land back to its former owners. At the last count taken before the war the distance is almost total. For every dollar of wealth a Black person holds, a white person holds about fifty-six. The first count taken after slavery, in 1870, still reads about twenty-one to one.',
  'The century after that is a long, incomplete fall, not a jump: the ratio reads about nineteen to one in 1880, about fifteen to one in 1890, about eleven to one in 1900. Two events sit on that slope. In 1874 the Freedman’s Savings Bank fails, wiping out much of the small savings 61,144 depositors had managed to put away. The gap keeps narrowing, but slowly, and never closes.',
  '1921. In [[ent_greenwood_district_001|Greenwood]], thirty-five blocks on the north side of Tulsa, you have built something: banks, theaters, doctors, a grocery you own. Over two days the [[disc_tulsa_race_massacre_q1824714|Tulsa Race Massacre]] burns it to the ground. The national wealth ledger that decade reads about eleven to one. The series is national and the place is Greenwood; the number is not Greenwood’s alone.',
  'The New Deal and the postwar boom build the modern American middle class, largely on federal help that reached Black families weakly. The Social Security Act of 1935 excludes agricultural labor and domestic service, the two jobs that then held most Black workers. The 1944 GI Bill funds college and home loans through local banks and colleges that, in the segregated South, would not serve Black veterans. These are placed beside the gap, not asserted as its single cause.',
  '1968. You are reaching for the ladder everyone says is there. Two years later the census counts about forty-two Black families owning their home for every hundred, against about sixty-five white families, a gap of more than twenty homes in every hundred. When the household-income tape first measures both groups side by side, in 1972, a white family’s median sits close to one and three-quarter times a Black family’s.',
  '2022. You check your accounts. The Survey of Consumer Finances puts a typical Black family’s net worth at $44,900 against a typical white family’s $285,000, still about six to one. Counted per person rather than per household, the long benchmark series lands near seven to one. Either way the ratio has barely moved in four decades.',
  'Closing chart: the white-to-Black wealth ratio from 1860 to 2022, drawn as two distinguished segments (the per-capita mean back to 1860 and the household median from 1989), kept apart rather than spliced into one line. The century-long fall halts around 1980 and the post-1980 stall is marked where it flattens.',
  'Sources: Derenoncourt, Kim, Kuhn & Schularick per-capita wealth ratios; Federal Reserve Survey of Consumer Finances household medians and ratio; U.S. Census historical homeownership and household-income tables. The series sit next to one another across eras. Co-movement is context, not proof that one year’s rule set the next century’s gap.',
].join('\n\n');

const METHOD_NOTE = [
  'Two wealth series appear together and are kept visually distinct rather than spliced. The per-capita mean ratio (Derenoncourt, Kim, Kuhn & Schularick; spine-wealth-ratio-white-black-us) runs on benchmark years from 1860 to 2019. The emancipation-era readings (about fifty-six to one in 1860, about twenty-one to one in 1870) sit over a denominator near zero and are benchmark points, not annual figures.',
  'The household-median ratio (Survey of Consumer Finances; spine-wealth-ratio-median-hh-white-black-us) runs triennially from 1989 to 2022 and measures a different construct (median household net worth, not per-capita mean), so the two segments are never averaged or joined.',
  'The 1921 figure is the national 1922 benchmark; no Greenwood-specific wealth series exists, so the place is named while the number stays national. Homeownership is the 1970 decennial (nearest to 1968). The white-householder household-income series in this spine begins in 1972, so the income comparison uses 1972 rather than 1968. The per-capita benchmark series ends at 2019, so the most recent per-capita point is 2019, not 2020.',
  'The per-capita benchmark series is read at more than its endpoints: the 1880 (about 19.0), 1890 (about 14.9), and 1900 (about 11.4) benchmarks are shown so the century-long fall reads as a slow, incomplete decline rather than a jump from 1870 to the 1920s. These are the existing DKKS benchmark rows, not new derivations.',
  'Eight primary-document-backed artifacts sit on the packet, each with a checkable T1-T3 source: the Savannah Colloquy minutes (1865, Freedmen and Southern Society Project), Special Field Orders No. 15 (1865, Library of Congress / National Archives), the Freedman’s Savings Bank failure (1874, OCC history; National Archives Prologue), the Tulsa Tribune’s May 31, 1921 front page (Library of Congress; 2001 commission transcription), the Social Security Act’s exclusion of agricultural and domestic labor (1935, SSA full text), the GI Bill’s local administration (1944, Turner & Bound, NBER WP 9044), the Fair Housing Act’s declaration of policy (1968, govinfo), and the 2001 Oklahoma commission report on the Tulsa massacre (Oklahoma Historical Society). They are placed beside the ratio as mechanism context; the packet stance stays juxtaposition, with no causal-claim ids. Where the record itself is disputed (the 1935 exclusion’s motive; the 1921 death toll; the Tribune’s alleged lynching editorial), the dispute is stated rather than resolved. Narrative facts in the companion article follow docs/methodology/chapter-fact-validation.md: two independent fetched sources per fact, or a named primary-record holder attributed in the sentence.',
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
      OBS.dkks1880,
      OBS.dkks1890,
      OBS.dkks1900,
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
    artifacts: MECHANISM_ARTIFACTS,
    gap_states: ['insufficient_evidence'],
    entity_id: 'ent_greenwood_district_001',
    binding_purpose: 'story',
    status: 'review',
    created_at: NOW,
    updated_at: NOW,
  },
] as const;
