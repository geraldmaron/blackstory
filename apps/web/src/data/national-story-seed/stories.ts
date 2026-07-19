/**
 * Longform StoryRecord drafts for national-story seed entities (14 stories).
 */
export type StorySection = {
  readonly heading?: string;
  readonly paragraphs: readonly string[];
};

export type StoryRecord = {
  readonly slug: string;
  readonly title: string;
  readonly dek: string;
  readonly publishedAt: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly relatedEntityIds: readonly string[];
  readonly body: readonly StorySection[];
};

export const NATIONAL_STORY_RECORDS: readonly StoryRecord[] = [
  {
    slug: 'freedom-hill-to-princeville',
    title: 'Freedom Hill before the charter',
    dek: 'On the Tar River floodplain opposite Tarboro, a freedpeople’s settlement became Princeville — a town chartered by African Americans in 1885.',
    publishedAt: '2026-07-19',
    eraLabel: '1865–1885',
    placeLabel: 'Princeville, North Carolina',
    relatedEntityIds: ['ent_princeville_nc_001'],
    body: [
      {
        paragraphs: [
          'After Union occupation reached Tarboro in 1865, formerly enslaved people camped on low ground across the Tar River from the county seat. They called the knoll Freedom Hill — later Liberty Hill — and built houses, churches, and schools on land they could finally hold.',
          'Edgecombe County’s Black residents did not wait for incorporation to govern daily life. They purchased lots, elected leaders, and rebuilt after floods that have returned again and again. The place record is a town on a river bend whose civic identity is tied to self-governance, not a single disaster season.',
        ],
      },
      {
        heading: 'Charter and name',
        paragraphs: [
          'On February 20, 1885, the community incorporated as Princeville, taking the name of Turner Prince, a carpenter and landowner who had helped anchor the settlement. Historians including Joe A. Mobley document the charter as the oldest town in the United States founded and incorporated by African Americans — a claim checked against North Carolina records rather than slogan.',
          'Princeville’s endurance through twentieth-century dissolution attempts and major hurricanes belongs in the place story, but the load-bearing pin is the 1865 settlement and the 1885 charter. Start there; follow the dated facts when you need the evidence layer.',
        ],
      },
    ],
  },
  {
    slug: 'boley-on-the-frontier',
    title: 'A town on Creek Nation land',
    dek: 'Boley grew from a Black railroad camp into one of the largest all-Black towns in the United States — its commercial core now a National Historic Landmark District.',
    publishedAt: '2026-07-19',
    eraLabel: '1903–1975',
    placeLabel: 'Boley, Oklahoma',
    relatedEntityIds: ['ent_boley_historic_district_001'],
    body: [
      {
        paragraphs: [
          'In 1903, on land allotted to Creek Freedmen in what became Okfuskee County, a Black railroad construction camp matured into a municipality. Boley incorporated in 1905 with its own bank, schools, and businesses — a western strategy of land ownership and municipal control.',
          'Booker T. Washington visited and praised Boley as proof that Black towns could thrive beyond the former Confederacy. The surviving commercial blocks — documented in the National Register and as a National Historic Landmark — are the built evidence of that claim, not a metaphor.',
        ],
      },
      {
        heading: 'Reading the district today',
        paragraphs: [
          'The Boley Historic District pin is a district-level record: storefronts, streets, and civic fabric rather than a single headline event. Oklahoma Historical Society and registry entries supply founding dates and designation evidence; this story points to those facts rather than retelling the town as a curiosity.',
          'Annual traditions like the Boley Rodeo connect ranching culture to the town’s twentieth-century prosperity. They are off-ramps from the place pin, not substitutes for the incorporation record itself.',
        ],
      },
    ],
  },
  {
    slug: 'fort-mose-before-the-revolution',
    title: 'Free soil under Spanish Florida',
    dek: 'North of St. Augustine, Fort Mose was chartered in 1738 as a legally sanctioned free Black settlement — conditional freedom tied to baptism and militia service.',
    publishedAt: '2026-07-19',
    eraLabel: '1738–1740s',
    placeLabel: 'St. Augustine, Florida',
    relatedEntityIds: ['ent_fort_mose_001'],
    body: [
      {
        paragraphs: [
          'Gracia Real de Santa Teresa de Mose sat on the northern approaches to St. Augustine, where Spanish Florida offered escape from Carolina slavery in exchange for Catholic allegiance and military duty. The 1738 charter is a colonial mechanism you can check — not a modern freedom metaphor.',
          'A free Black militia under Captain Francisco Menéndez defended the settlement during the 1740 siege. Fort Mose Historic State Park preserves the landscape where archaeologists and historians have recovered that world; the park unit is the public place record.',
        ],
      },
      {
        heading: 'Why the date matters',
        paragraphs: [
          'Fort Mose is widely documented as the first legally sanctioned free Black community within present United States boundaries. That superlative is tied to Spanish law and geography, not to an abstract “first freedom” story.',
          'Visitors today walk interpretive trails and museum exhibits on filled marshland near the original site. Start with the charter and the map pin; use the linked facts for citations and confidence grades.',
        ],
      },
    ],
  },
  {
    slug: 'tubman-eastern-shore',
    title: 'Landscape before the legend',
    dek: 'Harriet Tubman Underground Railroad National Historical Park preserves the Dorchester County marshes and farms where Tubman’s documented life began — a place record first.',
    publishedAt: '2026-07-19',
    eraLabel: '1820s–2014',
    placeLabel: 'Church Creek, Maryland',
    relatedEntityIds: ['ent_tubman_underground_railroad_md_001'],
    body: [
      {
        paragraphs: [
          'The visitor center on the Eastern Shore opens onto flat fields, canals, and woods — the same terrain Tubman navigated as a child and later as a conductor. The National Park Service unit is pinned to that landscape rather than to a single escape episode.',
          'Tubman’s biography belongs on this record, but the park’s authority is geographic: preserving Dorchester County features tied to her early life and Underground Railroad work. Monument designation in 2013 and redesignation as a national historical park in 2014 are dated layers on the map.',
        ],
      },
      {
        heading: 'How to read the pin',
        paragraphs: [
          'BlackStory leads with the park boundary and the watershed, not with pursuit scenes. Tubman’s returns south and her Civil War service appear in the fact layer with citations; this story keeps the opening on what you can still stand inside today.',
          'Follow the linked NPS sources when you need birth-era context or redesignation dates. The place endures as a working agricultural landscape surrounding a federal interpretive site.',
        ],
      },
    ],
  },
  {
    slug: 'before-hbcu-had-a-name',
    title: 'Institute for Colored Youth',
    dek: 'Cheyney University traces to an 1837 Quaker bequest — the nation’s oldest historically Black institution of higher learning, founded before emancipation.',
    publishedAt: '2026-07-19',
    eraLabel: '1837–present',
    placeLabel: 'Cheyney, Pennsylvania',
    relatedEntityIds: ['ent_cheyney_university_001'],
    body: [
      {
        paragraphs: [
          'Richard Humphreys’ 1832 will funded a school to educate people of African descent as teachers. On February 25, 1837, that bequest became the Institute for Colored Youth — later Cheyney University — on Philadelphia-area ground that would move to Delaware County.',
          'Teacher-training institutes and degree-granting colleges are different mechanisms. Cheyney’s claim as the oldest HBCU rests on continuous institutional lineage from the 1837 founding, documented in JBHE timelines and Pennsylvania historical markers.',
        ],
      },
      {
        heading: 'Campus as anchor',
        paragraphs: [
          'Graduates carried literacy work into states that still criminalized Black education. The campus pin marks where that pipeline began — not a celebration of a single graduate, but an institution whose charter predates the Civil War.',
          'Use the linked facts for founding-day precision and marker corroboration. Extended alumni lists are off-ramps from the entity record, not the load-bearing claim.',
        ],
      },
    ],
  },
  {
    slug: 'first-degrees-ashmun-to-lincoln',
    title: 'From Ashmun Institute charter',
    dek: 'Lincoln University began as Ashmun Institute in 1854 — the first degree-granting historically Black college and university in the United States.',
    publishedAt: '2026-07-19',
    eraLabel: '1854–1866',
    placeLabel: 'Lincoln University, Pennsylvania',
    relatedEntityIds: ['ent_lincoln_university_pa_001'],
    body: [
      {
        paragraphs: [
          'John Miller Dickey and Sarah Emlen Cresson secured an April 29, 1854 charter for Ashmun Institute in Chester County, naming the school for the American Colonization Society’s Jehudi Ashmun. The campus was built to grant degrees in arts and sciences — not only to train teachers.',
          'Renamed for Abraham Lincoln in 1866, the university kept the charter lineage that makes the “first degree-granting HBCU” claim checkable against its own published history.',
        ],
      },
      {
        heading: 'What the first means',
        paragraphs: [
          '“First degree-granting” is narrower than “oldest HBCU.” Cheyney’s 1837 founding and Lincoln’s 1854 charter answer different questions. This pin holds the degree-granting claim with university-published evidence.',
          'Alumni including Thurgood Marshall and Langston Hughes are named off-ramps from the campus record — documented graduates, not decoration on the founding sentence.',
        ],
      },
    ],
  },
  {
    slug: 'howard-in-the-capital',
    title: 'A congressional charter in Washington',
    dek: 'Howard University’s 1867 congressional charter concentrated professional training — medicine, law, divinity — in the capital during Reconstruction.',
    publishedAt: '2026-07-19',
    eraLabel: '1867–present',
    placeLabel: 'Washington, D.C.',
    relatedEntityIds: ['ent_howard_university_001'],
    body: [
      {
        paragraphs: [
          'Named for Freedmen’s Bureau commissioner Oliver O. Howard, the university received its charter on March 2, 1867, on Northwest Washington ground that still anchors the main campus. Federal authorization made Howard a Reconstruction-era hub for Black professional education.',
          'Law, medical, and divinity schools followed, producing graduates who later entered desegregation litigation and federal service. The place pin is the campus in the capital; the mechanism is the charter and the professional schools it enabled.',
        ],
      },
      {
        heading: 'Institution, not incident',
        paragraphs: [
          'Howard’s twentieth-century protests and cultural production belong in the timeline, but the entity record opens on the 1867 charter and the comprehensive university that grew from it.',
          'Linked facts carry the founding date and institutional scope with archived university history pages. Start with the map pin on Georgia Avenue; drill into citations when you need sentence-level proof.',
        ],
      },
    ],
  },
  {
    slug: 'under-emancipation-oak',
    title: 'One tree, two readings',
    dek: 'Emancipation Oak on the Hampton University campus marks outdoor schooling in 1861 and a local Emancipation Proclamation reading in 1863 — a place pin tied to the institute founded in 1868.',
    publishedAt: '2026-07-19',
    eraLabel: '1861–1868',
    placeLabel: 'Hampton, Virginia',
    relatedEntityIds: ['ent_emancipation_oak_001', 'ent_hampton_university_001'],
    body: [
      {
        paragraphs: [
          'The live oak on Hampton’s waterfront campus is a landmark you can still photograph. In 1861, Mary Smith Peake taught formerly enslaved students beneath it while Virginia banned Black literacy. In January 1863, local Black Virginians gathered there for a Southern reading of the Emancipation Proclamation.',
          'Two dated events share one tree — outdoor education under contraband-era Fort Monroe authority, then a public proclamation ceremony. The oak predates Hampton Normal and Agricultural Institute, founded April 1, 1868, which grew from the same peninsula schooling tradition.',
        ],
      },
      {
        heading: 'Campus continuity',
        paragraphs: [
          'Hampton’s industrial-education debates and alumni like Booker T. Washington are off-ramps from the institute record. This story keeps the opening on the oak as a campus place marker linked to Hampton University through graph relationships, not through a trauma-forward frame.',
          'Facts below separate Peake’s classes, the 1863 reading, and the 1868 institute founding with distinct confidence notes. Visit the tree first; follow citations for each dated layer.',
        ],
      },
    ],
  },
  {
    slug: 'porters-organize',
    title: 'Shop-floor grievances, national union',
    dek: 'The Brotherhood of Sleeping Car Porters organized in Harlem in 1925 and won Pullman recognition in 1937 — a labor institution with checkable dates.',
    publishedAt: '2026-07-19',
    eraLabel: '1925–1937',
    placeLabel: 'New York, New York',
    relatedEntityIds: ['ent_brotherhood_sleeping_car_porters_001'],
    body: [
      {
        paragraphs: [
          'A. Philip Randolph built the Brotherhood from sleeping-car porters’ wages, hours, and dignity grievances against the Pullman Company. The 1925 founding is a labor-organizing record centered on Harlem — city-level pin, not a single shop floor.',
          'Twelve years of pressure yielded a 1937 collective bargaining agreement — the first time a major African American union won recognition from a major U.S. corporation. That contract is the mechanism layer behind the institution pin.',
        ],
      },
      {
        heading: 'Beyond the railroad',
        paragraphs: [
          'BSCP members later anchored civil-rights campaigns against employment discrimination. Those connections belong in related records; the load-bearing claims here are 1925 organization and 1937 recognition with CSRMF-documented sources.',
          'BlackStory cites the union as an institution you can date — not as background color for broader movement narratives without receipts.',
        ],
      },
    ],
  },
  {
    slug: 'schomburg-builds-a-library',
    title: 'A collection that answered absence',
    dek: 'The Schomburg Center for Research in Black Culture is a New York Public Library research division in Harlem — a public reading room built from Arturo Schomburg’s collecting mission.',
    publishedAt: '2026-07-19',
    eraLabel: '1920s–present',
    placeLabel: 'Harlem, New York',
    relatedEntityIds: ['ent_schomburg_center_001'],
    body: [
      {
        paragraphs: [
          'Arturo Schomburg’s personal library answered a charge that Black people had no history worth filing. The New York Public Library absorbed and expanded that collection into a research division on Malcolm X Boulevard — a place you can still enter with a library card.',
          'The Schomburg pin is institutional: stacks, reading rooms, and exhibitions whose mission is itself a documentary act. It is not a memorial to a single book purchase.',
        ],
      },
      {
        heading: 'Archive as place',
        paragraphs: [
          'Researchers consult manuscripts, photographs, and periodicals that elsewhere were scattered or lost. NYPL’s published description of the center as a research division specializing in African and African diasporan history is the web-cited claim on this record.',
          'Exhibition programs and digital portals are extensions of the building pin. Start with the institution on the map; use the fact layer for the NYPL citation and archived capture.',
        ],
      },
    ],
  },
  {
    slug: 'hitsville-on-west-grand',
    title: 'House, studio, headquarters',
    dek: 'Motown Records’ first headquarters at 2648 West Grand Boulevard — Hitsville U.S.A. — is now a museum preserving Berry Gordy’s 1959 address and Esther Gordy Edwards’ 1985 institution.',
    publishedAt: '2026-07-19',
    eraLabel: '1959–1985',
    placeLabel: 'Detroit, Michigan',
    relatedEntityIds: ['ent_motown_museum_001'],
    body: [
      {
        paragraphs: [
          'Berry Gordy bought a house on West Grand Boulevard in 1959 and ran Motown Records from it — offices, Studio A, and pressing relationships under one roof. The address is the industrial place story: a residential street that became a label factory.',
          'Esther Gordy Edwards opened the Motown Museum in 1985 to preserve that building when the company had moved on. The museum pin is the documented Hitsville address, not a generic “Motown sound” claim divorced from geography.',
        ],
      },
      {
        heading: 'Reading the facade',
        paragraphs: [
          'Tour groups still walk the original studio floor and see equipment Gordy’s team used. Chart history and artist biographies are off-ramps; the entity record stays on 2648 West Grand and the museum founded there.',
          'Linked facts separate the 1959 headquarters date from the 1985 museum founding with Motown Museum archived pages. Evidence before assertion — the building first.',
        ],
      },
    ],
  },
  {
    slug: 'richmond-planet-prints',
    title: 'A weekly press in Jackson Ward',
    dek: 'The Richmond Planet — edited for decades by John Mitchell Jr. — survives in digitized runs at the Library of Virginia, a Black press institution pinned to the city.',
    publishedAt: '2026-07-19',
    eraLabel: '1880s–1900s',
    placeLabel: 'Richmond, Virginia',
    relatedEntityIds: ['ent_richmond_planet_001'],
    body: [
      {
        paragraphs: [
          'African American weeklies carried news white dailies ignored — elections, lynching investigations, and community events. The Richmond Planet, with Mitchell at the helm for much of its run, is one checkable Richmond instance of that infrastructure.',
          'This pin is city-level: a newspaper institution rather than a single headline. Surviving pages in Virginia Chronicle let readers verify Mitchell’s editorial voice and the Planet’s advocacy directly.',
        ],
      },
      {
        heading: 'Evidence you can open',
        paragraphs: [
          'Digitization does not replace the pressroom, but it makes the institution legible across time. Library of Virginia collections host the runs; Army History profiles document Mitchell’s editorship in secondary corroboration.',
          'BlackStory treats the Planet as an institution record first — who published, where, and what survives — before any single article becomes the story hook.',
        ],
      },
    ],
  },
  {
    slug: 'a-museum-on-the-mall',
    title: 'Congress to opening day',
    dek: 'The National Museum of African American History and Culture occupies a Mall site authorized in 2003 and opened in 2016 — a Smithsonian institution with dated legislative and construction records.',
    publishedAt: '2026-07-19',
    eraLabel: '2003–2016',
    placeLabel: 'Washington, D.C.',
    relatedEntityIds: ['ent_nmaahc_001'],
    body: [
      {
        paragraphs: [
          'A century of proposals preceded the 2003 NMAAHC Act. The Mall location — beside the Washington Monument — is the place claim; the bronze-clad building David Adjaye’s team designed is the visible anchor visitors walk toward today.',
          'Collections inside span slavery-era objects, sports, music, and military service. The entity pin is the museum institution on the Mall, not any single gallery object.',
        ],
      },
      {
        heading: 'Site before sweep',
        paragraphs: [
          'Opening day, September 24, 2016, drew a timed-entry public that had waited years for tickets. That crowd is context; the load-bearing dates are the 2003 authorization and the 2016 opening recorded in Smithsonian Archives.',
          'Use linked facts for legislative and opening citations with confirmed Wayback captures. The museum remains a working Smithsonian unit — start with the building on the map.',
        ],
      },
    ],
  },
  {
    slug: 'little-rock-central-as-place',
    title: 'Central as a campus first',
    dek: 'Little Rock Central High School is a 1927 Collegiate Gothic school still in session — and a National Historic Site whose 1957 chapter sits in the middle of a longer institutional story.',
    publishedAt: '2026-07-19',
    eraLabel: '1927–1998',
    placeLabel: 'Little Rock, Arkansas',
    relatedEntityIds: ['ent_little_rock_central_high_001'],
    body: [
      {
        paragraphs: [
          'On Park Street in Little Rock, a tan-brick Collegiate Gothic campus opens onto a reflecting pool and four classroom wings. Completed in 1927 as Little Rock High School, the building was designed for scale — a 2,000-seat auditorium, more than a hundred classrooms, and statuary at the main entry. Students still attend class here; the fabric is not a backdrop for a single September.',
          'BlackStory pins this record to the institution and its address first. A visitor who arrives expecting only a crisis scene misses the longer arc: a city-built campus, later renamed Central High, listed on the National Register, and authorized as a National Historic Site in 1998 — the only such park unit centered on an operating high school.',
        ],
      },
      {
        heading: '1957 in the middle of the timeline',
        paragraphs: [
          'Three years after Brown v. Board of Education, the Little Rock School Board planned gradual desegregation at Central beginning in September 1957. Nine Black students selected to enroll — the Little Rock Nine — were blocked when Governor Orval Faubus deployed the Arkansas National Guard. On September 25, 1957, they entered under escort of the 101st Airborne after President Eisenhower federalized the Guard.',
          'That sequence is documented history anchored to this building, not an opening hook. The crisis tested whether a Supreme Court ruling would be enforced; it did not erase the 1927 campus or the school district that still operates here. The facts above carry the dates, citations, and confidence grades; this story points to them rather than retelling harassment as spectacle.',
        ],
      },
      {
        heading: 'Reading the site today',
        paragraphs: [
          'Interpretation happens beside the living school. The National Park Service visitor center occupies the restored Magnolia Mobil gas station across from the campus; ranger programs walk the grounds while classes continue inside. Interior access to Central High itself requires advance reservation — the building remains a working high school.',
          'That split — operating campus plus historic site — is the point of a place-first pin. Start with the school on the map; follow the dated facts when you need the middle of the story.',
        ],
      },
    ],
  },
] as const;
