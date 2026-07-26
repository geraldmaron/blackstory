/**
 * Flagship article: "The gap that never closed" — the era-immersion wealth-gap
 * spine, built on the /articles surface.
 *
 * Voice follows docs/content/era-immersion-style.md: cold open in second person,
 * the measured odds as a plain comparison, a jump-cut forward, repeat, then a
 * present-day close that hands off to the spine chart. Data blocks bind to the
 * published theme-impact packet `tip_wealth_gap_gap_that_never_closed`; inline
 * [ref:id] markers resolve to the references list.
 *
 * The packet now carries a mechanism spine of dated primary-document artifacts
 * (Special Field Orders No. 15 1865, Freedman's Savings Bank 1874, Social
 * Security Act 1935, GI Bill 1944), so this article uses `primaryDocument`
 * blocks (refId matching a packet artifactId) and a closing `timeline` block
 * alongside the `figure`/`stat` blocks. method_stance stays juxtaposition: the
 * events are placed beside the ratio series, never asserted as its single cause.
 * Every figure named in prose is one of the packet's observations, and every
 * primaryDocument refId is a packet artifact
 * (packages/ops-data/fixtures/theme-impact/wealth-gap-packets.ts); none is invented.
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
      id: 'special-field-orders-15',
      label:
        'Special Field Orders, No. 15 (Sherman, Jan. 16, 1865), William A. Gladstone Afro-American Military Collection, Library of Congress; original in RG 94, National Archives.',
      url: 'https://www.loc.gov/item/mss83434256/',
    },
    {
      id: 'freedmans-savings-bank',
      label:
        'Office of the Comptroller of the Currency, "The Freedman’s Savings Bank: Good Intentions Were Not Enough."',
      url: 'https://www.occ.gov/about/who-we-are/history/history-of-the-occ/1863-1865/1863-1865-freedmans-savings-bank.html',
    },
    {
      id: 'social-security-act-1935',
      label:
        'Social Security Act of 1935, full text, Social Security Administration history office.',
      url: 'https://www.ssa.gov/history/35act.html',
    },
    {
      id: 'gi-bill-turner-bound',
      label:
        'Sarah E. Turner and John Bound, "Closing the Gap or Widening the Divide: The Effects of the G.I. Bill and World War II on the Educational Outcomes of Black Americans," NBER Working Paper 9044 (2002).',
      url: 'https://www.nber.org/papers/w9044',
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
    // ---- Era 1860/1870: Emancipation ----
    { type: 'heading', level: 2 as const, text: '1860 · You are counted as property' },
    {
      type: 'paragraph',
      text: 'You are enslaved in 1860, so the census that year does not ask what you own, because the law says you are what someone else owns. The last full count taken before the war puts a white person’s average wealth at roughly fifty-six times a Black person’s, a ratio drawn almost entirely from what enslavers held and the enslaved did not [ref:dkks-wealth-of-two-nations].',
    },
    { type: 'heading', level: 2 as const, text: '1870 · You are freed with what the law lets you keep' },
    {
      type: 'paragraph',
      text: 'Emancipation comes, and with it, nothing changes hands. No land, no tools, no back pay for the years already worked. The first count taken after slavery, in 1870, still finds a white person holding about twenty-one times what a Black person holds [ref:dkks-wealth-of-two-nations]. The ratio has fallen by more than half in a decade, but a fall from fifty-six to one down to twenty-one to one is still a chasm, not a closing.',
    },
    {
      type: 'figure',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      metricIds: ['dkks-wealth-ratio-white-black-nation'],
      caption:
        'White-to-Black per-capita wealth ratio, United States, benchmark years 1860–2019 (Derenoncourt, Kim, Kuhn & Schularick).',
    },

    // ---- Mechanism: the land that was promised and taken back ----
    { type: 'heading', level: 2 as const, text: '1865 · The forty acres, promised and taken back' },
    {
      type: 'paragraph',
      text: 'There was one moment when the country came close to handing freed families the thing that actually builds wealth: land. In January 1865, General Sherman issued Special Field Orders No. 15, setting aside a strip of abandoned coastal land from Charleston down to Florida and dividing it into plots of no more than forty acres for freed families to settle [ref:special-field-orders-15]. Within months tens of thousands of people had moved onto it. Then, later that same year, President Andrew Johnson rescinded the order and gave the land back to the men who had owned it before the war. The one federal attempt to give freed people a starting stake was reversed before it could take hold, which is the backdrop to that 1870 reading of about twenty-one to one.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_special_field_orders_15_1865',
    },
    { type: 'heading', level: 2 as const, text: '1874 · The bank that held their savings fails' },
    {
      type: 'paragraph',
      text: 'What little Black families did manage to save after emancipation, many of them put into one place: the Freedman’s Savings Bank, chartered by Congress in 1865 and trusted precisely because it seemed to carry the government’s blessing. It did not carry the government’s guarantee. After managers moved depositor money into risky loans, the bank collapsed on June 29, 1874. By the Comptroller of the Currency’s own record, 61,144 depositors were left with losses of nearly $3 million, and Congress declined to make them whole [ref:freedmans-savings-bank]. Many spent decades petitioning, and in the end only about half recovered even a fraction of what they had saved.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_freedmans_savings_bank_collapse_1874',
    },

    // ---- Era 1921: Greenwood / national spine ----
    { type: 'heading', level: 2 as const, text: '1921 · What burns in two days' },
    {
      type: 'paragraph',
      text: 'By 1921 you have built something, if you are one of the roughly eleven thousand Black residents of [[ent_greenwood_district_001|Greenwood]], the thirty-five-block district on Tulsa’s north side: banks, hotels, theaters, doctors’ offices, a grocery you own outright. Over two days in late May and early June, white rioters burn most of it to the ground [ref:dkks-wealth-of-two-nations]. The national wealth ledger for that decade, the nearest benchmark taken in 1922, reads about eleven to one, white to Black. That number is the country’s, not Greenwood’s alone; no wealth series exists for Greenwood specifically, so the place is named and the number stays national.',
    },
    {
      type: 'pullquote',
      text: 'The number is the country’s, not Greenwood’s alone.',
    },
    {
      type: 'mapInset',
      entityId: 'ent_greenwood_district_001',
      label: 'Greenwood District, Tulsa, Oklahoma',
    },

    // ---- Mechanism: the New Deal and postwar help that reached weakly ----
    { type: 'heading', level: 2 as const, text: '1935 · The help that skips the jobs you hold' },
    {
      type: 'paragraph',
      text: 'The modern middle class was built with a lot of federal help, and Black families kept getting the thin end of it. Start with the Social Security Act of 1935. On its face it covers workers, not races. But it wrote two exceptions into the definition of a covered job: "agricultural labor" and "domestic service in a private home" [ref:social-security-act-1935]. Those were the two jobs that, at the time, held the large majority of Black workers in the country. So the program that would go on to define a secure old age started by leaving most Black workers out.',
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
    { type: 'heading', level: 2 as const, text: '1944 · The GI Bill that a local bank could deny' },
    {
      type: 'paragraph',
      text: 'Then came the GI Bill in 1944, the biggest wealth-building program of its generation: college tuition, and cheap loans to buy a home or start a business. But the money did not come straight from Washington. It ran through local banks, local colleges, and local Veterans Administration offices, and in the segregated South those local institutions could and did turn Black veterans away. Studying the outcomes, Turner and Bound found that for Black veterans confined to the South the bill "had little effect" and, on balance, widened the Black-white education gap rather than closing it [ref:gi-bill-turner-bound]. Same benefit on paper, delivered through doors that were open for white families and shut for Black ones.',
    },
    {
      type: 'primaryDocument',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      refId: 'art_gi_bill_1944_local_administration',
    },

    // ---- Era 1970/1972: Civil rights era ----
    { type: 'heading', level: 2 as const, text: '1970 · The ladder everyone says is there' },
    {
      type: 'paragraph',
      text: 'Two years after the Fair Housing Act bans discrimination in selling, renting, and financing a home, the 1970 census counts about 42 Black families owning their home for every 100, against about 65 white families for every 100, a gap of more than twenty homes in every hundred [ref:census-historical-housing].',
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
      text: 'The household-income tape first measures both groups side by side in 1972: a typical white family brings in $64,730 that year (in 2023 dollars), a typical Black family $37,250, putting the white household at close to one and three-quarter times the Black household’s income [ref:census-h5-income-1972]. Income and wealth are different measures, counted by different surveys, and this chapter keeps them apart rather than treating one as a stand-in for the other.',
    },

    // ---- Present-day close: 2022 ----
    { type: 'heading', level: 2 as const, text: 'Today · You check your accounts' },
    {
      type: 'paragraph',
      text: 'You check your accounts in 2022. The Survey of Consumer Finances puts a typical Black family’s net worth at $44,900, against a typical white family’s $285,000 [ref:scf-2022], a ratio of about six to one. Counted per person instead of per household, on the longer benchmark series that reaches back to 1860, the closest available point lands near seven to one. Either way you measure it, the ratio has barely moved across the last four decades.',
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
      text: 'Read the whole run together and a shape appears: a near-total gap at emancipation, a fall for a century, then a floor the ratio has not broken through since the surveys started tracking it triennially in 1989. The Federal Reserve’s own researchers, working from the same Survey of Consumer Finances data, describe that post-1989 period as one where the racial wealth gap has persisted rather than closed [ref:scf-2022-fednote].',
    },
    {
      type: 'figure',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
      metricIds: [
        'dkks-wealth-ratio-white-black-nation',
        'scf-wealth-ratio-white-black-nation',
      ],
      caption:
        'White-to-Black wealth ratio, United States, 1860–2022. Two distinct series, kept apart rather than spliced: the per-capita mean (1860–2019) and the household median (2022 shown; SCF runs triennially from 1989). The fall halts around 1980.',
    },
    {
      type: 'heading', level: 3 as const, text: 'What the two series measure, and don’t' },
    {
      type: 'paragraph',
      text: 'Two different wealth series appear in this chapter, and they are never averaged into one line. The per-capita mean ratio runs on benchmark years from 1860 to 2019; the 1860 and 1870 readings sit over a denominator near zero for the newly freed population and are single benchmark points, not annual figures. The household-median ratio runs triennially from 1989 onward and measures a different construct entirely, median household net worth rather than per-capita mean wealth [ref:dkks-wealth-of-two-nations][ref:scf-2022]. The two lines are placed side by side across eras because they cover different spans and different constructs; their agreement on a stalled post-1980 ratio is context, not proof that either one caused the other.',
    },
    { type: 'heading', level: 3 as const, text: 'The record, in order' },
    {
      type: 'paragraph',
      text: 'The events in this chapter are not our summary of what happened. They are documents, each with its own date, sitting in a federal archive or a peer-reviewed record right now: an order and its reversal, a bank failure counted to the last depositor, two laws and how they were run. Read in order, they trace the same slope the ratio does.',
    },
    {
      type: 'timeline',
      packetId: 'tip_wealth_gap_gap_that_never_closed',
    },
  ],
};

export default wealthGapArticle;
