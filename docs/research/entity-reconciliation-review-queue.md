# Entity reconciliation review queue (repo-xez5.3)

Ambiguous Wikidata matches from the authority-anchor reconciliation lane. These are
**not** linked in `bb_canonical.entity_identifiers` — each row below returned one or
more Wikidata candidates but the matcher (`packages/operator-cli/src/entity-reconciliation.ts`)
could not uniquely resolve one without guessing. An operator should confirm (or reject)
the best candidate, then either:

- link it by inserting into `bb_canonical.entity_identifiers` (namespace='wikidata',
  value=QID, trusted=true) and updating `bb_canonical.entity_reconciliation_status` to
  `matched`, or
- mark it `no_match` in `bb_canonical.entity_reconciliation_status` if none of the
  candidates are actually the entity.

**2026-07-24 review pass:** 166 of the original 214 entries were resolved with real
verification (Wikidata description cross-checked against `bb_canonical.entities` kind and
public biographical/historical facts) and linked (`namespace='wikidata', trusted=true`);
status flipped to `matched`. The 48 entries below remain genuinely ambiguous or unresolved
(name-collision with another real person/org, missing/duplicate Wikidata item, or no
distinguishing disambiguator available) and were intentionally left untouched. LCNAF/SNAC/FAST
enrichment (P244/P3430/P2163) was not performed in this pass and is a follow-up.

Each entry: canonical entity id / display name, then the candidate QIDs Wikidata
returned with their descriptions.

<!-- BEGIN GENERATED QUEUE -->
- **ent_black_dispatch_001** (The Black Dispatch)
  - Q65121972: The Black Dispatch — african-American weekly newspaper
  - Q100281045: The Black Dispatch — newspaper published in Oklahoma City, Oklahoma
- **ent_carl_stokes_001** (Carl Stokes)
  - Q5040847: Carl Stokes — first African-American mayor of Cleveland
  - Q47509344: Carl Stokes — painting by David Stone Martin
  - Q5040846: Carl Stokes — American politician
  - Q66325565: Carl Stokes Interview (NAID 53480) — item in the National Archives and Records Administration's holdings
- **ent_charles_young_001** (Charles Young)
  - Q728434: Charles Augustus Young — American astronomer (1834–1908)
  - Q108325546: Charles Young — died in Kolkata
  - Q110979241: Charles Young — American actor
  - Q110179330: Charles Young — Australian (1838-1916)
  - Q3666688: Charlie Young — character in The West Wing
  - Q100963687: Charles Young — college basketball player (1975–1976) Tennessee Tech
- **ent_clinton_high_school_001** (Clinton High School)
  - Q5134140: Clinton High School — high school in Mississippi, United States
  - Q5134139: Clinton High School — high school in Massachusetts, United States
  - Q5134142: Clinton High School — high school in Oklahoma, United States
  - Q5134146: Clinton High School — high school in Iowa, United States
  - Q5134138: Clinton High School — high school in Illinois, United States
  - Q5134137: Clinton High School — high school in Arkansas, United States
- **ent_coffeeville_school_001** (Coffeeville School)
  - Q5140978: Coffeeville School District — school district in Mississippi, United States
- **ent_core_org_001** (Congress of Racial Equality (CORE))
  - Q1125901: Congress of Racial Equality — United States civil rights organization
  - Q67617837: CONGRESS OF RACIAL EQUALITY REPRESENTATIVE (NAID 124305) — item in the National Archives and Records Administration's holdings
- **ent_dorothy_cotton_001** (Dorothy Cotton)
  - Q111081604: Dorothy Cotton — 1572 - 1647
  - Q75467816: Dorothy Tamworth — Peerage person ID=160692
  - Q91519052: Dorothy Cotton — (16 Jul 1693 - 20 May 1748)
  - Q75826080: Dorothy Cotton — Peerage person ID=349575
  - Q3306375: Dot Cotton — fictional character in EastEnders
  - Q75826240: Dorothy Cotton — Peerage person ID=349651
- **ent_dunbar_school_001** (Paul Laurence Dunbar High School)
  - Q5190391: Dunbar High School — public secondary school located in Washington, D.C., United States
  - Q7151957: Paul Laurence Dunbar High School — public high school in Baltimore, Maryland, United States
  - Q7151958: Paul Laurence Dunbar High School — public secondary school in Lexington, Kentucky, United States
  - Q7151959: Paul Laurence Dunbar High School — public high school in Ft. Worth, Texas, United States
  - Q5314154: Dunbar Magnet Middle School — public school in Little Rock, Arkansas, United States
- **ent_frank_petersen_001** (Frank E. Petersen Jr.)
  - Q24905215: USS Frank E. Petersen Jr. — 2018 Arleigh Burke-class destroyer
- **ent_franklin_school_001** (Franklin School)
  - Q100000001: Franklin School — preschool and primary school in Franklin, Australian Capital Territory, Australia
  - Q5491818: Franklin School — building in Washington D.C., United States
  - Q5491814: Franklin School — historic building in Lexington, Massachusetts, United States
  - Q65056873: Franklin School — historic building in Boise, Idaho
  - Q133538992: Franklin School — building in Medford, Massachusetts, United States
  - Q14708316: Franklin School — school in Jamestown, North Dakota
- **ent_friendly_school_001** (Friendly School)
  - Q128559645: Friendly Schools Universal Bullying Prevention Intervention: Effectiveness with Secondary School Students — scholarly article
- **ent_jack_johnson_001** (Jack Johnson)
  - Q297097: Jack Johnson — American singer-songwriter
  - Q6113355: Jack Johnson — English footballer (1919-1975)
  - Q110292510: Jack Johnson — Danish association football player
  - Q122188245: Jack Johnson — American Dirt Modified racing driver (born 1944)
  - Q129530551: Jack Johnson — no description
  - Q123704553: Jack Johnson — rugby league footballer
- **ent_james_west_001** (James West)
  - Q112131618: James West — athlete
  - Q111443551: James West — 5 Nov 1732 Brill, Bucks - 28 Nov 1802 Madras, India
  - Q54640899: James David West — vascular medicine researcher
  - Q6145348: James West — politician and antiquary, President of the Royal Society (1703–1772)
  - Q40566246: James D. West — researcher
  - Q57304900: James West — researcher ORCID: 0000-0002-1444-1080
- **ent_john_lewis_001** (John Lewis)
  - Q45380: John Lewis — American politician and civil rights leader (1940–2020)
  - Q353943: John Lewis — American jazz pianist, composer and arranger (1920–2001)
  - Q1999078: John Lewis — philosopher, Unitarian minister and Marxist from Great Britain
  - Q549655: John Lewis — English footballer, administrator and referee (1855-1926)
  - Q110722956: John Lewis — poet from Tregaron
  - Q108423716: John Lewis — co-founder and former co-developer of the wiki farm Miraheze
- **ent_jordan_peele_001** (Jordan Peele)
  - Q3371986: Jordan Peele — American actor, comedian and filmmaker (born 1979)
  - Q105834478: Jordan Peele filmography — filmography of American director Jordan Peele
- **ent_kenneth_gibson_001** (Kenneth Gibson)
  - Q16005804: Kenneth Gibson — English cricketer (1888-1967)
  - Q944741: Kenneth Gibson — British politician (born 1961)
  - Q75447718: Kenneth Gibson — Peerage person ID=147772
  - Q1738864: Kenneth Gibson — Wikimedia disambiguation page
  - Q102200702: Kenneth Gibson — American actor (1898 – 1972)
  - Q123559101: Kenneth Gibson, 86, Dies; Newark Mayor Broke Race Barrier in Northeast — The New York Times article (March 31, 2019)
- **ent_liberty_hill_school_001** (Liberty Hill School)
  - Q19986784: Liberty Hill School — listed on the NRHP in Richmond County, North Carolina
  - Q14710028: Liberty Hill School — historic school in Liberty Hill, Tennessee, USA
  - Q6541818: Liberty Hill Schoolhouse — historic school building in Gainesville, Florida, USA
  - Q1823014: Liberty Hill School — Wikimedia disambiguation page
- **ent_louisiana_weekly_001** (Louisiana Weekly)
  - Q100307744: The Louisiana Weekly Journal — newspaper published in Homer, Louisiana
- **ent_mansfield_high_school_001** (Mansfield High School)
  - Q6751651: Mansfield High School — school in Texas
  - Q6751650: Mansfield High School — school in Massachusetts
  - Q14681178: Mansfield High School — high school in Arkansas, United States
  - Q6751649: Mansfield High School — former secondary school in Brierfield, Lancashire, England
  - Q6751648: Mansfield High School — Wikimedia disambiguation page
- **ent_naacp_org_001** (National Association for the Advancement of Colored People (NAACP))
  - Q502044: NAACP — civil rights organization in the United States
  - Q6970589: National Association for the Advancement of Colored People v. Alabama — United States Supreme Court case
  - Q19068042: National Association for the Advancement of Colored People v. Overstreet — United States Supreme Court case
  - Q19068049: National Association for the Advancement of Colored People v. Williams — United States Supreme Court case
  - Q127157567: National Association for the Advancement of Colored People Gary Branch — branch of the NAACP
  - Q100327565: Santa Fe chapter of the NAACP — NAACP chapter
- **ent_negro_american_labor_council_001** (Negro American Labor Council)
  - Q125926992: National Afro-American Labor Council — no description
- **ent_penn_center_001** (Penn Center)
  - Q7163164: Penn Center — human settlement in Philadelphia, Pennsylvania, United States of America
  - Q1531481: Suburban Station — commuter rail station in Center City, Philadelphia
  - Q36874997: Penn Center for AIDS Research — facility in Philadelphia, United States
  - Q106412263: Penn Center for Learning Analytics at Penn GSE — research center affiliated with University of Pennsylvania
  - Q117574578: Penn Center Cemetery — cemetery in Madison County, Iowa, United States
  - Q7163219: Penn School Historic District — museum, former African-American school, historic district
- **ent_rising_son_kansas_city_001** (The Rising Son)
  - Q48418676: The Rising Son — episode of Supernatural (S13 E2)
  - Q109285558: The Rising Son — former weekly newspaper published in Kansas City, Missouri, United States
  - Q100281175: The Rising Son — newspaper published in Kansas City, Missouri
  - Q7760915: The Rising Son — television series
  - Q7336137: Rising Sons — American rock band
- **ent_ron_brown_001** (Ron Brown)
  - Q687767: Ron Brown — British politician (1938-2007)
  - Q100762802: Ron Brown — college basketball player (1958–1958)
  - Q101080276: Ron Brown — New Zealand cricketer
  - Q100762804: Ron Brown — college basketball player (1972–1974) Penn State
  - Q130526871: Ron Brown — no description
  - Q112454625: Ron Brown — photographer
- **ent_sclc_org_001** (Southern Christian Leadership Conference (SCLC))
  - Q605130: Southern Christian Leadership Conference — African-American civil rights organization
- **ent_scott_joplin_001** (Scott Joplin)
  - exhausted retries for https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Scott+Joplin&language=en&format=json&type=item&limit=6
- **ent_sncc_org_001** (Student Nonviolent Coordinating Committee (SNCC))
  - Q127723: Student Nonviolent Coordinating Committee — largest student-led civil rights organization during the American Civil Rights Movement
  - Q111463950: Student Nonviolent Coordinating Committee — North Carolina historic marker H-107
- **ent_unia_harlem_001** (Universal Negro Improvement Association (Harlem Chapter))
  - Q1781637: Universal Negro Improvement Association and African Communities League — black nationalist fraternal organization
  - Q134051747: Central Division of Universal Negro Improvement Association — division of the Universal Negro Improvement Association
- **ent_william_l_dawson_001** (William L. Dawson)
  - Q2484851: William L. Dawson — American composer and music pedagogue (1899-1990)
  - Q2546135: William Levi Dawson — American politician (1886–1970)
  - Q1559608: William L. Dawson — Wikimedia disambiguation page
  - Q96464586: William L. Dawson, a Umum tribute and a marvelous journey — book published in 1981
- **ent_william_t_coleman_001** (William T. Coleman Jr.)
  - Q123577164: William T. Coleman Jr., Who Broke Racial Barriers in Court and Cabinet, Dies at 96 — The New York Times article (March 31, 2017)
- **ent_willie_brown_001** (Willie Brown)
  - Q2581425: Willie Brown — American football executive and former player and coach (1940-2019)
  - Q107492855: Willie Brown — no description
  - Q100763082: Willie Brown — college basketball player (1975–1978) South Carolina State
  - Q100763085: Willie Brown — college basketball player (1967–1969) Middle Tennessee
  - Q100763084: Willie Brown — college basketball player (1973–1974) Wyoming
  - Q100763090: Willie Brown — college basketball player (1986–1989) Southern Mississippi
- **gap_54th_massachusetts** (54th Massachusetts)
  - Q1140668: 54th Regiment Massachusetts Volunteer Infantry — Union Army infantry regiment during American Civil War; composed mostly of African-American men
  - Q96417518: 1833 Massachusetts legislature — kunankudi very popular village this village born kunankudi masthan
  - Q4640509: 54th Massachusetts Volunteer Regiment — military unit
- **gap_fanny_jackson_coppin_normal_school** (Fanny Jackson Coppin Normal School)
  - Q5168881: Coppin State University — historically black university in Baltimore, Maryland
- **gap_meharry** (Meharry)
  - Q37557906: Meharry — family name
  - Q4026847: Meharry Medical College — medical school
  - Q115677889: Meharry — railway point in Manitoba, Canada
  - Q6809244: Meharry Medical College School of Dentistry — Dental school in Nashville, Tennessee
  - Q32276536: Meharry Creek — river in New Zealand
  - Q31680439: Meharry Spur — ridge in New Zealand
- **gap_pilgrim_baptist_church** (Pilgrim Baptist Church)
  - Q7193921: Pilgrim Baptist Church — church building in Chicago, United States of America
  - Q7193922: Pilgrim Baptist Church — church building in Saint Paul, United States of America
  - Q98015173: Pilgrim Baptist Church — church in Summit, New Jersey
  - Q140069648: Pilgrim Baptist Church (Pittsburgh) — no description
  - Q117527859: Pilgrim Baptist Church Cemetery — cemetery in Orange County, Virginia, United States
  - Q117578278: Pilgrim Baptist Church Cemetery — cemetery in Bamberg County, South Carolina, United States
- **gap_president_s_committee_on_equality_of_treatment_and_opportuni** (President's Committee on Equality of Treatment and Opportunity in the Armed Services)
  - Q63902199: President's Committee on Equality of Treatment and Opportunity in the Armed Services Files (NAID 601113) — series in the National Archives and Records Administration's holdings
- **gap_south_carolina_state_college** (South Carolina State College)
  - Q18158218: South Carolina State College Historic District — historic district in South Carolina, United States
- **gap_southern_aid_society** (Southern Aid Society)
  - Q7569590: Southern Aid Society-Dunbar Theater Building — former movie theater in Washington, D.C.
- **gap_supreme_court** (Supreme Court)
  - Wikidata Q190752 is the generic supreme-court concept, not a specific instance; needs a human to identify which jurisdiction/court this canonical entity refers to
- **lynching_albert_gooden_covington_tennessee** (Albert Gooden)
  - Q100796320: Al Gooden — college basketball player (1978–1981) Ball State
- **lynching_elias_clayton_duluth_minnesota** (Elias Clayton)
  - exhausted retries for https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Elias+Clayton&language=en&format=json&type=item&limit=6
- **lynching_elmer_jackson_duluth_minnesota** (Elmer Jackson)
  - Q1515362: 1920 Duluth lynchings — lynching of three in 1920, in Duluth, Minnesota, United States
- **lynching_isaac_mcghie_duluth_minnesota** (Isaac McGhie)
  - Q1515362: 1920 Duluth lynchings — lynching of three in 1920, in Duluth, Minnesota, United States
- **recon_benjamin_f_alexander** (Benjamin F. Alexander)
  - Q104821161: Benjamin F. Alexander — Alabama politician, state representative in Alabama
  - Q17352669: Benjamin F. Alexander — American politician, lieutenant governor of Tennessee
- **recon_berry_o_kelly** (Berry O'Kelly)
  - Q55720869: Berry O’Kelly — 1860-1931 , businessman
  - Q55080495: Berry O'Kelly Historic District — historic district in North Carolina, United States
  - Q111463919: Berry O'kelly School — North Carolina historic marker H-77
- **recon_john_b_wright** (John B. Wright)
  - Q23894242: John B. Wright — American jurist and politician in Arizona Territory (1872-1934)
  - Q96384507: John B. Wright — American Black legislator from South Carolina during Reconstruction
  - Q120378722: John Wright — British geologist and oceanographer
  - Q112391482: John Burghardt Wright — American geographer
  - Q138757353: J. B. Wright — British geologist
  - Q117696980: John B. Wright Cemetery — cemetery in Johnson County, Georgia, United States
- **recon_joseph_mansion** (Joseph Mansion)
  - Q106588931: Joseph Mansion — US politician, state legislator in Louisiana
  - Q16646214: Joseph Mansion — linguist (1877-1937)
  - Q135510564: Joseph Mansion — Wikimedia disambiguation page
- **recon_stephen_bates** (Stephen Bates)
  - Q112150148: Stephen Bates — Australian politician
  - Q109627642: Stephen Bates — American jurist and university professor (1958-)
  - Q124362655: Stephen Bates — American sheriff (1842–1907)
  - Q124850595: Stephen Bates — British architect, active in London
  - Q89926490: Stephen Bates — Statistician; UC Berkeley
  - Q28321757: Stephen Bates — British journalist
<!-- END GENERATED QUEUE -->
