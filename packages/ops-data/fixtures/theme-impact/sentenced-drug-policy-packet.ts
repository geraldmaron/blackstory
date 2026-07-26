/**
 * "Sentenced" (theme_id: drug_policy_state): era-immersion rewrite.
 *
 * Supersedes the NARRATIVE role of the two existing drug_policy_state packets
 * (tip_drug_policy_q5_national, tip_drug_policy_q6_il_spine). Those remain
 * published as method companions: Q5 keeps the federal-statute artifact spine,
 * Q6 keeps the Illinois/Cook state instrument and the "two labeled instruments"
 * separation. This packet lands at status='review' and does NOT enter the
 * published RESEARCHED_THEME_IMPACT_PACKETS registry (that apply path is
 * published-only); it is applied directly via upsert-sentenced-drug-policy-packet.sql.
 *
 * Voice: docs/content/era-immersion-style.md (second person, present tense,
 * odds not bare decimals, statute text quoted verbatim, gaps in the method note).
 *
 * Every observation id, estimate, source, and content_hash below is a verified
 * snapshot of bb_reference.statistical_observations. Statute quotes are verbatim
 * from the curated 21 U.S.C. 841 evidence record (public domain) ingested for
 * the drug-policy primary-document pass.
 *
 * Coverage the narrative respects (see method_note):
 *   - spine-admissions-share-black-us : 1926-1986 (this packet uses 1975-1986)
 *   - spine-imprisonment-rate-black-us / -white-us : 2010-2023 ONLY
 *     (no 1999 point exists; the peak-of-record in the assembled national spine
 *      is 2013). Unreconciled 2012->2013 vintage seam: anchors stay inside the
 *      post-2013 vintage (2013, 2020, 2023) and never narrate across the seam.
 */

const NOW = '2026-07-25T00:00:00.000Z';

const BJS_ADMISSIONS_URL = 'https://www.ojp.gov/pdffiles1/nij/125618.pdf';
const BJS_ADMISSIONS_SOURCE = 'bjs-race-of-prisoners-1926-86';
const BJS_ADMISSIONS_RETRIEVED = '2026-07-24T05:02:00.000Z';

const BJS_IMPRISONMENT_URL = 'https://bjs.ojp.gov/document/p23st.zip';
const BJS_IMPRISONMENT_SOURCE = 'bjs-national-prisoner-statistics';
const BJS_IMPRISONMENT_RETRIEVED = '2026-07-24T05:02:00.000Z';

const USSC_URL_BASE =
  'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/quick-facts';
const USSC_SOURCE = 'ussc-quick-facts-drug';
const USSC_RETRIEVED = '2026-07-22T21:40:54.731Z';

const USC841_URL =
  'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title21-section841&num=0&edition=prelim';

const METHOD =
  'Statute text, prison-admission shares, federal cocaine caseloads, and imprisonment rates describe different systems and are juxtaposed, not combined into a causal estimate; the statutory quantity ratios speak for themselves. Coverage is named rather than smoothed. The Black share of prison admissions runs 1926-1986 (BJS, Race of Prisoners in State and Federal Institutions, 1926-86); this arc uses 1975 through 1986. The assembled national imprisonment spine (spine-imprisonment-rate-black-us and its White twin) covers 2010-2023 only, so there is no 1999 observation to anchor a peak: the peak the series can see is 2013, and pre-2010 rates sit outside coverage. That spine carries an unreconciled 2012->2013 vintage seam (BJS CSAT p20st for 2010-2012, BJS NPS p23st for 2013-2023), so every imprisonment comparison here stays inside the post-2013 vintage (2013, 2020, 2023) and none is drawn across the seam. The U.S. Sentencing Commission crack caseload figures are fiscal-year 2016 and 2023 readings of a modern federal docket, not 1986-contemporaneous counts. Juxtaposition is not causation.';

// --- Observations (verified against bb_reference.statistical_observations) ---

const ADMISSIONS = [
  ['1975', 35, '786262fb748b88d099adcb700d3222d90f0bdb90eb2a6837469c12128d82c216'],
  ['1978', 41, '632db3753d3eabc8fc2d730d947dcd9cc2704b7a44268e699fcf872697902671'],
  ['1982', 44, '1c241a978bd9162d84eac814519e5e7106e5373061f8b5f44ac50be487b20a90'],
  ['1986', 44, 'c302def5757c9523dd51c7ca45a49e684eff4dcedd3c76e119f5ee77551040c4'],
] as const;

const admissionsObservations = ADMISSIONS.map(([period, estimate, contentHash]) => ({
  observationId: `obs:bjs-admissions-share-black-nation:nation:US:${period}`,
  metricId: 'bjs-admissions-share-black-nation',
  estimate,
  unit: 'percent',
  referencePeriod: period,
  label: 'Black share of prison admissions, United States',
  provenance: {
    source: BJS_ADMISSIONS_SOURCE,
    sourceUrl: BJS_ADMISSIONS_URL,
    retrievedAt: BJS_ADMISSIONS_RETRIEVED,
    contentHash,
    humanCitation: `Bureau of Justice Statistics, Race of Prisoners Admitted to State and Federal Institutions, 1926-1986, Table 2: Black share of admissions, ${period}.`,
  },
}));

const IMPRISONMENT = [
  ['bjs-imprisonment-rate-black-nation', '2013', 1818, '37caa9a8e4cc1c7e871b3701124d247ae262222d896c573da770340224806fbb', 'Black'],
  ['bjs-imprisonment-rate-black-nation', '2020', 1238, 'a30ab89f78dc58899eec2ad19aef158b74290afbb4a6f337a0347d2ca68673ce', 'Black'],
  ['bjs-imprisonment-rate-black-nation', '2023', 1218, '0308a7af54fa221f222823d91bcbc1ca334588ee193feec8f29aab2450882312', 'Black'],
  ['bjs-imprisonment-rate-white-nation', '2013', 295, 'cb5a2de335079a4a91c4c06d1ea57f567bc9324b6a47e6503173ae86be68ef14', 'White non-Hispanic'],
  ['bjs-imprisonment-rate-white-nation', '2020', 224, '42fca7dade873aa7327710e1a132d2b500a85d07008e5dc8521cb1fb23edf7a2', 'White non-Hispanic'],
  ['bjs-imprisonment-rate-white-nation', '2023', 231, '2d8dc393d493150263bb6f78047d9414e4b60f82e83e36ade684562595fa6151', 'White non-Hispanic'],
] as const;

const imprisonmentObservations = IMPRISONMENT.map(([metricId, period, estimate, contentHash, race]) => ({
  observationId: `obs:${metricId}:nation:US:${period}`,
  metricId,
  estimate,
  unit: 'per_100k',
  referencePeriod: period,
  label: `${race} imprisonment rate, United States (BJS-published)`,
  provenance: {
    source: BJS_IMPRISONMENT_SOURCE,
    sourceUrl: BJS_IMPRISONMENT_URL,
    retrievedAt: BJS_IMPRISONMENT_RETRIEVED,
    contentHash,
    humanCitation: `Bureau of Justice Statistics, Prisoners in 2023 Statistical Tables, Table 6: ${race} adult imprisonment rate per 100,000 adult U.S. residents, ${period}.`,
  },
}));

const USSC = [
  ['ussc-black-share-crack-offenders-nation', '2016', 82.6, 'percent', '3b3130b87b3d130a67ef55ed03a066cef5d742d9b97694819c28b5da645d49c8', 'Crack_Cocaine_FY16.pdf', 'Black share of federal crack-cocaine trafficking defendants'],
  ['ussc-black-share-crack-offenders-nation', '2023', 78.9, 'percent', '1bae98788c5fbaf66abcad6c41f64f42ea5d8d24fe4c1ec0ad72e16096f67dfd', 'Crack_Cocaine_FY23.pdf', 'Black share of federal crack-cocaine trafficking defendants'],
  ['ussc-average-sentence-months-crack-nation', '2023', 60, 'months', '2c33b76557c8e97050106138bbf7306c6b623fce468ed238cab3be3560e422ed', 'Crack_Cocaine_FY23.pdf', 'Average federal crack-cocaine trafficking sentence'],
  ['ussc-average-sentence-months-powder-nation', '2023', 68, 'months', 'd8d20debd719be2ad3c401810dae94f481763968e4b57844b9dd9329f57e7045', 'Powder_Cocaine_FY23.pdf', 'Average federal powder-cocaine trafficking sentence'],
] as const;

const usscObservations = USSC.map(([metricId, period, estimate, unit, contentHash, file, label]) => ({
  observationId: `obs:${metricId}:nation:US:${period}`,
  metricId,
  estimate,
  unit,
  referencePeriod: period,
  label,
  provenance: {
    source: USSC_SOURCE,
    sourceUrl: `${USSC_URL_BASE}/${file}`,
    retrievedAt: USSC_RETRIEVED,
    contentHash,
    humanCitation: `U.S. Sentencing Commission Quick Facts, ${label.toLowerCase()}, fiscal year ${period}.`,
  },
}));

// --- Derived (ratios / era deltas; placeholder derived hashes per fixture convention) ---

const derived = [
  {
    derivedId: 'der_sentenced_bw_imprisonment_ratio_2013',
    methodId: 'black_white_imprisonment_rate_ratio',
    value: 6.16,
    unit: 'ratio',
    status: 'derived',
    formula: 'bjs-imprisonment-rate-black-nation / bjs-imprisonment-rate-white-nation (2013)',
    inputObservationIds: [
      'obs:bjs-imprisonment-rate-black-nation:nation:US:2013',
      'obs:bjs-imprisonment-rate-white-nation:nation:US:2013',
    ],
    label: 'Black-to-White national imprisonment-rate ratio, 2013 (peak of the assembled spine)',
    provenance: {
      source: 'blackstory-derived-measurement',
      sourceUrl: BJS_IMPRISONMENT_URL,
      retrievedAt: NOW,
      contentHash: 'sha256:derived-sentenced-bw-imprisonment-ratio-2013',
      humanCitation: 'Derived from BJS Prisoners in 2023 Table 6 adult imprisonment rates, 2013 (1,818 vs 295 per 100,000).',
    },
  },
  {
    derivedId: 'der_sentenced_bw_imprisonment_ratio_2023',
    methodId: 'black_white_imprisonment_rate_ratio',
    value: 5.27,
    unit: 'ratio',
    status: 'derived',
    formula: 'bjs-imprisonment-rate-black-nation / bjs-imprisonment-rate-white-nation (2023)',
    inputObservationIds: [
      'obs:bjs-imprisonment-rate-black-nation:nation:US:2023',
      'obs:bjs-imprisonment-rate-white-nation:nation:US:2023',
    ],
    label: 'Black-to-White national imprisonment-rate ratio, 2023',
    provenance: {
      source: 'blackstory-derived-measurement',
      sourceUrl: BJS_IMPRISONMENT_URL,
      retrievedAt: NOW,
      contentHash: 'sha256:derived-sentenced-bw-imprisonment-ratio-2023',
      humanCitation: 'Derived from BJS Prisoners in 2023 Table 6 adult imprisonment rates, 2023 (1,218 vs 231 per 100,000).',
    },
  },
  {
    derivedId: 'der_sentenced_admissions_share_delta_1975_1982',
    methodId: 'era_delta',
    value: 9,
    unit: 'percentage_points',
    status: 'derived',
    formula: 'bjs-admissions-share-black-nation 1982 minus 1975',
    inputObservationIds: [
      'obs:bjs-admissions-share-black-nation:nation:US:1975',
      'obs:bjs-admissions-share-black-nation:nation:US:1982',
    ],
    label: 'Change in Black share of prison admissions, 1975 to 1982',
    provenance: {
      source: 'blackstory-derived-measurement',
      sourceUrl: BJS_ADMISSIONS_URL,
      retrievedAt: NOW,
      contentHash: 'sha256:derived-sentenced-admissions-delta-1975-1982',
      humanCitation: 'Derived from BJS Race of Prisoners 1926-86 Table 2 Black admission shares, 1975 (35%) and 1982 (44%).',
    },
  },
] as const;

// --- Artifacts (statute spine + verbatim 21 U.S.C. 841 quote source) ---

const artifacts = [
  {
    artifactId: 'art_anti_drug_abuse_act_1986',
    artifactClass: 'primary_government_document',
    title: 'Anti-Drug Abuse Act of 1986',
    dated: '1986-10-27',
    citation: 'Anti-Drug Abuse Act of 1986, Pub. L. 99-570, 100 Stat. 3207.',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-100/pdf/STATUTE-100-Pg3207.pdf',
    summary:
      'Set the quantity-triggered mandatory minimums: 5 grams of cocaine base carried the same five-year minimum as 500 grams of powder cocaine, and 50 grams the same ten-year minimum as 5 kilograms of powder, a 100-to-1 ratio.',
  },
  {
    artifactId: 'art_usc_841_cocaine_thresholds',
    artifactClass: 'primary_government_document',
    title: '21 U.S.C. 841 cocaine-base quantity thresholds and amendment notes',
    dated: '1986-2010',
    citation:
      '21 U.S.C. 841(b)(1)(A)(iii), (B)(iii), with Pub. L. 111-220 amendment notes (Office of the Law Revision Counsel, U.S. Code).',
    sourceUrl: USC841_URL,
    summary:
      'Verbatim statutory text of the crack-cocaine tiers and the historical amendment notes recording that Pub. L. 111-220 "substituted \\"28 grams\\" for \\"5 grams\\"" and "\\"280 grams\\" for \\"50 grams\\"". Public domain.',
  },
  {
    artifactId: 'art_fair_sentencing_act_2010',
    artifactClass: 'primary_government_document',
    title: 'Fair Sentencing Act of 2010',
    dated: '2010-08-03',
    citation: 'Fair Sentencing Act of 2010, Pub. L. 111-220, 124 Stat. 2372.',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/STATUTE-124/pdf/STATUTE-124-Pg2372.pdf',
    summary:
      'Raised the five-year crack trigger from 5 to 28 grams and the ten-year trigger from 50 to 280 grams against unchanged powder amounts, cutting the ratio from 100-to-1 to 18-to-1 without eliminating it.',
  },
  {
    artifactId: 'art_crs_crack_powder_disparities',
    artifactClass: 'primary_government_document',
    title: 'Congressional Research Service: crack and powder sentencing disparities',
    dated: '2022',
    citation: 'Congressional Research Service, "Cocaine: Crack and Powder Sentencing Disparities," IF11965.',
    sourceUrl: 'https://www.congress.gov/crs_external_products/IF/PDF/IF11965/IF11965.1.pdf',
    summary: 'Nonpartisan synthesis of the statutory ratio, the 2010 reform, and the continuing gap.',
  },
] as const;

const SUMMARY = [
  'You are booked into a county cell in 1975, and the ledger that will follow you is federal. That year Black Americans are about 35 in 100 of everyone admitted to state and federal prison; by 1982 the share is closer to 44 in 100, near half of all admissions, while Black residents are roughly one in eight of the population (BJS, Race of Prisoners in State and Federal Institutions, 1926-86, Table 2).',
  'Eleven years on, Congress writes a number into the law.',
  'You are holding five grams in 1986. Under the Anti-Drug Abuse Act, five grams of cocaine base carries the same five-year mandatory minimum as 500 grams of powder cocaine; the U.S. Code later records the rollback when it "substituted “28 grams” for “5 grams”" and "“280 grams” for “50 grams”" (21 U.S.C. 841(b)(1)(B)(iii), (A)(iii), Pub. L. 111-220 amendment notes). Five grams against five hundred is one hundred to one. That year Black defendants are still about 44 in 100 of prison admissions. On the federal crack docket the same faces recur: even in later years for which the caseload is counted, Black defendants are roughly four in five of everyone sentenced for crack (U.S. Sentencing Commission Quick Facts, fiscal 2016 and 2023).',
  'The rate climbs to the highest point the national record can show.',
  'You are counted in 2013. Black adults are imprisoned at 1,818 per 100,000 and white adults at 295, about six times the rate (BJS, Prisoners in 2023, Table 6). That is the peak the assembled national spine can see; the years before 2010 lie outside its coverage, named in the method note rather than guessed.',
  'Then the law walks part of the way back.',
  'You are resentenced after 2010. The Fair Sentencing Act keeps the tiers but raises the crack trigger to "28 grams or more of a mixture or substance ... which contains cocaine base" against the same 500 grams of powder (21 U.S.C. 841(b)(1)(B)(iii), as amended): one hundred to one becomes eighteen to one. By 2023 the Black imprisonment rate has eased to 1,218 per 100,000 and the white rate to 231, the disparity narrowing from about six to one toward five to one, still the widest on the page. The state companion packets carry the same instrument into Illinois and the fifty-state cross-section, kept separate from this national line on purpose.',
  'Sources: BJS, Race of Prisoners 1926-86; 21 U.S.C. 841 (Office of the Law Revision Counsel); Anti-Drug Abuse Act of 1986 and Fair Sentencing Act of 2010 (govinfo); U.S. Sentencing Commission Quick Facts; BJS, Prisoners in 2023, Table 6.',
].join(' ');

export const sentencedDrugPolicyPacket = {
  id: 'tip_drug_policy_sentenced',
  question_id: 'Q6',
  theme_id: 'drug_policy_state',
  title: 'Sentenced: five grams, one hundred to one, and a disparity the law only narrowed',
  summary: SUMMARY,
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
    label: 'United States (federal statute spine and national imprisonment record)',
    scopeKey: 'national:drug_policy',
  },
  method_stance: 'juxtaposition',
  method_note: METHOD,
  observations: [...admissionsObservations, ...imprisonmentObservations, ...usscObservations],
  derived,
  artifacts,
  gap_states: ['insufficient_evidence'],
  status: 'review',
  created_at: NOW,
  updated_at: NOW,
} as const;

export const sentencedDrugPolicyPackets = [sentencedDrugPolicyPacket] as const;
