/**
 * Anchoring chapter: "The Count" — the record itself as the subject. Every other
 * chapter on this surface follows one instrument (a deed, a ledger, a sentence
 * table). This one follows the pen: who was holding it, what it wrote down, and
 * what the writing did. It exists to close a specific misreading — that the
 * sheer volume of records about Black Americans is evidence of recognition.
 * The chapter shows the opposite, era by era: for most of American history the
 * record was made about Black people by the institutions counting, pricing,
 * grading, and listing them, and the parts of the archive written at Black
 * request, or in Black hands, are the thin, late, and revocable parts.
 *
 * Voice is governed by docs/content/neo-voice.md, Parts II–V, and by that
 * document alone: the three structural laws (open on a person in a place at a
 * time; every documented obstacle gets a documented, cited pathway; end on
 * cited agency without softening what came before), the era-beat structure
 * (second-person cold open, the rule in force quoted verbatim, odds as plain
 * comparisons, jump-cut), the cadence budgets as spent here (2 anaphora runs,
 * 2 call-and-response, 3 one-sentence paragraphs, 1 jeremiad turn in the
 * closing third, 1 reframing line, 1 closing flourish), and the truth
 * mechanics (claim typing, disputes shown side by side and left unresolved,
 * juxtaposition instead of causal verbs).
 *
 * Narrative facts follow docs/methodology/chapter-fact-validation.md: each fact
 * traces to two independent fetched sources, or to a named primary-record
 * holder attributed inside the sentence (the National Archives' own reference
 * report, the Commission on Civil Rights' own tables, the Court's own opinion).
 * Where the record disagrees with itself (the 1790 count of the enslaved, the
 * COINTELPRO field-office count, the Tulsa death toll), the disagreement is
 * shown, never resolved.
 *
 * As the anchoring chapter it deliberately binds across three published
 * theme-impact packets rather than one: tip_wealth_gap_gap_that_never_closed,
 * tip_buying_a_home_era, and tip_voting_rights_q12_national. Double-length by
 * design (roughly twice the 2,000-word floor). method_stance: juxtaposition
 * throughout — no causal claim is gated anywhere in this chapter.
 */

export const theCountArticle = {
  id: 'article_the_count',
  slug: 'the-count',
  title: 'Chapter: The Count',
  summary:
    'The United States has been writing Black people down since before it had a president: a fraction in the Constitution, a numbered line on a property schedule, a grade on a survey form, a name struck off a registration roll. The archive those records left behind is enormous, and for most of American history it’s the paperwork of being counted by somebody else. This chapter reads that archive in order, and marks the few places where the hand holding the pen changes.',
  eraLabel: '1787–present',
  placeLabel: 'United States',
  publishedAt: '2026-08-07',
  status: 'published' as const,
  heroImage: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Constitution_of_the_United_States_-_DPLA_-_9ca804144bd5965e992ae3528bc3c6a3_%28page_1%29.jpg',
    alt: 'The engrossed first page of the United States Constitution, September 17, 1787, carrying Article I, Section 2 and its "three fifths of all other Persons" apportionment clause.',
    credit:
      'Constitution of the United States, page 1, September 17, 1787. Work of the Constitutional Convention; U.S. government record, public domain (National Archives, via Digital Public Library of America / Wikimedia Commons).',
    rightsStatus: 'public_domain' as const,
    width: 7258,
    height: 8785,
  },
  relatedEntityIds: [
    'ent_case_dred_scott_v_sandford_1857',
    'ent_law_freedmens_bureau_act_1865',
    'ent_greenwood_district_001',
    'ent_law_voting_rights_act_1965',
    'ent_case_shelby_county_v_holder_2013',
  ],
  references: [
    {
      id: 'archives-constitution',
      label:
        'Constitution of the United States, Article I, Section 2; transcription, National Archives.',
      url: 'https://www.archives.gov/founding-docs/constitution-transcript',
    },
    {
      id: 'senate-constitution',
      label: 'Constitution of the United States, Article I, Section 2; text, U.S. Senate.',
      url: 'https://www.senate.gov/about/origins-foundations/senate-and-constitution/constitution.htm',
    },
    {
      id: 'census-1790-publication',
      label:
        'Return of the Whole Number of Persons within the Several Districts of the United States (1793), first census; U.S. Census Bureau library.',
      url: 'https://www.census.gov/library/publications/1793/dec/number-of-persons.html',
    },
    {
      id: 'census-1790-facts',
      label: 'U.S. Census Bureau, "1790 Fast Facts," decennial census history.',
      url: 'https://www.census.gov/programs-surveys/decennial-census/decade/decennial-facts.1790.html',
    },
    {
      id: 'census-twps0056',
      label:
        'Campbell Gibson and Kay Jung, "Historical Census Statistics on Population Totals by Race, 1790 to 1990," U.S. Census Bureau, Population Division Working Paper No. 56 (2002), Table 1.',
      url: 'https://www.census.gov/content/dam/Census/library/working-papers/2002/demo/POP-twps0056.pdf',
      locator: 'Table 1',
    },
    {
      id: 'nara-census-reference',
      label:
        'National Archives, reference report: "African Americans in the Federal Census, 1790–1930."',
      url: 'https://www.archives.gov/files/research/census/african-american/census-1790-1930.pdf',
    },
    {
      id: 'pmc-census-history',
      label:
        'Peer-reviewed history of U.S. census racial enumeration (PMC7716878), on the 1790 and 1860 counts of the enslaved.',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7716878/',
    },
    {
      id: 'dred-scott-us-reports',
      label:
        'Dred Scott v. Sandford, 60 U.S. (19 How.) 393 (1857); official United States Reports, Library of Congress.',
      url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep060/usrep060393a/usrep060393a.pdf',
      locator: '60 U.S. 404, 407',
    },
    {
      id: 'archives-dred-scott',
      label: 'National Archives, Milestone Documents, "Dred Scott v. Sandford (1857)."',
      url: 'https://www.archives.gov/milestone-documents/dred-scott-v-sandford',
    },
    {
      id: 'nps-1860-slave-schedule',
      label:
        'National Park Service, "United States Census Slave Schedule for St. Louis County, 1860" — how Schedule 2 recorded enslaved people under the slaveholder’s name, without their own.',
      url: 'https://www.nps.gov/articles/000/united-states-census-slave-schedule-for-st-louis-county-1860.htm',
    },
    {
      id: 'census-1860-publication',
      label:
        'Population of the United States in 1860, compiled from the original returns of the Eighth Census (1864); U.S. Census Bureau library.',
      url: 'https://www.census.gov/library/publications/1864/dec/1860a.html',
    },
    {
      id: 'special-field-orders-15',
      label:
        'Special Field Orders, No. 15 (Sherman, Jan. 16, 1865); Freedmen and Southern Society Project transcription, University of Maryland.',
      url: 'https://www.freedmen.umd.edu/sfo15.htm',
    },
    {
      id: 'fssp-savannah-colloquy',
      label:
        'Minutes of the meeting between Black religious leaders and Union military authorities, Savannah, Jan. 12, 1865 (published New-York Daily Tribune, Feb. 13, 1865); Freedmen and Southern Society Project transcription, University of Maryland.',
      url: 'https://www.freedmen.umd.edu/savmtg.htm',
    },
    {
      id: 'fssp-edisto-petitions',
      label:
        'Committee of Freedmen on Edisto Island to Freedmen’s Bureau Commissioner O. O. Howard, and petition to President Andrew Johnson, Oct. 1865; Freedmen and Southern Society Project transcription.',
      url: 'https://www.freedmen.umd.edu/Edisto%20petitions.htm',
    },
    {
      id: 'nara-freedmens-bureau',
      label:
        'National Archives, "The Freedmen’s Bureau," Records of the Bureau of Refugees, Freedmen, and Abandoned Lands (Record Group 105).',
      url: 'https://www.archives.gov/research/african-americans/freedmens-bureau',
    },
    {
      id: 'nara-freedmen-marriage',
      label: 'National Archives, Prologue (Spring 2005), "Freedmen’s Bureau Marriage Records."',
      url: 'https://www.archives.gov/publications/prologue/2005/spring/freedman-marriage-recs.html',
    },
    {
      id: 'nara-freedmans-bank-rr124',
      label:
        'National Archives, reference report: "The Freedman’s Savings and Trust Company," Registers of Signatures of Depositors (M816), Record Group 101.',
      url: 'https://www.archives.gov/files/research/african-americans/freedmens-bureau/freedmens-bank.pdf',
    },
    {
      id: 'occ-freedmans-bank',
      label:
        'Office of the Comptroller of the Currency, "The Freedman’s Savings Bank: Good Intentions Were Not Enough."',
      url: 'https://www.occ.gov/about/who-we-are/history/history-of-the-occ/1863-1865/1863-1865-freedmans-savings-bank.html',
    },
    {
      id: 'nara-prologue-freedmans-bank',
      label:
        'National Archives, Prologue (Summer 1997), "The Freedman’s Savings and Trust Company and African American Genealogical Research."',
      url: 'https://www.archives.gov/publications/prologue/1997/summer/freedmans-savings-and-trust.html',
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
      id: 'loc-tulsa-newspapers',
      label:
        'Library of Congress, Headlines & Heroes, "Tulsa Race Massacre: Newspaper Complicity and Coverage" (2021).',
      url: 'https://blogs.loc.gov/headlinesandheroes/2021/05/tulsa-race-massacre-newspaper-complicity-and-coverage/',
    },
    {
      id: 'church-committee-b3',
      label:
        'Senate Select Committee to Study Governmental Operations with Respect to Intelligence Activities (Church Committee), Final Report, Book III (1976); Senate Select Committee on Intelligence.',
      url: 'https://www.intelligence.senate.gov/sites/default/files/94755_III.pdf',
      locator: 'COINTELPRO report, pp. 3–20; King case study, p. 79',
    },
    {
      id: 'archives-hsca-cointelpro',
      label:
        'House Select Committee on Assassinations, Final Report, Part 2(d), on FBI COINTELPRO and Dr. King; National Archives.',
      url: 'https://www.archives.gov/research/jfk/select-committee-report/part-2d.html',
    },
    {
      id: 'usccr-msdelta',
      label:
        'U.S. Commission on Civil Rights, "Racial and Ethnic Tensions in American Communities: The Mississippi Delta Report" (2001), chapter 3, on voter registration under the Reconstruction Acts of 1867.',
      url: 'https://www.usccr.gov/files/pubs/msdelta/ch3.htm',
    },
    {
      id: 'house-historian-reconstruction',
      label:
        'U.S. House of Representatives, Office of the Historian, "Black Americans in Congress: Reconstruction and Black Political Activism."',
      url: 'https://history.house.gov/Exhibitions-and-Publications/BAIC/Historical-Essays/Fifteenth-Amendment/Reconstruction/',
    },
    {
      id: 'usccr-2018-voting',
      label:
        'U.S. Commission on Civil Rights, "An Assessment of Minority Voting Rights Access in the United States" (2018), Table 1 and findings.',
      url: 'https://www.usccr.gov/files/pubs/2018/Minority_Voting_Access_2018.pdf',
      locator: 'Table 1; pp. 23, 82, 176',
    },
    {
      id: 'vra-1965-statute',
      label:
        'Voting Rights Act of 1965, Public Law 89-110, 79 Stat. 437; Sections 4–7. U.S. Government Publishing Office.',
      url: 'https://www.govinfo.gov/content/pkg/STATUTE-79/pdf/STATUTE-79-Pg437.pdf',
      locator: 'secs. 4–7',
    },
    {
      id: 'doj-history-voting',
      label:
        'U.S. Department of Justice, Civil Rights Division, "History of Federal Voting Rights Laws."',
      url: 'https://www.justice.gov/crt/history-federal-voting-rights-laws',
    },
    {
      id: 'shelby-us-reports',
      label:
        'Shelby County v. Holder, 570 U.S. 529 (2013); official United States Reports, Library of Congress.',
      url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep570/usrep570529/usrep570529.pdf',
      locator: '570 U.S. 536',
    },
    {
      id: 'doj-section5',
      label:
        'U.S. Department of Justice, Civil Rights Division, "About Section 5 of the Voting Rights Act."',
      url: 'https://www.justice.gov/crt/about-section-5-voting-rights-act',
    },
    {
      id: 'nara-holc-area-description',
      label:
        'Home Owners’ Loan Corporation, "Area Description," NS Form-8 (rev. 6-1-37), front and printed instructions on reverse; Record Group 195, National Archives at College Park.',
      url: 'https://catalog.archives.gov/id/326761289',
      locator: 'Charlotte, N.C., Security Map and Area Description No. 1',
    },
    {
      id: 'dkks-wealth-of-two-nations',
      label:
        'Ellora Derenoncourt, Chi Hyun Kim, Moritz Kuhn, and Moritz Schularick, "Wealth of Two Nations: The U.S. Racial Wealth Gap, 1860–2020," benchmark-year white-to-Black per-capita wealth ratio.',
      url: 'https://www.elloraderenoncourt.com/us-inequality-data',
    },
    {
      id: 'scf-2022',
      label:
        'Board of Governors of the Federal Reserve System, Survey of Consumer Finances, 2022, median household net worth by race.',
      url: 'https://www.federalreserve.gov/econres/scfindex.htm',
    },
  ],
  body: [
    // ---- Era 1790: the fraction, and the ledger it fills ----
    { type: 'heading', level: 2 as const, text: '1790 · A ledger open on his knee' },
    {
      type: 'paragraph',
      text: 'The man on the horse doesn’t get down. It’s 1790, the first census is being taken, and the marshal’s assistant riding out through the district has a ledger open on his knee and a handful of columns to fill: free white males of sixteen and over, free white males under sixteen, free white females, "all other free persons," and "slaves" [ref:census-1790-publication]. If you’re held in slavery, he doesn’t ask your name. There’s no column on the page for it. The National Archives’ guide to these records says it flat: the census "lists slaves statistically under the owner’s name" [ref:nara-census-reference].',
    },
    {
      type: 'paragraph',
      text: 'The rule he’s working under got written three years earlier, and it never says who it’s about. Article I, Section 2 of the Constitution hands out representation and direct taxes by population, and then it says what the population is: "the whole Number of free Persons, including those bound to Service for a Term of Years, and excluding Indians not taxed, three fifths of all other Persons" [ref:archives-constitution][ref:senate-constitution]. You’re the other persons. The sentence doesn’t use the word slave, or the word Black, or any word at all for what you actually are. It doesn’t need to. Everyone drafting it knows who the fraction is for, and the drafting is careful because the thing being drafted is meant to last. Your first appearance in the founding record is as a number that makes other people’s votes count for more.',
    },
    {
      type: 'paragraph',
      text: 'That year the country counts 3,929,214 people [ref:census-1790-facts]. By the Census Bureau’s own historical tables, 697,681 of them are held in slavery; a peer-reviewed demographic history of the same census puts the figure at 697,624 [ref:census-twps0056][ref:pmc-census-history]. Both numbers are still in print. Neither one is a list of names.',
    },
    {
      type: 'paragraph',
      text: 'The results come out in 1793 under a title worth reading slowly: "Return of the Whole Number of Persons within the Several Districts of the United States" [ref:census-1790-publication]. The whole number of persons. The book that turns you into an unnamed tally inside another man’s household still calls you a person on its cover, because the fraction needs you to be one. Three fifths of a chair apportions nothing. You’ll hear that the fraction was a ceiling, that the number could’ve been five fifths and that slaveholding delegates wanted it to be. As bargaining, that’s a real reading. As arithmetic, the clause still adds you to the count of the state that holds you, on a scale you never chose, and not one unit of that power runs through you [ref:archives-constitution][ref:senate-constitution]. That’s the doubleness the count carries from the start: it can’t afford to deny outright that you’re a person, because your personhood is what it’s harvesting. It needs you to exist exactly enough to be counted, and not one entry more.',
    },
    {
      type: 'paragraph',
      text: 'A government has now made a record about you, for its own purposes, with real consequences riding on it, and it never needed your name or wanted your answer to get what it wanted. That census survives, and it recognizes nobody it never asked to recognize. Seventy years later the highest record-keeper in the country is asked to say what records like it mean.',
    },

    // ---- Era 1857: the record rules on you ----
    { type: 'heading', level: 2 as const, text: '1857 · The record rules on who you are' },
    {
      type: 'image',
      image: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/4/48/Dred_Scott_photograph_%28circa_1857%29.jpg',
        alt: 'A photographic portrait of Dred Scott, taken around 1857, the year the Supreme Court ruled that he couldn’t be a citizen entitled to sue in federal court.',
        credit:
          'Dred Scott, photograph, circa 1857. Public domain (Library of Congress Prints and Photographs Division, via Wikimedia Commons).',
        rightsStatus: 'public_domain' as const,
        width: 2017,
        height: 2598,
      },
      caption:
        'DRED SCOTT, PLAINTIFF, ST. LOUIS, MISSOURI, CIRCA 1857. The photograph dates to about the year the Court ruled on the case that carried his name.',
    },
    {
      type: 'paragraph',
      text: 'Dred Scott is in St. Louis and the case with his name on it is in Washington. Held in slavery in Missouri, he sued for his freedom on the ground that his enslaver took him to live for years on free soil, and the suit ran into a threshold question before it could reach that one. Can a Black man be a citizen entitled to sue in a federal court at all? The Court says no. On March 6, 1857, in [[ent_case_dred_scott_v_sandford_1857|Dred Scott v. Sandford]], Chief Justice Roger Taney reads the answer out [ref:archives-dred-scott]. "We think they are not," the opinion says of Black Americans and the Constitution’s word citizens, "and that they are not included, and were not intended to be included, under the word ‘citizens’ in the Constitution, and can therefore claim none of the rights and privileges which that instrument provides for and secures to citizens of the United States" [ref:dred-scott-us-reports].',
    },
    {
      type: 'paragraph',
      text: 'Start with the part of that record that’s his. The case sits in the United States Reports because he put it there. A man held as property carried a claim into a federal court, and the refusal had to be written down and printed to answer him [ref:archives-dred-scott].',
    },
    {
      type: 'paragraph',
      text: 'To get to the refusal, Taney does what a record-keeper does. He reads the old records back. The opinion surveys the founding era and reports what it finds there, that Black people "had for more than a century before been regarded as beings of an inferior order," and "so far inferior, that they had no rights which the white man was bound to respect" [ref:dred-scott-us-reports]. He offers that as history, the fixed opinion of an earlier age, and then rules that the Constitution has to be read by its light. Read the method and you can watch the archive cite itself: the most consequential legal record of the decade about Black Americans is built out of earlier records, none of which any Black person was permitted to write, and the silence in those records is taken as proof about the people missing from them.',
    },
    {
      type: 'paragraph',
      text: 'The National Archives’ summary of the case states the rest of the holding in two clean strokes: the Court ruled that enslaved people weren’t citizens and couldn’t sue in federal court, and that Congress had no authority to ban slavery from a federal territory [ref:archives-dred-scott]. The second stroke matters here as much as the first. The Missouri Compromise line was a kind of national record too, a boundary written in 1820 that sorted the map into ground where the property schedules ran and ground where they didn’t. The Court erases it. After March 1857 there’s no line on the federal map that the schedule can’t, in principle, cross.',
    },
    {
      type: 'paragraph',
      text: 'The ruling also settles what the count you appear in can never do for you. Living on free soil doesn’t free you. The census of a free state may write you down, and no amount of paper makes you a person the federal courts can hear. Three years later the marshals go out again with their schedules, and the ruling rides along with every form.',
    },

    // ---- Era 1860: the schedule ----
    { type: 'heading', level: 2 as const, text: '1860 · A line without a name' },
    {
      type: 'paragraph',
      text: 'It’s the summer of 1860 and you’re standing in the yard while a man writes a number where your name would go. Since 1850 the census has taken down every free person in a household by name, white and nonwhite alike [ref:nara-census-reference]. You go on a different form. Schedule 2, "Slave Inhabitants," is organized by the name of the person who holds you, and the National Archives’ guide preserves the instruction behind it: "census takers were instructed to substitute numbers in place of names on the slave schedules" [ref:nara-census-reference]. What the form keeps about you is a number in a column, a color, a sex, an age, and whether you are, in its own categories, "deaf, dumb, blind, insane, or idiotic" [ref:nara-census-reference]. The National Park Service, describing one surviving schedule from St. Louis County, notes that a researcher reading it today sees the owners’ names in full and the people they held only as entries underneath [ref:nps-1860-slave-schedule].',
    },
    {
      type: 'paragraph',
      text: 'Read the rest of the columns and you can reconstruct the mind that drew the form. Past color, sex, and age, the National Archives’ guide lists what else each owner’s block of lines records: the number of people the form calls fugitives from the state, and the number manumitted [ref:nara-census-reference]. Two doors out, tracked as carefully as age. Read that first column again and the thing it’s counting is people leaving. There’s no column for family. A husband and wife held on the same farm show up as two lines with nothing connecting them, and their children are lines with smaller ages. The census of 1850 had asked the free population about occupation, birthplace, schooling, and literacy, and none of those questions crosses onto Schedule 2 [ref:nara-census-reference]. A record is a list of the questions its makers thought worth asking. This one thought escape worth asking about, and marriage not.',
    },
    {
      type: 'paragraph',
      text: 'That summer the marshals count 3,953,760 people this way [ref:census-twps0056][ref:pmc-census-history]. Nearly four million lines, each one a person, almost none of them carrying a name. Alongside them the same count finds 488,070 free people it classes as colored [ref:census-twps0056][ref:census-1860-publication]. Set the two against each other and the proportions of the record come clear: for every Black American the government wrote down as a named person that year, it wrote down about eight as numbered property. Reconstructing national wealth by race, Derenoncourt, Kim, Kuhn, and Schularick put the 1860 white-to-Black per-capita ratio at about fifty-six to one [ref:dkks-wealth-of-two-nations]. Read them together and the schedule and the ratio are two notations for the same structure: one an inventory, the other a quotient of what that inventory bought.',
    },
    {
      type: 'figure',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      metricIds: ['dkks-wealth-ratio-white-black-nation'],
      caption:
        'White-to-Black per-capita wealth ratio, United States, benchmark years 1860–2019 (Derenoncourt, Kim, Kuhn & Schularick). The 1860 reading is taken while nearly four million people are themselves counted as wealth.',
    },

    // ---- Era 1865: names enter the file ----
    { type: 'heading', level: 2 as const, text: '1865 · Your name enters the file' },
    {
      type: 'paragraph',
      text: 'On the twelfth of January, 1865, in a house in Savannah, twenty Black ministers and church officers sit down with the Secretary of War and General Sherman, and a clerk takes minutes. The men choose Garrison Frazier to answer for them, a Baptist minister who bought freedom for himself and his wife with a thousand dollars in gold and silver. Asked what his people need, he answers, and the answer goes into the record in his own words: "The way we can best take care of ourselves is to have land, and turn it and till it by our own labor" [ref:fssp-savannah-colloquy]. Question by question, the minutes hold a thing two and a half centuries of American paper almost never holds. Black men are asked on the record what they want, and the answers are written down as given.',
    },
    {
      type: 'paragraph',
      text: 'Four days later Sherman answers the meeting with Special Field Orders No. 15, setting aside the coastal land for settlement by the freed people, and inside the year President Johnson’s pardons send that land back to the men who held it before the war [ref:special-field-orders-15]. The land goes. The paper stays. Notice how rare the document’s shape is, an interview instead of an inventory, and how short its season was.',
    },
    {
      type: 'paragraph',
      text: 'That fall, with the promised land going back to pardoned Confederates, the freedpeople of Edisto Island answer the government in writing. Their own committee drafts the petition: "General we want Homestead’s; we were promised Homestead’s by the government" [ref:fssp-edisto-petitions]. The petition fails and the land goes back. The paper survives in the federal file, misspellings and all, and it belongs to a small class of documents worth keeping separate in your head: records that exist because Black people forced them into existence. Hold the two kinds of paper side by side, the schedule that numbered you and the petition you signed. The whole archive divides on that line.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_savannah_colloquy_1865',
    },
    {
      type: 'paragraph',
      text: 'The same season builds the machinery. On March 3, 1865, the [[ent_law_freedmens_bureau_act_1865|Freedmen’s Bureau Act]] sets up the Bureau of Refugees, Freedmen, and Abandoned Lands inside the War Department [ref:nara-freedmens-bureau]. The bureau issues rations, runs hospitals and camps, and supervises labor contracts between planters and the people who used to be their property, and all of it makes paper. The National Archives describes what that paper holds: records "rich with names and personal information," marriage certificates, labor contracts, school records, complaints, requests for legal aid and protection, land applications, trial summaries [ref:nara-freedmens-bureau]. Every item on that list is a transaction somebody walked in and started. A federal file has your name at the top of it because you gave it.',
    },
    {
      type: 'paragraph',
      text: 'Some of what gets written down had been unwritable. A marriage between enslaved people had no legal standing anywhere in the South, and the bureau’s commissioner directs that "in places where the local statutes make no provisions for the marriage of persons of color, the assistant commissioners are authorized to designate officers who shall keep a record of marriages" [ref:nara-freedmen-marriage]. Couples who had lived as husband and wife for decades line up to get the fact of their own families into a register. The Archives’ account says the registers were kept in part "to assist in identifying couples, resolve future questions involving inheritance, and to settle claims against the federal government" [ref:nara-freedmen-marriage]. Read those registers for what they are, and it isn’t a government discovering that Black families existed. It’s families taking the first machinery that would let their existence count.',
    },
    {
      type: 'paragraph',
      text: 'The same season produces a bank. The Freedman’s Savings and Trust Company, chartered the same day as the bureau, grows to dozens of branches, and across nine years it serves some seventy thousand depositors [ref:nara-freedmans-bank-rr124][ref:occ-freedmans-bank]. To open an account you sit for the register of signatures, and the questions run long: your name, where you were born, where you were brought up, your family, your employer. The National Archives’ report on the registers notes that "some early volumes also identify the name of the depositor’s former owner and the name of the plantation" [ref:nara-freedmans-bank-rr124]. Think about what that line is doing. A man walks into a bank as a customer and gives, as identifying detail, the name of the man who five years earlier held him as a line on Schedule 2. The schedule wrote the owner and numbered the owned. The register writes the depositor and demotes the owner to a field on his form.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_freedmans_savings_bank_collapse_1874',
    },
    {
      type: 'paragraph',
      text: 'The bank fails, and it fails from above. In 1870 Congress amends the charter to let the trustees put half the deposits into riskier investments, a change the Comptroller of the Currency’s history says opened the door to speculation and mismanagement, and in the crash that follows the Panic of 1873 the depositors’ money is gone from the vaults before most of them hear a word [ref:occ-freedmans-bank][ref:nara-prologue-freedmans-bank]. In March 1874 the trustees hand the presidency to Frederick Douglass, hoping his name will steady the run [ref:occ-freedmans-bank][ref:nara-prologue-freedmans-bank]. He goes through the books and writes down what he found: "I was married to a corpse" [ref:docsouth-douglass-life-and-times]. When the doors close that June, 61,144 depositors are left holding losses of nearly three million dollars, and about half of them eventually get back, in the Archives’ own accounting, roughly three fifths of the value of their accounts. The rest get nothing [ref:occ-freedmans-bank][ref:nara-prologue-freedmans-bank]. What survives whole is the paperwork. The registers of signatures sit in the National Archives, and genealogists work them name by name, because for hundreds of thousands of families the account book of a failed bank is the first place an ancestor speaks in his own words [ref:nara-freedmans-bank-rr124][ref:nara-prologue-freedmans-bank]. The money was lost and the names were kept.',
    },
    {
      type: 'paragraph',
      text: 'One more record from the decade, and it’s the largest. The 1870 census, the first taken after the war, is the first to enumerate the formerly enslaved like everyone else, and the National Archives calls it "often the first official record of a surname for former slaves" [ref:nara-census-reference]. Four million people cross, in a single count, from the property schedule to the population schedule.',
    },
    {
      type: 'paragraph',
      text: 'It took a war, three amendments, and eighty years of counting before a name went on the page.',
    },
    {
      type: 'pullquote',
      text: 'The money was lost and the names were kept.',
    },

    // ---- Era 1898: the rolls are cut ----
    { type: 'heading', level: 2 as const, text: '1898 · Your name comes off the rolls' },
    {
      type: 'primaryDocument',
      packetId: 'tip_voting_rights_q12_national',
      refId: 'art_15th_amendment_nara',
    },
    {
      type: 'paragraph',
      text: 'A name a record put on can be taken off by a record. It’s the 1890s in Louisiana, and your name on the registration rolls makes you one of a hundred and thirty thousand Black men entitled to vote, a force big enough to decide the state. The rolls themselves are Reconstruction’s paperwork. In 1867 Congress had made registration a condition of the South’s readmission and put the registering in federal military hands, and the Commission on Civil Rights’ own history counts approximately 700,000 Black men, most of them held in slavery a few years earlier, going onto the rolls under those acts [ref:usccr-msdelta]. By 1877, in the House Historian’s count, roughly 2,000 Black men held local, state, and federal office across the South [ref:house-historian-reconstruction]. Every one of those names got there one at a time, by a man walking into a registrar’s office. In that state, as the federal Commission on Civil Rights records, violence met the people who tried to register [ref:usccr-2018-voting]. Then the state rewrites its registration rules. The instruments of the era, as the commission catalogues them, are poll taxes, literacy tests, and grandfather clauses "excluding prior (white) registrants from the new strict rules" [ref:usccr-2018-voting]. No mob is needed for what follows, and no fire. The rolls simply shrink each year as the new paperwork does its work. The commission carries the result in one sentence: "In Louisiana, where more than 130,000 black voters had been registered in 1896, the number had plummeted to 1,342 by 1904" [ref:usccr-2018-voting].',
    },
    {
      type: 'paragraph',
      text: 'Sit with the shape of that instrument for a moment. Disfranchisement here isn’t a man at the courthouse door with a gun, though the era had those too. It’s a registrar with a form, applying requirements that read as neutral and carry an exemption drafted around a birth date. The same machinery that once counted you as three fifths and then declined to write your name now writes it precisely, checks it against a test your grandfather’s status decides, and strikes it. Across the South the pattern repeats state by state, and the registration ledgers, kept carefully the whole time, become the record of their own emptying. None of it was hidden. The numbers ran in print.',
    },

    // ---- Era 1921: the record burns, and then accuses ----
    { type: 'heading', level: 2 as const, text: '1921 · The record burns, and then accuses' },
    {
      type: 'paragraph',
      text: 'What the record gives, the record can be made to take back, and in Tulsa you can watch it happen to the pages themselves. On the afternoon of May 31, 1921, the Tulsa Tribune puts a nineteen-year-old shoeshine named Dick Rowland on its front page under the headline "Nab Negro for Attacking Girl in an Elevator" [ref:loc-tulsa-newspapers]. By the next night a white mob has crossed the tracks into [[ent_greenwood_district_001|Greenwood]], the thirty-five blocks later known across the country as Black Wall Street, and by the morning of June 1 the district is ash: the churches, the schools, the hospital, the library, and more than a thousand houses [ref:tulsa-commission-2001]. That’s the massacre. What happens to the paper afterward is quieter, and in some ways stranger.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_tulsa_tribune_1921_nab_negro',
    },
    {
      type: 'paragraph',
      text: 'Survivors remembered that same day’s Tribune carrying an editorial headed "To Lynch Negro Tonight." No copy exists. Someone tore the story and nearly all of the editorial page out of the bound file of that day’s edition before it was microfilmed, so the front page survives only through a 1946 transcription and a reprint, and the editorial survives only in the memory of the people who described reading it [ref:tulsa-commission-2001][ref:loc-tulsa-newspapers]. Think about what that torn place in the file is. For every earlier era in this chapter, the trouble with the record was what it wrote about you. This time the record was edited afterward, by a hand nobody has named, at the exact page where it might have documented who called for the killing.',
    },
    {
      type: 'paragraph',
      text: 'The removal is part of the record now, a hole with a date.',
    },
    {
      type: 'paragraph',
      text: 'Then the surviving machinery of record turns on the survivors. A grand jury is empaneled, and its report blames the massacre on the Black men who had gone to the courthouse to stop a lynching [ref:tulsa-commission-2001]. Insurers deny claim after claim under policy clauses excluding what they classified, in the record’s own word, as "riot" losses, and Greenwood residents and property owners file more than a hundred suits, of which not one succeeds [ref:tulsa-commission-2001]. Official figures at the time put the toll at thirty-six. The state commission that reopened the file eighty years later wrote that the exact total can never be determined, and that credible evidence makes it probable the dead numbered between one hundred and three hundred [ref:tulsa-commission-2001]. That commission, reporting in 2001, is the state of Oklahoma going back through its own ledgers, its own newspapers, and its own grand jury report, and writing down what the earlier records did and hid [ref:tulsa-commission-2001]. It took eighty years for the file to be reopened, and the people who could have answered its questions had spent most of that time dying without being asked.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_tulsa_race_riot_commission_2001',
    },

    // ---- Era 1937: the form asks about you ----
    { type: 'heading', level: 2 as const, text: '1937 · The form asks about you, not for you' },
    {
      type: 'paragraph',
      text: 'You’ve moved north, and the counting follows you into the city. In the late 1930s a federal surveyor works through the neighborhoods of more than two hundred cities with a printed sheet, NS Form-8, "Area Description," grading each area for mortgage security. Item 5 of the form is headed "Inhabitants," and its fifth line reads "d. Negro (Yes or No)," followed by a percentage. The printed instructions on the back ask whether there is "any threat of infiltration of foreign born, negro or lower grade population," and supply the wording to use: "indicate these by nationality and rate of infiltration like this: ‘Negro - rapid’" [ref:nara-holc-area-description]. Does the form ask you anything? It doesn’t ask you anything. It asks about you, in the third person, so your presence on a block can be entered as a hazard to somebody else’s collateral [ref:nara-holc-area-description]. The grade attaches to the address instead of the applicant, so it’s settled before you say a word about yourself [ref:nara-holc-area-description].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_holc_ns_form8_area_description_1937',
    },
    {
      type: 'paragraph',
      text: 'By 1937 the federal government has been writing Black Americans down for a hundred and fifty years. It adds up to a fraction, six censuses of household tallies, two censuses of numbered lines, a war’s worth of bureau registers, forty years of shrinking rolls, and now a grade on a block.',
    },

    // ---- Era 1965: the list restored ----
    { type: 'heading', level: 2 as const, text: '1965 · A federal examiner writes your name' },
    {
      type: 'image',
      image: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Lyndon_Johnson_and_Martin_Luther_King%2C_Jr._-_Voting_Rights_Act.jpg',
        alt: 'President Lyndon Johnson signs the Voting Rights Act on August 6, 1965, at the United States Capitol, with Martin Luther King Jr. and other civil rights leaders present.',
        credit:
          'Photograph by Yoichi Okamoto, August 6, 1965. Lyndon Baines Johnson Library and Museum, image serial number A1030-17a. U.S. government work, public domain.',
        rightsStatus: 'public_domain' as const,
        width: 2000,
        height: 1339,
      },
      caption:
        'PRESIDENT LYNDON B. JOHNSON, WASHINGTON, D.C., AUGUST 6, 1965. The day a federal examiner’s pen was authorized to write your name onto the rolls.',
    },
    {
      type: 'paragraph',
      text: 'It takes until August 6, 1965, for the machinery of listing to run the other way. The [[ent_law_voting_rights_act_1965|Voting Rights Act]], signed that day, is built out of the same materials as the laws it breaks: coverage formulas, determinations, lists. Section 4 reaches any state or county that kept a test or device on November 1, 1964, and where the Director of the Census determines either "that less than 50 per centum of the persons of voting age residing therein were registered on November 1, 1964," or "that less than 50 per centum of such persons voted in the presidential election of November 1964" [ref:vra-1965-statute]. Section 5 freezes those places’ election laws, so no change takes effect without federal signoff [ref:vra-1965-statute][ref:doj-history-voting]. Sections 6 and 7 put the pen directly in a federal hand: examiners are appointed "to prepare and maintain lists of persons eligible to vote in Federal, State, and local elections," and "any person whose name appears on the examiner’s list shall be entitled and allowed to vote" [ref:vra-1965-statute]. For the first time since Reconstruction, a federal officer’s job is to write your name down so that the writing itself protects you.',
    },
    {
      type: 'paragraph',
      text: 'The instrument the act breaks is preserved too. A literacy test from Alabama, the kind a registrar could set in front of you in 1965 and grade however the day required, survives in the record and is reproduced below. It needs no commentary. It’s a form, like the others here, and by now you know how to read a form. Look at what it asks, and ask who the asking serves.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_voting_rights_q12_national',
      refId: 'art_alabama_literacy_test_1965',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_voting_rights_q12_national',
      refId: 'art_voting_rights_act_1965_sec4_sec5',
    },
    {
      type: 'paragraph',
      text: 'Mississippi is where the new instrument bites hardest, because Mississippi is where the old one cut deepest. In November 1964, by the Commission on Civil Rights’ own tables, about 28,500 Black Mississippians of voting age are registered, roughly one eligible person in fifteen. By September 1967 it’s more than a quarter million, roughly three in five [ref:usccr-2018-voting]. The commission calls its own figures estimates drawn from official and unofficial sources, varying widely in accuracy, and that caution is worth carrying [ref:usccr-2018-voting]. No reading of those two numbers puts them on the same order of magnitude.',
    },
    {
      type: 'stat',
      packetId: 'tip_voting_rights_q12_national',
      kind: 'observation' as const,
      refId: 'usccr-black-registration-rate-state:state:28:1964',
      caption:
        'Black voter registration rate, Mississippi, 1964, before the Voting Rights Act (Commission on Civil Rights estimate).',
    },
    {
      type: 'stat',
      packetId: 'tip_voting_rights_q12_national',
      kind: 'observation' as const,
      refId: 'usccr-black-registration-rate-state:state:28:1967',
      caption:
        'Black voter registration rate, Mississippi, 1967, two years after the Voting Rights Act (Commission on Civil Rights estimate).',
    },
    {
      type: 'paragraph',
      text: 'The commission also counts what the examiners themselves wrote: by 1967, federal examiners authorized under the act had registered more than 150,000 Black southerners directly, name by name, in the counties where the local registrar’s office had been the wall [ref:usccr-2018-voting]. The Justice Department’s own history describes the same mechanism, an examiner reviewing the qualifications of people who came in wanting to register, in counties the Attorney General designated [ref:doj-history-voting]. Be precise about how narrow that was. Nobody rewrote the state’s books, and nothing was paid back for the sixty years the rolls had stayed closed. A federal officer sat down in a courthouse where the paperwork had been the weapon and kept different paperwork, and more than a hundred and fifty thousand people came in and put their names on it [ref:usccr-2018-voting].',
    },
    {
      type: 'paragraph',
      text: 'Notice what did the work. It wasn’t a change of heart, and it wasn’t a new census category. It was a list, kept by someone whose instructions had changed and filled by people who showed up to be on it. The record-making machinery of the United States was never neutral and never idle. For most of its history it simply pointed away from you.',
    },

    // ---- Era 1967: the secret file ----
    { type: 'heading', level: 2 as const, text: '1967 · The file you are never meant to see' },
    {
      type: 'paragraph',
      text: 'Two years after the examiner starts writing your name onto the rolls, another federal office opens a file on you that you will never be shown. On August 25, 1967, FBI headquarters sends its field offices a letter starting a counterintelligence program against what it calls black nationalist, hate-type organizations. The Senate committee that later investigated, chaired by Frank Church, quotes the letter’s purpose in the Bureau’s own words: "to expose, disrupt, misdirect, discredit, or otherwise neutralize the activities of black nationalist, hate-type organizations and groupings, their leadership, spokesmen, membership, and supporters" [ref:church-committee-b3]. Even the size of the opening move is disputed in the official record. The Church Committee’s report says the letter went to twenty-three field offices; the House Select Committee on Assassinations, describing the same letter, says twenty-two [ref:church-committee-b3][ref:archives-hsca-cointelpro]. The program was examined twice by Congress, and the file still can’t agree with itself about how many offices were told to open it.',
    },
    {
      type: 'paragraph',
      text: 'The expansion letter of March 4, 1968, sets out long-range goals, and the Church Committee’s report preserves the second of them: "to prevent the rise of a ‘messiah’ who could ‘unify, and electrify,’ the movement," naming Martin Luther King, Stokely Carmichael, and Elijah Muhammad [ref:church-committee-b3]. King had been under the Bureau’s attention for years by then. The committee’s case study opens with a sentence that needs no help: "From December 1963 until his death in 1968, Martin Luther King, Jr. was the target of an intensive campaign by the Federal Bureau of Investigation to ‘neutralize’ him as an effective civil rights leader" [ref:church-committee-b3]. Wiretaps on his home telephone ran from October 1963 into the middle of 1965, approved at the start by the Attorney General [ref:church-committee-b3]. Set the dates next to each other. In the same season the Voting Rights Act’s examiners are listing Black citizens so their names will protect them, the Bureau is filling a parallel file on the man most identified with winning that act, in order, the record says plainly, to neutralize him.',
    },
    {
      type: 'paragraph',
      text: 'When the Church Committee finished reading the program’s paperwork, it put a sentence into the congressional record that stands as the file’s own verdict on itself: "Many of the techniques used would be intolerable in a democratic society even if all of the targets had been involved in violent activity, but COINTELPRO went far beyond that" [ref:church-committee-b3]. The question running through every era here is who the record is for, and the secret file is the purest specimen of it. The census at least published its totals. The registration rolls at least let you see whether your name was on them. The counterintelligence file was a record about you whose existence was itself a secret, and it can be quoted at all only because a Senate committee dragged it into the open and printed it [ref:church-committee-b3].',
    },

    // ---- Era 2013: the formula expires ----
    { type: 'heading', level: 2 as const, text: '2013 · The formula is declared out of date' },
    {
      type: 'paragraph',
      text: 'The pointing lasts forty-eight years, and then you watch the coverage formula run out in real time. On June 25, 2013, in [[ent_case_shelby_county_v_holder_2013|Shelby County v. Holder]], the Supreme Court takes up the formula that decided whether places like yours needed federal permission to change their election laws, and strikes it down. The opinion rests on a single measure: "the Act imposes current burdens and must be justified by current needs" [ref:shelby-us-reports]. Congress had reauthorized the formula in 2006 using the old data, and for the Court that’s the defect: "Its failure to act leaves us today with no choice but to declare §4(b) unconstitutional" [ref:shelby-us-reports]. The Justice Department’s own explanation of the aftermath is precise about what remains: the Court "did not rule on the constitutionality of Section 5 itself" [ref:doj-section5]. Preclearance is still in the statute. It just covers nobody, because the list of covered places has been erased and Congress has never written a new one.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_voting_rights_q12_national',
      refId: 'art_shelby_county_v_holder_2013',
    },
    {
      type: 'paragraph',
      text: 'There’s a reading of the mechanism worth naming as a reading. The formula was struck for resting on old evidence about places with a long history of changing voting rules to racial ends, and the evidence was old while the supervision held, since a register of what those places would do unsupervised can’t fill up while they’re being supervised. Five years later the Commission on Civil Rights takes the new measurements, citing the Brennan Center’s tally: "At least 23 states have enacted newly restrictive statewide voter laws since the Shelby County decision" [ref:usccr-2018-voting]. The commission also relays a count it attributes to the Leadership Conference, that in those same years three Louisiana parishes in five closed a total of 103 polling places [ref:usccr-2018-voting]. Louisiana again. The state that cut its rolls from a hundred and thirty thousand to thirteen hundred with paperwork is back to adjusting the geography of the ballot with paperwork, and the federal record-keepers are back to writing it down after the fact.',
    },
    {
      type: 'paragraph',
      text: 'One more line from the commission’s report belongs here, because it measures the retreat in this chapter’s own currency, people sent to watch and write. In 2012, the last full election year before Shelby, the Justice Department sent over 780 federal observers and 259 election monitors to 51 jurisdictions in 23 states [ref:usccr-2018-voting]. The observers were creatures of the coverage formula, and when the formula fell the department largely lost the authority to send them [ref:usccr-2018-voting]. The examiner of 1965 and the observer of 2012 were the same idea at different ages, a federal witness with a notebook, posted where the local record couldn’t be trusted to keep itself honest. After June 25, 2013, most of the notebooks went home.',
    },

    // ---- Present-day close ----
    { type: 'heading', level: 2 as const, text: 'Today · You are counted, still' },
    {
      type: 'paragraph',
      text: 'Today you’re the best-counted you’ve ever been. There’s a census with your name and your answers on it, a survey of what a typical family owns that the Federal Reserve runs every three years [ref:scf-2022], and a federal survey that asks after every election whether you voted, all of it tabulated by race and published on federal websites. None of that is an argument against being counted, and every figure quoted above exists because somebody counted. The question is the other one: at each point in the record, who is the record for?',
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
      type: 'paragraph',
      text: 'The Survey of Consumer Finances puts a typical Black family’s holdings at $44,900 in 2022, against $285,000 for a typical white family [ref:scf-2022]. Six generations on, the country is still taking the quotient. It’s a different quotient, about six to one on medians against something near fifty-six to one per person in 1860, and it’s still the same operation, run by the same government [ref:scf-2022][ref:dkks-wealth-of-two-nations]. The turnout surveys still tabulate your vote by race, in the shadow of a coverage formula that covers nobody [ref:doj-section5]. Every one of those series is kept by the same government that kept Schedule 2, often by the same bureaus, sometimes in the same buildings.',
    },
    {
      type: 'paragraph',
      text: 'The modern counting does differ from the old counting in one way that has to be said plainly, because the difference is the whole of the progress. Most of today’s racial data series were mandated as instruments of enforcement, which is why the laws of the civil rights era required so much counting: the counting is how discrimination gets caught, measured, and litigated. When the mortgage registry tabulates denials by race, it’s doing on purpose what the HOLC form did incidentally, making a pattern visible, except that now the pattern’s visibility is the first step of a remedy instead of the mechanism of a harm [ref:nara-holc-area-description]. A form that asks about race in order to protect collateral and a form that asks about race in order to expose a lender are nearly identical documents, and the entire moral distance between them is who the record is for. That distance was crossed by law, recently. As the voting sections above show, it can be crossed back [ref:shelby-us-reports].',
    },
    {
      type: 'stat',
      packetId: 'tip_voting_rights_q12_national',
      kind: 'observation' as const,
      refId: 'obs:cps-a1-turnout-black-nation:nation:US:2020',
      caption: 'Black voter turnout, United States, 2020 (Current Population Survey).',
    },
    {
      type: 'stat',
      packetId: 'tip_voting_rights_q12_national',
      kind: 'observation' as const,
      refId: 'obs:cps-a1-turnout-white-nation:nation:US:2020',
      caption: 'White voter turnout, United States, 2020 (Current Population Survey).',
    },
    {
      type: 'paragraph',
      text: 'It would be easy to read the size of the American file on Black life as a history of recognition, as though a people this thoroughly documented must have been seen. Read the documents themselves and the proportion inverts. The fraction was written to apportion power among white men [ref:archives-constitution]. The schedules were written to inventory property [ref:nara-census-reference]. The security forms were written to protect collateral [ref:nara-holc-area-description]. The registration rolls were written, for most of their history, to be culled [ref:usccr-2018-voting]. The secret files were written to neutralize [ref:church-committee-b3].',
    },
    {
      type: 'paragraph',
      text: 'The country printed its own standard on the cover of its first count: "Return of the Whole Number of Persons within the Several Districts of the United States" [ref:census-1790-publication]. Set that title against Schedule 2, which took a number, a color, a sex, an age, and left the name off [ref:nara-census-reference]. A form in 1937 entered your presence on a block as a threat of infiltration, in the printed instructions’ own wording [ref:nara-holc-area-description]. A registration roll in Louisiana went from more than 130,000 names to 1,342 in eight years [ref:usccr-2018-voting]. The promise is in the country’s own printing, and the ledger against it is in the country’s own files.',
    },
    {
      type: 'paragraph',
      text: 'Look for the places in that file where Black Americans wrote instead of being written down. They’re few, and they’re findable. Garrison Frazier’s answer is still in the Savannah minutes, in the words he gave: that the way his people could best take care of themselves was to have land and till it by their own labor [ref:fssp-savannah-colloquy]. The Edisto committee’s petition is still in the federal file, misspellings and all, asking for the homesteads the government promised [ref:fssp-edisto-petitions]. The bureau’s marriage registers are still in the record, filled by couples who lined up to have their own families entered [ref:nara-freedmen-marriage]. The Freedman’s Bank signature books are still in the National Archives, and genealogists work them name by name [ref:nara-freedmans-bank-rr124][ref:nara-prologue-freedmans-bank]. The examiners’ lists of 1965 hold more than 150,000 names that people walked into a courthouse and gave [ref:usccr-2018-voting]. The land went back inside the year, and the bank shut its doors in June 1874 [ref:special-field-orders-15][ref:occ-freedmans-bank]. The paper outlasted both.',
    },
    {
      type: 'paragraph',
      text: 'The hand holding the pen has changed before, and every page it wrote is still in the file.',
    },
    {
      type: 'timeline',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
    },
  ],
};

export default theCountArticle;
