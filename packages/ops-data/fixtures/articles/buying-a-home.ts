/**
 * Flagship article: "Buying a Home" — the era-immersion redlining spine, built
 * on the /chapters surface.
 *
 * Voice follows docs/content/era-immersion-style.md (second-person cold open,
 * the rule in force quoted verbatim, odds rather than bare decimals, jump-cuts)
 * and docs/ui/voice-theme-chapters.md (specific person, specific hour; prose
 * builds stakes, data delivers the verdict; disputes shown in the prose).
 * Narrative facts follow docs/methodology/chapter-fact-validation.md: every
 * event fact traces to two independent fetched sources, or to a named
 * primary-record holder attributed inside the sentence (the Court's own
 * opinions, the Park Service landmark file, the CFPB's 2024 report). Events get
 * buildup, not verdicts: the covenant section runs from the 1911 signing through
 * Buchanan and Corrigan to Shelley, and the 1948 section follows one Chicago
 * family through a contract for deed from signing to eviction, each beat cited.
 *
 * Six era sections in forward chronological order (1911, 1935, 1938, 1948, 1968,
 * today), matching the section rhythm of wealth-gap.ts. Data blocks bind to the
 * published theme-impact packet `tip_buying_a_home_era`; inline [ref:id] markers
 * resolve to the references list; primaryDocument refIds match packet
 * artifactIds (packages/ops-data/fixtures/theme-impact/buying-a-home-era-packet.ts).
 *
 * method_stance is gated_causal_claim: ONLY the sentence citing Aaronson, Hartley
 * & Mazumder (2021) uses causal language, gated to that study's
 * boundary-discontinuity design. Every other pairing in this chapter is
 * juxtaposition. Where the record disagrees with itself (the February 1911
 * signing date), the disagreement is shown rather than resolved.
 */

export const buyingAHomeArticle = {
  id: 'article_buying_a_home',
  slug: 'buying-a-home',
  title: 'Chapter: Buying a Home',
  summary:
    'For almost a hundred years, the rules about who got to buy a home in America weren’t a secret. They were written down, in plain words, and we quote them here exactly: a clause attached to the land itself, a federal manual telling appraisers what a good neighborhood looked like, a contract that let a seller keep the deed and take the house back over one late payment. None of it was passed down as rumor. It’s all on paper, and the gap those rules opened is still sitting in the government’s own numbers today.',
  themeId: 'redlining',
  eraLabel: '1911–present',
  placeLabel: 'United States',
  publishedAt: '2026-07-26',
  status: 'published' as const,
  heroImage: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Holc_redlining_1937.jpeg',
    alt: 'A 1937 Home Owners’ Loan Corporation "residential security" map, with neighborhoods graded and the lowest grade shaded red.',
    credit:
      'Home Owners’ Loan Corporation residential security map, 1937. U.S. government work, public domain (Wikimedia Commons).',
    rightsStatus: 'public_domain' as const,
  },
  relatedEntityIds: ['ent_case_shelley_v_kraemer_1948', 'ent_bronzeville_001'],
  references: [
    {
      id: 'shelley-v-kraemer',
      label:
        'Shelley v. Kraemer, 334 U.S. 1 (1948); official United States Reports, Library of Congress.',
      url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep334/usrep334001/usrep334001.pdf',
    },
    {
      id: 'buchanan-v-warley',
      label:
        'Buchanan v. Warley, 245 U.S. 60 (1917); official United States Reports, Library of Congress.',
      url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep245/usrep245060/usrep245060.pdf',
    },
    {
      id: 'corrigan-v-buckley',
      label:
        'Corrigan v. Buckley, 271 U.S. 323 (1926); official United States Reports, Library of Congress.',
      url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep271/usrep271323/usrep271323.pdf',
    },
    {
      id: 'nps-shelley-nomination',
      label:
        'National Park Service, "The Shelley House," National Historic Landmark / National Register of Historic Places nomination (reference number 88000437), Sections 7–8.',
      url: 'https://npgallery.nps.gov/GetAsset/65b2786a-d538-410e-855e-f8b72a5d053e',
      locator: 'Sec. 8, pp. 9–14',
    },
    {
      id: 'nps-housing-theme-study',
      label:
        'National Park Service, National Historic Landmarks Program, "Civil Rights in America: Racial Discrimination in Housing" (theme study, 2021).',
      url: 'https://irma.nps.gov/DataStore/DownloadFile/702657',
      locator: 'Part One, pp. 10–13; Part Four, pp. 49–50',
    },
    {
      id: 'umn-mapping-prejudice',
      label:
        'Kirsten Delegard and Kevin Ehrman-Solberg, "‘Playground of the People’? Mapping Racial Covenants in Twentieth-century Minneapolis," Open Rivers, Issue Six (Spring 2017), University of Minnesota Libraries Publishing.',
      url: 'https://openrivers.lib.umn.edu/article/mapping-racial-covenants-in-twentieth-century-minneapolis/',
    },
    {
      id: 'uw-covenants-project',
      label:
        'University of Washington Civil Rights and Labor History Consortium, with Eastern Washington University, "Racial Restrictive Covenants Project."',
      url: 'https://depts.washington.edu/covenants/about.shtml',
    },
    {
      id: 'usccr-1973-fair-housing',
      label:
        'U.S. Commission on Civil Rights, "Understanding Fair Housing," Clearinghouse Publication 42 (February 1973).',
      url: 'https://www.usccr.gov/files/historical/1973/73-004.pdf',
    },
    {
      id: 'richmond-holc-how-and-why',
      label:
        'Todd M. Michney, "How and Why the Home Owners’ Loan Corporation Made Its Redlining Maps," Mapping Inequality, Digital Scholarship Lab, University of Richmond.',
      url: 'https://dsl.richmond.edu/panorama/redlining/howandwhy',
    },
    {
      id: 'nara-holc-area-description',
      label:
        'Home Owners’ Loan Corporation, "Area Description," NS Form-8 (rev. 6-1-37), front and printed instructions on reverse; Record Group 195, National Archives at College Park.',
      url: 'https://catalog.archives.gov/id/326761289',
      locator: 'Charlotte, N.C., Security Map and Area Description No. 1',
    },
    {
      id: 'fhlb-review-1936',
      label:
        'Federal Home Loan Bank Board, "Security Maps for Analysis of Mortgage Lending Areas" and "Instructions for Making Security Maps," Federal Home Loan Bank Review 2(11), August 1936, pp. 389–391; FRASER.',
      url: 'https://fraser.stlouisfed.org/title/federal-home-loan-bank-review-116/august-1936-2025/fulltext',
    },
    {
      id: 'usccr-1961-housing',
      label:
        'U.S. Commission on Civil Rights, Report of the U.S. Commission on Civil Rights, 1961, Book 4: Housing; Thurgood Marshall Law Library, University of Maryland.',
      url: 'https://www2.law.umaryland.edu/marshall/usccr/documents/cr11961bk4.pdf',
      locator: 'p. 62; notes 40–41',
    },
    {
      id: 'fha-annual-report-1959',
      label: 'Federal Housing Administration, 26th Annual Report (calendar year 1959); HUD USER.',
      url: 'https://www.huduser.gov/portal/sites/default/files/pdf/26TH-ANNUAL-REPORT-FEDERAL-HOUSING-ADMINISTRATION.pdf',
    },
    {
      id: 'mapping-inequality',
      label:
        'Robert K. Nelson, LaDale Winling, et al., "Mapping Inequality: Redlining in New Deal America," Digital Scholarship Lab, University of Richmond.',
      url: 'https://dsl.richmond.edu/panorama/redlining/',
      locator: 'Area D-30, Near North Side, Chicago',
    },
    {
      id: 'fha-manual-1938',
      label:
        'Federal Housing Administration, Underwriting Manual (1938 edition), paragraph 935, digitized by FRASER, Federal Reserve Bank of St. Louis.',
      url: 'https://fraser.stlouisfed.org/files/docs/publications/fha/1938feb_fha_underwritingmanual.pdf',
      locator: '¶935',
    },
    {
      id: 'aaronson-holc',
      label:
        'Daniel Aaronson, Daniel Hartley & Bhashkar Mazumder, "The Effects of the 1930s HOLC ‘Redlining’ Maps," American Economic Journal: Economic Policy 13(4), 2021.',
      url: 'https://www.aeaweb.org/articles?id=10.1257/pol.20190414',
    },
    {
      id: 'cfpb-contract-for-deed',
      label:
        'Consumer Financial Protection Bureau, "Report on Contract for Deed Lending" (August 2024), chapter 3 and Appendix A.',
      url: 'https://files.consumerfinance.gov/f/documents/cfpb_contract-for-deed_report_2024-08.pdf',
    },
    {
      id: 'uic-voorhees-plunder',
      label:
        'Nathalie P. Voorhees Center for Neighborhood and Community Improvement, University of Illinois Chicago, on "The Plunder of Black Wealth in Chicago" (Samuel DuBois Cook Center on Social Equity, Duke University, May 2019).',
      url: 'https://voorheescenter.uic.edu/reports/',
    },
    {
      id: 'loyola-contract-buyers-league',
      label:
        'Center for Urban Research and Learning, Loyola University Chicago, "Jack Macnamara (1937–2020)," on the Contract Buyers League.',
      url: 'https://www.luc.edu/curl/stories/archive/jackmacnamara.shtml',
    },
    {
      id: 'house-historian-fair-housing',
      label:
        'U.S. House of Representatives, Office of the Historian, "The Fair Housing Act of 1968," Historical Highlights.',
      url: 'https://history.house.gov/Historical-Highlights/1951-2000/hh_1968_04_10/',
    },
    {
      id: 'civil-rights-act-1968',
      label:
        'Civil Rights Act of 1968, Public Law 90-284, 82 Stat. 73; Title VIII secs. 810–813 at 82 Stat. 85–88. U.S. Government Publishing Office.',
      url: 'https://www.govinfo.gov/content/pkg/STATUTE-82/pdf/STATUTE-82-Pg73.pdf',
      locator: 'secs. 810, 812, 813',
    },
    {
      id: 'doj-fair-housing-1968',
      label:
        'U.S. Department of Justice, Civil Rights Division, "1968 and the Beginnings of Federal Enforcement of Fair Housing."',
      url: 'https://www.justice.gov/crt/1968-and-beginnings-federal-enforcement-fair-housing1',
    },
    {
      id: 'hud-cityscape-fair-housing',
      label:
        'Michael H. Schill and Samantha Friedman, "The Fair Housing Amendments Act of 1988: The First Decade," Cityscape 4(3), 1999, HUD Office of Policy Development and Research.',
      url: 'https://www.huduser.gov/portal/Periodicals/CITYSCPE/VOL4NUM3/schill.pdf',
    },
    {
      id: 'fair-housing-amendments-1988',
      label:
        'Fair Housing Amendments Act of 1988, Public Law 100-430, 102 Stat. 1619; civil penalties at 102 Stat. 1630, effective date at sec. 13(a). U.S. Government Publishing Office.',
      url: 'https://www.govinfo.gov/content/pkg/STATUTE-102/pdf/STATUTE-102-Pg1619.pdf',
    },
    {
      id: 'fair-housing-act',
      label:
        'Civil Rights Act of 1968, Title VIII (Fair Housing Act), 42 U.S.C. §§ 3601 et seq.; U.S. Department of Justice.',
      url: 'https://www.justice.gov/crt/fair-housing-act-1',
    },
    {
      id: 'census-historical-housing',
      label: 'U.S. Census Bureau, Historical Census of Housing Tables, homeownership rates.',
      url: 'https://www.census.gov/data/tables/time-series/dec/coh-owner.html',
    },
    {
      id: 'ffiec-hmda-2023',
      label:
        'Federal Financial Institutions Examination Council, HMDA Data Browser, national aggregation, 2023.',
      url: 'https://ffiec.cfpb.gov/data-browser/',
    },
    {
      id: 'hud-paired-testing-2012',
      label:
        'Margery Austin Turner et al., "Housing Discrimination Against Racial and Ethnic Minorities 2012," The Urban Institute for HUD Office of Policy Development and Research, June 2013.',
      url: 'https://www.huduser.gov/portal/Publications/pdf/HUD-514_HDS2012.pdf',
    },
    {
      id: 'fhfa-appraisal-uad',
      label:
        'Jonathan Liles, "Exploring Appraisal Bias Using UAD Aggregate Statistics," FHFA Insights, Federal Housing Finance Agency, November 2, 2022.',
      url: 'https://www.fhfa.gov/blog/insights/exploring-appraisal-bias-using-uad-aggregate-statistics',
    },
    {
      id: 'brookings-devaluation',
      label:
        'Andre M. Perry, Jonathan Rothwell and David Harshbarger, "The devaluation of assets in Black neighborhoods: The case of residential property," Brookings Metro, November 27, 2018.',
      url: 'https://www.brookings.edu/articles/devaluation-of-assets-in-black-neighborhoods/',
    },
    {
      id: 'pave-action-plan',
      label:
        'Interagency Task Force on Property Appraisal and Valuation Equity, "Action Plan to Advance Property Appraisal and Valuation Equity" (March 2022), HUD archive copy.',
      url: 'https://archives.hud.gov/pave.hud.gov/actionplan.cfm',
    },
    {
      id: 'fed-mortgage-bias',
      label:
        'Neil Bhutta, Aurel Hizmo and Daniel Ringo, "How Much Does Racial Bias Affect Mortgage Lending?", Finance and Economics Discussion Series 2022-067, Board of Governors of the Federal Reserve System, October 2022.',
      url: 'https://www.federalreserve.gov/econres/feds/how-much-does-racial-bias-affect-mortgage-lending.htm',
    },
    {
      id: 'scf-2022',
      label: 'Board of Governors of the Federal Reserve System, Survey of Consumer Finances, 2022.',
      url: 'https://www.federalreserve.gov/econres/scfindex.htm',
    },
  ],
  body: [
    // ---- Era 1911: the covenant era opens ----
    { type: 'heading', level: 2 as const, text: '1911 · The clause goes into the deed' },
    {
      type: 'paragraph',
      text: 'You are not in the room for this, and you are not meant to be. In February 1911, on the stretch of Labadie Avenue in St. Louis that runs between Taylor Avenue and Cora Avenue, thirty of the thirty-nine people who own property on both sides of the street sign an agreement about who is allowed to live there [ref:shelley-v-kraemer]. They are not selling anything that day. They are fastening a condition to the ground itself, for a term of fifty years, so that it rides along with the land through every sale that comes after. The district the agreement describes holds fifty-seven parcels, and the thirty who signed hold title to forty-seven of them [ref:shelley-v-kraemer]. The records disagree about the exact day: the Supreme Court’s opinion says the agreement was signed on February 16, while the Park Service’s landmark file for one of the houses dates it February 6 [ref:shelley-v-kraemer][ref:nps-shelley-nomination]. What nobody disputes is the month, the fifty-year term, and the fact that the paper is built to outlive every person who signed it.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_shelley_restrictive_covenant_st_louis_1911',
    },
    {
      type: 'paragraph',
      text: 'Cities were also doing this work out in the open, by ordinance, and that is the route that closes first. In 1914 Louisville passes a law forbidding anyone to move onto a block where most of the houses are occupied by people of the other race. A white owner named Buchanan agrees to sell a lot to a Black buyer named Warley; Warley declines to complete the purchase, since the ordinance would bar him from living in the house he is buying; and Buchanan goes to court to force the sale through [ref:buchanan-v-warley]. On November 5, 1917, the Supreme Court strikes the ordinance down. The case arrives as a property case, and it is decided on the Fourteenth Amendment’s protection of property, resting on an owner’s right to dispose of what he owns rather than on a buyer’s right to acquire it: "Property is more than the mere thing which a person owns. It is elementary that it includes the right to acquire, use, and dispose of it" [ref:buchanan-v-warley]. The opinion describes that right as running to Black and white owners alike, and it also states, in terms, that Black citizens have the right to buy property free of state laws discriminating against them [ref:buchanan-v-warley].',
    },
    {
      type: 'paragraph',
      text: 'What that ruling shuts is the public road. It says nothing about what private owners may agree among themselves, and the industry reads it that way immediately. The National Association of Real Estate Boards responds that the decision leaves neighborhood organizations and individual owners free to go on discriminating by race [ref:nps-housing-theme-study]. Covenants like the one on Labadie Avenue already existed, and after 1917 they multiply. The Park Service’s file on the St. Louis house counts thirty-five racial covenants drawn up across the whole decade of the 1910s, and two hundred eighty-six in the decade that followed [ref:nps-shelley-nomination]. Nothing has been repealed. The work has moved off the statute book, where a court can reach it, and into the deed, where for the moment no court will.',
    },
    {
      type: 'paragraph',
      text: 'In 1926 the Court is asked to reach into the deed anyway, and declines. Corrigan v. Buckley comes up from the District of Columbia, where owners had signed a covenant of the same kind and then gone to court to stop a sale. On May 24 the Court dismisses the appeal for want of jurisdiction, holding that the constitutional questions are insubstantial, because the Fifth, Thirteenth, and Fourteenth Amendments reach government action and not agreements between private individuals about their own property [ref:corrigan-v-buckley]. For the next twenty-two years the clause in the deed is a thing a judge will enforce.',
    },
    {
      type: 'paragraph',
      text: 'How much ground those clauses covered is still being counted, one scanned page at a time, a century later. At the University of Minnesota, the Mapping Prejudice project ran optical character recognition across every warranty deed abstract recorded in Hennepin County between 1900 and 1960, more than 1.4 million records, then had volunteers confirm each hit by eye: roughly 25,000 restricted deeds in that one county [ref:umn-mapping-prejudice]. At the University of Washington, a survey the state legislature ordered in 2021 has gone through more than seven million property records and found restrictions covering more than 37,000 properties in King County alone, and more than 80,000 across the state [ref:uw-covenants-project]. Neither figure is a national total. Nobody has a national total. The counting is not finished.',
    },

    // ---- Era 1935: the federal grade ----
    { type: 'heading', level: 2 as const, text: '1935 · Someone grades your block' },
    {
      type: 'paragraph',
      text: 'A generation on, a second kind of paper arrives on your street, and this one is federal. Congress created the Home Owners’ Loan Corporation in June 1933, in the middle of the foreclosure wave, to buy up mortgages that were failing and write them back as long loans at lower rates. It moved fast, and in its first three years it refinanced more than a million homes, something close to a fifth of all the owner-occupied houses in the country [ref:usccr-1973-fair-housing][ref:richmond-holc-how-and-why]. Of that million and more, going by the 1940 housing census, fewer than 25,000 went to non-white owners [ref:usccr-1973-fair-housing][ref:richmond-holc-how-and-why].',
    },
    {
      type: 'paragraph',
      text: 'In 1935, with most of that lending already behind it, the corporation started a second job: surveying the cities it had been lending in. The City Survey ran to 1940 and covered more than two hundred of them, aiming at every city with more than forty thousand people [ref:richmond-holc-how-and-why]. A field agent would spend three to six weeks in a town, mailing questionnaires to local bankers, realtors and appraisers, then sitting down with a dozen or two of them, and what they said went onto a printed form [ref:richmond-holc-how-and-why].',
    },
    {
      type: 'paragraph',
      text: 'You can hold that form. It is NS Form-8, "Area Description," a single sheet printed on both sides, fifteen numbered items on the front and fifteen matching instructions on the back [ref:nara-holc-area-description]. Item 1 takes the city, the security grade and the area number. Item 2 is the terrain. Items 3 and 4 are favorable and detrimental influences. Item 5 is headed "Inhabitants," and it has seven parts: type, estimated annual family income, foreign-born and which nationality and what percent, then "d. Negro (Yes or No)" and a percentage, then "e. Infiltration of," then relief families, then whether the population is increasing, decreasing or static [ref:nara-holc-area-description]. Turn the sheet over and the government explains how to fill that line in. The instruction for item 5e asks whether there is "any threat of infiltration of foreign born, negro or lower grade population," and then supplies the wording to use: "indicate these by nationality and rate of infiltration like this: ‘Negro - rapid’" [ref:nara-holc-area-description]. The example is printed on the form. Someone drafted that phrasing, and someone approved it, so that the man walking your block would know how to write it down correctly.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_holc_ns_form8_area_description_1937',
    },
    {
      type: 'paragraph',
      text: 'There were four grades, and their official names were printed in the corporation’s own trade journal in August 1936, under the heading "Instructions for Making Security Maps": "A" Best, "B" Still desirable, "C" Definitely declining, "D" Hazardous [ref:fhlb-review-1936]. Each category got a color so that a map could be read at a glance [ref:fhlb-review-1936]; on the maps that survive, A is green, B blue, C yellow, and D red [ref:mapping-inequality]. Nobody knocks on your door to tell you your grade. It attaches to the address rather than to the person applying, which means it is already sitting there, finished, before you have said a word about yourself. Here is how one graded area came out on the Near North Side of Chicago, in the flat official hand of men who never once pictured the people they were describing reading it back to them [ref:mapping-inequality].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_holc_area_d30_near_north_chicago_1940',
    },
    {
      type: 'paragraph',
      text: 'What became of those maps is not quite the story usually told about them. The corporation printed only six sets, kept three in Washington, sent the others to its regional and state offices, and refused copies to the very appraisers who had helped make them; it had also finished the overwhelming majority of its own lending before the first map existed [ref:richmond-holc-how-and-why]. One set went to the Federal Housing Administration, which did use maps of this kind to decide where it would insure a mortgage, and which had been drawing its own since 1934 [ref:richmond-holc-how-and-why]. The method itself was never a secret in any case. That August 1936 article was published so that any lender in the country could sit down and build the same map at home [ref:fhlb-review-1936].',
    },
    {
      type: 'paragraph',
      text: 'Researchers have since gone back to those boundaries to measure how long the ink lasted, and the answer is difficult to sit with. Working from the actual 1930s grade lines and comparing what happened on either side of them, Aaronson, Hartley, and Mazumder found that the grade a block received during the Depression produced measurably different access to credit and different neighborhood trajectories for decades afterward, long after the maps themselves had been shelved and forgotten [ref:aaronson-holc]. A line a clerk drew in 1937 was still deciding who could borrow, in neighborhoods he did not live to see, for families who had never heard his name.',
    },

    // ---- Era 1938: the manual ----
    { type: 'heading', level: 2 as const, text: '1938 · You fill out the form' },
    {
      type: 'paragraph',
      text: 'You are sitting across a desk from a man who is about to decide whether the government will stand behind your mortgage, and he is entirely relaxed about it, because for him this is a Tuesday. He is not improvising. He is working from a manual you will never be handed and were never meant to see, though you can read it now, all these years later, over his shoulder: the Federal Housing Administration’s 1938 Underwriting Manual, paragraph 935, which sets out for him, in careful government prose, what a good neighborhood, the kind worth lending in, is supposed to look like [ref:fha-manual-1938].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fha_underwriting_manual_1938_para935',
    },
    {
      type: 'paragraph',
      text: 'The word the manual has for you is "inharmonious." Look at what it does not ask. It does not ask whether you pay your bills on time, or how long you have been saving, or whether you have ever missed a payment in your life. It asks who lives next to you, and then it instructs the appraiser to protect the loan against people like you moving in, as though you were weather the house needed insuring against.',
    },
    {
      type: 'paragraph',
      text: 'And that paragraph is not alone in there. A paragraph earlier the manual has already ranked the available tools: "Deed restrictions are apt to prove more effective than a zoning ordinance in providing protection from adverse influences" [ref:fha-manual-1938]. Two paragraphs on it states the principle without any hedging at all: "If a neighborhood is to retain stability, it is necessary that properties shall continue to be occupied by the same social and racial classes" [ref:fha-manual-1938]. It reaches the schools, warning the appraiser about any area where children would be "compelled to attend school where the majority or a considerable number of the pupils represent a far lower level of society or an incompatible racial element" [ref:fha-manual-1938]. And at paragraph 980 it tells a developer what to write into his deeds, advising that a high rating should generally go only where "effective restrictive covenants are recorded against the entire tract," running at least twenty-five to thirty years [ref:fha-manual-1938]. The recommended provisions are given as a list, and it runs from single-family use and spacing between buildings and approval of designs through to item (g): "Prohibition of the occupancy of properties except by the race for which they are intended" [ref:fha-manual-1938].',
    },
    {
      type: 'paragraph',
      text: 'So the clause that thirty owners fastened to Labadie Avenue in 1911 is, by 1938, a thing the United States government recommends to you in a numbered list, sitting between a provision about fences and a provision about enforcement.',
    },
    {
      type: 'paragraph',
      text: 'How much of the country’s housing this shaped is a question the agency cannot answer, because it never counted. Asked years later what its insured mortgages had done along racial lines, the Federal Housing Administration reported that it held no information on non-white use of FHA-insured mortgages at all [ref:usccr-1961-housing]. By the end of 1959 it had insured $41.4 billion on 5.2 million home mortgages [ref:fha-annual-report-1959]. How many of those went to Black families is not a number anyone can look up, because nobody at the agency ever wrote it down.',
    },
    {
      type: 'paragraph',
      text: 'What did get counted was the result. In 1940, the first year the census measures it, about 24 in 100 Black households own the roof over their heads, against about 53 in 100 white households [ref:census-historical-housing].',
    },
    {
      type: 'pullquote',
      text: 'The rule never asked whether you paid your debts. It asked who your neighbors were.',
    },

    // ---- Era 1948: the covenant dies, the market does not ----
    { type: 'heading', level: 2 as const, text: '1948 · The words stay in the deed' },
    {
      type: 'paragraph',
      text: 'On May 3, 1948, in [[ent_case_shelley_v_kraemer_1948|Shelley v. Kraemer]], the Court finally reaches the clause on Labadie Avenue. J. D. Shelley, a laborer who had come up to St. Louis from Mississippi in 1930 with his wife and their six children, received a warranty deed to the house at 4600 Labadie on August 11, 1945. The sale had been arranged through a real estate dealer who was acting as the Shelleys’ own agent while quietly holding title himself, in the name of a third party, and not telling them so. The trial court found that the Shelleys had no actual knowledge of the restrictive agreement when they bought [ref:shelley-v-kraemer]. Louis Kraemer and his wife, who owned other property on the same street bound by the same 1911 agreement, sued to stop the Shelleys from taking title, and the Supreme Court of Missouri ordered the covenant enforced [ref:shelley-v-kraemer][ref:nps-shelley-nomination]. The Supreme Court reversed. The Park Service’s file on the house records the vote as six to nothing, with three justices not sitting [ref:nps-shelley-nomination]. And then the opinion drew the line precisely where the private paper began: agreements like this one, standing alone, do not violate any right guaranteed by the Fourteenth Amendment, and owners remain free to honor them voluntarily. What is unconstitutional is a state court enforcing one, because "the action of state courts and judicial officers in their official capacities is to be regarded as action of the State" [ref:shelley-v-kraemer]. The words stay in the deed. Only the judge steps back.',
    },
    {
      type: 'paragraph',
      text: 'Seven years later, in August 1955, a family named James sits down in Chicago to buy a house. The seller is a speculator named Charles Peters, and the price is $13,500. Peters had bought the same house thirteen days earlier for $8,000 [ref:cfpb-contract-for-deed].',
    },
    {
      type: 'paragraph',
      text: 'What they sign is not a mortgage, and the difference is the entire story. Under a mortgage you own the house from the first day and the lender holds a claim against it. Under a contract for deed, the seller keeps legal title until the last payment clears, and until that day you have possession and nothing else [ref:cfpb-contract-for-deed]. You carry the repairs, the property taxes and the improvements, and everything you put into the building becomes part of a house that is not yet yours [ref:cfpb-contract-for-deed]. There is no appraisal, no inspection, and no title search [ref:cfpb-contract-for-deed]. The terms in this case are $1,000 down, $105 a month, and a three-year term ending in a balloon payment of $10,500, which Peters says he will help them finance when it comes due [ref:cfpb-contract-for-deed]. Peters told them he was offering the arrangement because they might have trouble getting a loan, being, as he put it, "colored" [ref:cfpb-contract-for-deed].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_cfpb_contract_for_deed_2024',
    },
    {
      type: 'paragraph',
      text: 'After a year Peters sells the contract at a discount to another investor and stops answering for it. When the balloon payment comes due the family goes to six banks, and all six refuse, because the house is not worth $10,500 [ref:cfpb-contract-for-deed]. They are evicted. The down payment, three years of monthly payments, and everything they put into the building stay with the seller [ref:cfpb-contract-for-deed]. Eviction is not a mishap in this arrangement; it is the point of choosing it. Miss a payment on an ordinary mortgage and a clock starts: federal rules give a borrower 120 days before foreclosure can even begin, the foreclosure itself has to go through a court, and if the house sells for more than the debt, the surplus comes back to the borrower [ref:cfpb-contract-for-deed]. A contract for deed carries none of those. Being late once can be enough to end it [ref:cfpb-contract-for-deed].',
    },
    {
      type: 'paragraph',
      text: 'Why the James family is signing this instead of a mortgage runs straight back through the two sections above, and the federal government now says so in its own voice. Setting out the history in 2024, the Consumer Financial Protection Bureau writes that from the 1930s through the 1960s Black borrowers were largely excluded from the mainstream home mortgage market, and that given that lack of access to ordinary credit, contracts for deed were often the only way left to finance a house [ref:cfpb-contract-for-deed]. The report names what did the excluding: the redlining institutionalized after 1933, and the underwriting manual quoted a few paragraphs ago [ref:cfpb-contract-for-deed].',
    },
    {
      type: 'paragraph',
      text: 'This was not a handful of unusually cruel sellers. Researchers at the Samuel DuBois Cook Center on Social Equity at Duke University, working with the University of Illinois Chicago through more than 50,000 documents of depositions, pleadings and property records, found that between 75 and 95 percent of the homes sold to Black families in Chicago during the 1950s and 1960s were sold on contract, and that those buyers paid on average 84 percent more than the speculator had paid for the same house days or months before [ref:uic-voorhees-plunder][ref:cfpb-contract-for-deed]. A speculator could recover his entire investment in about two years [ref:cfpb-contract-for-deed].',
    },
    {
      type: 'mapInset',
      entityId: 'ent_bronzeville_001',
      label: 'Bronzeville, Chicago, Illinois',
    },
    {
      type: 'paragraph',
      text: 'Chicago’s contract buyers organized, and what came of it deserves to be stated without rounding. The Contract Buyers League set out to stop the sales, renegotiate the contracts families were already trapped in, and open real lines of credit to Black borrowers [ref:cfpb-contract-for-deed]. Loyola University Chicago’s Center for Urban Research and Learning records that the League ran a planned payment strike and two federal lawsuits, and that 450 families had their contracts renegotiated, at an average saving of $13,500 each [ref:loyola-contract-buyers-league]. That is a real number of real kitchens. It was won by the families themselves, on terms they forced, roughly a decade after the James family lost everything they had paid in.',
    },
    {
      type: 'paragraph',
      text: 'Step back from the block, and the decade reads like progress. By 1950 the Black homeownership rate has climbed to about 35 in 100, and by 1960 to about 38 in 100. But white ownership is climbing across the same years, from about 55 in 100 to about 65 in 100 [ref:census-historical-housing]. Both lines rise together, and the space between them does not close.',
    },
    {
      type: 'figure',
      packetId: 'tip_buying_a_home_era',
      metricIds: [
        'census-decennial-homeownership-black-nation',
        'census-decennial-homeownership-white_nh-nation',
      ],
      caption:
        'Homeownership rate by race, United States, decennial census, 1940–1980. Both lines rise together; the gap between them never closes.',
    },

    // ---- Era 1968: the law, and what was taken out of it ----
    { type: 'heading', level: 2 as const, text: '1968 · The law arrives with its teeth pulled' },
    {
      type: 'paragraph',
      text: 'A federal open housing bill has been in front of Congress for more than a year. The Senate passes it on March 11, 1968, and in the House it stops moving [ref:house-historian-fair-housing]. On April 4, Martin Luther King Jr. is killed in Memphis. The House historian’s own account of that week says King’s murder "changed the calculus for passage" [ref:house-historian-fair-housing]. On April 10 the House takes up the Senate’s bill and adopts it, 250 to 172 [ref:house-historian-fair-housing]. President Johnson signs it the following day, April 11 [ref:civil-rights-act-1968]. What he signs bans discrimination in the sale, rental and financing of housing, and it is the sentence this chapter has been waiting for since 1911 [ref:fair-housing-act].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fair_housing_act_1968_doj',
    },
    {
      type: 'paragraph',
      text: 'Then there is the part that is easy to miss, because it is not in the promise, it is in the plumbing. To move the bill through the Senate, its enforcement machinery had been taken out. The version its sponsors introduced would have let the housing department investigate complaints, hold evidentiary hearings and issue enforcement orders; an amendment stripped most of that away before passage [ref:hud-cityscape-fair-housing]. What survived is section 810(a), and it is worth reading in the statute’s own words: if the Secretary decides to resolve a complaint, he "shall proceed to try to eliminate or correct the alleged discriminatory housing practice by informal methods of conference, conciliation, and persuasion" [ref:civil-rights-act-1968].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fair_housing_act_1968_sec810_conciliation',
    },
    {
      type: 'paragraph',
      text: 'Conference, conciliation and persuasion. That is the whole toolkit. The Justice Department’s own history of the period puts it without softening: the bill authorized the department to conciliate but gave the Secretary no cease and desist authority [ref:doj-fair-housing-1968]. If conciliation fails, the statute gives the person who was discriminated against thirty days to go file their own lawsuit in federal court [ref:civil-rights-act-1968]. In that lawsuit, punitive damages are capped at $1,000, and the court may award attorney’s fees only if it finds the plaintiff is not financially able to pay them [ref:civil-rights-act-1968]. The right is real. The remedy is priced where most of the people holding the right cannot reach it, and the Attorney General may step in only where there is a pattern or practice, or where the case raises an issue of general public importance [ref:civil-rights-act-1968].',
    },
    {
      type: 'paragraph',
      text: 'So the law changes, and then you wait to see what changes with it. In 1985, seventeen years on, the typical Black household brings in $38,630 while the typical white non-Hispanic household brings in $66,390 [ref:census-historical-housing]. About 44 in 100 Black households own their home, against about 68 in 100 white households [ref:census-historical-housing]. The rule that stacked the deck is off the books, and the deck stays stacked, because a house was never only a place to sleep. It is the largest thing most American families ever own and the main thing they hand to their children. Striking a rule does not go back and buy the houses that were never bought, or write the down-payment check a parent never got to write, because that parent was shut out too.',
    },
    {
      type: 'paragraph',
      text: 'The enforcement that came out in 1968 goes back in on September 13, 1988, when the Fair Housing Amendments Act gives the housing department administrative law judges who can order relief and assess civil penalties: up to $10,000 for a first violation, $25,000 for a second within five years, $50,000 for a third within seven [ref:fair-housing-amendments-1988]. It takes effect on the 180th day after enactment, March 12, 1989 [ref:fair-housing-amendments-1988]. Twenty years and eleven months separate the promise from the machinery for keeping it.',
    },

    // ---- Present-day close ----
    { type: 'heading', level: 2 as const, text: 'Today · You apply online' },
    {
      type: 'paragraph',
      text: 'Come all the way forward and the desk is gone. You never meet an appraiser. You upload your documents to a website, software you will never see scores them, and nowhere in the entire process does anyone get instructed to think about who your neighbors are. On its face it is perfectly fair, and that is what makes the ending strange. The newest federal numbers still read a great deal like the oldest ones in this chapter. In 2023, about 46 in 100 Black households own their homes, against about 74 in 100 white non-Hispanic households [ref:census-historical-housing]. Set that beside 1940, when the same count came to about 24 in 100 against 53 in 100, and the distance between the two lines has barely moved in eighty-three years.',
    },
    {
      type: 'stat',
      packetId: 'tip_buying_a_home_era',
      kind: 'observation' as const,
      refId: 'obs:acs-homeownership-rate-black-nation:nation:US:2023',
      caption: 'Black homeownership rate, United States, 2023.',
    },
    {
      type: 'stat',
      packetId: 'tip_buying_a_home_era',
      kind: 'observation' as const,
      refId: 'obs:acs-homeownership-rate-white_nh-nation:nation:US:2023',
      caption: 'White non-Hispanic homeownership rate, United States, 2023.',
    },
    {
      type: 'paragraph',
      text: 'The refusals have not gone anywhere either. They have gone quiet, moved off the paper and into the software, where nobody has to sign their name to one. In 2023 a Black applicant is turned down for a mortgage 6.3 percentage points more often than a white non-Hispanic applicant [ref:ffiec-hmda-2023], and no one in that process has to write down why, or even know they are part of a pattern.',
    },
    {
      type: 'stat',
      packetId: 'tip_buying_a_home_era',
      kind: 'observation' as const,
      refId: 'obs:hmda-denial-rate-gap-black-white-nh-nation:nation:US:2023',
      caption: 'Black–white non-Hispanic mortgage denial-rate gap, 2023.',
    },
    {
      type: 'paragraph',
      text: 'The appraiser did not disappear, either, and neither did the person showing you the house. HUD’s national paired-testing study sent equally qualified buyers to the same agents and found that for every two visits, Black and Asian homebuyers learned about one fewer available home than white buyers with identical finances; HUD calls its own figures a conservative lower bound on what is happening in the market [ref:hud-paired-testing-2012]. On valuation, the Federal Housing Finance Agency reported that in 2021, 23.3 percent of homes in tracts more than 80 percent minority appraised below the price the buyer had already agreed to pay, against 13.4 percent of homes in majority-white tracts [ref:fhfa-appraisal-uad]. The agency is careful about what that comparison is and is not: it is a raw count, not adjusted for the characteristics of the houses, and it says controlling for those characteristics may explain some of the gap but is not likely to explain all of it [ref:fhfa-appraisal-uad]. The adjusted version was measured separately. Comparing homes of similar quality in neighborhoods with similar amenities across 113 metropolitan areas, Brookings researchers found homes in majority-Black neighborhoods valued about 23 percent lower, which they worked out to roughly $48,000 for an average home and about $156 billion in total [ref:brookings-devaluation]. In 2021, on the centennial of the Tulsa Race Massacre, the federal government stood up an interagency task force on appraisal bias [ref:pave-action-plan].',
    },
    {
      type: 'paragraph',
      text: 'Which leaves the software, and here the honest answer is stranger than the tidy one. It would be neat to say the algorithm simply inherited the appraiser’s prejudice. Economists at the Federal Reserve Board, comparing human and automated credit decisions, found instead that observable measures of risk explain most of the racial gap in mortgage denials, and that differential treatment by lenders plays a limited part in producing it, leaving a residual gap of one to two percentage points [ref:fed-mortgage-bias]. In the same paper they report that minority applicants are less likely to be approved by race-blind government automated underwriting systems, arriving as they do with lower credit scores and higher leverage [ref:fed-mortgage-bias]. The system is not reading your race. It is reading a credit score, a down payment and a debt load. Every rule quoted in this chapter operated on those same three things, and none of the three is distributed evenly today.',
    },
    {
      type: 'paragraph',
      text: 'And here is where the whole century finally surfaces, in what a family is actually worth. In 2022 the typical Black family has $44,900 to its name, while the typical white family has $285,000 [ref:scf-2022]. Read that for what it is. The covenant, the grade, the manual and the contract, every one of them struck down, shelved or outlawed years ago, all carried forward into that one pair of numbers. Rules do not have to still be on the books to keep working. They moved into the family a long time ago, one house at a time.',
    },
    {
      type: 'stat',
      packetId: 'tip_buying_a_home_era',
      kind: 'observation' as const,
      refId: 'obs:scf-median-wealth-black-nation:nation:US:2022',
      caption: 'Median family net worth, Black families, 2022.',
    },
    {
      type: 'stat',
      packetId: 'tip_buying_a_home_era',
      kind: 'observation' as const,
      refId: 'obs:scf-median-wealth-white-nation:nation:US:2022',
      caption: 'Median family net worth, White non-Hispanic families, 2022.',
    },
    {
      type: 'heading',
      level: 3 as const,
      text: 'The record, in order',
    },
    {
      type: 'paragraph',
      text: 'Every rule quoted here is sitting in an archive right now with its own date stamped on it, and none of it needs us in order to be believed: an agreement signed by thirty property owners, a survey form filled out block by block, a paragraph of federal underwriting guidance, a contract that kept the deed in the seller’s drawer, a statute that promised a right and priced the remedy out of reach, and the amendments that took twenty years to arrive. Line them up and read them in order. They are not a story we are telling you. They are a story the country told about itself, in its own handwriting, on its own letterhead, and never quite got around to taking back.',
    },
    {
      type: 'timeline',
      packetId: 'tip_buying_a_home_era',
    },
  ],
};

export default buyingAHomeArticle;
