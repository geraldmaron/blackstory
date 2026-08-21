/**
 * Flagship article: "The gap that never closed" — the era-immersion wealth-gap
 * spine, built on the /articles surface.
 *
 * Voice follows docs/content/neo-voice.md (Part III: cold open in second
 * person, the rule in force quoted verbatim, measured odds as plain
 * comparisons, jump-cuts; Part II/IV: specific person, specific hour; prose
 * builds stakes, data delivers the verdict; disputes shown in the prose).
 * Narrative facts follow
 * docs/methodology/chapter-fact-validation.md: every event fact traces to two
 * independent fetched sources, or to a named primary-record holder attributed
 * in the sentence (the 2001 Oklahoma commission report, Douglass's own
 * memoir). Events get buildup, not verdicts: the 1921 section runs from the
 * Drexel Building elevator through the Tribune front page, the courthouse
 * crowd, the 1:46 a.m. telegram, and dawn on June 1, each beat cited.
 *
 * Section rhythm matches buying-a-home.ts: six era sections, each carrying
 * full paragraphs before it hands off to a document, chart, or stat rail.
 * Chronology runs forward within each section. Data blocks bind to the
 * published theme-impact packet `tip_wealth_gap_gap_that_never_closed`;
 * inline [ref:id] markers resolve to the references list; primaryDocument
 * refIds match packet artifactIds
 * (packages/ops-data/fixtures/theme-impact/wealth-gap-packets.ts).
 * method_stance stays juxtaposition: events are placed beside the ratio
 * series, never asserted as its single cause. Every figure named in prose is
 * one of the packet's observations; none is invented. Where the record
 * itself disagrees (the death toll, the lost editorial, the 1935 motive),
 * the disagreement is shown, never resolved into one number.
 */

export const wealthGapArticle = {
  id: 'article_wealth_gap',
  slug: 'the-gap-that-never-closed',
  title: 'Chapter: The Gap That Never Closed',
  summary:
    'From the year slavery ended to today, two numbers have been counted side by side: what a typical white household holds, and what a typical Black household holds. The ratio between them has fallen for most of that time and stalled for the last four decades. This chapter follows that one ratio across a century and a half, using the government and academic records that measured it.',
  themeId: 'wealth_gap',
  eraLabel: '1860–present',
  placeLabel: 'United States',
  publishedAt: '2026-07-26',
  status: 'published' as const,
  heroImage: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Tulsariotpostcard2.jpg',
    alt: 'A 1921 postcard captioned "Little Africa on fire. Tulsa Race Riot, June 1st, 1921," showing the Greenwood District burning.',
    credit:
      'Tulsa Race Massacre postcard, June 1, 1921. McFarlin Library, University of Tulsa. Published before 1931, public domain in the United States (Wikimedia Commons).',
    rightsStatus: 'public_domain' as const,
  },
  relatedEntityIds: ['ent_greenwood_district_001'],
  references: [
    {
      id: 'dkks-wealth-of-two-nations',
      label:
        'Ellora Derenoncourt, Chi Hyun Kim, Moritz Kuhn, and Moritz Schularick, "Wealth of Two Nations: The U.S. Racial Wealth Gap, 1860–2020," benchmark-year white-to-Black per-capita wealth ratio.',
      url: 'https://www.elloraderenoncourt.com/us-inequality-data',
    },
    {
      id: 'nps-1860-slave-schedule',
      label:
        'National Park Service, "United States Census Slave Schedule for St. Louis County, 1860" — how Schedule 2 recorded enslaved people under the slaveholder’s name, without their own.',
      url: 'https://www.nps.gov/articles/000/united-states-census-slave-schedule-for-st-louis-county-1860.htm',
    },
    {
      id: 'fssp-savannah-colloquy',
      label:
        'Minutes of the meeting between Black religious leaders and Union military authorities, Savannah, Jan. 12, 1865 (published New-York Daily Tribune, Feb. 13, 1865); Freedmen and Southern Society Project transcription, University of Maryland.',
      url: 'https://www.freedmen.umd.edu/savmtg.htm',
    },
    {
      id: 'special-field-orders-15',
      label:
        'Special Field Orders, No. 15 (Sherman, Jan. 16, 1865), William A. Gladstone Afro-American Military Collection, Library of Congress; original in RG 94, National Archives.',
      url: 'https://www.loc.gov/item/mss83434256/',
    },
    {
      id: 'fssp-sfo15-text',
      label:
        'Special Field Orders, No. 15, verbatim text; Freedmen and Southern Society Project transcription, University of Maryland.',
      url: 'https://www.freedmen.umd.edu/sfo15.htm',
    },
    {
      id: 'circular-15-1865',
      label:
        'War Department, Bureau of Refugees, Freedmen, and Abandoned Lands, Circular No. 15 (Sept. 12, 1865), approved by President Andrew Johnson; The American Presidency Project, UC Santa Barbara.',
      url: 'https://www.presidency.ucsb.edu/documents/circular-no-15',
    },
    {
      id: 'fssp-edisto-petitions',
      label:
        'Committee of Freedmen on Edisto Island to Freedmen’s Bureau Commissioner O. O. Howard, and petition to President Andrew Johnson, Oct. 1865; Freedmen and Southern Society Project transcription.',
      url: 'https://www.freedmen.umd.edu/Edisto%20petitions.htm',
    },
    {
      id: 'freedmans-savings-bank',
      label:
        'Office of the Comptroller of the Currency, "The Freedman’s Savings Bank: Good Intentions Were Not Enough."',
      url: 'https://www.occ.gov/about/who-we-are/history/history-of-the-occ/1863-1865/1863-1865-freedmans-savings-bank.html',
    },
    {
      id: 'occ-freedmans-150th',
      label:
        'Thomas J. Curry, Comptroller of the Currency, remarks at the 150th anniversary of the Freedman’s Savings and Trust Company, Mar. 3, 2015.',
      url: 'https://www.occ.gov/news-issuances/speeches/2015/pub-speech-2015-34.pdf',
    },
    {
      id: 'nara-prologue-freedmans-bank',
      label:
        'National Archives, Prologue (Summer 1997), "The Freedman’s Savings and Trust Company and African American Genealogical Research."',
      url: 'https://www.archives.gov/publications/prologue/1997/summer/freedmans-savings-and-trust.html',
    },
    {
      id: 'uga-freedmans-passbooks',
      label:
        'Freedman’s Bank Research project, University of Georgia — depositor passbooks and their custody at the National Archives (RG 101).',
      url: 'https://freedmansbank.uga.edu/project/passbooks/',
    },
    {
      id: 'docsouth-douglass-life-and-times',
      label:
        'Frederick Douglass, Life and Times of Frederick Douglass (1881), on the Freedman’s Bank presidency; Documenting the American South, University of North Carolina.',
      url: 'https://docsouth.unc.edu/neh/douglasslife/douglass.html',
    },
    {
      id: 'tulsa-commission-2001',
      label:
        'Oklahoma Commission to Study the Tulsa Race Riot of 1921, "Tulsa Race Riot" (Feb. 28, 2001), Oklahoma Historical Society.',
      url: 'https://www.okhistory.org/research/forms/freport.pdf',
    },
    {
      id: 'ohs-greenwood-district',
      label:
        'Hannibal B. Johnson, "Greenwood District," Encyclopedia of Oklahoma History and Culture, Oklahoma Historical Society.',
      url: 'https://www.okhistory.org/publications/enc/entry?entry=GR024',
    },
    {
      id: 'loc-tulsa-newspapers',
      label:
        'Library of Congress, Headlines & Heroes, "Tulsa Race Massacre: Newspaper Complicity and Coverage" (2021).',
      url: 'https://blogs.loc.gov/headlinesandheroes/2021/05/tulsa-race-massacre-newspaper-complicity-and-coverage/',
    },
    {
      id: 'ths-1921-exhibit',
      label: 'Tulsa Historical Society & Museum, "1921 Tulsa Race Massacre."',
      url: 'https://www.tulsahistory.org/exhibit/1921-tulsa-race-massacre/',
    },
    {
      id: 'senate-finance-1935',
      label:
        'Economic Security Act: Hearings before the Senate Committee on Finance, 74th Cong., 1st Sess., on S. 1130 (1935); Charles H. Houston testimony, Feb. 9, 1935.',
      url: 'https://www.finance.senate.gov/imo/media/doc/74HrgEconomicSec.pdf',
    },
    {
      id: 'social-security-act-1935',
      label:
        'Social Security Act of 1935, full text, Social Security Administration history office.',
      url: 'https://www.ssa.gov/history/35act.html',
    },
    {
      id: 'ssa-dewitt-2010',
      label:
        'Larry DeWitt, "The Decision to Exclude Agricultural and Domestic Workers from the 1935 Social Security Act," Social Security Bulletin 70(4), 2010.',
      url: 'https://www.ssa.gov/policy/docs/ssb/v70n4/v70n4p49.html',
    },
    {
      id: 'gi-bill-turner-bound',
      label:
        'Sarah E. Turner and John Bound, "Closing the Gap or Widening the Divide: The Effects of the G.I. Bill and World War II on the Educational Outcomes of Black Americans," NBER Working Paper 9044 (2002).',
      url: 'https://www.nber.org/papers/w9044',
    },
    {
      id: 'fdr-library-gi-bill',
      label:
        'Paul Sparrow, "FDR and the GI Bill," Franklin D. Roosevelt Presidential Library (National Archives), Nov. 10, 2020.',
      url: 'https://fdr.blogs.archives.gov/2020/11/10/fdr-gi-bill/',
    },
    {
      id: 'house-fair-housing-1968',
      label:
        'U.S. House of Representatives, History, Art & Archives, "The Fair Housing Act of 1968."',
      url: 'https://history.house.gov/Historical-Highlights/1951-2000/hh_1968_04_10/',
    },
    {
      id: 'govinfo-fair-housing-3601',
      label:
        '42 U.S.C. § 3601 (Fair Housing Act declaration of policy), Pub. L. 90-284, title VIII, § 801, Apr. 11, 1968, 82 Stat. 81; govinfo, U.S. Code.',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2023-title42/html/USCODE-2023-title42-chap45-subchapI-sec3601.htm',
    },
    {
      id: 'census-historical-housing',
      label:
        'U.S. Census Bureau, Historical Census of Housing Tables, homeownership rates by race, 1970.',
      url: 'https://www.census.gov/topics/housing/homeownership/data/historical.html',
    },
    {
      id: 'census-h5-income-1972',
      label:
        'U.S. Census Bureau, Historical Household Income Tables H-5, median household income by race, 1972 (2023 dollars).',
      url: 'https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx',
    },
    {
      id: 'scf-2022',
      label:
        'Board of Governors of the Federal Reserve System, Survey of Consumer Finances, 2022, median household net worth and white-to-Black ratio.',
      url: 'https://www.federalreserve.gov/econres/scfindex.htm',
    },
    {
      id: 'scf-2022-fednote',
      label:
        'Federal Reserve, FEDS Notes, "Greater Wealth, Greater Uncertainty: Changes in Racial Inequality in the Survey of Consumer Finances," Oct. 2023.',
      url: 'https://www.federalreserve.gov/econres/notes/feds-notes/greater-wealth-greater-uncertainty-changes-in-racial-inequality-in-the-survey-of-consumer-finances-accessible-20231018.htm',
    },
  ],
  body: [
    // ---- Era 1860–1870: counted as property, the promised land, the reversal ----
    { type: 'heading', level: 2 as const, text: '1860 · You are counted as property' },
    {
      type: 'paragraph',
      text: 'You’re enslaved in 1860, and when the census taker comes through that summer, he doesn’t ask you anything. Your name goes nowhere. The form for people like you is a separate one, Schedule 2, "Slave Inhabitants," and on it you’re a line under the name of the man who owns you: an age, a sex, a color, nothing else [ref:nps-1860-slave-schedule]. When researchers went back and worked out what the country held that year, the last full count taken before the war, they found the average white person holding about fifty-six times what the average Black person held [ref:dkks-wealth-of-two-nations]. That figure isn’t really a gap between two groups of owners. It’s the distance between people who owned and people who were owned, written down as a ratio.',
    },
    {
      type: 'paragraph',
      text: 'For one week in January 1865, somebody in power asks the people themselves what freedom should mean. On January 12, in Savannah, twenty Black ministers and church officers sit down with Secretary of War Edwin Stanton and General William T. Sherman. The man they’ve chosen to speak for them is Garrison Frazier, a Baptist minister, sixty-seven years old, who bought freedom for himself and his wife about eight years earlier for a thousand dollars in gold and silver. Asked what his people need, he answers on the record: "The way we can best take care of ourselves is to have land, and turn it and till it by our own labor" [ref:fssp-savannah-colloquy].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_savannah_colloquy_1865',
    },
    {
      type: 'paragraph',
      text: 'Four days later Sherman issues Special Field Orders No. 15, and it reads like Frazier’s answer written into military law. "The islands from Charleston, south, the abandoned rice fields along the rivers for thirty miles back from the sea, and the country bordering the St. Johns river, Florida, are reserved and set apart for the settlement of the negroes now made free by the acts of war," it says; each family gets "not more than (40) forty acres of tillable ground," and in the new settlements "the sole and exclusive management of affairs" is left to the freed people themselves [ref:fssp-sfo15-text][ref:special-field-orders-15]. Within months roughly forty thousand people have moved onto about four hundred thousand acres. They clear it, plant it, and live on it.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_special_field_orders_15_1865',
    },
    {
      type: 'paragraph',
      text: 'Then the promise runs backward. That fall President Andrew Johnson starts pardoning the former owners, and his Freedmen’s Bureau circular provides that abandoned lands "may be restored to owners pardoned by the President" [ref:circular-15-1865]. In October the Bureau’s own commissioner, Oliver Otis Howard, travels to Edisto Island to tell the families there in person that the land under their feet is going back. The committee they form puts its case in one line: "General we want Homestead’s; we were promised Homestead’s by the government" [ref:fssp-edisto-petitions]. The land goes back anyway. So emancipation arrives and almost nothing changes hands: no land, no tools, no back pay for the years already worked. The first count taken after slavery, in 1870, still finds the average white person holding about twenty-one times what the average Black person holds [ref:dkks-wealth-of-two-nations]. Read quickly, that looks like enormous progress, fifty-six down to twenty-one in a decade. Read honestly, it’s the arithmetic of a starting line. The ratio fell that far that fast because freedom changed what could be counted, not because anyone handed over a stake.',
    },
    {
      type: 'figure',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      metricIds: ['dkks-wealth-ratio-white-black-nation'],
      caption:
        'White-to-Black per-capita wealth ratio, United States, benchmark years 1860–2019 (Derenoncourt, Kim, Kuhn & Schularick).',
    },

    // ---- Era 1874–1900: the bank failure and the decades after ----
    { type: 'heading', level: 2 as const, text: '1874 · The bank that holds what you saved' },
    {
      type: 'paragraph',
      text: 'Whatever you manage to put aside after that, there’s one place you’re told to keep it. The Freedman’s Savings and Trust Company is chartered by Congress in the last months of the war, and it grows to thirty-seven branches across seventeen states and the District of Columbia [ref:nara-prologue-freedmans-bank]. What you hold is a passbook: your name and account number on the cover, the branch, a few pages of the bank’s rules, then the ledger lines of everything you’ve saved [ref:uga-freedmans-passbooks]. The National Archives’ records of who saved there read like a directory of every job the country would let you hold: farmers, laborers, cooks, janitors, nurses, porters, seamstresses, washers, blacksmiths, barbers, and alongside them churches and benevolent societies [ref:nara-prologue-freedmans-bank]. Across its life, more than seventy thousand depositors put in roughly fifty-seven million dollars [ref:nara-prologue-freedmans-bank].',
    },
    {
      type: 'paragraph',
      text: 'What the passbook can’t show you is what’s happening in Washington. In 1870 Congress amends the bank’s charter to let it put half of the deposits into riskier investments, a change the Comptroller of the Currency’s own history says opened the door to fraud, speculation, and mismanagement [ref:occ-freedmans-150th][ref:nara-prologue-freedmans-bank]. By that same account, the bank spends the next three years virtually controlled by Jay Cooke and Company, the financial house whose collapse then sets off the Panic of 1873 [ref:occ-freedmans-150th]. In March 1874, with depositors running on the branches, the trustees elect Frederick Douglass president, hoping his name can steady it [ref:nara-prologue-freedmans-bank]. He lends the bank ten thousand dollars of his own money to meet what he’s told is a temporary emergency. Then he examines the books and writes down what he finds: "The fact is, and all investigation shows it, that I was married to a corpse" [ref:docsouth-douglass-life-and-times]. He tells the Senate the bank is insolvent and ought to stop. On June 29, 1874, it closes, holding the accounts of 61,144 depositors, and the losses come to nearly three million dollars [ref:freedmans-savings-bank].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_freedmans_savings_bank_collapse_1874',
    },
    {
      type: 'paragraph',
      text: 'Getting anything back means mailing your passbook to Washington and waiting. About half of the depositors eventually recover roughly three-fifths of what they’d saved; the rest get nothing, and some families keep petitioning Congress for more than thirty years [ref:nara-prologue-freedmans-bank]. Meanwhile the decades that rarely make the story keep arriving, and the ratio keeps falling: about nineteen to one in 1880, just under fifteen to one in 1890, a bit over eleven to one by 1900 [ref:dkks-wealth-of-two-nations]. Every one of those numbers is an improvement on the one before it, and every one of them is still a canyon. This is the stretch that’s easiest to misread. A ratio dropping from fifty-six to eleven across forty years sounds like a country closing a gap. What it actually describes is a population building from almost nothing, and building fast, with the distance left to cover still enormous.',
    },

    // ---- Era 1921: Greenwood — buildup, trigger, burning, and what the record can say ----
    { type: 'heading', level: 2 as const, text: '1921 · What burns in two days' },
    {
      type: 'paragraph',
      text: 'By the spring of 1921, if you live in [[ent_greenwood_district_001|Greenwood]], the thirty-five square blocks on the north side of Tulsa that the country came to call Black Wall Street [ref:ohs-greenwood-district], you can walk past most of what a city needs without leaving the neighborhood. The state commission that later studied the district counted 191 Black-run businesses there in 1921, and alongside them fifteen physicians, two newspapers, schools, a hospital, a branch library [ref:tulsa-commission-2001]. The Dreamland Theatre seats 750. The Stradford Hotel has 54 rooms. Mount Zion Baptist Church, brick and new after years of saving, was dedicated on April 10 [ref:tulsa-commission-2001]. Among the doctors is A. C. Jackson, a surgeon one of the Mayo brothers had called, in a line the commission’s report preserves, the "most able Negro surgeon in America" [ref:tulsa-commission-2001].',
    },
    {
      type: 'paragraph',
      text: 'What ends all of it starts in an elevator. The shine parlor where nineteen-year-old Dick Rowland works has no toilet for its Black employees, so the owner has arranged for them to use a "Colored" restroom on the top floor of the Drexel Building nearby, reached by the building’s one elevator [ref:tulsa-commission-2001]. On Monday, May 30, Rowland rides it. The operator is Sarah Page, seventeen and white. A clerk in the store below hears what he takes for a scream, sees Rowland run, and calls the police. And there the record goes quiet. The commission found that no record exists of what Page actually told the police, and that the police themselves treated the matter as minor, opening what the report calls "a rather low-key investigation" [ref:tulsa-commission-2001]. The explanation most often credited since is the ordinary one: he tripped and stepped on her foot [ref:tulsa-commission-2001][ref:loc-tulsa-newspapers].',
    },
    {
      type: 'paragraph',
      text: 'The next afternoon a newspaper turns an arrest into a countdown. Rowland is picked up on Tuesday, May 31, and held in the jail on the top floor of the county courthouse. That afternoon the Tulsa Tribune puts the story on its front page under the headline "Nab Negro for Attacking Girl in an Elevator" [ref:loc-tulsa-newspapers]. Survivors also remembered the same day’s paper carrying an editorial titled "To Lynch Negro Tonight." No copy of it has ever been found: someone later tore the story and nearly all of the editorial page out of the bound file of that day’s edition before it was microfilmed, so the front page survives only through a 1946 transcription and a duplicate the paper reprinted the next day, and the editorial survives only in the memories of the people who described reading it [ref:tulsa-commission-2001][ref:loc-tulsa-newspapers]. A later edition that day that does survive carries an editorial condemning lynching [ref:loc-tulsa-newspapers]. What the missing pages held can’t be settled now.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_tulsa_tribune_1921_nab_negro',
    },
    {
      type: 'paragraph',
      text: 'By dark the countdown has an audience. White Tulsans start gathering outside the courthouse before sunset, and by 9:30 the commission’s report puts the crowd near two thousand [ref:tulsa-commission-2001]. Sheriff Willard McCullough knows what a crowd outside this building can do: the summer before, a mob had taken a white prisoner from this same courthouse and lynched him. This time the sheriff puts six armed men on the roof, disables the building’s elevator, and barricades the top of the stairs [ref:tulsa-commission-2001]. At about nine o’clock, some twenty-five Black men, many of them veterans of the World War, drive down from Greenwood and offer to help defend the jail. They’re turned away. An hour later a false rumor sweeps Greenwood that the mob is going in, and about seventy-five armed men come back. This time, as they’re leaving, a white man tries to wrestle an Army revolver away from a tall Black veteran, and, in the words the commission’s report uses, "a shot rang out" [ref:tulsa-commission-2001].',
    },
    {
      type: 'paragraph',
      text: 'What follows isn’t a riot that flares and burns out. It’s organized through the night. At 1:46 a.m. the police chief, the sheriff, and a district judge wire the governor: "Race riot developed here. Several killed. Unable handle situation. Request that National Guard forces be sent by special train. Situation serious" [ref:tulsa-commission-2001]. While that telegram moves, thousands of armed white men mass along the railroad tracks that separate Greenwood from white Tulsa, and a machine gun is hauled to the top of a grain elevator overlooking the district [ref:tulsa-commission-2001]. Dawn comes at 5:08. Witnesses remember a whistle or a siren, and then the crossing. Families are forced into the street at gunpoint and marched to Convention Hall and the fairgrounds; the commission counts more than four thousand people interned, the Tulsa Historical Society says more than six thousand, and the records don’t agree beyond that [ref:tulsa-commission-2001][ref:ths-1921-exhibit]. Houses are looted first and burned after. Dr. Jackson walks out of his home with his hands up, and is shot, and dies that day [ref:tulsa-commission-2001].',
    },
    {
      type: 'paragraph',
      text: 'State troops reach Tulsa at about 9:15 that morning, ten and a half hours into the burning, and martial law comes at 11:29 [ref:tulsa-commission-2001]. By then Greenwood is gone. The Red Cross count the commission preserves runs to 1,256 houses burned, along with virtually every other structure: the churches, the schools, the hospital, the library. Nearly ten thousand people are homeless [ref:tulsa-commission-2001][ref:ths-1921-exhibit]. Then a second wave arrives, on paper. Six days later the city passes a fire ordinance written to make rebuilding on the old ground too expensive to attempt; Greenwood’s own lawyers get it struck down in court [ref:tulsa-commission-2001]. Insurers deny claim after claim under the riot exclusion clauses in their policies, and of more than a hundred lawsuits, not one succeeds [ref:tulsa-commission-2001]. A grand jury blames the massacre on the Black men who went to the courthouse. No white Tulsan is ever sent to prison for any of it. And in September, Sarah Page doesn’t appear to press charges, so the case against Dick Rowland, the spark for all of it, is quietly dismissed [ref:tulsa-commission-2001].',
    },
    {
      type: 'dispute',
      label: 'How many people were killed?',
      sideA: {
        sourceLabel: 'Contemporary official count, 1921',
        claim:
          'Official figures at the time put the dead at 36; the Oklahoma Bureau of Vital Statistics recorded 26 Black and 10 white deaths.',
      },
      sideB: {
        sourceLabel: 'Oklahoma commission, 2001',
        claim:
          'The state commission identified 38 victims individually and found credible evidence that the dead "likely number[ed] between one and three hundred." Red Cross records from the period put deaths around 300.',
      },
    },
    {
      type: 'paragraph',
      text: 'The nearest national benchmark, taken the following year, puts the country’s white-to-Black per-capita wealth ratio at about ten and a half to one [ref:dkks-wealth-of-two-nations]. That number is the country’s, not Greenwood’s. No wealth series exists for any single neighborhood in that era, so the place gets named here and the number stays national. The ledger this chapter follows can tell you the size of the gap across a whole country in a given year. It can’t tell you what the particular families who owned those thirty-five blocks lost, because nobody was counting them separately. The record is national by construction. The loss was local.',
    },
    {
      type: 'pullquote',
      text: 'The record is national by construction. The loss was local.',
    },
    {
      type: 'mapInset',
      entityId: 'ent_greenwood_district_001',
      label: 'Greenwood District, Tulsa, Oklahoma',
    },

    // ---- Era 1935–1944: federal asset-building delivered through local doors ----
    { type: 'heading', level: 2 as const, text: '1935 · The help that skips the jobs you hold' },
    {
      type: 'paragraph',
      text: 'Fourteen years later the country starts building a safety net, and you can watch who it’s measured for in a single Saturday of testimony. On February 9, 1935, Charles Hamilton Houston of the NAACP tells the Senate Finance Committee what the pending economic security bill looks like from where he stands: "like a sieve with the holes just big enough for the majority of Negroes to fall through" [ref:senate-finance-1935]. By the Social Security Administration’s own later history, he’s the only witness in the hearings to speak against the exclusion at the bill’s center [ref:ssa-dewitt-2010]. The act passes that summer with the sieve intact. On its face it covers workers and says nothing about race. But when it defines covered employment it writes in two exceptions, "agricultural labor" and "domestic service in a private home" [ref:social-security-act-1935], and by the government’s own accounting those two categories held about 65 percent of Black workers in the country [ref:ssa-dewitt-2010]. The program that would come to define a secure old age starts by leaving most Black workers outside it, and stays that way until the coverage amendments of 1950 and 1954 [ref:ssa-dewitt-2010].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_social_security_act_1935_exclusions',
    },
    {
      type: 'dispute',
      label: 'Was the 1935 exclusion about race?',
      sideA: {
        sourceLabel: 'SSA history office (DeWitt, 2010)',
        claim:
          'The exclusion of farm and domestic labor was driven by tax-collection feasibility, and there is no direct evidence of a racial motive in the record.',
      },
      sideB: {
        sourceLabel: 'Later critics',
        claim:
          'Whatever the stated reason, the two excluded categories held most Black workers, so the effect fell heavily and predictably along racial lines.',
      },
    },
    {
      type: 'paragraph',
      text: 'Nine years later the GI Bill does something similar by a different route. It’s the largest asset-building program of its generation, college tuition and cheap loans for a home or a business, and on paper every veteran gets the same deal. But the money doesn’t come from Washington in a straight line. It runs through local banks, local colleges, and local Veterans Administration offices, and those institutions decide who actually gets served. The National Archives’ own account of how that played out in the New York and northern New Jersey suburbs: 67,000 mortgages insured under the bill, and fewer than 100 of them held by people of color [ref:fdr-library-gi-bill]. Studying the education benefit, Turner and Bound found that for Black veterans confined to the segregated South the bill "had little effect on collegiate outcomes," and on balance widened the Black-white education gap rather than closing it [ref:gi-bill-turner-bound].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_gi_bill_1944_local_administration',
    },
    {
      type: 'paragraph',
      text: 'Set those two beside each other and something shows up that you’d miss reading either statute alone. Neither law says a word about race. Both were administered in a country that did. A benefit written as universal and handed out through local institutions reaches exactly as far as those institutions are willing to reach, which is how the same program can look identical on paper and land completely differently depending on who’s standing at the counter.',
    },

    // ---- Era 1968–1972: after the rules changed ----
    { type: 'heading', level: 2 as const, text: '1970 · The ladder everyone says is there' },
    {
      type: 'paragraph',
      text: 'Then the rules themselves change, in the hardest week the country has had in years. Dr. King is assassinated on April 4, 1968. Six days later the House passes the fair-housing bill, and on April 11 President Johnson signs it [ref:house-fair-housing-1968]. Its declaration of policy is one sentence long: "It is the policy of the United States to provide, within constitutional limitations, for fair housing throughout the United States" [ref:govinfo-fair-housing-3601]. Discrimination in selling, renting, and financing a home is now illegal, in writing.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_fair_housing_act_1968',
    },
    {
      type: 'paragraph',
      text: 'Two years later the census takes the first measurement of the new era. It counts about 42 Black families owning their home for every 100, against about 65 white families for every 100 [ref:census-historical-housing]. That’s a gap of more than twenty homes in every hundred, and it’s showing up after the rules changed, not before. Homeownership carries more weight here than it might look like it should, because for most American families the house is the asset. It’s the largest thing they will ever own and the main thing they hand to their children.',
    },
    {
      type: 'figure',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      metricIds: [
        'census-decennial-homeownership-black-nation',
        'census-decennial-homeownership-white_nh-nation',
      ],
      caption: 'Homeownership rate by race, United States, 1970 decennial census.',
    },
    {
      type: 'paragraph',
      text: 'The household income tape first measures both groups side by side in 1972. A typical white family brings in $64,730 that year, in 2023 dollars, and a typical Black family brings in $37,250, which puts the white household at close to one and three-quarter times the Black household’s income [ref:census-h5-income-1972]. That’s a real gap, and it is a far smaller one than the wealth gap sitting next to it. Income and wealth aren’t the same thing and they aren’t counted by the same survey, so this chapter keeps them apart. What you earn in a year and what your family has accumulated across generations are different questions with different answers.',
    },

    // ---- Present-day close: 2022 ----
    { type: 'heading', level: 2 as const, text: 'Today · You check your accounts' },
    {
      type: 'paragraph',
      text: 'You check your accounts in 2022. The Survey of Consumer Finances puts a typical Black family’s net worth at $44,900 and a typical white family’s at $285,000 [ref:scf-2022], a ratio of about six and a third to one. Measured the other way, per person rather than per household, on the long benchmark series that reaches back to 1860, the most recent point lands at about six and a half to one [ref:dkks-wealth-of-two-nations]. Two different surveys, counting two different things, arriving in nearly the same place. That agreement is the part worth sitting with.',
    },
    {
      type: 'stat',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      kind: 'observation' as const,
      refId: 'obs:scf-median-wealth-black-nation:nation:US:2022',
      caption: 'Median household net worth, Black families, 2022.',
    },
    {
      type: 'stat',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      kind: 'observation' as const,
      refId: 'obs:scf-median-wealth-white-nation:nation:US:2022',
      caption: 'Median household net worth, White non-Hispanic families, 2022.',
    },
    {
      type: 'stat',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      kind: 'observation' as const,
      refId: 'obs:scf-wealth-ratio-white-black-nation:nation:US:2022',
      caption: 'White-to-Black median household wealth ratio, 2022.',
    },
    {
      type: 'paragraph',
      text: 'Now put the whole run in order. Fifty-six to one at emancipation. Twenty-one by 1870, nineteen by 1880, eleven by 1900, about ten and a half in the 1920s. Then a long fall through the middle of the century, and then the line stops falling and simply runs flat. It has stayed roughly flat ever since. The Federal Reserve’s own researchers, working from the same Survey of Consumer Finances data, describe the period since 1989 as one where the racial wealth gap has persisted rather than closed [ref:scf-2022-fednote]. Whatever was narrowing this gap for a hundred years stopped narrowing it around four decades ago, and nothing since has started it again.',
    },
    {
      type: 'figure',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      metricIds: ['dkks-wealth-ratio-white-black-nation', 'scf-wealth-ratio-white-black-nation'],
      caption:
        'White-to-Black wealth ratio, United States, 1860–2022. Two distinct series, kept apart rather than spliced: the per-capita mean (1860–2019) and the household median (2022 shown; SCF runs triennially from 1989). The fall halts around 1980.',
    },
    {
      type: 'heading',
      level: 3 as const,
      text: 'What the two series measure, and don’t',
    },
    {
      type: 'paragraph',
      text: 'Two different wealth series run through this chapter, and they’re never averaged into one line. The per-capita mean ratio sits on benchmark years from 1860 to 2019, and the 1860 and 1870 readings in particular sit over a denominator near zero for the newly freed population, so they’re single benchmark points rather than annual figures. The household-median ratio runs triennially from 1989 onward and measures something else entirely: median household net worth, not per-capita mean wealth [ref:dkks-wealth-of-two-nations][ref:scf-2022]. They’re placed side by side because they cover different spans and different constructs, and the fact that both show a stall after about 1980 is context rather than proof that either one explains the other.',
    },
    { type: 'heading', level: 3 as const, text: 'The record, in order' },
    {
      type: 'paragraph',
      text: 'The events above aren’t a summary of what happened. They’re documents, each with its own date, sitting in a federal archive, a university transcription project, or a state historical society right now: the minutes of a question and its answer, an order and its reversal, a bank failure counted down to the last depositor, a front page and the state’s accounting of what followed it eighty years later, two laws and the way they were actually run, and the one-sentence policy that finally made the discrimination illegal. Read them in order and they trace the same slope the ratio does.',
    },
    {
      type: 'timeline',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
    },
  ],
};

export default wealthGapArticle;
