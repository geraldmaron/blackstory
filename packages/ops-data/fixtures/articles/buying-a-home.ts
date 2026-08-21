/**
 * Flagship article: "Buying a Home" — the era-immersion redlining spine, built
 * on the /chapters surface.
 *
 * Voice is governed by docs/content/neo-voice.md and that document alone.
 * Part II: Law 1 (every era cold-opens on a person in a place at a time, second
 * person present tense held inside the era), Law 2 (every documented obstacle
 * gets a documented, cited pathway: Buchanan's suit, the Shelleys' deed, the
 * Contract Buyers League, the covenant-counting projects), Law 3 (the chapter
 * ends on cited agency, after the wealth figures land unsoftened, and the close
 * neither offsets nor resolves what came before).
 * Part III: the rule in force quoted verbatim, odds as plain comparisons with
 * exact figures left to the adjacent stat/figure blocks, jump-cuts between eras.
 * Part IV cadence spend: anaphora 1 run (the jeremiad), call-and-response 2,
 * one-sentence paragraphs 1, jeremiad 1 (closing third), reframing line 1
 * ("a house was never only a place to sleep"), flourish 1 (the final line).
 *
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
 * & Mazumder (2021) uses causal language, gated to that study’s
 * boundary-discontinuity design per docs/methodology/scholarship-principles.md §6,
 * and it is immediately answered by the opposing reading (Fishback, Rose, Snowden &
 * Storrs, NBER w29244), both attributed, dispute shown rather than resolved.
 * Every other pairing in this chapter is juxtaposition, and the CFPB’s own causal
 * account is attributed to the CFPB inside the sentence carrying it. Where the
 * record disagrees with itself (the February 1911 signing date), the disagreement
 * is shown rather than resolved.
 *
 * Race-specific homeownership figures in prose come from fetched primary tables:
 * the 1940 Census of Housing, Vol. II, Pt. 1, U.S. Summary Table 1 (white 45.7,
 * Negro 22.8 percent owner-occupied) and the Census CPS/HVS Annual Statistics 2023
 * Table 22 (Black 45.7, non-Hispanic white 74.3). 1985 incomes are Table H-5
 * nominal dollars with the 2024-dollar equivalents named as such.
 */

export const buyingAHomeArticle = {
  id: 'article_buying_a_home',
  slug: 'buying-a-home',
  title: 'Chapter: Buying a Home',
  summary:
    'For almost a hundred years the rules about who got to buy a home in America were written down. Not always where you could see them, but written down, in plain words, and they’re quoted here as written: a clause fastened to the land itself, a federal manual telling appraisers what protected a neighborhood, a contract that let a seller keep the deed and take the house back over one late payment. None of it came down as rumor. It’s all on paper, with dates on it, and so is the record of the people who sued, organized and counted their way back at it.',
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
      locator: '¶¶934, 935, 937, 951, 980',
    },
    {
      id: 'aaronson-holc',
      label:
        'Daniel Aaronson, Daniel Hartley & Bhashkar Mazumder, "The Effects of the 1930s HOLC ‘Redlining’ Maps," American Economic Journal: Economic Policy 13(4), 2021.',
      url: 'https://www.aeaweb.org/articles?id=10.1257/pol.20190414',
    },
    {
      id: 'fishback-holc-maps',
      label:
        'Price V. Fishback, Jonathan Rose, Kenneth A. Snowden & Thomas Storrs, "New Evidence on Redlining by Federal Housing Programs in the 1930s," NBER Working Paper 29244, September 2021.',
      url: 'https://www.nber.org/papers/w29244',
    },
    {
      id: 'cfpb-contract-for-deed',
      label:
        'Consumer Financial Protection Bureau, "Report on Contract for Deed Lending" (August 2024), chapter 3 and Appendix A.',
      url: 'https://files.consumerfinance.gov/f/documents/cfpb_contract-for-deed_report_2024-08.pdf',
    },
    {
      id: 'duke-cook-plunder',
      label:
        'Samuel DuBois Cook Center on Social Equity, Duke University, with the Voorhees Center, University of Illinois Chicago, "The Plunder of Black Wealth in Chicago" (May 2019).',
      url: 'https://socialequity.duke.edu/wp-content/uploads/2023/08/Plunder-of-Black-Wealth-in-Chicago.pdf',
      locator: 'Findings, pp. ii–iii',
    },
    {
      id: 'satter-family-properties',
      label:
        'Beryl Satter, Family Properties: Race, Real Estate, and the Exploitation of Black Urban America (New York: Metropolitan Books, 2009); Rutgers University-Newark.',
      url: 'https://www.newark.rutgers.edu/news/family-properties-chronicles-one-mans-battle-against-racist-financial-practices-1950s',
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
      id: 'census-1940-housing',
      label:
        'U.S. Census Bureau, 1940 Census of Housing, Volume II: General Characteristics, Part 1, United States Summary, Table 1, "Occupied Dwelling Units by Tenure and Population per Unit, by Race of Occupants."',
      url: 'https://www2.census.gov/library/publications/decennial/1940/housing-volume-2/housing-v2p1-ch2.pdf',
      locator: 'United States Summary, Table 1, p. 7',
    },
    {
      id: 'census-h5-income',
      label:
        'U.S. Census Bureau, Historical Income Tables: Households, Table H-5, "Race and Hispanic Origin of Householder — Households by Median and Mean Income."',
      url: 'https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx',
      locator: '1985 rows, Black and White Not Hispanic',
    },
    {
      id: 'census-hvs-homeownership-race',
      label:
        'U.S. Census Bureau, Current Population Survey / Housing Vacancy Survey, Annual Statistics 2023, Table 22, "Homeownership Rates by Race and Ethnicity of Householder: 1994 to 2023."',
      url: 'https://www.census.gov/housing/hvs/files/annual23/ann23t_22.xlsx',
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
      text: 'In February 1911, on the stretch of Labadie Avenue in St. Louis that runs between Taylor Avenue and Cora Avenue, thirty of the thirty-nine people who own property on both sides of the street sign their names to an agreement about who is allowed to live there [ref:shelley-v-kraemer]. You aren’t in that room, and the paper is drawn so that you never have to be. Nobody is selling anything that day. They’re fastening a condition to the ground itself, for a term of fifty years, so that it rides along with the land through every sale that comes after. The district the agreement describes holds fifty-seven parcels, and the thirty who signed hold title to forty-seven of them [ref:shelley-v-kraemer]. The records disagree about the exact day. The Supreme Court’s opinion says the agreement was signed on February 16; the Park Service’s landmark file for one of the houses dates it February 6 [ref:shelley-v-kraemer][ref:nps-shelley-nomination]. What nobody disputes is the month, the fifty-year term, and the fact that the paper is built to outlive every person who signed it.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_shelley_restrictive_covenant_st_louis_1911',
    },
    {
      type: 'paragraph',
      text: 'Cities were doing the same work out in the open, by ordinance, and that’s the route that closes first. In 1914 Louisville passes a law forbidding anyone to move onto a block where most of the houses are occupied by people of the other race. A white owner named Buchanan agrees to sell a lot to a Black buyer named Warley. Warley declines to complete the purchase, since the ordinance would bar him from living in the house he’s buying, and Buchanan goes to court to force the sale through [ref:buchanan-v-warley]. On November 5, 1917, the Supreme Court strikes the ordinance down. The case arrives as a property case, and it’s decided on the Fourteenth Amendment’s protection of property, resting on an owner’s right to dispose of what he owns rather than on a buyer’s right to acquire it: "Property is more than the mere thing which a person owns. It is elementary that it includes the right to acquire, use, and dispose of it" [ref:buchanan-v-warley]. The opinion describes that right as running to Black and white owners alike, and it states, in terms, that Black citizens have the right to buy property free of state laws discriminating against them [ref:buchanan-v-warley].',
    },
    {
      type: 'paragraph',
      text: 'What that ruling shuts is the public road. It says nothing about what private owners may agree among themselves, and the industry reads it that way immediately. The National Association of Real Estate Boards responds that the decision leaves neighborhood organizations and individual owners free to go on discriminating by race [ref:nps-housing-theme-study]. Covenants like the one on Labadie Avenue already existed, and after 1917 they multiply. The Park Service’s file on the St. Louis house counts thirty-five racial covenants drawn up across the whole decade of the 1910s, and two hundred eighty-six in the decade that followed [ref:nps-shelley-nomination]. Nothing has been repealed. The work has moved off the statute book, where a court can reach it, and into the deed, where for the moment no court will.',
    },
    {
      type: 'paragraph',
      text: 'In 1926 the Court is asked to reach into the deed anyway, and it declines. Corrigan v. Buckley comes up from the District of Columbia, where owners had signed a covenant of the same kind and then gone to court to stop a sale. On May 24 the Court dismisses the appeal for want of jurisdiction, holding that the constitutional questions are insubstantial, because the Fifth, Thirteenth, and Fourteenth Amendments reach government action and not agreements between private individuals about their own property [ref:corrigan-v-buckley]. For the next twenty-two years the clause in the deed is a thing a judge can enforce, and in state after state, does [ref:shelley-v-kraemer].',
    },
    {
      type: 'paragraph',
      text: 'How much ground those clauses covered is still being counted, one scanned page at a time, a century later. At the University of Minnesota, the Mapping Prejudice project ran optical character recognition across every warranty deed abstract recorded in Hennepin County between 1900 and 1960, more than 1.4 million records, then had volunteers confirm each hit by eye: roughly 25,000 restricted deeds in that one county [ref:umn-mapping-prejudice]. At the University of Washington, a survey the state legislature ordered in 2021 has gone through more than seven million property records and found restrictions covering more than 37,000 properties in King County alone, and more than 80,000 across the state [ref:uw-covenants-project]. Neither figure is a national total. Nobody has a national total. The counting isn’t finished.',
    },

    // ---- Era 1935: the federal grade ----
    { type: 'heading', level: 2 as const, text: '1935 · Someone grades your block' },
    {
      type: 'paragraph',
      text: 'A man comes to your city in 1935 and stays three to six weeks. He mails questionnaires to the local bankers, realtors and appraisers, sits down with a dozen or two of them, and puts what they tell him onto a printed form [ref:richmond-holc-how-and-why]. He doesn’t knock on your door.',
    },
    {
      type: 'paragraph',
      text: 'The outfit he works for is the Home Owners’ Loan Corporation, which Congress created in June 1933, in the middle of the foreclosure wave, to buy up mortgages that were failing and write them back as long loans at lower rates. It moved fast. In its first three years it refinanced more than a million homes, something close to a fifth of all the owner-occupied houses in the country [ref:usccr-1973-fair-housing][ref:richmond-holc-how-and-why]. Of that million and more, going by the 1940 housing census, fewer than 25,000 went to non-white owners [ref:usccr-1973-fair-housing][ref:richmond-holc-how-and-why].',
    },
    {
      type: 'paragraph',
      text: 'By 1935, with most of that lending already behind it, the corporation had started a second job: surveying the cities it had been lending in. The City Survey ran to 1940 and covered more than two hundred of them, aiming at every city with more than forty thousand people [ref:richmond-holc-how-and-why].',
    },
    {
      type: 'paragraph',
      text: 'You can hold the form he carries. It’s NS Form-8, "Area Description," a single sheet printed on both sides, fifteen numbered items on the front and fifteen matching instructions on the back [ref:nara-holc-area-description]. Item 1 takes the city, the security grade and the area number. Item 2 is the terrain. Items 3 and 4 are favorable and detrimental influences. Item 5 is headed "Inhabitants," and it has seven parts: type, estimated annual family income, foreign-born and which nationality and what percent, then "d. Negro (Yes or No)" and a percentage, then "e. Infiltration of," then relief families, then whether the population is increasing, decreasing or static [ref:nara-holc-area-description]. Turn the sheet over and the government explains how to fill that line in. The instruction for item 5e asks whether there’s "any threat of infiltration of foreign born, negro or lower grade population," and then supplies the wording to use: "indicate these by nationality and rate of infiltration like this: ‘Negro - rapid’" [ref:nara-holc-area-description]. The example is printed on the form, and it went to the printer that way.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_holc_ns_form8_area_description_1937',
    },
    {
      type: 'paragraph',
      text: 'There were four grades, and their official names were printed in the corporation’s own trade journal in August 1936, under the heading "Instructions for Making Security Maps": "A" Best, "B" Still desirable, "C" Definitely declining, "D" Hazardous [ref:fhlb-review-1936]. Each category got a color so that a map could be read at a glance [ref:fhlb-review-1936]; on the maps that survive, A is green, B blue, C yellow, and D red [ref:mapping-inequality]. Nobody tells you your grade. It attaches to the address rather than to the person applying, which means it’s already sitting there, finished, before you’ve said a word about yourself. Here is how one graded area came out on the Near North Side of Chicago, in the flat official hand of the men who filled the form in [ref:mapping-inequality].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_holc_area_d30_near_north_chicago_1940',
    },
    {
      type: 'paragraph',
      text: 'The maps themselves did less of the work than their reputation says, and the record of what they did do is worth being exact about. The corporation produced six full sets in all, kept three at headquarters, sent the others to its regional and state offices, and allowed none of the private appraisers and realtors who had helped make them to receive a copy [ref:richmond-holc-how-and-why]. By the time the first batch of maps existed, ninety-seven in every hundred of the corporation’s own refinancing loans had already closed [ref:richmond-holc-how-and-why]. The remaining set went to the Federal Housing Administration, which since 1935 had been drawing its own "Housing Market Analysis Maps," and which, unlike the corporation, did use them to deny mortgage insurance [ref:richmond-holc-how-and-why]. The method itself was never a secret in any case. That August 1936 article was published so that any lender in the country could sit down and build the same map at home [ref:fhlb-review-1936].',
    },
    {
      type: 'paragraph',
      text: 'Researchers have gone back to those boundaries to measure how long the ink lasted, and they disagree. Working from the actual 1930s grade lines and comparing what happened on either side of them, Aaronson, Hartley, and Mazumder report that the maps "led to reduced home ownership rates, house values, and rents and increased racial segregation in later decades," through reduced credit access and the disinvestment that followed [ref:aaronson-holc]. Other economic historians read the same records differently. Fishback, Rose, Snowden, and Storrs find the exclusion of these neighborhoods already in place before the maps existed and showing "little change after the drafting of those maps," and they conclude the maps themselves moved little [ref:fishback-holc-maps]. The dispute is about the maps. Neither side disputes the exclusion.',
    },

    // ---- Era 1938: the manual ----
    { type: 'heading', level: 2 as const, text: '1938 · You fill out the form' },
    {
      type: 'paragraph',
      text: 'You’re sitting across a desk from a man who’s about to decide whether the government will stand behind your mortgage. He’s entirely relaxed about it, because for him this is a Tuesday. He isn’t improvising either. He’s working from a manual you’ll never be handed and were never meant to see, though you can read it now, all these years later, over his shoulder. It’s the Federal Housing Administration’s 1938 Underwriting Manual, and paragraph 935 tells him in careful government prose what protects a location worth lending in [ref:fha-manual-1938].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fha_underwriting_manual_1938_para935',
    },
    {
      type: 'paragraph',
      text: 'The word the manual has for you is "inharmonious." What does paragraph 935 want to know about you? Not whether you pay your bills on time, not how long you’ve been saving, not whether you’ve ever missed a payment in your life. It asks what a hill or a park or a wide street keeps out, and it counts the prevention of "the infiltration of business and industrial uses, lower class occupancy, and inharmonious racial groups" as protection worth rating [ref:fha-manual-1938].',
    },
    {
      type: 'paragraph',
      text: 'And that paragraph isn’t alone in there. A paragraph earlier the manual has already ranked the available tools: "Deed restrictions are apt to prove more effective than a zoning ordinance in providing protection from adverse influences" [ref:fha-manual-1938]. Two paragraphs on it states the principle without any hedging at all: "If a neighborhood is to retain stability, it is necessary that properties shall continue to be occupied by the same social and racial classes" [ref:fha-manual-1938]. It reaches the schools, warning the appraiser about any area where children would be "compelled to attend school where the majority or a considerable number of the pupils represent a far lower level of society or an incompatible racial element" [ref:fha-manual-1938]. And at paragraph 980 it tells a developer what to write into his deeds, advising that a high rating should generally go only where "effective restrictive covenants are recorded against the entire tract," running at least twenty-five to thirty years [ref:fha-manual-1938]. The recommended provisions are given as a list, and it runs from single-family use and spacing between buildings and approval of designs through to item (g): "Prohibition of the occupancy of properties except by the race for which they are intended" [ref:fha-manual-1938].',
    },
    {
      type: 'paragraph',
      text: 'So the clause that thirty owners fastened to Labadie Avenue in 1911 is, by 1938, a thing the United States government recommends to you in a numbered list, sitting between a provision about fences and a provision about enforcement.',
    },
    {
      type: 'paragraph',
      text: 'How far this reached is a question the agency can’t answer, because it never counted. Asked years later what its insured mortgages had done along racial lines, the Federal Housing Administration reported that it held no information on non-white use of FHA-insured mortgages at all [ref:usccr-1961-housing]. By the end of 1959 it had insured $41.4 billion on 5.2 million home mortgages [ref:fha-annual-report-1959]. How many of those went to Black families isn’t a number anyone can look up, because nobody at the agency ever wrote it down.',
    },
    {
      type: 'paragraph',
      text: 'What did get counted was the result. The 1940 Census of Housing puts the whole country’s occupied dwellings on one page, split by tenure and by what the schedule called color of occupants. About 23 in 100 Black households own the roof over their heads. About 46 in 100 white households do [ref:census-1940-housing].',
    },
    {
      type: 'pullquote',
      text: 'Paragraph 935 never asked whether you paid your debts. It asked who your neighbors were.',
    },

    // ---- Era 1948: the covenant dies, the market does not ----
    { type: 'heading', level: 2 as const, text: '1948 · The words stay in the deed' },
    {
      type: 'paragraph',
      text: 'J. D. Shelley is a laborer who came up to St. Louis from Mississippi in 1930 with his wife and their six children. On August 11, 1945, he takes a warranty deed to the house at 4600 Labadie [ref:shelley-v-kraemer]. The sale has been arranged through a real estate dealer acting as the Shelleys’ own agent. The dealer is quietly holding title himself, in the name of a third party, and doesn’t tell them so. The trial court found that the Shelleys had no actual knowledge of the restrictive agreement when they bought [ref:shelley-v-kraemer].',
    },
    {
      type: 'paragraph',
      text: 'Louis Kraemer and his wife, who own other property on the same street bound by the same 1911 agreement, sue to stop the Shelleys from taking title, and the Supreme Court of Missouri orders the covenant enforced [ref:shelley-v-kraemer][ref:nps-shelley-nomination]. On May 3, 1948, in [[ent_case_shelley_v_kraemer_1948|Shelley v. Kraemer]], the Supreme Court reverses. The Park Service’s file on the house records the vote as six to nothing, with three justices not sitting [ref:nps-shelley-nomination]. And then the opinion draws the line precisely where the private paper begins: agreements like this one, standing alone, don’t violate any right guaranteed by the Fourteenth Amendment, and owners remain free to honor them voluntarily. What’s unconstitutional is a state court enforcing one, because "the action of state courts and judicial officers in their official capacities is to be regarded as action of the State" [ref:shelley-v-kraemer]. The words stay in the deed. Only the judge steps back.',
    },
    {
      type: 'paragraph',
      text: 'Seven years later, in August 1955, a family named James sits down in Chicago to buy a house. The seller is a speculator named Charles Peters, and the price is $13,500. Peters had bought the same house thirteen days earlier for $8,000. That’s the account as Beryl Satter reconstructs it from the record, and as the federal consumer bureau retells it [ref:satter-family-properties][ref:cfpb-contract-for-deed].',
    },
    {
      type: 'paragraph',
      text: 'What they sign isn’t a mortgage, and the difference is the entire story. Under a mortgage you own the house from the first day and the lender holds a claim against it. Under a contract for deed, the seller keeps legal title until the last payment clears, and until that day you have possession and nothing else [ref:cfpb-contract-for-deed]. You carry the repairs, the property taxes and the improvements, and everything you put into the building becomes part of a house that isn’t yours yet [ref:cfpb-contract-for-deed]. There’s no appraisal, no inspection, and no title search [ref:cfpb-contract-for-deed]. The terms in this case are $1,000 down, $105 a month, and a three-year term ending in a balloon payment of $10,500, which Peters says he’ll help them finance when it comes due [ref:cfpb-contract-for-deed]. Peters told them he was offering the arrangement because they might have trouble getting a loan, being, as he put it, "colored" [ref:cfpb-contract-for-deed].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_cfpb_contract_for_deed_2024',
    },
    {
      type: 'paragraph',
      text: 'After a year Peters sells the contract at a discount to another investor and stops answering for it. When the balloon payment comes due the family goes to six banks, and all six refuse, because the house isn’t worth $10,500 [ref:cfpb-contract-for-deed]. They’re evicted. The down payment, three years of monthly payments, and everything they put into the building stay with the seller [ref:cfpb-contract-for-deed]. Set the two instruments side by side and the eviction reads less like a risk of the arrangement than like its working end. Miss a payment on an ordinary mortgage and a clock starts: federal rules give a borrower 120 days before foreclosure can even begin, the foreclosure itself has to go through a court, and if the house sells for more than the debt, the surplus comes back to the borrower [ref:cfpb-contract-for-deed]. A contract for deed carries none of that. Being late once can be enough to end it [ref:cfpb-contract-for-deed].',
    },
    {
      type: 'paragraph',
      text: 'Why sign this instead of a mortgage? The federal government answers that in its own voice. Setting out the history in 2024, the Consumer Financial Protection Bureau writes that from the 1930s through the 1960s Black borrowers were largely excluded from the mainstream home mortgage market, and that given that lack of access to ordinary credit, contracts for deed were often the only way left to finance a house [ref:cfpb-contract-for-deed]. The report names what did the excluding: the redlining institutionalized after 1933, and the underwriting manual quoted a few paragraphs back [ref:cfpb-contract-for-deed].',
    },
    {
      type: 'paragraph',
      text: 'This wasn’t a handful of unusually cruel sellers. Researchers at the Samuel DuBois Cook Center on Social Equity at Duke University, working with the Voorhees Center at the University of Illinois Chicago, read more than 50,000 documents of depositions, pleadings and property records from two federal lawsuits and the Cook County Recorder of Deeds [ref:duke-cook-plunder]. Their finding, for Black buyers on Chicago’s South and West Sides, is that most of the homes sold to Black families during the 1950s and 1960s were sold on contract, somewhere between three quarters of them and nearly all of them, and that the average price carried a markup of close to double what the speculator had paid days or weeks before [ref:duke-cook-plunder][ref:cfpb-contract-for-deed]. Citing the historian Arnold Hirsch, the consumer bureau adds that a speculator could recover his entire investment in about two years [ref:cfpb-contract-for-deed].',
    },
    {
      type: 'mapInset',
      entityId: 'ent_bronzeville_001',
      label: 'Bronzeville, Chicago, Illinois',
    },
    {
      type: 'paragraph',
      text: 'Chicago’s contract buyers organized, and what came of it belongs in the record without rounding. The Contract Buyers League set out to stop the sales, renegotiate the contracts families were already trapped in, and open real lines of credit to Black borrowers [ref:cfpb-contract-for-deed]. Loyola University Chicago’s Center for Urban Research and Learning records that the League ran a planned payment strike and two federal lawsuits, and that 450 families had their contracts renegotiated, at an average saving of $13,500 each [ref:loyola-contract-buyers-league]. They won it themselves, on terms they forced, roughly a decade after the James family lost everything they’d paid in.',
    },
    {
      type: 'paragraph',
      text: 'Step back from the block, and the decade reads like progress. Black ownership climbs through the 1950s and the 1960s. White ownership climbs across the same years. Both lines rise together, and the space between them doesn’t close.',
    },
    {
      type: 'figure',
      packetId: 'tip_buying_a_home_era',
      metricIds: [
        'census-decennial-homeownership-black-nation',
        'census-decennial-homeownership-white_nh-nation',
      ],
      caption:
        'Homeownership rate by race, United States, decennial census, 1940–1980. Both lines rise together; the gap between them doesn’t close.',
    },

    // ---- Era 1968: the law, and what was taken out of it ----
    { type: 'heading', level: 2 as const, text: '1968 · The law arrives with its teeth pulled' },
    {
      type: 'paragraph',
      text: 'On April 10, 1968, the House takes up a federal open housing bill the Senate had passed on March 11 and adopts it, 250 to 172 [ref:house-historian-fair-housing]. The bill had been in front of Congress for more than a year, and in the House it had stopped moving [ref:house-historian-fair-housing]. Six days before the vote, on April 4, Martin Luther King Jr. is killed in Memphis. The House historian’s own account of that week says King’s murder "changed the calculus for passage" [ref:house-historian-fair-housing]. President Johnson signs the bill the following day, April 11 [ref:civil-rights-act-1968]. What he signs bans discrimination in the sale, rental and financing of housing, and it’s the sentence this chapter has been waiting for since 1911 [ref:fair-housing-act].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fair_housing_act_1968_doj',
    },
    {
      type: 'paragraph',
      text: 'Then there’s the part that’s easy to miss, because it isn’t in the promise, it’s in the plumbing. To move the bill through the Senate, its enforcement machinery had been taken out. The version its sponsors introduced would have let the housing department investigate complaints, hold evidentiary hearings and issue enforcement orders; an amendment stripped most of that away before passage [ref:hud-cityscape-fair-housing]. What survived is section 810(a), and it’s worth reading in the statute’s own words: if the Secretary decides to resolve a complaint, he "shall proceed to try to eliminate or correct the alleged discriminatory housing practice by informal methods of conference, conciliation, and persuasion" [ref:civil-rights-act-1968].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fair_housing_act_1968_sec810_conciliation',
    },
    {
      type: 'paragraph',
      text: 'Conference, conciliation and persuasion make up the whole toolkit. The Justice Department’s own history of the period puts it without softening: the bill authorized the department to conciliate but gave the Secretary no cease and desist authority [ref:doj-fair-housing-1968]. If conciliation fails, the statute gives the person who was discriminated against thirty days to go file their own lawsuit in federal court [ref:civil-rights-act-1968]. In that lawsuit, punitive damages are capped at $1,000, and the court may award attorney’s fees only if it finds the plaintiff isn’t financially able to pay them [ref:civil-rights-act-1968]. The right is real. The remedy is priced where most of the people holding the right can’t reach it, and the Attorney General may step in only where there’s a pattern or practice, or where the case raises an issue of general public importance [ref:civil-rights-act-1968].',
    },
    {
      type: 'paragraph',
      text: 'So the law changes, and then you wait to see what changes with it. In 1985, seventeen years on, the typical Black household brings in $14,820 while the typical white non-Hispanic household brings in $25,470, which works out to about $38,630 and $66,390 in 2024 dollars [ref:census-h5-income]. A house was never only a place to sleep. It’s what a family borrows against, and what it hands down. Striking a rule doesn’t go back and buy the houses that were never bought, or write the down-payment check a parent never got to write, because that parent was shut out too.',
    },
    {
      type: 'paragraph',
      text: 'The enforcement that came out in 1968 goes back in on September 13, 1988. That day the Fair Housing Amendments Act gives the housing department administrative law judges who can order relief and assess civil penalties [ref:fair-housing-amendments-1988]. The penalties run up to $10,000 for a first violation, $25,000 for a second within five years, and $50,000 for a third within seven [ref:fair-housing-amendments-1988]. It takes effect on the 180th day after enactment, March 12, 1989 [ref:fair-housing-amendments-1988]. Twenty years and eleven months separate the promise from the machinery for keeping it.',
    },

    // ---- Present-day close ----
    { type: 'heading', level: 2 as const, text: 'Today · You apply online' },
    {
      type: 'paragraph',
      text: 'Come all the way forward and the desk is mostly gone. You may never meet an appraiser. You upload your documents to a website, software you’ll never see scores them, and the application no longer carries a line about who your neighbors are. On its face it’s fair. The newest federal numbers still read a great deal like the oldest ones here. In 2023, about 46 in 100 Black households own their homes, against about 74 in 100 white non-Hispanic households [ref:census-hvs-homeownership-race]. Set that beside 1940, when the count came to about 23 in 100 against about 46 in 100 [ref:census-1940-housing]. Both lines are higher now. The distance between them is wider now than it was then, by roughly six points.',
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
      text: 'The refusals haven’t gone anywhere either. They’ve gone quiet, off the paper and into the software, where nobody has to sign their name to one. In 2023 a Black applicant is turned down for a mortgage more often than a white non-Hispanic applicant [ref:ffiec-hmda-2023], and the reason recorded is a credit score, a ratio, a number, never a neighborhood and never a name.',
    },
    {
      type: 'stat',
      packetId: 'tip_buying_a_home_era',
      kind: 'observation' as const,
      refId: 'obs:hmda-denial-rate-gap-black-white-nh-nation:nation:US:2023',
      caption:
        'Black–white non-Hispanic mortgage denial-rate gap, 2023. Raw gap, not risk-adjusted.',
    },
    {
      type: 'paragraph',
      text: 'The appraiser didn’t disappear either, and neither did the person showing you the house. HUD’s national paired-testing study sent equally qualified buyers to the same agents and found that Black homebuyers learned about roughly 17 percent fewer available homes than equally qualified white buyers, and were shown roughly 18 percent fewer [ref:hud-paired-testing-2012]. HUD calls that net measure "a conservative, lower-bound estimate of systematic discrimination against minority homeseekers" [ref:hud-paired-testing-2012]. On valuation, the Federal Housing Finance Agency reported that in 2021, about 23 in 100 homes in overwhelmingly minority tracts appraised below the price the buyer had already agreed to pay, against about 13 in 100 homes in tracts where the minority share is under half [ref:fhfa-appraisal-uad]. The agency is careful about what that comparison is and isn’t: it’s a raw count, not adjusted for the characteristics of the houses, and it says controlling for those characteristics may explain some of the gap but isn’t likely to explain all of it [ref:fhfa-appraisal-uad]. The adjusted version was measured separately. Comparing homes of similar quality in neighborhoods with similar amenities across 113 metropolitan areas, Brookings researchers found homes in majority-Black neighborhoods valued about a quarter lower, which they worked out to roughly $48,000 for an average home and about $156 billion in total [ref:brookings-devaluation]. In 2021, on the centennial of the Tulsa Race Massacre, the federal government stood up an interagency task force on appraisal bias [ref:pave-action-plan].',
    },
    {
      type: 'paragraph',
      text: 'Which leaves the software. The tidy version would be that the algorithm inherited the appraiser’s prejudice, and that isn’t what the research found. Economists at the Federal Reserve Board, comparing human and automated credit decisions, found instead that observable measures of risk explain most of the racial gap in mortgage denials, and that differential treatment by lenders plays a limited part in producing it, leaving a residual gap of one to two percentage points [ref:fed-mortgage-bias]. In the same paper they report that minority applicants are less likely to be approved by race-blind government automated underwriting systems, arriving as they do with lower credit scores and higher leverage [ref:fed-mortgage-bias]. The system isn’t reading your race. It’s reading a credit score, a down payment and a debt load. Every rule quoted here operated on those same three things.',
    },
    {
      type: 'paragraph',
      text: 'In 2022 the typical Black family has $44,900 to its name, while the typical white non-Hispanic family has $285,000 [ref:scf-2022]. The covenant, the grade, the manual and the contract were struck down, shelved or outlawed years ago. That pair of numbers is from 2022.',
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
      text: 'In 1917 the Court wrote that property "includes the right to acquire, use, and dispose of it," and said in terms that the right ran to Black citizens [ref:buchanan-v-warley]. In 1938 the government’s own manual told an appraiser to get covenants written into a developer’s deeds [ref:fha-manual-1938]. In 1968 Congress wrote the right down again and handed the Secretary conference, conciliation and persuasion to enforce it with [ref:civil-rights-act-1968]. Twenty years and eleven months later it added judges who could order relief and assess penalties [ref:fair-housing-amendments-1988]. Every one of those sentences is the country’s own, on its own letterhead, with its own date on it.',
    },
    {
      type: 'paragraph',
      text: 'None of it needs retelling in order to be believed. The file holds an agreement signed by thirty property owners, a survey form filled out block by block, a paragraph of federal underwriting guidance, a contract that kept the deed in the seller’s drawer, and a statute that promised a right and priced the remedy out of reach. Read the rest of the file alongside them. Buchanan went to court in Louisville, and the ordinance came down [ref:buchanan-v-warley]. J. D. Shelley took the deed to 4600 Labadie, and the Court reversed the order that would have taken it back [ref:shelley-v-kraemer]. Four hundred fifty families in Chicago ran a payment strike and two federal lawsuits and came out with their contracts rewritten, saving $13,500 apiece on average [ref:loyola-contract-buyers-league]. Researchers at Duke and the University of Illinois Chicago read more than 50,000 documents out of those lawsuits to count what the contracts took [ref:duke-cook-plunder]. In Hennepin County the deeds are still being read, one abstract at a time, by volunteers who confirm every hit by eye [ref:umn-mapping-prejudice], and in Washington State a survey the legislature ordered has been through more than seven million property records [ref:uw-covenants-project].',
    },
    {
      type: 'paragraph',
      text: 'The paper on Labadie Avenue was built to outlive every person who signed it. It ran into a laborer from Mississippi with six children and a warranty deed, and a Court that wouldn’t enforce it [ref:shelley-v-kraemer].',
    },
    {
      type: 'timeline',
      packetId: 'tip_buying_a_home_era',
    },
  ],
};

export default buyingAHomeArticle;
