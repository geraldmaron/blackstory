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
    'For almost a hundred years, the rules about who got to buy a home in America weren’t a secret. They were written down, in plain words, and we quote them here exactly. This isn’t a story that got passed down or blown out of proportion. It’s on paper, and the gap those rules opened up is still right there in the government’s own numbers today.',
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
      text: 'You’re sitting across a desk from a man who’s about to decide whether the government will back your mortgage, and he’s completely relaxed about it, because for him this is just another Tuesday. He isn’t making it up as he goes. He’s following a manual, one you’ll never get to hold and were never meant to see, though you can read it now, all these years later, right over his shoulder: the Federal Housing Administration’s 1938 Underwriting Manual, paragraph 935, which spells out for him, in careful government language, exactly what a good neighborhood, the kind worth lending in, is supposed to look like [ref:fha-manual-1938].',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fha_underwriting_manual_1938_para935',
    },
    {
      type: 'paragraph',
      text: 'The word the manual uses for you is “inharmonious.” Look at what it doesn’t ask. It doesn’t ask if you pay your bills on time, or whether you’ve been saving for years, or if you’ve ever missed a payment in your life. It asks who lives next to you, and then it tells the appraiser to protect the loan against people like you moving in, like you were bad weather the house needed insurance against. And the money follows the words, the way it always does. In 1940, the first year the census actually counts it, 23.6 percent of Black households own the roof over their heads, next to 53 percent of white households [ref:census-historical-housing].',
    },
    {
      type: 'paragraph',
      text: 'And the manual isn’t doing this alone. A few blocks over, the exact same thinking has been pulled off the page and drawn onto a map, in color, so a bank can size up a whole city in one glance. The Home Owners’ Loan Corporation has already graded your part of Chicago, shaded it in, and written the reason out by hand in the margin, in the flat, official voice of men who never once pictured someone like you reading it back to them [ref:mapping-inequality].',
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
      text: 'Now rewind, because none of this started with the government appraiser. Long before Washington ever printed a manual, the paperwork on the house was already doing the job by itself. Take one covenant filed on Labadie Avenue in St. Louis back in 1911, a full generation before the New Deal. It doesn’t just bind whoever’s buying. It ties the land itself, for fifty years, to a promise about who’s allowed to live there. The house, in other words, was drawing the color line before you even walked up to it.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_shelley_restrictive_covenant_st_louis_1911',
    },
    {
      type: 'paragraph',
      text: 'It took until 1948 for the Supreme Court to catch up to a clause like that, and even then it did less than you’d think. In Shelley v. Kraemer, the Court ruled that a court couldn’t be the one to enforce it. It didn’t cross the words out of the deed, and it didn’t act like they’d never been there. It just said the government wouldn’t do the dirty work of backing them up [ref:shelley-v-kraemer]. So the words stayed on the paper, and the private covenants, the FHA manual, and the HOLC map all kept right on working without ever needing a judge.',
    },
    {
      type: 'pullquote',
      text: 'The rule never asked whether you paid your debts. It asked who your neighbors were.',
    },

    // ---- Era 1955 ----
    { type: 'heading', level: 2 as const, text: '1955 · The gap moves with you' },
    {
      type: 'paragraph',
      text: 'Jump ahead a generation and, from far enough away, it can look like things are getting better. The doors do crack open, a little. By 1950 the Black homeownership rate has climbed to 34.9 percent, and by 1960 to 38.4 percent, and if that were the only line on the chart you’d call it a solid decade. But white ownership is climbing in those same years too, from 55.1 percent to 64.9 percent [ref:census-historical-housing], and that’s the line that matters. Both go up together, side by side, and the space between them never closes. If anything it gets a little wider, because a head start keeps paying off, quietly, year after year.',
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
      text: 'Researchers have gone back since and measured how long that ink actually lasted, and the answer is hard to sit with. Looking at the real 1930s HOLC boundaries, Aaronson, Hartley, and Mazumder found that the grade a block got during the Depression still lines up with that block’s access to loans and how many people own their homes decades later, long after the maps themselves were quietly shelved and forgotten [ref:aaronson-holc]. A line some clerk drew in 1937 was still deciding who could borrow, in neighborhoods he never lived to see, for families who’d never heard his name.',
    },

    // ---- Era 1985 ----
    { type: 'heading', level: 2 as const, text: '1985 · The law is on your side now' },
    {
      type: 'paragraph',
      text: 'By 1985 the words themselves are finally illegal. The Fair Housing Act of 1968 bans race discrimination in selling, renting, and financing a home, and this time the government means it [ref:fair-housing-act]. The covenant on Labadie Avenue is dead. The manual’s language has been thrown out by the same people who once handed it out as the rulebook. On paper the whole thing has flipped, and for the first time in this entire story, a Black family in 1985 is supposed to be able to walk up to that desk as an equal and get treated like one.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_buying_a_home_era',
      refId: 'art_fair_housing_act_1968_doj',
    },
    {
      type: 'paragraph',
      text: 'And still, that same year, the typical Black household brings in $38,630 while the typical white non-Hispanic household brings in $66,390 [ref:census-historical-housing]. The rule that stacked the deck is gone, but the deck stays stacked, because a house was never just somewhere to sleep. It’s the biggest thing most American families will ever own, and the main thing they pass on to their kids. Getting rid of the rule doesn’t go back and buy the houses that never got bought, or write the down-payment checks a parent never got to hand their kid, because that parent got shut out too. A law can change on a Tuesday. What it built up over fifty years takes generations to move.',
    },

    // ---- Present-day close ----
    { type: 'heading', level: 2 as const, text: 'Today · You apply online' },
    {
      type: 'paragraph',
      text: 'Come all the way to now, and the desk is gone. You never meet an appraiser. You upload your paperwork to a website, some software you’ll never see gives it a score, and nowhere in the whole process does anyone get told to think about who your neighbors are. On the surface, it’s completely fair. And that’s what makes the ending so strange. The newest government numbers still read almost like the oldest ones in this story. In 2023, 45.6 percent of Black households own their homes, next to 74.2 percent of white non-Hispanic households [ref:census-historical-housing], a gap so wide you could lay the 1940 numbers right beside it and struggle to say what actually changed.',
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
      text: 'The rejections haven’t gone anywhere either. They’ve just gotten quiet, moved off the paper and into the software, where nobody has to put their name on them. In 2023 a Black applicant gets turned down for a mortgage 6.3 percentage points more often than a white non-Hispanic applicant [ref:ffiec-hmda-2023], and nobody in that whole process has to write down why, or even know they’re part of the pattern at all.',
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
      text: 'And here’s where the whole century finally shows up: in what a family is actually worth. In 2022 the typical Black family has $44,900 to its name, while the typical white family has $285,000 [ref:scf-2022]. Read that for what it is. The covenant, the manual, and the map, every one of them struck down or filed away years ago, all added up and carried forward into that one pair of numbers. The rules don’t have to still be on the books to keep working. They moved into the family a long time ago, quietly, one house at a time, and they’re still sitting there, waiting for the next kid to inherit them.',
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
      text: 'Every rule we quoted here is sitting in an archive right now, with its own date stamped on it, and none of it needs us to be believed. Line them all up and read them in order, and they’re not really a story we’re telling you. They’re a story the country already told, in its own handwriting, on its own letterhead, and just never got around to taking back.',
    },
    {
      type: 'timeline',
      packetId: 'tip_buying_a_home_era',
    },
  ],
};

export default buyingAHomeArticle;
