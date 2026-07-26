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
  title: 'Buying a Home',
  summary:
    'For a century the rules that decided who could own a home were written down, quoted here verbatim. The gap they opened is still measurable in the latest federal survey.',
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
      text: 'You are sitting across a desk from a man who will decide whether the government insures your mortgage. He is following a manual. You cannot see it, but you can read it now: the Federal Housing Administration’s 1938 Underwriting Manual, paragraph 935, tells him what a good neighborhood looks like [ref:fha-manual-1938].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fha_underwriting_manual_1938_para935',
    },
    {
      type: 'paragraph',
      text: 'The word for you, in that sentence, is "inharmonious." The manual does not ask whether you pay your debts. It asks who your neighbors are, and it instructs the appraiser to protect the loan against people like you. In 1940, the first year the census measures it, 23.6 percent of Black households own their homes; 53 percent of white households do [ref:census-historical-housing].',
    },
    {
      type: 'paragraph',
      text: 'Two doors down the same logic is drawn on a map. The Home Owners’ Loan Corporation grades your part of Chicago and writes the reason in plain hand [ref:mapping-inequality].',
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
      text: 'Push the calendar back. Long before the federal appraiser, the deed itself did the work. A covenant recorded on Labadie Avenue in St. Louis in 1911 binds the land, not the buyer, for fifty years.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_shelley_restrictive_covenant_st_louis_1911',
    },
    {
      type: 'paragraph',
      text: 'It took until 1948 for the Supreme Court to hold that a court could not enforce such a clause. Shelley v. Kraemer did not delete the words from the deed; it said the state could not be the one to swing them [ref:shelley-v-kraemer]. Private covenants, the FHA manual, and the HOLC map kept doing their jobs.',
    },
    {
      type: 'pullquote',
      text: 'The rule never asked whether you paid your debts. It asked who your neighbors were.',
    },

    // ---- Era 1955 ----
    { type: 'heading', level: 2 as const, text: '1955 · The gap moves with you' },
    {
      type: 'paragraph',
      text: 'A generation later the doors open a little. By 1950 the Black homeownership rate has climbed to 34.9 percent, and by 1960 to 38.4 percent. White ownership climbs too, from 55.1 percent to 64.9 percent [ref:census-historical-housing]. Both lines rise. The distance between them does not close; it widens.',
    },
    {
      type: 'figure',
      packetId: 'tip_buying_a_home_era',
      metricIds: [
        'census-decennial-homeownership-black-nation',
        'census-decennial-homeownership-white_nh-nation',
      ],
      caption:
        'Homeownership rate by race, United States, decennial census, 1940–1980. Both rise; the gap does not close.',
    },
    {
      type: 'paragraph',
      text: 'Economists later put a number on how durable the map was. Studying the 1930s HOLC boundaries, Aaronson, Hartley, and Mazumder find the grade a block was assigned still tracks its credit access and ownership decades later, long after the maps were officially retired [ref:aaronson-holc].',
    },

    // ---- Era 1985 ----
    { type: 'heading', level: 2 as const, text: '1985 · The law is on your side now' },
    {
      type: 'paragraph',
      text: 'By now the words are illegal. The Fair Housing Act of 1968 bans race discrimination in the sale, rental, and financing of housing [ref:fair-housing-act]. The covenant is void. The manual language is repudiated. The rule in force has flipped.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fair_housing_act_1968_doj',
    },
    {
      type: 'paragraph',
      text: 'And still, in 1985, the median Black household earns $38,630 to the median white non-Hispanic household’s $66,390 [ref:census-historical-housing]. The rule that stacked the odds is gone. The odds it stacked are inherited, because a house is the thing most American families pass down.',
    },

    // ---- Present-day close ----
    { type: 'heading', level: 2 as const, text: 'Today · You apply online' },
    {
      type: 'paragraph',
      text: 'You never meet the appraiser now. You upload documents. No manual tells anyone to weigh your neighbors. And the latest federal numbers still read like the old ones. In 2023, 45.6 percent of Black households own their homes against 74.2 percent of white non-Hispanic households [ref:census-historical-housing].',
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
      text: 'The denials are quieter but not gone. In 2023 a Black applicant is turned down for a mortgage 6.3 percentage points more often than a white non-Hispanic applicant [ref:ffiec-hmda-2023].',
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
      text: 'The house is where the century lands. In 2022 the median Black family holds $44,900 in net worth; the median white family holds $285,000 [ref:scf-2022]. That is the covenant, the manual, and the map, converted into a balance sheet.',
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
      text: 'Every rule quoted above is in the archive with its date. Read in sequence, they are less a story we tell than a chain of documents that already told it.',
    },
    {
      type: 'timeline',
      packetId: 'tip_buying_a_home_era',
    },
  ],
};

export default buyingAHomeArticle;
