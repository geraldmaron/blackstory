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
 * Voice follows docs/content/era-immersion-style.md (second-person cold open,
 * the rule in force quoted verbatim, odds as plain comparisons, jump-cuts) and
 * docs/ui/voice-theme-chapters.md (prose builds stakes, data delivers the
 * verdict; disputes shown in the prose; one earned flourish). Narrative facts
 * follow docs/methodology/chapter-fact-validation.md: each fact traces to two
 * independent fetched sources, or to a named primary-record holder attributed
 * inside the sentence (the National Archives' own reference report, the
 * Commission on Civil Rights' own tables, the Court's own opinion). Where the
 * record disagrees with itself (the 1790 count of the enslaved), the
 * disagreement is shown, never resolved.
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
    'The United States has been writing Black people down since before it had a president: a fraction in the Constitution, a numbered line on a slave schedule, a grade on a survey form, a name struck from a registration roll. The archive those records left behind is enormous, and it is mostly the paperwork of being counted by someone else. This chapter reads that archive in order, and marks the few places where the hand holding the pen changes.',
  eraLabel: '1787–present',
  placeLabel: 'United States',
  publishedAt: '2026-08-07',
  status: 'review' as const,
  relatedEntityIds: [],
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
    },
    {
      id: 'archives-dred-scott',
      label:
        'National Archives, Milestone Documents, "Dred Scott v. Sandford (1857)."',
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
      label:
        'National Archives, Prologue (Spring 2005), "Freedmen’s Bureau Marriage Records."',
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
      id: 'usccr-2018-voting',
      label:
        'U.S. Commission on Civil Rights, "An Assessment of Minority Voting Rights Access in the United States" (2018), Table 1 and findings.',
      url: 'https://www.usccr.gov/files/pubs/2018/Minority_Voting_Access_2018.pdf',
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
    },
    {
      id: 'doj-section5',
      label: 'U.S. Department of Justice, Civil Rights Division, "About Section 5 of the Voting Rights Act."',
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
    // ---- Era 1787: the fraction ----
    { type: 'heading', level: 2 as const, text: '1787 · Three fifths of all other Persons' },
    {
      type: 'paragraph',
      text: 'The first time the United States writes you down, it writes you down as arithmetic. Article I, Section 2 of the Constitution directs that representation and direct taxes be apportioned by population, and then it defines the population: "the whole Number of free Persons, including those bound to Service for a Term of Years, and excluding Indians not taxed, three fifths of all other Persons" [ref:archives-constitution][ref:senate-constitution]. You are the other persons. The sentence never uses the word slave, or the word Black, or any word at all for what you actually are. It does not need to. Everyone drafting it knows who the fraction is for, and the drafting is careful precisely because the thing being drafted is permanent. Your first appearance in the founding record is as a number that makes other people’s votes count for more.',
    },
    {
      type: 'paragraph',
      text: 'Three years later the counting begins in earnest. The first census, taken in 1790, sorts every household in the country into a handful of columns: free white males sixteen and over, free white males under sixteen, free white females, "all other free persons," and "slaves" [ref:census-1790-publication]. If you are enslaved, the marshal taking the count does not ask your name, and there is no line on which to write it. The National Archives’ own guide to these records states it plainly: the census "lists slaves statistically under the owner’s name" [ref:nara-census-reference]. The country counts 3,929,214 people that year [ref:census-1790-facts]. How many of them were enslaved depends on which record you trust: the Census Bureau’s own historical tables carry 697,681, while a peer-reviewed history of the count puts it at 697,624 [ref:census-twps0056][ref:pmc-census-history]. Fifty-seven human beings sit inside that disagreement. Nobody can resolve it now, because the only people who knew were never asked, and the men who wrote the totals did not think the difference worth checking.',
    },
    {
      type: 'paragraph',
      text: 'The results are printed in 1793 under a title worth reading slowly: "Return of the Whole Number of Persons within the Several Districts of the United States" [ref:census-1790-publication]. The whole number of persons. The publication that reduces you to an unnamed tally in an owner’s household still calls you a person on its cover, because the Constitution’s fraction requires you to be one; three-fifths of a chair apportions nothing. That is the strange doubleness the count carries from the beginning. The record cannot afford to deny your personhood outright, because your personhood is what it is harvesting. It needs you to exist exactly enough to be counted, and not one entry more.',
    },
    {
      type: 'paragraph',
      text: 'Hold on to what just happened, because the rest of this chapter is the same event repeating in different clothes. A government made a record about you, for its own purposes, with real consequences riding on it, and the record neither needed your name nor wanted your answer. The archive of that census survives. It is consulted, cited, and digitized. It recognizes no one.',
    },

    // ---- Era 1857: the record rules on you ----
    { type: 'heading', level: 2 as const, text: '1857 · The record rules on who you are' },
    {
      type: 'paragraph',
      text: 'Seventy years into the counting, the highest record-keeper in the country is asked to say what the records mean. Dred Scott, held in slavery in Missouri, has sued for his freedom on the ground that his enslaver took him to live for years on free soil, and the suit turns on a threshold question: whether a Black man can be a citizen who is entitled to sue in a federal court at all. On March 6, 1857, Chief Justice Roger Taney reads the answer for the Court [ref:archives-dred-scott]. "We think they are not," the opinion says of Black Americans and the Constitution’s word citizens, "and that they are not included, and were not intended to be included, under the word ‘citizens’ in the Constitution, and can therefore claim none of the rights and privileges which that instrument provides for and secures to citizens of the United States" [ref:dred-scott-us-reports].',
    },
    {
      type: 'paragraph',
      text: 'To get there, the Chief Justice does something a record-keeper does: he reads the old records back. The opinion surveys the founding era and reports what it finds there, that Black people "had for more than a century before been regarded as beings of an inferior order," and "so far inferior, that they had no rights which the white man was bound to respect" [ref:dred-scott-us-reports]. Taney offers that sentence as history, the fixed opinion of an earlier age, and then rules that the Constitution must still be read by its light. Notice the method, because the method is the point. The most consequential legal record of the decade about Black Americans is built out of the prior records, none of which any Black person was permitted to write, and it uses their silence in the file as proof about their nature. The archive is citing itself. It will keep doing that.',
    },
    {
      type: 'paragraph',
      text: 'The National Archives’ summary of the case states the rest of the holding in two clean strokes: the Court ruled that enslaved people were not citizens and could not sue in federal court, and that Congress had no authority to ban slavery from a federal territory [ref:archives-dred-scott]. The second stroke matters to this chapter as much as the first. The Missouri Compromise line was itself a kind of national record, a boundary written in 1820 that sorted the map into ground where the schedules would run and ground where they would not. The Court erases it. After March 1857 there is no line on the federal map that the property schedule cannot, in principle, cross.',
    },
    {
      type: 'paragraph',
      text: 'The ruling also decides what the count you appear in can never do for you. Residence on free soil does not free you; the census of a free state may enumerate you; no accumulation of paper makes you a person the federal courts can hear. Three years later the marshals go out again with their schedules, and the ruling rides along with every form.',
    },

    // ---- Era 1860: the schedule ----
    { type: 'heading', level: 2 as const, text: '1860 · A line without a name' },
    {
      type: 'paragraph',
      text: 'Seventy years on, the counting has been refined. Since 1850 the census has recorded every free person in a household by name, white and nonwhite alike [ref:nara-census-reference]. If you are enslaved, you go on a different form. Schedule 2, "Slave Inhabitants," is organized by the name of the person who owns you; the National Archives’ guide records that "census takers were instructed to substitute numbers in place of names on the slave schedules" [ref:nara-census-reference]. What the schedule keeps about you is a number in a column, a color, a sex, an age, and whether you are, in the form’s own categories, "deaf, dumb, blind, insane, or idiotic" [ref:nara-census-reference]. The National Park Service, describing one surviving schedule from St. Louis County, notes that a researcher reading it today can see the owners’ names in full and the owned only as entries beneath them [ref:nps-1860-slave-schedule].',
    },
    {
      type: 'paragraph',
      text: 'Read the rest of the schedule’s columns and you can reconstruct the mind that designed it. Beyond color, sex, and age, the National Archives’ guide lists what else each owner’s block of lines records: the number of enslaved people who were fugitives from the state, and the number manumitted [ref:nara-census-reference]. Escape and release, the two doors out, tracked as carefully as age, because each one moves property off a ledger. There is no column for family. A husband and wife enslaved on the same farm appear as two lines with no mark connecting them; their children are lines of smaller ages. The census of 1850 had asked the free population about occupation, birthplace, schooling, literacy. None of those questions crosses onto Schedule 2, not because the answers didn’t exist, but because no purpose the form served required them. A record is a list of the questions its makers thought worth asking. This one thought escape worth asking about, and marriage not.',
    },
    {
      type: 'paragraph',
      text: 'That summer the marshals count 3,953,760 people this way [ref:census-twps0056][ref:pmc-census-history]. Nearly four million lines, each one a person, none carrying a name. Beside them the same count finds 488,070 free people it classes as colored [ref:census-twps0056][ref:census-1860-publication]. Set the two against each other and the proportions of the record come clear: for every Black American the government wrote down as a named person that year, it wrote down about eight as numbered property. When researchers went back over what the country held in 1860, they found the average white person holding about fifty-six times the wealth of the average Black person [ref:dkks-wealth-of-two-nations]. The schedule and the ratio are the same fact in two notations. One writes it as inventory. The other writes it as a quotient.',
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
      text: 'Then, inside a single decade, the record changes shape, and for one January evening it even changes hands. On the twelfth of January, 1865, in a house in Savannah, twenty Black ministers and church officers sit down with the Secretary of War and General Sherman, and a clerk takes minutes. The men choose Garrison Frazier, a Baptist minister who bought freedom for himself and his wife with a thousand dollars in gold and silver, to answer for them, and when he is asked what his people need, his answer goes into the record in his own words: "The way we can best take care of ourselves is to have land, and turn it and till it by our own labor" [ref:fssp-savannah-colloquy]. Question by question, the minutes preserve a thing the previous two and a half centuries of American paper almost never contain: Black men asked on the record what they want, and the answers written down as given. The document runs only a few pages. Another chapter on this site follows what became of the land it asked for. This chapter only asks you to notice how rare the document’s shape is, an interview instead of an inventory, and how short its season was.',
    },
    {
      type: 'paragraph',
      text: 'That fall, when the promised land is being handed back to pardoned Confederates, the freedpeople of Edisto Island answer the government in writing, in a petition their own committee drafts: "General we want Homestead’s; we were promised Homestead’s by the government" [ref:fssp-edisto-petitions]. The petition fails. The land goes back. But the paper survives in the federal file, misspellings and all, and it belongs to a small class of documents this chapter will keep returning to: records that exist because Black people forced them into existence. Hold the two kinds of paper side by side, the schedule that numbered you and the petition you signed, because the whole archive divides along that line.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_savannah_colloquy_1865',
    },
    {
      type: 'paragraph',
      text: 'The same season builds the machinery. On March 3, 1865, Congress establishes the Bureau of Refugees, Freedmen, and Abandoned Lands in the War Department [ref:nara-freedmens-bureau]. The bureau issues rations, runs hospitals and camps, and supervises labor contracts between planters and the people who used to be their property, and all of it produces paper. The National Archives describes what that paper holds: records "rich with names and personal information," marriage certificates, labor contracts, school records, complaints, requests for legal aid [ref:nara-freedmens-bureau]. The Archives’ inventory of what the bureau’s files hold keeps going: schooling information, land applications, requests for legal aid and protection, trial summaries [ref:nara-freedmens-bureau]. Every item on that list is a transaction someone initiated, which makes this the first federal archive about Black Americans built substantially out of things Black Americans asked for. For the first time, a federal file about you has your name at the top of it because you walked in and gave it.',
    },
    {
      type: 'paragraph',
      text: 'Some of what gets written down had been unwritable before. A marriage between enslaved people had no legal standing anywhere in the South; the bureau’s commissioner directs that "in places where the local statutes make no provisions for the marriage of persons of color, the assistant commissioners are authorized to designate officers who shall keep a record of marriages" [ref:nara-freedmen-marriage]. Couples who had lived as husband and wife for decades line up to have the fact of their own families entered into a register, partly, as the Archives’ account explains, so that inheritance and claims could ever be settled in their favor at all; the Archives’ account says the registers were kept in part "to assist in identifying couples, resolve future questions involving inheritance, and to settle claims against the federal government" [ref:nara-freedmen-marriage]. Read those registers for what they are: not a government discovering that Black families existed, but families seizing the first machinery that would let their existence count.',
    },
    {
      type: 'paragraph',
      text: 'The same season produces a bank. The Freedman’s Savings and Trust Company, chartered the same day as the bureau, grows to dozens of branches, and across its nine years it serves some seventy thousand depositors [ref:nara-freedmans-bank-rr124][ref:occ-freedmans-bank]. To open an account you sit for the register of signatures, and the questions run long: your name, where you were born, where you were brought up, your family, your employer. The National Archives’ report on these registers notes that "some early volumes also identify the name of the depositor’s former owner and the name of the plantation" [ref:nara-freedmans-bank-rr124]. Think about what that line is. A person walks into a bank as a customer and dictates, as identifying detail, the name of the man who five years earlier held him as a line on Schedule 2. The schedule wrote the owner and numbered the owned. The register writes the freedman and demotes the owner to a field on his form.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_freedmans_savings_bank_collapse_1874',
    },
    {
      type: 'paragraph',
      text: 'The bank fails, and it fails from above. In 1870 Congress amends the charter to let the trustees put half the deposits into riskier investments, a change the Comptroller of the Currency’s history says opened the door to speculation and mismanagement, and in the crash that follows the Panic of 1873 the depositors’ money is already gone from the vaults before most of them have heard a word [ref:occ-freedmans-bank][ref:nara-prologue-freedmans-bank]. In March 1874 the trustees hand the presidency to Frederick Douglass in the hope his name will steady the run [ref:occ-freedmans-bank][ref:nara-prologue-freedmans-bank]. He examines the books and records what he finds in his memoir: "I was married to a corpse" [ref:docsouth-douglass-life-and-times]. When the doors close that June, 61,144 depositors are left holding losses of nearly three million dollars, and about half of them eventually recover roughly three-fifths of what they saved; the rest get nothing [ref:occ-freedmans-bank][ref:nara-prologue-freedmans-bank]. What survives in full is the paperwork. The registers of signatures sit in the National Archives today, and genealogists work through them name by name, because for hundreds of thousands of families the account book of a failed bank is the first place an ancestor speaks in his own words [ref:nara-freedmans-bank-rr124][ref:nara-prologue-freedmans-bank]. The money was lost and the names were kept. That is the ledger’s summary of Reconstruction.',
    },
    {
      type: 'paragraph',
      text: 'One more record from the decade, and it is the largest. The 1870 census, the first taken after the war, is the first to enumerate the formerly enslaved like everyone else; the National Archives calls it "often the first official record of a surname for former slaves" [ref:nara-census-reference]. Four million people cross, in one count, from the property schedule to the population schedule. It took a war, three constitutional amendments, and eighty years of counting to get a name onto the page.',
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
      text: 'A name on a record can be removed by a record. By the 1890s, in Louisiana, your name on the registration rolls makes you one of a hundred and thirty thousand Black men entitled to vote, a force large enough to decide the state. Then the state rewrites its registration rules. The instruments of the era, as the federal Commission on Civil Rights catalogues them, are poll taxes, literacy tests, and grandfather clauses "excluding prior (white) registrants from the new strict rules," backed by violence against those who tried to register anyway [ref:usccr-2018-voting]. No mob is required for what follows, and no fire. The rolls simply shrink each year as the new paperwork does its work. The federal Commission on Civil Rights, surveying that history, carries the result in one sentence: "In Louisiana, where more than 130,000 black voters had been registered in 1896, the number had plummeted to 1,342 by 1904" [ref:usccr-2018-voting].',
    },
    {
      type: 'paragraph',
      text: 'Sit with the shape of that instrument for a moment. Disfranchisement here is not a man at the courthouse door with a gun, though the era had those too. It is a registrar with a form, applying facially neutral requirements whose exemptions were drafted around a birth date. The same machinery that once counted you as three-fifths and then declined to name you now names you precisely, checks your name against a test your grandfather’s status decides, and strikes it. Across the South the pattern repeats state by state, and the registration ledgers, kept meticulously throughout, become the record of their own emptying. Nothing about the record-keeping was hidden. The numbers were published. Publication was not the same thing as shame.',
    },

    // ---- Era 1921: the record burns, and then accuses ----
    { type: 'heading', level: 2 as const, text: '1921 · The record burns, and then accuses' },
    {
      type: 'paragraph',
      text: 'What the record gives, the record can be made to take back, and in Tulsa you can watch it happen to the pages themselves. On the afternoon of May 31, 1921, the Tulsa Tribune puts a nineteen-year-old shoeshine named Dick Rowland on its front page under the headline "Nab Negro for Attacking Girl in an Elevator" [ref:loc-tulsa-newspapers]. By the next night the thirty-five blocks of Greenwood are burning, and this site tells that story, the buildup, the courthouse crowd, the dawn crossing, in the wealth chapter, where it belongs. What belongs here is quieter and in some ways stranger: what happened afterward to the paper.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_tulsa_tribune_1921_nab_negro',
    },
    {
      type: 'paragraph',
      text: 'Survivors remembered that same day’s Tribune carrying an editorial headed "To Lynch Negro Tonight." No copy exists. Someone tore the story and nearly all of the editorial page out of the bound file of that day’s edition before it was microfilmed, so the front page survives only through a 1946 transcription and a reprint, and the editorial survives only in the memories of the people who described reading it [ref:tulsa-commission-2001][ref:loc-tulsa-newspapers]. Think about what that torn place in the file is. For every earlier era in this chapter, the problem with the record was what it wrote about you. Here the record has been edited after the fact, by an unknown hand, at the exact page where it might have documented who called for the killing. The archive about Black Americans is not only shaped by what officials chose to write down. It is shaped by what someone later chose to remove, and the removal is itself now part of the record, a hole with a date.',
    },
    {
      type: 'paragraph',
      text: 'Then the surviving machinery of record turns on the survivors. A grand jury is empaneled, and its report blames the massacre on the Black men who had gone to the courthouse to prevent a lynching [ref:tulsa-commission-2001]. Insurers deny claim after claim under the riot exclusion clauses in their policies, and of more than a hundred lawsuits, not one succeeds [ref:tulsa-commission-2001]. Even the dead resist counting: official figures at the time put the toll at thirty-six, while the state commission that reopened the file eighty years later found credible evidence that the dead likely numbered between one and three hundred [ref:tulsa-commission-2001]. That commission, reporting in 2001, is the state of Oklahoma going back through its own ledgers, its own newspapers, its own grand jury report, and writing down what the earlier records did and hid [ref:tulsa-commission-2001]. It took eighty years for the file to be reopened, and the people who could have answered its questions had spent most of that time dying without being asked.',
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
      text: 'Move north with the Great Migration and the counting follows you into the city. In the late 1930s a federal surveyor works through the neighborhoods of more than two hundred cities with a printed sheet, NS Form-8, "Area Description," grading each area for mortgage security. Item 5 of the form is headed "Inhabitants," and its fifth line reads "d. Negro (Yes or No)," followed by a percentage; the printed instructions on the back ask whether there is "any threat of infiltration of foreign born, negro or lower grade population," and supply the wording to use: "indicate these by nationality and rate of infiltration like this: ‘Negro - rapid’" [ref:nara-holc-area-description]. Another chapter on this site follows what those grades did to the price and possibility of a home. Here, notice only what kind of record this is. The form does not ask you anything. It asks about you, in the third person, so that your presence on a block can be entered as a hazard to someone else’s collateral.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_holc_ns_form8_area_description_1937',
    },
    {
      type: 'paragraph',
      text: 'By 1937 the federal government has been writing Black Americans down for a hundred and fifty years, and the file is already vast: a fraction, five censuses of numbered lines, a war’s worth of bureau registers, forty years of shrinking rolls, and now a grade. Anyone who later opens that file and reads its size as attention is making a category error. Almost none of it was written to you, and almost none of it was written for you. It was written about you, by offices that needed you measured for their own arithmetic: apportionment, inventory, risk.',
    },

    // ---- Era 1965: the list restored ----
    { type: 'heading', level: 2 as const, text: '1965 · A federal examiner writes your name' },
    {
      type: 'paragraph',
      text: 'It takes until August 6, 1965, for the machinery of listing to run the other way. The Voting Rights Act, signed that day, is built out of the same materials as the laws it breaks: coverage formulas, determinations, lists. Section 4 reaches any state or county that maintained a test or device on November 1, 1964, and where, by the census director’s determination, "less than 50 per centum of the persons of voting age residing therein were registered" [ref:vra-1965-statute]. Section 5 freezes those places’ election laws, requiring federal signoff before any change takes effect [ref:vra-1965-statute][ref:doj-history-voting]. And Sections 6 and 7 put the pen directly in a federal hand: examiners are appointed "to prepare and maintain lists of persons eligible to vote in Federal, State, and local elections," and "any person whose name appears on the examiner’s list shall be entitled and allowed to vote" [ref:vra-1965-statute]. For the first time since the bureau closed its registers, a federal officer’s job is to write your name down so that the writing itself protects you.',
    },
    {
      type: 'paragraph',
      text: 'The instrument the act breaks is itself preserved. A literacy test from Alabama, the kind a registrar could put in front of you in 1965 and grade however the day required, survives in the record and is reproduced below. It does not need commentary. It is a form, like the others in this chapter, and by now you know how to read a form: look at what it asks, and ask who the asking serves.',
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
      text: 'Mississippi is where the instrument bites hardest, because Mississippi is where the old instrument had cut deepest. In November 1964, by the Commission on Civil Rights’ own tables, 6.7 percent of the state’s nonwhite voting-age population is registered, about 28,500 people; by September 1967 the figure is 59.8 percent, more than a quarter million [ref:usccr-2018-voting]. The commission’s report is careful to call its own numbers estimates from official and unofficial sources, varying widely in accuracy [ref:usccr-2018-voting], and the caution is worth keeping. But no reading of those two figures puts them on the same order of magnitude. Roughly one eligible Black Mississippian in fifteen was on the rolls before the act. Three years after it, roughly three in five.',
    },
    {
      type: 'stat',
      packetId: 'tip_voting_rights_q12_national',
      kind: 'observation' as const,
      refId: 'usccr-black-registration-rate-state:state:28:1964',
      caption: 'Black voter registration rate, Mississippi, 1964, before the Voting Rights Act.',
    },
    {
      type: 'stat',
      packetId: 'tip_voting_rights_q12_national',
      kind: 'observation' as const,
      refId: 'usccr-black-registration-rate-state:state:28:1967',
      caption: 'Black voter registration rate, Mississippi, 1967, two years after the Voting Rights Act.',
    },
    {
      type: 'paragraph',
      text: 'The commission’s report also counts what the examiners themselves wrote: by 1967, federal examiners authorized under the act had registered more than 150,000 Black southerners directly, name by name, in the counties where the local registrar’s office had been the wall [ref:usccr-2018-voting]. The Justice Department’s own history describes the mechanism the same way, an examiner reviewing the qualifications of people who wanted to register, in counties the Attorney General designated [ref:doj-history-voting]. It is worth being precise about how narrow the intervention was. Nobody rewrote the state’s books. Nobody was compensated for the sixty years the rolls had been closed. A federal officer sat down in a courthouse where the paperwork had been the weapon, and kept different paperwork.',
    },
    {
      type: 'paragraph',
      text: 'Notice what did the work. Not a change of heart, and not a new census category. A list, kept by someone whose instructions had changed. The record-making machinery of the United States was never neutral and never idle; it simply pointed, for most of its history, away from you. The Voting Rights Act is what the same machinery looks like for the few decades it is pointed the other way.',
    },

    // ---- Era 1967: the secret file ----
    { type: 'heading', level: 2 as const, text: '1967 · The file you are never meant to see' },
    {
      type: 'paragraph',
      text: 'Two years after the examiner starts writing your name onto the rolls, another federal office starts a file on you that you will never be shown. On August 25, 1967, FBI headquarters sends a letter to its field offices opening a counterintelligence program against what it calls black nationalist, hate-type organizations. The Senate committee that later investigated, chaired by Frank Church, quotes the letter’s purpose in the Bureau’s own words: "to expose, disrupt, misdirect, discredit, or otherwise neutralize the activities of black nationalist, hate-type organizations and groupings, their leadership, spokesmen, membership, and supporters" [ref:church-committee-b3]. Even the size of the program’s opening move is disputed in the official record: the Church Committee’s report says the letter went to twenty-three field offices, while the House Select Committee on Assassinations, describing the same letter, says twenty-two [ref:church-committee-b3][ref:archives-hsca-cointelpro]. The two committees also disagree about the expansion that followed, forty-one offices by one account, more by the other [ref:church-committee-b3][ref:archives-hsca-cointelpro]. The most closely investigated secret program in the Bureau’s history, examined twice by Congress, and the file cannot agree with itself about how many offices were told to open it.',
    },
    {
      type: 'paragraph',
      text: 'The expansion letter of March 4, 1968, sets out long-range goals, and the Church Committee’s report preserves the second of them: "to prevent the rise of a ‘messiah’ who could ‘unify, and electrify,’ the movement," naming Martin Luther King, Stokely Carmichael, and Elijah Muhammad [ref:church-committee-b3]. King had been under the Bureau’s attention for years by then. The committee’s case study opens with a sentence that needs no help: "From December 1963 until his death in 1968, Martin Luther King, Jr. was the target of an intensive campaign by the Federal Bureau of Investigation to ‘neutralize’ him as an effective civil rights leader" [ref:church-committee-b3]. Wiretaps on his home telephone ran from October 1963 until the middle of 1965, initially approved by the Attorney General [ref:church-committee-b3]. Set the dates side by side. The same season the Voting Rights Act’s examiners are listing Black citizens so their names will protect them, the Bureau is filling a parallel file on the man most identified with winning that act, in order, the record says plainly, to neutralize him.',
    },
    {
      type: 'paragraph',
      text: 'When the Church Committee finished reading the program’s paperwork, it wrote a sentence into the congressional record that stands as the file’s own verdict on itself: "Many of the techniques used would be intolerable in a democratic society even if all of the targets had been involved in violent activity, but COINTELPRO went far beyond that" [ref:church-committee-b3]. This chapter has been tracking who the record is for, and the secret file is the purest specimen in it. The census at least published its totals. The registration rolls at least let you see whether your name was on them. The counterintelligence file was a record about you whose existence was itself a secret, discoverable only because a Senate committee later dragged it into the open and printed it, which is the only reason it can be quoted here.',
    },

    // ---- Era 2013: the formula expires ----
    { type: 'heading', level: 2 as const, text: '2013 · The formula is declared out of date' },
    {
      type: 'paragraph',
      text: 'The pointing lasts forty-eight years. On June 25, 2013, in Shelby County v. Holder, the Supreme Court takes up the coverage formula that decides which places need federal permission to change their election laws, and strikes it down. The opinion’s reasoning rests on a single measure: "the Act imposes current burdens and must be justified by current needs" [ref:shelby-us-reports]. Congress had reauthorized the formula in 2006 using the old data, and for the Court that is the defect: "Its failure to act leaves us today with no choice but to declare §4(b) unconstitutional" [ref:shelby-us-reports]. The Justice Department’s own explanation of the aftermath is precise about what remains: the Court "did not rule on the constitutionality of Section 5 itself" [ref:doj-section5]. Preclearance still exists in the statute. It simply covers no one, because the list of covered places has been erased and Congress has never written a new one.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_voting_rights_q12_national',
      refId: 'art_shelby_county_v_holder_2013',
    },
    {
      type: 'paragraph',
      text: 'There is an irony in the mechanism worth stating carefully, without embellishment, because the record supports it on its own. The formula was struck for resting on old evidence about places with a long history of altering voting rules to racial ends. The evidence was old partly because the formula had been working: the register of what those places would do without supervision could not grow while the supervision held. Five years later the Commission on Civil Rights takes the new measurements: "At least 23 states have enacted newly restrictive statewide voter laws since the Shelby County decision" [ref:usccr-2018-voting]. The commission’s report also relays a count made by the Leadership Conference, which it names as the source, that 61 percent of Louisiana parishes had closed a total of 103 polling places in those same years [ref:usccr-2018-voting]. Louisiana again. The state that cut its rolls from a hundred thirty thousand to thirteen hundred with paperwork is back to adjusting the geography of the ballot with paperwork, and the federal record-keepers are back to writing it down after the fact.',
    },
    {
      type: 'paragraph',
      text: 'One more line from the commission’s report belongs here, because it measures the retreat in the chapter’s own currency, people sent to watch and write. In 2012, the last full election year before Shelby, the Justice Department sent over 780 federal observers and 259 election monitors to 51 jurisdictions in 23 states [ref:usccr-2018-voting]. The observers were creatures of the coverage formula; when the formula fell, the department largely lost its authority to send them. The examiner of 1965 and the observer of 2012 were the same idea at different ages, a federal witness with a notebook, stationed where the local record could not be trusted to keep itself honestly. After June 25, 2013, most of the notebooks went home.',
    },

    // ---- Present-day close ----
    { type: 'heading', level: 2 as const, text: 'Today · You are counted, still' },
    {
      type: 'paragraph',
      text: 'Today you are the best-counted you have ever been. A census with your name and your answers. A survey of what your family owns, run every three years. A registry of every mortgage decision, every prison admission, every ballot cast, cross-tabulated by race and published on federal websites. Nothing in this chapter argues against the counting; the counting is how every number on this site exists at all. The question the chapter has been asking is different: at each point in the record, who is the record for? And the honest answer is that the modern file, voluminous as it is, still mostly measures what is done to you and around you. What it shows, when you read it, is continuity.',
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
      text: 'The Survey of Consumer Finances puts a typical Black family’s holdings at $44,900 in 2022, against $285,000 for a typical white family [ref:scf-2022]. That is the 1860 quotient, six generations on, still being taken. The turnout surveys still tabulate your vote by race, in the shadow of a coverage formula that no longer covers anyone. Every one of those series is maintained by the same government that once maintained Schedule 2, often by the same bureaus, sometimes in the same buildings.',
    },
    {
      type: 'paragraph',
      text: 'And yet the modern counting differs from the old counting in one respect this chapter is obligated to state, because the difference is the reason this site can exist. Most of today’s racial data series were mandated as instruments of enforcement: the counting is how discrimination is caught, measured, and litigated, which is why the laws of the civil rights era required so much of it. When the mortgage registry tabulates denials by race, it is doing on purpose what the HOLC form did incidentally, making a pattern visible, except that now the pattern’s visibility is the remedy’s first step rather than the harm’s. The instrument is the same. The intended reader changed. A form that asks about race in order to protect collateral and a form that asks about race in order to expose a lender are physically almost identical documents, and the entire moral distance between them is who the record is for. That distance was crossed by law, recently, and, as the voting sections above show, it can be crossed back.',
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
      text: 'So here is how to read the archive this site is built on, and how not to. The United States holds an enormous documentary record of Black life, and it would be easy to mistake the size of that record for a history of recognition, as though a people this thoroughly documented must have been seen. Read the documents themselves and the proportion inverts. The fraction was written to apportion power among white men. The schedules were written to inventory property. The security forms were written to protect collateral. The registration rolls were written, for most of their history, to be culled. The secret files were written to neutralize. The parts of the record where Black Americans appear as themselves, by name, on purpose, at their own request, are countable on your fingers: the Savannah minutes, the Edisto petition, a marriage register, a bank signature book, a census line after 1870, an examiner’s list after 1965. Half of those were undone, ignored, or emptied of force within a decade of being made.',
    },
    {
      type: 'paragraph',
      text: 'Which is also the instruction for reading everything else on this site. When a chapter here quotes a covenant, a survey form, a sentencing table, or a denial rate, it is quoting the file this chapter has been describing, and the right question is never only what does the record say. It is the question each era above has forced in turn: who wrote this, about whom, for whose use, and what did the writing do once it existed. Ask that of the three-fifths clause and it stops being an embarrassing compromise and becomes an apportionment engine. Ask it of a slave schedule and the blank where a name should be stops being an omission and becomes the design. Ask it of a modern dataset and you can tell, usually within a column or two, whether you are holding an instrument of enforcement or the latest edition of the survey that grades your block.',
    },
    {
      type: 'paragraph',
      text: 'That is why this chapter anchors the others. Every deed, grade, sentence, and ledger the other chapters follow is a page from the same file, and the file has a grain: it runs from being counted to counting, and the direction of that grain is the story. The record of Black America is immense because America never stopped writing it. The pages Black hands were allowed to write are the ones this site exists to find.',
    },
    { type: 'heading', level: 3 as const, text: 'The record, in order' },
    {
      type: 'paragraph',
      text: 'Everything quoted here is sitting in an archive with its own date on it: a clause in the founding parchment, a marshal’s tally sheet, an opinion that read the old records back as law, a schedule that substituted numbers for names, the minutes of one January interview, a petition in the petitioners’ own spelling, a signature book from a failed bank, a state constitution built around a grandfather’s birthday, a torn page in a bound newspaper file, a survey form with a yes-or-no box, a statute that put the pen in a federal hand, a secret file printed by the Senate, and an opinion that took the pen back out. None of it needs us in order to be believed. Read it in order, and watch who is holding the pen.',
    },
    {
      type: 'timeline',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
    },
  ],
};

export default theCountArticle;
