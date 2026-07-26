/**
 * Voting-rights theme packet ("Casting a ballot"), era-immersion rewrite.
 *
 * Supersedes the earlier "The long fight to make the ballot count" packet in
 * place: it reuses the same packet id (tip_voting_rights_q12_national) so the
 * theme keeps exactly one voting_rights row (no duplicate), rewrites the body
 * into the second-person era-jump voice, and lands at status 'review' for the
 * epic QA/publish gate rather than auto-publishing.
 *
 * Voice + structure: docs/content/era-immersion-style.md. method_stance is
 * juxtaposition throughout. Odds/comparisons live in prose; exact figures and
 * their obs ids live in observations/derived. The CPS citizen-base (CVAP)
 * universe note lives only in method_note, never in the narrative.
 *
 * Every number is a live canonical row (verified 2026-07-26):
 *   Registration (USCCR Political Participation 1968, Mississippi, state:28):
 *     usccr-black-registration-rate-state:state:28:1964  = 6.7%  (pre-VRA)
 *     usccr-black-registration-rate-state:state:28:1967  = 59.8% (post-VRA)
 *   Turnout (Census CPS Table A-1, citizen base, nation:US):
 *     obs:cps-a1-turnout-black-nation:nation:US:2012 = 66.2%
 *     obs:cps-a1-turnout-white-nation:nation:US:2012 = 64.1%  (2012 crossover)
 *     obs:cps-a1-turnout-black-nation:nation:US:2020 = 62.6%
 *     obs:cps-a1-turnout-white-nation:nation:US:2020 = 70.9%  (latest ingested)
 *   Closing chart spine: spine-turnout-black-us vs spine-turnout-white-us,
 *   presidential years 1980-2020 (the actual ingested range; 1964/68/72/76 and
 *   2024 are not ingested), with Voting Rights Act (1965) and Shelby County v.
 *   Holder (2013) as event markers.
 */

const NATION = 'nation:US' as const;
const NOW = '2026-07-26T12:00:00.000Z';
const CREATED_AT = '2026-07-22T23:00:00.000Z';

type Provenance = {
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  contentHash: string;
  humanCitation: string;
};

// --- Registration: USCCR Political Participation (1968), Mississippi ---------
const USCCR_SOURCE = 'U.S. Commission on Civil Rights, Political Participation (1968), p. 13';
const USCCR_URL = 'https://www.crmvet.org/docs/ccr_voting_south_6805.pdf';
const USCCR_HASH = 'feab387b8c31aef5dc27bb12bddbc92efe96284f0d744f368ca71a63a0f4efaa';
const USCCR_RETRIEVED = '2026-07-25T00:00:00.000Z';

function usccrProv(human: string): Provenance {
  return {
    source: USCCR_SOURCE,
    sourceUrl: USCCR_URL,
    retrievedAt: USCCR_RETRIEVED,
    contentHash: USCCR_HASH,
    humanCitation: human,
  };
}

const MS_REG_1964 = {
  observationId: 'usccr-black-registration-rate-state:state:28:1964',
  metricId: 'usccr-black-registration-rate-state',
  estimate: 6.7,
  unit: 'percent',
  referencePeriod: '1964',
  label: 'Black voting-age registration rate, Mississippi (pre-VRA)',
  provenance: usccrProv(
    'U.S. Commission on Civil Rights, Political Participation (1968), Table, p. 13: nonwhite registration rate, Mississippi, 1964.',
  ),
};

const MS_REG_1967 = {
  observationId: 'usccr-black-registration-rate-state:state:28:1967',
  metricId: 'usccr-black-registration-rate-state',
  estimate: 59.8,
  unit: 'percent',
  referencePeriod: '1967',
  label: 'Black voting-age registration rate, Mississippi (post-VRA)',
  provenance: usccrProv(
    'U.S. Commission on Civil Rights, Political Participation (1968), Table, p. 13: nonwhite registration rate, Mississippi, 1967.',
  ),
};

// --- Turnout: Census CPS Table A-1 (citizen base), national ------------------
const CPS_SOURCE = 'us-census-cps';
const CPS_URL =
  'https://www2.census.gov/programs-surveys/cps/tables/time-series/voting-historical-time-series/a1.xlsx';
const CPS_HASH = 'c2953008866c6f6e5ae1d56e7ec8008ae5478725fb3ecd16786a845e487feda0';
const CPS_RETRIEVED = '2026-07-24T05:02:00.000Z';

function cpsProv(human: string): Provenance {
  return {
    source: CPS_SOURCE,
    sourceUrl: CPS_URL,
    retrievedAt: CPS_RETRIEVED,
    contentHash: CPS_HASH,
    humanCitation: human,
  };
}

const TURNOUT_BLACK_2012 = {
  observationId: 'obs:cps-a1-turnout-black-nation:nation:US:2012',
  metricId: 'cps-a1-turnout-black-nation',
  estimate: 66.2,
  unit: 'percent',
  referencePeriod: '2012',
  label: 'Black citizen turnout, presidential (2012)',
  provenance: cpsProv(
    'U.S. Census Bureau, CPS Table A-1: Black reported citizen voting rate, November 2012.',
  ),
};

const TURNOUT_WHITE_2012 = {
  observationId: 'obs:cps-a1-turnout-white-nation:nation:US:2012',
  metricId: 'cps-a1-turnout-white-nation',
  estimate: 64.1,
  unit: 'percent',
  referencePeriod: '2012',
  label: 'White non-Hispanic citizen turnout, presidential (2012)',
  provenance: cpsProv(
    'U.S. Census Bureau, CPS Table A-1: White non-Hispanic reported citizen voting rate, November 2012.',
  ),
};

const TURNOUT_BLACK_2020 = {
  observationId: 'obs:cps-a1-turnout-black-nation:nation:US:2020',
  metricId: 'cps-a1-turnout-black-nation',
  estimate: 62.6,
  unit: 'percent',
  referencePeriod: '2020',
  label: 'Black citizen turnout, presidential (2020)',
  provenance: cpsProv(
    'U.S. Census Bureau, CPS Table A-1: Black reported citizen voting rate, November 2020.',
  ),
};

const TURNOUT_WHITE_2020 = {
  observationId: 'obs:cps-a1-turnout-white-nation:nation:US:2020',
  metricId: 'cps-a1-turnout-white-nation',
  estimate: 70.9,
  unit: 'percent',
  referencePeriod: '2020',
  label: 'White non-Hispanic citizen turnout, presidential (2020)',
  provenance: cpsProv(
    'U.S. Census Bureau, CPS Table A-1: White non-Hispanic reported citizen voting rate, November 2020.',
  ),
};

const METHOD_NOTE =
  'Method stance: juxtaposition throughout. The franchise statutes, the state ' +
  'registration rates, and the national turnout rates are placed beside one ' +
  'another; none is presented as the single cause of another. ' +
  'Registration figures are from the U.S. Commission on Civil Rights, Political ' +
  'Participation (1968), p. 13: the share of voting-age nonwhite residents ' +
  'registered in Mississippi (state:28), predominantly Black in this state. ' +
  'These are state-level, voting-age-base rates for 1964 and 1967, not national ' +
  'and not citizen-base. ' +
  'The Alabama literacy-test specimen is shown beside the Mississippi ' +
  'registration rate as an example of the class of "test or device" the 1965 ' +
  'Act barred; it is a specimen archived by the Veterans of the Civil Rights ' +
  'Movement (crmvet.org), not Mississippi’s own form and not an individual ' +
  'applicant’s record, and its rights status is unverified. ' +
  'Turnout figures are Census CPS Table A-1 reported voting rates on a citizen ' +
  '(CVAP) base, presidential years, a single continuous instrument. The ' +
  'closing spine (spine-turnout-black-us vs spine-turnout-white-us) carries ' +
  'presidential years 1980 through 2020 only: the 1964, 1968, 1972, and 1976 ' +
  'elections and 2024 are not yet ingested, so the Voting Rights Act marker ' +
  '(1965) falls before the first ingested data point and 2020 is the latest ' +
  'point shown. ' +
  'CPS universe note: the A-1 turnout series is measured on a citizen base ' +
  '(CVAP) across the entire ingested span; no voting-age-population (VAP) ' +
  'denominator segment is ingested, and spine_segments.seam_check for both ' +
  'turnout spines records a single-source series with no VAP-to-CVAP ' +
  'definitional seam. The USCCR registration rates (voting-age base) and the ' +
  'CPS turnout rates (citizen base) are different universes and are not spliced ' +
  'into one line. ' +
  'Shelby County v. Holder (2013) is marked as a dated event only.';

export const votingRightsPackets = [
  {
    id: 'tip_voting_rights_q12_national',
    question_id: 'Q12',
    theme_id: 'voting_rights',
    title: 'Casting a ballot',
    summary:
      'You are in Mississippi in 1964, at the county clerk’s desk, asking to ' +
      'register to vote. Before your name reaches any roll you are handed a test. ' +
      'One specimen of the kind then in circulation, the Alabama literacy test ' +
      'preserved from these years, opens: "Has the following part of the U.S. ' +
      'Constitution been changed?" and runs on through clauses most registered ' +
      'voters had never read. The clerk decides whether you pass. Across ' +
      'Mississippi that year, roughly 7 in every 100 Black residents of voting ' +
      'age are registered. ' +
      'A federal law is signed the next summer, and you come back in 1967. The ' +
      'rule on the desk has changed. The Voting Rights Act bars any "test or ' +
      'device" as a prerequisite to voting or registration, and it freezes the ' +
      'old machinery: a covered state may not enforce a voting procedure ' +
      '"different from that in force or effect on November 1, 1964" without ' +
      'federal clearance first. You register. Across Mississippi now, about 6 in ' +
      'every 10 Black residents of voting age are on the rolls. ' +
      'Two generations pass. It is 2012, and you are standing in line on a ' +
      'Tuesday in November. Nobody hands you a test. When the citizen turnout is ' +
      'counted, about 66 in every 100 Black citizens have voted, just above the ' +
      'roughly 64 in 100 among white citizens: the one presidential year in the ' +
      'measured series where the Black rate sits higher than the white ' +
      'non-Hispanic rate. ' +
      'It is the 2020s now, and you are back in the same line. The most recent ' +
      'presidential count puts Black citizen turnout near 63 in 100 and white ' +
      'non-Hispanic turnout near 71 in 100. The order from 2012 has reversed, and ' +
      'the distance between the two is about eight in a hundred again. The chart ' +
      'below carries both rates across the years the series covers, with the ' +
      'Voting Rights Act and the Supreme Court’s 2013 Shelby County decision ' +
      'marked where they fall.',
    policy_eras: ['jim_crow_franchise', 'vra_enforcement', 'post_shelby_contemporary'],
    geography: {
      geographyType: 'nation',
      jurisdictionId: NATION,
      boundaryVersion: 'nation-2020',
      label: 'United States (national turnout spine; Mississippi registration era anchor)',
      scopeKey: 'national:voting_rights',
    },
    method_stance: 'juxtaposition',
    method_note: METHOD_NOTE,
    observations: [
      MS_REG_1964,
      MS_REG_1967,
      TURNOUT_BLACK_2012,
      TURNOUT_WHITE_2012,
      TURNOUT_BLACK_2020,
      TURNOUT_WHITE_2020,
    ],
    derived: [
      {
        derivedId: 'der_ms_black_registration_change_1964_1967',
        methodId: 'registration_rate_change',
        value: 53.1,
        unit: 'percentage_points',
        status: 'derived',
        formula:
          'usccr-black-registration-rate-state:state:28:1967 - usccr-black-registration-rate-state:state:28:1964',
        inputObservationIds: [MS_REG_1964.observationId, MS_REG_1967.observationId],
        label: 'Mississippi Black voting-age registration change, 1964 to 1967',
        provenance: usccrProv(
          'Derived from USCCR Political Participation (1968) p. 13: Mississippi nonwhite registration 6.7% (1964) to 59.8% (1967).',
        ),
      },
      {
        derivedId: 'der_turnout_black_white_gap_nation_2012',
        methodId: 'black_white_turnout_gap',
        value: 2.1,
        unit: 'percentage_points',
        status: 'derived',
        formula: 'cps-a1-turnout-black-nation:2012 - cps-a1-turnout-white-nation:2012',
        inputObservationIds: [
          TURNOUT_BLACK_2012.observationId,
          TURNOUT_WHITE_2012.observationId,
        ],
        label: 'Black minus White non-Hispanic citizen turnout gap (2012 crossover)',
        provenance: cpsProv(
          'Derived from CPS Table A-1: Black (66.2%) minus White non-Hispanic (64.1%) citizen turnout, November 2012.',
        ),
      },
      {
        derivedId: 'der_turnout_black_white_gap_nation_2020',
        methodId: 'black_white_turnout_gap',
        value: -8.3,
        unit: 'percentage_points',
        status: 'derived',
        formula: 'cps-a1-turnout-black-nation:2020 - cps-a1-turnout-white-nation:2020',
        inputObservationIds: [
          TURNOUT_BLACK_2020.observationId,
          TURNOUT_WHITE_2020.observationId,
        ],
        label: 'Black minus White non-Hispanic citizen turnout gap (2020, latest)',
        provenance: cpsProv(
          'Derived from CPS Table A-1: Black (62.6%) minus White non-Hispanic (70.9%) citizen turnout, November 2020.',
        ),
      },
    ],
    artifacts: [
      {
        artifactId: 'art_alabama_literacy_test_1965',
        artifactClass: 'primary_document_specimen',
        title: 'Alabama literacy test specimen (mid-1960s)',
        dated: '1965',
        citation:
          'Alabama Literacy Test specimen, circa mid-1960s; archived by the Veterans of the Civil Rights Movement (crmvet.org). Evidence record ev_alabama_literacy_test_q1.',
        sourceUrl: 'https://www.crmvet.org/info/litques.pdf',
        summary:
          'Specimen registration test of the class barred by the 1965 Act. Question 1 verbatim: "Has the following part of the U.S. Constitution been changed?"',
        uncertaintyLabel:
          'Specimen archived by a civil-rights nonprofit, not an individual applicant record; Alabama form shown beside the Mississippi rate as an example of the class of device. Rights status unverified.',
      },
      {
        artifactId: 'art_voting_rights_act_1965_sec4_sec5',
        artifactClass: 'primary_government_document',
        title: 'Voting Rights Act of 1965, Sec. 4 and Sec. 5',
        dated: '1965-08-06',
        citation:
          'Voting Rights Act of 1965, Pub. L. 89-110; Sec. 4(c) ("test or device") and Sec. 5 (preclearance), govinfo compiled statute COMPS-350. Evidence records ev_vra_sec4c_test_or_device, ev_vra_sec5_preclearance.',
        sourceUrl: 'https://www.govinfo.gov/content/pkg/COMPS-350/pdf/COMPS-350.pdf',
        summary:
          'Sec. 4(c) defines and bars the "test or device"; Sec. 5 requires covered states to clear any change from the procedure "in force or effect on November 1, 1964" before enforcing it.',
      },
      {
        artifactId: 'art_15th_amendment_nara',
        artifactClass: 'primary_government_document',
        title: 'Fifteenth Amendment (1870)',
        dated: '1870-02-03',
        citation: 'U.S. Constitution, Amendment XV; National Archives milestone overview.',
        sourceUrl: 'https://www.archives.gov/milestone-documents/15th-amendment',
        summary:
          'Federal ban on denying the vote on account of race; enforcement lapsed for decades after Reconstruction.',
      },
      {
        artifactId: 'art_census_cps_a1_voting_historical',
        artifactClass: 'primary_government_document',
        title: 'CPS Historical Reported Voting Rates, Table A-1',
        dated: '1964-2020',
        citation:
          'U.S. Census Bureau, Current Population Survey, Historical Reported Voting Rates, Table A-1, November 1964 to 2020.',
        sourceUrl:
          'https://www2.census.gov/programs-surveys/cps/tables/time-series/voting-historical-time-series/a1.xlsx',
        summary:
          'Primary national turnout series by race and Hispanic origin. Citizen-base rates for presidential years. The published workbook ends at 2020.',
      },
      {
        artifactId: 'art_shelby_county_v_holder_2013',
        artifactClass: 'primary_government_document',
        title: 'Shelby County v. Holder (2013)',
        dated: '2013-06-25',
        citation:
          'Shelby County v. Holder, 570 U.S. 529 (2013). The Court held the Sec. 4(b) coverage formula unconstitutional, ending preclearance under the existing formula.',
        sourceUrl: 'https://www.supremecourt.gov/opinions/12pdf/12-96_6k47.pdf',
        summary:
          'Marked as a dated event on the closing turnout chart; struck down the coverage formula that had triggered Sec. 5 preclearance.',
      },
    ],
    gap_states: ['insufficient_evidence'],
    entity_id: 'ent_law_voting_rights_act_1965',
    binding_purpose: 'story',
    status: 'review',
    created_at: CREATED_AT,
    updated_at: NOW,
  },
] as const;
