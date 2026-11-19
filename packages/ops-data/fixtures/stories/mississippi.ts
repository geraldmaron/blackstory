/**
 * "Mississippi, on the record" — five places in Mississippi Black history, one entry each.
 *
 * Format is `entry`, the same contract as the presidents collection: a paragraph of context,
 * then call-outs that each carry their own citation, then a "Where the record disagrees"
 * paragraph wherever reputable sources differ. Order is by the era each entry centers on.
 *
 * Sourcing follows docs/methodology/chapter-fact-validation.md: every fact was taken from a
 * fetched page (Senate Historical Office, House History, Art & Archives, National Park Service,
 * Mississippi Department of Archives and History, the Mississippi Encyclopedia, the SNCC Digital
 * Gateway, the Southern Foodways Alliance, Tougaloo College, U.S. Civil Rights Trail), never
 * from model memory. Only self-review has run; consequential claims still need an independent
 * check before promotion. Status is `draft` so nothing publishes until a reviewer promotes it.
 *
 * No hero images: none of these entries has a cleared public-domain image attached yet.
 */

const COLLECTION = { id: 'mississippi-on-the-record', label: 'Mississippi, on the record' };

export const mississippiStories = [
  {
    id: 'story_ms_01_revels_and_bruce',
    slug: 'hiram-revels-and-blanche-k-bruce',
    format: 'entry' as const,
    title: 'Hiram Revels and Blanche K. Bruce',
    summary:
      'Mississippi sent the first two Black members of the U.S. Senate. The Reconstruction legislature elected Hiram Revels of Natchez in 1870 to a term that ran out in March 1871, and in 1874 it elected Blanche K. Bruce of Bolivar County to a full six-year term, which he served from 1875 to 1881.',
    eraLabel: '1870–1881',
    placeLabel: 'Natchez and Bolivar County, Mississippi',
    publishedAt: '2026-11-11',
    status: 'draft' as const,
    collection: { ...COLLECTION, position: 1, positionLabel: 'Reconstruction' },
    tags: ['Reconstruction'],
    relatedEntityIds: ['nrhp-black-heritage-82003098', 'nrhp-black-heritage-75002046'],
    references: [
      {
        id: 'senate-revels-story',
        label:
          'U.S. Senate Historical Office, "Senate Stories | Hiram Revels: First African American Senator" (2020)',
        url: 'https://www.senate.gov/artandhistory/senate-stories/First-African-American-Senator.htm',
      },
      {
        id: 'house-bruce',
        label: 'U.S. House of Representatives, History, Art & Archives, "BRUCE, Blanche Kelso"',
        url: 'https://history.house.gov/People/Detail/10029',
      },
      {
        id: 'mdah-mcrm-black-white',
        label:
          'Mississippi Department of Archives and History, Mississippi Civil Rights Museum, "Mississippi in Black and White, 1865–1941"',
        url: 'https://mcrm.mdah.ms.gov/node/87',
      },
    ],
    body: [
      {
        type: 'paragraph' as const,
        text: "When Mississippi's Reconstruction legislature met in January 1870, filling the state's two empty U.S. Senate seats was part of its business, and it gave the shorter term, ending in March 1871, to Hiram Revels. Revels had been pastor of Zion A.M.E. Church in Natchez since 1866, served as a Natchez alderman, and won a state senate seat in 1869. In Washington his opponents argued he hadn't been a citizen for the nine years the Constitution requires; the Senate voted 48 to 8 to seat him, and he took the oath on February 25, 1870. After his term he went back to Mississippi and later became president of Alcorn College. Four years after Revels was seated, the legislature chose Blanche K. Bruce, born enslaved near Farmville, Virginia, who had settled in Bolivar County, become a planter, and served as the county's sheriff and tax collector. Bruce was the first Black senator to serve a full term.[ref:senate-revels-story][ref:mdah-mcrm-black-white][ref:house-bruce]",
      },
      { type: 'heading' as const, level: 2 as const, text: 'The record' },
      {
        type: 'list' as const,
        style: 'bullet' as const,
        items: [
          "The Senate voted 48 to 8 to seat Hiram Revels after opponents argued he hadn't been a U.S. citizen for the nine years the Constitution requires, and he took the oath of office on February 25, 1870.[ref:senate-revels-story][ref:mdah-mcrm-black-white]",
          "Revels's term ended on March 3, 1871; he returned to Mississippi and later became president of Alcorn College.[ref:senate-revels-story][ref:senate-revels-story]",
          'Before the Senate, Bruce served Bolivar County as sheriff and tax collector from 1872 to 1875 and was named to a three-county board of levee commissioners in 1872.[ref:house-bruce][ref:mdah-mcrm-black-white]',
          'The full Mississippi legislature elected Bruce nearly unanimously on February 4, 1874, to a term that ran from March 4, 1875, to March 3, 1881.[ref:house-bruce][ref:senate-revels-story]',
          'On February 14, 1879, Bruce became the first Black senator to preside over a session of the Senate.[ref:house-bruce][ref:senate-revels-story]',
        ],
      },
      { type: 'heading' as const, level: 2 as const, text: 'Where the record disagrees' },
      {
        type: 'paragraph' as const,
        text: "How Revels came to sit on the Natchez board of aldermen in 1868: the Senate Historical Office calls it his first elected position, while the Mississippi Civil Rights Museum says he was appointed alderman. We didn't resolve the two accounts.",
      },
    ],
  },
  {
    id: 'story_ms_02_tougaloo_college',
    slug: 'tougaloo-college-mississippi',
    format: 'entry' as const,
    title: 'Tougaloo College',
    summary:
      'Founded in 1869 by the American Missionary Association on land that had been the Boddie plantation, Tougaloo became a primary center of civil rights organizing in Mississippi in the 1950s and 1960s. In 1964 the Mississippi State Sovereignty Commission pressed its trustees to dismiss its president, Adam Beittel.',
    eraLabel: '1869–1964',
    placeLabel: 'Tougaloo, Mississippi',
    publishedAt: '2026-11-11',
    status: 'draft' as const,
    collection: { ...COLLECTION, position: 2, positionLabel: 'Founded 1869' },
    tags: ['Reconstruction', 'Civil rights era'],
    relatedEntityIds: ['gap_tougaloo_college', 'ent_medgar_evers_home_001'],
    references: [
      {
        id: 'nps-tougaloo',
        label: 'National Park Service, "Mississippi: Tougaloo College"',
        url: 'https://www.nps.gov/places/mississippi-tougaloo-college.htm',
      },
      {
        id: 'tougaloo-history',
        label: 'Tougaloo College, institutional history',
        url: 'https://www.tougaloo.edu/node/254',
      },
      {
        id: 'nps-evers-house',
        label:
          'National Park Service, Medgar and Myrlie Evers Home National Monument, "Evers House"',
        url: 'https://www.nps.gov/memy/learn/historyculture/evers-house.htm',
      },
    ],
    body: [
      {
        type: 'paragraph' as const,
        text: "The American Missionary Association founded Tougaloo in 1869 to train Black teachers and tradespeople in Mississippi, on 500 acres of what had been the Boddie plantation, and the state legislature chartered it as Tougaloo University in 1871. The college admitted students of any race from the start, and a white student was in its first graduating class. In the 1950s and 1960s it became one of the main centers of the civil rights movement in the state. Its students spent years working to end segregation in Jackson, including a boycott of restaurants that wouldn't serve Black customers, and when they were arrested, President Adam Beittel often paid their bail. Bob Moses and James Lawson of the Student Nonviolent Coordinating Committee ran voter registration and nonviolence workshops on the campus. Faculty houses were shot at, and in 1964 the Mississippi State Sovereignty Commission pressed the college's trustees in New York to dismiss Beittel.[ref:nps-tougaloo][ref:tougaloo-history]",
      },
      { type: 'heading' as const, level: 2 as const, text: 'The record' },
      {
        type: 'list' as const,
        style: 'bullet' as const,
        items: [
          'The American Missionary Association acquired 500 acres of the former Boddie plantation for the school, which it founded in 1869; the legislature chartered it as Tougaloo University in 1871.[ref:tougaloo-history][ref:nps-tougaloo]',
          'Tougaloo served students of all races from its founding, and a white student was among its first graduates.[ref:nps-tougaloo][ref:nps-tougaloo]',
          'Student Nonviolent Coordinating Committee organizers Bob Moses and James Lawson held voter registration and nonviolence workshops on campus.[ref:nps-tougaloo][ref:nps-tougaloo]',
          'In 1964 the Mississippi State Sovereignty Commission pressured the board of trustees to dismiss Adam Beittel, president since 1960.[ref:nps-tougaloo][ref:nps-tougaloo]',
          'In 1993 Myrlie Evers-Williams gave the house where Medgar Evers was killed to Tougaloo College to preserve it.[ref:nps-evers-house][ref:nps-evers-house]',
        ],
      },
    ],
  },
  {
    id: 'story_ms_03_farish_street',
    slug: 'farish-street-jackson',
    format: 'entry' as const,
    title: 'Farish Street, Jackson',
    summary:
      'Farish Street was the center of Black business and community life in Jackson: a district with its own hospital, funeral homes, churches, theaters and schools, where H. C. Speir sold records and scouted blues talent and the NAACP met in rotating locations. It was listed on the National Register of Historic Places in 1980; a later redevelopment project has been dormant since 2014.',
    eraLabel: '1870s–1980',
    placeLabel: 'Jackson, Mississippi',
    publishedAt: '2026-11-11',
    status: 'draft' as const,
    collection: { ...COLLECTION, position: 3, positionLabel: 'Jackson' },
    tags: ['Civil rights era'],
    relatedEntityIds: ['ent_farish_street_001', 'nrhp-black-heritage-80002245'],
    references: [
      {
        id: 'ms-encyclopedia-farish',
        label: 'Mississippi Encyclopedia (Center for Study of Southern Culture), "Farish Street"',
        url: 'https://mississippiencyclopedia.org/entries/farish-street/',
      },
      {
        id: 'sfa-farish',
        label:
          'Southern Foodways Alliance, University of Mississippi, "The Black Mecca of Mississippi": A Portrait of a Community',
        url: 'https://olemiss.edu/projects/sfa/farish-street-project',
      },
    ],
    body: [
      {
        type: 'paragraph' as const,
        text: "Black professionals and tradespeople who couldn't work in the white-controlled parts of Jackson worked on Farish Street, and the district grew to hold a Black-run hospital, funeral homes, churches, theaters and schools. By 1908 Black residents owned a third of the district, and half of its Black families owned their homes. Music was part of its business: H. C. Speir sold records from his store at 225 North Farish and scouted talent, and between 1951 and 1955 McMurry's Trumpet Records label recorded some of the most important local blues musicians. With Medgar Evers as its state field secretary, the NAACP held its meetings on Farish Street, moving the location each time for safety. The district was added to the National Register of Historic Places in 1980. By 1995 two hundred of its nine hundred buildings had been demolished, and the entertainment-district redevelopment the city of Jackson leased out in 2002 has been dormant since 2014.[ref:ms-encyclopedia-farish][ref:sfa-farish]",
      },
      { type: 'heading' as const, level: 2 as const, text: 'The record' },
      {
        type: 'list' as const,
        style: 'bullet' as const,
        items: [
          'At its mid-twentieth-century peak, Farish Street was the largest economically independent Black community in Mississippi.[ref:sfa-farish][ref:ms-encyclopedia-farish]',
          'By 1908 Black residents owned one-third of the district, and half of its Black families owned their homes.[ref:ms-encyclopedia-farish][ref:ms-encyclopedia-farish]',
          'H. C. Speir sold records from his store at 225 North Farish Street and worked as a freelance talent scout; between 1951 and 1955 the Trumpet Records label recorded local blues musicians.[ref:ms-encyclopedia-farish][ref:ms-encyclopedia-farish]',
          'The NAACP held its meetings on Farish Street, changing the location each time for security.[ref:ms-encyclopedia-farish][ref:ms-encyclopedia-farish]',
          'The area was designated the Farish Street District and added to the National Register of Historic Places in 1980; in 1995 it was named a Most Endangered Place after two hundred of its nine hundred buildings were demolished.[ref:ms-encyclopedia-farish][ref:ms-encyclopedia-farish]',
        ],
      },
      { type: 'heading' as const, level: 2 as const, text: 'Where the record disagrees' },
      {
        type: 'paragraph' as const,
        text: 'When the district began: the Mississippi Encyclopedia describes a community founded before the end of the Civil War, while the Southern Foodways Alliance says the district was carved from Jackson estates in the 1870s and 1880s. The two may describe different stages, a settlement and then a platted district, but neither source says so.',
      },
    ],
  },
  {
    id: 'story_ms_04_evers_home',
    slug: 'medgar-and-myrlie-evers-home',
    format: 'entry' as const,
    title: 'The Medgar and Myrlie Evers Home',
    summary:
      "Medgar and Myrlie Evers bought the Jackson house in 1956, while he was the NAACP's first field secretary in Mississippi. It was firebombed in May 1963, Medgar Evers was shot in its carport shortly after midnight on June 12, 1963, and it became a national monument in 2020.",
    eraLabel: '1956–1963',
    placeLabel: 'Jackson, Mississippi',
    publishedAt: '2026-11-11',
    status: 'draft' as const,
    collection: { ...COLLECTION, position: 4, positionLabel: 'Jackson' },
    tags: ['Civil rights era'],
    relatedEntityIds: ['ent_medgar_evers_home_001', 'nrhp-black-heritage-00001459'],
    references: [
      {
        id: 'nps-evers-house',
        label:
          'National Park Service, Medgar and Myrlie Evers Home National Monument, "Evers House"',
        url: 'https://www.nps.gov/memy/learn/historyculture/evers-house.htm',
      },
      {
        id: 'nps-memy-place',
        label:
          'National Park Service, "Mississippi: Medgar and Myrlie Evers Home National Monument"',
        url: 'https://www.nps.gov/places/mississippi-medgar-and-myrlie-evers-home-national-monument.htm',
      },
      {
        id: 'npshistory-memy',
        label:
          'NPSHistory.com, Medgar and Myrlie Evers Home National Monument (park documents index)',
        url: 'https://npshistory.com/publications/memy/index.htm',
      },
      {
        id: 'ms-encyclopedia-farish',
        label: 'Mississippi Encyclopedia (Center for Study of Southern Culture), "Farish Street"',
        url: 'https://mississippiencyclopedia.org/entries/farish-street/',
      },
    ],
    body: [
      {
        type: 'paragraph' as const,
        text: "Medgar Evers was the first NAACP field secretary in Mississippi, and he and Myrlie Evers set up the Jackson NAACP office in the mid-1950s. In 1956 they bought the house at 2332 Guynes Street and chose a side door under the carport instead of a front entrance. In 1962 Evers worked on James Meredith's admission to the University of Mississippi. On May 24, 1963, someone threw a Molotov cocktail onto the carport, and shortly after midnight on June 12, 1963, Evers was shot and killed there. Myrlie Evers-Williams kept the house and its original form, gave it to Tougaloo College in 1993, and the National Park Service took it over as a national monument in November 2020. Byron De La Beckwith was convicted of the murder in 1994.[ref:nps-evers-house][ref:nps-memy-place][ref:npshistory-memy]",
      },
      { type: 'heading' as const, level: 2 as const, text: 'The record' },
      {
        type: 'list' as const,
        style: 'bullet' as const,
        items: [
          'Medgar and Myrlie Evers bought the house in 1956.[ref:nps-evers-house][ref:nps-evers-house]',
          "On May 24, 1963, someone threw a Molotov cocktail onto the Evers' carport.[ref:nps-evers-house][ref:nps-evers-house]",
          'Medgar Evers was shot and killed in the carport of the house shortly after midnight on June 12, 1963.[ref:npshistory-memy][ref:nps-memy-place]',
          'The national monument was authorized on March 12, 2019, and established on November 9, 2020.[ref:npshistory-memy][ref:nps-memy-place]',
          'Byron De La Beckwith was convicted in 1994.[ref:nps-memy-place][ref:nps-memy-place]',
        ],
      },
      { type: 'heading' as const, level: 2 as const, text: 'Where the record disagrees' },
      {
        type: 'paragraph' as const,
        text: "The year Evers became the NAACP's Mississippi field secretary: the National Park Service document index gives 1955, and the Mississippi Encyclopedia gives 1954.[ref:npshistory-memy][ref:ms-encyclopedia-farish]",
      },
    ],
  },
  {
    id: 'story_ms_05_hamer_ruleville',
    slug: 'fannie-lou-hamer-ruleville',
    format: 'entry' as const,
    title: "Fannie Lou Hamer's Ruleville",
    summary:
      'Fannie Lou Hamer had kept time on the W. D. Marlow plantation outside Ruleville for eighteen years when she tried to register to vote in August 1962 and lost her job the same day. She testified for the Mississippi Freedom Democratic Party at the 1964 Democratic National Convention, and she is buried in Ruleville.',
    eraLabel: '1962–1977',
    placeLabel: 'Ruleville, Mississippi',
    publishedAt: '2026-11-11',
    status: 'draft' as const,
    collection: { ...COLLECTION, position: 5, positionLabel: 'The Delta' },
    tags: ['Civil rights era'],
    relatedEntityIds: ['ent_mfdp_001', 'ent_mfdp_dnc_challenge_001'],
    references: [
      {
        id: 'mdah-hamer',
        label:
          'Mississippi Department of Archives and History, Mississippi History Now, "Fannie Lou Hamer: Civil Rights Activist"',
        url: 'https://mshistory.mdah.ms.gov/issue/fannie-lou-hamer-civil-rights-activist',
      },
      {
        id: 'sncc-hamer',
        label: 'SNCC Digital Gateway, "Fannie Lou Hamer"',
        url: 'https://snccdigital.org/people/fannie-lou-hamer/',
      },
      {
        id: 'uscrt-ms-freedom-trail',
        label: 'U.S. Civil Rights Trail, "Mississippi Freedom Trail"',
        url: 'https://civilrightstrail.com/?p=348',
      },
      {
        id: 'flha-markers',
        label: "Fannie Lou Hamer's America, historical markers",
        url: 'https://www.fannielouhamersamerica.com/fannie-lou-hamer-resource-center/markers',
      },
    ],
    body: [
      {
        type: 'paragraph' as const,
        text: 'On August 31, 1962, eighteen people from Sunflower County, Fannie Lou Hamer among them, rode a bus from Ruleville to the county courthouse in Indianola to try to register to vote. Hamer had worked eighteen years as the timekeeper on the W. D. Marlow plantation, and that day she lost the job: the SNCC Digital Gateway records that Marlow told her to withdraw her application or leave his land. She kept going back to Indianola until officials let her register. In Winona, after an arrest, police had two other Black prisoners beat Hamer and fifteen-year-old June Johnson. In 1964 she testified before the Credentials Committee of the Democratic National Convention for the Mississippi Freedom Democratic Party, and in 1969 she helped found Freedom Farm Cooperative. She died on March 14, 1977, and hundreds came to her funeral in Ruleville. Her grave there is marked on the Mississippi Freedom Trail.[ref:mdah-hamer][ref:sncc-hamer][ref:uscrt-ms-freedom-trail]',
      },
      { type: 'heading' as const, level: 2 as const, text: 'The record' },
      {
        type: 'list' as const,
        style: 'bullet' as const,
        items: [
          'Hamer and seventeen others went to the Sunflower County courthouse in Indianola to try to register on August 31, 1962.[ref:mdah-hamer][ref:sncc-hamer]',
          'The same day, Hamer lost her job on the W. D. Marlow plantation, where she had worked as a timekeeper for eighteen years.[ref:mdah-hamer][ref:sncc-hamer]',
          'Hamer testified before the Credentials Committee at the 1964 Democratic National Convention for the Mississippi Freedom Democratic Party.[ref:sncc-hamer][ref:mdah-hamer]',
          'Hamer helped establish Freedom Farm Cooperative in 1969.[ref:mdah-hamer][ref:mdah-hamer]',
          "Ruleville has two Mississippi Freedom Trail markers, one at William Chapel Missionary Baptist Church and one at Hamer's gravesite; the Fannie Lou Hamer Memorial Garden is at 929 Byron Street.[ref:uscrt-ms-freedom-trail][ref:flha-markers]",
        ],
      },
    ],
  },
];
