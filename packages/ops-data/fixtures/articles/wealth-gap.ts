/**
 * Flagship article: "The gap that never closed" — the era-immersion wealth-gap
 * spine, built on the /articles surface.
 *
 * VOICE: docs/content/neo-voice.md is the single binding voice document for
 * this prose and wins over anything else. Law 1 (open on a person in a place
 * at a time; era beats cold-open in second person, present tense), Law 2
 * (every documented obstacle carries a documented, cited pathway: the Savannah
 * answer, the Edisto committee, Douglass on the books, the thirty-year
 * petitions, Greenwood's lawyers, Houston at the Finance Committee), Law 3
 * (the final movement lands on cited agency, nothing softened). Part III
 * supplies the era beat: cold open, the rule in force quoted verbatim, the
 * measured odds as plain comparisons a reader can hold, jump-cut. Part IV
 * governs the sentence: contractions throughout, no em dashes in prose, no
 * bare decimals or lone percents in prose (exact figures live in the adjacent
 * stat and figure blocks), cadence budgets kept (one anaphora run, one
 * call-and-response, one reframing line, one jeremiad in the closing third,
 * one closing flourish). Part V governs claim typing: readings are written as
 * readings, causal verbs stay out unless a gated causal claim carries them.
 * Narrative facts follow
 * docs/methodology/chapter-fact-validation.md: every event fact traces to two
 * independent fetched sources, or to a named primary-record holder attributed
 * in the sentence (the 2001 Oklahoma commission report, Douglass's own
 * memoir). Events get buildup, not verdicts: the 1921 section runs from the
 * Drexel Building elevator through the Tribune front page, the courthouse
 * crowd, the 1:46 a.m. telegram, and dawn on June 1, each beat cited.
 *
 * Section rhythm matches buying-a-home.ts: seven era sections, each carrying
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
    'Economists have reconstructed two numbers back to 1860: the average wealth held per white person and per Black person in America. The ratio between them fell for most of a century, and since about 1980 it has stopped falling and begun to widen again. This chapter follows that line through the records that made it.',
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
        'Ellora Derenoncourt, Chi Hyun Kim, Moritz Kuhn, and Moritz Schularick, "Wealth of Two Nations: The U.S. Racial Wealth Gap, 1860–2020," Quarterly Journal of Economics 139, no. 2 (2024): 693–750; NBER Working Paper 30101 (June 2022).',
      url: 'https://www.nber.org/papers/w30101',
    },
    {
      id: 'dkks-benchmark-series',
      label:
        'Derenoncourt, Kim, Kuhn and Schularick, benchmark-year white-to-Black per-capita wealth ratio series, 1860–2019; author-hosted replication data mirroring the Harvard Dataverse and openICPSR deposits.',
      url: 'https://www.elloraderenoncourt.com/us-inequality-data',
    },
    {
      id: 'fssp-saxton-1865',
      label:
        'Rufus Saxton, Freedmen’s Bureau Assistant Commissioner, to Commissioner O. O. Howard, Sept. 5, 1865, on settlement under Special Field Orders No. 15; Freedmen and Southern Society Project, University of Maryland.',
      url: 'https://www.freedmen.umd.edu/Saxton.html',
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
        'Paul Sparrow, "FDR and the GI Bill," Franklin D. Roosevelt Presidential Library (National Archives), Nov. 10, 2020 — retelling of the Katznelson mortgage count.',
      url: 'https://fdr.blogs.archives.gov/2020/11/10/fdr-gi-bill/',
    },
    {
      id: 'katznelson-affirmative-action',
      label:
        'Ira Katznelson, When Affirmative Action Was White (New York: W. W. Norton, 2005), source of the count of G.I. Bill mortgages insured in the New York and northern New Jersey suburbs; reviewed in Origins, Ohio State University.',
      url: 'https://origins.osu.edu/review/when-affirmative-action-was-white-untold-history-racial-inequality-twentieth-century-america',
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
        'U.S. Census Bureau, Historical Household Income Table H-5, households by median income and race, 1967 to 2024, in 2024 dollars; the White-not-Hispanic series begins in 1972.',
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
      text: 'You’re enslaved in 1860. The census taker comes through that summer and doesn’t ask you anything, and your name goes nowhere. The form for people like you is a separate one, Schedule 2, "Slave Inhabitants," and on it you’re a line under the name of the man who owns you: an age, a sex, a color, nothing else [ref:nps-1860-slave-schedule]. When researchers went back and worked out what the country held that year, the last full count taken before the war, they found the average white person holding about fifty-six times what the average Black person held [ref:dkks-wealth-of-two-nations]. That figure isn’t really a gap between two groups of owners. It’s the distance between people who owned and people who were owned, written down as a ratio. Five years later the country gets asked, out loud, what freedom ought to come with.',
    },

    // ---- Era 1865: the promise, and the reversal ----
    { type: 'heading', level: 2 as const, text: '1865 · The promise, and the reversal' },
    {
      type: 'paragraph',
      text: 'For one week in January 1865, somebody in power asks the people themselves what freedom should mean. On January 12, in Savannah, twenty Black ministers and church officers sit down with Secretary of War Edwin Stanton and General William T. Sherman. The man they’ve chosen to speak for them is Garrison Frazier, a Baptist minister, sixty-seven years old, who bought freedom for himself and his wife about eight years earlier for a thousand dollars in gold and silver. Asked what his people need, he says it plainly, and the minutes keep the words: "The way we can best take care of ourselves is to have land, and turn it and till it by our own labor" [ref:fssp-savannah-colloquy]. He isn’t asking for relief. He’s naming an asset and the labor to work it.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_savannah_colloquy_1865',
    },
    {
      type: 'paragraph',
      text: 'Four days later Sherman issues Special Field Orders No. 15, and it reads like Frazier’s answer written into military law. "The islands from Charleston, south, the abandoned rice fields along the rivers for thirty miles back from the sea, and the country bordering the St. Johns river, Florida, are reserved and set apart for the settlement of the negroes now made free by the acts of war," it says; each family gets "not more than (40) forty acres of tillable ground," and in the new settlements "the sole and exclusive management of affairs" is left to the freed people themselves [ref:fssp-sfo15-text][ref:special-field-orders-15]. By September the Bureau officer running the settlements, Rufus Saxton, writes to his commissioner that he has "colonized some forty (40) thousand Freedmen, on forty (40) acre Tracts" [ref:fssp-saxton-1865]. They clear it. They plant it. They live on it.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_special_field_orders_15_1865',
    },
    {
      type: 'paragraph',
      text: 'Then the promise runs backward. That fall President Andrew Johnson starts pardoning the former owners, and his Freedmen’s Bureau circular provides that abandoned lands "may be restored to owners pardoned by the President" [ref:circular-15-1865]. In October the Bureau’s own commissioner, Oliver Otis Howard, travels to Edisto Island to tell the families there in person that the land under their feet is going back. They don’t take it standing quiet. They form a committee, and the committee writes to Howard and to the President, and it puts the case in one line: "General we want Homestead’s; we were promised Homestead’s by the government" [ref:fssp-edisto-petitions]. The land goes back anyway. Emancipation arrives and almost nothing changes hands: no land, no tools, no back pay for the years already worked. The same reconstruction puts 1870, the first benchmark year after slavery, at about twenty-one times [ref:dkks-wealth-of-two-nations]. Read quickly, that looks like enormous progress, fifty-six down to twenty-one inside a decade. Read it beside the record of what actually changed hands and it reads as the arithmetic of a starting line: freedom changed what could be counted, and nobody handed over a stake.',
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
      text: 'Whatever you manage to put aside after that, there’s one place you’re told to keep it. The Freedman’s Savings and Trust Company is chartered by Congress in the last months of the war, and it grows to thirty-seven branches across seventeen states and the District of Columbia [ref:nara-prologue-freedmans-bank]. What you hold is a passbook: your name and account number on the cover, the branch, a few pages of the bank’s rules, then the ledger lines of everything you’ve saved [ref:uga-freedmans-passbooks]. The National Archives’ records of who saved there read like a directory of every job the country would let you hold: farmers, laborers, cooks, janitors, nurses, porters, seamstresses, washers, blacksmiths, barbers, and alongside them churches and benevolent societies [ref:nara-prologue-freedmans-bank]. Across its life, an estimated seventy thousand depositors put in roughly fifty-seven million dollars [ref:nara-prologue-freedmans-bank].',
    },
    {
      type: 'paragraph',
      text: 'What the passbook can’t show you is what’s happening in Washington. In 1870 Congress amends the bank’s charter to let it put half of the deposits into riskier investments, a change the Comptroller of the Currency’s own history says opened the door to fraud, speculation, and mismanagement [ref:occ-freedmans-150th][ref:nara-prologue-freedmans-bank]. By that same account, the bank spends the next three years virtually controlled by Jay Cooke and Company, the financial house whose collapse then sets off the Panic of 1873 [ref:occ-freedmans-150th]. From here the record belongs to one man who went inside and wrote down what he saw. In March 1874, with depositors running on the branches, the trustees elect Frederick Douglass president, hoping his name can steady it [ref:nara-prologue-freedmans-bank]. He spends the first weeks, by his own account, "quietly employed in an effort to find out the real condition of the Bank and its numerous branches," and what the management shows him is encouraging enough that he then lends the bank ten thousand dollars of his own money to meet what he’s told is a temporary emergency [ref:docsouth-douglass-life-and-times]. The longer he looks, the less is there. He writes down what he finds: "The fact is, and all investigation shows it, that I was married to a corpse" [ref:docsouth-douglass-life-and-times]. He tells the Senate the bank is insolvent and ought to stop. On June 29, 1874, it closes, holding the accounts of 61,144 depositors, and the losses come to nearly three million dollars [ref:freedmans-savings-bank].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_freedmans_savings_bank_collapse_1874',
    },
    {
      type: 'paragraph',
      text: 'Getting anything back means mailing your passbook to Washington and waiting. About half of the depositors eventually recover roughly three-fifths of what they’d saved, and the rest get nothing. Some of their families keep petitioning Congress for more than thirty years [ref:nara-prologue-freedmans-bank]. That’s the route left once the branches are shut: no bank, no court, just a claim filed again and again against the government that chartered the thing. Meanwhile the decades that rarely make the story keep arriving, and the ratio keeps falling: about nineteen to one in 1880, just under fifteen to one in 1890, a bit over eleven to one by 1900 [ref:dkks-wealth-of-two-nations]. Every one of those numbers is better than the one before it, and every one of them is still a canyon. A ratio dropping from fifty-six to eleven across forty years is a population building from almost nothing, building fast, with the distance left to cover still enormous.',
    },

    // ---- Era 1921: Greenwood — buildup, trigger, burning, and what the record can say ----
    { type: 'heading', level: 2 as const, text: '1921 · What burns in two days' },
    {
      type: 'paragraph',
      text: 'By the spring of 1921, if you live in [[ent_greenwood_district_001|Greenwood]], the thirty-five square blocks on the north side of Tulsa that the country came to call Black Wall Street [ref:ohs-greenwood-district], you can walk past most of what a city needs without leaving the neighborhood. The state commission that later studied the district counted 191 Black-run businesses there in 1921, and alongside them fifteen physicians, two newspapers, schools, a hospital, a branch library [ref:tulsa-commission-2001]. The Dreamland Theatre seats 750. The Stradford Hotel has 54 rooms. Mount Zion Baptist Church, brick and new after years of saving, was dedicated on April 10 [ref:tulsa-commission-2001]. Among the doctors is A. C. Jackson, a surgeon one of the Mayo brothers had called, in a line the commission’s report preserves, the "most able Negro surgeon in America" [ref:tulsa-commission-2001].',
    },
    {
      type: 'paragraph',
      text: 'What ends all of it starts in an elevator. The shine parlor where nineteen-year-old Dick Rowland works has no toilet for its Black employees, so the owner has arranged for them to use a "Colored" restroom on the top floor of the Drexel Building nearby, reached by the building’s one elevator [ref:tulsa-commission-2001]. On Monday, May 30, Rowland rides it. The operator is Sarah Page, seventeen and white. A clerk in the store below hears what he takes for a scream, sees Rowland run, and calls the police. And there the record goes quiet. The commission found that no record exists of what Page actually told the police, and that the police themselves treated the matter as minor, opening what the report calls "a rather low-key investigation" [ref:tulsa-commission-2001]. The explanation the commission says was most common after the massacre is the ordinary one: Rowland tripped getting onto the elevator, grabbed Sarah Page’s arm to catch his fall, and she screamed [ref:tulsa-commission-2001].',
    },
    {
      type: 'paragraph',
      text: 'The next afternoon a newspaper turns an arrest into a countdown. Rowland is picked up on Tuesday, May 31, and held in the jail on the top floor of the county courthouse. That afternoon the Tulsa Tribune puts the story on its front page under the headline "Nab Negro for Attacking Girl in Elevator" [ref:tulsa-commission-2001]. Someone later tore that story, and nearly all of the editorial page, out of the bound city edition before it was microfilmed. The front-page text survives anyway. Loren Gill printed it whole in his 1946 master’s thesis on the riot, and a copy sits in the Red Cross papers held by the Tulsa Historical Society; a second copy, from the paper’s state edition, was once in the Oklahoma Historical Society’s collections and has since disappeared [ref:tulsa-commission-2001]. The editorial page never turned up. W. D. Williams remembered the Tribune running a piece that day titled "To Lynch Negro Tonight," and other people, Black and white, remembered the paper raising the possibility of a lynching; the commission concluded that what Williams recalled was most likely an editorial from the torn-out page [ref:tulsa-commission-2001]. What that page said can’t be settled now.',
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
      text: 'At 1:46 a.m. the police chief, the sheriff, and a district judge wire the governor: "Race riot developed here. Several killed. Unable handle situation. Request that National Guard forces be sent by special train. Situation serious" [ref:tulsa-commission-2001]. That’s the word the officials used, and it’s the word that stuck. What the commission documents over those same hours doesn’t flare and burn out. While the telegram moves, thousands of armed white men mass along the railroad tracks that separate Greenwood from white Tulsa, and a machine gun is hauled to the top of a grain elevator overlooking the district [ref:tulsa-commission-2001]. Dawn comes at 5:08. Witnesses remember a whistle or a siren, and then the crossing. Families are forced into the street at gunpoint and marched to Convention Hall and the fairgrounds; the commission counts more than four thousand people interned, the Tulsa Historical Society says more than six thousand, and the records don’t agree beyond that [ref:tulsa-commission-2001][ref:ths-1921-exhibit]. Houses are looted first and burned after. Dr. Jackson walks out of his home with his hands up, and is shot, and dies that day [ref:tulsa-commission-2001].',
    },
    {
      type: 'paragraph',
      text: 'State troops reach Tulsa at about 9:15 that morning, about four hours after the dawn assault and nearly eleven after the first shot, and martial law comes at 11:29 [ref:tulsa-commission-2001]. By then Greenwood is gone. The Red Cross count the commission preserves runs to 1,256 houses burned, along with virtually every other structure: the churches, the schools, the hospital, the library. Nearly nine thousand people are homeless [ref:tulsa-commission-2001]. Then a second wave arrives, on paper. Six days later the city passes a fire ordinance written to make rebuilding on the old ground too expensive to attempt. Greenwood’s own lawyers take it to court and get it struck down [ref:tulsa-commission-2001]. The insurers hold. They deny claim after claim under the "riot exclusion" clauses in their policies, and of more than a hundred lawsuits, not one succeeds [ref:tulsa-commission-2001]. A grand jury blames the massacre on the Black men who went to the courthouse. Did anyone go to prison for it? No white Tulsan ever did [ref:tulsa-commission-2001]. And in September, Sarah Page doesn’t appear to press charges, so the case against Dick Rowland, the spark for all of it, is quietly dismissed [ref:tulsa-commission-2001].',
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
      text: 'The nearest national benchmark, taken the following year, puts the country’s white-to-Black per-capita wealth ratio at about ten and a half to one [ref:dkks-wealth-of-two-nations]. That number is the country’s, not Greenwood’s. No wealth series in the record this chapter follows covers a single neighborhood, so the place gets named here and the number stays national. The reconstruction can tell you the size of the gap across a whole country in a benchmark year. It can’t tell you what the particular families who owned those thirty-five blocks lost, because no one built a series that small. The record is national by construction. The loss was local.',
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
      text: 'Fourteen years later the country starts building a safety net, and you can watch who it’s measured for in a single Saturday of testimony. On February 9, 1935, Charles Hamilton Houston of the NAACP tells the Senate Finance Committee what the pending economic security bill looks like from where he stands: "like a sieve with the holes just big enough for the majority of Negroes to fall through" [ref:senate-finance-1935]. By the Social Security Administration’s own later history, he’s the only witness in the hearings to speak against the exclusion at the bill’s center [ref:ssa-dewitt-2010]. The act passes that summer with the sieve intact. On its face it covers workers and says nothing about race. But when it defines covered employment it writes in two exceptions, "agricultural labor" and "domestic service in a private home" [ref:social-security-act-1935], and by the government’s own accounting those two categories held roughly two out of every three Black workers in the country in the mid-1930s [ref:ssa-dewitt-2010]. The program that would come to define a secure old age starts by leaving most Black workers outside it, and stays that way until the coverage amendments of 1950 and 1954 [ref:ssa-dewitt-2010].',
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
          'DeWitt concludes that the racial-bias thesis is "both conceptually flawed and unsupported by the existing empirical evidence," that the exclusion was due to considerations of administrative feasibility involving tax-collection procedures, and that he finds no evidence of any other policy motive involving racial bias.',
      },
      sideB: {
        sourceLabel: 'Robert C. Lieberman, Mary Poole, Ira Katznelson',
        claim:
          'Lieberman, Poole and Katznelson each argue the New Deal’s occupational exclusions were shaped by race. Whatever the stated reason, the two excluded categories held most Black workers, so the effect fell heavily and predictably along racial lines.',
      },
    },
    {
      type: 'paragraph',
      text: 'Nine years later the GI Bill does something similar by a different route. It’s an enormous asset-building program, college tuition and cheap loans for a home or a business, and on paper every veteran gets the same deal. But the money doesn’t come from Washington in a straight line. It runs through local banks, local colleges, and local Veterans Administration offices, and those institutions decide who actually gets served. The historian Ira Katznelson counted how that played out in the New York and northern New Jersey suburbs: 67,000 mortgages insured under the bill, and fewer than 100 of them supporting home purchases by people who weren’t white [ref:katznelson-affirmative-action]. The Roosevelt presidential library repeats his figure [ref:fdr-library-gi-bill]. Studying the education benefit, Turner and Bound found that for Black veterans confined to the segregated South the bill "had little effect on collegiate outcomes," and, for men from southern states, widened the Black-white education gap rather than closing it [ref:gi-bill-turner-bound].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_gi_bill_1944_local_administration',
    },
    {
      type: 'paragraph',
      text: 'Set the two laws beside each other and the common part is delivery. Neither statute says a word about race, and both were run through local banks, local colleges, local offices and local boards. A benefit written as universal and handed out through local institutions reaches as far as those institutions are willing to reach, which is how one program can look identical on paper and land differently depending on who’s standing at the counter.',
    },

    // ---- Era 1968–1972: after the rules changed ----
    { type: 'heading', level: 2 as const, text: '1970 · After the rules change' },
    {
      type: 'paragraph',
      text: 'You go looking for a house in 1970, and for the first time the law is on your side of the table. Dr. King is assassinated on April 4, 1968. Six days later the House passes the fair-housing bill, and on April 11 President Johnson signs it [ref:house-fair-housing-1968]. Its declaration of policy runs one sentence: "It is the policy of the United States to provide, within constitutional limitations, for fair housing throughout the United States" [ref:govinfo-fair-housing-3601]. Discrimination in selling, renting, and financing a home is illegal now, in writing.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_fair_housing_act_1968',
    },
    {
      type: 'paragraph',
      text: 'Two years later the census takes the first measurement of the new era. It counts about 42 Black families owning their home for every 100, against about 65 white families for every 100 [ref:census-historical-housing]. That’s a gap of more than twenty homes in every hundred, showing up after the rules changed rather than before. Homeownership carries more weight here than it might look like it should, because for most American families the house is where the wealth sits. Black households in particular hold nearly two thirds of their wealth in housing, and very little in stock [ref:dkks-wealth-of-two-nations].',
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
      text: 'The census income tape starts reporting white non-Hispanic households separately in 1972. That year a typical white non-Hispanic household brings in $64,730, in 2024 dollars, and a typical Black household brings in $37,250, which puts the white household at close to one and three-quarter times the Black household’s income [ref:census-h5-income-1972]. That’s a real gap, and it’s a far smaller one than the wealth gap sitting next to it. Income and wealth aren’t the same thing and they aren’t counted by the same survey, so this chapter keeps them apart. What you earn in a year and what your family has accumulated across generations are different questions with different answers.',
    },

    // ---- Present-day close: 2022 ----
    { type: 'heading', level: 2 as const, text: 'Today · You check your accounts' },
    {
      type: 'paragraph',
      text: 'You check your accounts in 2022. The Survey of Consumer Finances puts a typical Black family’s net worth at $44,900 and a typical white family’s at $285,000 [ref:scf-2022], a ratio of about six and a third to one. The long benchmark series, the one that reaches back to 1860 and counts per person rather than per household, ends in 2019 at about six and a half to one [ref:dkks-wealth-of-two-nations][ref:dkks-benchmark-series]. Those aren’t two readings of the same thing. They’re two different measures, set here side by side because each one covers a stretch of the record the other doesn’t reach.',
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
      text: 'Now put the whole run in order. Fifty-six to one at emancipation. Twenty-one by 1870, nineteen by 1880, eleven by 1900, about ten and a half in the 1920s. Then a long fall through the middle of the century, and then, around 1980, the falling stops. The Federal Reserve’s own researchers, working from the same Survey of Consumer Finances data, describe the period since 1989 as one where the racial wealth gap has persisted rather than closed [ref:scf-2022-fednote]. The line fell for a hundred years. Since about 1980 it’s stopped falling, and the economists who built the long series find it’s begun to widen again, as capital gains have gone mostly to white households and income convergence has stopped [ref:dkks-wealth-of-two-nations].',
    },
    {
      type: 'paragraph',
      text: 'In 1865 the country wrote the promise into a military order, that each family would get "not more than (40) forty acres of tillable ground" [ref:fssp-sfo15-text], and inside a year the land went back to the pardoned owners [ref:circular-15-1865]. In 1968 it wrote the promise into a statute, in one sentence, that fair housing throughout the United States is the policy of the United States [ref:govinfo-fair-housing-3601]. Two years after that sentence, about 42 Black families in every hundred owned their home against about 65 white families in every hundred [ref:census-historical-housing]. More than fifty years after it, the typical white family holds $285,000 against the typical Black family’s $44,900 [ref:scf-2022]. Those are the country’s own words, and the counting came later, done by economists working the record back to 1860 [ref:dkks-wealth-of-two-nations].',
    },
    {
      type: 'figure',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      metricIds: ['dkks-wealth-ratio-white-black-nation', 'scf-wealth-ratio-white-black-nation'],
      caption:
        'White-to-Black wealth ratio, United States, 1860–2022. Two distinct series, kept apart rather than spliced: the per-capita mean (1860–2019) and the household median (2022 shown; SCF runs triennially from 1989). The fall stops around 1980, and the authors of the long series find the gap widening again after that.',
    },
    {
      type: 'heading',
      level: 3 as const,
      text: 'What the two series measure, and what they don’t',
    },
    {
      type: 'paragraph',
      text: 'The long series isn’t a government count of anybody. Four economists, Ellora Derenoncourt, Chi Hyun Kim, Moritz Kuhn and Moritz Schularick, built it by working census, tax and survey records back to 1860, and published it in 2024 [ref:dkks-wealth-of-two-nations][ref:dkks-benchmark-series]. What it measures is non-Black wealth against Black wealth, per person, which the authors call the racial wealth gap because non-Black and white per-capita wealth track each other closely across the whole period [ref:dkks-wealth-of-two-nations]. It sits on benchmark years and ends in 2019, and the 1860 and 1870 readings sit over a denominator near zero for the newly freed population, so those two are single benchmark points rather than annual figures. The second series measures something else: median household net worth from the Survey of Consumer Finances, triennially from 1989 [ref:scf-2022]. The two are never averaged into one line. They’re placed side by side because they cover different spans and different constructs, and the fact that both stop converging after about 1980 is context rather than proof that either one explains the other.',
    },
    { type: 'heading', level: 3 as const, text: 'What people filed' },
    {
      type: 'paragraph',
      text: 'None of what’s above is a summary of what happened. It’s a set of things people did, each one dated, each one sitting in a federal archive, a university transcription project, or a state historical society right now. Twenty ministers picked Garrison Frazier to answer for them in Savannah, and his answer about land and their own labor went into the minutes and stayed there [ref:fssp-savannah-colloquy]. The families on Edisto Island formed a committee and put their claim to the President in writing [ref:fssp-edisto-petitions]. Frederick Douglass opened the bank’s books, told the Senate it was insolvent and ought to stop, and wrote what he found into his own memoir [ref:docsouth-douglass-life-and-times]. Depositors’ families kept petitioning Congress for more than thirty years after the branches shut [ref:nara-prologue-freedmans-bank]. Greenwood’s lawyers took the fire ordinance to court and got it struck down [ref:tulsa-commission-2001]. Charles Hamilton Houston sat in front of the Senate Finance Committee on February 9, 1935, and named the holes in the bill while it could still be changed [ref:senate-finance-1935]. The ratio was reconstructed long afterward, by people working from records like these. The record they made is their own.',
    },
    {
      type: 'timeline',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
    },
  ],
};

export default wealthGapArticle;
