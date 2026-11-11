/**
 * Public errata log seed data — reverse-chronological editorial changes wired to
 * methodology and corrections policy. Production replaces this with a live projection.
 * Fact-revision-derived URLs previously pointed at /facts; those routes were retired,
 * so affected URLs point at trust surfaces instead.
 */
import type { ErrataChangeType } from './domain-trust';

export type ErrataEntry = {
  readonly id: string;
  readonly timestamp: string;
  readonly changeType: ErrataChangeType;
  readonly headline: string;
  readonly summary: string;
  readonly affectedUrl?: string;
  readonly affectedFactId?: string;
};

const EDITORIAL_ERRATA: readonly ErrataEntry[] = [
  {
    id: 'errata_talladega_college_hd_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Talladega College Historic District: hospital first claim removed',
    summary:
      'The record called Goodnow Hospital the first medical facility for Black residents of Talladega. National Archives records include 1866 letters from a Talladega hospital surgeon, so that claim is removed. Two other firsts, the first Black institution with an indoor pool and Savery’s first school for Black residents of Talladega County, are now attributed to the college’s National Register nomination, their only support. The record also now says "a formerly enslaved man" and "freedpeople" in its own voice.',
  },
  {
    id: 'errata_dorrance_brooks_square_hd_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Dorrance Brooks Square Historic District: Truman speech date corrected',
    summary:
      'The record dated President Truman’s 1948 speech to October 30. The Truman Library dates it October 29, and the record now gives that date. The record’s first claim for Chinn is also narrowed to the scope her source supports, and it now calls her the first African American woman doctor to practice in Harlem.',
  },
  {
    id: 'errata_barlow_boce_house_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Barlow, Boce W., Jr., House: population figures and first claims corrected',
    summary:
      'The record’s population figures were wrong. It now uses Census Bureau figures of 7,090 in 1940, 24,855 in 1960 and 44,091 in 1970, and says largest racial minority where it said largest single minority or ethnic group. The record called Barlow the first in the Connecticut judiciary, but Howard P. Drew is documented as Connecticut’s first African American judge, so Barlow is now one of the first. Its first minority family claim now reads the first Black family on Canterbury Street.',
  },
  {
    id: 'errata_first_baptist_church_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'First Baptist Church: only gathering place claim corrected',
    summary:
      'The record called the church the only gathering location for the community. French Lick’s Bethel AME church also served the community, so the record now calls First Baptist a gathering location.',
  },
  {
    id: 'errata_nc_at_college_hd_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline:
      'Agricultural and Technical College of North Carolina Historic District: enrollment ranking corrected',
    summary:
      'The record’s ranking of the university among historically Black universities did not hold up as written. It now says the university has been the largest historically Black university in the country by enrollment since fall 2014, as N.C. A&T’s 2019 enrollment release states. The part of the sentence about engineering was supported and is unchanged.',
  },
  {
    id: 'errata_bell_mary_house_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Bell, Mary E., House: AME Zion ordination first claim removed',
    summary:
      'The record said the AME Zion Church was the first to ordain women as elders and deacons. Two Wesleyan churches ordained women elders earlier, so the record no longer claims the AME Zion Church was first.',
  },
  {
    id: 'errata_booker_t_washington_hs_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Booker T. Washington High School: Masonic Lodge school date corrected',
    summary:
      'The record dated the school held at the Masonic Lodge to the late 1920s and called it the first school. The historical marker for the site, as transcribed on HMdb, dates it to 1909 and supports calling it only a school. The record now gives 1909 and calls it a school.',
  },
  {
    id: 'errata_liberty_hill_schoolhouse_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Liberty Hill Schoolhouse: only Black school claim corrected',
    summary:
      'The record used the phrase "the only Black school in Gainesville." Gainesville had another Black school, an elementary school that opened in 1938, so the phrase now reads "Gainesville’s only all-Black secondary school," which a WUFT report supports.',
  },
  {
    id: 'errata_dunbar_elementary_school_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Dunbar Elementary School: construction dates corrected',
    summary:
      'The record said construction took place "in the first two decades of the twentieth century." The National Register nomination shows construction from 1922 onward, and the record now says so. Its description of the school as the only remaining separate elementary school serving Black students is now attributed to the nomination, in the nomination’s own wording.',
  },
  {
    id: 'errata_mars_hill_school_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Mars Hill School: surviving Rosenwald school count corrected',
    summary:
      'The record called the school one of only two surviving Rosenwald schools in western North Carolina. An August 28, 2018 release from the North Carolina Department of Natural and Cultural Resources counts three known to survive in the state’s westernmost counties. The record now uses that dated figure and credits the release. The National Register nomination gives the earlier count of two.',
  },
  {
    id: 'errata_firstness_claims_qualified_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'clarification',
    headline: 'National Register records: first and only claims narrowed or attributed',
    summary:
      'Claims of being first or only, and similar claims of rank, are now narrowed or attributed to their source on Holy Family Catholic Church Historic District; Voorhees College Historic District; Africatown Historic District; Lake Nixon; Carver Center; Fayette Street Historic District; Cypress Street Elementary School; Mathews, Courtney, House; St. Mark’s African Methodist Episcopal Church; Hippard House; Clinton AME Zion Church; Union School District 19 1/2; Gibson County Training School; Tuskegee Institute National Historic Site; Greater Friendship Baptist Church; Immanuel High School-AR0280; Aiken Colored Cemetery; Beard Congregational Church; Buck Creek Rosenwald School; and Brown, Dianna, Antique Shop. In each case the only support was the site’s own National Register nomination or another single source, or the evidence supported only a narrower scope.',
  },
  {
    id: 'errata_outdated_terms_replaced_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'clarification',
    headline: 'National Register records: outdated terms replaced',
    summary:
      'Outdated terms used in the archive’s own voice, such as "Negro," "colored" and "a former slave," were replaced on Voorhees College Historic District; Lake Nixon; St. Luke’s Episcopal Church; Mathews, Courtney, House; Mulberry Chapel Methodist Church; Clinton AME Zion Church; Union School District 19 1/2; Union Tavern; Douglass Junior and Senior High School; Asberry, Nettie J. and Henry J., House; Immanuel High School-AR0280; Aiken Colored Cemetery; Campbell Chapel AME Church; Bethel African Methodist Episcopal Church and Parsonage; Berkley North Historic District; and State Street Public School. These terms remain only in proper names and quotations.',
  },
  {
    id: 'errata_campbell_chapel_ame_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Campbell Chapel AME Church: freedom-purchase claim removed',
    summary:
      'The record said Elbert Head bought his freedom. Head’s own 1889 testimony says he hired himself and his wife out until emancipation, which conflicts with the National Register nomination, so the freedom-purchase claim is removed. The account that Head saved his enslaver from peril is now attributed to the nomination.',
  },
  {
    id: 'errata_bethel_ame_plymouth_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline:
      'Bethel African Methodist Episcopal Church and Parsonage: AME founding year corrected',
    summary:
      'The record said the AME denomination was founded in 1794 in Philadelphia. A Delaware Public Archives marker and the National Archives date Richard Allen’s founding of the AME Church to 1816, and the record now gives 1816.',
  },
  {
    id: 'errata_beard_congregational_church_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Beard Congregational Church: order of teachers corrected',
    summary:
      'The record said the church school was staffed successively by a list of teachers, in an order that did not match the National Register nomination, which names Mrs. Alberta Price as the first teacher at the church. The record now names the teachers who taught there without claiming an order.',
  },
  {
    id: 'errata_immanuel_high_school_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Immanuel High School-AR0280: original building’s fate corrected',
    summary:
      'The record said the original two-story building was replaced. The National Register nomination says it was converted to a one-story building, and the record now says so.',
  },
  {
    id: 'errata_brown_dianna_antique_shop_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Brown, Dianna, Antique Shop: age removed and clientele link softened',
    summary:
      'The record gave Dianna Brown’s age as 60. South Carolina Archives records give her birth year as 1860, which made her about 55 in 1915, when she opened her shop, so the age is removed. The record also said her earlier livery stable work connected her to the clientele who later patronized her shop. It now says that work likely did, as the property’s own history puts it.',
  },
  {
    id: 'errata_buck_creek_rosenwald_school_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Buck Creek Rosenwald School: unconfirmed school count removed',
    summary:
      'The record quoted the National Register nomination as calling Buck Creek one of the "only two known former schools" in Shelby County. That wording could not be confirmed in the nomination, and Rosenwald school listings name more than one other Shelby County school, so the quotation and its attribution are removed. The record no longer gives a count of the county’s schools.',
  },
  {
    id: 'errata_asberry_house_2026',
    timestamp: '2026-11-08T22:00:00.000Z',
    changeType: 'correction',
    headline: 'Asberry, Nettie J. and Henry J., House: degree, dates and funding corrected',
    summary:
      'The record said Nettie Asberry earned a Doctorate of Music, one of the earliest such degrees held by an African American woman. The National Register nomination shows a Teacher of Music degree in 1883, and the record now says so. It also dated her first husband’s death to 1893, which the nomination puts in 1894, called her a choir director where the nomination says organist and music director for Allen AME Church, and credited the 2022 purchase of the house to National Trust funding, which a Forterra release credits to a state grant.',
  },
  {
    id: 'errata_langston_first_elected_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'John Mercer Langston House: not the first Black elected official',
    summary:
      'The record said Langston was "the first Black elected official in the United States." Alexander Twilight was elected to the Vermont legislature in 1836 and Wentworth Cheswill was elected in New Hampshire in 1768, both before Langston\u2019s 1855 election as a township clerk. It now calls him one of the earliest Black Americans elected to public office.',
  },
  {
    id: 'errata_howard_houston_training_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'Howard University: Charles Hamilton Houston trained at Harvard',
    summary:
      'The record said Howard\u2019s law school trained Charles Hamilton Houston. He earned his law degrees at Harvard and later led Howard\u2019s law school, where he trained Thurgood Marshall. An unsourced sentence about Howard anchoring a cluster of Reconstruction institutions was removed, and a claim that the cited page did not support was replaced with the sentence it does contain.',
  },
  {
    id: 'errata_first_baptist_beale_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'First Baptist Church on Beale Street: dates, sources and language',
    summary:
      'The record repeated a 1970 nomination\u2019s wording, including "Negro" in the archive\u2019s own voice. It also said a Black minister led the first prayer meetings, which no source found so far states, placed Henderson\u2019s arrival and Grant\u2019s visit in Reconstruction, and dated Church Park to 1900. It now names Rev. Scott Keys, attributes the 1863 date to the nomination, dates Church Park to 1899 and no longer places Grant\u2019s visit in Reconstruction.',
  },
  {
    id: 'errata_drew_resignation_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'Charles Richard Drew House: why he left the plasma program',
    summary:
      'The record said Drew resigned in protest of segregating donated blood and helped reverse the military\u2019s policy. The National Library of Medicine\u2019s Drew papers find no evidence the policy was his reason for leaving, and his National Register nomination says the Army had already revoked the policy before he became a consultant. The record now states the protest account as disputed and gives his pilot-program dates.',
  },
  {
    id: 'errata_yazoo_hospital_first_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'Afro-American Sons and Daughters Hospital: not the first in Mississippi',
    summary:
      'The record called it the first hospital built in Mississippi to serve African Americans. The Colored King\u2019s Daughters Hospital in Greenville was built for Black patients in 1908. It also said the order gave free care to thousands until 1972. Care was a benefit for dues-paying members with limits, others paid fees, and Yazoo County ran it from 1967.',
  },
  {
    id: 'errata_methodology_launch_2026',
    timestamp: '2026-07-17T12:00:00.000Z',
    changeType: 'editors_note',
    headline: 'Launched public methodology and errata surfaces',
    summary:
      'Published the full methodology page, corrections policy, and reverse-chronological errata log with RSS and JSON feeds.',
    affectedUrl: '/methodology',
  },
  {
    id: 'errata_dunbar_rename_precision_2026',
    timestamp: '2026-07-16T15:00:00.000Z',
    changeType: 'correction',
    headline: 'Dunbar rename statement clarified',
    summary:
      'Corrected short-statement wording so the 1916 rename is not read as a founding date. The methodology and the place record stay the public sources of truth.',
    affectedUrl: '/place/paul-laurence-dunbar-high-school',
    affectedFactId: 'BB-F-000003',
  },
  {
    id: 'errata_campus_rebuild_note_2026',
    timestamp: '2026-07-15T18:00:00.000Z',
    changeType: 'clarification',
    headline: 'Campus rebuild note expanded',
    summary:
      'Added clarification that institutional continuity of Dunbar does not imply continuity of the 1916 building fabric.',
    affectedUrl: '/corrections',
    affectedFactId: 'BB-F-000005',
  },
];

export const ERRATA_SEED: readonly ErrataEntry[] = [...EDITORIAL_ERRATA].sort((a, b) =>
  b.timestamp.localeCompare(a.timestamp),
);

export function listErrataEntries(): readonly ErrataEntry[] {
  return ERRATA_SEED;
}

export function getErrataEntry(id: string): ErrataEntry | undefined {
  return ERRATA_SEED.find((entry) => entry.id === id);
}
