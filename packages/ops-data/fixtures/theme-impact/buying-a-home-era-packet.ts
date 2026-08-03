/**
 * "Buying a home" era-immersion theme packet (theme_id: redlining).
 *
 * Era-immersion rewrite per docs/content/era-immersion-style.md: a second-person
 * sequence of eras (1938, 1955, 1985) landing on a present-day (2023) close, each
 * era pairing a verbatim primary-document "rule in force" with the measured national
 * spine odds for that year. Numbers in the narrative are stated as odds/comparisons;
 * the exact figures and their provenance live in the observations below.
 *
 * Provenance note: every observation references a live bb_reference.statistical_observations
 * row (id, metric_id, estimate, reference_period, source, source_url, content_hash verified
 * against the warehouse on 2026-07-25). Every quoted passage references a live
 * bb_evidence.evidence_records / bb_canonical.claims row. National spine series
 * (spine-homeownership-black-us / -white-us) anchor the closing chart.
 *
 * method_stance: gated_causal_claim. Only the 1938 HOLC/FHA -> credit-access sentence
 * uses causal language, gated to Aaronson, Hartley & Mazumder (2021) via the artifact
 * claimId + packet causalClaimIds. Every other comparison (homeownership, income, wealth,
 * denial) is juxtaposition ("against", "alongside", "in the same year").
 *
 * This file is not wired into apply-theme-impact-packets.ts (that script publishes the
 * hardwired RESEARCHED_THEME_IMPACT_PACKETS set and requires status='published'). This
 * packet lands at status='review' via a direct upsert of the shape below into
 * bb_reference.theme_impact_packets.
 */

const REDLINING = 'redlining' as const;
const NOW = '2026-07-25T00:00:00.000Z';
const RETRIEVED = '2026-07-25T00:00:00.000Z';

const CENSUS_HOUSING_SOURCE = 'Census Bureau Historical Census of Housing Tables';
const CENSUS_HOUSING_URL =
  'https://www.census.gov/topics/housing/homeownership/data/historical.html';
const ACS_SOURCE = 'ACS 1-Year Detailed Tables';
const ACS_2023_URL = 'https://api.census.gov/data/2023/acs/acs1/subject?get=S2503_C03_001E';
const CENSUS_INCOME_SOURCE = 'U.S. Census Bureau';
const CENSUS_INCOME_URL =
  'https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx';
const DKKS_SOURCE = 'derenoncourt-wealth-of-two-nations';
const DKKS_URL = 'https://www.elloraderenoncourt.com/us-inequality-data';
const SCF_SOURCE = 'fed-survey-consumer-finances';
const SCF_URL = 'https://www.federalreserve.gov/econres/scfindex.htm';
const HMDA_SOURCE = 'hmda-loan-level';
const HMDA_URL = 'https://ffiec.cfpb.gov/data-browser/';

type Observation = {
  observationId: string;
  metricId: string;
  estimate: number;
  unit: string;
  referencePeriod: string;
  label: string;
  provenance: {
    source: string;
    sourceUrl: string;
    retrievedAt: string;
    contentHash: string;
    humanCitation: string;
  };
};

function obs(input: {
  observationId: string;
  metricId: string;
  estimate: number;
  unit: string;
  referencePeriod: string;
  label: string;
  source: string;
  sourceUrl: string;
  contentHash: string;
  humanCitation: string;
}): Observation {
  return {
    observationId: input.observationId,
    metricId: input.metricId,
    estimate: input.estimate,
    unit: input.unit,
    referencePeriod: input.referencePeriod,
    label: input.label,
    provenance: {
      source: input.source,
      sourceUrl: input.sourceUrl,
      retrievedAt: RETRIEVED,
      contentHash: input.contentHash,
      humanCitation: input.humanCitation,
    },
  };
}

const OBSERVATIONS: Observation[] = [
  // Era 1938 -> spine-homeownership at 1940
  obs({
    observationId: 'obs:census-decennial-homeownership-black-nation:nation:US:1940',
    metricId: 'census-decennial-homeownership-black-nation',
    estimate: 23.6,
    unit: 'percent',
    referencePeriod: '1940',
    label: 'Black homeownership rate, United States, 1940',
    source: CENSUS_HOUSING_SOURCE,
    sourceUrl: CENSUS_HOUSING_URL,
    contentHash: '2b4ebfbc772bcb791bd65d1271f805afeaa6d29ba8385a4a18d0be8426657a8b',
    humanCitation:
      'U.S. Census Bureau, Historical Census of Housing Tables, Black household homeownership rate, United States, 1940.',
  }),
  obs({
    observationId: 'obs:census-decennial-homeownership-white_nh-nation:nation:US:1940',
    metricId: 'census-decennial-homeownership-white_nh-nation',
    estimate: 53,
    unit: 'percent',
    referencePeriod: '1940',
    label: 'White homeownership rate, United States, 1940',
    source: CENSUS_HOUSING_SOURCE,
    sourceUrl: CENSUS_HOUSING_URL,
    contentHash: '5d001dfc63705ffdf8ff8b6cf21db6d0be5e92beecaff2283af3e19276e71969',
    humanCitation:
      'U.S. Census Bureau, Historical Census of Housing Tables, White household homeownership rate, United States, 1940.',
  }),
  // Era 1955 -> homeownership spine 1950 and 1960
  obs({
    observationId: 'obs:census-decennial-homeownership-black-nation:nation:US:1950',
    metricId: 'census-decennial-homeownership-black-nation',
    estimate: 34.9,
    unit: 'percent',
    referencePeriod: '1950',
    label: 'Black homeownership rate, United States, 1950',
    source: CENSUS_HOUSING_SOURCE,
    sourceUrl: CENSUS_HOUSING_URL,
    contentHash: '7c5152601505fee5551dca8a260fd644d8c31e58328f11f494a1bcb99b54f785',
    humanCitation:
      'U.S. Census Bureau, Historical Census of Housing Tables, Black household homeownership rate, United States, 1950.',
  }),
  obs({
    observationId: 'obs:census-decennial-homeownership-white_nh-nation:nation:US:1950',
    metricId: 'census-decennial-homeownership-white_nh-nation',
    estimate: 55.1,
    unit: 'percent',
    referencePeriod: '1950',
    label: 'White homeownership rate, United States, 1950',
    source: CENSUS_HOUSING_SOURCE,
    sourceUrl: CENSUS_HOUSING_URL,
    contentHash: 'cb0e0f34baae1c2dab3751b75543c18ac6c45ddb3286581805139d53044530b1',
    humanCitation:
      'U.S. Census Bureau, Historical Census of Housing Tables, White household homeownership rate, United States, 1950.',
  }),
  obs({
    observationId: 'obs:census-decennial-homeownership-black-nation:nation:US:1960',
    metricId: 'census-decennial-homeownership-black-nation',
    estimate: 38.4,
    unit: 'percent',
    referencePeriod: '1960',
    label: 'Black homeownership rate, United States, 1960',
    source: CENSUS_HOUSING_SOURCE,
    sourceUrl: CENSUS_HOUSING_URL,
    contentHash: '080210a13281150a7f4eff94318310b81091f0736dd2b0098612bb63a867ba79',
    humanCitation:
      'U.S. Census Bureau, Historical Census of Housing Tables, Black household homeownership rate, United States, 1960.',
  }),
  obs({
    observationId: 'obs:census-decennial-homeownership-white_nh-nation:nation:US:1960',
    metricId: 'census-decennial-homeownership-white_nh-nation',
    estimate: 64.9,
    unit: 'percent',
    referencePeriod: '1960',
    label: 'White homeownership rate, United States, 1960',
    source: CENSUS_HOUSING_SOURCE,
    sourceUrl: CENSUS_HOUSING_URL,
    contentHash: 'c8993cc7d9834b606b360851fb67bfcdab512234b36f465c102c8674c3fdc0b3',
    humanCitation:
      'U.S. Census Bureau, Historical Census of Housing Tables, White household homeownership rate, United States, 1960.',
  }),
  obs({
    observationId: 'obs:dkks-wealth-ratio-white-black-nation:nation:US:1959',
    metricId: 'dkks-wealth-ratio-white-black-nation',
    estimate: 8.110412,
    unit: 'ratio',
    referencePeriod: '1959',
    label: 'White-to-Black wealth ratio, United States, 1959',
    source: DKKS_SOURCE,
    sourceUrl: DKKS_URL,
    contentHash: 'a03371ff63bfa081ce214fd38bbd7d126c10f97b8dd8388cf2c37349910fe843',
    humanCitation:
      'Derenoncourt, Kim, Kuhn & Schularick, "Wealth of Two Nations", white-to-Black average wealth ratio, United States, 1959.',
  }),
  // Era 1985 -> homeownership spine 1980 (nearest decennial) + census income ratio 1985
  obs({
    observationId: 'obs:census-decennial-homeownership-black-nation:nation:US:1980',
    metricId: 'census-decennial-homeownership-black-nation',
    estimate: 44.4,
    unit: 'percent',
    referencePeriod: '1980',
    label: 'Black homeownership rate, United States, 1980',
    source: CENSUS_HOUSING_SOURCE,
    sourceUrl: CENSUS_HOUSING_URL,
    contentHash: 'b8ce1edee93e4d0737aaf87eac2912fcdaca5f441b583cd32ebc4b33fd5948d1',
    humanCitation:
      'U.S. Census Bureau, Historical Census of Housing Tables, Black household homeownership rate, United States, 1980.',
  }),
  obs({
    observationId: 'obs:census-decennial-homeownership-white_nh-nation:nation:US:1980',
    metricId: 'census-decennial-homeownership-white_nh-nation',
    estimate: 67.8,
    unit: 'percent',
    referencePeriod: '1980',
    label: 'White homeownership rate, United States, 1980',
    source: CENSUS_HOUSING_SOURCE,
    sourceUrl: CENSUS_HOUSING_URL,
    contentHash: '610bc8d477835448d454dd99daf3faa9acefa8c3262bc7cd024f31db97504a00',
    humanCitation:
      'U.S. Census Bureau, Historical Census of Housing Tables, White household homeownership rate, United States, 1980.',
  }),
  obs({
    observationId: 'census-h5-median-hh-income-black-nation:nation:US:1985',
    metricId: 'census-h5-median-hh-income-black-nation',
    estimate: 38630,
    unit: 'USD',
    referencePeriod: '1985',
    label: 'Median household income, Black householders, United States, 1985',
    source: CENSUS_INCOME_SOURCE,
    sourceUrl: CENSUS_INCOME_URL,
    contentHash: 'aecca67184ffc8d81c70d2a11ab1f5ec2c6ec83d50205ab15fd023c224292455',
    humanCitation:
      'U.S. Census Bureau, Historical Household Income Table H-5, median household income for Black householders, United States, 1985.',
  }),
  obs({
    observationId: 'census-h5-median-hh-income-white-nh-nation:nation:US:1985',
    metricId: 'census-h5-median-hh-income-white-nh-nation',
    estimate: 66390,
    unit: 'USD',
    referencePeriod: '1985',
    label: 'Median household income, White non-Hispanic householders, United States, 1985',
    source: CENSUS_INCOME_SOURCE,
    sourceUrl: CENSUS_INCOME_URL,
    contentHash: 'f63528bcc394a3f336380b2bc5b4fc46f3f9472363781a427b277b3eca53cef7',
    humanCitation:
      'U.S. Census Bureau, Historical Household Income Table H-5, median household income for White non-Hispanic householders, United States, 1985.',
  }),
  // Present-day close 2023/2022
  obs({
    observationId: 'obs:acs-homeownership-rate-black-nation:nation:US:2023',
    metricId: 'acs-homeownership-rate-black-nation',
    estimate: 45.6,
    unit: 'percent',
    referencePeriod: '2023',
    label: 'Black homeownership rate, United States, 2023',
    source: ACS_SOURCE,
    sourceUrl: ACS_2023_URL,
    contentHash: '3e34aadf58321eda4b367caa0ce61b2f3612f0fe16f2f45d1c907c4654acb074',
    humanCitation:
      'U.S. Census Bureau, ACS 2023 1-Year Estimates, table S2503, Black household homeownership rate, United States.',
  }),
  obs({
    observationId: 'obs:acs-homeownership-rate-white_nh-nation:nation:US:2023',
    metricId: 'acs-homeownership-rate-white_nh-nation',
    estimate: 74.2,
    unit: 'percent',
    referencePeriod: '2023',
    label: 'White homeownership rate, United States, 2023',
    source: ACS_SOURCE,
    sourceUrl: ACS_2023_URL,
    contentHash: '17051e9d31c38a6102e124e39b1f91d6c3d87e45291655843495f3fcc9bc5cd0',
    humanCitation:
      'U.S. Census Bureau, ACS 2023 1-Year Estimates, table S2503, White non-Hispanic household homeownership rate, United States.',
  }),
  obs({
    observationId: 'obs:hmda-denial-rate-black-nation:nation:US:2023',
    metricId: 'hmda-denial-rate-black-nation',
    estimate: 12.5,
    unit: 'percent',
    referencePeriod: '2023',
    label: 'Mortgage application denial rate, Black applicants, United States, 2023',
    source: HMDA_SOURCE,
    sourceUrl: HMDA_URL,
    contentHash: '45816dded1d4bdbecb82be203d67c44b9b3a6baba6ddfa7f2a03852e675bb237',
    humanCitation:
      'FFIEC HMDA Data Browser national aggregation, Black applicant mortgage denial rate, United States, 2023.',
  }),
  obs({
    observationId: 'obs:hmda-denial-rate-white-nh-nation:nation:US:2023',
    metricId: 'hmda-denial-rate-white-nh-nation',
    estimate: 6.2,
    unit: 'percent',
    referencePeriod: '2023',
    label: 'Mortgage application denial rate, White non-Hispanic applicants, United States, 2023',
    source: HMDA_SOURCE,
    sourceUrl: HMDA_URL,
    contentHash: '89b1421003b7cf75bbf5bbc5576354eeeeb2060b24b2e5aeb44c51c2a1d1e35b',
    humanCitation:
      'FFIEC HMDA Data Browser national aggregation, White non-Hispanic applicant mortgage denial rate, United States, 2023.',
  }),
  obs({
    observationId: 'obs:hmda-denial-rate-gap-black-white-nh-nation:nation:US:2023',
    metricId: 'hmda-denial-rate-gap-black-white-nh-nation',
    estimate: 6.3,
    unit: 'percentage_points',
    referencePeriod: '2023',
    label: 'Black minus White non-Hispanic mortgage denial-rate gap, United States, 2023',
    source: HMDA_SOURCE,
    sourceUrl: HMDA_URL,
    contentHash: '5db9c57b1645825c7f711f6c043cfb556f0082a88b533736a66bc9af24ea9fe2',
    humanCitation:
      'FFIEC HMDA Data Browser national aggregation, Black minus White non-Hispanic denial-rate gap, United States, 2023.',
  }),
  obs({
    observationId: 'obs:scf-median-wealth-black-nation:nation:US:2022',
    metricId: 'scf-median-wealth-black-nation',
    estimate: 44900,
    unit: 'USD',
    referencePeriod: '2022',
    label: 'Median family net worth, Black families, United States, 2022',
    source: SCF_SOURCE,
    sourceUrl: SCF_URL,
    contentHash: 'dba83f29e70701e9cf3a71a0a9a53e4c523734e9b13175ca0f6b60925a0b1896',
    humanCitation:
      'Federal Reserve Survey of Consumer Finances, median family net worth for Black families, United States, 2022, in 2022 dollars.',
  }),
  obs({
    observationId: 'obs:scf-median-wealth-white-nation:nation:US:2022',
    metricId: 'scf-median-wealth-white-nation',
    estimate: 285000,
    unit: 'USD',
    referencePeriod: '2022',
    label: 'Median family net worth, White non-Hispanic families, United States, 2022',
    source: SCF_SOURCE,
    sourceUrl: SCF_URL,
    contentHash: 'c0888ae94b6f822d748087894e2949525a81a3bfc90477786ddc2013bb299c99',
    humanCitation:
      'Federal Reserve Survey of Consumer Finances, median family net worth for White non-Hispanic families, United States, 2022, in 2022 dollars.',
  }),
];

const AAORNSON_CLAIM_ID = 'claim_holc_boundary_credit_access_aaronson_hartley_mazumder_2021';

const ARTIFACTS = [
  {
    artifactId: 'art_fha_underwriting_manual_1938_para935',
    artifactClass: 'primary_government_document',
    title: 'FHA Underwriting Manual (1938), paragraph 935',
    citation:
      'Federal Housing Administration, Underwriting Manual (1938 edition), paragraph 935, "Natural Physical Protection"; digitized by FRASER, Federal Reserve Bank of St. Louis.',
    sourceUrl:
      'https://fraser.stlouisfed.org/files/docs/publications/fha/1938feb_fha_underwritingmanual.pdf',
    dated: '1938',
    summary:
      'Rule in force, 1938. Verbatim: "Usually the protection from adverse influences afforded by these means includes prevention of the infiltration of business and industrial uses, lower class occupancy, and inharmonious racial groups." (evidence ev_fha_1938_para935 / claim_fha1938_para935; public domain).',
    provenance: {
      source: 'federal-housing-administration',
      sourceUrl:
        'https://fraser.stlouisfed.org/files/docs/publications/fha/1938feb_fha_underwritingmanual.pdf',
      retrievedAt: RETRIEVED,
      contentHash: '3ffb72303fbb14414a1dd62e3962b0a43168431eda96ef2e609628a6c1f2d6f2',
      humanCitation:
        'FHA Underwriting Manual (1938), paragraph 935, digitized by FRASER, Federal Reserve Bank of St. Louis.',
    },
  },
  {
    artifactId: 'art_holc_area_d30_near_north_chicago_1940',
    artifactClass: 'cartographic_grade_map',
    title: 'HOLC Area D-30 area description (Near North Side, Chicago), Mar. 1940',
    citation:
      'HOLC Residential Security map, Area D-30 (Near North Side, Chicago), Mar. 1940; Mapping Inequality, University of Richmond Digital Scholarship Lab.',
    sourceUrl:
      'https://dsl.richmond.edu/panorama/redlining/static/citiesData/ILChicago1940/areaDescriptions/D30.json',
    dated: '1940-03',
    summary:
      'Rule in force, Chicago D-area. Verbatim area description: "Negro population is largely concentrated south of Division St., and west of Wells St., but a continued infiltration of this race has caused an overflow north of that point; and it is reasonable to assume that the section may eventually become more negro than Italian." (evidence ev_holc_d30_nearnorth / claim_holc_d30; public domain).',
    provenance: {
      source: 'mapping-inequality-holc',
      sourceUrl:
        'https://dsl.richmond.edu/panorama/redlining/static/citiesData/ILChicago1940/areaDescriptions/D30.json',
      retrievedAt: RETRIEVED,
      contentHash: '17f3b75e7485b27e48cfe17c93bd234e1ad4b025a24fc0cd0eab00cf812d6ff0',
      humanCitation:
        'Nelson, Winling, et al., Mapping Inequality, HOLC Area D-30 (Near North Side, Chicago), Mar. 1940.',
    },
    uncertaintyLabel:
      'HOLC vector derivatives are CC BY-NC-SA; BlackStory cites the area description and does not republish polygons on commercial public surfaces.',
  },
  {
    artifactId: 'art_shelley_restrictive_covenant_st_louis_1911',
    artifactClass: 'primary_government_document',
    title: 'Restrictive covenant at issue in Shelley v. Kraemer (St. Louis, recorded 1911)',
    citation:
      'Racially restrictive covenant, Labadie Avenue, St. Louis, Missouri (signed Feb. 1911); at issue in Shelley v. Kraemer, 334 U.S. 1 (1948). The Court’s opinion dates the signing Feb. 16, 1911; the National Historic Landmark nomination for 4600 Labadie dates the instrument Feb. 6, 1911. No fetched source establishes a recording date distinct from signing.',
    sourceUrl:
      'https://tile.loc.gov/storage-services/service/ll/usrep/usrep334/usrep334001/usrep334001.pdf',
    dated: '1911-02-16',
    summary:
      'Rule in force, covenant era. Verbatim: ". . . that hereafter no part of said property or any portion thereof shall be, for said term of Fifty-years, occupied by any person not of the Caucasian race, it being intended hereby to restrict the use of said property ... against the occupancy as owners or tenants of any portion of said property for resident or other purpose by people of the Negro or Mongolian Race." (evidence ev_shelley_covenant_st_louis / claim_shelley_covenant_stlouis; public domain). Judicial enforcement of such covenants was held unconstitutional in Shelley v. Kraemer (1948).',
    provenance: {
      source: 'shelley-v-kraemer-record',
      sourceUrl:
        'https://tile.loc.gov/storage-services/service/ll/usrep/usrep334/usrep334001/usrep334001.pdf',
      retrievedAt: RETRIEVED,
      contentHash: 'ev_shelley_covenant_st_louis',
      humanCitation:
        'Restrictive covenant, Labadie Avenue, St. Louis; Shelley v. Kraemer, 334 U.S. 1 (1948).',
    },
  },
  {
    artifactId: 'art_holc_ns_form8_area_description_1937',
    artifactClass: 'primary_government_document',
    title: 'HOLC Area Description form, NS Form-8 (rev. June 1, 1937), with printed instructions',
    citation:
      'Home Owners’ Loan Corporation, "Area Description," NS Form-8 (rev. 6-1-37), front and printed instructions on reverse; in "Charlotte, NC, Security Map and Area Description No. 1," Records of the Federal Home Loan Bank Board, Record Group 195, National Archives at College Park.',
    sourceUrl: 'https://catalog.archives.gov/id/326761289',
    dated: '1937-06-01',
    summary:
      'The instrument itself: one sheet, fifteen numbered items on the front, fifteen matching instructions on the reverse. Item 5, "Inhabitants," collects type, estimated annual family income, foreign-born nationality and percent, "d. Negro (Yes or No); %", "e. Infiltration of", relief families, and whether population is increasing, decreasing or static. The printed instruction for item 5e supplies the government’s own worked example of the answer: "Any threat of infiltration of foreign born, negro or lower grade population? If so, indicate these by nationality and rate of infiltration like this: ‘Negro - rapid’." Item 4 directs the surveyor to record, among detrimental influences, "infiltrations of lower grade population or different racial groups" (public domain).',
    provenance: {
      source: 'national-archives-rg195',
      sourceUrl: 'https://catalog.archives.gov/id/326761289',
      retrievedAt: RETRIEVED,
      contentHash: '96e3c2fc0b68ce9d6123b00871696f463da7dc7035d50139e86ac115cea58150',
      humanCitation:
        'HOLC Area Description form, NS Form-8 (rev. 6-1-37), RG 195, National Archives (Charlotte, NC, Area 1).',
    },
  },
  {
    artifactId: 'art_buchanan_v_warley_1917',
    artifactClass: 'primary_government_document',
    title: 'Buchanan v. Warley, 245 U.S. 60 (Nov. 5, 1917)',
    citation:
      'Buchanan v. Warley, 245 U.S. 60 (1917); official United States Reports, Library of Congress.',
    sourceUrl:
      'https://tile.loc.gov/storage-services/service/ll/usrep/usrep245/usrep245060/usrep245060.pdf',
    dated: '1917-11-05',
    summary:
      'Rule in force, covenant era. The Court struck down Louisville’s racial-occupancy ordinance on Fourteenth Amendment property grounds, resting on an owner’s right to dispose of property rather than on a buyer’s right to acquire it: "Property is more than the mere thing which a person owns. It is elementary that it includes the right to acquire, use, and dispose of it." The opinion describes that right as running to Black and white owners alike, and states that Black citizens "have the right to purchase property and enjoy and use the same without laws discriminating against them solely on account of color." Closing the statutory route left the private covenant as the working instrument: covenant-writing in St. Louis, already under way by 1910, rose from 35 across the 1910s to 286 in the following decade (public domain).',
    provenance: {
      source: 'library-of-congress-us-reports',
      sourceUrl:
        'https://tile.loc.gov/storage-services/service/ll/usrep/usrep245/usrep245060/usrep245060.pdf',
      retrievedAt: RETRIEVED,
      contentHash: 'ddc4dcea60ac92c770dd0afbfcf61b13b4ab816f0c38c3f937b4c6e1e9b89a07',
      humanCitation: 'Buchanan v. Warley, 245 U.S. 60 (1917).',
    },
  },
  {
    artifactId: 'art_shelley_v_kraemer_1948',
    artifactClass: 'primary_government_document',
    title: 'Shelley v. Kraemer, 334 U.S. 1 (May 3, 1948)',
    citation:
      'Shelley v. Kraemer, 334 U.S. 1 (1948); official United States Reports, Library of Congress. Procedural history, vote tally and local aftermath: National Park Service, "The Shelley House," National Register registration form (ref. 88000437).',
    sourceUrl:
      'https://tile.loc.gov/storage-services/service/ll/usrep/usrep334/usrep334001/usrep334001.pdf',
    dated: '1948-05-03',
    summary:
      'Rule in force, 1948. The holding is narrow and the narrowness is the point: "Such private agreements standing alone do not violate any rights guaranteed by the Fourteenth Amendment," and owners remain free to honor them voluntarily; what is unconstitutional is judicial enforcement, because "the action of state courts and judicial officers in their official capacities is to be regarded as action of the State." The Shelleys received a warranty deed to 4600 Labadie Avenue on Aug. 11, 1945, and the trial court found they had no actual knowledge of the 1911 agreement when they bought. The 6–0 tally, with three Justices not sitting, is the Park Service’s; the opinion itself records only that Justices Reed, Jackson and Rutledge took no part (public domain).',
    provenance: {
      source: 'library-of-congress-us-reports',
      sourceUrl:
        'https://tile.loc.gov/storage-services/service/ll/usrep/usrep334/usrep334001/usrep334001.pdf',
      retrievedAt: RETRIEVED,
      contentHash: '83d0f83a1b0cb9980d3267bf58c5ac8cb5357d982c0d18fcf0695ff543cc19d6',
      humanCitation: 'Shelley v. Kraemer, 334 U.S. 1 (1948).',
    },
  },
  {
    artifactId: 'art_cfpb_contract_for_deed_2024',
    artifactClass: 'federal_agency_report',
    title: 'CFPB, Report on Contract for Deed Lending (Aug. 2024)',
    citation:
      'Consumer Financial Protection Bureau, "Report on Contract for Deed Lending" (August 2024), ch. 3 and Appendix A. Chicago findings quoted therein from the Samuel DuBois Cook Center on Social Equity, Duke University, "The Plunder of Black Wealth in Chicago" (May 2019), at iii.',
    sourceUrl:
      'https://files.consumerfinance.gov/f/documents/cfpb_contract-for-deed_report_2024-08.pdf',
    dated: '2024-08',
    summary:
      'The federal government’s own account of the instrument that filled the gap where mortgages were refused. Under a contract for deed "the seller retains legal title of a home until the borrower completes the payments," while the buyer carries taxes, repairs and improvements; on default the seller "may repossess the home and retain all accumulated equity and payments." No appraisal, inspection or title search is performed, and default ends in eviction rather than the 120-day pre-foreclosure process mainstream mortgages require. The report records that 75 to 95 percent of homes sold to Black families in Chicago in the 1950s and 1960s were sold on contract, at an average 84 percent above the speculator’s own purchase price.',
    provenance: {
      source: 'consumer-financial-protection-bureau',
      sourceUrl:
        'https://files.consumerfinance.gov/f/documents/cfpb_contract-for-deed_report_2024-08.pdf',
      retrievedAt: RETRIEVED,
      contentHash: '14418e7e0575dcc733fbeb02da06c3fb52a018982a73be48265ace7f2cda8344',
      humanCitation:
        'Consumer Financial Protection Bureau, Report on Contract for Deed Lending (August 2024).',
    },
    uncertaintyLabel:
      'The Chicago share and markup figures originate with the Duke Cook Center report and are quoted here as reproduced in the CFPB report, whose host is reachable; the Cook Center’s own host no longer serves the PDF.',
  },
  {
    artifactId: 'art_fair_housing_act_1968_doj',
    artifactClass: 'primary_government_document',
    title: 'Fair Housing Act of 1968',
    citation:
      'Civil Rights Act of 1968, Title VIII (Fair Housing Act), 42 U.S.C. §§ 3601 et seq.; U.S. Department of Justice overview.',
    sourceUrl: 'https://www.justice.gov/crt/fair-housing-act-1',
    dated: '1968-04-11',
    summary:
      'Rule in force, 1985 era: federal ban on race discrimination in the sale, rental, and financing of housing. The covenant and the manual language are void by this point; the ownership and income gaps persist.',
    provenance: {
      source: 'department-of-justice',
      sourceUrl: 'https://www.justice.gov/crt/fair-housing-act-1',
      retrievedAt: RETRIEVED,
      contentHash: 'fa07ed8cfb835e172dfc8d21ad9629ed244652d73c207eae42a97dba8a9cb32e',
      humanCitation:
        'Civil Rights Act of 1968, Title VIII (Fair Housing Act), 42 U.S.C. §§ 3601 et seq.',
    },
  },
  {
    artifactId: 'art_fair_housing_act_1968_sec810_conciliation',
    artifactClass: 'primary_government_document',
    title:
      'Civil Rights Act of 1968, Title VIII, § 810(a) — conciliation as the only remedy (Apr. 11, 1968)',
    citation:
      'Civil Rights Act of 1968, Pub. L. 90-284, title VIII, § 810(a), Apr. 11, 1968, 82 Stat. 85; U.S. Government Publishing Office, Statutes at Large.',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-82/pdf/STATUTE-82-Pg73.pdf',
    dated: '1968-04-11',
    summary:
      'The enforcement clause of the law that made housing discrimination illegal, verbatim: "If the Secretary decides to resolve the complaint, he shall proceed to try to eliminate or correct the alleged discriminatory housing practice by informal methods of conference, conciliation, and persuasion." Where conciliation failed, § 810(d) gave the complainant thirty days to bring their own federal suit; § 812(c) capped punitive damages at $1,000 and allowed attorney’s fees only where the plaintiff was found unable to pay them; § 813(a) limited the Attorney General to pattern-or-practice cases. The Justice Department’s own history records that the Act gave the Secretary "no cease-and-desist authority" (public domain).',
    provenance: {
      source: 'govinfo-statutes-at-large',
      sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-82/pdf/STATUTE-82-Pg73.pdf',
      retrievedAt: RETRIEVED,
      contentHash: '6f769a06db36c70e8b1295ce2f96fd5e3e7317f3e9f2da9f45e937d4d0a2badd',
      humanCitation: 'Civil Rights Act of 1968, Pub. L. 90-284, title VIII, § 810(a), 82 Stat. 85.',
    },
  },
  {
    artifactId: 'art_fair_housing_amendments_act_1988',
    artifactClass: 'primary_government_document',
    title: 'Fair Housing Amendments Act of 1988, Pub. L. 100-430 (Sept. 13, 1988)',
    citation:
      'Fair Housing Amendments Act of 1988, Pub. L. 100-430, 102 Stat. 1619; civil penalties at 102 Stat. 1630; effective date at sec. 13(a). U.S. Government Publishing Office, Statutes at Large.',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-102/pdf/STATUTE-102-Pg1619.pdf',
    dated: '1988-09-13',
    summary:
      'The enforcement machinery stripped out of the 1968 Act, restored twenty years and eleven months later: administrative law judges empowered to order relief, and civil penalties not exceeding $10,000 for a first adjudicated violation, $25,000 for a second within five years and $50,000 for a third within seven. By its own terms the Act took effect on the 180th day after enactment, March 12, 1989 (public domain).',
    provenance: {
      source: 'govinfo-statutes-at-large',
      sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-102/pdf/STATUTE-102-Pg1619.pdf',
      retrievedAt: RETRIEVED,
      contentHash: 'ac7358f924861ba712bd782d704e3057a3abb5817834597fd3e046c089d3ce27',
      humanCitation: 'Fair Housing Amendments Act of 1988, Pub. L. 100-430, 102 Stat. 1619.',
    },
  },
  {
    artifactId: 'art_aaronson_hartley_mazumder_holc',
    artifactClass: 'peer_reviewed_synthesis',
    title: 'The Effects of the 1930s HOLC "Redlining" Maps',
    citation:
      'Daniel Aaronson, Daniel Hartley, and Bhashkar Mazumder, "The Effects of the 1930s HOLC \'Redlining\' Maps," American Economic Journal: Economic Policy 13, no. 4 (2021), doi:10.1257/pol.20190414.',
    sourceUrl: 'https://www.chicagofed.org/publications/working-papers/2017/wp2017-12',
    dated: '2021',
    summary:
      'Gating claim for the single causal sentence in the 1938 era: a boundary-discontinuity design finds the 1930s HOLC grade lines produced measurably different credit access and neighborhood trajectories on either side of the line, with the inference explicitly limited to that design and geography.',
    claimId: AAORNSON_CLAIM_ID,
    provenance: {
      source: 'federal-reserve-bank-of-chicago',
      sourceUrl: 'https://www.chicagofed.org/publications/working-papers/2017/wp2017-12',
      retrievedAt: RETRIEVED,
      contentHash: '6a6bcdb5d4542953c9fa07fd2dc7dfd9d6609c7baedb8b93bf7ca6622819cce2',
      humanCitation:
        'Aaronson, Hartley & Mazumder, "The Effects of the 1930s HOLC Redlining Maps," AEJ: Economic Policy 13(4), 2021.',
    },
  },
  {
    artifactId: 'art_spine_homeownership_black_white_1900_2024',
    artifactClass: 'spine_series_chart',
    title: 'National homeownership by race, 1900 to 2024 (closing chart)',
    citation:
      'BlackStory national spine series spine-homeownership-black-us and spine-homeownership-white-us, 1900 to 2024 (Census Historical Census of Housing spliced to ACS 1-Year).',
    sourceUrl: CENSUS_HOUSING_URL,
    dated: '1900-2024',
    summary:
      'Closing visual anchor: Black and White homeownership rates run together from 1900 to 2024 with the gap shaded. Spine ids: spine-homeownership-black-us, spine-homeownership-white-us. Endpoints: 1900 21.3 vs 48.5; 1940 23.6 vs 53.0; 2024 45.4 vs 74.0 (percent).',
    provenance: {
      source: 'blackstory-spine-series',
      sourceUrl: CENSUS_HOUSING_URL,
      retrievedAt: RETRIEVED,
      contentHash: 'spine-homeownership-black-us+spine-homeownership-white-us',
      humanCitation:
        'BlackStory spine-homeownership-black-us and spine-homeownership-white-us, 1900 to 2024.',
    },
  },
] as const;

const SUMMARY = [
  'You are filling out a loan application in 1938. The federal underwriting manual open on the desk sets the terms: it instructs the appraiser to weigh, as an adverse influence, "the infiltration of business and industrial uses, lower class occupancy, and inharmonious racial groups." Your block has already been surveyed. On the government’s own security map the Near North Side reads, in the appraiser’s hand, "Negro population is largely concentrated south of Division St., and west of Wells St., but a continued infiltration of this race has caused an overflow north of that point." The grade travels with the address, not the borrower. If you are Black, you own a home at about 24 in 100. If you are white, closer to 53 in 100. On the boundaries those maps drew, the later credit-access difference is documented rather than assumed: the 1930s HOLC grade lines produced measurably different mortgage access on either side of the line (Aaronson, Hartley, and Mazumder, 2021).',
  'Seventeen years pass. Your daughter signs for a house in 1955.',
  'The deed carries a clause the map never needed to say aloud: the lot may not "be, for said term of Fifty-years, occupied by any person not of the Caucasian race." A court will enforce it until 1948, and habit enforces it after. Alongside that language, the ownership numbers barely move: about 35 in 100 Black households own in 1950, against 55 in 100 white households; by 1960 it is 38 in 100 against 65 in 100. The wealth stacked behind those two doors is further apart still, roughly eight times as much for a white family as a Black one at the end of the decade.',
  'A generation passes. Your grandson gets a mortgage in 1985.',
  'The covenant is void, the manual language struck, the Fair Housing Act (1968) seventeen years on the books. The gap holds its shape: about 44 in 100 Black households own their home, against 68 in 100 white households. In the same year, a Black household’s median income sits at $38,630 against $66,390 for a white one.',
  'You apply online in 2023. No clause, no grade, no covenant: you upload documents to an underwriting system. It turns you down at about 1 in 8 if you are a Black applicant, and about 1 in 16 if you are white, roughly twice as likely to be denied. Homeownership stands at about 46 in 100 Black households against 74 in 100 white households, close to the spread the 1938 map opened with. The wealth behind the two applications is $44,900 against $285,000, about six to one.',
  'The line drawn in 1938 no longer appears on any map. It appears in the chart.',
].join('\n\n');

const METHOD_NOTE = [
  'National spine anchors, not a single-city model. Homeownership odds come from spine-homeownership-black-us / spine-homeownership-white-us (Census Historical Census of Housing spliced to ACS 1-Year). The 1938 era reads the 1940 decennial point; the covenant era brackets 1950 and 1960; the 1985 era reads the nearest decennial homeownership point (1980), since the homeownership spine has no 1985 value, while income is the exact 1985 Census H-5 series.',
  'Wealth: the mid-century figure is the Derenoncourt et al. white-to-Black average wealth ratio at the 1959 benchmark; the present-day figures are Federal Reserve Survey of Consumer Finances median family net worth for 2022, in 2022 dollars. Income: Census Historical Household Income Table H-5 median household income for 1985. Mortgage denial: FFIEC HMDA national application denial rates for 2023.',
  'Causal language is gated. Only the 1938 sentence citing Aaronson, Hartley & Mazumder (2021) uses causal wording, resting on that study’s boundary-discontinuity design and its stated limits. Every other pairing (homeownership, income, wealth, denial) is juxtaposition: the facts are placed next to each other and the prose does not claim one produced another.',
  'The Chicago HOLC area description is quoted as period evidence of how grades were written; grade text describes mapped areas, not a lending outcome. Primary-document quotes are verbatim from public-domain sources; the restrictive covenant is the St. Louis instrument at issue in Shelley v. Kraemer, 334 U.S. 1 (1948).',
  'Narrative facts in the chapter built on this packet follow docs/methodology/chapter-fact-validation.md: gathered from fetched primary or official sources, independently re-verified against those sources by a second pass, and cut or attributed by name where only one institution carries them. Eleven dated artifacts now anchor the chronology: the 1911 Labadie Avenue covenant, Buchanan v. Warley (1917), the 1938 FHA Underwriting Manual paragraph 935, the 1940 HOLC area description for Chicago D-30, Shelley v. Kraemer (1948), the Fair Housing Act of 1968 with its section 810(a) enforcement clause, the Fair Housing Amendments Act of 1988, the CFPB contract-for-deed report (2024), the Aaronson/Hartley/Mazumder study, and the national homeownership spine.',
  'Two dating disputes are preserved rather than resolved. The Labadie Avenue agreement is dated Feb. 16, 1911 in the Supreme Court’s opinion and Feb. 6, 1911 in the National Historic Landmark nomination; the chapter says February 1911. Nothing in the fetched record establishes a recording date distinct from signing, so "recorded" is not used. Chicago contract-selling shares and markups originate with the Duke Cook Center’s 2019 report and are cited as reproduced in the CFPB’s 2024 report, since the Cook Center host no longer serves the original PDF; the report’s dollar-total estimates are omitted because no reachable source carries them.',
].join(' ');

export const buyingAHomeEraPacket = {
  id: 'tip_buying_a_home_era',
  question_id: 'Q1',
  theme_id: REDLINING,
  title: 'Buying a home: the same twenty-point gap, four generations apart',
  summary: SUMMARY,
  policy_eras: ['holc_fha', 'fair_housing', 'cra_contemporary'],
  geography: {
    geographyType: 'nation',
    jurisdictionId: 'nation:US',
    boundaryVersion: 'nation-us',
    label: 'United States (national spine)',
  },
  method_stance: 'gated_causal_claim',
  method_note: METHOD_NOTE,
  observations: OBSERVATIONS,
  derived: [],
  artifacts: ARTIFACTS,
  gap_states: ['insufficient_evidence'],
  causal_claim_ids: [AAORNSON_CLAIM_ID],
  entity_id: null,
  binding_purpose: null,
  status: 'review',
  created_at: NOW,
  updated_at: NOW,
} as const;

export const buyingAHomeEraPackets = [buyingAHomeEraPacket] as const;
