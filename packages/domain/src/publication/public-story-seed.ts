/**
 * Public longform story projections for `/stories`.
 *
 * Sole story-body corpus for the product: seeded into
 * `publicReleases/{releaseId}/stories/{slug}` and reused as the offline snapshot
 * when live public projections are disabled. Adapted from oral-history research
 * linking (start-line relocation, omitted actors, winner-built tests) into
 * BlackStory voice: place-first, evidence before assertion, no trauma hooks.
 */
import type { PublicStoryProjectionDoc } from '@repo/schemas';

const RELEASE_ID = 'rel_seed_001';
const PUBLISHED_AT = '2026-07-20';

function story(
  partial: Omit<PublicStoryProjectionDoc, 'id' | 'releaseId'> & { readonly slug: string },
): PublicStoryProjectionDoc {
  return {
    id: partial.slug,
    releaseId: RELEASE_ID,
    ...partial,
  };
}

/** Exactly five published longform stories for the active seed release. */
export const SEED_STORY_PROJECTIONS: readonly PublicStoryProjectionDoc[] = [
  story({
    slug: 'before-the-battle-cry',
    title: 'Before the battle cry',
    dek:
      'Most Americans are taught to remember the Alamo as a thirteen-day siege. ' +
      'The archive starts earlier: Mexico abolishes slavery, settlers keep it on paper, ' +
      'and a frontier mission becomes more than a battlefield slogan.',
    publishedAt: PUBLISHED_AT,
    eraLabel: '1821–1836',
    placeLabel: 'San Antonio, Texas',
    relatedEntityIds: [
      'ent_law_emancipation_proclamation_1863',
      'ent_case_sweatt_v_painter_1950',
      'ent_fort_mose_001',
    ],
    sources: [
      {
        label: 'Texas State Historical Association — Guerrero Decree (1829)',
        url: 'https://www.tshaonline.org/handbook/entries/guerrero-decree',
      },
      {
        label: 'Texas State Historical Association — Joe (Alamo survivor)',
        url: 'https://www.tshaonline.org/handbook/entries/joe',
      },
      {
        label: 'The Alamo — Joe\'s account of the battle',
        url: 'https://www.thealamo.org/remember/battle-and-revolution/joes-account',
      },
      {
        label: 'National Archives — Emancipation Proclamation (1863)',
        url: 'https://www.archives.gov/milestone-documents/emancipation-proclamation',
      },
      {
        label: 'National Park Service — Fort Mose history',
        url: 'https://www.nps.gov/foma/learn/historyculture/fort-mose.htm',
      },
      {
        label: 'Cornell LII — Sweatt v. Painter, 339 U.S. 629 (1950)',
        url: 'https://www.law.cornell.edu/supremecourt/text/339/629',
      },
    ],
    body: [
      {
        paragraphs: [
          'Ask what people are supposed to remember about the Alamo, and many will name the siege. ' +
            'Thirteen days. A mission church. A battle cry that later traveled farther than the ' +
            'event itself. That chapter is real. It is also the middle of a longer story.',
          'In 1821 Mexico won independence from Spain. California, Arizona, New Mexico, Nevada, ' +
            'Utah, and Texas were Mexican territory. Texas was a thinly settled frontier, and ' +
            'Mexico invited American settlers under conditions: become Mexican citizens, follow ' +
            'Mexican law, convert to Catholicism. The government wanted a buffer. What arrived ' +
            'was a demographic takeover. By the 1830s, American settlers outnumbered Mexican ' +
            'Texans nearly ten to one inside Mexico’s own province.',
          'Then came the first fault line that school lessons often skip. In 1829 Mexico abolished ' +
            'slavery. The president who signed that decree, Vicente Guerrero, was a man of African ' +
            'descent. Mexico ended slavery thirty-four years before the Emancipation Proclamation, ' +
            'under a Black president. That date is checkable. It relocates the start line.',
        ],
      },
      {
        heading: 'Same condition, new paperwork',
        paragraphs: [
          'Texas settlers protested the abolition decree hard enough to win exemptions, then kept ' +
            'working around it. Enslaved people were forced to sign contracts that called them ' +
            'indentured servants for ninety-nine years. One documented case names a girl, Clarissa, ' +
            'forced into such a contract on Christmas Day 1833. Same bondage. New paperwork.',
          'Mexico saw where the pattern pointed. In 1830 it banned further American immigration ' +
            'into Texas. Settlers kept coming anyway. On Mexican land, under Mexican law, they ' +
            'were undocumented immigrants. Sit with that inversion before the later slogans arrive.',
          'Slavery was not the only fight. In 1835 Santa Anna tore up Mexico’s federal constitution ' +
            'and centralized power. People across Mexico rebelled, not only Texans. Settlers had ' +
            'real grievances about dictatorship. The test of what the revolution was for comes ' +
            'later: look at what the winners wrote into law.',
        ],
      },
      {
        heading: 'Joe, and what the mission had been',
        paragraphs: [
          'The Alamo battle of early 1836 is the famous chapter: roughly two hundred defenders, ' +
            'thirteen days, almost all killed when Santa Anna’s forces overwhelmed the mission. ' +
            'That is the part many classrooms keep.',
          'Here is a detail that usually falls out. One survivor was a man named Joe, enslaved by ' +
            'William Travis, the Alamo’s commander. Joe survived the battle his enslaver died in, ' +
            'carried news of the defeat, and was returned to the estate as property. Before the ' +
            'mission was a battlefield, it had been used as a slave market. When people say ' +
            '“remember the Alamo,” there is more to remember than the siege alone.',
          'Weeks later at Goliad, Santa Anna had more than four hundred prisoners executed after ' +
            'they surrendered. The rallying cry for the final fight was “Remember the Alamo, ' +
            'remember Goliad.” Half of that phrase fell out of national memory. Six weeks after ' +
            'the Alamo, at San Jacinto, Santa Anna was captured in a short battle and signed away ' +
            'Texas while a prisoner. Mexico’s government never accepted a treaty signed at gunpoint. ' +
            'That refusal matters for everything that follows.',
          'BlackStory links this narrative to dated legal and place records you can open: the ' +
            'Emancipation Proclamation as a U.S. contrast date, Sweatt v. Painter as a later Texas ' +
            'education case on the same state map, and Fort Mose as an earlier free Black settlement ' +
            'under Spanish Florida. Sources for the spine of this piece are listed below. Check the ' +
            'pins. Do not take the slogan as the whole archive.',
        ],
      },
    ],
  }),

  story({
    slug: 'what-the-winners-wrote',
    title: 'What the winners wrote',
    dek:
      'After San Jacinto, Texas became a republic. The 1836 constitution did not merely allow ' +
      'slavery. It locked it in place, then the border moved under a treaty Grant later called unjust.',
    publishedAt: PUBLISHED_AT,
    eraLabel: '1836–1848',
    placeLabel: 'Republic of Texas',
    relatedEntityIds: [
      'ent_law_13th_amendment_1865',
      'ent_case_sweatt_v_painter_1950',
      'ent_law_missouri_compromise_1820',
    ],
    sources: [
      {
        label: 'Tarlton Law Library — Republic of Texas Constitution (1836), General Provisions §9',
        url: 'https://tarlton.law.utexas.edu/constitutions/republic-texas-1836/general-provisions',
      },
      {
        label: 'Texas State Historical Association — Slavery',
        url: 'https://www.tshaonline.org/handbook/entries/slavery',
      },
      {
        label: 'National Archives — Treaty of Guadalupe Hidalgo (1848)',
        url: 'https://www.archives.gov/milestone-documents/treaty-of-guadalupe-hidalgo',
      },
      {
        label: 'National Archives — 13th Amendment (1865)',
        url: 'https://www.archives.gov/milestone-documents/13th-amendment',
      },
      {
        label: 'National Archives — Missouri Compromise (1820)',
        url: 'https://www.archives.gov/milestone-documents/missouri-compromise',
      },
      {
        label: 'Cornell LII — Sweatt v. Painter, 339 U.S. 629 (1950)',
        url: 'https://www.law.cornell.edu/supremecourt/text/339/629',
      },
    ],
    body: [
      {
        paragraphs: [
          'Once Texas stood as an independent republic, the useful question is not the battle cry. ' +
            'It is what the winners built. The Texas Constitution of 1836 did not simply permit ' +
            'slavery. It made slavery permanent: the legislature was forbidden from ever freeing ' +
            'anyone. Free Black people could not live in Texas without legislative permission.',
          'In nine years as a republic, the enslaved population grew from about five thousand to ' +
            'about thirty thousand. That growth is the mechanism layer. It answers what the ' +
            'revolution secured on paper, not what campaign stories claimed in the moment.',
        ],
      },
      {
        heading: 'Tejanos who helped win it',
        paragraphs: [
          'American settlers did not win independence alone. Tejanos (Mexican Texans) fought on ' +
            'the Texan side throughout. Several died inside the Alamo. Juan Seguín commanded ' +
            'Tejano cavalry at San Jacinto. Lorenzo de Zavala, who had helped write Mexico’s ' +
            'constitution, became the republic’s first vice president.',
          'Most of them were not fighting for a slave republic. They were fighting Santa Anna’s ' +
            'dictatorship. They wanted Mexico’s federal constitution back. What they got was a ' +
            'new country that turned on them almost immediately. Anglo settlers poured in and ' +
            'pushed Tejano families off land held for generations.',
          'Seguín, mayor of San Antonio and a builder of the Alamo’s defense, faced so many ' +
            'threats from people he had fought beside that he fled to Mexico. The Mexican army ' +
            'forced him to fight against Texas. Both countries called him a traitor. That is what ' +
            'happened to Mexicans who picked the winning side.',
        ],
      },
      {
        heading: 'Annexation, the spot, the border',
        paragraphs: [
          'Texas wanted to join the United States immediately. The United States said no for nine ' +
            'years. Congress knew what Texas was: adding a giant new slave state would blow up the ' +
            'balance of power in Washington. Annexation was so obviously about slavery that the ' +
            'country hesitated. In 1845 it stopped hesitating. Texas entered as a slave state.',
          'Mexico, which had never accepted Texas independence, broke off relations. President ' +
            'Polk sent the U.S. Army into a strip both countries claimed. Blood was shed. Polk told ' +
            'Congress that Mexico had invaded America. Freshman congressman Abraham Lincoln demanded ' +
            'the exact spot on American soil where American blood spilled. Those “spot resolutions” ' +
            'are on the record. Lincoln called the war unconstitutional and unnecessary. The war ' +
            'happened anyway.',
          'In 1848 the Treaty of Guadalupe Hidalgo took more than half of Mexico’s territory: ' +
            'California, Nevada, Utah, most of Arizona and New Mexico, parts of other states. ' +
            'Ulysses S. Grant, who fought in that war as a young officer, later called it one of ' +
            'the most unjust wars ever waged by a stronger nation against a weaker one. The treaty ' +
            'promised citizenship and property protection to roughly a hundred thousand Mexicans ' +
            'already living on that land. Over following decades, courts, squatters, and legal fees ' +
            'stripped most of those grants away. The people did not leave. The border moved.',
          'We remember thirteen days at a mission. The story is thirty years long: Mexico abolishes ' +
            'slavery, settlers refuse it, a republic locks bondage into its constitution, Tejanos ' +
            'who helped win are discarded, annexation and war redraw the map. Move the start line, ' +
            'and the whole arc looks different. Open the Thirteenth Amendment and Missouri Compromise ' +
            'records when you want the U.S. legal spine beside this Texas chapter.',
        ],
      },
    ],
  }),

  story({
    slug: 'the-log-cabin-costume',
    title: 'The log cabin costume',
    dek:
      'In 1840 a plantation heir ran as a man of hard cider and log cabins. The mansion had been ' +
      'built around an actual cabin. The costume still works. The test is older than the props.',
    publishedAt: PUBLISHED_AT,
    eraLabel: '1840–',
    placeLabel: 'United States',
    relatedEntityIds: ['ent_nmaahc_001', 'ent_law_voting_rights_act_1965'],
    sources: [
      {
        label: 'Library of Congress — Presidential Election of 1840 resource guide',
        url: 'https://guides.loc.gov/presidential-election-1840/introduction',
      },
      {
        label: 'White House Historical Association — William Henry Harrison',
        url: 'https://www.whitehousehistory.org/bios/william-henry-harrison',
      },
      {
        label: 'National Archives — Voting Rights Act (1965)',
        url: 'https://www.archives.gov/milestone-documents/voting-rights-act',
      },
    ],
    body: [
      {
        paragraphs: [
          'Every election season, someone powerful puts on work clothes for the camera. Flannel. ' +
            'A rented truck. Fast food held at the right angle. The insult is not only the act. It ' +
            'is what the act assumes: that if the prop is held correctly, voters will not check the ' +
            'record.',
          'The costume has a birthday. In 1840 William Henry Harrison ran for president. He was ' +
            'the son of a Declaration signer, born on a Virginia plantation into one of the ' +
            'wealthiest slaveholding families in the state. A newspaper jabbed that the old man ' +
            'would be happy sitting in a log cabin drinking hard cider. His campaign took the jab ' +
            'as branding.',
        ],
      },
      {
        heading: 'Cabin inside the mansion',
        paragraphs: [
          'Log cabins appeared on banners and coins. Whiskey bottles were shaped like cabins. ' +
            'Barrels of hard cider rolled into rallies. The plantation man became the log-cabin man. ' +
            'At the same moment, he lived in a sixteen-room mansion. That mansion had been built ' +
            'around an actual log cabin. The cabin sat inside the house. The metaphor writes itself.',
          'His opponent, Martin Van Buren, was a tavern keeper’s son: the one man in the race who ' +
            'had grown up without a plantation. Harrison’s allies spent three days in Congress ' +
            'painting Van Buren as a soft-fingered aristocrat with foreign finger bowls and golden ' +
            'spoons. The rich man played poor. The regular man got painted rich. The rich man won ' +
            'in a landslide.',
          'There is even a period record of a pickpocket, on the way to jail, stopping to speak for ' +
            'Harrison. People who lived by confidence games recognized the move. The play has been ' +
            'rerun for nearly two centuries because it keeps working: ranch photo ops, hunting-license ' +
            'stunts, diner booths aimed at the lens.',
        ],
      },
      {
        heading: 'Why the costume exists',
        paragraphs: [
          'Kings did not pretend to be peasants. They did not have to. In a democracy, wealth still ' +
            'needs something it cannot buy off a shelf: votes. If candidates arrived as what they ' +
            'are, the fatal question would be louder: whose side are you on?',
          'Being “like you” is cheap. The corn dog costs two dollars. The flannel costs forty. ' +
            'Voting against donors costs everything, so the camera gets the prop. The mechanism is ' +
            'old: affinity lowers the guard. Affinity is not the same sentence as solidarity.',
          'Write down one rule. Do not watch how they eat. Watch how they vote. The diner is a set. ' +
            'The flannel is a costume. The prop points at the camera. The roll-call points at you. ' +
            'Anybody can play broke for an afternoon. Nobody can fake a voting record forever.',
          'BlackStory off-ramps this piece to the National Museum of African American History and ' +
            'Culture on the Mall, and to the Voting Rights Act record: places where political power, ' +
            'franchise, and public memory are documented without needing the costume. Sources for ' +
            'the campaign record and those off-ramps are listed below.',
        ],
      },
    ],
  }),

  story({
    slug: 'twelve-years-then-redemption',
    title: 'Twelve years, then redemption',
    dek:
      'From 1865 to 1877 Black Americans built political power, schools, and towns under federal ' +
      'protection. The deal that ended Reconstruction had a name winners chose: redemption.',
    publishedAt: PUBLISHED_AT,
    eraLabel: '1865–1896',
    placeLabel: 'United States',
    relatedEntityIds: [
      'ent_law_reconstruction_act_1867',
      'ent_law_15th_amendment_1870',
      'ent_case_plessy_v_ferguson_1896',
      'ent_princeville_nc_001',
    ],
    sources: [
      {
        label: 'BlackPast.org — The Reconstruction Acts (1867)',
        url: 'https://www.blackpast.org/african-american-history/1867-reconstruction-acts/',
      },
      {
        label: 'National Archives — 15th Amendment (1870)',
        url: 'https://www.archives.gov/milestone-documents/15th-amendment',
      },
      {
        label: 'National Archives — Plessy v. Ferguson (1896)',
        url: 'https://www.archives.gov/milestone-documents/plessy-v-ferguson',
      },
      {
        label: 'N.C. Department of Natural and Cultural Resources — Princeville (1885)',
        url: 'https://www.dncr.nc.gov/blog/2016/02/20/princeville-founded-african-americans-incorporated-1885',
      },
    ],
    body: [
      {
        paragraphs: [
          'After emancipation, Reconstruction opened a twelve-year window (1865–1877) in which ' +
            'Black Americans built more formal political power than in the previous two and a half ' +
            'centuries combined. Black men entered state legislatures and the United States Senate. ' +
            'Black children went to public school for the first time in many places. The Reconstruction ' +
            'Act of 1867 and the Fifteenth Amendment are load-bearing statutes on that map.',
          'The window did not close by accident. A contested presidential election produced a ' +
            'federal bargain: troops withdrawn, Reconstruction ended. What followed was called ' +
            'redemption. That is the historical term winners used. White southern politics named ' +
            'the destruction of Black political power a redemption from Black freedom.',
        ],
      },
      {
        heading: 'Piece by piece',
        paragraphs: [
          'It did not happen in a single night. Voting rights were stripped state by state. Public ' +
            'schools were resegregated. Federal civil-rights enforcement withered. By 1896 the ' +
            'Supreme Court, in Plessy v. Ferguson, blessed segregation as law. By 1900 most Black ' +
            'men in the South could not vote. The federal government watched. Courts blessed the ' +
            'structure. The archive keeps the dates.',
          'Presence still shows on the map. After Union occupation reached Tarboro in 1865, ' +
            'formerly enslaved people settled Freedom Hill across the Tar River. In 1885 that ' +
            'community incorporated as Princeville, widely documented as the oldest town in the ' +
            'United States founded and incorporated by African Americans. Charters and floodplain ' +
            'pins outlast slogan timelines. Start with the town record when you want a place that ' +
            'survived the rollback.',
        ],
      },
      {
        heading: 'How to read the pattern',
        paragraphs: [
          'Reconstruction is often taught as a brief interlude between war and Jim Crow. Move the ' +
            'emphasis to what was built (schools, offices, towns, statutes) and what was dismantled ' +
            'on purpose, and the twelve years stop looking like a failed experiment. They look like ' +
            'a contested success that opponents named redemption when they undid it.',
          'BlackStory keeps the mechanism on the record: Reconstruction Act, Fifteenth Amendment, ' +
            'Plessy, Princeville. Sources for this piece are listed below; open related entities for ' +
            'claim-level confidence. The story’s job is to connect the spine, not to replace the ' +
            'entity receipts.',
        ],
      },
    ],
  }),

  story({
    slug: 'after-the-second-reconstruction',
    title: 'After the second reconstruction',
    dek:
      'The civil-rights statutes of the 1950s and 1960s were a second reconstruction. Voting Rights ' +
      'Act preclearance had a birthday in court, and a later court date that changed the map again.',
    publishedAt: PUBLISHED_AT,
    eraLabel: '1965–2013',
    placeLabel: 'United States',
    relatedEntityIds: [
      'ent_law_voting_rights_act_1965',
      'ent_case_south_carolina_v_katzenbach_1966',
      'ent_case_shelby_county_v_holder_2013',
      'ent_little_rock_central_high_001',
    ],
    sources: [
      {
        label: 'National Archives — Voting Rights Act (1965)',
        url: 'https://www.archives.gov/milestone-documents/voting-rights-act',
      },
      {
        label: 'Cornell LII — South Carolina v. Katzenbach, 383 U.S. 301 (1966)',
        url: 'https://www.law.cornell.edu/supremecourt/text/383/301',
      },
      {
        label: 'Oyez — Shelby County v. Holder (2013)',
        url: 'https://www.oyez.org/cases/2012/12-96',
      },
      {
        label: 'Brennan Center — Effects of Shelby County v. Holder on the Voting Rights Act',
        url: 'https://www.brennancenter.org/our-work/research-reports/effects-shelby-county-v-holder-voting-rights-act',
      },
      {
        label: 'National Park Service — Little Rock Central High School NHS',
        url: 'https://www.nps.gov/chsc/index.htm',
      },
    ],
    body: [
      {
        paragraphs: [
          'If Reconstruction was the first federal attempt to make citizenship real after slavery, ' +
            'the mid-twentieth-century civil-rights statutes were a second reconstruction. Brown v. ' +
            'Board and campus fights like Little Rock Central High belong on that timeline as place ' +
            'records. The Voting Rights Act of 1965 is the franchise mechanism at the center of ' +
            'this chapter.',
          'In 1966, South Carolina v. Katzenbach upheld the Act’s preclearance requirement: ' +
            'jurisdictions with documented histories of discrimination needed federal approval ' +
            'before changing voting rules. That holding is a dated check. It said Congress could ' +
            'enforce the Fifteenth Amendment with tools matched to the record.',
        ],
      },
      {
        heading: 'When the formula fell',
        paragraphs: [
          'In 2013, Shelby County v. Holder struck down the coverage formula that made preclearance ' +
            'work. Without a valid formula, jurisdictions with long histories of discrimination no ' +
            'longer needed advance federal approval for many voting changes. The opinion did not ' +
            'erase the Fifteenth Amendment. It removed a specific enforcement gear.',
          'What followed is visible in state law calendars and district maps, not in vibes. When ' +
            'protections weaken, Black political geography can be redrawn quickly. The archive ' +
            'test is simple: compare the Voting Rights Act text, the 1966 uphold, and the 2013 ' +
            'formula decision side by side. Do not argue the weather. Argue the dockets.',
        ],
      },
      {
        heading: 'Verification off-ramp',
        paragraphs: [
          'People who notice rollback patterns are not inventing ghosts. The country has done this ' +
            'sequence before: expansion of Black civic power, then legal and political dismantling ' +
            'under new language. Redemption was the nineteenth-century name. Twenty-first-century ' +
            'labels differ. The structure rhymes.',
          'BlackStory ends this piece on records you can open today: the Voting Rights Act, ' +
            'Katzenbach, Shelby County, and Little Rock Central High as a campus-first pin for the ' +
            'desegregation middle of the century. Sources are listed below. Read the statutes and ' +
            'opinions. Watch how jurisdictions vote on maps and bills. That is the present bridge ' +
            'without a trauma hook: evidence, then assertion.',
        ],
      },
    ],
  }),
] as const;

export function listSeedStoryProjections(): readonly PublicStoryProjectionDoc[] {
  return SEED_STORY_PROJECTIONS;
}

export function getSeedStoryProjection(slug: string): PublicStoryProjectionDoc | undefined {
  return SEED_STORY_PROJECTIONS.find((story) => story.slug === slug);
}
