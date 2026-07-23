/**
 * Researched public theme-impact packets.
 *
 * This is the single checked-in packet source used by Postgres publication and
 * web fallback rendering. Observation values are verified snapshots of
 * bb_reference.statistical_observations. Artifact hashes are SHA-256 digests of
 * bytes fetched directly from the cited source on 2026-07-23.
 */
import { sha256Json } from '../publication/index.js';
import {
  buildThemeImpactPacket,
  type ThemeImpactPacket,
  type ThemeImpactPacketArtifact,
  type ThemeImpactPacketDerived,
  type ThemeImpactPacketObservation,
  type ThemeImpactProvenanceQuartet,
} from './theme-impact-packet.js';

const PACKET_CREATED_AT = '2026-07-22T23:00:00.000Z';
const PACKET_UPDATED_AT = '2026-07-23T22:30:00.000Z';
const ARTIFACT_RETRIEVED_AT = '2026-07-23T22:30:00.000Z';

const COOK_COUNTY = 'county:17031';
const NATION = 'nation:US';

type ObservationInput = {
  readonly metricId: string;
  readonly estimate: number;
  readonly unit: string;
  readonly referencePeriod: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly humanCitation: string;
  readonly label: string;
  readonly jurisdictionId?: string;
};

function observation(input: ObservationInput): ThemeImpactPacketObservation {
  const jurisdictionId = input.jurisdictionId ?? COOK_COUNTY;
  return {
    observationId: `obs:${input.metricId}:${jurisdictionId}:${input.referencePeriod}`,
    metricId: input.metricId,
    estimate: input.estimate,
    unit: input.unit,
    referencePeriod: input.referencePeriod,
    label: input.label,
    provenance: {
      source: input.source,
      sourceUrl: input.sourceUrl,
      retrievedAt: input.retrievedAt,
      contentHash: input.contentHash,
      humanCitation: input.humanCitation,
    },
  };
}

type ArtifactInput = {
  readonly artifactId: string;
  readonly artifactClass: string;
  readonly title: string;
  readonly citation: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly contentHash: string;
  readonly dated?: string;
  readonly summary?: string;
  readonly uncertaintyLabel?: string;
  readonly claimId?: string;
};

function artifact(input: ArtifactInput): ThemeImpactPacketArtifact {
  return {
    artifactId: input.artifactId,
    artifactClass: input.artifactClass,
    title: input.title,
    citation: input.citation,
    sourceUrl: input.sourceUrl,
    provenance: {
      source: input.source,
      sourceUrl: input.sourceUrl,
      retrievedAt: ARTIFACT_RETRIEVED_AT,
      contentHash: input.contentHash,
      humanCitation: input.citation,
    },
    ...(input.dated !== undefined ? { dated: input.dated } : {}),
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    ...(input.uncertaintyLabel !== undefined
      ? { uncertaintyLabel: input.uncertaintyLabel }
      : {}),
    ...(input.claimId !== undefined ? { claimId: input.claimId } : {}),
  };
}

function derived(input: {
  readonly derivedId: string;
  readonly methodId: string;
  readonly value: number;
  readonly unit: string;
  readonly formula: string;
  readonly inputObservationIds: readonly string[];
  readonly label: string;
  readonly sourceUrl: string;
  readonly humanCitation: string;
}): ThemeImpactPacketDerived {
  const contentHash = sha256Json({
    methodId: input.methodId,
    value: input.value,
    unit: input.unit,
    formula: input.formula,
    inputObservationIds: input.inputObservationIds,
  }).digest;
  return {
    derivedId: input.derivedId,
    methodId: input.methodId,
    value: input.value,
    unit: input.unit,
    status: 'derived',
    formula: input.formula,
    inputObservationIds: input.inputObservationIds,
    label: input.label,
    provenance: {
      source: 'blackstory-derived-measurement',
      sourceUrl: input.sourceUrl,
      retrievedAt: PACKET_UPDATED_AT,
      contentHash,
      humanCitation: input.humanCitation,
    },
  };
}

const ACS_RETRIEVED = '2026-07-22T03:05:50.014Z';
const ACS_URL = 'https://www.census.gov/programs-surveys/acs';
const NHGIS_RETRIEVED = '2026-07-22T21:58:00.998Z';
const HMDA_RETRIEVED = '2026-07-22T21:33:11.144Z';
const HMDA_URL = 'https://ffiec.cfpb.gov/data-browser/';
const CHAS_RETRIEVED = '2026-07-22T22:41:16.387Z';
const CHAS_URL = 'https://www.huduser.gov/portal/datasets/cp.html#data_2006-2023';
const SCF_RETRIEVED = '2026-07-22T21:09:27.026Z';
const SCF_INDEX_URL = 'https://www.federalreserve.gov/econres/scfindex.htm';
const SCF_ARTICLE_URL =
  'https://www.federalreserve.gov/econres/notes/feds-notes/greater-wealth-greater-uncertainty-changes-in-racial-inequality-in-the-survey-of-consumer-finances-accessible-20231018.htm';
const VERA_RETRIEVED = '2026-07-22T21:03:52.625Z';
const VERA_URL = 'https://www.vera.org/projects/incarceration-trends';
const BJS_RETRIEVED = '2026-07-22T21:01:45.256Z';
const BJS_URL = 'https://bjs.ojp.gov/data-collection/national-prisoner-statistics-nps';
const CENSUS_STATE_RACE_DENOMINATOR_URL =
  'https://api.census.gov/data/2023/acs/acs5?get=NAME%2CB03002_003E%2CB03002_004E&for=state%3A%2A';
const USSC_RETRIEVED = '2026-07-22T21:40:54.731Z';
const EJI_RETRIEVED = '2026-07-22T22:44:24.642Z';
const EJI_URL = 'https://www.atsdr.cdc.gov/placeandhealth/eji/eji-data-download.html';
const TRI_RETRIEVED = '2026-07-22T22:44:24.649Z';
const TRI_URL = 'https://www.epa.gov/toxics-release-inventory-tri-program';

const ACS = {
  blackShare: observation({
    metricId: 'acs-black-population-share-county',
    estimate: 22.2,
    unit: 'percent',
    referencePeriod: '2020-2024',
    source: 'acs-census-api',
    sourceUrl: ACS_URL,
    retrievedAt: ACS_RETRIEVED,
    contentHash: '2d39628107fb015dbf6c71829c4dbe533ab4bbbf0a74f2967a82bb4661d29657',
    humanCitation:
      'U.S. Census Bureau, ACS 2020–2024 5-Year Estimates, Black population share, Cook County, Illinois.',
    label: 'Black population share, Cook County',
  }),
  blackHomeownership: observation({
    metricId: 'acs-homeownership-rate-black-county',
    estimate: 41.5,
    unit: 'percent',
    referencePeriod: '2020-2024',
    source: 'acs-census-api',
    sourceUrl: ACS_URL,
    retrievedAt: ACS_RETRIEVED,
    contentHash: 'a5401ce177953edcbb9f3349204243696d836ed7fffb3d96a0ed3946a771f0f3',
    humanCitation:
      'U.S. Census Bureau, ACS 2020–2024 5-Year Estimates, Black household homeownership rate, Cook County, Illinois.',
    label: 'Black homeownership rate, Cook County',
  }),
  blackIncome: observation({
    metricId: 'acs-median-hh-income-black-county',
    estimate: 51523,
    unit: 'USD',
    referencePeriod: '2020-2024',
    source: 'acs-census-api',
    sourceUrl: ACS_URL,
    retrievedAt: ACS_RETRIEVED,
    contentHash: '64d710dd502f77b3f89ed7727b3b8915868311d675af55b930dcd2bd9c235a19',
    humanCitation:
      'U.S. Census Bureau, ACS 2020–2024 5-Year Estimates, median household income for Black householders, Cook County, Illinois.',
    label: 'Median household income, Black householders',
  }),
  whiteIncome: observation({
    metricId: 'acs-median-hh-income-white-county',
    estimate: 102809,
    unit: 'USD',
    referencePeriod: '2020-2024',
    source: 'acs-census-api',
    sourceUrl: ACS_URL,
    retrievedAt: ACS_RETRIEVED,
    contentHash: 'a5ba0cb4f6fd2695b00f4fc5767e6cdf32fcd084377c27171b32f018bb330a42',
    humanCitation:
      'U.S. Census Bureau, ACS 2020–2024 5-Year Estimates, median household income for White householders, Cook County, Illinois.',
    label: 'Median household income, White householders',
  }),
  blackPoverty: observation({
    metricId: 'acs-poverty-rate-black-county',
    estimate: 23.9,
    unit: 'percent',
    referencePeriod: '2020-2024',
    source: 'acs-census-api',
    sourceUrl: ACS_URL,
    retrievedAt: ACS_RETRIEVED,
    contentHash: '587a89b606a1dc77913822750b501ccb959d28a1bdc9690ddf5eaf4095a35bba',
    humanCitation:
      'U.S. Census Bureau, ACS 2020–2024 5-Year Estimates, poverty rate for the Black population, Cook County, Illinois.',
    label: 'Black poverty rate, Cook County',
  }),
  blackBaAttainment: observation({
    metricId: 'acs-ba-attainment-black-county',
    estimate: 26.8,
    unit: 'percent',
    referencePeriod: '2020-2024',
    source: 'acs-census-api',
    sourceUrl: ACS_URL,
    retrievedAt: ACS_RETRIEVED,
    contentHash: '935f92f822e6ba27e58effde24aa7b3d9ad5e39f33b6e29ea3b5a9235490b22b',
    humanCitation:
      'U.S. Census Bureau, ACS 2020–2024 5-Year Estimates, bachelor’s degree or higher among Black adults 25+, Cook County, Illinois.',
    label: 'Black bachelor’s attainment, Cook County',
  }),
} as const;

const NHGIS_HOMEOWNERSHIP = [
  ['black', '1990', 37.1, '0a0932dc4124f4b1e1a87c02845b0134384efae5001cca30f93ea19c52eaa0ae', 'https://www2.census.gov/census_1990/STF1A_ASCII/90STF1A-IL.ZIP'],
  ['black', '2000', 42, '9a15228fb95a1354c08521bfdb7d7b239d428e1726663ab73db3e7bee38bc59d', 'https://data.census.gov/table/DECENNIALSF12000.H015A?g=0500000US17031'],
  ['black', '2010', 41.2, 'fc18d1c9e341c40ea4288b9579bee9f6421215fe7087f259a9f53f95a3eeb438', 'https://data.census.gov/table/DECENNIALSF12010.HCT1?g=0500000US17031'],
  ['white', '1990', 63.8, '359beddd1a80d48f19ba7e92a06fc9d78ec8a48d85e84845657c9e0267ae9ea6', 'https://www2.census.gov/census_1990/STF1A_ASCII/90STF1A-IL.ZIP'],
  ['white', '2000', 66.7, '3f0e6bd893022b2cb05a5c4586373714735a4b262c2d9df2d3db3cb84c1b2d57', 'https://data.census.gov/table/DECENNIALSF12000.H015A?g=0500000US17031'],
  ['white', '2010', 67.2, 'a18dff2c53f2cfbfe47d3ed03288c6ff6da9dbd3443a6561461cbfb34dd01e26', 'https://data.census.gov/table/DECENNIALSF12010.HCT1?g=0500000US17031'],
] as const;

const nhgisHomeownership = NHGIS_HOMEOWNERSHIP.map(
  ([race, period, estimate, contentHash, sourceUrl]) =>
    observation({
      metricId: `nhgis-homeownership-rate-${race}-county`,
      estimate,
      unit: 'percent',
      referencePeriod: period,
      source: 'nhgis-county-race',
      sourceUrl,
      retrievedAt: NHGIS_RETRIEVED,
      contentHash,
      humanCitation: `IPUMS NHGIS and U.S. Census decennial tables, ${race === 'black' ? 'Black' : 'White'} household homeownership rate, Cook County, Illinois, ${period}.`,
      label: `${race === 'black' ? 'Black' : 'White'} homeownership rate, Cook County`,
    }),
);

const NHGIS_BLACK_SHARE = [
  ['1970', 20.9, '2dbbce63da2da8249fc6d9af93905e9b5976abdcb08cd864d7974215fcf8cdcf', 'https://www2.census.gov/prod2/decennial/documents/31679801n104-107.pdf'],
  ['1980', 22.8, '6bc3be07018e5ae356aec8dded0502048d88ea819412e9e44d7489677ee444f5', 'https://www2.census.gov/census_1980/1980_stf1_datadict.txt'],
  ['1990', 24.3, '08978e8ab7e772a2ff600914e5098d28abf2b55ad2a3d223b718d41608cf057a', 'https://www.nhgis.org/time-series-tables'],
  ['2000', 25, 'c1cc1da360a0eebe112efbb78f057941d358bab1c66c3742dba02396c2ee4cbd', 'https://www.nhgis.org/time-series-tables'],
  ['2010', 25, 'b30bc5d9e88c6f03bb524d0b76407128a7a8539672260b950119b92bd5d57a31', 'https://www.nhgis.org/time-series-tables'],
] as const;

const nhgisBlackShare = NHGIS_BLACK_SHARE.map(([period, estimate, contentHash, sourceUrl]) =>
  observation({
    metricId: 'nhgis-black-population-share-county',
    estimate,
    unit: 'percent',
    referencePeriod: period,
    source: 'nhgis-county-race',
    sourceUrl,
    retrievedAt: NHGIS_RETRIEVED,
    contentHash,
    humanCitation: `IPUMS NHGIS and U.S. Census decennial tables, Black population share, Cook County, Illinois, ${period}.`,
    label: 'Black population share, Cook County',
  }),
);

const hmda = [
  ['hmda-denial-rate-black-county', '2018', 41.5, '0104370e55e83eb202b6d915c8cd36dce0f0dcc267364a26f4485dec3faacdd8', 'Black applicant denial rate'],
  ['hmda-denial-rate-white-county', '2018', 22.8, 'c060c1e62fc98cc23907e011ce22e70091bc7f21e553abe5210b80a8e7ed7c1a', 'White applicant denial rate'],
  ['hmda-denial-rate-gap-black-white-county', '2018', 18.7, '9e615cfb1c2d043f30b3299eabaa72e21e0478ca114681357de63d2c5b983473', 'Black–White denial-rate gap'],
  ['hmda-denial-rate-black-county', '2023', 39, 'c91ea473e3a425895072b9205d78a7cfc7b80b2108eb1ef73f0fac06e2a1b9ef', 'Black applicant denial rate'],
  ['hmda-denial-rate-white-county', '2023', 22.1, '6cb2871cfb1d92b73c756fbe8e52c1e49ddcad6abd73c53a3d80b3db0e1a6f31', 'White applicant denial rate'],
  ['hmda-denial-rate-gap-black-white-county', '2023', 16.9, '43f27b1aa57f433f7d952c207974d583542a607d9a571a28eb2b010a14623ff6', 'Black–White denial-rate gap'],
] as const;

const hmdaObservations = hmda.map(([metricId, period, estimate, contentHash, label]) =>
  observation({
    metricId,
    estimate,
    unit: 'percent',
    referencePeriod: period,
    source: 'hmda-loan-level',
    sourceUrl: HMDA_URL,
    retrievedAt: HMDA_RETRIEVED,
    contentHash,
    humanCitation: `FFIEC HMDA Data Browser county aggregation, ${label.toLowerCase()}, Cook County, Illinois, ${period}.`,
    label,
  }),
);

const chas = [
  observation({
    metricId: 'hud-chas-cost-burden-black-county',
    estimate: 55.5,
    unit: 'percent',
    referencePeriod: '2017-2021',
    source: 'hud-chas',
    sourceUrl: CHAS_URL,
    retrievedAt: CHAS_RETRIEVED,
    contentHash: '74e6fd7ce45edc251e7bb8823b814a7b7c4f4bd58bd83bac1dcc149758163c0d',
    humanCitation:
      'HUD CHAS Table 9, share of Black households with housing cost burden above 30 percent, Cook County, 2017–2021.',
    label: 'Black households with housing cost burden above 30%',
  }),
  observation({
    metricId: 'hud-chas-cost-burden-white-county',
    estimate: 26,
    unit: 'percent',
    referencePeriod: '2017-2021',
    source: 'hud-chas',
    sourceUrl: CHAS_URL,
    retrievedAt: CHAS_RETRIEVED,
    contentHash: 'bd96000a9eec4faa527e20afeb3b6293fc99a2f565664550ec706f0674b41e3d',
    humanCitation:
      'HUD CHAS Table 9, share of White households with housing cost burden above 30 percent, Cook County, 2017–2021.',
    label: 'White households with housing cost burden above 30%',
  }),
] as const;

const SCF = [
  ['black', '1989', 9200, 'b471f437da08ecde5bad5c303f7c60af10775623ee4bc661cdf99a2c248c9882'],
  ['white', '1989', 164030, '206ccd5bbeae8c3536e25958401d8f38d6deb311b12cb3a053423935fe61f36a'],
  ['black', '2010', 21800, 'bfc67b33379f5cf40d5b212c932357cb4a1df76613b4774850164415b414d770'],
  ['white', '2010', 178280, 'f8a3f79bce732ea334e4c3934e8ca31db4079e8c010c86a603a252025b337f31'],
  ['black', '2022', 44900, 'dba83f29e70701e9cf3a71a0a9a53e4c523734e9b13175ca0f6b60925a0b1896'],
  ['white', '2022', 285000, 'c0888ae94b6f822d748087894e2949525a81a3bfc90477786ddc2013bb299c99'],
] as const;

const scfObservations = SCF.map(([race, period, estimate, contentHash]) =>
  observation({
    metricId: `scf-median-wealth-${race}-nation`,
    jurisdictionId: NATION,
    estimate,
    unit: 'USD',
    referencePeriod: period,
    source: 'fed-survey-consumer-finances',
    sourceUrl: period === '2022' ? SCF_INDEX_URL : SCF_ARTICLE_URL,
    retrievedAt: SCF_RETRIEVED,
    contentHash,
    humanCitation: `Federal Reserve Survey of Consumer Finances, median family net worth for ${race === 'black' ? 'Black' : 'White non-Hispanic'} families, ${period}, in 2022 dollars.`,
    label: `Median family net worth, ${race === 'black' ? 'Black' : 'White non-Hispanic'} families`,
  }),
);

const REDLINING_ARTIFACTS = {
  nara: artifact({
    artifactId: 'art_nara_fhlbb_record_group_195',
    artifactClass: 'primary_government_document',
    title: 'Federal Home Loan Bank Board and HOLC records',
    citation:
      'National Archives, Record Group 195, Records of the Federal Home Loan Bank Board, including HOLC maps and records.',
    source: 'national-archives',
    sourceUrl: 'https://www.archives.gov/research/guide-fed-records/groups/195.html',
    contentHash: 'c1e34e40196f1177d847db53f661f5da787d5dc3f4ec9b3bcdfe2fd0648ee812',
    dated: '1933-1954',
    summary:
      'The archival record establishes HOLC and federal housing-administration holdings without treating the later digitized maps as the whole lending system.',
  }),
  fha: artifact({
    artifactId: 'art_fha_underwriting_manual_1938',
    artifactClass: 'primary_government_document',
    title: 'Federal Housing Administration Underwriting Manual',
    citation:
      'Federal Housing Administration, Underwriting Manual (1938 edition), digitized by FRASER, Federal Reserve Bank of St. Louis.',
    source: 'federal-housing-administration',
    sourceUrl:
      'https://fraser.stlouisfed.org/files/docs/publications/fha/1938feb_fha_underwritingmanual.pdf',
    contentHash: '3ffb72303fbb14414a1dd62e3962b0a43168431eda96ef2e609628a6c1f2d6f2',
    dated: '1938',
    summary:
      'The manual documents federal underwriting rules, including neighborhood-stability and restrictive-covenant instructions that reinforced segregation.',
  }),
  mapping: artifact({
    artifactId: 'art_mapping_inequality_chicago_verified',
    artifactClass: 'cartographic_grade_map',
    title: 'Mapping Inequality Chicago source data',
    citation:
      'Nelson, Winling, et al., Mapping Inequality: Redlining in New Deal America, University of Richmond Digital Scholarship Lab, Chicago data extract.',
    source: 'mapping-inequality-holc',
    sourceUrl:
      'https://dsl.richmond.edu/panorama/redlining/static/mappinginequality.json',
    contentHash: '17f3b75e7485b27e48cfe17c93bd234e1ad4b025a24fc0cd0eab00cf812d6ff0',
    dated: '1935-1940',
    summary:
      'Direct recount: 703 Chicago features; after trimming grade whitespace, 683 carry A–D grades (A 49, B 160, C 327, D 147) and 20 are ungraded commercial or industrial features.',
    uncertaintyLabel:
      'Counts describe mapped features, not population. The vector derivative is CC BY-NC-SA; BlackStory cites it but does not republish polygons on commercial public surfaces.',
  }),
  hillier: artifact({
    artifactId: 'art_hillier_holc_redlining_2003',
    artifactClass: 'peer_reviewed_synthesis',
    title: 'Redlining and the Home Owners’ Loan Corporation',
    citation:
      'Amy E. Hillier, “Redlining and the Home Owners’ Loan Corporation,” Journal of Urban History 29, no. 4 (2003), doi:10.1177/0096144203029004002.',
    source: 'university-of-pennsylvania-repository',
    sourceUrl:
      'https://repository.upenn.edu/server/api/core/bitstreams/8c48fb68-5ccf-4e1e-aa6c-0c04ba18da4d/content',
    contentHash: '397ee6f3ff633c344953a8df080c4ecac8d48fcb28a57b5f27958fcdb3d83c71',
    dated: '2003',
    summary:
      'Hillier’s Philadelphia analysis challenges the simple claim that HOLC maps alone created redlining and distinguishes mapmaking from documented lending practice.',
  }),
  aaronson: artifact({
    artifactId: 'art_aaronson_hartley_mazumder_holc',
    artifactClass: 'peer_reviewed_synthesis',
    title: 'The effects of the 1930s HOLC maps',
    citation:
      'Daniel Aaronson, Daniel Hartley, and Bhashkar Mazumder, “The Effects of the 1930s HOLC ‘Redlining’ Maps,” American Economic Journal: Economic Policy 13, no. 4 (2021), doi:10.1257/pol.20190414; working-paper page at the Federal Reserve Bank of Chicago.',
    source: 'federal-reserve-bank-of-chicago',
    sourceUrl: 'https://www.chicagofed.org/publications/working-papers/2017/wp2017-12',
    contentHash: '6a6bcdb5d4542953c9fa07fd2dc7dfd9d6609c7baedb8b93bf7ca6622819cce2',
    dated: '2021',
    summary:
      'The boundary-design study reports later differences near C/D grade borders while explicitly limiting the inference to its design and geography.',
  }),
  banaji: artifact({
    artifactId: 'art_banaji_fiske_massey_systemic_racism_2021',
    artifactClass: 'peer_reviewed_synthesis',
    title: 'Systemic racism: individuals and interactions, institutions and society',
    citation:
      'Mahzarin R. Banaji, Susan T. Fiske, and Douglas S. Massey, “Systemic racism: individuals and interactions, institutions and society,” Cognitive Research: Principles and Implications 6:82 (2021), doi:10.1186/s41235-021-00349-3.',
    source: 'cognitive-research-principles-implications',
    sourceUrl: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8688641/',
    contentHash: 'db34a82d62a0fe3e0a3e8451a9f6cb1e153a899693c2c185b79bf81b8b46e37f',
    dated: '2021-12-20',
    summary:
      'Peer-reviewed tutorial treating residential segregation as the linchpin that transmits disadvantage into schools, wealth, health, and legal treatment. Chicago appears as a concrete case inside a national institutional history.',
    claimId: 'claim_systemic_segregation_linchpin_banaji_fiske_massey_2021',
  }),
  chicago1919: artifact({
    artifactId: 'art_chicago_race_riot_1919_ech',
    artifactClass: 'peer_reviewed_synthesis',
    title: 'Chicago Race Riot of 1919',
    citation:
      'Encyclopedia of Chicago, “Race Riots,” Chicago History Museum / Newberry Library; corroborated by BlackPast and the cataloged Eugene Williams memorial record.',
    source: 'encyclopedia-of-chicago',
    sourceUrl: 'https://encyclopedia.chicagohistory.org/pages/1749.html',
    contentHash: 'b929eda18fd4db8147a65da29ec75c852912f079f45ea7216b64dfee025af8e7',
    dated: '1919-07-27',
    summary:
      'The riot killed 38 people and left thousands of Black Chicagoans homeless after Great Migration arrivals reshaped the South Side housing market. Banaji/Fiske/Massey place this violence inside the private enforcement of the color line before federal redlining.',
  }),
  fairHousing: artifact({
    artifactId: 'art_fair_housing_act_1968_doj',
    artifactClass: 'primary_government_document',
    title: 'Fair Housing Act of 1968',
    citation:
      'Civil Rights Act of 1968, Title VIII (Fair Housing Act), 42 U.S.C. §§ 3601 et seq.; U.S. Department of Justice overview.',
    source: 'department-of-justice',
    sourceUrl: 'https://www.justice.gov/crt/fair-housing-act-1',
    contentHash: 'fa07ed8cfb835e172dfc8d21ad9629ed244652d73c207eae42a97dba8a9cb32e',
    dated: '1968-04-11',
    summary:
      'Federal ban on race discrimination in the sale, rental, and financing of housing. Enforcement capacity and later lending gaps remain part of the era story.',
  }),
} as const;

const redliningDerived = [
  derived({
    derivedId: 'der_cook_income_gap_2020_2024',
    methodId: 'black_white_income_gap',
    value: -51286,
    unit: 'USD',
    formula: 'Black median household income minus White median household income',
    inputObservationIds: [ACS.blackIncome.observationId, ACS.whiteIncome.observationId],
    label: 'Black–White median household income gap, Cook County',
    sourceUrl: ACS_URL,
    humanCitation:
      'Derived from ACS 2020–2024 Cook County median household income for Black and White householders.',
  }),
  ...(['1990', '2000', '2010'] as const).map((period) => {
    const black = nhgisHomeownership.find(
      (row) =>
        row.metricId === 'nhgis-homeownership-rate-black-county' &&
        row.referencePeriod === period,
    )!;
    const white = nhgisHomeownership.find(
      (row) =>
        row.metricId === 'nhgis-homeownership-rate-white-county' &&
        row.referencePeriod === period,
    )!;
    return derived({
      derivedId: `der_cook_homeownership_gap_${period}`,
      methodId: 'black_white_homeownership_gap',
      value: Number((black.estimate - white.estimate).toFixed(1)),
      unit: 'percentage_points',
      formula: 'Black homeownership rate minus White homeownership rate',
      inputObservationIds: [black.observationId, white.observationId],
      label: `Black–White homeownership gap, Cook County, ${period}`,
      sourceUrl: black.provenance.sourceUrl,
      humanCitation: `Derived from IPUMS NHGIS/U.S. Census Cook County homeownership rates, ${period}.`,
    });
  }),
  derived({
    derivedId: 'der_cook_cost_burden_gap_2017_2021',
    methodId: 'black_white_housing_cost_burden_gap',
    value: 29.5,
    unit: 'percentage_points',
    formula: 'Black cost-burden rate minus White cost-burden rate',
    inputObservationIds: chas.map((row) => row.observationId),
    label: 'Black–White housing cost-burden gap, Cook County',
    sourceUrl: CHAS_URL,
    humanCitation:
      'Derived from HUD CHAS Table 9 Cook County household cost-burden rates, 2017–2021.',
  }),
  ...(['1989', '2010', '2022'] as const).map((period) => {
    const black = scfObservations.find(
      (row) => row.metricId === 'scf-median-wealth-black-nation' && row.referencePeriod === period,
    )!;
    const white = scfObservations.find(
      (row) => row.metricId === 'scf-median-wealth-white-nation' && row.referencePeriod === period,
    )!;
    return derived({
      derivedId: `der_scf_wealth_gap_${period}`,
      methodId: 'black_white_wealth_gap',
      value: black.estimate - white.estimate,
      unit: 'USD',
      formula: 'Black median family net worth minus White non-Hispanic median family net worth',
      inputObservationIds: [black.observationId, white.observationId],
      label: `Black–White median family net-worth gap, ${period}`,
      sourceUrl: SCF_ARTICLE_URL,
      humanCitation: `Derived from Federal Reserve Survey of Consumer Finances medians, ${period}, in 2022 dollars.`,
    });
  }),
] as const;

const VERA = [
  ['1970', 107.18, '4330304e175218eb38d613159dcd8cf477273ef1892bb75653e3e337efac4596'],
  ['1990', 200.5, '7e1fa7164bc4d93a21ce5061a89f01d63e83ee7f9602edaaac017b6e87d04bf4'],
  ['2000', 274.35, 'e1206a9f7c47f7c4adea12a0b73e4e74ed43ae4e3b5c62af856f5f86c4ae299a'],
  ['2010', 268.81, 'cd5bc9e778bd5e60f7b7f1329cecf0a5d8cfe85257fb5aa34209257218f2a583'],
  ['2020', 148.24, '6ae691af2883ef5481e8d2667471d09cfbc03ab49af8e03450be3705cf0649de'],
  ['2024', 141.51, '7f7dc1c0ab51e8dcd7786aa685f50de0d95826826c414802588e7b4047086258'],
] as const;

const veraObservations = VERA.map(([period, estimate, contentHash]) =>
  observation({
    metricId: 'vera-jail-population-rate-county',
    estimate,
    unit: 'per_100k',
    referencePeriod: period,
    source: 'vera-incarceration-trends',
    sourceUrl: VERA_URL,
    retrievedAt: VERA_RETRIEVED,
    contentHash,
    humanCitation: `Vera Institute of Justice, Incarceration Trends, Cook County jail population rate, ${period}.`,
    label: 'Cook County jail population rate',
  }),
);

const stateJusticeRows = [
  ['17', 'Illinois', 'black', 940, '61a6f6b849e482d6f1caa2652e20fe28fbb7ec957e07e3d39a6afe69c1e29645'],
  ['17', 'Illinois', 'white', 129, '1c5f408297c1fca13e9658833723bc9104e0586ffbcb7a561b51e1f2aa2c9406'],
  ['28', 'Mississippi', 'black', 1095, 'df36cc357d710916558ab49ed2daeafb8ca6174d55a647124629b5513cf4b595'],
  ['28', 'Mississippi', 'white', 446, '5ec771576eaafb1e4e846d0d6055ccd27728b3952edf9ce74f26d5b4e77dd68c'],
  ['34', 'New Jersey', 'black', 619, '7b6a80c5110f15668199758eb89ca257289509a870e104cfabd0d1c44857f95a'],
  ['34', 'New Jersey', 'white', 46, 'ac43fdb05d934232dc92f032b5f1deffcb798ff50b440d72ace4ce60bd457178'],
  ['55', 'Wisconsin', 'black', 2153, '3437f5960a537fabcc1ac388a5c37608cf6888e39394bf5bfeec25442215bc10'],
  ['55', 'Wisconsin', 'white', 158, 'be88744207e306f02bde443655407270fc6fc9981cf2ef7b41dda6a75ca137b9'],
] as const;

const stateJusticeObservations = stateJusticeRows.map(
  ([fips, state, race, estimate, contentHash]) =>
    observation({
      metricId: `imprisonment-rate-${race}-state`,
      jurisdictionId: `state:${fips}`,
      estimate,
      unit: 'per_100k',
      referencePeriod: '2023',
      source: 'bjs-national-prisoner-statistics',
      sourceUrl: BJS_URL,
      retrievedAt: BJS_RETRIEVED,
      contentHash,
      humanCitation: `Bureau of Justice Statistics National Prisoner Statistics Appendix table 1 counts with 2023 ACS 5-year race denominator, ${state} ${race === 'black' ? 'Black' : 'White non-Hispanic'} adult imprisonment rate, 2023.`,
      label: `${state} ${race === 'black' ? 'Black' : 'White'} imprisonment rate`,
    }),
);

const CENSUS_STATE_RACE_DENOMINATOR_ARTIFACT = artifact({
  artifactId: 'art_census_acs_2023_state_race_denominators',
  artifactClass: 'primary_government_document',
  title: '2023 ACS state race population denominators',
  citation:
    'U.S. Census Bureau, 2023 American Community Survey 5-Year Estimates, table B03002, variables B03002_003E and B03002_004E, state totals.',
  source: 'us-census-acs-api',
  sourceUrl: CENSUS_STATE_RACE_DENOMINATOR_URL,
  contentHash: '0ed990a7b6e9486dca5a79babbc0bb34c3f0c7a5e7683e1bff72298ef469b7fd',
  dated: '2023',
  summary:
    'Non-Hispanic White-alone and Black-alone state population estimates used as the rate denominators. The aligned Census PEP query returned no rows, so these are ACS 5-year estimates rather than point-in-time PEP estimates.',
});

const USSC = [
  ['ussc-average-sentence-months-crack-nation', '2013', 96, '740c00b9d7e6ab991a60673b6022de4f6689d085aed486010871ee07b707a79e', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY17.pdf', 'Average federal crack-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-crack-nation', '2016', 79, 'b4946b97c958524f17c9fd9c0f6a7e31105685e31972d40f3a65771c4e4e4a3a', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY16.pdf', 'Average federal crack-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-crack-nation', '2018', 78, 'c4b2ac55d5736b38ef5c9e70f0809678bb9eec413528e60324c125cc124473cc', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY18.pdf', 'Average federal crack-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-crack-nation', '2020', 74, 'a7c8f9a1867bad240daf7d832e25fba73652bc1b75af33de9674d11adc6b6518', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY20.pdf', 'Average federal crack-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-crack-nation', '2023', 60, '2c33b76557c8e97050106138bbf7306c6b623fce468ed238cab3be3560e422ed', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY23.pdf', 'Average federal crack-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-powder-nation', '2014', 73, '646156304c583b2d59509ad270d102ce679bf0ccdc47d88b2229a871e25e5aa3', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Powder_Cocaine_FY18.pdf', 'Average federal powder-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-powder-nation', '2016', 70, '3983cec2dcd60efbbb7e1ed041751eef82364af347470d021f8c89f7dc0fbcf5', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Powder_Cocaine_FY20.pdf', 'Average federal powder-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-powder-nation', '2018', 74, 'c7796b1cfe3ee76e8ad3d28c17126335abd3759838074146ab53b4c1b35742da', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Powder_Cocaine_FY18.pdf', 'Average federal powder-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-powder-nation', '2020', 66, 'db58ad1f8d38c7f3fa0ce2eb86298fc7b2688bac4111bfcc2d58346650fb6c1a', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Powder_Cocaine_FY20.pdf', 'Average federal powder-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-powder-nation', '2023', 68, 'd8d20debd719be2ad3c401810dae94f481763968e4b57844b9dd9329f57e7045', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Powder_Cocaine_FY23.pdf', 'Average federal powder-cocaine trafficking sentence'],
  ['ussc-black-share-crack-offenders-nation', '2016', 82.6, '3b3130b87b3d130a67ef55ed03a066cef5d742d9b97694819c28b5da645d49c8', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY16.pdf', 'Black share of federal crack-cocaine trafficking defendants'],
  ['ussc-black-share-crack-offenders-nation', '2018', 80, '848530fea9f20adf8c68fb569c95c6e1f04375b4ad76753445b52ffafa6d2112', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY18.pdf', 'Black share of federal crack-cocaine trafficking defendants'],
  ['ussc-black-share-crack-offenders-nation', '2020', 77.1, 'b10ba7c251d06fa2c1ccf979ed6b301582bc622052bfc562e57c2138086c38f0', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY20.pdf', 'Black share of federal crack-cocaine trafficking defendants'],
  ['ussc-black-share-crack-offenders-nation', '2023', 78.9, '1bae98788c5fbaf66abcad6c41f64f42ea5d8d24fe4c1ec0ad72e16096f67dfd', 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY23.pdf', 'Black share of federal crack-cocaine trafficking defendants'],
] as const;

const usscObservations = USSC.map(
  ([metricId, period, estimate, contentHash, sourceUrl, label]) =>
    observation({
      metricId,
      jurisdictionId: NATION,
      estimate,
      unit: metricId.includes('share') ? 'percent' : 'months',
      referencePeriod: period,
      source: 'ussc-quick-facts-drug',
      sourceUrl,
      retrievedAt: USSC_RETRIEVED,
      contentHash,
      humanCitation: `U.S. Sentencing Commission Quick Facts, ${label.toLowerCase()}, fiscal year ${period}.`,
      label,
    }),
);

const DRUG_POLICY_ARTIFACTS = [
  artifact({
    artifactId: 'art_controlled_substances_act_1970',
    artifactClass: 'primary_government_document',
    title: 'Controlled Substances Act',
    citation:
      'Comprehensive Drug Abuse Prevention and Control Act of 1970, Pub. L. 91-513, 84 Stat. 1236.',
    source: 'govinfo',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-84/pdf/STATUTE-84-Pg1236.pdf',
    contentHash: '05cd5164ae0324c7569a2748bf6e08e48a76652a36fdf7bcc26b731f6c8eaa18',
    dated: '1970-10-27',
    summary: 'Established the federal controlled-substance scheduling framework.',
  }),
  artifact({
    artifactId: 'art_anti_drug_abuse_act_1986',
    artifactClass: 'primary_government_document',
    title: 'Anti-Drug Abuse Act of 1986',
    citation: 'Anti-Drug Abuse Act of 1986, Pub. L. 99-570, 100 Stat. 3207.',
    source: 'govinfo',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-100/pdf/STATUTE-100-Pg3207.pdf',
    contentHash: '36e3965982e8d7a8c2cdb5d01a524e3ea97bdc59b25e3ab30a83dd10ee6520a3',
    dated: '1986-10-27',
    summary:
      'Created federal mandatory minimums keyed to drug quantities, including the 100-to-1 crack/powder cocaine quantity ratio.',
  }),
  artifact({
    artifactId: 'art_fair_sentencing_act_2010',
    artifactClass: 'primary_government_document',
    title: 'Fair Sentencing Act of 2010',
    citation: 'Fair Sentencing Act of 2010, Pub. L. 111-220, 124 Stat. 2372.',
    source: 'govinfo',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-124/pdf/STATUTE-124-Pg2372.pdf',
    contentHash: 'fa411384f83c246d84f9b02762ce3f89b08dbd308a9063b8a436381becf598db',
    dated: '2010-08-03',
    summary:
      'Raised federal crack-cocaine quantity thresholds and reduced, but did not eliminate, the statutory disparity.',
  }),
  artifact({
    artifactId: 'art_first_step_act_2018',
    artifactClass: 'primary_government_document',
    title: 'First Step Act of 2018',
    citation: 'First Step Act of 2018, Pub. L. 115-391, 132 Stat. 5194.',
    source: 'govinfo',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-132/pdf/STATUTE-132-Pg5194.pdf',
    contentHash: '6b2b6b7906e1fd80f9d7c44f06ff5ef4d919151ead30cf5a7e4dd0db88983237',
    dated: '2018-12-21',
    summary:
      'Made the Fair Sentencing Act’s lower crack-cocaine penalties retroactively available to eligible federal defendants.',
  }),
  artifact({
    artifactId: 'art_crs_crack_powder_disparities',
    artifactClass: 'primary_government_document',
    title: 'Congressional Research Service: crack and powder sentencing disparities',
    citation:
      'Congressional Research Service, “Cocaine: Crack and Powder Sentencing Disparities,” IF11965.',
    source: 'congressional-research-service',
    sourceUrl:
      'https://www.congress.gov/crs_external_products/IF/PDF/IF11965/IF11965.1.pdf',
    contentHash: '7701ac222943db0e35c2b9c69b316fe604a506d18e56a9950cbcbf36cf68eec3',
    dated: '2022',
    summary:
      'Nonpartisan legislative synthesis of the statutory ratio, reforms, and continuing policy questions.',
  }),
] as const;

const q6Derived = [
  derived({
    derivedId: 'der_il_black_white_imprisonment_ratio_2023',
    methodId: 'black_white_imprisonment_ratio',
    value: 7.29,
    unit: 'ratio',
    formula: 'Illinois Black imprisonment rate divided by Illinois White imprisonment rate',
    inputObservationIds: stateJusticeObservations
      .filter((row) => row.observationId.includes('state:17'))
      .map((row) => row.observationId),
    label: 'Illinois Black-to-White imprisonment-rate ratio',
    sourceUrl: BJS_URL,
    humanCitation:
      'Derived from BJS NPS Appendix table 1 prisoner counts and 2023 ACS 5-year race denominators for Illinois.',
  }),
  derived({
    derivedId: 'der_cook_jail_rate_change_1970_2000',
    methodId: 'era_delta',
    value: 167.17,
    unit: 'per_100k',
    formula: 'Cook County jail population rate in 2000 minus rate in 1970',
    inputObservationIds: veraObservations
      .filter((row) => row.referencePeriod === '1970' || row.referencePeriod === '2000')
      .map((row) => row.observationId),
    label: 'Cook County jail-rate change, 1970 to 2000',
    sourceUrl: VERA_URL,
    humanCitation:
      'Derived from Vera Institute of Justice Incarceration Trends, Cook County rates for 1970 and 2000.',
  }),
  derived({
    derivedId: 'der_cook_jail_rate_change_2000_2024',
    methodId: 'era_delta',
    value: -132.84,
    unit: 'per_100k',
    formula: 'Cook County jail population rate in 2024 minus rate in 2000',
    inputObservationIds: veraObservations
      .filter((row) => row.referencePeriod === '2000' || row.referencePeriod === '2024')
      .map((row) => row.observationId),
    label: 'Cook County jail-rate change, 2000 to 2024',
    sourceUrl: VERA_URL,
    humanCitation:
      'Derived from Vera Institute of Justice Incarceration Trends, Cook County rates for 2000 and 2024.',
  }),
  derived({
    derivedId: 'der_ussc_crack_sentence_change_2013_2023',
    methodId: 'era_delta',
    value: -36,
    unit: 'months',
    formula: 'FY2023 average crack-cocaine trafficking sentence minus FY2013 average',
    inputObservationIds: usscObservations
      .filter(
        (row) =>
          row.metricId === 'ussc-average-sentence-months-crack-nation' &&
          (row.referencePeriod === '2013' || row.referencePeriod === '2023'),
      )
      .map((row) => row.observationId),
    label: 'Change in average federal crack-cocaine trafficking sentence',
    sourceUrl:
      'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts/Crack_Cocaine_FY23.pdf',
    humanCitation:
      'Derived from U.S. Sentencing Commission Quick Facts values for fiscal years 2013 and 2023.',
  }),
] as const;

const STATE_FIPS = [
  '01', '02', '04', '05', '06', '08', '09', '10', '12', '13',
  '15', '16', '17', '18', '19', '20', '21', '22', '23', '24',
  '25', '26', '27', '28', '29', '30', '31', '32', '33', '34',
  '35', '36', '37', '38', '39', '40', '41', '42', '44', '45',
  '46', '47', '48', '49', '50', '51', '53', '54', '55', '56',
] as const;

const stateCohortObservationIds = STATE_FIPS.flatMap((fips) => [
  `obs:imprisonment-rate-black-state:state:${fips}:2023`,
  `obs:imprisonment-rate-white-state:state:${fips}:2023`,
]);

const q8Derived = [
  ...(['17', '28', '34', '55'] as const).map((fips) => {
    const pair = stateJusticeObservations.filter((row) =>
      row.observationId.includes(`state:${fips}:`),
    );
    const black = pair.find((row) => row.metricId === 'imprisonment-rate-black-state')!;
    const white = pair.find((row) => row.metricId === 'imprisonment-rate-white-state')!;
    const state = stateJusticeRows.find((row) => row[0] === fips)![1];
    return derived({
      derivedId: `der_state_${fips}_black_white_imprisonment_ratio_2023`,
      methodId: 'black_white_imprisonment_ratio',
      value: Number((black.estimate / white.estimate).toFixed(2)),
      unit: 'ratio',
      formula: 'Black imprisonment rate divided by White imprisonment rate',
      inputObservationIds: pair.map((row) => row.observationId),
      label: `${state} Black-to-White imprisonment-rate ratio`,
      sourceUrl: BJS_URL,
      humanCitation: `Derived from BJS NPS Appendix table 1 prisoner counts and 2023 ACS 5-year race denominators, ${state}.`,
    });
  }),
  derived({
    derivedId: 'der_state_imprisonment_ratio_median_2023',
    methodId: 'cohort_median_black_white_imprisonment_ratio',
    value: 5.42,
    unit: 'ratio',
    formula:
      'Median across 50 state Black imprisonment rate / White imprisonment rate pairs',
    inputObservationIds: stateCohortObservationIds,
    label: 'Median state Black-to-White imprisonment-rate ratio',
    sourceUrl: BJS_URL,
    humanCitation:
      'Derived across the 50 states with paired 2023 BJS NPS Appendix table 1 counts and 2023 ACS 5-year race denominators; observed range 2.46 to 13.63.',
  }),
] as const;

const URBAN_RENEWAL_ARTIFACTS = [
  artifact({
    artifactId: 'art_housing_act_1949',
    artifactClass: 'primary_government_document',
    title: 'Housing Act of 1949',
    citation: 'Housing Act of 1949, Pub. L. 81-171, 63 Stat. 413, Title I.',
    source: 'govinfo',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-63/pdf/STATUTE-63-Pg413.pdf',
    contentHash: 'da112db2e2ba9b98d03fdd8ebd6878933712622c6345391985482574129624a6',
    dated: '1949-07-15',
    summary:
      'Title I authorized federal support for local land clearance and redevelopment programs.',
  }),
  artifact({
    artifactId: 'art_renewing_inequality_chicago_data',
    artifactClass: 'scholarly_partner_table',
    title: 'Renewing Inequality Chicago project inventory',
    citation:
      'Renewing Inequality: Urban Renewal and the American City, University of Richmond Digital Scholarship Lab, federal urban-renewal project characteristics data.',
    source: 'dsl-renewing-inequality',
    sourceUrl:
      'https://raw.githubusercontent.com/americanpanorama/Renewing_Inequality_Data/master/Data/non_spatial_data.csv',
    contentHash: 'b2744ed7b1ae3254b7b10ceb771d64372eaafefbfabdc35029139b185684509d',
    dated: '1955-1966',
    summary:
      'The verified source contains 43 Chicago projects. Fields are incomplete by project; missing totals are treated as unknown, never zero.',
    uncertaintyLabel:
      'Compiled attributes are cited. Project polygons remain cite-only and are not republished on commercial public surfaces.',
  }),
  artifact({
    artifactId: 'art_renewing_inequality_hyde_park_kenwood',
    artifactClass: 'scholarly_partner_table',
    title: 'Hyde Park–Kenwood federal project characteristics',
    citation:
      'Renewing Inequality federal characteristics data, project 2466, Hyde Park–Kenwood, Chicago, 1966.',
    source: 'dsl-renewing-inequality',
    sourceUrl:
      'https://raw.githubusercontent.com/americanpanorama/Renewing_Inequality_Data/master/Data/non_spatial_data.csv',
    contentHash: 'b2744ed7b1ae3254b7b10ceb771d64372eaafefbfabdc35029139b185684509d',
    dated: '1966',
    summary:
      'Reported fields include 2,333 non-white families and 5,940 substandard dwelling units. These are period federal categories, not modern identities or a direct displaced-person count.',
  }),
  artifact({
    artifactId: 'art_renewing_inequality_lake_meadows',
    artifactClass: 'scholarly_partner_table',
    title: 'Lake Meadows federal project characteristics',
    citation:
      'Renewing Inequality federal characteristics data, project 2468, Lake Meadows, Chicago, 1966.',
    source: 'dsl-renewing-inequality',
    sourceUrl:
      'https://raw.githubusercontent.com/americanpanorama/Renewing_Inequality_Data/master/Data/non_spatial_data.csv',
    contentHash: 'b2744ed7b1ae3254b7b10ceb771d64372eaafefbfabdc35029139b185684509d',
    dated: '1966',
    summary:
      'Reported fields include 3,416 non-white families and 1,719 substandard dwelling units. The table does not by itself establish how many families were displaced.',
  }),
  artifact({
    artifactId: 'art_fullilove_serial_forced_displacement',
    artifactClass: 'peer_reviewed_synthesis',
    title: 'Serial forced displacement in American cities',
    citation:
      'Mindy Thompson Fullilove and Rodrick Wallace, “Serial Forced Displacement in American Cities, 1916–2010,” Journal of Urban Health 88 (2011), doi:10.1007/s11524-011-9585-2.',
    source: 'journal-of-urban-health',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3126925/',
    contentHash: '09fc033db4df2f877cb659dac446675411aa458c0f59a50f156accbf76987c84',
    dated: '2011',
    summary:
      'Peer-reviewed synthesis situating urban renewal within repeated displacement affecting African American neighborhoods; it supplies context, not project-specific counts for Chicago.',
  }),
] as const;

const EJI = observation({
  metricId: 'cdc-eji-environmental-burden-score-county',
  estimate: 0.7469,
  unit: 'index',
  referencePeriod: '2024',
  source: 'cdc-eji',
  sourceUrl: EJI_URL,
  retrievedAt: EJI_RETRIEVED,
  contentHash: '9086f1dc907741c2210195fcfe3f8939433ca7133b9b9a9fa2b0f3a9b31badb5',
  humanCitation:
    'CDC/ATSDR Environmental Justice Index 2024, mean tract Environmental Burden Module percentile rank, Cook County, Illinois.',
  label: 'Cook County environmental-burden score',
});

const TRI = observation({
  metricId: 'epa-tri-facility-count-county',
  estimate: 305,
  unit: 'count',
  referencePeriod: '2023',
  source: 'epa-tri',
  sourceUrl: TRI_URL,
  retrievedAt: TRI_RETRIEVED,
  contentHash: '65ddcef4a26b8eddabf5dc38d0d40c3ec14aa3b54c0137db743e01d6856c9e95',
  humanCitation:
    'EPA Toxics Release Inventory, distinct reporting facilities assigned to Cook County, Illinois, 2023.',
  label: 'TRI-reporting facilities, Cook County',
});

const ENVIRONMENTAL_JURISDICTIONS = [
  'county:17001', 'county:17003', 'county:17005', 'county:17007', 'county:17011',
  'county:17015', 'county:17017', 'county:17019', 'county:17021', 'county:17023',
  'county:17025', 'county:17029', 'county:17031', 'county:17033', 'county:17035',
  'county:17037', 'county:17041', 'county:17043', 'county:17045', 'county:17047',
  'county:17049', 'county:17051', 'county:17053', 'county:17055', 'county:17057',
  'county:17063', 'county:17073', 'county:17075', 'county:17077', 'county:17079',
  'county:17081', 'county:17083', 'county:17085', 'county:17089', 'county:17091',
  'county:17093', 'county:17095', 'county:17097', 'county:17099', 'county:17103',
  'county:17105', 'county:17107', 'county:17109', 'county:17111', 'county:17113',
  'county:17115', 'county:17117', 'county:17119', 'county:17121', 'county:17123',
  'county:17125', 'county:17127', 'county:17131', 'county:17133', 'county:17135',
  'county:17137', 'county:17139', 'county:17141', 'county:17143', 'county:17145',
  'county:17147', 'county:17149', 'county:17155', 'county:17157', 'county:17159',
  'county:17161', 'county:17163', 'county:17167', 'county:17175', 'county:17177',
  'county:17179', 'county:17183', 'county:17187', 'county:17189', 'county:17193',
  'county:17195', 'county:17197', 'county:17199', 'county:17201', 'county:17203',
] as const;

function cohortIds(metricId: string, period: string): readonly string[] {
  return ENVIRONMENTAL_JURISDICTIONS.map(
    (jurisdiction) => `obs:${metricId}:${jurisdiction}:${period}`,
  );
}

const environmentalCohortInputs = {
  blackShare: cohortIds('acs-black-population-share-county', '2020-2024'),
  eji: cohortIds('cdc-eji-environmental-burden-score-county', '2024'),
  tri: cohortIds('epa-tri-facility-count-county', '2023'),
} as const;

const q9Derived = [
  derived({
    derivedId: 'der_il_county_black_share_eji_correlation_2024',
    methodId: 'pearson_correlation',
    value: 0.274,
    unit: 'correlation',
    formula:
      'Pearson correlation of county Black population share and county mean CDC EJI environmental-burden percentile',
    inputObservationIds: [
      ...environmentalCohortInputs.blackShare,
      ...environmentalCohortInputs.eji,
    ],
    label: 'Black population share / EJI burden correlation',
    sourceUrl: EJI_URL,
    humanCitation:
      'Derived across 80 Illinois counties with complete ACS 2020–2024 and CDC EJI 2024 coverage.',
  }),
  derived({
    derivedId: 'der_il_county_black_share_tri_count_correlation_2023',
    methodId: 'pearson_correlation',
    value: 0.371,
    unit: 'correlation',
    formula:
      'Pearson correlation of county Black population share and raw TRI-reporting facility count',
    inputObservationIds: [
      ...environmentalCohortInputs.blackShare,
      ...environmentalCohortInputs.tri,
    ],
    label: 'Black population share / raw TRI facility-count correlation',
    sourceUrl: TRI_URL,
    humanCitation:
      'Derived across 80 Illinois counties with complete ACS 2020–2024 and EPA TRI 2023 coverage. Raw counts are strongly affected by county population.',
  }),
  derived({
    derivedId: 'der_il_county_black_share_tri_rate_correlation_2023',
    methodId: 'pearson_correlation',
    value: -0.142,
    unit: 'correlation',
    formula:
      'Pearson correlation of county Black population share and TRI facility count per 100,000 ACS residents',
    inputObservationIds: [
      ...environmentalCohortInputs.blackShare,
      ...environmentalCohortInputs.tri,
    ],
    label: 'Black population share / TRI facilities per 100,000 correlation',
    sourceUrl: TRI_URL,
    humanCitation:
      'Derived across 80 Illinois counties with complete ACS 2020–2024 and EPA TRI 2023 coverage, using the ACS population denominator stored with the Black-share observation.',
  }),
  derived({
    derivedId: 'der_il_eji_top_bottom_black_share_quartile_gap_2024',
    methodId: 'quartile_mean_gap',
    value: 0.0862,
    unit: 'index',
    formula:
      'Mean EJI burden in highest Black-share county quartile minus mean in lowest quartile (0.5137 - 0.4275)',
    inputObservationIds: [
      ...environmentalCohortInputs.blackShare,
      ...environmentalCohortInputs.eji,
    ],
    label: 'EJI mean difference, highest versus lowest Black-share quartile',
    sourceUrl: EJI_URL,
    humanCitation:
      'Derived across 80 Illinois counties, 20 counties per Black-population-share quartile.',
  }),
] as const;

const ENVIRONMENTAL_ARTIFACTS = [
  artifact({
    artifactId: 'art_cdc_eji_2024',
    artifactClass: 'primary_government_document',
    title: 'CDC/ATSDR Environmental Justice Index 2024',
    citation:
      'Agency for Toxic Substances and Disease Registry, Environmental Justice Index 2024 data and documentation.',
    source: 'cdc-atdsr',
    sourceUrl: 'https://www.atsdr.cdc.gov/place-health/php/eji/eji-data-download.html',
    contentHash: '4e82af0fe6116f0acfd13468c4ab332dce94d319f0dac679ea052e6409922323',
    dated: '2024',
    summary:
      'The EJI combines environmental, social-vulnerability, and health-vulnerability modules. This packet uses only the environmental-burden module county mean.',
  }),
  artifact({
    artifactId: 'art_epa_tri_program',
    artifactClass: 'primary_government_document',
    title: 'EPA Toxics Release Inventory',
    citation:
      'U.S. Environmental Protection Agency, Toxics Release Inventory Program.',
    source: 'epa',
    sourceUrl: TRI_URL,
    contentHash: '42198dacd8f5f364f77ab4661c85d87285b43d0d0a4e9de43d29ac61a5669a1b',
    dated: '2023',
    summary:
      'TRI counts regulated reporting facilities; they do not measure individual exposure, total toxicity, or health risk.',
  }),
  artifact({
    artifactId: 'art_mikati_pm25_disparities_2018',
    artifactClass: 'peer_reviewed_synthesis',
    title: 'PM2.5 emission-source disparities by race and poverty',
    citation:
      'Ihab Mikati et al., “Disparities in Distribution of Particulate Matter Emission Sources by Race and Poverty Status,” American Journal of Public Health 108, no. 4 (2018), doi:10.2105/AJPH.2017.304297.',
    source: 'american-journal-of-public-health',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5844406/',
    contentHash: '4316193dfce87ed9d0048447f085a52295fe421c7f755d2b863a4ea8f9ff8844',
    dated: '2018',
    summary:
      'National peer-reviewed analysis reports racial and poverty disparities in proximity to particulate-matter emission sources. It does not validate every county-level proxy used here.',
  }),
  artifact({
    artifactId: 'art_tessum_pollution_inequity_2019',
    artifactClass: 'peer_reviewed_synthesis',
    title: 'Racial-ethnic disparities in PM2.5 exposure',
    citation:
      'Christopher W. Tessum et al., “Inequity in Consumption of Goods and Services Adds to Racial-Ethnic Disparities in Air Pollution Exposure,” Proceedings of the National Academy of Sciences 116, no. 13 (2019), doi:10.1073/pnas.1818859116.',
    source: 'proceedings-national-academy-sciences',
    sourceUrl:
      'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6421454/fullTextXML',
    contentHash: '03cda08d6e65b5343afa06bb05d59705343cb36177ec3b73b8979bcd5c4ed7c7',
    dated: '2019',
    summary:
      'National peer-reviewed modeling finds exposure inequities that are not reducible to the raw count of TRI-reporting facilities.',
  }),
] as const;

const METHOD_REDLINE =
  'Chicago and Cook County are an example reading of a national housing-credit system. Historical artifacts and later indicators are connected by place and policy era. They are not treated as proof that one map or program alone caused every later disparity.';
const METHOD_REDLINE_CAUSAL =
  'Gated causal claim for the federal HOLC/FHA underwriting system enabling durable residential segregation. Named secondary consensus: Richard Rothstein, The Color of Law (2017); Douglas S. Massey and Nancy A. Denton, American Apartheid (1993); Banaji, Fiske, and Massey (2021). Chicago is the example metro for reading that national pattern. Contested map-only shortcuts remain outside this claim.';
const METHOD_JUSTICE =
  'Statutes, jail trends, sentencing data, and imprisonment rates describe different systems and geographic scales. They are juxtaposed, not combined into a single causal estimate. State imprisonment rates divide BJS year-end prisoner counts by 2023 ACS 5-year non-Hispanic race estimates because the aligned PEP query returned no rows; treat the exact ratios as descriptive warehouse estimates, not BJS-published rates.';
const METHOD_URBAN_RENEWAL =
  'Federal project records and county demographic series are read together for context. County trends cannot identify neighborhood-level displacement effects, and missing project fields remain unknown.';
const METHOD_ENVIRONMENT =
  'This is an ecological, county-level descriptive comparison. EJI, TRI counts, and population share measure different constructs; none is an individual exposure or causal estimate.';
const METHOD_SCHOOL =
  'Cook County is an example metro for reading how residential segregation sits beside later attainment. School-finance and CRDC discipline series are not yet loaded; desegregation artifacts supply the policy timeline. Juxtaposition is not causation.';
const METHOD_VOTING =
  'Franchise artifacts tell a national enforcement story. Chicago appears as a northern-city example of Great Migration politics, not as a complete turnout series. MIT Election Lab and Voting Rights Lab indicators remain gap-labeled until ingest.';

export const RESEARCHED_THEME_IMPACT_PACKETS: readonly ThemeImpactPacket[] = [
  buildThemeImpactPacket({
    id: 'tip_chicago_redlining_q1',
    questionId: 'Q1',
    themeId: 'redlining',
    title: 'How a color line became federal credit policy',
    summary:
      'Start with people under pressure: Great Migration arrivals on Chicago’s South Side met covenants, blockbusting, and the 1919 race riot before any HOLC map existed. Private real-estate rules then met New Deal credit. HOLC surveyors encoded race and neighborhood risk; FHA underwriting rewarded same-race occupancy and restrictive covenants. Banaji, Fiske, and Massey treat that federal underwriting system as part of a national segregation machine. Scholarship still disagrees about how directly HOLC maps alone steered every loan, so the gated claim here is about the wider HOLC/FHA system, not a map-only shortcut. Chicago is the example city for reading the pattern.',
    policyEras: ['holc_fha', 'fair_housing', 'cra_contemporary'],
    geography: {
      geographyType: 'nation',
      jurisdictionId: NATION,
      boundaryVersion: 'nation-2020',
      label: 'United States (Chicago example)',
    },
    methodStance: 'gated_causal_claim',
    methodNote: METHOD_REDLINE_CAUSAL,
    artifacts: [
      REDLINING_ARTIFACTS.chicago1919,
      REDLINING_ARTIFACTS.nara,
      REDLINING_ARTIFACTS.fha,
      REDLINING_ARTIFACTS.banaji,
      REDLINING_ARTIFACTS.hillier,
      REDLINING_ARTIFACTS.aaronson,
      REDLINING_ARTIFACTS.fairHousing,
    ],
    causalClaimIds: [
      'claim_systemic_fha_holc_enabled_segregation_rothstein_2017',
      'claim_systemic_segregation_linchpin_banaji_fiske_massey_2021',
    ],
    entityBinding: { entityId: 'ent_chicago_race_riot_1919_001', purpose: 'story' },
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_chicago_redlining_q2',
    questionId: 'Q2',
    themeId: 'redlining',
    title: 'What the Chicago HOLC inventory can and cannot count',
    summary:
      'On the example city’s maps, a direct recount yields 703 Chicago features: 683 normalized A–D grades (A 49, B 160, C 327, D 147) plus 20 ungraded commercial or industrial features. Area descriptions document racialized appraisal in plain language. The inventory still cannot name how many Black Chicagoans lived inside each grade. That population-by-grade gap is why the story moves from maps to people carefully.',
    policyEras: ['holc_fha'],
    geography: {
      geographyType: 'city',
      boundaryVersion: 'mapping-inequality-holc-v1',
      label: 'Chicago HOLC survey (example metro)',
    },
    methodStance: 'juxtaposition',
    methodNote: METHOD_REDLINE,
    artifacts: [
      REDLINING_ARTIFACTS.mapping,
      REDLINING_ARTIFACTS.nara,
      REDLINING_ARTIFACTS.hillier,
      REDLINING_ARTIFACTS.banaji,
    ],
    gapStates: ['insufficient_evidence'],
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_chicago_redlining_q3',
    questionId: 'Q3',
    themeId: 'redlining',
    title: 'After the maps: housing, credit, income, and wealth',
    summary:
      'Follow the same example county forward. Cook County’s Black homeownership rate rose from 37.1% in 1990 to 42.0% in 2000 and was 41.2% in 2010; the White rate stayed about 25 to 27 points higher. In 2023 HMDA aggregates show a 16.9-point Black–White denial-rate gap. HUD CHAS shows a 29.5-point cost-burden gap for 2017–2021. National SCF medians add wealth context and stay labeled national, not Cook County. The numbers do not prove that one 1930s sheet caused each later gap; they show what families faced after the color line was built into credit.',
    policyEras: ['holc_fha', 'fair_housing', 'cra_contemporary'],
    geography: {
      geographyType: 'county',
      jurisdictionId: COOK_COUNTY,
      boundaryVersion: 'county-2020',
      label: 'Cook County, Illinois (example), with national wealth context',
    },
    methodStance: 'juxtaposition',
    methodNote: METHOD_REDLINE,
    observations: [
      ...nhgisHomeownership,
      ACS.blackHomeownership,
      ACS.blackIncome,
      ACS.whiteIncome,
      ACS.blackPoverty,
      ...hmdaObservations,
      ...chas,
      ...scfObservations,
    ],
    derived: redliningDerived,
    artifacts: [
      REDLINING_ARTIFACTS.hillier,
      REDLINING_ARTIFACTS.aaronson,
      REDLINING_ARTIFACTS.banaji,
      REDLINING_ARTIFACTS.fairHousing,
    ],
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_chicago_redlining_q4',
    questionId: 'Q4',
    themeId: 'redlining',
    title: 'Bronzeville: a neighborhood story inside a county frame',
    summary:
      'Bronzeville is where the example becomes a place people can name. The district is bound to this packet, and the surrounding Cook County series show homeownership, income, poverty, cost burden, and recent mortgage denials. Those series still resolve only to the county. They cannot identify the same households who lived inside a particular HOLC polygon. The human story is local; the measured spine is county-scale until tract linkage closes.',
    policyEras: ['holc_fha', 'fair_housing', 'cra_contemporary'],
    geography: {
      geographyType: 'county',
      jurisdictionId: COOK_COUNTY,
      boundaryVersion: 'county-2020',
      label: 'Bronzeville story, Cook County statistical context (example)',
    },
    methodStance: 'juxtaposition',
    methodNote: METHOD_REDLINE,
    observations: [
      ACS.blackHomeownership,
      ACS.blackIncome,
      ACS.whiteIncome,
      ACS.blackPoverty,
      ACS.blackBaAttainment,
      ...hmdaObservations.filter((row) => row.referencePeriod === '2023'),
      ...chas,
    ],
    derived: redliningDerived.filter(
      (row) =>
        row.derivedId === 'der_cook_income_gap_2020_2024' ||
        row.derivedId === 'der_cook_cost_burden_gap_2017_2021',
    ),
    artifacts: [
      REDLINING_ARTIFACTS.mapping,
      REDLINING_ARTIFACTS.fha,
      REDLINING_ARTIFACTS.aaronson,
      REDLINING_ARTIFACTS.banaji,
      REDLINING_ARTIFACTS.chicago1919,
    ],
    gapStates: ['insufficient_evidence'],
    entityBinding: { entityId: 'ent_bronzeville_001', purpose: 'story' },
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_drug_policy_q5_national',
    questionId: 'Q5',
    themeId: 'drug_policy_state',
    title: 'Federal drug scheduling and sentencing, in the statutes',
    summary:
      'The primary record runs from the 1970 scheduling framework through the 1986 mandatory minimums, the 2010 reduction of the crack/powder quantity ratio, and 2018 retroactivity. The former intelligence-linked drug-market placeholder is removed: no source in that packet met the bar for a settled factual claim.',
    policyEras: [
      'pre_drug_war',
      'drug_war_escalation',
      'crack_cocaine_era',
      'sentencing_reform',
    ],
    geography: {
      geographyType: 'nation',
      jurisdictionId: NATION,
      boundaryVersion: 'nation-2020',
      label: 'United States federal policy',
    },
    methodStance: 'juxtaposition',
    methodNote: METHOD_JUSTICE,
    artifacts: DRUG_POLICY_ARTIFACTS,
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_drug_policy_q6_il_spine',
    questionId: 'Q6',
    themeId: 'drug_policy_state',
    title: 'Sentencing and incarceration indicators across policy eras',
    summary:
      'The series do not move in one direction. Cook County’s jail rate rose from 107.18 per 100,000 in 1970 to 274.35 in 2000, then fell to 141.51 in 2024. Average federal crack-cocaine trafficking sentences fell from 96 months in 2013 to 60 in 2023, while Black defendants remained 78.9% of the federal crack-cocaine trafficking caseload in 2023. Illinois’s 2023 Black imprisonment rate was 7.29 times its White rate. These measures describe different systems and cannot be read as a single drug-policy effect.',
    policyEras: [
      'pre_drug_war',
      'drug_war_escalation',
      'crack_cocaine_era',
      'sentencing_reform',
    ],
    geography: {
      geographyType: 'state',
      jurisdictionId: 'state:17',
      boundaryVersion: 'state-2020',
      label: 'Illinois, Cook County, and federal sentencing series',
    },
    methodStance: 'juxtaposition',
    methodNote: METHOD_JUSTICE,
    observations: [
      ...veraObservations,
      ...stateJusticeObservations.filter((row) => row.observationId.includes('state:17')),
      ...usscObservations,
    ],
    derived: q6Derived,
    artifacts: [
      ...DRUG_POLICY_ARTIFACTS,
      CENSUS_STATE_RACE_DENOMINATOR_ARTIFACT,
      artifact({
        artifactId: 'art_vera_incarceration_trends_dataset',
        artifactClass: 'scholarly_partner_table',
        title: 'Vera Incarceration Trends county dataset',
        citation:
          'Vera Institute of Justice, Incarceration Trends county dataset.',
        source: 'vera-institute-of-justice',
        sourceUrl:
          'https://raw.githubusercontent.com/vera-institute/incarceration-trends/main/incarceration_trends_county.csv',
        contentHash: '3aa4b13de3adb9963e1850f0d0ae518f786e70cf83e77c38387c69f2976964e0',
        dated: '1970-2024',
      }),
    ],
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_urban_renewal_q7_chicago',
    questionId: 'Q7',
    themeId: 'urban_renewal',
    title: 'Chicago projects, reported families, and the scale mismatch',
    summary:
      'The federal-project compilation identifies 43 Chicago projects, but fields are incomplete. Hyde Park–Kenwood reports 2,333 “non-white families” and 5,940 substandard dwelling units; Lake Meadows reports 3,416 and 1,719. Those period categories are not direct displaced-family counts. Cook County’s Black population share rose from 20.9% in 1970 to 25.0% in 2010, then measured 22.2% in the 2020–2024 ACS. County change cannot isolate what followed inside project footprints.',
    policyEras: ['urban_renewal_federal'],
    geography: {
      geographyType: 'county',
      jurisdictionId: COOK_COUNTY,
      boundaryVersion: 'county-2020',
      label: 'Chicago projects with Cook County demographic context',
    },
    methodStance: 'juxtaposition',
    methodNote: METHOD_URBAN_RENEWAL,
    observations: [...nhgisBlackShare, ACS.blackShare, ...nhgisHomeownership],
    artifacts: URBAN_RENEWAL_ARTIFACTS,
    gapStates: ['insufficient_evidence'],
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_mass_incarceration_q8_states',
    questionId: 'Q8',
    themeId: 'mass_incarceration',
    title: 'How state Black–White imprisonment disparities vary',
    summary:
      'The latest comparable cohort is a cross-section, not a modern-era trend. Across 50 states in 2023, the median Black-to-White imprisonment-rate ratio was 5.42 and the observed range was 2.46 to 13.63. Illinois was 7.29, Mississippi 2.46, New Jersey 13.46, and Wisconsin 13.63. The rates divide BJS prisoner counts by 2023 ACS 5-year race estimates and should not be confused with BJS-published rates, admissions, jail detention, or individual risk.',
    policyEras: [],
    geography: {
      geographyType: 'nation',
      jurisdictionId: NATION,
      boundaryVersion: 'state-2020',
      label: '50-state comparable cross-section',
    },
    methodStance: 'juxtaposition',
    methodNote:
      'This packet compares state systems in one year. It does not claim a historical trend because the warehouse currently has only 2022–2023 comparable state race-rate coverage. The rates divide BJS year-end prisoner counts by 2023 ACS 5-year non-Hispanic race estimates because the aligned PEP query returned no rows; treat the exact ratios as descriptive warehouse estimates, not BJS-published rates.',
    observations: stateJusticeObservations,
    derived: q8Derived,
    artifacts: [
      artifact({
        artifactId: 'art_bjs_prisoners_2023',
        artifactClass: 'primary_government_document',
        title: 'Prisoners in 2023: Statistical Tables',
        citation:
          'E. Ann Carson and Rich Kluckow, Prisoners in 2023: Statistical Tables, Bureau of Justice Statistics.',
        source: 'bureau-of-justice-statistics',
        sourceUrl: 'https://bjs.ojp.gov/document/p23st.pdf',
        contentHash: '22a4cbe8ee0ff6156db97b4825db60907d53f0a345d02166b8484e0ac307b2e9',
        dated: '2023',
        summary:
          'Primary federal statistical report and appendix counts used with Census population denominators.',
      }),
      CENSUS_STATE_RACE_DENOMINATOR_ARTIFACT,
    ],
    gapStates: ['insufficient_evidence'],
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_environmental_racism_q9_illinois',
    questionId: 'Q9',
    themeId: 'environmental_racism',
    title: 'Environmental burden and Black population share: an Illinois test',
    summary:
      'Across 80 Illinois counties with complete coverage, Black population share has a modest positive ecological correlation with the CDC EJI environmental-burden score (r=0.274). The raw TRI facility-count correlation is positive (r=0.371), but after scaling facilities by county population it is slightly negative (r=-0.142). The highest Black-share quartile’s mean EJI score is 0.0862 above the lowest quartile. These mixed results reject a simple facility-count story and support a narrower environmental-justice framing.',
    policyEras: [],
    geography: {
      geographyType: 'state',
      jurisdictionId: 'state:17',
      boundaryVersion: 'county-2020',
      label: '80 Illinois counties with complete ACS, CDC EJI, and EPA TRI coverage',
    },
    methodStance: 'juxtaposition',
    methodNote: METHOD_ENVIRONMENT,
    observations: [ACS.blackShare, EJI, TRI],
    derived: q9Derived,
    artifacts: ENVIRONMENTAL_ARTIFACTS,
    gapStates: ['insufficient_evidence'],
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_school_segregation_q11_cook',
    questionId: 'Q11',
    themeId: 'school_segregation',
    title: 'From segregated streets to school opportunity',
    summary:
      'Banaji, Fiske, and Massey argue that neighborhood segregation translates directly into school segregation and uneven school resources. In the Chicago example, Cook County’s Black population share moved from 20.9% in 1970 to 25.0% in 2010 and measured 22.2% in the 2020–2024 ACS, while 26.8% of Black adults 25+ held a bachelor’s degree or higher in that same ACS window. Brown v. Board and later desegregation rulings supply the legal timeline. District discipline and school-finance series are still gap-labeled, so the story links housing to attainment without inventing a classroom-level causal model.',
    policyEras: ['desegregation_era', 'post_busing'],
    geography: {
      geographyType: 'county',
      jurisdictionId: COOK_COUNTY,
      boundaryVersion: 'county-2020',
      label: 'Cook County, Illinois (example metro)',
    },
    methodStance: 'juxtaposition',
    methodNote: METHOD_SCHOOL,
    observations: [ACS.blackShare, ACS.blackBaAttainment, ...nhgisBlackShare],
    artifacts: [
      REDLINING_ARTIFACTS.banaji,
      artifact({
        artifactId: 'art_brown_v_board_oyez',
        artifactClass: 'primary_government_document',
        title: 'Brown v. Board of Education (1954)',
        citation:
          'Brown v. Board of Education of Topeka, 347 U.S. 483 (1954); Oyez case summary.',
        source: 'oyez',
        sourceUrl: 'https://www.oyez.org/cases/1940-1955/347us483',
        contentHash: 'b726a019539a7cf861f3936f0be58a5d1e26b1075b6c6969aa9c6599608d68d3',
        dated: '1954-05-17',
        summary:
          'Supreme Court holding that state-imposed segregation in public schools violates equal protection. Implementation fights continued for decades.',
      }),
      artifact({
        artifactId: 'art_civil_rights_act_1964_nara',
        artifactClass: 'primary_government_document',
        title: 'Civil Rights Act of 1964',
        citation:
          'Civil Rights Act of 1964, Pub. L. 88-352; National Archives milestone overview.',
        source: 'national-archives',
        sourceUrl: 'https://www.archives.gov/milestone-documents/civil-rights-act',
        contentHash: '60176b2f27aff4f779c2a0c93d6f580bd5dddff4f31af6c25c9a358d44c012cd',
        dated: '1964-07-02',
        summary:
          'Title VI tied federal education funds to nondiscrimination, giving desegregation an enforcement lever beyond Brown alone.',
      }),
      REDLINING_ARTIFACTS.fairHousing,
    ],
    gapStates: ['insufficient_evidence'],
    entityBinding: { entityId: 'ent_chicago_freedom_movement_001', purpose: 'story' },
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
  buildThemeImpactPacket({
    id: 'tip_voting_rights_q12_national',
    questionId: 'Q12',
    themeId: 'voting_rights',
    title: 'The long fight to make the ballot count',
    summary:
      'Reconstruction promised the franchise; Jim Crow devices and violence took it back. The Fifteenth Amendment and the Voting Rights Act of 1965 are the primary legal spine. Banaji, Fiske, and Massey place that collapse and recovery inside the same systemic story as housing and schools. Chicago enters as a northern Great Migration city where Black voters reshaped local politics once the ballot was safer, not as a complete turnout dashboard. State turnout and voting-policy indexes stay gap-labeled until MIT Election Lab and Voting Rights Lab series load.',
    policyEras: ['reconstruction_collapse', 'jim_crow_franchise', 'vra_enforcement'],
    geography: {
      geographyType: 'nation',
      jurisdictionId: NATION,
      boundaryVersion: 'nation-2020',
      label: 'United States (Chicago as northern-city example)',
    },
    methodStance: 'juxtaposition',
    methodNote: METHOD_VOTING,
    artifacts: [
      artifact({
        artifactId: 'art_15th_amendment_nara',
        artifactClass: 'primary_government_document',
        title: 'Fifteenth Amendment (1870)',
        citation:
          'U.S. Constitution, Amendment XV; National Archives milestone overview.',
        source: 'national-archives',
        sourceUrl: 'https://www.archives.gov/milestone-documents/15th-amendment',
        contentHash: '56bc1d4e31c4b47626fa39ffa1133fab51cbb866fc8dd968fa6a6ff8ce8dc6f7',
        dated: '1870-02-03',
        summary:
          'Federal ban on denying the vote on account of race. Enforcement failed for decades after Reconstruction collapsed.',
      }),
      artifact({
        artifactId: 'art_voting_rights_act_1965_nara',
        artifactClass: 'primary_government_document',
        title: 'Voting Rights Act of 1965',
        citation:
          'Voting Rights Act of 1965, Pub. L. 89-110; National Archives milestone overview.',
        source: 'national-archives',
        sourceUrl: 'https://www.archives.gov/milestone-documents/voting-rights-act',
        contentHash: '3899b3ee9bd9515914dbb054279847209f2e43f5def2c728b66dcf7442c3220f',
        dated: '1965-08-06',
        summary:
          'Federal oversight tools, including coverage and preclearance, aimed at jurisdictions with histories of discrimination. Later Court decisions narrowed those tools.',
      }),
      REDLINING_ARTIFACTS.banaji,
      REDLINING_ARTIFACTS.chicago1919,
    ],
    gapStates: ['insufficient_evidence'],
    entityBinding: { entityId: 'ent_law_voting_rights_act_1965', purpose: 'story' },
    status: 'published',
    createdAt: PACKET_CREATED_AT,
    updatedAt: PACKET_UPDATED_AT,
  }),
] as const;

for (const packet of RESEARCHED_THEME_IMPACT_PACKETS) {
  if (packet.status !== 'published') {
    throw new Error(`researched packet ${packet.id} must be published`);
  }
}

export function listResearchedThemeImpactPackets(
  themeId?: string,
): readonly ThemeImpactPacket[] {
  return themeId === undefined
    ? RESEARCHED_THEME_IMPACT_PACKETS
    : RESEARCHED_THEME_IMPACT_PACKETS.filter((packet) => packet.themeId === themeId);
}

export const THEME_RESEARCH_ADJUDICATION = [
  {
    themeId: 'redlining',
    decision: 'rename',
    publicTitle: 'Housing segregation & redlining',
    rationale:
      'Banaji/Fiske/Massey and Rothstein support a wider housing-segregation spine. Keep Chicago as an example metro, distinguish HOLC maps from the FHA/private system, and gate systemic causation to named secondaries.',
  },
  {
    themeId: 'drug_policy_state',
    decision: 'narrow',
    publicTitle: 'Drug policy, sentencing & enforcement',
    rationale:
      'Retain documented statutes and measured sentencing/incarceration series; remove the unsupported intelligence-market placeholder and unrelated wealth rows.',
  },
  {
    themeId: 'urban_renewal',
    decision: 'retain',
    rationale:
      'The Housing Act, federal project compilation, and displacement scholarship support the theme, with an explicit county/project scale gap.',
  },
  {
    themeId: 'mass_incarceration',
    decision: 'narrow',
    rationale:
      'Keep as a distinct cross-state system comparison; do not duplicate the drug-policy era packet or claim a long trend from two years of state data.',
  },
  {
    themeId: 'environmental_racism',
    decision: 'rename',
    publicTitle: 'Environmental justice & unequal burden',
    rationale:
      'The broader scholarly theme is well supported, but the Illinois county proxies produce mixed results and require a question-led, non-causal public title.',
  },
  {
    themeId: 'school_segregation',
    decision: 'retain',
    publicTitle: 'School segregation & opportunity',
    rationale:
      'Massey’s segregation-to-schools linchpin and the Brown/CRA timeline support a first education packet; CRDC and school-finance metrics stay gap-labeled until ingest.',
  },
  {
    themeId: 'voting_rights',
    decision: 'retain',
    publicTitle: 'Voting rights & political exclusion',
    rationale:
      'Primary franchise statutes and Banaji/Fiske/Massey’s Reconstruction framing support an artifact spine; turnout and policy indexes remain cite-first until warehouse series load.',
  },
] as const;
