/**
 * Flagship article: "Buying a Home" — the era-immersion redlining spine, rebuilt
 * as a single long-form publication on the /articles surface.
 *
 * Voice follows docs/content/era-immersion-style.md: cold open in second person,
 * the rule in force quoted from a primary document, the measured odds as a plain
 * comparison, a jump-cut forward, repeat, then a present-day close that hands off
 * to the spine chart. Data blocks bind to the published theme-impact packet
 * `tip_buying_a_home_era`; inline [ref:id] markers resolve to the references list.
 */

export const buyingAHomeArticle = {
  id: 'article_buying_a_home',
  slug: 'buying-a-home',
  title: 'Chapter: Buying a Home',
  summary:
    'For most of a century, the rules that decided who got to own a home in America were written down in plain language, and we quote them here word for word. They don’t survive as opinion or memory. They survive as documents, and the gap they opened is still sitting in the latest federal survey, waiting to be read.',
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
  relatedEntityIds: [],
  references: [
    {
      id: 'fha-manual-1938',
      label:
        'Federal Housing Administration, Underwriting Manual (1938 edition), paragraph 935, digitized by FRASER, Federal Reserve Bank of St. Louis.',
      url: 'https://fraser.stlouisfed.org/files/docs/publications/fha/1938feb_fha_underwritingmanual.pdf',
      locator: '¶935',
    },
    {
      id: 'mapping-inequality',
      label:
        'Robert K. Nelson, LaDale Winling, et al., "Mapping Inequality: Redlining in New Deal America," Digital Scholarship Lab, University of Richmond.',
      url: 'https://dsl.richmond.edu/panorama/redlining/',
      locator: 'Area D-30, Near North Side, Chicago',
    },
    {
      id: 'shelley-v-kraemer',
      label: 'Shelley v. Kraemer, 334 U.S. 1 (1948).',
      url: 'https://supreme.justia.com/cases/federal/us/334/1/',
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
      id: 'scf-2022',
      label:
        'Board of Governors of the Federal Reserve System, Survey of Consumer Finances, 2022.',
      url: 'https://www.federalreserve.gov/econres/scfindex.htm',
    },
    {
      id: 'aaronson-holc',
      label:
        'Daniel Aaronson, Daniel Hartley & Bhashkar Mazumder, "The Effects of the 1930s HOLC ‘Redlining’ Maps," American Economic Journal: Economic Policy 13(4), 2021.',
      url: 'https://www.aeaweb.org/articles?id=10.1257/pol.20190414',
    },
  ],
  body: [
    // ---- Era 1938 ----
    { type: 'heading', level: 2 as const, text: '1938 · You fill out the form' },
    {
      type: 'paragraph',
      text: 'You’re sitting across a desk from a man who’s about to decide whether the government will insure your mortgage, and everything about him is calm, because for him this is routine. He isn’t improvising. He’s following a manual, one you’ll never be handed and aren’t meant to see, though you can read it now, decades later, right over his shoulder: the Federal Housing Administration’s 1938 Underwriting Manual, paragraph 935, which tells him in careful bureaucratic prose exactly what a sound, lendable neighborhood is supposed to look like [ref:fha-manual-1938].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fha_underwriting_manual_1938_para935',
    },
    {
      type: 'paragraph',
      text: 'The word the manual reaches for, when it reaches for you, is “inharmonious.” Notice what it doesn’t ask. It doesn’t ask whether you pay your bills on time, whether you’ve saved for years, whether you’ve ever missed a debt in your life. It asks who lives next to you, and then it instructs the appraiser to guard the loan against the arrival of people like you, as though your presence were a kind of weather the property had to be insured against. And the arithmetic follows the language, the way it always does. In 1940, the first year the census bothers to count it, 23.6 percent of Black households own the roof over their heads, against 53 percent of white households [ref:census-historical-housing].',
    },
    {
      type: 'paragraph',
      text: 'And the manual isn’t working alone. A few blocks away the very same logic has been lifted off the page and drawn onto a map, in color, so a lender can take in a whole city at a glance. The Home Owners’ Loan Corporation has already graded your stretch of Chicago, shaded it, and written the reason out by hand in the margin, in the flat administrative voice of men who never expected anyone like you to read it back to them [ref:mapping-inequality].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_holc_area_d30_near_north_chicago_1940',
    },

    // ---- Covenant era ----
    { type: 'heading', level: 2 as const, text: '1911 · The clause was already in the deed' },
    {
      type: 'paragraph',
      text: 'Now push the calendar back, because none of this began with the federal appraiser. Long before Washington ever printed a manual, the deed to the house was already doing the work on its own. Consider a single covenant recorded on Labadie Avenue in St. Louis in 1911, a generation before the New Deal, which reaches past any particular buyer and binds the land itself, for fifty years, to a promise about who is allowed to live on it. The house, in other words, was drawing the color line before you ever walked up to it.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_shelley_restrictive_covenant_st_louis_1911',
    },
    {
      type: 'paragraph',
      text: 'It took until 1948 for the Supreme Court to catch up to that clause, and even then the fix was narrower than it sounds. In Shelley v. Kraemer the Court held that a court couldn’t be asked to enforce a covenant like this one. It didn’t strike the words from the deed, and it didn’t pretend they’d never been written. It said only that the state wouldn’t be the hand that swung them [ref:shelley-v-kraemer]. So the words stayed on the paper, quietly legal to write if no longer to enforce, and the private covenants, the FHA manual, and the HOLC map all went right on doing their jobs without ever needing a judge.',
    },
    {
      type: 'pullquote',
      text: 'The rule never asked whether you paid your debts. It asked who your neighbors were.',
    },

    // ---- Era 1955 ----
    { type: 'heading', level: 2 as const, text: '1955 · The gap moves with you' },
    {
      type: 'paragraph',
      text: 'Skip forward a generation and, from a distance, it can look like progress. The doors do open, a little. By 1950 the Black homeownership rate has climbed to 34.9 percent, and by 1960 to 38.4 percent, and if that were the only line on the chart you might reasonably call it a good decade. But white ownership is climbing across those same years too, from 55.1 percent to 64.9 percent [ref:census-historical-housing], and that second line is the one that matters. Both rise together, in step, and the distance between them doesn’t close. If anything it stretches a little wider, because a head start compounds, quietly, in the background, year after year.',
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
    {
      type: 'paragraph',
      text: 'Economists have since gone back and measured just how long that ink lasted, and the answer is hard to sit with. Studying the actual 1930s HOLC boundaries, Aaronson, Hartley, and Mazumder found that the grade a block was handed during the Depression still tracks that block’s access to credit and its rate of ownership decades on, long after the maps themselves had been quietly retired and filed away in a drawer [ref:aaronson-holc]. A line a clerk drew in 1937 was still shaping who could borrow, in neighborhoods that clerk never lived to see, on behalf of families who’d never heard his name.',
    },

    // ---- Era 1985 ----
    { type: 'heading', level: 2 as const, text: '1985 · The law is on your side now' },
    {
      type: 'paragraph',
      text: 'By 1985 the words themselves are finally against the law. The Fair Housing Act of 1968 bans discrimination by race in the sale, the rental, and the financing of a home, and this time the government means it [ref:fair-housing-act]. The covenant on Labadie Avenue is void. The manual’s language has been repudiated by the same agency that once printed it as instruction. On paper the whole rule has flipped, and a Black family in 1985 is, for the first time in this entire chapter, supposed to be able to walk up to the desk as an equal and be met as one.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fair_housing_act_1968_doj',
    },
    {
      type: 'paragraph',
      text: 'And still, in that same year, the median Black household earns $38,630 while the median white non-Hispanic household earns $66,390 [ref:census-historical-housing]. The rule that stacked the odds is gone, and the odds it stacked stay right where they were, because a house was never only a place to sleep. It’s the single largest thing most American families ever own, and the main thing they hand to their children. Repealing the rule doesn’t reach back and buy the houses that were never bought, or write the down-payment checks that were never gifted by a parent who’d been shut out of the market too. The law can change on a Tuesday. The inheritance it shaped takes generations to move, and it moves slowly.',
    },

    // ---- Present-day close ----
    { type: 'heading', level: 2 as const, text: 'Today · You apply online' },
    {
      type: 'paragraph',
      text: 'Come all the way forward to now, and the desk itself is gone. You never meet the appraiser. You upload your documents to a portal, a model you’ll never see scores them somewhere on a server, and nowhere in that pipeline does any manual tell anyone to weigh who your neighbors are. By every visible measure the machinery is neutral, and that’s exactly what makes the ending so strange. The newest federal numbers still read almost like the oldest ones in this chapter. In 2023, 45.6 percent of Black households own their homes, against 74.2 percent of white non-Hispanic households [ref:census-historical-housing], a gap wide enough that you could set the 1940 figures down beside it and struggle to say what, exactly, was ever undone.',
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
      text: 'The refusals haven’t disappeared either. They’ve just gone quiet, migrated out of the ledger and into the algorithm, where nobody has to sign them. In 2023 a Black applicant is turned down for a mortgage 6.3 percentage points more often than a white non-Hispanic applicant [ref:ffiec-hmda-2023], and no one anywhere in that pipeline has to write down a reason, or even needs to know they were part of the pattern at all.',
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
      text: 'And this is where the whole century finally comes to rest, on the household balance sheet, which forgets nothing. In 2022 the median Black family holds $44,900 in net worth, while the median white family holds $285,000 [ref:scf-2022]. Read that as the ending it actually is. The covenant, the manual, and the map, every one of them long since struck down or filed away, added up and carried forward into a single pair of numbers. The rules don’t need to still be on the books to keep working. Their arithmetic moved into the family a long time ago, quietly, house by house, and it’s still sitting there, waiting on the next generation to inherit it.',
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
      type: 'heading', level: 3 as const, text: 'The record, in order',
    },
    {
      type: 'paragraph',
      text: 'Every rule quoted in this chapter is sitting in the archive right now, with its own date attached, and none of it depends on us to be believed. Laid end to end and read in order, these documents aren’t really a story we’re telling you. They’re a story the country already told, in its own hand, on its own letterhead, and simply never got around to taking back.',
    },
    {
      type: 'timeline',
      packetId: 'tip_buying_a_home_era',
    },
  ],
};

export default buyingAHomeArticle;
