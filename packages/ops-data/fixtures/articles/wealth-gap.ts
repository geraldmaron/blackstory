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
 * That packet ships with no primary-document artifacts (method_stance:
 * juxtaposition throughout, artifacts: []), so this article — unlike
 * buying-a-home — uses only `figure` and `stat` blocks bound to the packet's
 * observations. It does not use `primaryDocument` or `timeline` blocks, because
 * the publish gate in packages/ops-data/scripts/articles.ts requires a
 * primaryDocument refId to resolve against a packet artifact, and a timeline
 * block requires the packet to carry at least one dated artifact; this packet
 * has neither. Every figure named in prose is one of the packet's eleven
 * observations (packages/ops-data/fixtures/theme-impact/wealth-gap-packets.ts);
 * none is invented.
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
  ],
};

export default wealthGapArticle;
